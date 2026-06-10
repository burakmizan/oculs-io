import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/auth"
import { getUserProjects } from "@/lib/db/queries"
import { Code, CheckCircle2, AlertCircle, Edit2, GitCommit, Trash2, Settings } from "lucide-react"
import { deleteProject } from "./actions"
import { BadgeSnippet } from "@/components/dashboard/BadgeSnippet"

// Add name field to ProjectOption type usage

export const metadata: Metadata = { title: "Projects" }

export default async function ProjectsPage() {
  const session = await auth()
  const userId = session!.user.id

  let projects: { id: string; name: string; repoFullName: string; targetUrl: string | null }[] = []
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
          {projects.map((p, index) => {
            const [owner, repo] = p.repoFullName.split("/")
            
            // Dinamik status simülasyonu (Gerçek veriye göre 'isHealthy' değişkenini ayarlayabilirsin)
            const isHealthy = index % 3 !== 2 // Sırf sen testi gör diye 3 projeden 1'ini hatalı gibi gösteriyoruz
            const mockCommitHash = Math.random().toString(16).substring(2, 9)

            return (
              <div
                key={p.id}
                className="flex items-center gap-4 px-5 py-4 rounded-[12px] border border-white/10
                           bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300 group"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-[8px] bg-white/[0.05] border border-white/10
                                flex items-center justify-center flex-shrink-0 shadow-inner group-hover:border-white/20 transition-colors">
                  <span className="text-[14px] font-mono font-semibold text-[#a1a1aa]">
                    {owner?.[0]?.toUpperCase() ?? "R"}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1">
                    <Code size={14} className="text-white" />
                    <p className="text-[14px] font-mono text-white truncate" style={{ letterSpacing: "-0.14px" }}>
                      <span className="text-[#666666]">{owner}/</span>{repo}
                    </p>
                  </div>
                  
                  {p.targetUrl && (
                    <p className="text-[11px] text-[#666666] truncate mt-0.5 font-mono flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-[#50e3c2]"></span>
                      {p.targetUrl}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-3 text-[11px] font-mono text-[#555555] mt-1.5">
                    <span className="flex items-center gap-1.5">
                      <GitCommit size={12} className="text-[#888888]" />
                      main · <span className="text-[#a1a1aa]">{mockCommitHash}</span>
                    </span>
                    <span className="w-1 h-1 rounded-full bg-white/10"></span>
                    <span>Added 2 days ago</span>
                  </div>
                </div>

                {/* Status & Actions */}
                <div className="flex items-center gap-4 flex-shrink-0">
                  
                  {/* Dynamic Status Icon */}
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.02] border border-white/5 mr-2">
                    {isHealthy ? (
                      <CheckCircle2 size={16} className="text-[#4ade80]" />
                    ) : (
                      <AlertCircle size={16} className="text-[#f87171] animate-pulse" />
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/scans?repo=${encodeURIComponent(p.repoFullName)}`}
                      className="flex items-center justify-center h-8 px-4 rounded-[6px] border border-white/10 text-[12px] text-[#a1a1aa]
                                 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      Scan →
                    </Link>
                    <Link
                      href={`/dashboard/projects/${p.id}/edit?name=${encodeURIComponent(p.name ?? "")}&repoFullName=${encodeURIComponent(p.repoFullName)}&targetUrl=${encodeURIComponent(p.targetUrl ?? "")}`}
                      className="flex items-center justify-center gap-1.5 h-8 px-3 rounded-[6px] border border-white/10 text-[12px] text-[#555555]
                                 hover:text-[#a1a1aa] hover:bg-white/10 transition-colors"
                    >
                      <Edit2 size={12} />
                      Edit
                    </Link>

                    <Link
                      href={`/dashboard/projects/${p.id}/settings`}
                      className="flex items-center justify-center gap-1.5 h-8 px-3 rounded-[6px] border border-white/10 text-[12px] text-[#555555]
                                 hover:text-[#a1a1aa] hover:bg-white/10 transition-colors"
                    >
                      <Settings size={12} />
                      Settings
                    </Link>

                    <a
                      href={`https://github.com/${p.repoFullName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center w-8 h-8 rounded-[6px] border border-white/10 text-[12px] text-[#555555]
                                 hover:text-[#a1a1aa] transition-colors hover:bg-white/10"
                    >
                      ↗
                    </a>
                    
                    <div className="w-px h-6 bg-white/10 mx-1"></div>
                    
                    <form action={async () => {
                      "use server";
                      await deleteProject(p.id);
                    }}>
                      <button
                        type="submit"
                        className="flex items-center justify-center w-8 h-8 rounded-[6px] border border-red-500/20 text-[#f87171]
                                   hover:bg-red-500/10 transition-colors bg-red-500/5"
                        title="Delete Project"
                      >
                        <Trash2 size={13} />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}