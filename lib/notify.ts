import { db } from "@/lib/db"
import { users, vulnerabilities } from "@/lib/db/schema"
import { eq, and, inArray, desc, sql } from "drizzle-orm"
import type { SeverityLevel } from "@/types"

const SEV_RANK: SeverityLevel[] = ["critical", "high", "medium", "low", "info"]

/**
 * Sends a "new findings" alert to the user's configured Slack/Discord
 * incoming webhook, respecting their severity threshold. Enriched with
 * top finding details (file path, line, CWE) and a direct report link.
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

  // Severity breakdown line
  const breakdown = SEV_RANK
    .filter((s) => (input.summary[s] ?? 0) > 0)
    .map((s) => `${input.summary[s]} ${s}`)
    .join(", ")

  // Fetch top critical/high findings with location + CWE for actionable detail
  let topLines = ""
  try {
    const topFindings = await db
      .select({
        title: vulnerabilities.title,
        severity: vulnerabilities.severity,
        filePath: vulnerabilities.filePath,
        lineStart: vulnerabilities.lineStart,
        cweId: vulnerabilities.cweId,
      })
      .from(vulnerabilities)
      .where(
        and(
          eq(vulnerabilities.scanId, input.scanId),
          inArray(vulnerabilities.severity, ["critical", "high"]),
          inArray(vulnerabilities.status, ["open", "in_review"]),
        ),
      )
      .orderBy(
        sql`CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END`,
        desc(vulnerabilities.title),
      )
      .limit(5)

    if (topFindings.length > 0) {
      topLines = "\n" + topFindings.map(f => {
        const loc = f.filePath
          ? `${f.filePath}${f.lineStart ? `:${f.lineStart}` : ""}`
          : null
        const cwe = f.cweId ? ` (${f.cweId})` : ""
        return `• [${f.severity.toUpperCase()}] ${f.title}${cwe}${loc ? ` — \`${loc}\`` : ""}`
      }).join("\n")
    }
  } catch { /* non-fatal */ }

  const text =
    `🛡️ *Oculs* — new findings in \`${input.repository}\`\n` +
    `*${breakdown}*${topLines}\n` +
    `<${reportUrl}|View full report →>`

  try {
    await fetch(cfg.alertWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, content: text.replace(/[*<>|`]/g, "") }),
    })
  } catch (err) {
    console.error("[notify] Alert webhook failed (non-fatal):", err)
  }
}
