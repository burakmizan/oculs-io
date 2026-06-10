"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { vulnerabilities } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import type { VulnerabilityStatus } from "@/types"

/**
 * Mute (false_positive) or restore (open) a finding by id.
 * Muting suppresses the same fingerprint on all future scans (see webhook).
 */
export async function setFindingStatus(
  vulnerabilityId: string,
  status: Extract<VulnerabilityStatus, "false_positive" | "dismissed" | "open">,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: "Session expired." }

  try {
    await db
      .update(vulnerabilities)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(vulnerabilities.id, vulnerabilityId),
          eq(vulnerabilities.userId, session.user.id),
        ),
      )
    revalidatePath("/dashboard/findings")
    revalidatePath("/dashboard")
    return { ok: true }
  } catch {
    return { ok: false, error: "Could not update finding." }
  }
}