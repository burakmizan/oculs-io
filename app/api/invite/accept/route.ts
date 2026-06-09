import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { teamInvites, teamMembers } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { auth } from "@/auth"
import { cookies } from "next/headers"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get("token")

  if (!token) {
    return NextResponse.json({ error: "Missing invitation token" }, { status: 400 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    // Redirect to login if unauthenticated, carrying the invitation token forward
    return NextResponse.redirect(new URL(`/login?callbackUrl=/api/invite/accept?token=${token}`, req.url))
  }

  try {
    // Verify token validity and expiration status
    const [invite] = await db
      .select()
      .from(teamInvites)
      .where(and(eq(teamInvites.token, token), eq(teamInvites.status, "pending")))
      .limit(1)

    if (!invite || invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invalid or expired invitation token" }, { status: 410 })
    }

    // Single-use token logic: update status to accepted
    await db
      .update(teamInvites)
      .set({ status: "accepted" })
      .where(eq(teamInvites.id, invite.id))

    // Add current user to team members
    await db.insert(teamMembers).values({
      teamId: invite.teamId,
      userId: session.user.id,
      role: "member"
    })

    // Update active team state via cookies
    const cookieStore = await cookies()
    cookieStore.set("active_team_id", invite.teamId)

    // Redirect to the dashboard scoped to the new team
    return NextResponse.redirect(new URL("/dashboard", req.url))
  } catch (err) {
    console.error("Failed to accept invitation:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}