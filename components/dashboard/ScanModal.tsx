"use client"

import { useState, useEffect } from "react"
import { useActionState } from "react"
import { createScan, type ScanActionState } from "@/app/dashboard/actions"
import { TOOLS } from "@/lib/tools"
import type { ScanTool } from "@/types"
import { ScanProgress } from "@/components/dashboard/ScanProgress"
import { UpgradeModal } from "@/components/dashboard/UpgradeModal"

const INIT: ScanActionState = {}

// Tool groups — no overlaps
const SAST_TOOLS: ScanTool[] = ["semgrep", "codeql", "sonarscanner", "horusec", "bearer", "nodejsscan", "bandit", "gosec", "gitleaks", "trivy"]
const DAST_TOOLS: ScanTool[] = ["owasp_zap", "nuclei", "nikto", "wapiti", "sqlmap", "arachni", "dirsearch", "testssl", "wpscan", "nmap_vulners"]

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
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeReason, setUpgradeReason] = useState<{feature: string, desc: string} | null>(null)

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
    
    if (state.error === "UPGRADE_REQUIRED_DAST") {
      setUpgradeReason({
        feature: "Dynamic Application Security Testing (DAST)",
        desc: "The Starter plan only includes SAST. Upgrade to Pro to unlock DAST and scan live endpoints for runtime vulnerabilities."
      })
      setShowUpgradeModal(true)
    } else if (state.error === "UPGRADE_REQUIRED_SCANS") {
      setUpgradeReason({
        feature: "Monthly Scan Limit Reached",
        desc: "You have reached your limit of 3 scans per month on the Starter plan. Upgrade to Pro for 50 scans per month and continuous security coverage."
      })
      setShowUpgradeModal(true)
    }
  }, [state.ok, state.scanId, state.error])

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
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <p className="text-[13px] font-semibold text-white" style={{ letterSpacing: "-0.26px" }}>
                          SAST Analysis
                        </p>
                        <label className="flex items-center gap-1.5 cursor-pointer group select-none">
                          <input type="checkbox" className="sr-only"
                            checked={SAST_TOOLS.every(id => selectedSast.has(id))}
                            onChange={(e) => setSelectedSast(e.target.checked ? new Set(SAST_TOOLS) : new Set())} 
                          />
                          <span className="text-[10px] font-medium text-[#4ade80] bg-[#4ade80]/10 px-2 py-0.5 rounded-[4px] transition-colors group-hover:bg-[#4ade80]/20">
                            Select All (Recommended)
                          </span>
                        </label>
                      </div>
                      <p className="text-[11px] text-[#555555]">
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
                      <div className="flex flex-col gap-1.5">
                        {SAST_TOOLS.map(id => {
                          const t = TOOLS.find(x => x.id === id)
                          if (!t) return null
                          const isOn = selectedSast.has(id)
                          
                          const sastDescriptions: Record<string, string> = {
                            semgrep: "Identifies insecure functions and bad practices in source code.",
                            codeql: "Detects logical data-flow vulnerabilities and security flaws.",
                            sonarscanner: "Evaluates overall code quality and structural vulnerabilities.",
                            horusec: "Aggregates multi-language static analysis for common flaws.",
                            bearer: "Audits privacy risks and sensitive data leakage in logs.",
                            nodejsscan: "Analyzes Node.js architectures for backend vulnerabilities.",
                            bandit: "Scans Python codebases for common security issues.",
                            gosec: "Inspects Go source code for security standards compliance.",
                            gitleaks: "Detects hardcoded secrets, passwords, and API tokens.",
                            trivy: "Scans project dependencies and packages for known CVEs."
                          }
                          const desc = sastDescriptions[id] || t.blurb

                          return (
                            <label key={`sast-${id}`}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-[9px] border cursor-pointer transition-all
                                ${isOn ? "border-white/20 bg-white/[0.04]" : "border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.02]"}`}>
                              <input type="checkbox" className="sr-only"
                                checked={isOn} onChange={() => toggleSast(id)} />
                              <span className={`w-4 h-4 rounded-[4px] border flex items-center justify-center flex-shrink-0 transition-colors
                                ${isOn ? "bg-white border-white" : "border-white/20 bg-black"}`}>
                                {isOn && (
                                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                    <path d="M2 5l2 2 4-4" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </span>
                              <div className="min-w-0 flex-1">
                                <span className="text-[12px] text-zinc-200 block leading-snug">{desc}</span>
                                <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 block mt-0.5">{t.label}</span>
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
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <p className="text-[13px] font-semibold text-white" style={{ letterSpacing: "-0.26px" }}>
                          DAST Analysis
                        </p>
                        <label className="flex items-center gap-1.5 cursor-pointer group select-none">
                          <input type="checkbox" className="sr-only"
                            checked={DAST_TOOLS.every(id => selectedDast.has(id))}
                            onChange={(e) => setSelectedDast(e.target.checked ? new Set(DAST_TOOLS) : new Set())} 
                          />
                          <span className="text-[10px] font-medium text-[#4ade80] bg-[#4ade80]/10 px-2 py-0.5 rounded-[4px] transition-colors group-hover:bg-[#4ade80]/20">
                            Select All (Recommended)
                          </span>
                        </label>
                      </div>
                      <p className="text-[11px] text-[#555555]">
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
                      <div className="flex flex-col gap-1.5">
                        {DAST_TOOLS.map(id => {
                          const t = TOOLS.find(x => x.id === id)
                          if (!t) return null
                          const isOn = selectedDast.has(id)

                          const dastDescriptions: Record<string, string> = {
                            owasp_zap: "Performs dynamic application security testing (DAST) on live endpoints.",
                            nuclei: "Executes template-based vulnerability scanning on active targets.",
                            nikto: "Detects dangerous files and server misconfigurations.",
                            wapiti: "Fuzzes web forms to identify XSS, SQLi, and input validation flaws.",
                            sqlmap: "Detects and exploits database injection vulnerabilities.",
                            arachni: "Evaluates modern web applications for runtime vulnerabilities.",
                            dirsearch: "Discovers hidden directories and exposed administrative paths.",
                            testssl: "Analyzes SSL/TLS certificate encryption standards and leaks.",
                            wpscan: "Identifies vulnerable plugins and themes in WordPress environments.",
                            nmap_vulners: "Scans network infrastructure for open ports and associated CVEs."
                          }
                          const desc = dastDescriptions[id] || t.blurb

                          return (
                            <label key={`dast-${id}`}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-[9px] border cursor-pointer transition-all
                                ${isOn ? "border-white/20 bg-white/[0.04]" : "border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.02]"}`}>
                              <input type="checkbox" className="sr-only"
                                checked={isOn} onChange={() => toggleDast(id)} />
                              <span className={`w-4 h-4 rounded-[4px] border flex items-center justify-center flex-shrink-0 transition-colors
                                ${isOn ? "bg-white border-white" : "border-white/20 bg-black"}`}>
                                {isOn && (
                                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                    <path d="M2 5l2 2 4-4" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </span>
                              <div className="min-w-0 flex-1">
                                <span className="text-[12px] text-zinc-200 block leading-snug">{desc}</span>
                                <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 block mt-0.5">{t.label}</span>
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
                  {state.error && !state.error.includes("UPGRADE_REQUIRED") && (
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

      {showUpgradeModal && upgradeReason && (
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          feature={upgradeReason.feature}
          description={upgradeReason.desc}
        />
      )}
    </>
  )
}