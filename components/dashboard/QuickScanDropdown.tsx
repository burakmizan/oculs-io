"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { ScanModal } from "@/components/dashboard/ScanModal"
import type { ProjectOption } from "@/lib/db/queries"

export function QuickScanDropdown({ projects }: { projects: ProjectOption[] }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<ProjectOption | null>(null)
  const [scanKey, setScanKey] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  if (projects.length === 0) {
    return (
      <Link
        href="/dashboard/scans"
        className="flex items-center gap-2 h-9 px-4 rounded-[8px] bg-white text-[#000] text-[13px] font-medium hover:bg-white/90 transition-colors"
        style={{ letterSpacing: "-0.26px" }}
      >
        + New Scan
      </Link>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 h-9 px-4 rounded-[8px] bg-white text-[#000] text-[13px] font-medium hover:bg-white/90 transition-colors"
        style={{ letterSpacing: "-0.26px" }}
      >
        + New Scan
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-[280px] bg-[#0a0a0a] border border-white/15 rounded-[12px] shadow-2xl z-50 overflow-hidden py-1">
          <p className="text-[10px] font-mono uppercase tracking-[0.06em] text-[#444444] px-3 pt-2 pb-1">
            Select project to scan
          </p>
          {projects.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setOpen(false)
                setSelected(p)
                setScanKey(k => k + 1)
              }}
              className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] transition-colors"
            >
              <div className="w-6 h-6 rounded-[5px] bg-white/[0.06] border border-white/10 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-mono text-[#a1a1aa]">
                  {p.repoFullName.split("/")[0]?.[0]?.toUpperCase() ?? "R"}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-mono text-white truncate">{p.name}</p>
                <p className="text-[10px] font-mono text-[#444444] truncate">{p.repoFullName}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <ScanModal key={scanKey} project={selected} initialOpen cardless />
      )}
    </div>
  )
}
