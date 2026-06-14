import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"

export const runtime = "nodejs"
export const maxDuration = 60

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash"
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`

interface InputFinding {
  id: string
  title: string
  severity: string
  tool: string
  filePath: string | null
  lineStart: number | null
  codeSnippet: string | null
  description: string | null
  remediation: string | null
  status: string | null
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { scanId, repoName, findings } = await req.json() as {
    scanId: string
    repoName: string
    findings: InputFinding[]
  }

  if (!findings || findings.length === 0) {
    return NextResponse.json({ cards: [] })
  }

  if (!GEMINI_API_KEY) {
    return NextResponse.json({ cards: [] })
  }

  const BATCH = 5
  const allCards: object[] = []

  for (let i = 0; i < findings.length; i += BATCH) {
    const batch = findings.slice(i, i + BATCH)

    const prompt = `You are a senior security engineer reviewing vulnerabilities found in the repository "${repoName}".

For each finding below, you must:
1. Decide if it is a FALSE POSITIVE (template files, placeholder values, config-only files, generated code, lock files)
2. If REAL: produce the exact "find" and "replace" strings so a developer can fix it

CRITICAL RULES for find/replace:
- findText must be the EXACT verbatim code from the codeSnippet (copy-paste exactly, do not paraphrase)
- replaceText must be valid code in the same language that fixes the vulnerability
- If codeSnippet is null or empty, use the file path + line as context and produce a conceptual fix
- Do NOT change surrounding code, indentation style, or variable names outside what is needed
- Do NOT produce a full file — only the lines that change
- Keep fixes minimal: change as few lines as possible
- replaceText must NOT break the existing code logic

FALSE POSITIVE conditions (set isFalsePositive: true, findText: "", replaceText: ""):
- File is .env.example / .env.sample / .env.template / .env.dist
- File is gitleaks.toml / .secrets.baseline / detect-secrets.json
- Code snippet contains: AKIAIOSFODNN7EXAMPLE, CHANGE_ME, YOUR_, placeholder, dummy_, fake_
- File is in node_modules/, .next/, dist/, build/, vendor/, coverage/
- File is package-lock.json / yarn.lock / pnpm-lock.yaml / composer.lock
- Finding is CWE-78 in .github/workflows/ (GitHub Actions context variables are safe at env: level)
- Tool flagged a correctly implemented escape/sanitize function

Respond with a JSON array of exactly ${batch.length} objects, one per finding in input order.
Each object must have these exact fields:
- vulnerabilityId: string (copy from input id)
- title: string (copy from input title)
- severity: string (copy from input severity)
- filePath: string | null (copy from input filePath)
- lineStart: number | null (copy from input lineStart)
- findText: string (exact code to find, or "" if false positive or no code available)
- replaceText: string (replacement code, or "" if false positive)
- explanation: string (1-2 sentences: what this fix does and why it's safe — empty string if false positive)
- isFalsePositive: boolean

Do NOT wrap in markdown. Respond with ONLY the raw JSON array.

FINDINGS:
${JSON.stringify(batch.map(f => ({
  id: f.id,
  title: f.title,
  severity: f.severity,
  tool: f.tool,
  filePath: f.filePath,
  lineStart: f.lineStart,
  codeSnippet: f.codeSnippet,
  description: f.description,
  remediation: f.remediation,
})), null, 2)}`

    try {
      const res = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
          },
        }),
      })

      if (!res.ok) {
        console.error("[fix/cards] Gemini error:", res.status)
        continue
      }

      const data = await res.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
      const clean = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim()

      const parsed = JSON.parse(clean) as object[]
      allCards.push(...parsed)
    } catch (err) {
      console.error("[fix/cards] Parse error:", err)
      for (const f of batch) {
        allCards.push({
          vulnerabilityId: f.id,
          title: f.title,
          severity: f.severity,
          filePath: f.filePath,
          lineStart: f.lineStart,
          findText: "",
          replaceText: "",
          explanation: "Fix generation failed for this finding.",
          isFalsePositive: false,
        })
      }
    }
  }

  return NextResponse.json({ cards: allCards, scanId })
}
