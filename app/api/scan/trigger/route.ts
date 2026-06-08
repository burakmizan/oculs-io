import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { scans, projects } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export const runtime = "nodejs"

/**
 * POST /api/scan/trigger
 * Triggers the GitHub Actions workflow on the target repository
 * using workflow_dispatch after a scan has been queued in Aurora.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { scanId } = await req.json() as { scanId: string }
  if (!scanId) {
    return NextResponse.json({ error: "scanId required" }, { status: 400 })
  }

  // Fetch scan + project from Aurora
  const [scan] = await db
    .select({
      id: scans.id,
      repoFullName: projects.repoFullName,
      tools: scans.tools,
    })
    .from(scans)
    .innerJoin(projects, eq(scans.projectId, projects.id))
    .where(eq(scans.id, scanId))
    .limit(1)

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 })
  }

  const token = session.user.githubAccessToken ?? process.env.GITHUB_TOKEN
  if (!token) {
    return NextResponse.json({ error: "No GitHub token available" }, { status: 403 })
  }

  // Trigger workflow_dispatch on the target repository
  const [owner, repo] = scan.repoFullName.split("/")
  const webhookUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/scan`
    : `https://oculs-io.vercel.app/api/webhook/scan`

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/oculs-scan.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          scan_id: scan.id,
          tools: scan.tools.join(","),
          target_url: "",
        },
      }),
    },
  )

  if (!res.ok) {
    const err = await res.text()
    console.error("[scan/trigger] GitHub dispatch failed:", err)
    // Non-fatal — scan is queued in Aurora, workflow can be triggered manually
    return NextResponse.json({ triggered: false, reason: err }, { status: 200 })
  }

  return NextResponse.json({ triggered: true, scanId, repo: scan.repoFullName })
}