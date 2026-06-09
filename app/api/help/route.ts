import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"

export const runtime = "nodejs"

/**
 * POST /api/help
 * Receives a help request and logs/emails it.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { subject, description, category } = await req.json() as {
    subject: string
    description: string
    category: string
  }

  if (!subject?.trim() || !description?.trim()) {
    return NextResponse.json({ error: "Subject and description required" }, { status: 400 })
  }

  console.log("[help]", {
    userId: session.user.id,
    email: session.user.email,
    category,
    subject,
    description,
    at: new Date().toISOString(),
  })

  return NextResponse.json({ ok: true })
}