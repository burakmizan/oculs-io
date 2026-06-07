"use client"

import { useActionState, useState } from "react"
import { GitHub } from "@/components/ui/icons"
import {
  signInWithCredentials,
  signInWithEmail,
  signInWithGitHub,
} from "@/app/login/actions"
import type { AuthActionState } from "@/types"

type Mode = "signin" | "register"

const INITIAL: AuthActionState = {}

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("signin")

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Segmented mode toggle */}
      <div
        className="grid grid-cols-2 gap-1 p-1 rounded-[8px] bg-white/[0.03] border border-white/10"
        role="tablist"
        aria-label="Authentication mode"
      >
        <SegButton active={mode === "signin"} onClick={() => setMode("signin")}>
          Sign in
        </SegButton>
        <SegButton
          active={mode === "register"}
          onClick={() => setMode("register")}
        >
          Create account
        </SegButton>
      </div>

      {mode === "signin" ? <SignInView /> : <RegisterView />}
    </div>
  )
}

/* ── Sign In View ─────────────────────────────────────────────────── */

function SignInView() {
  const [isPasswordMode, setIsPasswordMode] = useState(false)

  if (isPasswordMode) {
    return <CredentialsSignInForm onBack={() => setIsPasswordMode(false)} />
  }
  return <MagicLinkSignInForm onPasswordMode={() => setIsPasswordMode(true)} />
}

function MagicLinkSignInForm({
  onPasswordMode,
}: {
  onPasswordMode: () => void
}) {
  const [state, action, pending] = useActionState(signInWithEmail, INITIAL)

  if (state.ok) return <CheckInboxMessage />

  return (
    <div className="flex flex-col gap-4">
      <GitHubButton />
      <Divider />
      <form action={action} className="flex flex-col gap-3">
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
        />
        <ErrorLine message={state.error} />
        <SubmitButton pending={pending}>Send Magic Link</SubmitButton>
      </form>
      <button
        type="button"
        onClick={onPasswordMode}
        className="self-center text-[12px] font-mono text-[#444444] hover:text-[#a1a1aa] transition-colors"
        style={{ letterSpacing: "-0.24px" }}
      >
        Continue with password →
      </button>
    </div>
  )
}

function CredentialsSignInForm({ onBack }: { onBack: () => void }) {
  const [state, action, pending] = useActionState(
    signInWithCredentials,
    INITIAL,
  )

  return (
    <div className="flex flex-col gap-4">
      <GitHubButton />
      <Divider />
      <form action={action} className="flex flex-col gap-3">
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
        <ErrorLine message={state.error} />
        <SubmitButton pending={pending}>Sign in</SubmitButton>
      </form>
      <button
        type="button"
        onClick={onBack}
        className="self-center text-[12px] font-mono text-[#444444] hover:text-[#a1a1aa] transition-colors"
        style={{ letterSpacing: "-0.24px" }}
      >
        ← Use magic link instead
      </button>
    </div>
  )
}

/* ── Register View ────────────────────────────────────────────────── */

function RegisterView() {
  const [isEmailMode, setIsEmailMode] = useState(false)
  const [state, action, pending] = useActionState(signInWithEmail, INITIAL)

  if (state.ok) return <CheckInboxMessage />

  return (
    <div className="flex flex-col gap-4">
      <GitHubButton />
      <Divider />
      {!isEmailMode ? (
        <button
          type="button"
          onClick={() => setIsEmailMode(true)}
          className="w-full inline-flex items-center justify-center h-11 px-5
                     text-[14px] font-medium text-[#a1a1aa]
                     border border-white/10 rounded-[8px]
                     hover:bg-white/[0.04] hover:text-white
                     transition-colors
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          style={{ letterSpacing: "-0.28px" }}
        >
          Continue with Email →
        </button>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            required
          />
          <ErrorLine message={state.error} />
          <SubmitButton pending={pending}>Send Magic Link</SubmitButton>
        </form>
      )}
    </div>
  )
}

/* ── Shared sub-components ────────────────────────────────────────── */

function CheckInboxMessage() {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <div
        className="w-9 h-9 rounded-full bg-white/[0.05] border border-white/10
                      flex items-center justify-center text-[16px]"
      >
        ✉
      </div>
      <p
        className="text-[14px] font-medium text-white"
        style={{ letterSpacing: "-0.28px" }}
      >
        Check your inbox
      </p>
      <p className="text-[12px] font-mono text-[#666666] leading-5">
        We sent a magic link to your email.
        <br />
        Click it to sign in instantly.
      </p>
    </div>
  )
}

function GitHubButton() {
  return (
    <form action={signInWithGitHub} className="w-full">
      <button
        type="submit"
        className="w-full inline-flex items-center justify-center gap-3 h-11 px-5
                   text-[14px] font-medium text-white bg-white/[0.04]
                   border border-white/10 rounded-[8px]
                   hover:bg-white/[0.08] active:bg-white/[0.06]
                   transition-colors
                   focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        style={{ letterSpacing: "-0.28px" }}
      >
        <GitHub size={16} />
        Continue with GitHub
      </button>
    </form>
  )
}

function Divider() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <div className="flex-1 h-px bg-white/10" />
      <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-[#444444]">
        or
      </span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  )
}

/* ── Primitives ───────────────────────────────────────────────────── */

function SegButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`h-8 rounded-[6px] text-[13px] font-medium transition-colors
        ${
          active
            ? "bg-white/[0.07] text-white"
            : "text-[#666666] hover:text-[#a1a1aa]"
        }`}
      style={{ letterSpacing: "-0.26px" }}
    >
      {children}
    </button>
  )
}

function Field({
  label,
  name,
  ...props
}: {
  label: string
  name: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#666666]">
        {label}
      </span>
      <input
        name={name}
        {...props}
        className="h-10 px-3 rounded-[8px] bg-white/[0.02] border border-white/10
                   text-[14px] text-white placeholder:text-[#444444]
                   focus:border-white/25 focus:bg-white/[0.04]
                   focus-visible:outline-none
                   transition-colors"
        style={{ letterSpacing: "-0.28px" }}
      />
    </label>
  )
}

function ErrorLine({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p
      className="text-[12px] text-[#f87171] flex items-center gap-1.5"
      role="alert"
      style={{ letterSpacing: "-0.24px" }}
    >
      <span
        className="inline-block w-1 h-1 rounded-full bg-[#f87171]"
        aria-hidden="true"
      />
      {message}
    </p>
  )
}

function SubmitButton({
  pending,
  children,
}: {
  pending: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 w-full inline-flex items-center justify-center gap-2 h-11 px-5
                 text-[14px] font-medium text-black bg-white rounded-[8px]
                 hover:bg-[#e5e5e5] active:bg-[#d4d4d4]
                 disabled:opacity-60 disabled:cursor-not-allowed
                 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.3)]
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      style={{ letterSpacing: "-0.28px" }}
    >
      {pending ? "Working…" : children}
    </button>
  )
}
