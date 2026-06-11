import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { scans } from "@/lib/db/schema"

export const runtime = "nodejs"

/**
 * GET /api/scan/[scanId]/status
 * Lightweight polling endpoint for real scan progress.
 * Returns the scan's status, vulnerabilitiesCount and summary from Aurora,
 * scoped to the authenticated user.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ scanId: string }> },
): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { scanId } = await params

  try {
    const [scan] = await db
      .select({
        status: scans.status,
        vulnerabilitiesCount: scans.vulnerabilitiesCount,
        summary: scans.summary,
      })
      .from(scans)
      .where(and(eq(scans.id, scanId), eq(scans.userId, session.user.id)))
      .limit(1)

    if (!scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 })
    }

    return NextResponse.json(scan)
  } catch (err) {
    console.error("[scan-status] Lookup failed:", err)
    return NextResponse.json({ error: "Database unreachable" }, { status: 503 })
  }
}
