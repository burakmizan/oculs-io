import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
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
 *   - a Credentials provider backed by bcrypt-hashed passwords.
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
})
