import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/auth"
import { getUserScans, getVulnerabilitiesByScan, type VulnerabilityRow, type ScanListRow } from "@/lib/db/queries"
import { ScanSwitcher } from "@/components/dashboard/ScanSwitcher"
import { FindingsTable } from "@/components/dashboard/FindingsTable"

export const metadata: Metadata = { title: "Findings" }

const SEV_ORDER = ["critical", "high", "medium", "low", "info"]

interface PageProps {
  searchParams: Promise<{ scan?: string; view?: string }>
}

export default async function FindingsPage({ searchParams }: PageProps) {
  const { scan: scanParam, view: viewParam } = await searchParams
  const view: "active" | "muted" = viewParam === "muted" ? "muted" : "active"
  const session = await auth()
  const userId = session!.user.id

  let userScans: ScanListRow[] = []
  let vulns: VulnerabilityRow[] = []

  try {
    userScans = await getUserScans(userId, 20)
  } catch { /* Aurora offline */ }

  // Pick selected scan — default to most recent completed
  const completedScans = userScans.filter(s =>
    s.status === "completed" || s.status === "running"
  )
  const selectedScan = completedScans.find(s => s.id === scanParam) ?? completedScans[0] ?? null

  if (selectedScan) {
    try {
      vulns = await getVulnerabilitiesByScan(selectedScan.id, userId, view)
    } catch { /* Aurora offline */ }
  }

  // Dedup — group same finding across multiple tool runs
  const dedupMap = new Map<string, VulnerabilityRow & { count: number; lines: number[] }>()
  for (const v of vulns) {
    // Group by tool + title (same rule, different lines = same issue)
    const key = `${v.tool}::${v.title}`
    const existing = dedupMap.get(key)
    if (!existing) {
      dedupMap.set(key, { ...v, count: 1, lines: v.lineStart ? [v.lineStart] : [] })
    } else {
      existing.count++
      if (v.lineStart && !existing.lines.includes(v.lineStart)) {
        existing.lines.push(v.lineStart)
      }
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
          {/* Active / Muted tabs */}
          <div className="flex items-center gap-1 mb-4 border border-white/10 rounded-[8px] p-0.5 w-fit bg-white/[0.02]">
            <Link
              href={`/dashboard/findings?scan=${selectedScan.id}&view=active`}
              className={`h-7 px-3 flex items-center rounded-[6px] text-[12px] font-mono transition-colors
                ${view === "active" ? "bg-white/[0.08] text-white" : "text-[#666666] hover:text-white"}`}
            >
              Active
            </Link>
            <Link
              href={`/dashboard/findings?scan=${selectedScan.id}&view=muted`}
              className={`h-7 px-3 flex items-center rounded-[6px] text-[12px] font-mono transition-colors
                ${view === "muted" ? "bg-white/[0.08] text-white" : "text-[#666666] hover:text-white"}`}
            >
              Muted
            </Link>
          </div>

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

          <FindingsTable findings={deduped} />

          <p className="mt-3 text-[11px] font-mono text-[#333333] text-right">
            {deduped.length} unique · {vulns.length} total
          </p>
        </>
      )}
    </div>
  )
}