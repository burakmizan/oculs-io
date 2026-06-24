/**
 * POST /api/upload/zip
 *
 * Accepts a ZIP archive of source code, runs Gemini SAST analysis on the
 * code files inside, then creates a project + scan + vulnerability rows in
 * Aurora — all in one serverless function invocation.
 *
 * FormData fields: name (string), description? (string), targetUrl? (string),
 *                  serverIp? (string), zipFile (File)
 */

import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { projects, organizations, users, scans, vulnerabilities } from "@/lib/db/schema"
import { eq, count } from "drizzle-orm"
import { unzipSync } from "fflate"
import type { SeverityLevel, ExploitabilityLevel } from "@/types"

export const runtime = "nodejs"
export const maxDuration = 60

// ─── Constants ──────────────────────────────────────────────────────────────

const CODE_EXTS = new Set([
  "js", "ts", "py", "go", "java", "rb", "php", "cs", "cpp", "c",
  "rs", "kt", "swift", "vue", "jsx", "tsx",
])

const SKIP_DIRS = /\/(node_modules|\.git|\.next|dist|build|vendor|__pycache__|\.yarn|coverage)\//

const MAX_FILES     = 25
const MAX_LINES     = 150
const MAX_FILE_BYTES = 100 * 1024   // 100 KB per file before truncation
const MAX_ZIP_BYTES  = 50 * 1024 * 1024  // 50 MB total

const SEVERITY_WEIGHTS: Record<SeverityLevel, number> = {
  critical: 40, high: 20, medium: 8, low: 2, info: 0,
}

const VALID_SEV  = new Set<SeverityLevel>(["critical", "high", "medium", "low", "info"])
const VALID_EXPL = new Set<ExploitabilityLevel>(["high", "medium", "low"])

// ─── Types ───────────────────────────────────────────────────────────────────

interface SastFinding {
  filePath: string
  lineStart: number
  lineEnd: number
  ruleId: string
  title: string
  description: string
  severity: string
  triageSeverity: string
  triageReasoning: string
  cweId: string
  owaspCategory: string
  cvssScore: string
  remediation: string
  exploitability: string
  codeSnippet: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFingerprint(ruleId: string, filePath: string, lineStart: number): string {
  const raw = `semgrep::${ruleId}::${filePath}::${lineStart}`
  let h = 5381
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) + h) ^ raw.charCodeAt(i)
    h = h >>> 0
  }
  return h.toString(16).padStart(8, "0")
}

// ─── Gemini SAST call ─────────────────────────────────────────────────────────

async function callGeminiSast(
  files: { path: string; content: string }[],
): Promise<SastFinding[]> {
  const apiKey = process.env.GEMINI_API_KEY
  const model  = process.env.GEMINI_MODEL ?? "gemini-2.5-flash"
  if (!apiKey || files.length === 0) return []

  const filesSection = files
    .map((f, i) => `[FILE ${i + 1}: ${f.path}]\n${f.content}`)
    .join("\n\n---\n\n")

  const prompt = `You are a senior application security engineer performing SAST (Static Application Security Testing) on uploaded source code files.

Analyze each file carefully for REAL security vulnerabilities. Do NOT report style issues or best-practice suggestions — only clear, demonstrable security vulnerabilities (injection, XSS, auth bypass, hardcoded secrets, SSRF, path traversal, insecure deserialization, broken crypto, etc.).

For each vulnerability found, return a JSON object with these exact fields:
- filePath: the file path as given in the [FILE N: ...] header (string)
- lineStart: line number where the vulnerability starts, 1-indexed (integer)
- lineEnd: line number where it ends (integer)
- ruleId: camelCase rule identifier (e.g. "sqlInjection", "xssReflected", "hardcodedSecret")
- title: concise vulnerability title (e.g. "SQL Injection via string concatenation")
- description: 2-3 sentence description of the specific vulnerability
- severity: one of "critical" | "high" | "medium" | "low" | "info"
- triageSeverity: same value as severity
- triageReasoning: 1-2 sentence explanation of why this severity was assigned
- cweId: CWE identifier string (e.g. "CWE-89") or empty string
- owaspCategory: OWASP Top 10 2021 category (e.g. "A03:2021 – Injection") or empty string
- cvssScore: estimated CVSS 3.1 base score as string (e.g. "8.1") or empty string
- remediation: specific actionable remediation steps in 2-4 sentences
- exploitability: one of "high" | "medium" | "low"
- codeSnippet: the specific 3-5 lines of vulnerable code

Return a JSON array of vulnerability objects. Return [] if no real vulnerabilities are found.
Do NOT include any text outside the JSON array.

SOURCE FILES:
${filesSection}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    },
  )

  if (!res.ok) {
    console.error("[zip-sast] Gemini API error:", res.status, await res.text())
    return []
  }

  const data = await res.json()
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
  if (!text) return []

  try {
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim()
    const parsed: unknown = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) return []
    return parsed as SastFinding[]
  } catch (err) {
    console.error("[zip-sast] Gemini JSON parse error:", err)
    return []
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 })
  }

  const name        = String(formData.get("name")        ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  const targetUrl   = String(formData.get("targetUrl")   ?? "").trim()
  const serverIp    = String(formData.get("serverIp")    ?? "").trim()
  const zipEntry    = formData.get("zipFile")

  if (!name) {
    return NextResponse.json({ error: "Project name is required." }, { status: 400 })
  }
  if (!zipEntry || typeof zipEntry === "string") {
    return NextResponse.json({ error: "ZIP file is required." }, { status: 400 })
  }

  // ── Plan / project limit ───────────────────────────────────────────────────
  try {
    const [userRecord] = await db
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    if (!userRecord || userRecord.plan === "starter") {
      const [projectCount] = await db
        .select({ c: count() })
        .from(projects)
        .where(eq(projects.userId, userId))
      if (projectCount.c >= 1) {
        return NextResponse.json({ error: "UPGRADE_REQUIRED_PROJECTS" }, { status: 403 })
      }
    }
  } catch {
    // Non-fatal: continue
  }

  // ── Read & validate ZIP ────────────────────────────────────────────────────
  let zipBuffer: Buffer
  try {
    const ab = await (zipEntry as File).arrayBuffer()
    if (ab.byteLength > MAX_ZIP_BYTES) {
      return NextResponse.json({ error: "ZIP file exceeds the 50 MB limit." }, { status: 400 })
    }
    zipBuffer = Buffer.from(ab)
  } catch {
    return NextResponse.json({ error: "Failed to read ZIP file." }, { status: 400 })
  }

  let unzipped: ReturnType<typeof unzipSync>
  try {
    unzipped = unzipSync(zipBuffer)
  } catch {
    return NextResponse.json({ error: "Invalid or corrupted ZIP file." }, { status: 400 })
  }

  // ── Extract code files ────────────────────────────────────────────────────
  const codeFiles: { path: string; content: string }[] = []
  for (const [rawPath, data] of Object.entries(unzipped)) {
    if (codeFiles.length >= MAX_FILES) break
    const filePath = rawPath.replace(/\\/g, "/")
    if (filePath.endsWith("/")) continue            // directory entry
    if (SKIP_DIRS.test("/" + filePath)) continue   // vendor/generated paths
    if (data.byteLength > MAX_FILE_BYTES) continue // skip very large files

    const ext = filePath.split(".").pop()?.toLowerCase() ?? ""
    if (!CODE_EXTS.has(ext)) continue

    const text  = new TextDecoder("utf-8", { fatal: false }).decode(data)
    const lines = text.split("\n").slice(0, MAX_LINES)
    codeFiles.push({ path: filePath, content: lines.join("\n") })
  }

  // ── Resolve / create org ──────────────────────────────────────────────────
  const [existingOrg] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.ownerId, userId))
    .limit(1)

  let orgId = existingOrg?.id
  if (!orgId) {
    const [newOrg] = await db
      .insert(organizations)
      .values({
        ownerId: userId,
        name:    session.user.name ?? "My Workspace",
        slug:    (session.user.login ?? session.user.email ?? "workspace")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .slice(0, 60),
      })
      .onConflictDoUpdate({
        target: [organizations.ownerId, organizations.slug],
        set:    { name: session.user.name ?? "My Workspace" },
      })
      .returning({ id: organizations.id })
    orgId = newOrg!.id
  }

  // ── Create project ────────────────────────────────────────────────────────
  const nameSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 55)
  const repoFullName      = `zip/${nameSlug}`
  const resolvedTargetUrl = targetUrl || (serverIp ? `http://${serverIp}` : null)

  let projectId: string
  try {
    const [project] = await db
      .insert(projects)
      .values({
        userId,
        organizationId: orgId,
        name,
        description: description || null,
        repoFullName,
        repoUrl:     null,
        targetUrl:   resolvedTargetUrl || null,
      })
      .onConflictDoUpdate({
        target: [projects.userId, projects.repoFullName],
        set: {
          name,
          description: description || null,
          targetUrl:   resolvedTargetUrl || null,
          updatedAt:   new Date(),
        },
      })
      .returning({ id: projects.id })
    projectId = project!.id
  } catch {
    return NextResponse.json(
      { error: "Could not save project. Check your connection and try again." },
      { status: 500 },
    )
  }

  // ── Create scan (running) ─────────────────────────────────────────────────
  let scanId: string
  try {
    const [scan] = await db
      .insert(scans)
      .values({
        projectId,
        userId,
        branch:    "main",
        tools:     ["semgrep"],
        status:    "running",
        trigger:   "manual",
        startedAt: new Date(),
      })
      .returning({ id: scans.id })
    scanId = scan!.id
  } catch {
    return NextResponse.json({ error: "Could not create scan. Try again." }, { status: 500 })
  }

  // ── Gemini SAST ───────────────────────────────────────────────────────────
  let sastFindings: SastFinding[] = []
  if (codeFiles.length > 0) {
    try {
      sastFindings = await callGeminiSast(codeFiles)
    } catch (err) {
      console.error("[zip-sast] Gemini call failed (non-fatal):", err)
    }
  }

  // Validate and sanitise findings
  const cleanFindings = sastFindings.filter(
    (f) =>
      f.title &&
      f.filePath &&
      VALID_SEV.has(f.severity as SeverityLevel),
  )

  // ── Bulk-insert vulnerabilities ───────────────────────────────────────────
  if (cleanFindings.length > 0) {
    const rows = cleanFindings.map((f) => {
      const sev      = VALID_SEV.has(f.triageSeverity as SeverityLevel)
        ? (f.triageSeverity as SeverityLevel)
        : (f.severity as SeverityLevel)
      const expl     = VALID_EXPL.has(f.exploitability as ExploitabilityLevel)
        ? (f.exploitability as ExploitabilityLevel)
        : null
      const lineStart = typeof f.lineStart === "number" ? f.lineStart : null
      const lineEnd   = typeof f.lineEnd   === "number" ? f.lineEnd   : null

      return {
        scanId,
        projectId,
        userId,
        tool:            "semgrep" as const,
        category:        "sast"   as const,
        ruleId:          f.ruleId   || null,
        title:           f.title,
        description:     f.description     || null,
        severity:        sev,
        confidence:      null,
        exploitability:  expl,
        cweId:           f.cweId           || null,
        owaspCategory:   f.owaspCategory   || null,
        cvssScore:       f.cvssScore       || null,
        filePath:        f.filePath        || null,
        lineStart,
        lineEnd,
        targetUrl:       null,
        codeSnippet:     f.codeSnippet     || null,
        remediation:     f.remediation     || null,
        aiFixPatch:      null,
        aiFixExplanation: null,
        aiFixModel:      null,
        fixStatus:       "none" as const,
        status:          "open"  as const,
        references:      null,
        fingerprint:     makeFingerprint(
          f.ruleId || f.title.slice(0, 20),
          f.filePath,
          lineStart ?? 0,
        ),
        raw: f as unknown as Record<string, unknown>,
      }
    })

    try {
      const BATCH = 50
      for (let i = 0; i < rows.length; i += BATCH) {
        await db.insert(vulnerabilities).values(rows.slice(i, i + BATCH))
      }
    } catch (err) {
      console.error("[zip-sast] Vulnerability insert failed:", err)
    }
  }

  // ── Finalise scan ─────────────────────────────────────────────────────────
  const summary: Record<SeverityLevel, number> = {
    critical: 0, high: 0, medium: 0, low: 0, info: 0,
  }
  for (const f of cleanFindings) {
    const sev = VALID_SEV.has(f.triageSeverity as SeverityLevel)
      ? (f.triageSeverity as SeverityLevel)
      : (f.severity as SeverityLevel)
    summary[sev]++
  }
  const riskScore = Math.min(
    100,
    Object.entries(summary).reduce(
      (acc, [sev, cnt]) => acc + SEVERITY_WEIGHTS[sev as SeverityLevel] * cnt,
      0,
    ),
  )

  try {
    await db
      .update(scans)
      .set({
        status:               "completed",
        completedAt:          new Date(),
        vulnerabilitiesCount: cleanFindings.length,
        summary: { ...summary, riskScore } as {
          critical?: number; high?: number; medium?: number; low?: number; info?: number; riskScore?: number
        },
      })
      .where(eq(scans.id, scanId))
  } catch (err) {
    console.error("[zip-sast] Scan finalise failed:", err)
  }

  revalidatePath("/dashboard/projects")
  revalidatePath("/dashboard/scans")
  revalidatePath("/dashboard")

  return NextResponse.json({ ok: true })
}
