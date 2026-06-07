import type { Metadata } from "next"
import Link from "next/link"
import { OculsMark } from "@/components/ui/icons"
import { AuthForm } from "@/components/auth/AuthForm"

export const metadata: Metadata = {
  title: "Sign In — Oculs.io",
  description: "Sign in to your Oculs.io security console.",
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#000000] flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden="true"
      />

      {/* Radial glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-[400px]">
        <div className="bg-[#0a0a0a] border border-white/10 rounded-[16px] p-8 flex flex-col items-center gap-7 shadow-[0_0_60px_-20px_rgba(255,255,255,0.06)]">

          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 hover:opacity-75 transition-opacity"
            aria-label="Oculs.io home"
          >
            <OculsMark size={28} className="text-white" />
            <span
              className="text-[20px] font-semibold text-white"
              style={{ letterSpacing: "-0.6px" }}
            >
              oculs.io
            </span>
          </Link>

          {/* Headline */}
          <div className="text-center flex flex-col gap-2">
            <h1
              className="text-[18px] font-semibold text-white"
              style={{ letterSpacing: "-0.54px" }}
            >
              Sign in to your security console
            </h1>
            <p
              className="text-[13px] leading-5 text-[#666666]"
              style={{ letterSpacing: "-0.26px" }}
            >
              Monitor vulnerabilities, review AI&#8209;generated patches, and ship with confidence.
            </p>
          </div>

          {/* Auth */}
          <AuthForm />

          {/* Legal */}
          <p className="text-center text-[11px] font-mono text-[#444444] leading-5">
            By continuing you agree to our{" "}
            <Link
              href="/terms"
              className="text-[#666666] hover:text-[#a1a1aa] transition-colors underline underline-offset-2"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="text-[#666666] hover:text-[#a1a1aa] transition-colors underline underline-offset-2"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        {/* Back to landing */}
        <p className="mt-6 text-center text-[12px] font-mono text-[#444444]">
          <Link href="/" className="hover:text-[#a1a1aa] transition-colors">
            ← Back to oculs.io
          </Link>
        </p>
      </div>
    </div>
  )
}
