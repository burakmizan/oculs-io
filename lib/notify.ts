import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import type { SeverityLevel } from "@/types"

const SEV_RANK: SeverityLevel[] = ["critical", "high", "medium", "low", "info"]

/**
 * Sends a "new findings" alert to the user's configured Slack/Discord
 * incoming webhook, respecting their severity threshold. No-op if the user
 * has no webhook configured or the scan didn't meet the threshold.
 *
 * Slack and Discord both accept a JSON body with a top-level "text" / "content"
 * field on incoming webhooks; we send both keys so a single URL works for either.
 */
export async function sendScanAlert(input: {
  userId: string
  repository: string
  scanId: string
  summary: Record<SeverityLevel, number>
}): Promise<void> {
  let cfg: { alertWebhookUrl: string | null; alertThreshold: string } | undefined
  try {
    const [row] = await db
      .select({ alertWebhookUrl: users.alertWebhookUrl, alertThreshold: users.alertThreshold })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1)
    cfg = row
  } catch {
    return
  }
  if (!cfg?.alertWebhookUrl || cfg.alertThreshold === "off") return

  const cutoff = SEV_RANK.indexOf(cfg.alertThreshold as SeverityLevel)
  const blocking = SEV_RANK.slice(0, cutoff < 0 ? 1 : cutoff + 1)
    .reduce((sum, sev) => sum + (input.summary[sev] ?? 0), 0)
  if (blocking === 0) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://oculs-io.vercel.app"
  const reportUrl = `${appUrl}/dashboard/report/${input.scanId}`
  const parts = SEV_RANK
    .filter((s) => (input.summary[s] ?? 0) > 0)
    .map((s) => `${input.summary[s]} ${s}`)
    .join(", ")

  const text =
    `🛡️ *Oculs* — new security findings in \`${input.repository}\`\n` +
    `${parts || "findings detected"} · <${reportUrl}|View report>`

  try {
    await fetch(cfg.alertWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // "text" → Slack, "content" → Discord
      body: JSON.stringify({ text, content: text.replace(/[*<>|]/g, "") }),
    })
  } catch (err) {
    console.error("[notify] Alert webhook failed (non-fatal):", err)
  }
}