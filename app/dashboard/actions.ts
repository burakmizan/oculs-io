"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { queueScan } from "@/lib/db/queries"
import { db } from "@/lib/db"
import { scans, projects } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { TOOLS_BY_ID } from "@/lib/tools"
import type { ScanTool } from "@/types"

export interface ScanActionState {
  error?: string
  ok?: boolean
  scanId?: string
}

const REPO_RE = /^[\w.-]+\/[\w.-]+$/

/**
 * Triggers the GitHub Actions workflow_dispatch directly from the server action.
 * No HTTP round-trip — uses the session token directly.
 */
async function triggerGitHubWorkflow(
  scanId: string,
  repoFullName: string,
  tools: ScanTool[],
  githubToken: string,
  targetUrl: string | null,
): Promise<void> {
  const [owner, repo] = repoFullName.split("/")
  if (!owner || !repo) return

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/oculs-scan.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          scan_id: scanId,
          tools: tools.join(","),
          target_url: targetUrl ?? "",
        },
      }),
    },
  )

  if (!res.ok) {
    const err = await res.text()
    console.error("[createScan] GitHub workflow dispatch failed:", res.status, err)
  } else {
    console.log(`[createScan] Workflow dispatched: ${repoFullName} scan=${scanId}`)
  }
}

export async function createScan(
  _prev: ScanActionState,
  formData: FormData,
): Promise<ScanActionState> {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: "Your session expired. Please sign in again." }
  }

  const repoFullName = String(formData.get("repoFullName") ?? "").trim()
  const targetUrlRaw = String(formData.get("targetUrl") ?? "").trim()

  const tools = formData
    .getAll("tools")
    .map(String)
    .filter((t): t is ScanTool => t in TOOLS_BY_ID)

  if (!REPO_RE.test(repoFullName)) {
    return { error: "Enter a repository as owner/repo." }
  }
  if (tools.length === 0) {
    return { error: "Select at least one scanner to run." }
  }

  let scanId: string
  try {
    scanId = await queueScan({
      userId: session.user.id,
      repoFullName,
      targetUrl: targetUrlRaw || null,
      tools,
    })
    revalidatePath("/dashboard")
  } catch {
    return {
      error: "Couldn't queue the scan — the database isn't reachable. Check DATABASE_URL.",
    }
  }

  // Trigger GitHub Actions directly — token from session (GitHub OAuth)
  // or fall back to GITHUB_TOKEN env var (PAT set in Vercel).
  const githubToken =
    session.user.githubAccessToken ??
    process.env.GITHUB_TOKEN

  if (githubToken) {
    try {
      await triggerGitHubWorkflow(scanId, repoFullName, tools, githubToken, targetUrlRaw || null)
    } catch (err) {
      // Non-fatal — scan is queued in Aurora, can retry manually
      console.error("[createScan] triggerGitHubWorkflow threw:", err)
    }
  } else {
    console.warn("[createScan] No GitHub token — workflow not dispatched. Set GITHUB_TOKEN in env.")
  }

  return { ok: true, scanId }
}