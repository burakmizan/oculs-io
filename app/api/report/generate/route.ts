import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { scanId, repoName, findings } = await req.json() as {
    scanId: string
    repoName: string
    findings: Array<{
      title: string
      severity: string
      tool: string
      filePath: string | null
      lineStart: number | null
      cweId: string | null
      remediation: string | null
      count: number
    }>
  }

  if (!scanId || !findings) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY
  const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash"
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`

  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY not set", report: null }, { status: 200 })
  }

  // Group findings by title for noise detection
  const grouped = findings.reduce((acc, f) => {
    const key = `${f.tool}::${f.title}`
    acc[key] = (acc[key] ?? 0) + f.count
    return acc
  }, {} as Record<string, number>)

  const noiseFindings = Object.entries(grouped)
    .filter(([, c]) => c >= 3)
    .map(([k]) => k)

  const prompt = `You are a senior application security engineer reviewing automated scan results for the repository "${repoName}".

SCAN FINDINGS (${findings.length} unique, grouped by tool::title):
${JSON.stringify(findings.map(f => ({
  title: f.title,
  severity: f.severity,
  tool: f.tool,
  location: f.filePath ? `${f.filePath}${f.lineStart ? `:${f.lineStart}` : ""}` : "N/A",
  cwe: f.cweId ?? "N/A",
  occurrences: f.count,
})), null, 2)}

NOISE DETECTION: The following findings appear 3+ times and may be noise: ${noiseFindings.length > 0 ? noiseFindings.join(", ") : "none detected"}

Please provide a security analysis report in Markdown with:

## Executive Summary
2-3 sentences summarizing the overall security posture.

## False Positive Assessment
List any findings that are likely false positives based on context (e.g. test files, dev-only dependencies, documentation). Explain why.

## Noise / Duplicate Findings
Call out findings that appear repeatedly with the same pattern — these are likely the same issue reported multiple times by the same tool. Recommend deduplication.

## Critical Issues
Top 3 most important findings to fix immediately with specific remediation steps.

## Risk Summary
Brief assessment of overall risk level (Low/Medium/High/Critical) and why.

Keep the report concise and actionable. Focus on real risks, not noise.

Respond ONLY with the markdown report, no JSON wrapper.`

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
        },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error("[report/generate] Gemini error:", res.status, err)
      return NextResponse.json({ error: "Gemini unavailable", report: null }, { status: 200 })
    }

    const data = await res.json()
    const report = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""

    if (!report) {
      return NextResponse.json({ error: "Empty response", report: null }, { status: 200 })
    }

    return NextResponse.json({ report, scanId })
  } catch (err) {
    console.error("[report/generate] Error:", err)
    return NextResponse.json({ error: "Report generation failed", report: null }, { status: 200 })
  }
}