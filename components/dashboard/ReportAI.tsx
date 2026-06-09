"use client"

import { useEffect, useState } from "react"
import type { VulnerabilityRow } from "@/lib/db/queries"

interface Props {
  scanId: string
  repoName: string
  findings: (VulnerabilityRow & { count: number })[]
}

export function ReportAI({ scanId, repoName, findings }: Props) {
  const [report, setReport] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check localStorage cache first
    const cacheKey = `report-${scanId}`
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      setReport(cached)
      setLoading(false)
      return
    }

    // Generate report via API
    fetch("/api/report/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scanId,
        repoName,
        findings: findings.map(f => ({
          title: f.title,
          severity: f.severity,
          tool: f.tool,
          filePath: f.filePath,
          lineStart: f.lineStart,
          cweId: f.cweId,
          remediation: f.remediation,
          count: f.count,
        })),
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.report) {
          setReport(d.report)
          localStorage.setItem(cacheKey, d.report)
        } else {
          setError("Report generation failed.")
        }
      })
      .catch(() => setError("Could not generate report."))
      .finally(() => setLoading(false))
  }, [scanId, repoName, findings])

  if (loading) {
    return (
      <div className="bg-white/[0.02] border border-white/10 rounded-[12px] px-6 py-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-2 h-2 rounded-full bg-[#60a5fa] animate-pulse" />
          <p className="text-[13px] font-semibold text-white" style={{ letterSpacing: "-0.26px" }}>
            AI Analysis
          </p>
        </div>
        <p className="text-[12px] text-[#444444] font-mono">
          Gemini is analyzing findings and identifying false positives…
        </p>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="bg-white/[0.02] border border-white/10 rounded-[12px] px-6 py-5">
        <p className="text-[12px] text-[#555555]">
          AI report unavailable — {error ?? "no report generated."}
        </p>
      </div>
    )
  }

  // Render markdown-like report
  const lines = report.split("\n")
  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-[12px] px-6 py-5">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/[0.07]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
        <p className="text-[13px] font-semibold text-white" style={{ letterSpacing: "-0.26px" }}>
          AI Security Analysis
        </p>
        <span className="ml-auto text-[10px] font-mono text-[#333333]">Gemini</span>
      </div>
      <div className="flex flex-col gap-2">
        {lines.map((line, i) => {
          if (!line.trim()) return null
          if (line.startsWith("## ")) {
            const title = line.replace("## ", "")
            const isFP = title.toLowerCase().includes("false positive")
            const isNoise = title.toLowerCase().includes("noise")
            return (
              <p key={i}
                className={`text-[13px] font-semibold mt-4 mb-1 ${
                  isFP || isNoise ? "text-[#fbbf24]" : "text-white"
                }`}
                style={{ letterSpacing: "-0.26px" }}>
                {isFP || isNoise ? "⚠ " : ""}{title}
              </p>
            )
          }
          if (line.startsWith("# ")) {
            return (
              <p key={i} className="text-[14px] font-semibold text-white mt-2"
                 style={{ letterSpacing: "-0.28px" }}>
                {line.replace("# ", "")}
              </p>
            )
          }
          if (line.startsWith("- ") || line.startsWith("* ")) {
            return (
              <div key={i} className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-[#555555] mt-1.5 flex-shrink-0" />
                <p className="text-[12px] text-[#a1a1aa]">{line.replace(/^[-*] /, "")}</p>
              </div>
            )
          }
          return (
            <p key={i} className="text-[12px] text-[#a1a1aa]">{line}</p>
          )
        })}
      </div>
    </div>
  )
}