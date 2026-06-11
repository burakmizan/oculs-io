import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { hasCompletedOnboarding, getUserProjects } from "@/lib/db/queries"
import { Sidebar } from "@/components/dashboard/Sidebar"
import { TopBar } from "@/components/dashboard/TopBar"
import { PersistentScanProgress } from "@/components/dashboard/PersistentScanProgress"
import { CommandPalette } from "@/components/dashboard/CommandPalette"

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
      <Sidebar user={session.user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto bg-[#000000]">
          {children}
        </main>
        <PersistentScanProgress />
      </div>
      <CommandPalette projects={paletteProjects} />
    </div>
  )
}
