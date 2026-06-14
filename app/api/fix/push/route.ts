import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { accounts, vulnerabilities } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

export const runtime = "nodejs"
export const maxDuration = 30

interface PushFixRequest {
  vulnerabilityId: string
  findText: string
  replaceText: string
  filePath: string
  repository: string
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json() as PushFixRequest
  const { vulnerabilityId, findText, replaceText, filePath, repository } = body

  if (!vulnerabilityId || !findText || !replaceText || !filePath || !repository) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const [vuln] = await db
    .select({ id: vulnerabilities.id, userId: vulnerabilities.userId })
    .from(vulnerabilities)
    .where(and(
      eq(vulnerabilities.id, vulnerabilityId),
      eq(vulnerabilities.userId, session.user.id),
    ))
    .limit(1)

  if (!vuln) {
    return NextResponse.json({ error: "Finding not found" }, { status: 404 })
  }

  const [acct] = await db
    .select({ access_token: accounts.access_token })
    .from(accounts)
    .where(eq(accounts.userId, session.user.id))
    .limit(1)

  const token = acct?.access_token ?? process.env.GITHUB_TOKEN
  if (!token) {
    return NextResponse.json({ error: "No GitHub token available" }, { status: 403 })
  }

  const [owner, repo] = repository.split("/")
  if (!owner || !repo) {
    return NextResponse.json({ error: "Invalid repository format" }, { status: 400 })
  }

  try {
    const fileRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    )

    if (!fileRes.ok) {
      const err = await fileRes.text()
      return NextResponse.json(
        { error: `Could not fetch file from GitHub: ${fileRes.status}`, detail: err },
        { status: 422 }
      )
    }

    const fileData = await fileRes.json() as { content: string; sha: string; encoding: string }
    const currentContent = Buffer.from(
      fileData.content.replace(/\n/g, ""),
      "base64"
    ).toString("utf-8")

    if (!currentContent.includes(findText)) {
      return NextResponse.json(
        { error: "The 'find' text was not found in the current file. The file may have changed." },
        { status: 422 }
      )
    }

    const updatedContent = currentContent.replace(findText, replaceText)

    const commitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          message: `fix(security): patch ${filePath} — Oculs.io auto-fix\n\nAutomatically applied security fix via Oculs.io dashboard.\nFinding ID: ${vulnerabilityId}`,
          content: Buffer.from(updatedContent).toString("base64"),
          sha: fileData.sha,
        }),
      }
    )

    if (!commitRes.ok) {
      const err = await commitRes.text()
      return NextResponse.json(
        { error: `GitHub commit failed: ${commitRes.status}`, detail: err },
        { status: 422 }
      )
    }

    const commitData = await commitRes.json() as { commit: { html_url: string; sha: string } }

    await db
      .update(vulnerabilities)
      .set({
        status: "resolved",
        fixStatus: "applied",
        fixAppliedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(vulnerabilities.id, vulnerabilityId))

    return NextResponse.json({
      ok: true,
      commitUrl: commitData.commit?.html_url ?? null,
      commitSha: commitData.commit?.sha ?? null,
    })
  } catch (err) {
    console.error("[fix/push] Error:", err)
    return NextResponse.json({ error: "Fix push failed" }, { status: 500 })
  }
}
