import type { SeverityLevel, ExploitabilityLevel } from "@/types"

// ─── Constants ───────────────────────────────────────────────────────────────

export const CODE_EXTS = new Set([
  "js", "ts", "py", "go", "java", "rb", "php", "cs", "cpp", "c",
  "rs", "kt", "swift", "vue", "jsx", "tsx",
])

export const SKIP_DIRS = /\/(node_modules|\.git|\.next|dist|build|vendor|__pycache__|\.yarn|coverage)\//

export const MAX_FILES      = 25
export const MAX_LINES      = 150
export const MAX_FILE_BYTES = 100 * 1024
export const MAX_ZIP_BYTES  = 50 * 1024 * 1024

export const SEVERITY_WEIGHTS: Record<SeverityLevel, number> = {
  critical: 40, high: 20, medium: 8, low: 2, info: 0,
}

export const VALID_SEV  = new Set<SeverityLevel>(["critical", "high", "medium", "low", "info"])
export const VALID_EXPL = new Set<ExploitabilityLevel>(["high", "medium", "low"])

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SastFinding {
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

export function makeFingerprint(ruleId: string, filePath: string, lineStart: number): string {
  const raw = `semgrep::${ruleId}::${filePath}::${lineStart}`
  let h = 5381
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) + h) ^ raw.charCodeAt(i)
    h = h >>> 0
  }
  return h.toString(16).padStart(8, "0")
}

// ─── Gemini SAST call ─────────────────────────────────────────────────────────

export async function callGeminiSast(
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
