import { redirect } from "next/navigation"
import { auth, signIn } from "@/auth"

/**
 * GET /api/connect/github
 * Links a GitHub account to the currently signed-in session.
 */
export async function GET() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  await signIn("github", { redirectTo: "/dashboard/settings" })
}