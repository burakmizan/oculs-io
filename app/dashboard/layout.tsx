import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { hasCompletedOnboarding, getUserProjects, promoteStarterToPro } from "@/lib/db/queries"
import { Sidebar } from "@/components/dashboard/Sidebar"
import { TopBar } from "@/components/dashboard/TopBar"
import { PersistentScanProgress } from "@/components/dashboard/PersistentScanProgress"
import { CommandPalette } from "@/components/dashboard/CommandPalette"
import { WelcomeProModal } from "@/components/dashboard/WelcomeProModal"

export const metadata: Metadata = {
  title: {
    template: "%s — Oculs.io",
    default: "Dashboard — Oculs.io",
  },
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  // Launch promo: every account is Pro for free. Covers OAuth signups
  // (created with the schema-default "starter") and pre-promo accounts.
  // Idempotent — no write once the user is already Pro; a DB hiccup must
  // never block the dashboard. Capture the effective plan for the UI.
  let userPlan = "starter"
  try {
    userPlan = await promoteStarterToPro(session.user.id)
  } catch { /* non-fatal — UI falls back to Starter label */ }

  // Gate: unonboarded users must complete the wizard before using the dashboard.
  // Wrapped in try/catch so a DB outage doesn't lock users out.
  try {
    const onboarded = await hasCompletedOnboarding(session.user.id)
    if (!onboarded) redirect("/onboarding")
  } catch {
    // Aurora unreachable in local dev — proceed to the dashboard gracefully.
  }

  // Projects for the ⌘K command palette (navigation still works if this fails)
  let paletteProjects: { id: string; name?: string | null; repoFullName?: string | null }[] = []
  try {
    paletteProjects = await getUserProjects(session.user.id)
  } catch { /* Aurora offline — palette falls back to navigation only */ }

  return (
    <div className="flex h-screen bg-[#000000] overflow-hidden">
      <Sidebar user={session.user} plan={userPlan} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto bg-[#000000]">
          {children}
        </main>
        <PersistentScanProgress />
      </div>
      <CommandPalette projects={paletteProjects} />
      <WelcomeProModal />
    </div>
  )
}
