import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/auth"
import { getUserProjects } from "@/lib/db/queries"

export const metadata: Metadata = { title: "Projects" }

export default async function ProjectsPage() {
  const session = await auth()
  const userId = session!.user.id

  let projects: { id: string; repoFullName: string; targetUrl: string | null }[] = []
  try {
    projects = await getUserProjects(userId)
  } catch { /* Aurora offline */ }

  return (
    <div className="p-8 max-w-[900px] mx-auto">

      <div className="mb-6 flex items-center justify-between">
        <p className="text-[14px] text-[#666666]" style={{ letterSpacing: "-0.28px" }}>
          Repositories connected to Oculs.io for security scanning.
        </p>
        <Link
          href="/dashboard/projects/new"
          className="flex items-center gap-2 h-9 px-4 rounded-[8px] bg-white text-black text-[13px] font-medium
                     hover:bg-white/90 transition-colors"
          style={{ letterSpacing: "-0.26px" }}
        >
          + New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-28 text-center gap-4
                        border border-white/10 rounded-[16px] bg-white/[0.01]">
          <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/10
                          flex items-center justify-center text-[20px]">
            ⬡
          </div>
          <div>
            <p className="text-[16px] font-semibold text-white mb-1" style={{ letterSpacing: "-0.48px" }}>
              No projects yet
            </p>
            <p className="text-[13px] text-[#555555] max-w-[320px]">
              Connect a GitHub repository to start scanning for vulnerabilities.
            </p>
          </div>
          <Link
            href="/dashboard/projects/new"
            className="mt-2 flex items-center gap-2 h-9 px-4 rounded-[8px] bg-white text-black
                       text-[13px] font-medium hover:bg-white/90 transition-colors"
            style={{ letterSpacing: "-0.26px" }}
          >
            Create First Project
          </Link>
        </div>
      ) : (
        /* Project list */
        <div className="flex flex-col gap-2">
          {projects.map((p) => {
            const [owner, repo] = p.repoFullName.split("/")
            return (
              <div
                key={p.id}
                className="flex items-center gap-4 px-5 py-4 rounded-[12px] border border-white/10
                           bg-white/[0.02] hover:bg-white/[0.03] transition-colors"
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-[8px] bg-white/[0.05] border border-white/10
                                flex items-center justify-center flex-shrink-0">
                  <span className="text-[13px] font-mono text-[#a1a1aa]">
                    {owner?.[0]?.toUpperCase() ?? "R"}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-mono text-white truncate" style={{ letterSpacing: "-0.14px" }}>
                    <span className="text-[#666666]">{owner}/</span>{repo}
                  </p>
                  {p.targetUrl && (
                    <p className="text-[11px] text-[#444444] truncate mt-0.5 font-mono">
                      {p.targetUrl}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link
                    href={`/dashboard/scans?repo=${encodeURIComponent(p.repoFullName)}`}
                    className="h-8 px-3 rounded-[6px] border border-white/10 text-[12px] text-[#a1a1aa]
                               hover:bg-white/5 hover:text-white transition-colors"
                  >
                    Scan →
                  </Link>
                  <a
                    href={`https://github.com/${p.repoFullName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-8 px-3 rounded-[6px] border border-white/10 text-[12px] text-[#555555]
                               hover:text-[#a1a1aa] transition-colors"
                  >
                    GitHub ↗
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}