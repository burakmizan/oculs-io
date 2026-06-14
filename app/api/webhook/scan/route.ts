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
import { eq, count, and, inArray, ne } from "drizzle-orm"
import { db } from "@/lib/db"
import { scans, vulnerabilities, accounts, projects } from "@/lib/db/schema"
import { TOOLS_BY_ID } from "@/lib/tools"
import { sendScanAlert } from "@/lib/notify"
import type { WebhookPayload, WebhookFinding, SeverityLevel } from "@/types"
import { analyzeFindings } from "@/lib/ai"

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

  // The workflow fires one scan.completed PER TOOL (each carrying that tool's
  // findings, often empty), and ONE final event from notify-complete carrying
  // {"final": true}. Only the final event may mark the scan "completed" — so the
  // dashboard can never finish before GitHub Actions finishes every job.
  const isFinal = (payload as { final?: boolean }).final === true

  // ── 6a. FINAL event → the whole workflow is done. Compute the summary from
  // everything per-tool events persisted, then finalise (once).
  if (isFinal) {
    try {
      const rows = await db
        .select({ severity: vulnerabilities.severity })
        .from(vulnerabilities)
        .where(eq(vulnerabilities.scanId, scanId))

      const summary: Record<SeverityLevel, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
      for (const r of rows) summary[r.severity as SeverityLevel]++
      const totalCount = rows.length
      const riskScore = Math.min(
        100,
        Object.entries(summary).reduce(
          (acc, [sev, cnt]) => acc + SEVERITY_WEIGHTS[sev as SeverityLevel] * cnt,
          0,
        ),
      )

      const [srow] = await db
        .select({ projectId: scans.projectId, userId: scans.userId })
        .from(scans)
        .where(eq(scans.id, scanId))
        .limit(1)

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

      // Commit-status gate (once, from the full result set)
      if (srow && commitSha) {
        try {
          let gateThreshold = "critical"
          try {
            const [proj] = await db
              .select({ gateThreshold: projects.gateThreshold })
              .from(projects)
              .where(eq(projects.id, srow.projectId))
              .limit(1)
            gateThreshold = proj?.gateThreshold ?? "critical"
          } catch { /* default */ }
          if (gateThreshold !== "off") {
            await postCommitStatus({ repository, commitSha, scanId, userId: srow.userId, summary, gateThreshold, riskScore })
          }
        } catch (err) {
          console.error("[webhook] Commit status post failed:", err)
        }
      }

      // Slack/Discord alert (once)
      if (srow) {
        try {
          await sendScanAlert({ userId: srow.userId, repository, scanId, summary })
        } catch (err) {
          console.error("[webhook] Scan alert failed (non-fatal):", err)
        }
      }

      revalidatePath("/dashboard")
    } catch (err) {
      console.error("[webhook] Finalise failed (non-fatal):", err)
    }
    return NextResponse.json({ received: true, event, finalized: true })
  }

  // ── 6b. Per-tool event with NO findings → nothing to persist. Keep the scan
  // "running" so it never finishes early, and return. (Don't downgrade a scan
  // that is somehow already completed.)
  if (findings.length === 0) {
    try {
      await db
        .update(scans)
        .set({ status: "running", startedAt: new Date() })
        .where(and(eq(scans.id, scanId), ne(scans.status, "completed")))
    } catch (err) {
      console.error("[webhook] Per-tool empty event update failed (non-fatal):", err)
    }
    return NextResponse.json({ received: true, event, perTool: true, findings: 0 })
  }

  // ── 6c. Per-tool event WITH findings → triage + persist, but keep "running".
  try {
    await db
      .update(scans)
      .set({ status: "running", startedAt: new Date() })
      .where(and(eq(scans.id, scanId), ne(scans.status, "completed")))
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

  // ── 7.5. Server-side false positive pre-filter ───────────────────────────
  // Suppresses known false positive patterns that apply universally across ALL
  // customer repositories — not project-specific. These are structural patterns
  // that security tools consistently misreport regardless of the repo being scanned.
  //
  // This runs BEFORE AI triage to save Gemini tokens and prevent noise from
  // reaching the database.
  function isUniversalFalsePositive(f: WebhookFinding): boolean {
    const filePath = (f.filePath ?? "").toLowerCase()
    const title = (f.title ?? "").toLowerCase()
    const description = (f.description ?? "").toLowerCase()
    const ruleId = (f.ruleId ?? "").toLowerCase()
    const codeSnippet = (f.codeSnippet ?? "").toLowerCase()

    // ── Gitleaks: template/example files with documented placeholder values ──
    // Any repo may have .env.example, .env.sample, .env.template with placeholder keys
    if (f.tool === "gitleaks") {
      const exampleFilePatterns = [
        /\.env\.example$/i,
        /\.env\.sample$/i,
        /\.env\.template$/i,
        /\.env\.dist$/i,
        /example\.env$/i,
        /sample\.env$/i,
      ]
      if (exampleFilePatterns.some(re => re.test(filePath))) return true

      // Config files that contain regex PATTERNS for secret detection — not real secrets
      const secretDetectorConfigs = [
        /gitleaks\.toml$/i,
        /\.gitleaks\.toml$/i,
        /\.secrets\.baseline$/i,
        /detect-secrets\.json$/i,
        /\.trufflehog\.json$/i,
        /\.pre-commit-config\.yaml$/i,
      ]
      if (secretDetectorConfigs.some(re => re.test(filePath))) return true

      // AWS canonical documentation example keys — appear in thousands of tutorials
      // Reference: https://docs.aws.amazon.com/general/latest/gr/aws-access-keys-best-practices.html
      const knownExampleValues = [
        "akiaiosfodnn7example",
        "wjalrxutnfemi/k7mdeng/bpxrficyexamplekey",
        "change_me",
        "your_",
        "example_",
        "<your-",
        "${your_",
        "placeholder",
        "dummy_",
        "fake_",
        "test_secret",
        "insert_",
        "replace_",
      ]
      if (knownExampleValues.some(v => codeSnippet.includes(v))) return true
      if (knownExampleValues.some(v => description.includes(v))) return true
    }

    // ── Semgrep: GitHub Actions workflow injection false positives ────────────
    // CWE-78 on ${{ github.* }} in workflow files — these are NOT shell-injected
    // when used at the job env: level (which is the safe pattern)
    if (f.tool === "semgrep") {
      const isWorkflowFile =
        filePath.includes(".github/workflows/") ||
        filePath.includes(".github\\workflows\\") ||
        (filePath.endsWith(".yml") && filePath.includes("workflow"))

      if (isWorkflowFile && (ruleId.includes("cwe-78") || ruleId.includes("injection") || title.includes("injection"))) {
        return true
      }

      // Generated/vendor directories — never real app code
      const generatedPaths = [
        /^node_modules\//i,
        /^\/?\.next\//i,
        /^\/?dist\//i,
        /^\/?build\//i,
        /^\/?vendor\//i,
        /\/__pycache__\//i,
        /\/\.yarn\//i,
        /\/coverage\//i,
        /package-lock\.json$/i,
        /yarn\.lock$/i,
        /pnpm-lock\.yaml$/i,
      ]
      if (generatedPaths.some(re => re.test(filePath))) return true
    }

    // ── Bearer: correct escape functions flagged as XSS ──────────────────────
    // Bearer flags hand-rolled XML/HTML escape functions even when they are correct
    if (f.tool === "bearer") {
      const correctEscapeFunctions = [
        "escapexml",
        "escapehtml",
        "sanitizehtml",
        "htmlescape",
        "xmlescape",
        "encodehtml",
      ]
      if (
        ruleId.includes("unsafe-html") &&
        correctEscapeFunctions.some(fn => title.includes(fn) || description.includes(fn) || codeSnippet.includes(fn))
      ) {
        return true
      }
    }

    // ── Universal: lock files and generated files are never real findings ─────
    const neverScanPaths = [
      /package-lock\.json$/i,
      /yarn\.lock$/i,
      /pnpm-lock\.yaml$/i,
      /composer\.lock$/i,
      /gemfile\.lock$/i,
      /cargo\.lock$/i,
      /poetry\.lock$/i,
      /pipfile\.lock$/i,
    ]
    if (neverScanPaths.some(re => re.test(filePath))) return true

    return false
  }

  // Apply the pre-filter — log suppressed count for observability
  const beforeFilter = findings.length
  const filteredFindings = findings.filter(f => !isUniversalFalsePositive(f))
  const suppressedCount = beforeFilter - filteredFindings.length
  if (suppressedCount > 0) {
    console.log(`[webhook] Pre-filter suppressed ${suppressedCount}/${beforeFilter} universal false positives for scan ${scanId}`)
  }

  // ── 8. Map raw findings to TriagedFinding format ─────────────────────────
  // Base mapping uses raw tool values — this is the fallback if AI triage fails.
  const triaged = filteredFindings.map(f => ({
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

  // Run Gemini AI triage and merge results by index. Resilient by design:
  // if the call throws, returns fewer results, or yields an invalid severity,
  // the affected findings simply keep their raw tool values above.
  try {
    const aiResults = await analyzeFindings(filteredFindings)
    aiResults.forEach((ai, idx) => {
      const base = triaged[idx]
      if (!base) return
      if (ai.triageSeverity in SEVERITY_WEIGHTS) {
        base.triageSeverity = ai.triageSeverity
      }
      base.triageReasoning = ai.triageReasoning || base.triageReasoning
      base.cweId = ai.cweId || base.cweId
      base.owaspCategory = ai.owaspCategory || base.owaspCategory
      base.cvssScore = ai.cvssScore || base.cvssScore
      base.remediation = ai.remediation || base.remediation
      // If AI identified this as a false positive, mark it as such in the DB
      // so it shows in the "Muted" tab and doesn't inflate the risk score.
      if ((ai as { isFalsePositive?: boolean }).isFalsePositive === true) {
        base.triageSeverity = "info"
        base.triageReasoning = `AI-identified false positive: ${ai.triageReasoning}`
      }
    })
  } catch (err) {
    console.error("[webhook] AI triage failed — falling back to raw tool severities:", err)
  }

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

  // ── 11. Per-tool accumulation only — update the running count, keep "running".
  // The scan is finalised exclusively by the notify-complete "final" event (6a),
  // so it can never complete before GitHub Actions finishes all jobs.
  try {
    const [countResult] = await db
      .select({ count: count(vulnerabilities.id) })
      .from(vulnerabilities)
      .where(eq(vulnerabilities.scanId, scanId))
    const totalCount = Number(countResult?.count ?? triaged.length)

    await db
      .update(scans)
      .set({ vulnerabilitiesCount: totalCount })
      .where(and(eq(scans.id, scanId), ne(scans.status, "completed")))
  } catch (err) {
    console.error("[webhook] Per-tool count update failed (non-fatal):", err)
  }

  revalidatePath("/dashboard")

  return NextResponse.json({
    received: true,
    scanId,
    findings: triaged.length,
    perTool: true,
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