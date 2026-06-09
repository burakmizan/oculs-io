"use client"

import { useState, useEffect } from "react"
import { useActionState } from "react"
import { createScan, type ScanActionState } from "@/app/dashboard/actions"
import { TOOLS } from "@/lib/tools"
import type { ScanTool } from "@/types"
import { ScanProgress } from "@/components/dashboard/ScanProgress"

const INIT: ScanActionState = {}

// Tool groups — no overlaps
const SAST_TOOLS: ScanTool[] = ["semgrep", "codeql", "sonarscanner", "horusec", "bearer", "nodejsscan", "bandit", "gosec", "gitleaks", "trivy", "nmap_vulners"]
const SECRETS_TOOLS: ScanTool[] = ["gitleaks"]
const INFRA_TOOLS: ScanTool[] = ["trivy", "nmap_vulners"]
const DAST_TOOLS: ScanTool[] = ["owasp_zap", "nuclei", "nikto", "wapiti", "sqlmap", "arachni", "dirsearch", "testssl", "wpscan"]

interface Props {
  project: {
    id: string
    name: string
    repoFullName: string
    targetUrl: string | null
  }
}

export function ScanModal({ project }: Props) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(createScan, INIT)

  // SAST always on, DAST on if project has targetUrl
  const [sastEnabled, setSastEnabled] = useState(true)
  const [dastEnabled, setDastEnabled] = useState(false)
  const [dastUrl, setDastUrl] = useState(project.targetUrl ?? "")

  // Per-tool selection
  const [selectedSast, setSelectedSast] = useState<Set<ScanTool>>(
    new Set(["semgrep", "horusec", "gitleaks", "trivy"])
  )
  const [selectedDast, setSelectedDast] = useState<Set<ScanTool>>(
    new Set(["owasp_zap", "nuclei"])
  )

  const [showProgress, setShowProgress] = useState(false)

  // Enable DAST automatically if project has targetUrl
  useEffect(() => {
    if (project.targetUrl) {
      setDastEnabled(true)
      setDastUrl(project.targetUrl)
    }
  }, [project.targetUrl])

  useEffect(() => {
    if (state.ok && state.scanId) {
      setOpen(false)
      setShowProgress(true)
    }
  }, [state.ok, state.scanId])

  function toggleSast(id: ScanTool) {
    setSelectedSast(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleDast(id: ScanTool) {
    setSelectedDast(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Build final tool list — only user-selected tools
  const allSelected: ScanTool[] = [
    ...(sastEnabled ? [...selectedSast] : []),
    ...(dastEnabled && dastUrl ? [...selectedDast] : []),
  ]

  const [owner, repo] = project.repoFullName.split("/")

  return (
    <>
      {showProgress && state.scanId && (
        <ScanProgress
          scanId={state.scanId}
          repoName={project.repoFullName}
          toolCount={allSelected.length}
          onClose={() => setShowProgress(false)}
        />
      )}

      {/* Project card */}
      <div className="flex flex-col bg-white/[0.02] border border-white/10 rounded-[14px] overflow-hidden
                      hover:border-white/15 transition-colors">
        <div className="px-4 pt-4 pb-3 flex-1">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-9 h-9 rounded-[8px] bg-white/[0.05] border border-white/10
                            flex items-center justify-center flex-shrink-0">
              <span className="text-[13px] font-mono text-[#a1a1aa]">
                {owner?.[0]?.toUpperCase() ?? "R"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-white truncate" style={{ letterSpacing: "-0.28px" }}>
                {project.name}
              </p>
              <p className="text-[11px] font-mono text-[#555555] truncate mt-0.5">
                <span className="text-[#444444]">{owner}/</span>{repo}
              </p>
            </div>
          </div>
          {project.targetUrl && (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
              <span className="text-[11px] font-mono text-[#444444] truncate">{project.targetUrl}</span>
            </div>
          )}
        </div>
        <div className="px-4 pb-4">
          <button type="button" onClick={() => setOpen(true)}
            className="w-full h-9 rounded-[8px] bg-white text-black text-[13px] font-medium
                       hover:bg-white/90 transition-colors"
            style={{ letterSpacing: "-0.26px" }}>
            Scan →
          </button>
        </div>
      </div>

      {/* Config modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div className="relative z-10 w-full max-w-[540px] bg-[#0a0a0a] border border-white/15
                          rounded-[20px] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] flex-shrink-0">
              <div>
                <p className="text-[14px] font-semibold text-white" style={{ letterSpacing: "-0.28px" }}>
                  Configure Scan
                </p>
                <p className="text-[11px] font-mono text-[#555555] mt-0.5">{project.repoFullName}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[#555555]
                           hover:text-white hover:bg-white/10 transition-colors">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <form action={action} className="flex-1 overflow-y-auto">
              {/* Hidden fields */}
              <input type="hidden" name="repoFullName" value={project.repoFullName} />
              <input type="hidden" name="targetUrl" value={dastEnabled && dastUrl ? dastUrl : ""} />
              {allSelected.map(t => (
                <input key={`hidden-${t}`} type="hidden" name="tools" value={t} />
              ))}

              <div className="px-6 py-5 flex flex-col gap-6">

                {/* ── SAST ── */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] font-semibold text-white" style={{ letterSpacing: "-0.26px" }}>
                        SAST Analysis
                      </p>
                      <p className="text-[11px] text-[#555555] mt-0.5">
                        Static source + secrets + dependency scanning
                      </p>
                    </div>
                    {/* Toggle */}
                    <button type="button" onClick={() => setSastEnabled(e => !e)}
                      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0
                        ${sastEnabled ? "bg-white" : "bg-white/10"}`}>
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full transition-transform
                        ${sastEnabled ? "bg-black translate-x-[22px]" : "bg-white/40 translate-x-0.5"}`} />
                    </button>
                  </div>

                  {sastEnabled && (
                    <>

                      {/* Selectable SAST tools */}
                      <div className="grid grid-cols-2 gap-1.5">
                        {SAST_TOOLS.map(id => {
                          const t = TOOLS.find(x => x.id === id)
                          if (!t) return null
                          const isOn = selectedSast.has(id)
                          return (
                            <label key={`sast-${id}`}
                              className={`flex items-center gap-2 px-2.5 py-2 rounded-[7px] border cursor-pointer transition-colors
                                ${isOn ? "border-white/20 bg-white/[0.05]" : "border-white/[0.07] hover:bg-white/[0.02]"}`}>
                              <input type="checkbox" className="sr-only"
                                checked={isOn} onChange={() => toggleSast(id)} />
                              <span className={`w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center flex-shrink-0
                                ${isOn ? "bg-white border-white" : "border-white/20"}`}>
                                {isOn && (
                                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                    <path d="M1 4l2 2 4-4" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </span>
                              <div className="min-w-0">
                                <span className="text-[11px] font-mono text-white truncate block">{t.label}</span>
                                <span className="text-[10px] text-[#444444] truncate block">{t.blurb.slice(0, 40)}</span>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>

                <div className="h-px bg-white/[0.06]" />

                {/* ── DAST ── */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] font-semibold text-white" style={{ letterSpacing: "-0.26px" }}>
                        DAST Analysis
                      </p>
                      <p className="text-[11px] text-[#555555] mt-0.5">
                        Runtime web application scanning
                      </p>
                    </div>
                    {/* Toggle — always clickable */}
                    <button type="button" onClick={() => setDastEnabled(e => !e)}
                      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0
                        ${dastEnabled ? "bg-white" : "bg-white/10"}`}>
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full transition-transform
                        ${dastEnabled ? "bg-black translate-x-[22px]" : "bg-white/40 translate-x-0.5"}`} />
                    </button>
                  </div>

                  {dastEnabled && (
                    <>
                      {/* Target URL input */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-mono uppercase tracking-[0.06em] text-[#555555]">
                          Target URL
                        </label>
                        <input
                          type="url"
                          value={dastUrl}
                          onChange={e => setDastUrl(e.target.value)}
                          placeholder="https://staging.example.com"
                          className="h-9 px-3 rounded-[7px] bg-white/[0.03] border border-white/10
                                     text-[12px] text-white placeholder:text-[#333333] font-mono
                                     focus:border-white/20 focus-visible:outline-none transition-colors"
                          style={{ letterSpacing: "-0.14px" }}
                        />
                      </div>

                      {/* DAST tools */}
                      <div className="grid grid-cols-2 gap-1.5">
                        {DAST_TOOLS.map(id => {
                          const t = TOOLS.find(x => x.id === id)
                          if (!t) return null
                          const isOn = selectedDast.has(id)
                          return (
                            <label key={`dast-${id}`}
                              className={`flex items-center gap-2 px-2.5 py-2 rounded-[7px] border cursor-pointer transition-colors
                                ${isOn ? "border-white/20 bg-white/[0.05]" : "border-white/[0.07] hover:bg-white/[0.02]"}`}>
                              <input type="checkbox" className="sr-only"
                                checked={isOn} onChange={() => toggleDast(id)} />
                              <span className={`w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center flex-shrink-0
                                ${isOn ? "bg-white border-white" : "border-white/20"}`}>
                                {isOn && (
                                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                    <path d="M1 4l2 2 4-4" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </span>
                              <div className="min-w-0">
                                <span className="text-[11px] font-mono text-white truncate block">{t.label}</span>
                                <span className="text-[10px] text-[#444444] truncate block">{t.blurb.slice(0, 40)}</span>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/[0.07] flex-shrink-0
                              flex items-center justify-between">
                <span className="text-[11px] font-mono text-[#444444]">
                  {allSelected.length} tools · {project.repoFullName}
                </span>
                <div className="flex items-center gap-3">
                  {state.error && (
                    <span className="text-[11px] text-[#f87171]">{state.error}</span>
                  )}
                  <button type="submit"
                    disabled={pending || allSelected.length === 0}
                    className="h-9 px-5 rounded-[8px] bg-white text-black text-[13px] font-medium
                               hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    style={{ letterSpacing: "-0.26px" }}>
                    {pending ? "Starting…" : "Start Scan"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}