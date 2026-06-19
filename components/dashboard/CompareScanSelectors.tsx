"use client"

import { useRouter } from "next/navigation"
import type { ScanListRow } from "@/lib/db/queries"

export function CompareScanSelectors({
  scans,
  scan1,
  scan2,
}: {
  scans: ScanListRow[]
  scan1?: string
  scan2?: string
}) {
  const router = useRouter()

  const navigate = (newScan1: string, newScan2: string) => {
    const params = new URLSearchParams()
    if (newScan1) params.set("scan1", newScan1)
    if (newScan2) params.set("scan2", newScan2)
    router.push(`/dashboard/compare?${params.toString()}`)
  }

  const label = (s: ScanListRow) =>
    `${s.repoFullName} · ${new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} (${s.vulnerabilitiesCount})`

  return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      {(["scan1", "scan2"] as const).map((param, idx) => {
        const current = idx === 0 ? scan1 : scan2
        return (
          <div key={param} className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#555555]">
              {idx === 0 ? "Baseline scan" : "Compare to"}
            </label>
            <div className="relative">
              <select
                value={current ?? ""}
                onChange={e => {
                  const val = e.target.value
                  if (idx === 0) navigate(val, scan2 ?? "")
                  else navigate(scan1 ?? "", val)
                }}
                className="w-full h-9 px-3 rounded-[6px] bg-[#0a0a0a] border border-white/10 text-[12px]
                           font-mono text-[#a1a1aa] appearance-none cursor-pointer focus:outline-none
                           focus:border-white/30 pr-8"
              >
                <option value="">Select a scan…</option>
                {scans.map(s => (
                  <option key={s.id} value={s.id}>{label(s)}</option>
                ))}
              </select>
              <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#555555]"
                width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        )
      })}
    </div>
  )
}
