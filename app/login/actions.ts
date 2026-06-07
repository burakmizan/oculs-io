"use server"

import { AuthError } from "next-auth"
import { signIn } from "@/auth"
import { getUserByEmail, createCredentialsUser } from "@/lib/db/queries"
import { hashPassword } from "@/lib/auth/password"
import type { AuthActionState } from "@/types"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const REDIRECT_TO = "/dashboard"

/** OAuth — bounced straight to GitHub. */
export async function signInWithGitHub() {
  await signIn("github", { redirectTo: REDIRECT_TO })
}

/** Passwordless — sends a Resend magic link; caller shows "check your inbox". */
export async function signInWithEmail(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim()
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." }

  try {
    await signIn("resend", { email, redirect: false, redirectTo: REDIRECT_TO })
    return { ok: true }
  } catch (error) {
    if (isRedirectError(error)) throw error
    return { error: "Could not send magic link. Please try again." }
  }
}

/** Email + password sign-in. */
export async function signInWithCredentials(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!email || !password) {
    return { error: "Enter your email and password." }
  }

  try {
    await signIn("credentials", { email, password, redirectTo: REDIRECT_TO })
    return { ok: true }
  } catch (error) {
    // signIn throws a redirect on success — let Next handle it.
    if (isRedirectError(error)) throw error
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." }
    }
    throw error
  }
}

/** Register a new Credentials account, then sign in. */
export async function registerAccount(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const name = String(formData.get("name") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!name) return { error: "Enter your name." }
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." }
  }

  try {
    const existing = await getUserByEmail(email)
    if (existing) {
      return { error: "An account with this email already exists." }
    }

    const passwordHash = await hashPassword(password)
    await createCredentialsUser({ name, email, passwordHash })

    await signIn("credentials", { email, password, redirectTo: REDIRECT_TO })
    return { ok: true }
  } catch (error) {
    if (isRedirectError(error)) throw error
    if (error instanceof AuthError) {
      return { error: "Could not sign you in. Please try again." }
    }
    // Most likely the database is unreachable in local dev.
    return { error: "Unable to reach the account service. Try again shortly." }
  }
}

/** Next.js signals redirects by throwing an error with this digest. */
function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  )
}
