import type { NextAuthConfig } from "next-auth"
import { type DefaultSession } from "next-auth"
import { type JWT } from "next-auth/jwt"
import GitHub from "next-auth/providers/github"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      login?: string
      githubAccessToken?: string
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    login?: string
    githubAccessToken?: string
  }
}

/**
 * Edge-safe Auth.js configuration.
 *
 * This module must NOT import the database, bcrypt, or the Drizzle adapter —
 * it is consumed by `proxy.ts` (the Next.js 16 middleware), which runs on the
 * Edge runtime. The Credentials provider and adapter are layered on top in
 * the Node-only `auth.ts`.
 */
export const authConfig = {
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "read:user user:email repo",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" as const },
  callbacks: {
    /** Route protection — evaluated by the proxy/middleware on every request. */
    authorized({ auth: session, request: { nextUrl } }) {
      const isLoggedIn = !!session?.user
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard")
      const isOnOnboarding = nextUrl.pathname === "/onboarding"

      // Both dashboard and onboarding require authentication.
      if (isOnDashboard || isOnOnboarding) return isLoggedIn

      // Redirect logged-in users away from login; whether they go to
      // /onboarding or /dashboard is decided by the dashboard layout (DB query).
      if (isLoggedIn && nextUrl.pathname === "/login") {
        return Response.redirect(new URL("/dashboard", nextUrl))
      }
      return true
    },
    jwt({ token, profile, account }) {
      const login = (profile as { login?: string } | undefined)?.login
      if (login) token.login = login
      if (account?.access_token) token.githubAccessToken = account.access_token
      return token
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub
      if (token.login) session.user.login = token.login as string
      if (token.githubAccessToken) session.user.githubAccessToken = token.githubAccessToken as string
      return session
    },
  },
} satisfies NextAuthConfig
