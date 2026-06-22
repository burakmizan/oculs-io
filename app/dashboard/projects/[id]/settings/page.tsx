import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { auth } from "@/auth"
import { getProjectSettings, getVulnerabilityTimeline, getProjectScanTimeline } from "@/lib/db/queries"
import { ScheduleSettings } from "@/components/dashboard/ScheduleSettings"
import { DangerZone } from "@/components/dashboard/DangerZone"
import { SecurityCardSnippet } from "@/components/dashboard/SecurityCardSnippet"
import { VulnerabilityTimeline } from "@/components/dashboard/VulnerabilityTimeline"

export const metadata: Metadata = { title: "Project Settings" }

export default async function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const userId = session!.user.id

  const [settings, timeline, scanTimeline] = await Promise.all([
    getProjectSettings(id, userId),
    getVulnerabilityTimeline(id, userId),
    getProjectScanTimeline(id, userId),
  ])
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

      {/* Vulnerability Timeline (feature 10) */}
      <div className="bg-white/[0.02] border border-white/10 rounded-[12px] mb-6">
        <div className="px-5 py-4 border-b border-white/[0.07]">
          <h2 className="text-[13px] font-mono uppercase tracking-[0.08em] text-[#a1a1aa]">Vulnerability Timeline</h2>
        </div>
        <VulnerabilityTimeline data={timeline} scanData={scanTimeline} />
      </div>

      {/* Security Score Card badge snippet (feature 6) */}
      {settings.badgePublic && (
        <div className="bg-white/[0.02] border border-white/10 rounded-[12px] mb-6">
          <div className="px-5 py-4 border-b border-white/[0.07]">
            <h2 className="text-[13px] font-mono uppercase tracking-[0.08em] text-[#a1a1aa]">Security Score Card</h2>
          </div>
          <div className="px-5 py-5">
            <p className="text-[12px] text-[#666666] mb-4">
              Add this badge to your README to show your project&apos;s live security grade.
              The badge links to a public score card with grade, risk score, and severity breakdown.
            </p>
            <SecurityCardSnippet projectId={id} />
          </div>
        </div>
      )}

      <ScheduleSettings settings={settings} />
      <DangerZone projectId={id} projectName={settings.name} />
    </div>
  )
}