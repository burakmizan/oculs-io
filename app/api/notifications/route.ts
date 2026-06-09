import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { scans, projects } from "@/lib/db/schema"
import { eq, desc, gte } from "drizzle-orm"

export const runtime = "nodejs"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ notifications: [] }, { status: 401 })
  }

  try {
    // Get recent completed/failed scans as notifications
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // last 7 days
    const recentScans = await db
      .select({
        id: scans.id,
        status: scans.status,
        vulnerabilitiesCount: scans.vulnerabilitiesCount,
        completedAt: scans.completedAt,
        repoFullName: projects.repoFullName,
      })
      .from(scans)
      .innerJoin(projects, eq(scans.projectId, projects.id))
      .where(eq(scans.userId, session.user.id))
      .orderBy(desc(scans.completedAt))
      .limit(10)

    const notifications = recentScans
      .filter(s => s.status === "completed" || s.status === "failed")
      .map(s => ({
        id: s.id,
        type: s.status === "failed" ? "error" : s.vulnerabilitiesCount > 0 ? "warning" : "success",
        title: s.status === "failed"
          ? `Scan failed — ${s.repoFullName}`
          : `Scan complete — ${s.repoFullName}`,
        body: s.status === "failed"
          ? "The scan encountered an error. Check logs."
          : `${s.vulnerabilitiesCount} finding${s.vulnerabilitiesCount !== 1 ? "s" : ""} detected.`,
        href: `/dashboard/report/${s.id}`,
        time: s.completedAt,
        read: false,
      }))

    return NextResponse.json({ notifications })
  } catch {
    return NextResponse.json({ notifications: [] })
  }
}