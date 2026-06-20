import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { auth } from "@/auth"
import {
  getVulnerabilitiesByScan,
  getUserScans,
  getScanShareToken,
  type VulnerabilityRow,
} from "@/lib/db/queries"
import { ReportAI } from "@/components/dashboard/ReportAI"
import { ReportAIStep } from "@/components/dashboard/ReportAIStep"
import { ShareReportButton } from "@/components/dashboard/ShareReportButton"

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

const EXPLOIT_COLOR: Record<string, string> = {
  high:   "text-[#f87171] border-[#f87171]/30",
  medium: "text-[#fb923c] border-[#fb923c]/30",
  low:    "text-[#a1a1aa] border-white/15",
}

/** AI-assessed real-world exploitability, shown under the severity badge. */
function ExploitBadge({ level }: { level: string }) {
  return (
    <span className={`inline-flex items-center h-4 px-1.5 rounded-[3px] border
                      text-[9px] font-mono uppercase tracking-[0.04em] whitespace-nowrap
                      ${EXPLOIT_COLOR[level] ?? EXPLOIT_COLOR.low}`}>
      Exploit: {level}
    </span>
  )
}

interface Props {
  params: Promise<{ scanId: string }>
  searchParams: Promise<{ step?: string }>
}

export default async function ReportPage({ params, searchParams }: Props) {
  const { scanId } = await params
  const { step: stepParam } = await searchParams
  const step = stepParam === "2" ? 2 : 1
  const session = await auth()
  const userId = session!.user.id

  let vulns: VulnerabilityRow[] = []
  let repoName = ""
  let scanDate: Date | null = null
  let isDastScan = false
  let shareToken: string | null = null
  let repository = ""

  try {
    vulns = await getVulnerabilitiesByScan(scanId, userId)
    shareToken = await getScanShareToken(scanId, userId)
    const scans = await getUserScans(userId, 50)
    const scan = scans.find(s => s.id === scanId)
    // Don't notFound() — scan may be queued/running with no vulns yet
    if (scan) {
      repoName = scan.repoFullName
      repository = scan.repoFullName
      scanDate = scan.completedAt ?? scan.createdAt
      if ((scan as any).targetUrl || (scan as any).summary?.targetUrl) {
        isDastScan = true
      }
    }
  } catch {
    notFound()
  }

  // Dedup by fingerprint — keep highest severity per group
  const dedupMap = new Map<string, VulnerabilityRow & { count: number; lines: number[] }>()
  for (const v of vulns) {
    // Group by tool + title — same rule at different lines = one finding
    const key = `${v.tool}::${v.title}`
    const existing = dedupMap.get(key)
    if (!existing) {
      dedupMap.set(key, { ...v, count: 1, lines: v.lineStart ? [v.lineStart] : [] })
    } else {
      existing.count++
      if (v.lineStart && !existing.lines.includes(v.lineStart)) {
        existing.lines.push(v.lineStart)
      }
      // Keep highest severity
      const sevOrder = ["critical", "high", "medium", "low", "info"]
      if (sevOrder.indexOf(v.severity) < sevOrder.indexOf(existing.severity)) {
        const lines = existing.lines
        const count = existing.count
        dedupMap.set(key, { ...v, count, lines })
      }
    }
  }
  const deduped = Array.from(dedupMap.values())

  const foundTools = new Set(vulns.map(v => (v.tool || "").toLowerCase()))

  const sastTools = ["semgrep", "gitleaks", "trivy", "horusec", "bearer", "nodejsscan", "codeql", "bandit", "gosec", "sonarscanner"]
  const dastTools = ["owasp_zap", "nuclei", "nikto", "wapiti", "sqlmap", "arachni", "dirsearch", "testssl", "wpscan", "nmap_vulners"]

  // Determine if this was a DAST scan
  const isDast = isDastScan || vulns.some(v => dastTools.includes((v.tool || "").toLowerCase()));

  const expectedTools = isDast ? [...sastTools, ...dastTools] : sastTools
  const passedTools = expectedTools.filter(t => !foundTools.has(t))

  for (const t of passedTools) {
    deduped.push({
      id: `passed-${t}`,
      tool: t,
      title: "No vulnerabilities detected",
      severity: "info",
      filePath: null,
      targetUrl: null,
      cweId: null,
      remediation: null,
      count: 0,
      lines: []
    } as any)
  }

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

      {/* Step tabs */}
      <div className="flex items-center gap-1 mb-6 border border-white/10 rounded-[8px] p-0.5 w-fit bg-white/[0.02]">
        <Link
          href={`/dashboard/report/${scanId}?step=1`}
          className={`h-8 px-4 flex items-center rounded-[6px] text-[12px] font-mono transition-colors
            ${step === 1 ? "bg-white/[0.10] text-white" : "text-[#666666] hover:text-white"}`}
        >
          Findings
        </Link>
        <Link
          href={`/dashboard/report/${scanId}?step=2`}
          className={`h-8 px-4 flex items-center rounded-[6px] text-[12px] font-mono transition-colors gap-2
            ${step === 2 ? "bg-white/[0.10] text-white" : "text-[#666666] hover:text-white"}`}
        >
          AI Analysis
          <span className="inline-flex items-center h-4 px-1.5 rounded-[3px] bg-[#60a5fa]/15
                           text-[#60a5fa] text-[9px] font-mono uppercase tracking-[0.04em]">
            Gemini
          </span>
        </Link>
      </div>

      {step === 1 && (
        <>
          {/* Step 1: Findings table */}
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

        {deduped.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-[13px] text-[#444444]">No findings for this scan.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {(() => {
              const SEV_HEX: Record<string, string> = {
                critical: "#f87171", high: "#fb923c", medium: "#fbbf24",
                low: "#60a5fa", info: "#a1a1aa",
              }
              const sorted = [...deduped].sort((a, b) =>
                SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity)
              )
              const groups = SEV_ORDER
                .map(sev => ({ sev, items: sorted.filter(v => v.severity === sev) }))
                .filter(g => g.items.length > 0)
              return groups.flatMap(({ sev, items }) => [
                <li key={`header-${sev}`}
                  style={{ borderLeft: `3px solid ${SEV_HEX[sev]}` }}
                  className="px-4 flex items-center bg-white/[0.015]">
                  <span className="text-[10px] font-mono uppercase tracking-[0.08em] leading-[28px]"
                    style={{ color: SEV_HEX[sev] }}>
                    {sev} — {items.length} {items.length === 1 ? "finding" : "findings"}
                  </span>
                </li>,
                ...items.map(v => (
                  <li key={v.id}
                    className="px-5 py-3.5 grid grid-cols-[1fr_90px_90px_140px_60px] gap-4
                               hover:bg-white/[0.02] transition-colors items-center">

                    {/* Title */}
                    <div className="min-w-0">
                      <p className="text-[13px] text-white truncate flex items-center gap-1.5" style={{ letterSpacing: "-0.26px" }}>
                        {(v as any).count === 0 && <span className="text-[#4ade80]">✓</span>}
                        <span className={(v as any).count === 0 ? "text-[#a1a1aa]" : ""}>{v.title}</span>
                      </p>
                      {v.cweId && (
                        <p className="text-[10px] font-mono text-[#333333] mt-0.5">{v.cweId}</p>
                      )}
                      {v.correlationLabel && (
                        <p className="text-[10px] font-mono text-[#a78bfa] mt-0.5 truncate">
                          ⛓ chain: {v.correlationLabel}
                        </p>
                      )}
                      {v.remediation && (
                        <p className="text-[11px] text-[#444444] mt-0.5 line-clamp-1">{v.remediation}</p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 items-start">
                      <SeverityBadge severity={v.severity} />
                      {v.exploitability && <ExploitBadge level={v.exploitability} />}
                    </div>
                    <span className="text-[11px] font-mono text-[#555555] truncate">{v.tool}</span>

                    {/* Location */}
                    <div className="min-w-0">
                      {v.filePath ? (
                        <div>
                          <p className="text-[11px] font-mono text-[#555555] truncate">
                            {v.filePath.split("/").pop()}
                          </p>
                          {(v as VulnerabilityRow & { count: number; lines: number[] }).lines?.length > 0 && (
                            <p className="text-[10px] font-mono text-[#444444] truncate">
                              lines: {(v as VulnerabilityRow & { count: number; lines: number[] }).lines.slice(0, 3).join(", ")}
                              {(v as VulnerabilityRow & { count: number; lines: number[] }).lines.length > 3 && "…"}
                            </p>
                          )}
                        </div>
                      ) : v.targetUrl ? (
                        <p className="text-[11px] font-mono text-[#555555] truncate">{v.targetUrl}</p>
                      ) : (
                        <span className="text-[#333333]">—</span>
                      )}
                    </div>

                    {/* Duplicate count */}
                    <div className="text-center">
                      {(v as VulnerabilityRow & { count: number }).count > 1 ? (
                        <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5
                                         rounded-full bg-white/[0.06] border border-white/10
                                         text-[11px] font-mono text-[#a1a1aa]">
                          {(v as VulnerabilityRow & { count: number }).count}×
                        </span>
                      ) : (v as VulnerabilityRow & { count: number }).count === 0 ? (
                        <span className="text-[#4ade80] font-mono text-[11px] font-semibold">0</span>
                      ) : (
                        <span className="text-[#333333]">—</span>
                      )}
                    </div>
                  </li>
                )),
              ])
            })()}
          </ul>
        )}
          </div>

          <p className="mt-3 text-[11px] font-mono text-[#333333] text-right">
            {deduped.length} unique findings ({vulns.length} total)
          </p>
        </>
      )}

      {step === 2 && (
        <ReportAIStep
          scanId={scanId}
          repoName={repoName}
          repository={repository}
          findings={deduped}
        />
      )}
    </div>
  )
}