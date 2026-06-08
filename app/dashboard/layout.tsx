import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { hasCompletedOnboarding } from "@/lib/db/queries"
import { Sidebar } from "@/components/dashboard/Sidebar"
import { TopBar } from "@/components/dashboard/TopBar"

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

  return (
    <div className="flex h-screen bg-[#000000] overflow-hidden">
      <Sidebar user={session.user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto bg-[#000000]">
          {children}
        </main>
      </div>
    </div>
  )
}
