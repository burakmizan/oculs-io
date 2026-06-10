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
import { eq, count, and, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { scans, vulnerabilities, accounts, projects } from "@/lib/db/schema"
import { TOOLS_BY_ID } from "@/lib/tools"
import { sendScanAlert } from "@/lib/notify"
import type { WebhookPayload, SeverityLevel } from "@/types"
import type { TriagedFinding } from "@/lib/ai"

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

  // Idempotency guard — the workflow fires one scan.completed per tool PLUS a
  // final empty "summary ping" (notify-complete sends findings:[]). A completed
  // event carrying no findings must never roll an already-finished scan back to
  // "running" or re-post commit statuses. We only finalise the scan row here and
  // return early, leaving any real findings already persisted untouched.
  if (findings.length === 0) {
    try {
      const [existing] = await db
        .select({ status: scans.status, vulnerabilitiesCount: scans.vulnerabilitiesCount })
        .from(scans)
        .where(eq(scans.id, scanId))
        .limit(1)

      // Recount from Aurora so the summary ping reflects everything persisted so far.
      const [countResult] = await db
        .select({ count: count(vulnerabilities.id) })
        .from(vulnerabilities)
        .where(eq(vulnerabilities.scanId, scanId))
      const totalCount = Number(countResult?.count ?? existing?.vulnerabilitiesCount ?? 0)

      await db
        .update(scans)
        .set({
          status: "completed",
          completedAt: new Date(),
          commitSha,
          branch,
          vulnerabilitiesCount: totalCount,
          error: null,
        })
        .where(eq(scans.id, scanId))
      revalidatePath("/dashboard")
    } catch (err) {
      console.error("[webhook] Summary-ping finalise failed (non-fatal):", err)
    }
    return NextResponse.json({ received: true, event, summaryPing: true })
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

  // ── 8. Map raw findings to TriagedFinding format ─────────────────────────
  // Gemini triage runs lazily on /report/[scanId] — no rate limit issues.
  const triaged = findings.map(f => ({
    ...f,
    triageSeverity: f.severity as SeverityLevel,
    triageReasoning: "",
    cweId: f.cweId ?? "",
    owaspCategory: f.owaspCategory ?? "",
    cvssScore: f.cvssScore ?? "",
    remediation: (f as any).remediation ?? "",
    fingerprint: (() => {
      const raw = `${f.tool}::${f.ruleId ?? ""}::${f.filePath ?? f.targetUrl ?? ""}::${f.lineStart ?? 0}`
      let hash = 5381
      for (let i = 0; i < raw.length; i++) {
        hash = ((hash << 5) + hash) ^ raw.charCodeAt(i)
        hash = hash >>> 0
      }
      return hash.toString(16).padStart(8, "0")
    })(),
  }))

  // Auto-fix and report generation moved to dedicated report page
  // to avoid Gemini rate limits during bulk webhook ingestion.

  // ── 9. Build summary counts ──────────────────────────────────────────────
  const summary: Record<SeverityLevel, number> = {
    critical: 0, high: 0, medium: 0, low: 0, info: 0,
  }
  for (const f of triaged) summary[f.triageSeverity]++
  const riskScore = Math.min(
    100,
    Object.entries(summary).reduce(
      (acc, [sev, cnt]) => acc + SEVERITY_WEIGHTS[sev as SeverityLevel] * cnt,
      0,
    ),
  )

  // ── 10. Bulk-insert vulnerabilities ─────────────────────────────────────
  if (triaged.length > 0) {
    // Carry forward mutes: any fingerprint this user previously marked as
    // false_positive / dismissed stays suppressed on every future scan.
    const mutedFingerprints = new Set<string>()
    try {
      const prior = await db
        .selectDistinct({ fingerprint: vulnerabilities.fingerprint })
        .from(vulnerabilities)
        .where(
          and(
            eq(vulnerabilities.userId, userId),
            inArray(vulnerabilities.status, ["false_positive", "dismissed"]),
          ),
        )
      for (const p of prior) if (p.fingerprint) mutedFingerprints.add(p.fingerprint)
    } catch (err) {
      console.error("[webhook] Mute lookup failed (non-fatal):", err)
    }

    const rows = triaged.map((f) => {
      // Resolve tool category from the catalog; default to "sast" if unknown
      const toolSpec = TOOLS_BY_ID[f.tool]
      const category = toolSpec?.category ?? "sast"
      const isMuted = mutedFingerprints.has(f.fingerprint)

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
        aiFixPatch: null,
        aiFixExplanation: null,
        aiFixModel: null,
        fixStatus: "none" as const,
        status: isMuted ? ("false_positive" as const) : ("open" as const),
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

  // ── 11. Finalise scan row ────────────────────────────────────────────
  try {
    // Count total vulnerabilities in Aurora for this scan (may span multiple webhook calls)
    const [countResult] = await db
      .select({ count: count(vulnerabilities.id) })
      .from(vulnerabilities)
      .where(eq(vulnerabilities.scanId, scanId))

    const totalCount = Number(countResult?.count ?? triaged.length)

    await db
      .update(scans)
      .set({
        status: "completed",
        completedAt: new Date(),
        commitSha,
        branch,
        vulnerabilitiesCount: totalCount,
        summary: { ...summary, riskScore },
        error: null,
      })
      .where(eq(scans.id, scanId))
  } catch (err) {
    console.error("[webhook] Final scan update failed:", err)
  }

  // ── 12. Post a GitHub commit status (PR/merge gate) ───────────────────────
  // Gate threshold is a per-tenant policy stored on the project.
  if (commitSha) {
    try {
      let gateThreshold = "critical"
      try {
        const [proj] = await db
          .select({ gateThreshold: projects.gateThreshold })
          .from(projects)
          .where(eq(projects.id, projectId))
          .limit(1)
        gateThreshold = proj?.gateThreshold ?? "critical"
      } catch { /* default */ }

      if (gateThreshold !== "off") {
        await postCommitStatus({
          repository,
          commitSha,
          scanId,
          userId,
          summary,
          gateThreshold,
          riskScore,
        })
      }
    } catch (err) {
      console.error("[webhook] Commit status post failed:", err)
      // Non-fatal — the scan itself is already recorded.
    }
  }

  // ── 13. Notify Slack/Discord if this batch met the user's threshold ───────
  try {
    await sendScanAlert({ userId, repository, scanId, summary })
  } catch (err) {
    console.error("[webhook] Scan alert failed (non-fatal):", err)
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

// ---------------------------------------------------------------------------
// GitHub commit status — turns Oculs into a PR/merge gate
// ---------------------------------------------------------------------------

/**
 * Posts a commit status to the scanned SHA. With branch protection enabled
 * requiring the "oculs/security" check, a critical finding blocks merge.
 * Token is resolved from the project owner's stored OAuth account.
 */
async function postCommitStatus(input: {
  repository: string
  commitSha: string
  scanId: string
  userId: string
  summary: Record<SeverityLevel, number>
  gateThreshold: string
  riskScore: number
}): Promise<void> {
  const [owner, repo] = input.repository.split("/")
  if (!owner || !repo) return

  // Resolve the owner's GitHub token (webhook has no session)
  let token: string | null = null
  try {
    const [acct] = await db
      .select({ access_token: accounts.access_token })
      .from(accounts)
      .where(eq(accounts.userId, input.userId))
      .limit(1)
    token = acct?.access_token ?? process.env.GITHUB_TOKEN ?? null
  } catch { /* fall through */ }
  if (!token) return

  // Count findings at or above the configured threshold.
  const order: SeverityLevel[] = ["critical", "high", "medium", "low", "info"]
  const cutoff = order.indexOf(input.gateThreshold as SeverityLevel)
  const blocking = order
    .slice(0, cutoff < 0 ? 1 : cutoff + 1)
    .reduce((sum, sev) => sum + (input.summary[sev] ?? 0), 0)

  const passed = blocking === 0
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://oculs-io.vercel.app"

  await fetch(
    `https://api.github.com/repos/${owner}/${repo}/statuses/${input.commitSha}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        state: passed ? "success" : "failure",
        context: "oculs/security",
        description: passed
          ? `No findings at/above ${input.gateThreshold} · risk ${input.riskScore}/100`
          : `${blocking} finding(s) at/above ${input.gateThreshold} · risk ${input.riskScore}/100`,
        target_url: `${appUrl}/dashboard/report/${input.scanId}`,
      }),
    },
  )
}