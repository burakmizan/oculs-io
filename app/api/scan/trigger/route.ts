import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { scans, projects, accounts } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { resolveApiKeyUser, saveScanTechStack } from "@/lib/db/queries"
import { detectTechStack } from "@/lib/ai"

export const runtime = "nodejs"

/**
 * POST /api/scan/trigger
 * Triggers the GitHub Actions workflow on the target repository.
 * Accepts session auth OR Bearer API key (oculs_...) for CI/CD pipelines.
 */
export async function POST(req: NextRequest) {
  // Try session auth first, then API key auth
  let userId: string | null = null

  const session = await auth()
  if (session?.user?.id) {
    userId = session.user.id
  } else {
    const authHeader = req.headers.get("Authorization") ?? ""
    if (authHeader.startsWith("Bearer oculs_")) {
      userId = await resolveApiKeyUser(authHeader.slice(7))
    }
  }

  if (!userId) {
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

  // Resolve GitHub token: from session if available, otherwise from accounts table (API key auth)
  let token: string | null = session?.user?.githubAccessToken ?? process.env.GITHUB_TOKEN ?? null
  if (!token) {
    try {
      const [acct] = await db.select({ access_token: accounts.access_token }).from(accounts).where(eq(accounts.userId, userId)).limit(1)
      token = acct?.access_token ?? null
    } catch { /* non-fatal */ }
  }
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

  // Best-effort: cache the repo's framework/language profile on the scan row so
  // AI triage in the webhook can reason about framework-specific exploitability.
  try {
    const techStack = await detectTechStack(scan.repoFullName, token)
    await saveScanTechStack(scan.id, techStack)
  } catch (err) {
    console.error("[scan/trigger] tech stack detection failed (non-fatal):", err)
  }

  return NextResponse.json({ triggered: true, scanId, repo: scan.repoFullName })
}