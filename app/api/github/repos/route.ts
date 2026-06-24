import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { accounts } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"

/**
 * GET /api/github/repos
 * Returns the authenticated user's GitHub repositories.
 * Requires GitHub OAuth with `repo` scope.
 */
export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const token = session.user.githubAccessToken
  if (!token) {
    return NextResponse.json({ error: "No GitHub token — connect GitHub first" }, { status: 403 })
  }

  // KESİN ÇÖZÜM: Çerezde hayalet token (ghost token) kalsa bile, veritabanından koparılmışsa erişimi reddet!
  const [githubAccount] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, session.user.id), eq(accounts.provider, "github")))
    .limit(1)

  if (!githubAccount) {
    return NextResponse.json({ error: "GitHub account disconnected" }, { status: 403 })
  }

  try {
    const res = await fetch(
      "https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        next: { revalidate: 60 }, // Cache for 60 seconds
      },
    )

    if (!res.ok) {
      return NextResponse.json({ error: "GitHub API error" }, { status: res.status })
    }

    const data = await res.json()
    const repos = data.map((r: { full_name: string; private: boolean; updated_at: string; language: string | null }) => ({
      fullName: r.full_name,
      private: r.private,
      updatedAt: r.updated_at,
      language: r.language,
    }))

    return NextResponse.json({ repos })
  } catch {
    return NextResponse.json({ error: "Failed to fetch repositories" }, { status: 500 })
  }
}