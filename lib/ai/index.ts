/**
 * lib/ai/index.ts
 * Gemini AI agent — vulnerability triage, auto-fix patch generation, report.
 * Uses GEMINI_API_KEY and GEMINI_MODEL from environment variables.
 */

import type { WebhookFinding, SeverityLevel, ExploitabilityLevel, TechStack } from "@/types"

export type { TechStack } from "@/types"

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash"
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TriagedFinding extends WebhookFinding {
  /** Gemini-assigned severity (may override tool-reported severity). */
  triageSeverity: SeverityLevel
  /** Human-readable explanation of why this severity was assigned. */
  triageReasoning: string
  /** CWE identifier e.g. "CWE-89". */
  cweId: string
  /** OWASP Top 10 category e.g. "A03:2021 – Injection". */
  owaspCategory: string
  /** 0.0–10.0 CVSS-like score estimated by AI. */
  cvssScore: string
  /** Plain-English remediation guidance. */
  remediation: string
  /**
   * AI-assessed real-world exploitability, derived from three reachability
   * questions (user-controlled input? unauthenticated? network-reachable?).
   * Null when the AI could not assess it (e.g. AI triage failed).
   */
  exploitability: ExploitabilityLevel | null
  /** True when AI determined this is a false positive (e.g. template file, placeholder value). */
  isFalsePositive?: boolean
  /** Stable dedup hash: tool + ruleId + filePath + lineStart. */
  fingerprint: string
}

/** A set of findings the AI judged to combine into a single attack chain. */
export interface CorrelationGroup {
  /** vulnerability ids (DB uuids) that form this chain — always ≥ 2. */
  memberIds: string[]
  /** Short human label, e.g. "SSRF → cloud metadata theft". */
  label: string
  /** Severity the whole chain should be elevated to. */
  severity: SeverityLevel
  /** 1-2 sentence explanation of why these combine. */
  rationale: string
}

export interface AutoFixResult {
  /** unified diff patch ready to apply with `git apply`. */
  patch: string
  /** Explanation of what the fix does and why. */
  explanation: string
  /** Gemini model that produced this fix. */
  model: string
}

export interface ScanReport {
  /** Markdown-formatted security summary. */
  markdown: string
  /** Overall risk score 0–100. */
  riskScore: number
  /** Counts per severity level. */
  summary: Record<SeverityLevel, number>
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper — raw Gemini call
// ─────────────────────────────────────────────────────────────────────────────

async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.")
  }

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,        // low temp — we want deterministic security analysis
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""

  if (!text) throw new Error("Gemini returned an empty response.")

  // Strip markdown code fences if present (```json ... ```)
  return text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim()
}

// ─────────────────────────────────────────────────────────────────────────────
// Fingerprint helper — stable dedup hash (no crypto dependency)
// ─────────────────────────────────────────────────────────────────────────────

function makeFingerprint(f: WebhookFinding): string {
  const raw = `${f.tool}::${f.ruleId ?? ""}::${f.filePath ?? f.targetUrl ?? ""}::${f.lineStart ?? 0}`
  // Simple djb2 hash — good enough for dedup, no Node crypto needed at edge
  let hash = 5381
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash) ^ raw.charCodeAt(i)
    hash = hash >>> 0 // keep unsigned 32-bit
  }
  return hash.toString(16).padStart(8, "0")
}

// ─────────────────────────────────────────────────────────────────────────────
// GitHub source fetcher — pulls real code context for AI triage
//
// We give Gemini far more than a 60-line window: the *entire enclosing
// function*, the other files that call/import it, and any nearby test file.
// All of it is best-effort — every fetch is wrapped so a failure silently
// degrades to the basic 60-line slice (or the tool's own snippet), preserving
// the original behaviour.
// ─────────────────────────────────────────────────────────────────────────────

/** Per-analyzeFindings caches so the same file/dir/search isn't fetched twice. */
interface FetchCaches {
  file: Map<string, string | null>
  dir: Map<string, { name: string; path: string }[] | null>
  search: Map<string, string | null>
}

/** A best-effort budget so a noisy scan can't fan out into hundreds of API calls. */
interface FetchBudget {
  search: number
  dir: number
}

function makeCaches(): FetchCaches {
  return { file: new Map(), dir: new Map(), search: new Map() }
}

const GH_API_VERSION = "2022-11-28"

/**
 * Fetches the full raw text of a file from the customer's GitHub repository.
 * Cached per (repo, path). Returns null on any failure (private repo without
 * token, binary file, network error, …) — callers must handle null.
 */
async function ghFetchRaw(
  repository: string,
  filePath: string,
  token: string | null,
  cache: Map<string, string | null>,
): Promise<string | null> {
  if (!filePath || !repository) return null
  const key = `${repository}::${filePath}`
  if (cache.has(key)) return cache.get(key) ?? null

  let raw: string | null = null
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.raw+json",
      "X-GitHub-Api-Version": GH_API_VERSION,
    }
    if (token) headers["Authorization"] = `Bearer ${token}`

    const url = `https://api.github.com/repos/${repository}/contents/${encodeURIComponent(filePath)}`
    const res = await fetch(url, { headers })
    if (res.ok) {
      const contentType = res.headers.get("content-type") ?? ""
      if (contentType.includes("application/json")) {
        const json = (await res.json()) as { content?: string; encoding?: string }
        if (json.content && json.encoding === "base64") {
          raw = Buffer.from(json.content.replace(/\n/g, ""), "base64").toString("utf-8")
        }
      } else {
        raw = await res.text()
      }
    }
  } catch {
    raw = null
  }
  cache.set(key, raw)
  return raw
}

/** The original behaviour: a 60-line window centered on the finding. */
function sliceAround(lines: string[], lineStart: number | null): string {
  const total = lines.length
  if (!lineStart || lineStart < 1) {
    return lines.slice(0, 40).map((l, i) => `${i + 1}: ${l}`).join("\n")
  }
  const from = Math.max(0, lineStart - 30)
  const to = Math.min(total, lineStart + 30)
  return lines
    .slice(from, to)
    .map((l, i) => `${from + i + 1}${from + i + 1 === lineStart ? " ◄" : "  "}: ${l}`)
    .join("\n")
}

/** Heuristic: does this line (with the one above it) open a function/method? */
function looksLikeFunction(line: string, prevLine: string): boolean {
  const s = `${prevLine}\n${line}`
  return (
    /\bfunction\b/.test(s) ||                                              // function foo() / function()
    /=>\s*\{?\s*$/.test(line) ||                                           // arrow fn body opening
    /\bfunc\s+[\w(]/.test(s) ||                                            // Go
    /\b(def|fn)\s+\w+/.test(s) ||                                          // misc
    /\b(public|private|protected|internal|static|async|export|override|suspend)\b[^;]*\([^;]*\)\s*\{?\s*$/.test(s) || // typed methods
    /^\s*[\w$]+\s*\([^;)]*\)\s*\{\s*$/.test(line) ||                       // bareMethod(args) {
    /\b[\w$]+\s*=\s*(async\s*)?function\b/.test(s) ||                      // const x = function
    /\b[\w$]+\s*[:=]\s*(async\s*)?\([^)]*\)\s*(:[^={]+)?=>/.test(s)        // const x = (..) =>
  )
}

/** Pulls the function/method identifier out of a signature line. */
function extractFunctionName(header: string): string | null {
  let m: RegExpMatchArray | null
  if ((m = header.match(/\bfunction\s+([\w$]+)/))) return m[1]
  if ((m = header.match(/\b(?:func|def|fn)\s+([\w$]+)/))) return m[1]
  if ((m = header.match(/\b([\w$]+)\s*[:=]\s*(?:async\s*)?(?:function|\()/))) return m[1]
  if ((m = header.match(/\b(?:public|private|protected|static|async|override)\b[\w\s<>,[\]]*\s+([\w$]+)\s*\(/))) return m[1]
  if ((m = header.match(/^\s*([\w$]+)\s*\([^)]*\)\s*\{/))) return m[1]
  return null
}

/** Forward brace-match: returns the line index of the brace that closes openLn. */
function matchCloseBrace(lines: string[], openLn: number): number | null {
  let depth = 0
  let started = false
  for (let ln = openLn; ln < lines.length; ln++) {
    for (const ch of lines[ln]) {
      if (ch === "{") { depth++; started = true }
      else if (ch === "}") { depth--; if (started && depth === 0) return ln }
    }
  }
  return null
}

/** Extracts the enclosing function for brace languages via brace backtracking. */
function extractBraceFunction(
  lines: string[],
  lineStart: number,
): { body: string; name: string | null } | null {
  const i0 = lineStart - 1
  // Walk full lines up to the target, tracking the stack of unmatched "{".
  const openStack: number[] = []
  for (let ln = 0; ln <= i0 && ln < lines.length; ln++) {
    for (const ch of lines[ln]) {
      if (ch === "{") openStack.push(ln)
      else if (ch === "}") openStack.pop()
    }
  }
  // Innermost → outermost: the first enclosing block whose header is a function.
  for (let s = openStack.length - 1; s >= 0; s--) {
    const openLn = openStack[s]
    const prev = openLn > 0 ? lines[openLn - 1] : ""
    if (!looksLikeFunction(lines[openLn], prev)) continue
    const end = matchCloseBrace(lines, openLn)
    if (end === null) continue
    // Pull the signature line up one row when it spilled onto the previous line.
    let start = openLn
    if (openLn > 0 && /\bfunction\b|\bfunc\b|\bdef\b|=>|\)\s*$|=\s*$/.test(prev) && !/[{};]\s*$/.test(prev)) {
      start = openLn - 1
    }
    let body = lines.slice(start, end + 1)
    let truncated = false
    if (body.length > 160) { body = body.slice(0, 160); truncated = true }
    const text = body
      .map((l, idx) => {
        const realLn = start + idx + 1
        return `${realLn}${realLn === lineStart ? " ◄" : "  "}: ${l}`
      })
      .join("\n") + (truncated ? "\n… (function truncated)" : "")
    return { body: text, name: extractFunctionName(`${prev} ${lines[openLn]}`) }
  }
  return null
}

/** Extracts the enclosing function for Python via indentation. */
function extractPythonFunction(
  lines: string[],
  lineStart: number,
): { body: string; name: string | null } | null {
  const i0 = lineStart - 1
  const targetIndent = (lines[i0].match(/^(\s*)/)?.[1] ?? "").length
  let defLn = -1
  let defIndent = 0
  for (let ln = i0; ln >= 0; ln--) {
    const m = lines[ln].match(/^(\s*)(?:async\s+)?def\s+([A-Za-z_]\w*)/)
    if (m) {
      const indent = m[1].length
      if (ln === i0 || targetIndent > indent) { defLn = ln; defIndent = indent; break }
    }
  }
  if (defLn < 0) return null
  let end = lines.length - 1
  for (let ln = defLn + 1; ln < lines.length; ln++) {
    if (lines[ln].trim() === "") continue
    const ind = (lines[ln].match(/^(\s*)/)?.[1] ?? "").length
    if (ind <= defIndent) { end = ln - 1; break }
  }
  let body = lines.slice(defLn, end + 1)
  let truncated = false
  if (body.length > 160) { body = body.slice(0, 160); truncated = true }
  const text = body
    .map((l, idx) => {
      const realLn = defLn + idx + 1
      return `${realLn}${realLn === lineStart ? " ◄" : "  "}: ${l}`
    })
    .join("\n") + (truncated ? "\n… (function truncated)" : "")
  return { body: text, name: lines[defLn].match(/def\s+([A-Za-z_]\w*)/)?.[1] ?? null }
}

/** Extracts the function enclosing `lineStart`, dispatching by file extension. */
function extractEnclosingFunction(
  lines: string[],
  lineStart: number | null,
  filePath: string,
): { body: string; name: string | null } | null {
  if (!lineStart || lineStart < 1 || lineStart > lines.length) return null
  if (lines.length > 5000) return null // too large to brace-walk cheaply
  const ext = (filePath.split(".").pop() ?? "").toLowerCase()
  if (ext === "py") return extractPythonFunction(lines, lineStart)
  const braceLangs = new Set([
    "js", "jsx", "ts", "tsx", "mjs", "cjs", "java", "go", "c", "cc", "cpp",
    "cxx", "h", "hpp", "cs", "php", "rs", "kt", "kts", "scala", "swift", "m", "mm",
  ])
  if (braceLangs.has(ext)) return extractBraceFunction(lines, lineStart)
  return null
}

/**
 * Uses the GitHub code-search API to find OTHER files that call/import the
 * given function — the "blast radius" of a finding. Returns a short bullet
 * list of file paths, or null. Skipped for very short/generic names.
 */
async function findCallers(
  repository: string,
  name: string,
  excludePath: string,
  token: string | null,
  cache: Map<string, string | null>,
): Promise<string | null> {
  if (!token || !name || name.length < 4) return null
  const key = `${repository}::${name}`
  if (cache.has(key)) return cache.get(key) ?? null

  let result: string | null = null
  try {
    const q = encodeURIComponent(`${name} repo:${repository}`)
    const res = await fetch(`https://api.github.com/search/code?q=${q}&per_page=5`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": GH_API_VERSION,
      },
    })
    if (res.ok) {
      const data = (await res.json()) as { items?: { path: string }[] }
      const paths = (data.items ?? [])
        .map((i) => i.path)
        .filter((p) => p && p !== excludePath)
      const uniq = Array.from(new Set(paths)).slice(0, 3)
      if (uniq.length) result = uniq.map((p) => `- ${p}`).join("\n")
    }
  } catch {
    result = null
  }
  cache.set(key, result)
  return result
}

/** Matches conventional test/spec file names across ecosystems. */
function isTestFileName(n: string): boolean {
  const low = n.toLowerCase()
  return (
    /(^|[._-])(test|spec)([._-]|$)/i.test(low) ||
    /\.(test|spec)\./i.test(low) ||
    /^test_/i.test(low) ||
    /_test\./i.test(low)
  )
}

/**
 * Looks in the finding's own directory for a test/spec file, preferring one
 * whose name matches the source file. Returns the first ~40 lines, or null.
 */
async function findTestFile(
  repository: string,
  filePath: string,
  token: string | null,
  caches: FetchCaches,
): Promise<string | null> {
  const dir = filePath.includes("/") ? filePath.slice(0, filePath.lastIndexOf("/")) : ""
  const baseName = (filePath.split("/").pop() ?? "").replace(/\.[^.]+$/, "").toLowerCase()
  const dirKey = `${repository}::${dir}`

  let listing = caches.dir.get(dirKey)
  if (listing === undefined) {
    listing = null
    try {
      const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": GH_API_VERSION,
      }
      if (token) headers["Authorization"] = `Bearer ${token}`
      const res = await fetch(
        `https://api.github.com/repos/${repository}/contents/${encodeURIComponent(dir)}`,
        { headers },
      )
      if (res.ok) {
        const arr = (await res.json()) as { name: string; path: string; type: string }[]
        if (Array.isArray(arr)) {
          listing = arr.filter((x) => x.type === "file").map((x) => ({ name: x.name, path: x.path }))
        }
      }
    } catch {
      listing = null
    }
    caches.dir.set(dirKey, listing)
  }
  if (!listing) return null

  const match =
    listing.find((f) => isTestFileName(f.name) && f.name.toLowerCase().includes(baseName)) ??
    listing.find((f) => isTestFileName(f.name))
  if (!match) return null

  const content = await ghFetchRaw(repository, match.path, token, caches.file)
  if (!content) return null
  return `[${match.path}]\n${content.split("\n").slice(0, 40).join("\n")}`
}

/**
 * Assembles the rich, labelled code context for one finding:
 *   === FUNCTION BODY ===   (enclosing function, or 60-line slice fallback)
 *   === CALLERS ===         (other files calling/importing the function)
 *   === TEST COVERAGE ===   (nearby test file)
 * Returns null only when the file itself can't be fetched.
 */
async function fetchRichContext(
  repository: string,
  filePath: string,
  lineStart: number | null,
  token: string | null,
  caches: FetchCaches,
  budget: FetchBudget,
): Promise<string | null> {
  const raw = await ghFetchRaw(repository, filePath, token, caches.file)
  if (!raw) return null

  const lines = raw.split("\n")
  const fn = extractEnclosingFunction(lines, lineStart, filePath)
  const functionBody = fn ? fn.body : sliceAround(lines, lineStart)

  let out = `[FETCHED FROM REPO — ${filePath}]\n=== FUNCTION BODY ===\n${functionBody}`

  // Callers — only when we resolved a real function name and have search budget.
  if (fn?.name && budget.search > 0) {
    budget.search--
    const callers = await findCallers(repository, fn.name, filePath, token, caches.search)
    if (callers) {
      out += `\n\n=== CALLERS (other files importing/calling \`${fn.name}\`) ===\n${callers}`
    }
  }

  // Test coverage — bounded by directory-listing budget.
  if (budget.dir > 0) {
    budget.dir--
    const test = await findTestFile(repository, filePath, token, caches)
    if (test) out += `\n\n=== TEST COVERAGE ===\n${test}`
  }

  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. analyzeFindings — triage a batch of raw scan findings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Takes raw findings from GitHub Actions (Semgrep / ZAP / Gitleaks etc.)
 * and returns enriched, AI-triaged findings with CWE, OWASP mapping,
 * CVSS score estimation, and remediation guidance.
 *
 * Batches up to 20 findings per Gemini call to stay within token limits.
 */
export async function analyzeFindings(
  findings: WebhookFinding[],
  repository?: string,
  githubToken?: string,
  techStack?: TechStack | null,
): Promise<TriagedFinding[]> {
  if (findings.length === 0) return []

  const BATCH_SIZE = 20
  const results: TriagedFinding[] = []

  // Shared across the whole call so the same file/dir/search is fetched once,
  // and so a noisy scan can't fan out into hundreds of GitHub API calls.
  const caches = makeCaches()
  const budget: FetchBudget = { search: 15, dir: 15 }

  // Framework/language line prepended to every prompt (point 4).
  const techLine = techStack?.summary ? `This codebase uses: ${techStack.summary}\n\n` : ""

  for (let i = 0; i < findings.length; i += BATCH_SIZE) {
    const batch = findings.slice(i, i + BATCH_SIZE)

    // Fetch rich code context for each finding: the full enclosing function,
    // the other files that call/import it, and any nearby test file. This
    // dramatically improves false-positive detection accuracy for SAST.
    const batchWithContext = await Promise.all(
      batch.map(async (f) => {
        // Skip fetch if: no file path, already has a long code snippet, or DAST finding
        if (!f.filePath || (f.codeSnippet && f.codeSnippet.length > 200) || f.targetUrl) {
          return { ...f, _fetchedContext: null as string | null }
        }
        const context = await fetchRichContext(
          repository ?? "",
          f.filePath,
          f.lineStart ?? null,
          githubToken ?? null,
          caches,
          budget,
        )
        return { ...f, _fetchedContext: context }
      })
    )

    const prompt = `${techLine}You are a senior application security engineer triaging security scan findings from an automated scanner.
These findings come from ARBITRARY customer repositories — not a specific known codebase.

For EACH finding, return a JSON object with these exact fields:
- triageSeverity: one of "critical" | "high" | "medium" | "low" | "info"
- triageReasoning: 1-2 sentence explanation of the severity assignment
- cweId: CWE identifier string like "CWE-89" (empty string if unknown)
- owaspCategory: OWASP Top 10 2021 category like "A03:2021 – Injection" (empty string if not applicable)
- cvssScore: estimated CVSS 3.1 base score as string like "8.1" (empty string if unknown)
- remediation: specific actionable remediation steps in 2-4 sentences. CRITICAL: do NOT invent or guess specific version numbers, CVE IDs, or commit hashes. If you are not certain of the exact fixed version, write "upgrade to the latest patched version and consult the official advisory" instead of naming a version. NEVER recommend downgrading a package, and never suggest a version older than what is already installed.
- exploitability: one of "high" | "medium" | "low". Decide it by answering THREE questions about THIS finding:
    (1) Is the vulnerable input USER-CONTROLLED — does data from an external/untrusted source reach the sink?
    (2) Is it reachable WITHOUT prior authentication — can an unauthenticated actor trigger it?
    (3) Is the affected code NETWORK-REACHABLE at runtime (vs. local-only, build-time, or test/dev tooling)?
  Score "high" when all/most answers are yes (user-controlled AND unauthenticated AND network-reachable); "medium" when mixed (e.g. requires authentication, or only partially reachable); "low" when the input is not user-controlled, requires privileged/local access, or is not network-reachable. Use the FUNCTION BODY, CALLERS and TEST COVERAGE context to judge reachability.
- isFalsePositive: true if this is a false positive, false otherwise

FALSE POSITIVE DETECTION — set triageSeverity to "info" and isFalsePositive to true when ANY of these apply:

1. SECRET IN TEMPLATE/EXAMPLE FILE: The file path contains ".env.example", ".env.sample", ".env.template", ".env.dist", "example.env", or similar. These files contain documented placeholder values, NOT real credentials.

2. SECRET DETECTOR CONFIG FILE: The file is a secret-scanning config (gitleaks.toml, .secrets.baseline, detect-secrets.json, .pre-commit-config.yaml). These contain regex PATTERNS for finding secrets, not actual secret values.

3. KNOWN PLACEHOLDER VALUES: The finding's code snippet or description contains known placeholder strings: "AKIAIOSFODNN7EXAMPLE", "wJalrXUtnFEMI", "CHANGE_ME", "YOUR_*", "example_*", "placeholder", "dummy_", "fake_", "<your-", "\${YOUR_", "INSERT_HERE", "REPLACE_WITH".

4. CI/CD WORKFLOW INJECTION FALSE POSITIVE: The file is a GitHub Actions workflow (.github/workflows/*.yml) and the finding is CWE-78 / command injection related to \${{ github.* }} expressions. These are safe when used at the job env: level — they are NOT shell-injected.

5. GENERATED/VENDOR CODE: The file path starts with node_modules/, .next/, dist/, build/, vendor/, __pycache__/, coverage/. These are not developer-authored code.

6. LOCK FILE: The file is package-lock.json, yarn.lock, pnpm-lock.yaml, composer.lock, Gemfile.lock, Cargo.lock, poetry.lock, Pipfile.lock. Vulnerabilities in lock files are reported by dependency scanners and handled separately — do not flag them as code vulnerabilities.

7. CORRECTLY IMPLEMENTED SANITIZATION FLAGGED AS XSS: The finding title mentions a custom escape or sanitize function (escapeXml, escapeHtml, sanitizeHtml, htmlEscape, xmlEscape) AND the code snippet shows it correctly escaping <, >, &, ', " characters. A correct implementation is NOT a vulnerability.

Respond with a JSON array of exactly ${batch.length} objects, one per finding, in the same order as the input.
Do NOT include any text outside the JSON array.

INPUT FINDINGS (with real file context where available):
${JSON.stringify(
  batchWithContext.map(({ _fetchedContext, ...f }) => ({
    ...f,
    // Replace the short tool snippet with the full labelled context when available.
    codeSnippet: _fetchedContext ?? (f.codeSnippet ?? null),
  })),
  null,
  2,
)}
`

    let parsed: Array<{
      triageSeverity: SeverityLevel
      triageReasoning: string
      cweId: string
      owaspCategory: string
      cvssScore: string
      remediation: string
      exploitability?: ExploitabilityLevel
      isFalsePositive?: boolean
    }>

    try {
      const raw = await callGemini(prompt)
      parsed = JSON.parse(raw)
    } catch (err) {
      console.error("[ai] analyzeFindings batch parse error:", err)
      // Fallback: pass through findings with original severity unchanged
      parsed = batch.map((f) => ({
        triageSeverity: f.severity,
        triageReasoning: "AI triage unavailable — using tool-reported severity.",
        cweId: f.cweId ?? "",
        owaspCategory: f.owaspCategory ?? "",
        cvssScore: f.cvssScore ?? "",
        remediation: "Refer to tool documentation for remediation guidance.",
        exploitability: undefined,
        isFalsePositive: false,
      }))
    }

    batch.forEach((finding, idx) => {
      const enriched = parsed[idx] ?? {
        triageSeverity: finding.severity,
        triageReasoning: "Triage data missing for this index.",
        cweId: "",
        owaspCategory: "",
        cvssScore: "",
        remediation: "",
        exploitability: undefined,
        isFalsePositive: false,
      }
      // Sanitise exploitability to the allowed enum values; null when absent/invalid.
      const exploitability: ExploitabilityLevel | null =
        enriched.exploitability === "high" ||
        enriched.exploitability === "medium" ||
        enriched.exploitability === "low"
          ? enriched.exploitability
          : null
      results.push({
        ...finding,
        triageSeverity: enriched.triageSeverity,
        triageReasoning: enriched.triageReasoning,
        cweId: enriched.cweId || finding.cweId || "",
        owaspCategory: enriched.owaspCategory || finding.owaspCategory || "",
        cvssScore: enriched.cvssScore || finding.cvssScore || "",
        remediation: enriched.remediation,
        exploitability,
        isFalsePositive: enriched.isFalsePositive ?? false,
        fingerprint: makeFingerprint(finding),
      })
    })
  }

  return results
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. generateAutoFix — produce a unified diff patch for one finding
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a ready-to-apply unified diff patch for the given finding.
 * Requires `codeSnippet` to be present for best results.
 */
export async function generateAutoFix(
  finding: TriagedFinding,
): Promise<AutoFixResult> {
  const prompt = `
You are a senior software security engineer. Generate a code fix for the following security vulnerability.

VULNERABILITY DETAILS:
- Title: ${finding.title}
- Tool: ${finding.tool}
- Severity: ${finding.triageSeverity}
- CWE: ${finding.cweId || "Unknown"}
- OWASP: ${finding.owaspCategory || "N/A"}
- File: ${finding.filePath ?? "N/A"}
- Lines: ${finding.lineStart ?? "?"}–${finding.lineEnd ?? "?"}
- Description: ${finding.description ?? "No description provided."}
- Remediation guidance: ${finding.remediation}
${finding.codeSnippet ? `\nVULNERABLE CODE:\n\`\`\`\n${finding.codeSnippet}\n\`\`\`` : ""}

Respond with a JSON object containing:
- patch: a unified diff string (--- a/file\\n+++ b/file\\n@@ ... @@\\n-old\\n+new). If no code snippet was provided, write a conceptual patch showing the pattern to fix.
- explanation: 2-4 sentences explaining what the fix does and why it resolves the vulnerability.

Do NOT include any text outside the JSON object.
`

  try {
    const raw = await callGemini(prompt)
    const parsed = JSON.parse(raw) as { patch: string; explanation: string }
    return {
      patch: parsed.patch ?? "",
      explanation: parsed.explanation ?? "",
      model: GEMINI_MODEL,
    }
  } catch (err) {
    console.error("[ai] generateAutoFix error:", err)
    return {
      patch: "",
      explanation: "Auto-fix generation failed. Please remediate manually.",
      model: GEMINI_MODEL,
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. generateReport — produce a Markdown security summary for a scan
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a Markdown security report summarising all findings for a scan.
 * Suitable for posting as a GitHub PR comment or emailing to the team.
 */
export async function generateReport(
  repository: string,
  branch: string,
  findings: TriagedFinding[],
): Promise<ScanReport> {
  // Build summary counts
  const summary: Record<SeverityLevel, number> = {
    critical: 0, high: 0, medium: 0, low: 0, info: 0,
  }
  for (const f of findings) summary[f.triageSeverity]++

  // Weighted risk score: critical=10, high=7, medium=4, low=1, info=0
  const weights: Record<SeverityLevel, number> = {
    critical: 10, high: 7, medium: 4, low: 1, info: 0,
  }
  const rawScore = Object.entries(summary).reduce(
    (acc, [sev, count]) => acc + weights[sev as SeverityLevel] * count, 0,
  )
  const riskScore = Math.min(100, Math.round(rawScore))

  if (findings.length === 0) {
    return {
      markdown: `## ✅ Security Scan — No Findings\n\nNo vulnerabilities were detected in \`${repository}\` on branch \`${branch}\`.`,
      riskScore: 0,
      summary,
    }
  }

  const topFindings = findings
    .sort((a, b) => weights[b.triageSeverity] - weights[a.triageSeverity])
    .slice(0, 10)

  const prompt = `
You are a senior application security engineer writing a security scan report.

SCAN DETAILS:
- Repository: ${repository}
- Branch: ${branch}
- Total findings: ${findings.length}
- Risk score: ${riskScore}/100
- Severity breakdown: ${JSON.stringify(summary)}

TOP FINDINGS (up to 10):
${JSON.stringify(topFindings.map(f => ({
  title: f.title,
  severity: f.triageSeverity,
  tool: f.tool,
  cwe: f.cweId,
  file: f.filePath ?? f.targetUrl ?? "N/A",
  remediation: f.remediation,
})), null, 2)}

Write a professional Markdown security report with:
1. An executive summary (2-3 sentences)
2. A severity breakdown table
3. Top 3 critical/high issues with brief remediation notes
4. A next-steps section

Keep it concise and actionable. Use Markdown formatting.
Respond with a JSON object: { "markdown": "<full markdown report string>" }
Do NOT include any text outside the JSON object.
`

  try {
    const raw = await callGemini(prompt)
    const parsed = JSON.parse(raw) as { markdown: string }
    return { markdown: parsed.markdown ?? "", riskScore, summary }
  } catch (err) {
    console.error("[ai] generateReport error:", err)
    const fallback = `## Security Scan Report\n\n**Repository:** ${repository} · **Branch:** ${branch}\n\n**Risk Score:** ${riskScore}/100\n\n| Severity | Count |\n|---|---|\n${Object.entries(summary).map(([s, c]) => `| ${s} | ${c} |`).join("\n")}\n\n*AI report generation failed — please review findings manually.*`
    return { markdown: fallback, riskScore, summary }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. correlateFindings
// ─────────────────────────────────────────────────────────────────────────────

export interface CorrelationInput {
  id: string
  title: string
  severity: SeverityLevel
  tool: string
  filePath: string | null
  cweId: string | null
}

export async function correlateFindings(
  findings: CorrelationInput[],
  techStack?: TechStack | null,
): Promise<CorrelationGroup[]> {

  if (findings.length < 2 || !GEMINI_API_KEY) return []

  const techLine = techStack?.summary ? `This codebase uses: ${techStack.summary}\n\n` : ""
  const prompt = `${techLine}You are a senior application security engineer performing CROSS-TOOL CORRELATION.
Below is the complete set of findings from a single security scan, each with a stable "id".
Identify which findings COMBINE into a single real-world ATTACK CHAIN — where one finding
meaningfully enables or amplifies another (e.g. "SSRF reaches an endpoint that exposes a
hardcoded AWS key", or "path traversal reads a file that a separate finding logs unsanitised").

Rules:
- Only group findings that are GENUINELY related into an exploit path. Do NOT group unrelated
  issues just because they share a severity or file.
- Every group MUST have at least 2 members.
- "severity" is the severity the whole chain should carry — never lower than the highest
  individual member's severity.
- If nothing correlates, return {"groups": []}.

Return ONLY this JSON object:
{ "groups": [ { "memberIds": ["<id>", "<id>"], "label": "<short chain name>", "severity": "critical|high|medium|low|info", "rationale": "<1-2 sentences>" } ] }

FINDINGS:
${JSON.stringify(
  findings.map((f) => ({
    id: f.id,
    title: f.title,
    severity: f.severity,
    tool: f.tool,
    file: f.filePath,
    cwe: f.cweId,
  })),
  null,
  2,
)}
`

  try {
    const raw = await callGemini(prompt)
    const parsed = JSON.parse(raw) as { groups?: CorrelationGroup[] }
    const groups = (parsed.groups ?? []).filter(
      (g) => Array.isArray(g.memberIds) && g.memberIds.length >= 2,
    )
    return groups
  } catch (err) {
    console.error("[ai] correlateFindings error:", err)
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. detectTechStack — framework/language profile from the repo's manifest
// ─────────────────────────────────────────────────────────────────────────────

/** Maps a notable dependency name to the framework it implies. */
const FRAMEWORK_HINTS: Record<string, string> = {
  next: "Next.js", react: "React", vue: "Vue", "@angular/core": "Angular",
  svelte: "Svelte", nuxt: "Nuxt", express: "Express", "@nestjs/core": "NestJS",
  fastify: "Fastify", koa: "Koa", django: "Django", flask: "Flask",
  fastapi: "FastAPI", rails: "Ruby on Rails", sinatra: "Sinatra",
  gin: "Gin", echo: "Echo", fiber: "Fiber", chi: "chi",
  "spring-boot": "Spring Boot", spring: "Spring",
}

/** Builds a compact human summary for the AI prompt header. */
function buildSummary(language: string | null, framework: string | null, deps: string[]): string {
  const parts: string[] = []
  if (framework) parts.push(framework)
  parts.push(...deps.filter((d) => d.toLowerCase() !== framework?.toLowerCase()).slice(0, 5))
  const head = parts.length ? parts.join(", ") : (language ?? "unknown stack")
  return language ? `${head} (${language})` : head
}

/** Parses one recognised manifest file into a TechStack profile. */
function parseManifest(manifest: string, content: string): TechStack | null {
  try {
    if (manifest === "package.json") {
      const pkg = JSON.parse(content) as {
        dependencies?: Record<string, string>
        devDependencies?: Record<string, string>
      }
      const names = Object.keys({ ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) })
      if (names.length === 0) return null
      const framework = names.map((n) => FRAMEWORK_HINTS[n]).find(Boolean) ?? null
      const language = names.includes("typescript") ? "TypeScript/Node.js" : "JavaScript/Node.js"
      const deps = names.filter((n) => FRAMEWORK_HINTS[n] || ["drizzle-orm", "prisma", "@prisma/client", "mongoose", "sequelize", "typeorm", "graphql", "tailwindcss"].includes(n))
      return { language, framework, dependencies: deps.slice(0, 8), manifest, summary: buildSummary(language, framework, deps) }
    }

    if (manifest === "requirements.txt") {
      const names = content
        .split("\n")
        .map((l) => l.trim().split(/[=<>!~ ]/)[0].toLowerCase())
        .filter((n) => n && !n.startsWith("#"))
      if (names.length === 0) return null
      const framework = names.map((n) => FRAMEWORK_HINTS[n]).find(Boolean) ?? null
      return { language: "Python", framework, dependencies: names.slice(0, 8), manifest, summary: buildSummary("Python", framework, names) }
    }

    if (manifest === "Gemfile") {
      const names = Array.from(content.matchAll(/gem\s+['"]([\w-]+)['"]/g)).map((m) => m[1].toLowerCase())
      if (names.length === 0) return null
      const framework = names.map((n) => FRAMEWORK_HINTS[n]).find(Boolean) ?? null
      return { language: "Ruby", framework, dependencies: names.slice(0, 8), manifest, summary: buildSummary("Ruby", framework, names) }
    }

    if (manifest === "go.mod") {
      const names = Array.from(content.matchAll(/\s([\w.\-/]+)\s+v\d/g)).map((m) => {
        const full = m[1]
        return (full.split("/").pop() ?? full).toLowerCase()
      })
      const framework = names.map((n) => FRAMEWORK_HINTS[n]).find(Boolean) ?? null
      return { language: "Go", framework, dependencies: names.slice(0, 8), manifest, summary: buildSummary("Go", framework, names) }
    }

    if (manifest === "pom.xml") {
      const names = Array.from(content.matchAll(/<artifactId>([\w.\-]+)<\/artifactId>/g)).map((m) => m[1].toLowerCase())
      if (names.length === 0) return null
      const framework = names.map((n) => FRAMEWORK_HINTS[n]).find(Boolean) ?? null
      return { language: "Java", framework, dependencies: names.slice(0, 8), manifest, summary: buildSummary("Java", framework, names) }
    }
  } catch {
    return null
  }
  return null
}

/**
 * Fetches the repo's dependency manifest (package.json, requirements.txt,
 * Gemfile, go.mod or pom.xml — whichever exists first) from the default
 * branch and derives a {@link TechStack} profile. Returns null when no
 * recognised manifest is found or every fetch fails — callers must treat the
 * whole step as best-effort and continue the scan regardless.
 */
export async function detectTechStack(
  repository: string,
  token: string | null,
): Promise<TechStack | null> {
  if (!repository) return null
  const cache = new Map<string, string | null>()
  // Order matters: most specific / most common ecosystems first.
  const manifests = ["package.json", "requirements.txt", "Gemfile", "go.mod", "pom.xml"]
  for (const manifest of manifests) {
    const content = await ghFetchRaw(repository, manifest, token, cache)
    if (!content) continue
    const ts = parseManifest(manifest, content)
    if (ts) return ts
  }
  return null
}