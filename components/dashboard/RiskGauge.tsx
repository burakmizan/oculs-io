"use client"

import { useEffect, useState } from "react"
import { ReticleFrame } from "@/components/ui/ReticleFrame"
import { riskColorHex, riskLabel } from "@/lib/severity"

interface Props {
  score: number | null
  openFindings: number
  totalScans: number
}

const SIZE = 200
const STROKE = 12
const R = (SIZE - STROKE) / 2
const C = 2 * Math.PI * R
const SWEEP = 0.75 // 270° arc, gap centered at bottom
const ARC = C * SWEEP

export function RiskGauge({ score, openFindings, totalScans }: Props) {
  const target = score ?? 0
  const [display, setDisplay] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (!mounted) return
    let raf = 0
    const start = performance.now()
    const duration = 1200
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(target * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [mounted, target])

  const color = score === null ? "#444444" : riskColorHex(target)
  const label = score === null ? "No data yet" : riskLabel(target)
  const offset = mounted ? ARC * (1 - target / 100) : ARC

  const TICKS = 32
  const cx = SIZE / 2
  const cy = SIZE / 2
  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => {
    const angle = 135 + (270 * i) / TICKS
    const rad = (angle * Math.PI) / 180
    const inner = R - 16
    const outer = R - 8
    // Round to 2 decimals so Node (SSR) and the browser produce identical
    // coordinates — Math.sin/cos may differ by 1 ULP across JS engines,
    // which otherwise triggers a React hydration mismatch on these <line>s.
    const r2 = (v: number) => Math.round(v * 100) / 100
    return {
      x1: r2(cx + inner * Math.cos(rad)),
      y1: r2(cy + inner * Math.sin(rad)),
      x2: r2(cx + outer * Math.cos(rad)),
      y2: r2(cy + outer * Math.sin(rad)),
      lit: i / TICKS <= target / 100,
    }
  })

  return (
    <ReticleFrame className="rounded-[12px] mb-8">
      <div className="relative rounded-[12px] overflow-hidden">
        <div className="relative flex flex-col md:flex-row items-center gap-8 px-8 py-7">

          {/* Gauge */}
          <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
            <svg width={SIZE} height={SIZE} className="block">
              <circle
                cx={cx} cy={cy} r={R}
                fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={STROKE}
                strokeDasharray={`${ARC} ${C}`} strokeLinecap="round"
                transform={`rotate(135 ${cx} ${cy})`}
              />
              <circle
              cx={cx} cy={cy} r={R}
              fill="none" stroke={color} strokeWidth={STROKE}
              strokeDasharray={`${ARC} ${C}`} strokeDashoffset={offset}
              strokeLinecap="round"
              transform={`rotate(135 ${cx} ${cy})`}
              style={{
                transition: "stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)",
              }}
            />
              {ticks.map((t, i) => (
                <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                  stroke={t.lit ? color : "rgba(255,255,255,0.10)"} strokeWidth={1.5}
                  style={{ transition: "stroke 0.6s ease" }}
                />
              ))}
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[44px] font-semibold tabular-nums leading-none"
                style={{ color, letterSpacing: "-1.76px" }}>
                {score === null ? "—" : display}
              </span>
              <span className="mt-1 text-[10px] font-mono uppercase tracking-[0.12em] text-[#555555]">/ 100</span>
            </div>
          </div>

          {/* Readout */}
          <div className="flex-1 min-w-0 w-full">
            <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#555555] mb-2">Security Posture</p>
            <p className="text-[22px] font-semibold mb-1" style={{ letterSpacing: "-0.66px", color }}>{label}</p>
            <p className="text-[13px] text-[#888888] leading-relaxed mb-5" style={{ letterSpacing: "-0.26px" }}>
              {score === null
                ? "Run your first scan to generate a weighted risk score across all open findings."
                : "Weighted across all open findings by severity. Lower is safer."}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="border border-white/10 rounded-[8px] px-4 py-3 bg-black/20">
                <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-[#444444] mb-1">Open findings</p>
                <p className="text-[20px] font-semibold text-white tabular-nums" style={{ letterSpacing: "-0.8px" }}>{openFindings}</p>
              </div>
              <div className="border border-white/10 rounded-[8px] px-4 py-3 bg-black/20">
                <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-[#444444] mb-1">Total scans</p>
                <p className="text-[20px] font-semibold text-white tabular-nums" style={{ letterSpacing: "-0.8px" }}>{totalScans}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ReticleFrame>
  )
}