import type { MttrStats } from "@/lib/db/queries"

function fmt(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 48) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

export function MttrCard({ stats }: { stats: MttrStats }) {
  const items = [
    {
      label: "Mean time to remediate",
      value: stats.avgHours === null ? "—" : fmt(stats.avgHours),
      hint: stats.avgHours === null ? "No fixes applied yet" : `over ${stats.fixedCount} fixed finding(s)`,
    },
    { label: "Findings fixed", value: String(stats.fixedCount), hint: "lifetime" },
    { label: "Still open", value: String(stats.openCount), hint: "awaiting remediation" },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
      {items.map((it) => (
        <div key={it.label} className="border border-white/10 rounded-[10px] bg-white/[0.02] px-5 py-4">
          <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#444444] mb-2">{it.label}</p>
          <p className="text-[24px] font-semibold text-white tabular-nums" style={{ letterSpacing: "-0.96px" }}>{it.value}</p>
          <p className="text-[11px] text-[#555555] mt-1">{it.hint}</p>
        </div>
      ))}
    </div>
  )
}