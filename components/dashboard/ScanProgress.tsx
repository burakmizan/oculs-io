"use client"

import { useEffect, useRef, useState } from "react"

interface ScanProgressProps {
  scanId: string
  repoName: string
  toolCount: number
  onClose: () => void
}

const STAGES = [
  { label: "Initializing scan environment",        pct: 5  },
  { label: "Cloning repository",                   pct: 12 },
  { label: "Running SAST analysis (Semgrep)",       pct: 22 },
  { label: "Scanning for secrets (Gitleaks)",       pct: 34 },
  { label: "Analyzing dependencies (Trivy)",        pct: 44 },
  { label: "Running additional SAST tools",         pct: 54 },
  { label: "Performing DAST scan (OWASP ZAP)",      pct: 66 },
  { label: "Running network scans (Nuclei)",        pct: 76 },
  { label: "Collecting and normalizing findings",   pct: 85 },
  { label: "AI triage in progress (Gemini)",        pct: 92 },
  { label: "Generating auto-fix patches",           pct: 97 },
  { label: "Finalizing report",                     pct: 100},
]

export function ScanProgress({ scanId, repoName, toolCount, onClose }: ScanProgressProps) {
  const [dismissed, setDismissed] = useState(false)
  const [stageIdx, setStageIdx] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())

  // Advance stages every ~4 seconds
  useEffect(() => {
    if (stageIdx >= STAGES.length - 1) return
    const t = setTimeout(() => setStageIdx((i) => i + 1), 3800 + Math.random() * 800)
    return () => clearTimeout(t)
  }, [stageIdx])

  // Elapsed timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [])

  const stage = STAGES[stageIdx]!
  const pct = stage.pct
  const isDone = pct === 100
  const estTotal = Math.round((toolCount * 45) / 60) // rough estimate in minutes
  const estRemain = isDone ? 0 : Math.max(0, estTotal * 60 - elapsed)
  const remMin = Math.floor(estRemain / 60)
  const remSec = estRemain % 60

  // Dynamic Island — shown after popup dismissed
  if (dismissed) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-[#111111] border border-white/15 shadow-2xl pointer-events-auto">
          {/* Animated dot */}
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isDone ? "bg-[#4ade80]" : "bg-[#60a5fa] animate-pulse"}`} />
          <span className="text-[12px] font-mono text-white" style={{ letterSpacing: "-0.14px" }}>
            {isDone ? `Scan complete — ${repoName}` : `Scanning ${repoName} · ${pct}%`}
          </span>
          {!isDone && (
            <span className="text-[11px] font-mono text-[#555555]">
              ~{remMin}m {String(remSec).padStart(2, "0")}s left
            </span>
          )}
          {/* Mini progress ring */}
          <svg width="18" height="18" viewBox="0 0 18 18" className="flex-shrink-0">
            <circle cx="9" cy="9" r="7" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2"/>
            <circle
              cx="9" cy="9" r="7"
              fill="none"
              stroke={isDone ? "#4ade80" : "#60a5fa"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 7}`}
              strokeDashoffset={`${2 * Math.PI * 7 * (1 - pct / 100)}`}
              transform="rotate(-90 9 9)"
              style={{ transition: "stroke-dashoffset 1s ease" }}
            />
          </svg>
        </div>
      </div>
    )
  }

  // Full popup
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop — NOT dismissable by click (user must use button) */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-[480px] bg-[#0a0a0a] border border-white/15 rounded-[20px] overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/[0.07]">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#60a5fa] animate-pulse" />
              <span className="text-[13px] font-semibold text-white" style={{ letterSpacing: "-0.26px" }}>
                Scan in progress
              </span>
            </div>
            <span className="text-[12px] font-mono text-[#444444]">
              {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
            </span>
          </div>
          <p className="text-[12px] font-mono text-[#555555]">{repoName}</p>
        </div>

        {/* Progress */}
        <div className="px-6 py-5">
          {/* Percentage */}
          <div className="flex items-end justify-between mb-3">
            <span
              className="text-[40px] font-semibold text-white tabular-nums"
              style={{ letterSpacing: "-1.6px", lineHeight: 1 }}
            >
              {pct}%
            </span>
            <span className="text-[12px] font-mono text-[#555555] pb-1">
              {isDone ? "Complete" : `~${remMin}m ${String(remSec).padStart(2, "0")}s remaining`}
            </span>
          </div>

          {/* Bar */}
          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-4">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${pct}%`,
                background: isDone
                  ? "#4ade80"
                  : "linear-gradient(90deg, #3b82f6, #60a5fa)",
              }}
            />
          </div>

          {/* Stage list */}
          <div className="flex flex-col gap-1.5 max-h-[200px] overflow-hidden">
            {STAGES.slice(Math.max(0, stageIdx - 2), stageIdx + 3).map((s, i) => {
              const absIdx = Math.max(0, stageIdx - 2) + i
              const isDoneStage = absIdx < stageIdx
              const isCurrentStage = absIdx === stageIdx
              return (
                <div
                  key={s.label}
                  className={`flex items-center gap-2.5 transition-opacity ${
                    isCurrentStage ? "opacity-100" : isDoneStage ? "opacity-40" : "opacity-20"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    isDoneStage ? "bg-[#4ade80]" : isCurrentStage ? "bg-[#60a5fa] animate-pulse" : "bg-white/20"
                  }`} />
                  <span className={`text-[12px] font-mono ${isCurrentStage ? "text-white" : "text-[#555555]"}`}
                    style={{ letterSpacing: "-0.14px" }}>
                    {s.label}
                    {isDoneStage && " ✓"}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-1 flex items-center justify-between border-t border-white/[0.07]">
          <span className="text-[11px] text-white/40">
            {toolCount} scanners · scan ID {scanId.slice(0, 8)}
          </span>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-[12px] text-white underline underline-offset-2 opacity-60 hover:opacity-100 transition-opacity"
          >
            Close — scan continues in background
          </button>
        </div>
      </div>
    </div>
  )
}