"use client"

import { useState } from "react"
import { FindingDrawer, type FindingRow } from "@/components/dashboard/FindingDrawer"
import { SEVERITY_STYLES } from "@/lib/severity"
import type { SeverityLevel } from "@/types"

function SeverityBadge({ severity }: { severity: string }) {
  const sev = SEVERITY_STYLES[severity as SeverityLevel] ?? SEVERITY_STYLES.info
  return (
    <span className={`inline-flex items-center h-5 px-2 rounded-[4px] border
                      text-[10px] font-mono uppercase tracking-[0.04em] ${sev.badge}`}>
      {severity}
    </span>
  )
}

const MUTE_LABELS: Record<string, { text: string; cls: string }> = {
  false_positive: { text: "AI: False positive", cls: "text-[#60a5fa] border-[#60a5fa]/30 bg-[#60a5fa]/10" },
  dismissed:      { text: "Muted by you",       cls: "text-[#a1a1aa] border-white/10 bg-white/[0.04]" },
}

export function FindingsTable({ findings }: { findings: FindingRow[] }) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const selected = selectedIdx !== null ? (findings[selectedIdx] ?? null) : null

  return (
    <>
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
          {findings.map((v, i) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => setSelectedIdx(i)}
                className="w-full text-left px-5 py-3.5 grid grid-cols-[1fr_90px_90px_140px_60px] gap-4
                           hover:bg-white/[0.03] transition-colors items-center cursor-pointer
                           focus-visible:outline-none focus-visible:bg-white/[0.04]"
              >
                <div className="min-w-0">
                  <p className="text-[13px] text-white truncate" style={{ letterSpacing: "-0.26px" }}>{v.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[11px] font-mono text-[#444444] truncate">
                      {v.repoFullName ?? ""}
                      {v.cweId && <span className="ml-2 text-[#333333]">{v.cweId}</span>}
                    </span>
                    {v.status && MUTE_LABELS[v.status] && (
                      <span className={`inline-flex items-center h-4 px-1.5 rounded-[3px] border text-[9px] font-mono uppercase tracking-[0.04em] flex-shrink-0 ${MUTE_LABELS[v.status]!.cls}`}>
                        {MUTE_LABELS[v.status]!.text}
                      </span>
                    )}
                  </div>
                </div>

                <div><SeverityBadge severity={v.severity} /></div>
                <span className="text-[11px] font-mono text-[#555555] truncate">{v.tool}</span>

                <div className="min-w-0">
                  {v.filePath ? (
                    (() => {
                      const segs = v.filePath.split("/")
                      const filename = segs[segs.length - 1] ?? ""
                      const lineNum = v.lines[0] ?? null
                      const deep = segs.length > 3
                      const display = `${deep ? "…/" : ""}${filename}${lineNum ? `:${lineNum}` : ""}`
                      const fullPath = `${v.filePath}${lineNum ? `:${lineNum}` : ""}`
                      return (
                        <div title={fullPath}>
                          <p className="text-[11px] font-mono text-[#555555] truncate">{display}</p>
                        </div>
                      )
                    })()
                  ) : v.targetUrl ? (
                    <p className="text-[11px] font-mono text-[#555555] truncate">{v.targetUrl}</p>
                  ) : (
                    <span className="text-[#333333]">—</span>
                  )}
                </div>

                <div className="text-center">
                  {v.count > 1 ? (
                    <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5
                                     rounded-full bg-white/[0.06] border border-white/10
                                     text-[11px] font-mono text-[#a1a1aa]">{v.count}×</span>
                  ) : (
                    <span className="text-[#333333]">—</span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <FindingDrawer
        finding={selected}
        onClose={() => setSelectedIdx(null)}
        onPrev={selectedIdx !== null && selectedIdx > 0 ? () => setSelectedIdx(i => i! - 1) : undefined}
        onNext={selectedIdx !== null && selectedIdx < findings.length - 1 ? () => setSelectedIdx(i => i! + 1) : undefined}
      />
    </>
  )
}