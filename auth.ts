import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Resend from "next-auth/providers/resend"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { authConfig } from "@/auth.config"
import { db } from "@/lib/db"
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/lib/db/schema"
import { getUserByEmail } from "@/lib/db/queries"
import { verifyPassword } from "@/lib/auth/password"

/**
 * Full Node-runtime Auth.js instance.
 *
 * Extends the edge-safe `authConfig` with:
 *   - the Drizzle adapter, so OAuth users are persisted to Aurora;
 *   - a Resend Email provider for passwordless magic-link sign-in;
 *   - a Credentials provider backed by bcrypt-hashed passwords (demo/judge fallback).
 *
 * Session strategy stays JWT (inherited from authConfig) — mandatory when a
 * Credentials provider is present.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    ...authConfig.providers,
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.EMAIL_FROM ?? "noreply@oculs.io",
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email
        const password = credentials?.password
        if (typeof email !== "string" || typeof password !== "string") {
          return null
        }

        const user = await getUserByEmail(email)
        // No account, or an OAuth-only account without a password set.
        if (!user?.passwordHash) return null

        const valid = await verifyPassword(password, user.passwordHash)
        if (!valid) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        }
      },
    }),
  ],
  callbacks: {
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
    }
  }
})
