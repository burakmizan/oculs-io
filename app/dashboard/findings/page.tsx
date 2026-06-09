import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/auth"
import { getUserScans, getVulnerabilitiesByScan, type VulnerabilityRow, type ScanListRow } from "@/lib/db/queries"
import { ScanSwitcher } from "@/components/dashboard/ScanSwitcher"

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
    <span className={`inline-flex items-center h-5 px-2 rounded-[4px] border
                      text-[10px] font-mono uppercase tracking-[0.04em]
                      ${SEV_COLOR[severity] ?? SEV_COLOR.info}`}>
      {severity}
    </span>
  )
}

interface PageProps {
  searchParams: Promise<{ scan?: string }>
}

export default async function FindingsPage({ searchParams }: PageProps) {
  const { scan: scanParam } = await searchParams
  const session = await auth()
  const userId = session!.user.id

  let userScans: ScanListRow[] = []
  let vulns: VulnerabilityRow[] = []

  try {
    userScans = await getUserScans(userId, 20)
  } catch { /* Aurora offline */ }

  // Pick selected scan — default to most recent completed
  const completedScans = userScans.filter(s => s.status === "completed" && s.vulnerabilitiesCount > 0)
  const selectedScan = completedScans.find(s => s.id === scanParam) ?? completedScans[0] ?? null

  if (selectedScan) {
    try {
      vulns = await getVulnerabilitiesByScan(selectedScan.id, userId)
    } catch { /* Aurora offline */ }
  }

  // Dedup — group same finding across multiple tool runs
  const dedupMap = new Map<string, VulnerabilityRow & { count: number }>()
  for (const v of vulns) {
    const key = `${v.tool}::${v.filePath ?? v.targetUrl ?? ""}::${v.lineStart ?? 0}::${v.title}`
    const existing = dedupMap.get(key)
    if (!existing) {
      dedupMap.set(key, { ...v, count: 1 })
    } else {
      existing.count++
    }
  }
  const deduped = Array.from(dedupMap.values())
    .sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity))

  const counts = SEV_ORDER.reduce((acc, s) => {
    acc[s] = deduped.filter(v => v.severity === s).length
    return acc
  }, {} as Record<string, number>)

  const formatDate = (d: Date) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(d)

  return (
    <div className="p-8 max-w-[1100px] mx-auto">

      {/* Scan switcher */}
      {completedScans.length > 0 && (
        <div className="mb-6 flex items-center gap-3">
          <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#444444] flex-shrink-0">
            Scan
          </span>
          <div className="relative flex-1 max-w-[480px]">
            <ScanSwitcher scans={completedScans} selectedId={selectedScan?.id ?? ""} />
          </div>
          {selectedScan && (
            <Link
              href={`/dashboard/report/${selectedScan.id}`}
              className="flex-shrink-0 h-8 px-3 rounded-[6px] border border-white/10
                         text-[12px] text-[#a1a1aa] hover:text-white hover:bg-white/5 transition-colors"
            >
              AI Report ↗
            </Link>
          )}
        </div>
      )}

      {!selectedScan ? (
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
          {/* Severity summary + report link */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 grid grid-cols-5 gap-2">
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
            <Link
              href={`/dashboard/report/${selectedScan.id}`}
              className="flex-shrink-0 h-10 px-4 rounded-[8px] bg-white text-black
                         text-[13px] font-medium hover:bg-white/90 transition-colors
                         flex items-center gap-2"
              style={{ letterSpacing: "-0.26px" }}
            >
              <span>AI Report</span>
              <span className="text-[10px]">↗</span>
            </Link>
          </div>

          {/* Findings table */}
          <div className="bg-white/[0.02] border border-white/10 rounded-[12px] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/[0.07]
                            grid grid-cols-[1fr_90px_90px_140px_60px]
                            gap-4 text-[10px] font-mono uppercase tracking-[0.06em] text-[#444444]">
              <span>Title</span>
              <span>Severity</span>
              <span>Tool</span>
              <span>Location</span>
              <span>Count</span>
            </div>

            <ul className="divide-y divide-white/[0.04]">
              {deduped.map(v => (
                <li key={v.id}
                  className="px-5 py-3.5 grid grid-cols-[1fr_90px_90px_140px_60px] gap-4
                             hover:bg-white/[0.02] transition-colors items-center">

                  <div className="min-w-0">
                    <p className="text-[13px] text-white truncate" style={{ letterSpacing: "-0.26px" }}>
                      {v.title}
                    </p>
                    <p className="text-[11px] font-mono text-[#444444] truncate mt-0.5">
                      {v.repoFullName}
                      {v.cweId && <span className="ml-2 text-[#333333]">{v.cweId}</span>}
                    </p>
                  </div>

                  <div><SeverityBadge severity={v.severity} /></div>
                  <span className="text-[11px] font-mono text-[#555555] truncate">{v.tool}</span>

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

                  <div className="text-center">
                    {(v as VulnerabilityRow & { count: number }).count > 1 ? (
                      <span className="inline-flex items-center justify-center w-6 h-6
                                       rounded-full bg-white/[0.06] border border-white/10
                                       text-[11px] font-mono text-[#a1a1aa]">
                        {(v as VulnerabilityRow & { count: number }).count}
                      </span>
                    ) : (
                      <span className="text-[#333333]">—</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-3 text-[11px] font-mono text-[#333333] text-right">
            {deduped.length} unique · {vulns.length} total
          </p>
        </>
      )}
    </div>
  )
}