import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"

export const runtime = "nodejs"

/**
 * POST /api/feedback
 * Stores feedback in Aurora and optionally sends a notification.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { topic, message, rating } = await req.json() as {
    topic: string
    message: string
    rating: string
  }

  if (!message?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 })
  }

  // Log to console — in production replace with DB insert or email
  console.log("[feedback]", {
    userId: session.user.id,
    email: session.user.email,
    topic,
    message,
    rating,
    at: new Date().toISOString(),
  })

  return NextResponse.json({ ok: true })
}