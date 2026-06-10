import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { auth } from "@/auth"
import { getProjectSettings } from "@/lib/db/queries"
import { ScheduleSettings } from "@/components/dashboard/ScheduleSettings"

export const metadata: Metadata = { title: "Project Settings" }

export default async function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const userId = session!.user.id

  const settings = await getProjectSettings(id, userId)
  if (!settings) notFound()

  return (
    <div className="p-8 max-w-[640px] mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/projects"
          className="text-[12px] font-mono text-[#555555] hover:text-white transition-colors">
          ← Projects
        </Link>
        <h1 className="text-[20px] font-semibold text-white mt-3" style={{ letterSpacing: "-0.6px" }}>
          {settings.name}
        </h1>
        <p className="text-[13px] font-mono text-[#555555] mt-1">{settings.repoFullName}</p>
      </div>

      <ScheduleSettings settings={settings} />
    </div>
  )
}