import { ReticleFrame } from "@/components/ui/ReticleFrame"
import type { OwaspCell } from "@/lib/db/queries"
import type { SeverityLevel } from "@/types"

const SEV_HEX: Record<SeverityLevel, string> = {
  critical: "#f87171", high: "#fb923c", medium: "#fbbf24", low: "#60a5fa", info: "#a1a1aa",
}

export function OwaspGrid({ cells }: { cells: OwaspCell[] }) {
  const failing = cells.filter((c) => c.count > 0).length

  return (
    <ReticleFrame className="rounded-[12px] mb-8">
      <div className="px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#555555] mb-1">OWASP Top 10 — 2021</p>
            <p className="text-[15px] font-semibold text-white" style={{ letterSpacing: "-0.3px" }}>Coverage map</p>
          </div>
          <span className="text-[12px] font-mono text-[#888888]">
            {failing === 0 ? "All clear" : `${failing}/10 categories with findings`}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {cells.map((c) => {
            const hex = c.topSeverity ? SEV_HEX[c.topSeverity] : null
            return (
              <div
                key={c.id}
                title={`${c.id} — ${c.title}: ${c.count} finding(s)`}
                className="relative border rounded-[8px] px-3 py-3 overflow-hidden transition-colors"
                style={{
                  borderColor: hex ? `${hex}40` : "rgba(255,255,255,0.08)",
                  background: hex ? `${hex}0d` : "rgba(255,255,255,0.02)",
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-mono font-semibold" style={{ color: hex ?? "#666666" }}>{c.id}</span>
                  {hex && <span className="w-1.5 h-1.5 rounded-full" style={{ background: hex }} />}
                </div>
                <p className="text-[10px] leading-tight text-[#888888] line-clamp-2 min-h-[26px]">{c.title}</p>
                <p className="text-[16px] font-semibold mt-1 tabular-nums" style={{ color: hex ?? "#444444" }}>
                  {c.count}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </ReticleFrame>
  )
}