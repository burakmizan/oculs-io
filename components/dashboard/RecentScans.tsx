import type { RecentScanRow } from "@/lib/db/queries"
import { TOOLS_BY_ID } from "@/lib/tools"
import { ScanIcon } from "@/components/ui/icons"

const STATUS_STYLES: Record<string, { dot: string; text: string }> = {
  completed: { dot: "bg-[#4ade80]", text: "text-[#4ade80]" },
  running: { dot: "bg-[#60a5fa]", text: "text-[#60a5fa]" },
  failed: { dot: "bg-[#f87171]", text: "text-[#f87171]" },
  queued: { dot: "bg-[#a1a1aa]", text: "text-[#a1a1aa]" },
  pending: { dot: "bg-[#666666]", text: "text-[#666666]" },
}

function relativeTime(date: Date): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

export function RecentScans({ scans }: { scans: RecentScanRow[] }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-[13px] font-mono uppercase tracking-[0.08em] text-[#a1a1aa]"
        >
          Recent scans
        </h2>
      </div>

      {scans.length === 0 ? (
        <div className="bg-white/[0.02] border border-white/10 rounded-[12px] px-6 py-10 flex flex-col items-center text-center gap-2">
          <ScanIcon size={18} className="text-[#444444]" />
          <p className="text-[13px] text-[#555555]">
            No scans yet — queue your first run above.
          </p>
        </div>
      ) : (
        <ul className="bg-white/[0.02] border border-white/10 rounded-[12px] divide-y divide-white/[0.07]">
          {scans.map((scan) => {
            const status =
              STATUS_STYLES[scan.status] ?? STATUS_STYLES.pending
            const labels = scan.tools.map((t) => TOOLS_BY_ID[t]?.label ?? t)
            const shown = labels.slice(0, 3)
            const extra = labels.length - shown.length
            return (
              <li
                key={scan.id}
                className="flex items-center gap-4 px-5 py-3.5"
              >
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[13px] font-mono text-white truncate"
                    style={{ letterSpacing: "-0.14px" }}
                  >
                    {scan.repoFullName}
                  </p>
                  <p className="text-[11px] text-[#555555] truncate mt-0.5">
                    {shown.join(" · ")}
                    {extra > 0 && ` · +${extra}`}
                  </p>
                </div>

                <div className="hidden sm:block text-right flex-shrink-0">
                  <p className="text-[13px] text-white tabular-nums">
                    {scan.vulnerabilitiesCount}
                  </p>
                  <p className="text-[10px] font-mono uppercase tracking-[0.06em] text-[#444444]">
                    findings
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0 w-[88px] justify-end">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${status.dot}`}
                    aria-hidden="true"
                  />
                  <span
                    className={`text-[12px] capitalize ${status.text}`}
                    style={{ letterSpacing: "-0.24px" }}
                  >
                    {scan.status}
                  </span>
                </div>

                <span className="text-[11px] font-mono text-[#444444] flex-shrink-0 w-[64px] text-right">
                  {relativeTime(scan.createdAt)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
