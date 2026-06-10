"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

const VALID = new Set(["off", "critical", "high"])

export async function updateNotifySettings(
  _prev: { ok?: boolean; error?: string },
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Session expired." }

  const url = String(formData.get("alertWebhookUrl") ?? "").trim()
  const thresholdRaw = String(formData.get("alertThreshold") ?? "critical")
  const alertThreshold = VALID.has(thresholdRaw) ? thresholdRaw : "critical"

  // Basic sanity: allow empty (disables) or http(s) URL only
  if (url && !/^https:\/\/.+/i.test(url)) {
    return { error: "Webhook URL must start with https://" }
  }

  try {
    await db
      .update(users)
      .set({ alertWebhookUrl: url || null, alertThreshold })
      .where(eq(users.id, session.user.id))
    revalidatePath("/dashboard/settings")
    return { ok: true }
  } catch {
    return { error: "Could not save notification settings." }
  }
}