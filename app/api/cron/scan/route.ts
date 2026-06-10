import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { projects, scans, accounts } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import type { ScanTool } from "@/types"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * GET /api/cron/scan — runs hourly (see vercel.json).
 *
 * For each project with scheduling enabled, decides whether *this* hour is the
 * project's chosen run time (per-tenant: frequency + UTC hour + day of week),
 * then queues a scan and dispatches the workflow. Pure Zero-Stack recurring job.
 *
 * Protected by CRON_SECRET (Vercel sends it as a Bearer token automatically).
 */

const DEFAULT_TOOLS: ScanTool[] = ["semgrep", "gitleaks", "trivy"]
const DEDUP_MS = 23 * 60 * 60 * 1000 // never run the same project twice within 23h

async function dispatch(repoFullName: string, scanId: string, tools: ScanTool[], targetUrl: string | null, token: string) {
  const [owner, repo] = repoFullName.split("/")
  if (!owner || !repo) return false
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
      body: JSON.stringify({ ref: "main", inputs: { scan_id: scanId, tools: tools.join(","), target_url: targetUrl ?? "" } }),
    },
  )
  return res.ok
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const hourUtc = now.getUTCHours()
  const dow = now.getUTCDay()

  let candidates: {
    id: string; userId: string; repoFullName: string; targetUrl: string | null
    scanFrequency: string; scanHourUtc: number; scanDayOfWeek: number
    scheduledTools: ScanTool[] | null; lastScheduledAt: Date | null
  }[] = []

  try {
    candidates = await db
      .select({
        id: projects.id,
        userId: projects.userId,
        repoFullName: projects.repoFullName,
        targetUrl: projects.targetUrl,
        scanFrequency: projects.scanFrequency,
        scanHourUtc: projects.scanHourUtc,
        scanDayOfWeek: projects.scanDayOfWeek,
        scheduledTools: projects.scheduledTools,
        lastScheduledAt: projects.lastScheduledAt,
      })
      .from(projects)
      .where(eq(projects.scanScheduleEnabled, true))
  } catch (err) {
    console.error("[cron] Failed to load scheduled projects:", err)
    return NextResponse.json({ error: "Database unreachable" }, { status: 503 })
  }

  const results: { project: string; queued: boolean; dispatched: boolean }[] = []

  for (const p of candidates) {
    // Is this the project's chosen hour?
    if (p.scanHourUtc !== hourUtc) continue
    if (p.scanFrequency === "weekly" && p.scanDayOfWeek !== dow) continue
    // De-dup guard: don't re-run within 23h
    if (p.lastScheduledAt && now.getTime() - p.lastScheduledAt.getTime() < DEDUP_MS) continue

    const tools = p.scheduledTools && p.scheduledTools.length > 0 ? p.scheduledTools : DEFAULT_TOOLS

    let scanId: string | null = null
    try {
      const [scan] = await db
        .insert(scans)
        .values({ projectId: p.id, userId: p.userId, tools, status: "queued", trigger: "schedule" })
        .returning({ id: scans.id })
      scanId = scan?.id ?? null
    } catch (err) {
      console.error(`[cron] Queue failed for ${p.repoFullName}:`, err)
      results.push({ project: p.repoFullName, queued: false, dispatched: false })
      continue
    }

    let token: string | null = null
    try {
      const [acct] = await db
        .select({ access_token: accounts.access_token })
        .from(accounts)
        .where(eq(accounts.userId, p.userId))
        .limit(1)
      token = acct?.access_token ?? process.env.GITHUB_TOKEN ?? null
    } catch { /* fall through */ }

    let dispatched = false
    if (scanId && token) {
      try { dispatched = await dispatch(p.repoFullName, scanId, tools, p.targetUrl, token) }
      catch (err) { console.error(`[cron] Dispatch failed for ${p.repoFullName}:`, err) }
    }

    try { await db.update(projects).set({ lastScheduledAt: now }).where(eq(projects.id, p.id)) }
    catch { /* non-fatal */ }

    results.push({ project: p.repoFullName, queued: !!scanId, dispatched })
  }

  return NextResponse.json({ ok: true, checkedHourUtc: hourUtc, eligible: candidates.length, ran: results.length, results })
}