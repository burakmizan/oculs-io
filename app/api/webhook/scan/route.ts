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
import { eq, count, and, inArray, ne, desc, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { scans, vulnerabilities, accounts, projects } from "@/lib/db/schema"
import { TOOLS_BY_ID } from "@/lib/tools"
import { sendScanAlert } from "@/lib/notify"
import type { WebhookPayload, WebhookFinding, SeverityLevel, ExploitabilityLevel, TechStack } from "@/types"
import { analyzeFindings, correlateFindings } from "@/lib/ai"

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

  // ── 5b. Handle tool.completed — lightweight per-tool progress signal ────────
  if (event === "tool.completed") {
    const toolName = payload.tool ?? findings[0]?.tool ?? "unknown"
    try {
      const [existing] = await db.select({ summary: scans.summary }).from(scans).where(eq(scans.id, scanId)).limit(1)
      const existingTP = (existing?.summary as { toolProgress?: unknown[] } | null)?.toolProgress ?? []
      const newEntry = { tool: toolName, findingCount: findings.length, completedAt: new Date().toISOString() }
      await db
        .update(scans)
        .set({ summary: { ...(existing?.summary ?? {}), toolProgress: [...existingTP, newEntry] } as any })
        .where(and(eq(scans.id, scanId), ne(scans.status, "completed")))
      revalidatePath("/dashboard")
    } catch (err) {
      console.error("[webhook] tool.completed update failed (non-fatal):", err)
    }
    return NextResponse.json({ received: true, event, tool: toolName })
  }

  // ── 6. Handle scan.completed ─────────────────────────────────────────────
  if (event !== "scan.completed") {
    return NextResponse.json({ error: `Unknown event: ${event}` }, { status: 400 })
  }

  // The workflow fires one scan.completed PER TOOL (each carrying that tool's
  // findings, often empty), and ONE final event from notify-complete carrying
  // {"final": true}. Only the final event may mark the scan "completed" — so the
  // dashboard can never finish before GitHub Actions finishes every job.
  const isFinal = payload.final === true

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
        .select({ projectId: scans.projectId, userId: scans.userId, summary: scans.summary, techStack: scans.techStack })
        .from(scans)
        .where(eq(scans.id, scanId))
        .limit(1)

      // Preserve toolProgress accumulated during per-tool events
      const toolProgress = (srow?.summary as { toolProgress?: unknown } | null | undefined)?.toolProgress ?? []

      await db
        .update(scans)
        .set({
          status: "completed",
          completedAt: new Date(),
          commitSha,
          branch,
          vulnerabilitiesCount: totalCount,
          summary: { ...summary, riskScore, toolProgress } as any,
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

      // PR auto-comment (once, alongside commit status)
      if (srow && commitSha) {
        try {
          await postPRComment({ repository, commitSha, scanId, userId: srow.userId, summary })
        } catch (err) {
          console.error("[webhook] PR comment failed (non-fatal):", err)
        }
      }

      // ── Cross-tool correlation (best-effort, non-blocking) ─────────────────
      // Now that every tool's findings are in the DB, ask Gemini in ONE request
      // which of them combine into an attack chain. Members get a shared
      // correlationGroup id and are elevated to the chain's highest severity.
      // Any failure here leaves all findings exactly as they were.
      try {
        const openFindings = await db
          .select({
            id: vulnerabilities.id,
            title: vulnerabilities.title,
            severity: vulnerabilities.severity,
            tool: vulnerabilities.tool,
            filePath: vulnerabilities.filePath,
            cweId: vulnerabilities.cweId,
          })
          .from(vulnerabilities)
          .where(and(eq(vulnerabilities.scanId, scanId), inArray(vulnerabilities.status, ["open", "in_review"])))
          .limit(60)

        if (openFindings.length >= 2) {
          const groups = await correlateFindings(
            openFindings.map((o) => ({
              id: o.id,
              title: o.title,
              severity: o.severity as SeverityLevel,
              tool: o.tool as string,
              filePath: o.filePath,
              cweId: o.cweId,
            })),
            srow?.techStack ?? null,
          )

          const byId = new Map(openFindings.map((o) => [o.id, o.severity as SeverityLevel]))
          const SEV_RANK: SeverityLevel[] = ["critical", "high", "medium", "low", "info"]
          let applied = false

          for (const g of groups) {
            const members = g.memberIds.filter((id) => byId.has(id))
            if (members.length < 2) continue
            // Elevate the whole chain to its highest member severity (lowest rank index).
            let maxSev: SeverityLevel = "info"
            for (const id of members) {
              const sev = byId.get(id)!
              if (SEV_RANK.indexOf(sev) < SEV_RANK.indexOf(maxSev)) maxSev = sev
            }
            const groupId = crypto.randomUUID()
            const label = (g.label || "Correlated attack chain").slice(0, 120)
            await db
              .update(vulnerabilities)
              .set({ correlationGroup: groupId, correlationLabel: label, severity: maxSev })
              .where(and(eq(vulnerabilities.scanId, scanId), inArray(vulnerabilities.id, members)))
            applied = true
          }

          // Severity elevation changes the rollup — recompute the cached summary.
          if (applied) {
            const rows2 = await db
              .select({ severity: vulnerabilities.severity })
              .from(vulnerabilities)
              .where(eq(vulnerabilities.scanId, scanId))
            const sum2: Record<SeverityLevel, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
            for (const r of rows2) sum2[r.severity as SeverityLevel]++
            const risk2 = Math.min(
              100,
              Object.entries(sum2).reduce(
                (acc, [sev, cnt]) => acc + SEVERITY_WEIGHTS[sev as SeverityLevel] * cnt,
                0,
              ),
            )
            await db
              .update(scans)
              .set({
                summary: {
                  ...sum2,
                  riskScore: risk2,
                  toolProgress: toolProgress as { tool: string; findingCount: number; completedAt: string }[],
                },
              })
              .where(eq(scans.id, scanId))
          }
        }
      } catch (err) {
        console.error("[webhook] Correlation step failed (non-fatal):", err)
      }

      revalidatePath("/dashboard")
    } catch (err) {
      console.error("[webhook] Finalise failed (non-fatal):", err)
    }
    return NextResponse.json({ received: true, event, finalized: true })
  }

  // ── 6b. Per-tool event with NO findings → persist toolProgress, keep "running".
  if (findings.length === 0) {
    try {
      const toolName = payload.tool ?? "unknown"
      const [existing6b] = await db.select({ summary: scans.summary }).from(scans).where(eq(scans.id, scanId)).limit(1)
      const existingTP = (existing6b?.summary as { toolProgress?: unknown[] } | null)?.toolProgress ?? []
      const newEntry = { tool: toolName, findingCount: 0, completedAt: new Date().toISOString() }
      await db
        .update(scans)
        .set({
          status: "running",
          startedAt: new Date(),
          summary: { ...((existing6b?.summary ?? {}) as object), toolProgress: [...existingTP, newEntry] } as any,
        })
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
  let scanRow: { projectId: string; userId: string; techStack: TechStack | null } | undefined
  try {
    const [row] = await db
      .select({ projectId: scans.projectId, userId: scans.userId, techStack: scans.techStack })
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

  const { projectId, userId, techStack } = scanRow

  // Fetch the customer's GitHub token so analyzeFindings can read actual file
  // content for accurate false positive detection. Non-fatal if unavailable.
  let githubToken: string | null = null
  try {
    const [acct] = await db
      .select({ access_token: accounts.access_token })
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .limit(1)
    githubToken = acct?.access_token ?? null
  } catch {
    // Non-fatal — AI will use tool-provided snippet only
  }

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

    // Tool family drives WHICH suppressions apply: a Dockerfile secret hit is
    // noise, but a Dockerfile SAST bug may be real — so we scope by category.
    const category = TOOLS_BY_ID[f.tool]?.category ?? "sast"
    const isSecretTool = category === "secrets"            // gitleaks, detect_secrets
    const isSastTool = category === "sast"                 // semgrep, bearer, bandit, gosec, codeql…

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

    // ── CI/CD config files: secret patterns here are wiring, not real leaks ───
    // .github/ workflows, Jenkinsfile, Dockerfile, .gitlab-ci.yml reference
    // ${{ secrets.* }} / $ENV placeholders that secret scanners misread as
    // hardcoded credentials. Scoped to secret tools — a SAST bug in a Dockerfile
    // is still a real finding and must NOT be suppressed.
    const ciCdConfigPaths = [
      /(^|\/)\.github\//i,
      /(^|\/)jenkinsfile$/i,
      /(^|\/)dockerfile(\.[\w.-]+)?$/i,
      /(^|\/)\.gitlab-ci\.yml$/i,
      /(^|\/)\.circleci\//i,
      /(^|\/)azure-pipelines\.yml$/i,
    ]
    if (isSecretTool && ciCdConfigPaths.some(re => re.test(filePath))) return true

    // ── Generated ORM / migration output: machine-written, not hand-authored ──
    // Drizzle/Prisma migrations and generated clients are DDL + scaffolding that
    // trips SAST and secret rules but is never developer-authored app logic.
    const generatedOrmPaths = [
      /(^|\/)migrations?\//i,          // drizzle/knex/typeorm/rails migration dirs
      /(^|\/)prisma\/migrations\//i,
      /(^|\/)\.drizzle\//i,
      /(^|\/)drizzle\/meta\//i,
      /(^|\/)generated\//i,            // prisma client + other codegen output
      /schema\.prisma$/i,
      /\d{4,}_[\w-]+\.sql$/i,          // timestamped migration SQL files (0008_x.sql)
    ]
    if ((isSastTool || isSecretTool) && generatedOrmPaths.some(re => re.test(filePath))) return true

    // ── Documentation: fenced code blocks are EXAMPLES, not running code ──────
    // docs/, *.md, *.mdx hold illustrative snippets. Suppress code-analysis hits
    // only — a genuinely leaked credential in a README IS real, so secret-scanner
    // findings are deliberately left for the AI/other rules to judge.
    const docPaths = [
      /(^|\/)docs?\//i,
      /\.mdx?$/i,
      /(^|\/)(readme|changelog|contributing)\.\w+$/i,
    ]
    if (isSastTool && docPaths.some(re => re.test(filePath))) return true

    // ── Test fixtures: intentionally weak/insecure sample inputs ──────────────
    // fixtures/, __fixtures__/, testdata/ hold deliberately vulnerable data used
    // to exercise tests — flagging it as a production vuln is pure noise.
    const fixturePaths = [
      /(^|\/)fixtures?\//i,
      /(^|\/)__fixtures__\//i,
      /(^|\/)testdata\//i,
      /(^|\/)__mocks__\//i,
    ]
    if (isSastTool && fixturePaths.some(re => re.test(filePath))) return true

    // ── Gitleaks: process.env.* is an env-var READ, never a hardcoded secret ──
    if (f.tool === "gitleaks" && /process\.env\./i.test(codeSnippet)) return true

    // ── Semgrep: TODO/FIXME lines are prose comments, not an executable sink ───
    // Injection rules occasionally match example/pseudo-code parked in a comment.
    if (
      f.tool === "semgrep" &&
      (ruleId.includes("injection") || title.includes("injection")) &&
      /\b(todo|fixme)\s*:/i.test(codeSnippet)
    ) {
      return true
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
    exploitability: null as ExploitabilityLevel | null,
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
    const aiResults = await analyzeFindings(filteredFindings, repository, githubToken ?? undefined, techStack)
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
      // AI exploitability score (already sanitised to high/medium/low or null).
      if (ai.exploitability) base.exploitability = ai.exploitability
      // AI-identified false positives: downgrade severity, record reason, and
      // flag for insertion as false_positive status so they appear in Muted tab.
      if ((ai as { isFalsePositive?: boolean }).isFalsePositive === true) {
        base.triageSeverity = "info"
        base.triageReasoning = `AI-identified false positive: ${ai.triageReasoning}`
        ;(base as Record<string, unknown>).__aiMuted = true
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
    // Preserve the original status so UI labels (AI vs user) remain accurate.
    const mutedFingerprints = new Map<string, "false_positive" | "dismissed">()
    try {
      const prior = await db
        .select({ fingerprint: vulnerabilities.fingerprint, status: vulnerabilities.status })
        .from(vulnerabilities)
        .where(
          and(
            eq(vulnerabilities.userId, userId),
            inArray(vulnerabilities.status, ["false_positive", "dismissed"]),
          ),
        )
      for (const p of prior) {
        if (p.fingerprint && !mutedFingerprints.has(p.fingerprint)) {
          const s = p.status as string
          if (s === "false_positive" || s === "dismissed") {
            mutedFingerprints.set(p.fingerprint, s as "false_positive" | "dismissed")
          }
        }
      }
    } catch (err) {
      console.error("[webhook] Mute lookup failed (non-fatal):", err)
    }

    const rows = triaged.map((f) => {
      // Resolve tool category from the catalog; default to "sast" if unknown
      const toolSpec = TOOLS_BY_ID[f.tool]
      const category = toolSpec?.category ?? "sast"
      const carriedStatus = mutedFingerprints.get(f.fingerprint)
      const isAiMuted = (f as Record<string, unknown>).__aiMuted === true

      const status: "false_positive" | "dismissed" | "open" =
        carriedStatus ?? (isAiMuted ? "false_positive" : "open")

      return {
        scanId,
        projectId,
        userId,
        tool: f.tool,
        category,
        ruleId: f.ruleId ?? null,
        title: f.title,
        description: f.description ?? null,
        severity: f.triageSeverity,
        confidence: f.confidence ?? null,
        exploitability: f.exploitability ?? null,
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
        status,
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

  // ── 11. Per-tool accumulation — update count + toolProgress, keep "running".
  // The scan is finalised exclusively by the notify-complete "final" event (6a).
  try {
    const [[countResult], [scanRow2]] = await Promise.all([
      db.select({ total: count(vulnerabilities.id) }).from(vulnerabilities).where(eq(vulnerabilities.scanId, scanId)),
      db.select({ summary: scans.summary }).from(scans).where(eq(scans.id, scanId)).limit(1),
    ])
    const totalCount = Number(countResult?.total ?? triaged.length)
    const toolName = payload.tool ?? findings[0]?.tool ?? "unknown"
    const existingTP = (scanRow2?.summary as { toolProgress?: unknown[] } | null)?.toolProgress ?? []
    const newEntry = { tool: toolName, findingCount: triaged.length, completedAt: new Date().toISOString() }

    await db
      .update(scans)
      .set({
        vulnerabilitiesCount: totalCount,
        summary: { ...((scanRow2?.summary ?? {}) as object), toolProgress: [...existingTP, newEntry] } as any,
      })
      .where(and(eq(scans.id, scanId), ne(scans.status, "completed")))
  } catch (err) {
    console.error("[webhook] Per-tool count/progress update failed (non-fatal):", err)
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

// ---------------------------------------------------------------------------
// GitHub PR auto-comment — posts/updates a comment on the related PR (feature 7)
// ---------------------------------------------------------------------------

const PR_COMMENT_MARKER = "<!-- oculs-scan-result -->"
const SEV_ORDER_PR: SeverityLevel[] = ["critical", "high", "medium", "low", "info"]

async function postPRComment(input: {
  repository: string
  commitSha: string
  scanId: string
  userId: string
  summary: Record<SeverityLevel, number>
}): Promise<void> {
  const [owner, repo] = input.repository.split("/")
  if (!owner || !repo) return

  let token: string | null = null
  try {
    const [acct] = await db
      .select({ access_token: accounts.access_token })
      .from(accounts)
      .where(eq(accounts.userId, input.userId))
      .limit(1)
    token = acct?.access_token ?? process.env.GITHUB_TOKEN ?? null
  } catch { return }
  if (!token) return

  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  }

  // Find PRs that contain this commit
  let pullNumbers: number[] = []
  try {
    const prRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${input.commitSha}/pulls`,
      { headers: ghHeaders },
    )
    if (prRes.ok) {
      const prs = await prRes.json() as { number: number }[]
      pullNumbers = prs.map(p => p.number)
    }
  } catch { return }

  if (pullNumbers.length === 0) return

  // Fetch top findings for the comment table
  const topFindings = await db
    .select({
      title: vulnerabilities.title,
      severity: vulnerabilities.severity,
      filePath: vulnerabilities.filePath,
      lineStart: vulnerabilities.lineStart,
    })
    .from(vulnerabilities)
    .where(and(eq(vulnerabilities.scanId, input.scanId), inArray(vulnerabilities.status, ["open", "in_review"])))
    .orderBy(
      sql`CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END`,
      desc(vulnerabilities.title),
    )
    .limit(8)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://oculs-io.vercel.app"
  const breakdown = SEV_ORDER_PR.filter(s => (input.summary[s] ?? 0) > 0)
    .map(s => `**${input.summary[s]} ${s}**`).join(", ")
  const total = SEV_ORDER_PR.reduce((n, s) => n + (input.summary[s] ?? 0), 0)

  let tableRows = ""
  if (topFindings.length > 0) {
    tableRows = "\n| Title | Severity | Location |\n|---|---|---|\n" +
      topFindings.map(f => {
        const loc = f.filePath ? `\`${f.filePath}${f.lineStart ? `:${f.lineStart}` : ""}\`` : "—"
        return `| ${f.title} | ${f.severity} | ${loc} |`
      }).join("\n")
  }

  const body =
    `${PR_COMMENT_MARKER}\n` +
    `## 🛡️ Oculs Security Scan\n\n` +
    `**${total} finding${total === 1 ? "" : "s"}** · ${breakdown || "none"}\n` +
    tableRows +
    `\n\n[View full report →](${appUrl}/dashboard/report/${input.scanId})`

  for (const prNumber of pullNumbers) {
    try {
      // Check for an existing Oculs comment on this PR
      const listRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments?per_page=50`,
        { headers: ghHeaders },
      )
      let existingCommentId: number | null = null
      if (listRes.ok) {
        const comments = await listRes.json() as { id: number; body: string }[]
        existingCommentId = comments.find(c => c.body.includes(PR_COMMENT_MARKER))?.id ?? null
      }

      if (existingCommentId) {
        await fetch(
          `https://api.github.com/repos/${owner}/${repo}/issues/comments/${existingCommentId}`,
          { method: "PATCH", headers: ghHeaders, body: JSON.stringify({ body }) },
        )
      } else {
        await fetch(
          `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
          { method: "POST", headers: ghHeaders, body: JSON.stringify({ body }) },
        )
      }
    } catch { /* non-fatal per PR */ }
  }
}