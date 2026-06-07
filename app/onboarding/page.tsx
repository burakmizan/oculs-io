import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { hasCompletedOnboarding } from "@/lib/db/queries"
import { OculsMark } from "@/components/ui/icons"
import { OnboardingWizard } from "./_wizard"

export const metadata: Metadata = {
  title: "Setup — Oculs.io",
  description: "Configure your Oculs.io security workspace.",
}

export default async function OnboardingPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  // Skip onboarding if already completed (e.g., user navigated back).
  try {
    const done = await hasCompletedOnboarding(session.user.id)
    if (done) redirect("/dashboard")
  } catch {
    // DB offline in local dev — show the wizard anyway.
  }

  const userName = session.user.name ?? session.user.login ?? ""
  const userLogin = session.user.login ?? ""

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-[#000000]">
      <div className="w-full max-w-[480px]">
        <div className="border-y border-white/10 p-10 flex flex-col gap-7">

          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 hover:opacity-75 transition-opacity self-start"
            aria-label="Oculs.io home"
          >
            <OculsMark size={18} className="text-white" />
            <span
              className="text-[14px] font-semibold text-white"
              style={{ letterSpacing: "-0.36px" }}
            >
              oculs.io
            </span>
          </Link>

          {/* Headline */}
          <div className="flex flex-col gap-1.5">
            <h1
              className="text-[20px] font-semibold text-white"
              style={{ letterSpacing: "-0.8px" }}
            >
              Let&apos;s get you set up
            </h1>
            <p
              className="text-[13px] text-[#666666]"
              style={{ letterSpacing: "-0.26px" }}
            >
              Three quick steps to configure your security workspace.
            </p>
          </div>

          {/* Wizard */}
          <OnboardingWizard
            defaultWorkspaceName={userName}
            userLogin={userLogin}
          />
        </div>

        <p className="mt-6 text-center text-[11px] font-mono text-[#333333]">
          Already have an account?{" "}
          <Link href="/login" className="text-[#555555] hover:text-[#a1a1aa] transition-colors">
            Sign in →
          </Link>
        </p>
      </div>
    </div>
  )
}
