"use client"

import { useState } from "react"
import type { FindingRow } from "@/components/dashboard/FindingDrawer"

interface ExportFinding {
  title: string
  severity: string
  tool: string
  filePath: string | null | undefined
  lineStart: number | null | undefined
  cweId: string | null | undefined
  owaspCategory: string | null | undefined
  status: string | null | undefined
  createdAt: Date
}

function toCSV(rows: ExportFinding[]): string {
  const headers = ["title", "severity", "tool", "filePath", "line", "cweId", "owaspCategory", "status", "createdAt"]
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v)
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [
    headers.join(","),
    ...rows.map(r => [
      escape(r.title), escape(r.severity), escape(r.tool),
      escape(r.filePath), escape(r.lineStart), escape(r.cweId),
      escape(r.owaspCategory), escape(r.status), escape(r.createdAt?.toISOString()),
    ].join(",")),
  ].join("\n")
}

export function ExportButton({ findings }: { findings: (FindingRow & { createdAt?: Date })[] }) {
  const [open, setOpen] = useState(false)

  const doExport = (fmt: "csv" | "json") => {
    const rows: ExportFinding[] = findings.map(f => ({
      title: f.title,
      severity: f.severity,
      tool: f.tool,
      filePath: f.filePath,
      lineStart: f.lineStart,
      cweId: f.cweId,
      owaspCategory: f.owaspCategory,
      status: f.status,
      createdAt: (f as any).createdAt ?? new Date(),
    }))

    const [content, mime, ext] =
      fmt === "csv"
        ? [toCSV(rows), "text/csv", "csv"]
        : [JSON.stringify(rows, null, 2), "application/json", "json"]

    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `oculs-findings.${ext}`
    a.click()
    URL.revokeObjectURL(url)
    setOpen(false)
  }

  if (findings.length === 0) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="h-8 px-3 rounded-[6px] border border-white/10 text-[12px] font-mono text-[#888888]
                   hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1.5"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Export
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[40]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-[50] bg-[#111111] border border-white/15 rounded-[8px] shadow-xl overflow-hidden min-w-[120px]">
            <button
              type="button"
              onClick={() => doExport("csv")}
              className="w-full px-4 py-2.5 text-left text-[12px] font-mono text-[#a1a1aa] hover:bg-white/[0.05] hover:text-white transition-colors"
            >
              CSV
            </button>
            <button
              type="button"
              onClick={() => doExport("json")}
              className="w-full px-4 py-2.5 text-left text-[12px] font-mono text-[#a1a1aa] hover:bg-white/[0.05] hover:text-white transition-colors border-t border-white/[0.06]"
            >
              JSON
            </button>
          </div>
        </>
      )}
    </div>
  )
}
