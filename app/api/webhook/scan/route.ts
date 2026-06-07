/**
 * POST /api/webhook/scan
 *
 * Receives GitHub Actions SAST/DAST scan result payloads from the
 * oculs-scan.yml workflow. Full pipeline:
 *   1. Verify HMAC-SHA256 signature  (GITHUB_WEBHOOK_SECRET)
 *   2. Parse & validate WebhookPayload
 *   3. Resolve the scan row in Aurora (queued → running)
 *   4. Run Gemini AI triage on all findings
 *   5. Optionally generate auto-fix patches (ENABLE_AI_AUTOFIX flag)
 *   6. Bulk-insert vulnerabilities into Aurora
 *   7. Update scan row → completed / failed + cache summary
 *   8. Revalidate Next.js dashboard RSC cache
 *
 * All DB work runs in a single serverless-safe connection
 * (postgres.js max:1 — see lib/db/index.ts).
 */

import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { scans, vulnerabilities } from "@/lib/db/schema"
import {
  analyzeFindings,
  generateAutoFix,
  generateReport,
} from "@/lib/ai"
import { TOOLS_BY_ID } from "@/lib/tools"
import type { WebhookPayload, SeverityLevel } from "@/types"

// ---------------------------------------------------------------------------
// Runtime: Node.js (needs crypto + DB — NOT edge)
// ---------------------------------------------------------------------------
export const runtime = "nodejs"

// Vercel serverless functions time out at 60 s on hobby, 300 s on pro.
// We set a generous but safe limit here.
export const maxDuration = 60

// ---------------------------------------------------------------------------
// HMAC-SHA256 verification
// ---------------------------------------------------------------------------

/**
 * Verifies the X-Oculs-Signature-256 (or X-Hub-Signature-256) header.
 * Uses timing-safe comparison to prevent timing attacks.
 */
async function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  const secret = process.env.GITHUB_WEBHOOK_SECRET
  if (!secret) {
    console.error("[webhook] GITHUB_WEBHOOK_SECRET is not set")
    return false
  }
  if (!signatureHeader) return false

  // Accept both "sha256=<hex>" (GitHub style) and plain hex
  const incoming = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice(7)
    : signatureHeader

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sigBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(rawBody),
  )
  const expected = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  // Timing-safe comparison via crypto.subtle (same length buffers)
  if (incoming.length !== expected.length) return false
  const inBuf = encoder.encode(incoming)
  const exBuf = encoder.encode(expected)

  // crypto.subtle does not expose timingSafeEqual, so we XOR manually
  // over fixed-length hex strings — equivalent protection.
  let diff = 0
  for (let i = 0; i < inBuf.length; i++) {
    diff |= inBuf[i] ^ exBuf[i]
  }
  return diff === 0
}

// ---------------------------------------------------------------------------
// Severity weight map — mirrors lib/db/queries.ts RISK_WEIGHTS
// ---------------------------------------------------------------------------
const SEVERITY_WEIGHTS: Record<SeverityLevel, number> = {
  critical: 40,
  high: 20,
  medium: 8,
  low: 2,
  info: 0,
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Read raw body (needed for HMAC) ──────────────────────────────────
  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    return NextResponse.json({ error: "Failed to read request body" }, { status: 400 })
  }

  // ── 2. Verify HMAC signature ────────────────────────────────────────────
  const sigHeader =
    req.headers.get("x-oculs-signature-256") ??
    req.headers.get("x-hub-signature-256")

  const valid = await verifySignature(rawBody, sigHeader)
  if (!valid) {
    console.warn("[webhook] Invalid or missing HMAC signature")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ── 3. Parse payload ─────────────────────────────────────────────────────
  let payload: WebhookPayload
  try {
    payload = JSON.parse(rawBody) as WebhookPayload
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
  }

  const { event, scanId, repository, branch, commitSha, findings = [] } = payload

  // Validate required fields
  if (!event || !scanId || !repository || !branch) {
    return NextResponse.json(
      { error: "Missing required fields: event, scanId, repository, branch" },
      { status: 400 },
    )
  }

  // ── 4. Handle scan.started ───────────────────────────────────────────────
  if (event === "scan.started") {
    try {
      await db
        .update(scans)
        .set({ status: "running", startedAt: new Date() })
        .where(eq(scans.id, scanId))
      revalidatePath("/dashboard")
    } catch (err) {
      console.error("[webhook] scan.started DB update failed:", err)
      // Non-fatal — GitHub Actions can continue
    }
    return NextResponse.json({ received: true, event })
  }

  // ── 5. Handle scan.failed ────────────────────────────────────────────────
  if (event === "scan.failed") {
    try {
      await db
        .update(scans)
        .set({
          status: "failed",
          completedAt: new Date(),
          error: "GitHub Actions workflow reported failure",
        })
        .where(eq(scans.id, scanId))
      revalidatePath("/dashboard")
    } catch (err) {
      console.error("[webhook] scan.failed DB update failed:", err)
    }
    return NextResponse.json({ received: true, event })
  }

  // ── 6. Handle scan.completed ─────────────────────────────────────────────
  if (event !== "scan.completed") {
    return NextResponse.json({ error: `Unknown event: ${event}` }, { status: 400 })
  }

  try {
    // Mark scan as running while we process (idempotent if already running)
    await db
      .update(scans)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(scans.id, scanId))
  } catch (err) {
    console.error("[webhook] Failed to mark scan as running:", err)
    return NextResponse.json({ error: "Database unreachable" }, { status: 503 })
  }

  // ── 7. Resolve project & user from the scan row ──────────────────────────
  let scanRow: { projectId: string; userId: string } | undefined
  try {
    const [row] = await db
      .select({ projectId: scans.projectId, userId: scans.userId })
      .from(scans)
      .where(eq(scans.id, scanId))
      .limit(1)
    scanRow = row
  } catch (err) {
    console.error("[webhook] Failed to fetch scan row:", err)
    return NextResponse.json({ error: "Database unreachable" }, { status: 503 })
  }

  if (!scanRow) {
    console.warn("[webhook] Scan ID not found:", scanId)
    return NextResponse.json({ error: "Scan not found" }, { status: 404 })
  }

  const { projectId, userId } = scanRow

  // ── 8. AI triage all findings ────────────────────────────────────────────
  const enableAutoFix = process.env.ENABLE_AI_AUTOFIX === "true"
  let triaged = findings.length > 0 ? await analyzeFindings(findings) : []

  // ── 9. Generate auto-fix patches (if enabled, critical/high only) ────────
  if (enableAutoFix && triaged.length > 0) {
    const autoFixTargets = triaged.filter(
      (f) => f.triageSeverity === "critical" || f.triageSeverity === "high",
    )
    await Promise.allSettled(
      autoFixTargets.map(async (f, idx) => {
        try {
          const fix = await generateAutoFix(f)
          const originalIdx = triaged.indexOf(f)
          triaged[originalIdx] = {
            ...triaged[originalIdx],
            // Attach fix data inline so the insert step can use it
            ...(fix.patch ? { _fixPatch: fix.patch, _fixExplanation: fix.explanation, _fixModel: fix.model } : {}),
          } as typeof f & { _fixPatch?: string; _fixExplanation?: string; _fixModel?: string }
        } catch (err) {
          console.error(`[webhook] Auto-fix failed for finding ${idx}:`, err)
        }
      }),
    )
  }

  // ── 10. Generate scan report ──────────────────────────────────────────────
  let report: Awaited<ReturnType<typeof generateReport>> | null = null
  try {
    report = await generateReport(repository, branch, triaged)
  } catch (err) {
    console.error("[webhook] Report generation failed:", err)
  }

  // ── 11. Build summary counts ──────────────────────────────────────────────
  const summary: Record<SeverityLevel, number> = {
    critical: 0, high: 0, medium: 0, low: 0, info: 0,
  }
  for (const f of triaged) summary[f.triageSeverity]++
  const riskScore = report?.riskScore ?? Math.min(
    100,
    Object.entries(summary).reduce(
      (acc, [sev, cnt]) => acc + SEVERITY_WEIGHTS[sev as SeverityLevel] * cnt,
      0,
    ),
  )

  // ── 12. Bulk-insert vulnerabilities ──────────────────────────────────────
  if (triaged.length > 0) {
    const rows = triaged.map((f) => {
      // Cast to access optional fix fields attached in step 9
      const withFix = f as typeof f & {
        _fixPatch?: string
        _fixExplanation?: string
        _fixModel?: string
      }

      // Resolve tool category from the catalog; default to "sast" if unknown
      const toolSpec = TOOLS_BY_ID[f.tool]
      const category = toolSpec?.category ?? "sast"

      return {
        scanId,
        projectId,
        userId,
        tool: f.tool,
        category,
        ruleId: f.ruleId ?? null,
        title: f.title,
        description: f.description ?? null,
        severity: f.triageSeverity,      // use AI-triaged severity
        confidence: f.confidence ?? null,
        cweId: f.cweId || null,
        owaspCategory: f.owaspCategory || null,
        cvssScore: f.cvssScore || null,
        filePath: f.filePath ?? null,
        lineStart: f.lineStart ?? null,
        lineEnd: f.lineEnd ?? null,
        targetUrl: f.targetUrl ?? null,
        codeSnippet: f.codeSnippet ?? null,
        remediation: f.remediation ?? null,
        aiFixPatch: withFix._fixPatch ?? null,
        aiFixExplanation: withFix._fixExplanation ?? null,
        aiFixModel: withFix._fixModel ?? null,
        fixStatus: withFix._fixPatch ? ("suggested" as const) : ("none" as const),
        references: f.references ?? null,
        fingerprint: f.fingerprint,
        raw: f as unknown as Record<string, unknown>,
      }
    })

    try {
      // Insert in batches of 50 to stay within Aurora serverless payload limits
      const BATCH = 50
      for (let i = 0; i < rows.length; i += BATCH) {
        await db.insert(vulnerabilities).values(rows.slice(i, i + BATCH))
      }
    } catch (err) {
      console.error("[webhook] Vulnerability insert failed:", err)
      await db
        .update(scans)
        .set({
          status: "failed",
          completedAt: new Date(),
          error: "Failed to persist vulnerability findings",
        })
        .where(eq(scans.id, scanId))
      return NextResponse.json({ error: "Failed to persist findings" }, { status: 500 })
    }
  }

  // ── 13. Finalise scan row ─────────────────────────────────────────────────
  try {
    await db
      .update(scans)
      .set({
        status: "completed",
        completedAt: new Date(),
        commitSha,
        branch,
        vulnerabilitiesCount: triaged.length,
        summary: { ...summary, riskScore },
        error: null,
      })
      .where(eq(scans.id, scanId))
  } catch (err) {
    console.error("[webhook] Final scan update failed:", err)
  }

  // ── 14. Revalidate dashboard RSC cache ────────────────────────────────────
  revalidatePath("/dashboard")

  return NextResponse.json({
    received: true,
    scanId,
    findings: triaged.length,
    riskScore,
    summary,
  })
}