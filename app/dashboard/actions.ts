"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { queueScan } from "@/lib/db/queries"
import { TOOLS_BY_ID } from "@/lib/tools"
import type { ScanTool } from "@/types"

export interface ScanActionState {
  error?: string
  ok?: boolean
  scanId?: string
}

const REPO_RE = /^[\w.-]+\/[\w.-]+$/

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

  // Only accept tool ids that exist in the matrix.
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

  try {
    const scanId = await queueScan({
      userId: session.user.id,
      repoFullName,
      targetUrl: targetUrlRaw || null,
      tools,
    })
    revalidatePath("/dashboard")

    // Fire-and-forget: trigger GitHub Actions workflow.
    // Failure here is non-fatal — scan row is already in Aurora.
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://oculs-io.vercel.app"
      await fetch(`${appUrl}/api/scan/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: "" },
        body: JSON.stringify({ scanId }),
      })
    } catch { /* Non-fatal — scan queued, workflow can be triggered manually */ }

    return { ok: true, scanId }
  } catch {
    // Most likely Aurora is not provisioned/reachable in local dev.
    return {
      error:
        "Couldn't queue the scan — the database isn't reachable. Check DATABASE_URL.",
    }
  }
}
