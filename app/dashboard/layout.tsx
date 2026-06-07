import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { Sidebar } from "@/components/dashboard/Sidebar"

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

  return (
    <div className="flex h-screen bg-[#000000] overflow-hidden">
      <Sidebar user={session.user} />
      <main className="flex-1 overflow-auto bg-[#000000]">
        {children}
      </main>
    </div>
  )
}
