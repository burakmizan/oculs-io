import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"

export const runtime = "nodejs"

/**
 * POST /api/ask
 * Contextual AI chat for a specific finding. Accepts finding context +
 * a user question, returns a Gemini answer scoped only to that finding.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: {
    question: string
    context: {
      title: string
      severity: string
      filePath?: string | null
      lineStart?: number | null
      cweId?: string | null
      owaspCategory?: string | null
      codeSnippet?: string | null
      description?: string | null
      remediation?: string | null
    }
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { question, context } = body
  if (!question?.trim() || !context?.title) {
    return NextResponse.json({ error: "question and context.title are required" }, { status: 400 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash"
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 })
  }

  const location = context.filePath
    ? `${context.filePath}${context.lineStart ? `:${context.lineStart}` : ""}`
    : "N/A"

  const systemPrompt = `You are a security expert assistant for the Oculs.io security scanner.
Answer questions about the specific security finding below. Be concise (max 3 paragraphs), practical, and developer-friendly.
Only discuss this specific finding — do not bring up unrelated security topics.

Finding:
- Title: ${context.title}
- Severity: ${context.severity}
- Location: ${location}
- CWE: ${context.cweId ?? "N/A"}
- OWASP: ${context.owaspCategory ?? "N/A"}
${context.description ? `- Description: ${context.description}` : ""}
${context.codeSnippet ? `- Vulnerable code:\n\`\`\`\n${context.codeSnippet.slice(0, 500)}\n\`\`\`` : ""}
${context.remediation ? `- Remediation hint: ${context.remediation}` : ""}`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: `${systemPrompt}\n\nUser question: ${question}` }] },
          ],
          generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
        }),
      },
    )
    const data = await res.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
      error?: { message?: string }
    }
    if (data.error) {
      return NextResponse.json({ error: data.error.message ?? "AI error" }, { status: 502 })
    }
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response."
    return NextResponse.json({ answer })
  } catch (err) {
    console.error("[ask] Gemini call failed:", err)
    return NextResponse.json({ error: "AI request failed" }, { status: 502 })
  }
}
