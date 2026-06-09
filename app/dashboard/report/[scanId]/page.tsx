import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { auth } from "@/auth"
import {
  getVulnerabilitiesByScan,
  getUserScans,
  type VulnerabilityRow,
} from "@/lib/db/queries"
import { ReportAI } from "@/components/dashboard/ReportAI"

export const metadata: Metadata = { title: "Scan Report" }

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

interface Props {
  params: Promise<{ scanId: string }>
}

export default async function ReportPage({ params }: Props) {
  const { scanId } = await params
  const session = await auth()
  const userId = session!.user.id

  let vulns: VulnerabilityRow[] = []
  let repoName = ""
  let scanDate: Date | null = null

  try {
    vulns = await getVulnerabilitiesByScan(scanId, userId)
    const scans = await getUserScans(userId, 50)
    const scan = scans.find(s => s.id === scanId)
    if (!scan) notFound()
    repoName = scan.repoFullName
    scanDate = scan.completedAt ?? scan.createdAt
  } catch {
    notFound()
  }

  // Dedup by fingerprint — keep highest severity per group
  const dedupMap = new Map<string, VulnerabilityRow & { count: number }>()
  for (const v of vulns) {
    const key = `${v.tool}::${v.filePath ?? v.targetUrl ?? ""}::${v.lineStart ?? 0}::${v.title}`
    const existing = dedupMap.get(key)
    if (!existing) {
      dedupMap.set(key, { ...v, count: 1 })
    } else {
      existing.count++
      // Keep highest severity
      const sevOrder = ["critical", "high", "medium", "low", "info"]
      if (sevOrder.indexOf(v.severity) < sevOrder.indexOf(existing.severity)) {
        dedupMap.set(key, { ...v, count: existing.count })
      }
    }
  }
  const deduped = Array.from(dedupMap.values())

  const counts = SEV_ORDER.reduce((acc, s) => {
    acc[s] = deduped.filter(v => v.severity === s).length
    return acc
  }, {} as Record<string, number>)

  const riskScore = Math.min(100, Math.round(
    deduped.reduce((acc, v) => {
      const w: Record<string, number> = { critical: 40, high: 20, medium: 8, low: 2, info: 0 }
      return acc + (w[v.severity] ?? 0)
    }, 0)
  ))

  const formatDate = (d: Date) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(d)

  return (
    <div className="p-8 max-w-[1100px] mx-auto">

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/dashboard/findings"
              className="text-[11px] font-mono text-[#444444] hover:text-[#a1a1aa] transition-colors">
              ← All findings
            </Link>
          </div>
          <p className="text-[14px] font-mono text-white mt-1" style={{ letterSpacing: "-0.28px" }}>
            {repoName}
          </p>
          <p className="text-[11px] font-mono text-[#444444] mt-0.5">
            {scanDate ? formatDate(scanDate) : "—"} · scan {scanId.slice(0, 8)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#444444]">Risk Score</p>
          <p className={`text-[32px] font-semibold tabular-nums mt-0.5 ${
            riskScore >= 70 ? "text-[#f87171]"
            : riskScore >= 40 ? "text-[#f5a623]"
            : "text-[#4ade80]"
          }`} style={{ letterSpacing: "-1.28px" }}>
            {riskScore}
          </p>
        </div>
      </div>

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

      {/* AI Report */}
      <ReportAI
        scanId={scanId}
        repoName={repoName}
        findings={deduped}
      />

      {/* Findings table */}
      <div className="bg-white/[0.02] border border-white/10 rounded-[12px] overflow-hidden mt-6">
        <div className="px-5 py-3.5 border-b border-white/[0.07]
                        grid grid-cols-[1fr_90px_90px_140px_60px]
                        gap-4 text-[10px] font-mono uppercase tracking-[0.06em] text-[#444444]">
          <span>Title</span>
          <span>Severity</span>
          <span>Tool</span>
          <span>Location</span>
          <span>Count</span>
        </div>

        {deduped.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-[13px] text-[#444444]">No findings for this scan.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {deduped
              .sort((a, b) => {
                const o = ["critical","high","medium","low","info"]
                return o.indexOf(a.severity) - o.indexOf(b.severity)
              })
              .map(v => (
                <li key={v.id}
                  className="px-5 py-3.5 grid grid-cols-[1fr_90px_90px_140px_60px] gap-4
                             hover:bg-white/[0.02] transition-colors items-center">

                  {/* Title */}
                  <div className="min-w-0">
                    <p className="text-[13px] text-white truncate" style={{ letterSpacing: "-0.26px" }}>
                      {v.title}
                    </p>
                    {v.cweId && (
                      <p className="text-[10px] font-mono text-[#333333] mt-0.5">{v.cweId}</p>
                    )}
                    {v.remediation && (
                      <p className="text-[11px] text-[#444444] mt-0.5 line-clamp-1">{v.remediation}</p>
                    )}
                  </div>

                  <div><SeverityBadge severity={v.severity} /></div>
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

                  {/* Duplicate count */}
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
        )}
      </div>

      <p className="mt-3 text-[11px] font-mono text-[#333333] text-right">
        {deduped.length} unique findings ({vulns.length} total)
      </p>
    </div>
  )
}