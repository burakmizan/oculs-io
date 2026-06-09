import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { generateReport } from "@/lib/ai"
import type { TriagedFinding } from "@/lib/ai"
import type { SeverityLevel } from "@/types"

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

  // Convert to TriagedFinding format for generateReport
  const triaged: TriagedFinding[] = findings.map(f => ({
    tool: f.tool as TriagedFinding["tool"],
    title: f.title,
    severity: f.severity as SeverityLevel,
    triageSeverity: f.severity as SeverityLevel,
    triageReasoning: "",
    cweId: f.cweId ?? "",
    owaspCategory: "",
    cvssScore: "",
    remediation: f.remediation ?? "",
    fingerprint: "",
    description: f.count > 1 ? `Detected ${f.count} times` : undefined,
    filePath: f.filePath ?? undefined,
    lineStart: f.lineStart ?? undefined,
  }))

  try {
    const result = await generateReport(repoName, "main", triaged)
    return NextResponse.json({ report: result.markdown, riskScore: result.riskScore })
  } catch (err) {
    console.error("[report/generate] Gemini error:", err)
    return NextResponse.json(
      { error: "Report generation failed", report: null },
      { status: 200 }, // Return 200 so client handles gracefully
    )
  }
}