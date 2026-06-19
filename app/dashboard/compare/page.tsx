import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/auth"
import {
  getUserScans,
  getScanVulnerabilitiesForCompare,
  type ScanListRow,
  type CompareVuln,
} from "@/lib/db/queries"
import { CompareScanSelectors } from "@/components/dashboard/CompareScanSelectors"

export const metadata: Metadata = { title: "Compare Scans" }

const SEV_ORDER = ["critical", "high", "medium", "low", "info"]
const SEV_HEX: Record<string, string> = {
  critical: "#f87171", high: "#fb923c", medium: "#fbbf24", low: "#60a5fa", info: "#a1a1aa",
}

function SeverityBadge({ severity }: { severity: string }) {
  const c = SEV_HEX[severity] ?? "#888888"
  return (
    <span className="inline-flex items-center h-5 px-2 rounded-[4px] border text-[10px] font-mono uppercase"
      style={{ color: c, borderColor: `${c}33`, background: `${c}14` }}>
      {severity}
    </span>
  )
}

interface PageProps {
  searchParams: Promise<{ scan1?: string; scan2?: string }>
}

export default async function ComparePage({ searchParams }: PageProps) {
  const { scan1: s1, scan2: s2 } = await searchParams
  const session = await auth()
  const userId = session!.user.id

  let allScans: ScanListRow[] = []
  try {
    allScans = await getUserScans(userId, 50)
  } catch { /* Aurora offline */ }

  const completedScans = allScans.filter(s => s.status === "completed")

  let vulns1: CompareVuln[] = []
  let vulns2: CompareVuln[] = []
  let scan1: ScanListRow | null = completedScans.find(s => s.id === s1) ?? null
  let scan2: ScanListRow | null = completedScans.find(s => s.id === s2) ?? null

  if (scan1 && scan2) {
    try {
      ;[vulns1, vulns2] = await Promise.all([
        getScanVulnerabilitiesForCompare(scan1.id, userId),
        getScanVulnerabilitiesForCompare(scan2.id, userId),
      ])
    } catch { /* Aurora offline */ }
  }

  // Compute diff by fingerprint (fall back to "tool::title" for unfingerprinted)
  const key = (v: CompareVuln) => v.fingerprint ?? `${v.tool}::${v.title}`
  const set1 = new Map(vulns1.map(v => [key(v), v]))
  const set2 = new Map(vulns2.map(v => [key(v), v]))

  const newFindings = vulns2.filter(v => !set1.has(key(v)))
  const fixedFindings = vulns1.filter(v => !set2.has(key(v)))
  const ongoingFindings = vulns1.filter(v => set2.has(key(v)))

  const sortBySev = (arr: CompareVuln[]) =>
    [...arr].sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity))

  return (
    <div className="p-8 max-w-[900px] mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/findings" className="text-[12px] font-mono text-[#555555] hover:text-white transition-colors">
          ← Findings
        </Link>
        <h1 className="text-[20px] font-semibold text-white mt-3" style={{ letterSpacing: "-0.6px" }}>
          Compare Scans
        </h1>
      </div>

      {/* Scan selectors */}
      <CompareScanSelectors scans={completedScans} scan1={s1} scan2={s2} />

      {scan1 && scan2 ? (
        <>
          {/* Summary bar */}
          <div className="flex items-center gap-3 mb-6 p-4 rounded-[10px] border border-white/[0.07] bg-white/[0.01]">
            <span className="text-[13px] font-mono">
              <span className="text-[#f87171]">+{newFindings.length} new</span>
              <span className="text-[#555555] mx-2">·</span>
              <span className="text-[#4ade80]">−{fixedFindings.length} fixed</span>
              <span className="text-[#555555] mx-2">·</span>
              <span className="text-[#888888]">{ongoingFindings.length} ongoing</span>
            </span>
          </div>

          {/* New findings */}
          {newFindings.length > 0 && (
            <FindingSection title="New findings" findings={sortBySev(newFindings)} accent="#f87171" />
          )}

          {/* Fixed findings */}
          {fixedFindings.length > 0 && (
            <FindingSection title="Fixed / resolved" findings={sortBySev(fixedFindings)} accent="#4ade80" />
          )}

          {/* Ongoing findings */}
          {ongoingFindings.length > 0 && (
            <FindingSection title="Ongoing" findings={sortBySev(ongoingFindings)} accent="#888888" />
          )}

          {newFindings.length === 0 && fixedFindings.length === 0 && ongoingFindings.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3 border border-white/10 rounded-[12px]">
              <p className="text-[14px] text-white font-medium">Both scans are identical</p>
              <p className="text-[12px] text-[#555555]">No differences found between the two scans.</p>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3
                        border border-white/10 rounded-[12px] bg-white/[0.01]">
          <p className="text-[14px] text-white font-medium">Select two scans to compare</p>
          <p className="text-[12px] text-[#555555] max-w-[300px]">
            Choose a baseline scan and a comparison scan above to see what changed between them.
          </p>
        </div>
      )}
    </div>
  )
}

function FindingSection({
  title,
  findings,
  accent,
}: {
  title: string
  findings: CompareVuln[]
  accent: string
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full" style={{ background: accent }} />
        <h2 className="text-[12px] font-mono uppercase tracking-[0.08em] text-[#a1a1aa]">
          {title} <span style={{ color: accent }}>({findings.length})</span>
        </h2>
      </div>
      <div className="bg-white/[0.02] border border-white/10 rounded-[12px] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.07] grid grid-cols-[1fr_90px_90px_160px] gap-4
                        text-[10px] font-mono uppercase tracking-[0.06em] text-[#444444]">
          <span>Title</span><span>Severity</span><span>Tool</span><span>Location</span>
        </div>
        <ul className="divide-y divide-white/[0.04]">
          {findings.map((f, i) => {
            const loc = f.filePath
              ? `${f.filePath}${f.lineStart ? `:${f.lineStart}` : ""}`
              : "—"
            const c = SEV_HEX[f.severity] ?? "#888888"
            return (
              <li key={i} className="px-5 py-3.5 grid grid-cols-[1fr_90px_90px_160px] gap-4 items-center">
                <span className="text-[13px] text-white truncate" style={{ letterSpacing: "-0.26px" }}>{f.title}</span>
                <span className="inline-flex items-center h-5 px-2 rounded-[4px] border text-[10px] font-mono uppercase w-fit"
                  style={{ color: c, borderColor: `${c}33`, background: `${c}14` }}>{f.severity}</span>
                <span className="text-[11px] font-mono text-[#555555] truncate">{f.tool}</span>
                <span className="text-[11px] font-mono text-[#555555] truncate" title={loc}>{loc}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
