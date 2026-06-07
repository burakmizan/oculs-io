import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"

/**
 * Next.js 16 renamed `middleware` → `proxy`. This runs on the Edge runtime,
 * so it is built from the lightweight `authConfig` only (no DB / bcrypt).
 * The `authorized` callback enforces access to /dashboard/*.
 */
const { auth } = NextAuth(authConfig)

export default auth

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding", "/login"],
}
