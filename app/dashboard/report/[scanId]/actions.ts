"use server"

import { revalidatePath } from "next/cache"
import { randomBytes } from "crypto"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { scans } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"

/**
 * Toggles public sharing for a scan report. Returns the share token (or null
 * when disabled). Ownership-scoped to the requesting user.
 */
export async function toggleReportShare(
  scanId: string,
  enable: boolean,
): Promise<{ token: string | null; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { token: null, error: "Session expired." }

  try {
    const token = enable ? randomBytes(12).toString("hex") : null
    await db
      .update(scans)
      .set({ shareToken: token })
      .where(and(eq(scans.id, scanId), eq(scans.userId, session.user.id)))
    revalidatePath(`/dashboard/report/${scanId}`)
    return { token }
  } catch {
    return { token: null, error: "Could not update sharing." }
  }
}