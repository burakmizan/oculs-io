import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/auth"
import { getVulnerabilities, type VulnerabilityRow } from "@/lib/db/queries"

export const metadata: Metadata = { title: "Findings" }

const SEV_COLOR: Record<string, string> = {
  critical: "text-[#f87171] bg-[#f87171]/10 border-[#f87171]/20",
  high:     "text-[#fb923c] bg-[#fb923c]/10 border-[#fb923c]/20",
  medium:   "text-[#fbbf24] bg-[#fbbf24]/10 border-[#fbbf24]/20",
  low:      "text-[#60a5fa] bg-[#60a5fa]/10 border-[#60a5fa]/20",
  info:     "text-[#a1a1aa] bg-white/[0.04] border-white/10",
}

const SEV_ORDER = ["critical", "high", "medium", "low", "info"]

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`inline-flex items-center h-5 px-2 rounded-[4px] border text-[10px] font-mono uppercase tracking-[0.04em] ${SEV_COLOR[severity] ?? SEV_COLOR.info}`}>
      {severity}
    </span>
  )
}

export default async function FindingsPage() {
  const session = await auth()
  const userId = session!.user.id

  let vulns: VulnerabilityRow[] = []
  try {
    vulns = await getVulnerabilities(userId, 100)
  } catch { /* Aurora offline */ }

  // Group by severity for summary
  const counts = SEV_ORDER.reduce((acc, s) => {
    acc[s] = vulns.filter(v => v.severity === s).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="p-8 max-w-[1100px] mx-auto">
      <div className="mb-6">
        <p className="text-[14px] text-[#666666]" style={{ letterSpacing: "-0.28px" }}>
          All vulnerabilities detected across your repositories.
        </p>
      </div>

      {vulns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3
                        border border-white/10 rounded-[12px] bg-white/[0.01]">
          <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/10
                          flex items-center justify-center text-[16px]">△</div>
          <p className="text-[14px] text-white font-medium" style={{ letterSpacing: "-0.28px" }}>
            No findings yet
          </p>
          <p className="text-[12px] text-[#555555]">Run a scan to see vulnerabilities here.</p>
          <Link href="/dashboard/scans"
            className="mt-2 h-8 px-4 rounded-[6px] bg-white text-black text-[12px] font-medium
                       hover:bg-white/90 transition-colors">
            Go to Scans →
          </Link>
        </div>
      ) : (
        <>
          {/* Severity summary */}
          <div className="grid grid-cols-5 gap-2 mb-6">
            {SEV_ORDER.map(s => (
              <div key={s} className="bg-white/[0.02] border border-white/10 rounded-[10px] px-4 py-3 text-center">
                <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#444444] mb-1">{s}</p>
                <p className={`text-[24px] font-semibold ${
                  counts[s] > 0
                    ? s === "critical" ? "text-[#f87171]"
                    : s === "high" ? "text-[#fb923c]"
                    : s === "medium" ? "text-[#fbbf24]"
                    : s === "low" ? "text-[#60a5fa]"
                    : "text-[#a1a1aa]"
                    : "text-[#333333]"
                }`} style={{ letterSpacing: "-0.96px" }}>
                  {counts[s]}
                </p>
              </div>
            ))}
          </div>

          {/* Findings table */}
          <div className="bg-white/[0.02] border border-white/10 rounded-[12px] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/[0.07] grid grid-cols-[1fr_80px_80px_120px_100px]
                            gap-4 text-[10px] font-mono uppercase tracking-[0.06em] text-[#444444]">
              <span>Title</span>
              <span>Severity</span>
              <span>Tool</span>
              <span>Location</span>
              <span>Fix</span>
            </div>

            <ul className="divide-y divide-white/[0.04]">
              {vulns.map(v => (
                <li key={v.id}
                  className="px-5 py-3.5 grid grid-cols-[1fr_80px_80px_120px_100px] gap-4
                             hover:bg-white/[0.02] transition-colors items-center">

                  {/* Title + repo */}
                  <div className="min-w-0">
                    <p className="text-[13px] text-white truncate" style={{ letterSpacing: "-0.26px" }}>
                      {v.title}
                    </p>
                    <p className="text-[11px] font-mono text-[#444444] truncate mt-0.5">
                      {v.repoFullName}
                      {v.cweId && <span className="ml-2 text-[#333333]">{v.cweId}</span>}
                    </p>
                  </div>

                  {/* Severity */}
                  <div><SeverityBadge severity={v.severity} /></div>

                  {/* Tool */}
                  <span className="text-[11px] font-mono text-[#555555] truncate">{v.tool}</span>

                  {/* Location */}
                  <div className="min-w-0">
                    {v.filePath ? (
                      <p className="text-[11px] font-mono text-[#555555] truncate">
                        {v.filePath.split("/").pop()}
                        {v.lineStart && <span className="text-[#444444]">:{v.lineStart}</span>}
                      </p>
                    ) : v.targetUrl ? (
                      <p className="text-[11px] font-mono text-[#555555] truncate">{v.targetUrl}</p>
                    ) : (
                      <span className="text-[#333333]">—</span>
                    )}
                  </div>

                  {/* AI Fix */}
                  <div>
                    {v.aiFixPatch ? (
                      <span className="flex items-center gap-1.5 text-[11px] font-mono text-[#4ade80]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
                        AI Fix
                      </span>
                    ) : v.remediation ? (
                      <span className="text-[11px] font-mono text-[#555555]">Guidance</span>
                    ) : (
                      <span className="text-[#333333]">—</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-3 text-[11px] font-mono text-[#333333] text-right">
            Showing {vulns.length} findings
          </p>
        </>
      )}
    </div>
  )
}