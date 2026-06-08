import type { Metadata } from "next"
import { auth } from "@/auth"
import { getUserProjects } from "@/lib/db/queries"
import { ScanLauncher } from "@/components/dashboard/ScanLauncher"

export const metadata: Metadata = { title: "Scans" }

export default async function ScansPage() {
  const session = await auth()
  const userId = session!.user.id
  const isGitHubUser = !!session?.user?.login

  let projects: any[] = []
  try {
    projects = await getUserProjects(userId)
  } catch { /* Aurora offline */ }

  const hasProjects = projects.length > 0

  return (
    <div className="p-8 max-w-[900px] mx-auto">

      {/* Header */}
      <div className="mb-8 pb-6 border-b border-white/10">
        <p className="text-[11px] font-mono uppercase tracking-[0.08em] text-[#444444] mb-1.5">
          SCANS
        </p>
        <h1 className="text-[26px] font-semibold text-white" style={{ letterSpacing: "-1.04px" }}>
          Security Scans
        </h1>
        <p className="text-[14px] text-[#666666] mt-1" style={{ letterSpacing: "-0.28px" }}>
          Orchestrate up to 20 SAST, DAST, and secrets scanners on any repository.
        </p>
      </div>

      {/* GitHub connect banner — only for non-GitHub users */}
      {!isGitHubUser && (
        <div className="mb-6 flex items-center gap-4 px-5 py-4 rounded-[10px] border border-white/10 bg-white/[0.02]">
          <div className="w-9 h-9 rounded-[8px] bg-white/[0.05] border border-white/10 flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-[13px] text-white font-medium" style={{ letterSpacing: "-0.26px" }}>
              Connect GitHub to import repositories
            </p>
            <p className="text-[12px] text-[#555555] mt-0.5">
              Link your GitHub account to automatically import repos and trigger scans on push.
            </p>
          </div>
          <a
            href="/api/connect/github"
            className="flex items-center gap-2 h-9 px-4 rounded-[8px] border border-white/15 text-[13px] text-white hover:bg-white/5 transition-colors flex-shrink-0"
            style={{ letterSpacing: "-0.26px" }}
          >
            Connect GitHub →
          </a>
        </div>
      )}

      {/* Empty state — no projects */}
      {!hasProjects ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-4 border border-white/10 rounded-[12px] bg-white/[0.01]">
          <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center text-[20px]">
            ⬡
          </div>
          <div>
            <p className="text-[16px] font-semibold text-white mb-1" style={{ letterSpacing: "-0.48px" }}>
              Create your first project
            </p>
            <p className="text-[13px] text-[#555555] max-w-[340px]">
              Enter a repository below to set up your first security project and run your first scan.
            </p>
          </div>
          <div className="w-full max-w-[600px] mt-4">
            <ScanLauncher projects={[]} />
          </div>
        </div>
      ) : (
        <ScanLauncher projects={projects} />
      )}
    </div>
  )
}