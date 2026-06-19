import { NextRequest, NextResponse } from "next/server"
import { createHash, randomBytes } from "node:crypto"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { apiKeys } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getUserApiKeys } from "@/lib/db/queries"

export const runtime = "nodejs"

export async function GET(): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const keys = await getUserApiKeys(session.user.id)
  return NextResponse.json({ keys })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name } = await req.json() as { name?: string }
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 })

  const raw = "oculs_" + randomBytes(24).toString("hex")
  const hash = createHash("sha256").update(raw).digest("hex")
  const suffix = raw.slice(-8)

  const [row] = await db
    .insert(apiKeys)
    .values({ userId: session.user.id, name: name.trim(), keyHash: hash, keySuffix: suffix })
    .returning({ id: apiKeys.id, createdAt: apiKeys.createdAt })

  return NextResponse.json({ id: row.id, key: raw, name: name.trim(), keySuffix: suffix, createdAt: row.createdAt })
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await req.json() as { id?: string }
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  await db.delete(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, session.user.id)))
  return NextResponse.json({ ok: true })
}
