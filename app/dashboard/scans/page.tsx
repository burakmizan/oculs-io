import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/auth"
import { getUserProjectsWithStatus, type ProjectWithStatus } from "@/lib/db/queries"
import { ScanModal } from "@/components/dashboard/ScanModal"

export const metadata: Metadata = { title: "Scans" }

export default async function ScansPage() {
  const session = await auth()
  const userId = session!.user.id

  let projects: ProjectWithStatus[] = []
  try {
    projects = await getUserProjectsWithStatus(userId)
  } catch { /* Aurora offline */ }

  if (projects.length === 0) {
    return (
      <div className="p-8 max-w-[900px] mx-auto">
        <div className="mb-6">
          <p className="text-[14px] text-[#666666]" style={{ letterSpacing: "-0.28px" }}>
            Select a project to start a security scan.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center gap-6
                        border border-white/10 rounded-[16px] bg-white/[0.01]">
          <div className="flex flex-col gap-4 w-full max-w-[360px] text-left px-6">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full border border-white/20
                               flex items-center justify-center text-[10px] font-mono text-[#666666]">1</span>
              <div>
                <Link href="/dashboard/projects/new"
                  className="text-[13px] font-medium text-white hover:text-[#a1a1aa] transition-colors">
                  Connect a repository →
                </Link>
                <p className="text-[11px] text-[#555555] mt-0.5">Link a GitHub repo to create your first project.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full border border-white/20
                               flex items-center justify-center text-[10px] font-mono text-[#555555]">2</span>
              <div>
                <p className="text-[13px] font-medium text-[#666666]">Configure your scan</p>
                <p className="text-[11px] text-[#555555] mt-0.5">Choose SAST and DAST tools to match your stack.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full border border-white/20
                               flex items-center justify-center text-[10px] font-mono text-[#555555]">3</span>
              <div>
                <p className="text-[13px] font-medium text-[#666666]">Get your security report</p>
                <p className="text-[11px] text-[#555555] mt-0.5">Results with severity, OWASP mapping, and AI fixes.</p>
              </div>
            </div>
          </div>
          <Link
            href="/dashboard/projects/new"
            className="mt-2 h-9 px-4 rounded-[8px] bg-white text-black text-[13px] font-medium
                       hover:bg-white/90 transition-colors"
            style={{ letterSpacing: "-0.26px" }}
          >
            Create First Project
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-[900px] mx-auto">
      <div className="mb-6">
        <p className="text-[14px] text-[#666666]" style={{ letterSpacing: "-0.28px" }}>
          Select a project and configure your security scan.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {projects.map(p => (
          <ScanModal key={p.id} project={p} />
        ))}
      </div>
    </div>
  )
}