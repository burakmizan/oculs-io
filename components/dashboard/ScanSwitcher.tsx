"use client"

import { useRouter } from "next/navigation"
import type { ScanListRow } from "@/lib/db/queries"

interface Props {
  scans: ScanListRow[]
  selectedId: string
}

export function ScanSwitcher({ scans, selectedId }: Props) {
  const router = useRouter()

  const formatDate = (d: Date) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(d))

  return (
    <select
      value={selectedId}
      onChange={e => router.push(`/dashboard/findings?scan=${e.target.value}`)}
      className="w-full h-9 px-3 rounded-[8px] bg-white/[0.03] border border-white/10
                 text-[13px] text-white font-mono appearance-none cursor-pointer
                 focus:border-white/20 focus-visible:outline-none transition-colors"
      style={{ letterSpacing: "-0.14px" }}
    >
      {scans.map(s => (
        <option key={s.id} value={s.id} className="bg-[#0a0a0a] text-white">
          {s.repoFullName} — {formatDate(s.completedAt ?? s.createdAt)} — {s.vulnerabilitiesCount} findings — {s.id.slice(0, 8)}
        </option>
      ))}
    </select>
  )
}