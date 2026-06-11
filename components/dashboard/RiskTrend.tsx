"use client"

import { useEffect, useRef, useState } from "react"
import { ReticleFrame } from "@/components/ui/ReticleFrame"
import type { RiskTrendPoint } from "@/lib/db/queries"

const W = 600
const H = 120
const PAD_Y = 12

export function RiskTrend({ points }: { points: RiskTrendPoint[] }) {
  const pathRef = useRef<SVGPathElement>(null)
  const [len, setLen] = useState(0)
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    if (pathRef.current) {
      setLen(pathRef.current.getTotalLength())
      requestAnimationFrame(() => setDrawn(true))
    }
  }, [points.length])

  if (points.length < 2) {
    return (
      <ReticleFrame className="rounded-[12px] mb-8">
        <div className="px-6 py-5">
          <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#555555] mb-1">Risk trend</p>
          <p className="text-[13px] text-[#888888]" style={{ letterSpacing: "-0.26px" }}>
            Run at least two scans to see whether your security posture is improving over time.
          </p>
        </div>
      </ReticleFrame>
    )
  }

  const scores = points.map((p) => p.score)
  const first = scores[0]
  const last = scores[scores.length - 1]
  const delta = last - first
  const n = points.length

  const x = (i: number) => (i / (n - 1)) * W
  const y = (s: number) => H - PAD_Y - (Math.max(0, Math.min(100, s)) / 100) * (H - PAD_Y * 2)

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.score).toFixed(1)}`).join(" ")
  const areaPath = `${linePath} L ${W} ${H} L 0 ${H} Z`

  // Down = improving (green), up = worsening (red), flat = neutral.
  const trendColor = delta < 0 ? "#4ade80" : delta > 0 ? "#f87171" : "#a1a1aa"
  const arrow = delta < 0 ? "▼" : delta > 0 ? "▲" : "→"
  const trendWord = delta < 0 ? "Improving" : delta > 0 ? "Worsening" : "Stable"

  return (
    <ReticleFrame className="rounded-[12px] mb-8">
      <div className="relative oculs-grid rounded-[12px] overflow-hidden px-6 py-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#555555] mb-1">Risk trend</p>
            <p className="text-[13px] text-[#888888]" style={{ letterSpacing: "-0.26px" }}>
              Last {n} completed scans · lower is safer
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-baseline gap-2 justify-end">
              <span className="text-[24px] font-semibold tabular-nums" style={{ color: trendColor, letterSpacing: "-0.96px" }}>
                {last}
              </span>
              <span className="text-[12px] font-mono" style={{ color: trendColor }}>{arrow} {Math.abs(delta)}</span>
            </div>
            <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-[#444444] mt-0.5">{trendWord}</p>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-[120px] block">
          <defs>
            <linearGradient id="oculs-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={trendColor} stopOpacity="0.18" />
              <stop offset="100%" stopColor={trendColor} stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0, 50, 100].map((v) => (
            <line key={v} x1="0" x2={W} y1={y(v)} y2={y(v)}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          ))}

          <path d={areaPath} fill="url(#oculs-trend-fill)" />

          <path
            ref={pathRef}
            d={linePath}
            fill="none"
            stroke={trendColor}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{
              strokeDasharray: len,
              strokeDashoffset: drawn ? 0 : len,
              transition: "stroke-dashoffset 1s ease-out",
              filter: `drop-shadow(0 0 4px ${trendColor}55)`,
            }}
          />
        </svg>
      </div>
    </ReticleFrame>
  )
}