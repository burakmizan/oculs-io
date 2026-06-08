import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/auth"
import { getUserProjects } from "@/lib/db/queries"
import { ScanModal } from "@/components/dashboard/ScanModal"

export const metadata: Metadata = { title: "Scans" }

export default async function ScansPage() {
  const session = await auth()
  const userId = session!.user.id

  let projects: { id: string; name: string; repoFullName: string; targetUrl: string | null }[] = []
  try {
    projects = await getUserProjects(userId)
  } catch { /* Aurora offline */ }

  if (projects.length === 0) {
    return (
      <div className="p-8 max-w-[900px] mx-auto">
        <div className="mb-6">
          <p className="text-[14px] text-[#666666]" style={{ letterSpacing: "-0.28px" }}>
            Select a project to start a security scan.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-28 text-center gap-4
                        border border-white/10 rounded-[16px] bg-white/[0.01]">
          <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/10
                          flex items-center justify-center text-[20px]">⬡</div>
          <div>
            <p className="text-[16px] font-semibold text-white mb-1" style={{ letterSpacing: "-0.48px" }}>
              No projects yet
            </p>
            <p className="text-[13px] text-[#555555] max-w-[300px]">
              Create a project first to connect a repository and run scans.
            </p>
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