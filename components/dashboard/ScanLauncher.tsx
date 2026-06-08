"use client"

import { useActionState, useEffect, useMemo, useState } from "react"
import { createScan, type ScanActionState } from "@/app/dashboard/actions"
import type { ProjectOption } from "@/lib/db/queries"
import {
  TOOLS,
  CATEGORY_ORDER,
  CATEGORY_META,
  toolsByCategory,
} from "@/lib/tools"
import type { ScanTool } from "@/types"
import { ScanIcon, Check, GitBranch, Sparkles } from "@/components/ui/icons"
import { ScanProgress } from "@/components/dashboard/ScanProgress"

const INITIAL: ScanActionState = {}

/** Sensible default selection so the matrix isn't empty on first load. */
const DEFAULT_SELECTED: ScanTool[] = [
  "semgrep",
  "gitleaks",
  "trivy",
  "owasp_zap",
  "nuclei",
]

export function ScanLauncher({ projects }: { projects: ProjectOption[] }) {
  const [state, action, pending] = useActionState(createScan, INITIAL)
  const [selected, setSelected] = useState<Set<ScanTool>>(
    () => new Set(DEFAULT_SELECTED),
  )

  const [selectedRepo, setSelectedRepo] = useState<string>("")
  const [repoModalOpen, setRepoModalOpen] = useState(false)
  const [repoSearch, setRepoSearch] = useState("")
  const [manualRepo, setManualRepo] = useState("")
  const [repoAllSelected, setRepoAllSelected] = useState(false)
  const [showProgress, setShowProgress] = useState(false)

  const [githubRepos, setGithubRepos] = useState<{ fullName: string; private: boolean; language: string | null }[]>([])
  const [reposLoading, setReposLoading] = useState(false)

  // Fetch GitHub repos when modal opens
  useEffect(() => {
    if (!repoModalOpen || githubRepos.length > 0) return
    setReposLoading(true)
    fetch("/api/github/repos")
      .then((r) => r.json())
      .then((d) => { if (d.repos) setGithubRepos(d.repos) })
      .catch(() => {})
      .finally(() => setReposLoading(false))
  }, [repoModalOpen])

  const toggle = (id: ScanTool) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const setMany = (ids: ScanTool[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)))
      return next
    })

  const allIds = useMemo(() => TOOLS.map((t) => t.id), [])

  // Open progress popup when scan is queued successfully
  useEffect(() => {
    if (state.ok && state.scanId) {
      setShowProgress(true)
    }
  }, [state.ok, state.scanId])

  return (
    <>
      {showProgress && state.scanId && (
        <ScanProgress
          scanId={state.scanId}
          repoName={selectedRepo || "repository"}
          toolCount={selected.size}
          onClose={() => setShowProgress(false)}
        />
      )}
      <form
        action={action}
      className="bg-white/[0.02] border border-white/10 rounded-[14px] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-5 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ScanIcon size={15} className="text-[#a1a1aa]" />
            <h2
              className="text-[15px] font-semibold text-white"
              style={{ letterSpacing: "-0.3px" }}
            >
              New scan
            </h2>
          </div>
          <p
            className="text-[13px] text-[#666666]"
            style={{ letterSpacing: "-0.26px" }}
          >
            Pick a repository and orchestrate up to 20 security scanners.
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-white/[0.04] border border-white/10 flex-shrink-0">
          <span className="text-[12px] font-mono text-white tabular-nums">
            {selected.size}
          </span>
          <span className="text-[12px] font-mono text-[#555555]">/ 20</span>
        </div>
      </div>

      {/* Repository picker + modal */}
      <div className="px-6 py-5 flex flex-col gap-4 border-b border-white/10">
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#666666] flex items-center gap-1.5">
            <GitBranch size={11} /> Repository
          </span>

          {/* Hidden form field */}
          <input type="hidden" name="repoFullName" value={selectedRepo} />

          {/* Trigger button */}
          <button
            type="button"
            onClick={() => setRepoModalOpen(true)}
            className={`flex items-center justify-between h-10 px-3 rounded-[8px] border text-left transition-colors
              ${selectedRepo
                ? "border-white/25 bg-white/[0.04] text-white"
                : "border-white/10 bg-white/[0.02] text-[#444444]"
              }`}
          >
            <span className="text-[13px] font-mono truncate" style={{ letterSpacing: "-0.14px" }}>
              {selectedRepo || "Select repository…"}
            </span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0 ml-2 text-[#555555]">
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Modal overlay */}
          {repoModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={() => setRepoModalOpen(false)}
              />

              {/* Modal */}
              <div className="relative z-10 w-full max-w-[480px] bg-[#0a0a0a] border border-white/15 rounded-[16px] overflow-hidden shadow-2xl">

                {/* Modal header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                  <div>
                    <p className="text-[14px] font-semibold text-white" style={{ letterSpacing: "-0.28px" }}>
                      Select Repository
                    </p>
                    <p className="text-[12px] text-[#555555] mt-0.5">
                      Choose a repository to scan
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRepoModalOpen(false)}
                    className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[#555555] hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>

                {/* Search */}
                <div className="px-4 py-3 border-b border-white/[0.07]">
                  <input
                    type="text"
                    placeholder="Search repositories…"
                    value={repoSearch}
                    onChange={(e) => setRepoSearch(e.target.value)}
                    className="w-full h-8 px-3 rounded-[6px] bg-white/[0.04] border border-white/10
                               text-[13px] text-white placeholder:text-[#444444] font-mono
                               focus:border-white/20 focus-visible:outline-none transition-colors"
                    style={{ letterSpacing: "-0.14px" }}
                  />
                </div>

                {/* Repo list */}
                <div className="max-h-[320px] overflow-y-auto">
                  {/* Manual entry */}
                  <div className="px-4 py-2 border-b border-white/[0.05]">
                    <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-[#444444] mb-2">
                      Enter manually
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="owner/repo"
                        value={manualRepo}
                        onChange={(e) => setManualRepo(e.target.value)}
                        className="flex-1 h-8 px-2.5 rounded-[6px] bg-white/[0.03] border border-white/10
                                   text-[12px] text-white placeholder:text-[#333333] font-mono
                                   focus:border-white/20 focus-visible:outline-none transition-colors"
                        style={{ letterSpacing: "-0.14px" }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (manualRepo.trim()) {
                            setSelectedRepo(manualRepo.trim())
                            setRepoModalOpen(false)
                            setManualRepo("")
                          }
                        }}
                        className="h-8 px-3 rounded-[6px] bg-white/[0.06] border border-white/10 text-[12px] text-[#a1a1aa] hover:text-white hover:bg-white/[0.10] transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* GitHub repos — fetched live */}
                  {(githubRepos.length > 0 || reposLoading || projects.length > 0) && (
                    <div className="px-4 py-2">
                      <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-[#444444] mb-2">
                        {reposLoading ? "Loading repositories…" : `Your repositories (${githubRepos.length || projects.length})`}
                      </p>

                      {/* All select */}
                      <label className="flex items-center gap-3 px-3 py-2.5 rounded-[8px] border border-white/[0.07] bg-white/[0.02] cursor-pointer hover:bg-white/[0.04] transition-colors mb-1.5">
                        <input
                          type="checkbox"
                          checked={repoAllSelected}
                          onChange={() => {
                            const next = !repoAllSelected
                            setRepoAllSelected(next)
                            const first = githubRepos[0]?.fullName ?? projects[0]?.repoFullName
                            if (next && first) setSelectedRepo(first)
                          }}
                          className="sr-only"
                        />
                        <span className={`w-4 h-4 rounded-[4px] border flex items-center justify-center flex-shrink-0 transition-colors ${
                          repoAllSelected ? "bg-white border-white" : "border-white/20"
                        }`}>
                          {repoAllSelected && <Check size={10} strokeWidth={3} className="text-black" />}
                        </span>
                        <span className="text-[13px] text-[#a1a1aa]" style={{ letterSpacing: "-0.26px" }}>
                          All repositories
                        </span>
                        <span className="ml-auto text-[11px] font-mono text-[#444444]">
                          {githubRepos.length || projects.length}
                        </span>
                      </label>

                      {/* Individual repos — prefer GitHub live list */}
                      {(githubRepos.length > 0 ? githubRepos.map(r => ({ repoFullName: r.fullName, id: r.fullName, targetUrl: null })) : projects)
                        .filter(p => !repoSearch || p.repoFullName.toLowerCase().includes(repoSearch.toLowerCase()))
                        .map((p) => {
                          const isOn = selectedRepo === p.repoFullName
                          return (
                            <label
                              key={p.id}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-[8px] border cursor-pointer transition-colors mb-1 ${
                                isOn ? "border-white/20 bg-white/[0.06]" : "border-transparent hover:bg-white/[0.03]"
                              }`}
                            >
                              <input
                                type="radio"
                                checked={isOn}
                                onChange={() => {
                                  setSelectedRepo(p.repoFullName)
                                  setRepoAllSelected(false)
                                }}
                                className="sr-only"
                              />
                              <span className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${
                                isOn ? "border-white bg-white" : "border-white/20"
                              }`}>
                                {isOn && <span className="w-1.5 h-1.5 rounded-full bg-black block" />}
                              </span>
                              <p className="text-[13px] font-mono text-white truncate flex-1" style={{ letterSpacing: "-0.14px" }}>
                                {p.repoFullName}
                              </p>
                              {isOn && <Check size={12} className="text-white flex-shrink-0" />}
                            </label>
                          )
                        })}
                    </div>
                  )}

                      {/* All select */}
                      <label className="flex items-center gap-3 px-3 py-2.5 rounded-[8px] border border-white/[0.07] bg-white/[0.02] cursor-pointer hover:bg-white/[0.04] transition-colors mb-1.5">
                        <input
                          type="checkbox"
                          checked={repoAllSelected}
                          onChange={() => {
                            const next = !repoAllSelected
                            setRepoAllSelected(next)
                            if (next && projects[0]) {
                              setSelectedRepo(projects[0].repoFullName)
                            }
                          }}
                          className="sr-only"
                        />
                        <span className={`w-4 h-4 rounded-[4px] border flex items-center justify-center flex-shrink-0 transition-colors ${
                          repoAllSelected ? "bg-white border-white" : "border-white/20"
                        }`}>
                          {repoAllSelected && <Check size={10} strokeWidth={3} className="text-black" />}
                        </span>
                        <span className="text-[13px] text-[#a1a1aa]" style={{ letterSpacing: "-0.26px" }}>
                          All repositories
                        </span>
                        <span className="ml-auto text-[11px] font-mono text-[#444444]">{projects.length}</span>
                      </label>

                      {/* Individual repos */}
                      {projects
                        .filter(p => !repoSearch || p.repoFullName.toLowerCase().includes(repoSearch.toLowerCase()))
                        .map((p) => {
                          const isOn = selectedRepo === p.repoFullName
                          return (
                            <label
                              key={p.id}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-[8px] border cursor-pointer transition-colors mb-1 ${
                                isOn
                                  ? "border-white/20 bg-white/[0.06]"
                                  : "border-transparent hover:bg-white/[0.03]"
                              }`}
                            >
                              <input
                                type="radio"
                                checked={isOn}
                                onChange={() => {
                                  setSelectedRepo(p.repoFullName)
                                  setRepoAllSelected(false)
                                }}
                                className="sr-only"
                              />
                              <span className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${
                                isOn ? "border-white bg-white" : "border-white/20"
                              }`}>
                                {isOn && <span className="w-1.5 h-1.5 rounded-full bg-black block" />}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-mono text-white truncate" style={{ letterSpacing: "-0.14px" }}>
                                  {p.repoFullName}
                                </p>
                                {p.targetUrl && (
                                  <p className="text-[11px] text-[#444444] truncate">{p.targetUrl}</p>
                                )}
                              </div>
                              {isOn && <Check size={12} className="text-white flex-shrink-0" />}
                            </label>
                          )
                        })}
                </div>

                {/* Modal footer */}
                <div className="flex items-center justify-between px-5 py-4 border-t border-white/10">
                  <span className="text-[12px] font-mono text-[#555555]">
                    {selectedRepo ? selectedRepo : "No repository selected"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRepoModalOpen(false)}
                    disabled={!selectedRepo}
                    className="h-8 px-4 rounded-[6px] bg-white text-black text-[13px] font-medium
                               hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Target URL */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#666666]">
            Target URL <span className="text-[#444444] normal-case">— for DAST (optional)</span>
          </span>
          <input
            name="targetUrl"
            type="url"
            placeholder="https://staging.example.com"
            className="h-10 px-3 rounded-[8px] bg-white/[0.02] border border-white/10
                       text-[14px] text-white placeholder:text-[#444444] font-mono
                       focus:border-white/25 focus:bg-white/[0.04]
                       focus-visible:outline-none transition-colors"
            style={{ letterSpacing: "-0.14px" }}
          />
        </label>
      </div>

      {/* Quick toolbar */}
      <div className="px-6 pt-4 pb-1 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMany(allIds, true)}
          className="h-7 px-2.5 rounded-[6px] text-[12px] text-[#a1a1aa] border border-white/10
                     hover:bg-white/5 hover:text-white transition-colors"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={() => setMany(allIds, false)}
          className="h-7 px-2.5 rounded-[6px] text-[12px] text-[#666666] border border-white/10
                     hover:bg-white/5 hover:text-[#a1a1aa] transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Tool matrix */}
      <div className="px-6 py-4 flex flex-col gap-6">
        {CATEGORY_ORDER.map((category) => {
          const tools = toolsByCategory(category)
          const ids = tools.map((t) => t.id)
          const allOn = ids.every((id) => selected.has(id))
          const meta = CATEGORY_META[category]
          return (
            <div key={category}>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-[#a1a1aa]">
                    {meta.label}
                  </span>
                  <span className="text-[11px] text-[#444444]">
                    {meta.description}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMany(ids, !allOn)}
                  className="text-[11px] font-mono text-[#555555] hover:text-[#a1a1aa] transition-colors"
                >
                  {allOn ? "deselect" : "select all"}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {tools.map((tool) => {
                  const isOn = selected.has(tool.id)
                  return (
                    <label
                      key={tool.id}
                      title={tool.blurb}
                      className={`group relative flex items-start gap-2.5 px-3 py-2.5 rounded-[9px] border cursor-pointer transition-colors
                        ${
                          isOn
                            ? "border-white/25 bg-white/[0.06]"
                            : "border-white/10 bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/15"
                        }`}
                    >
                      <input
                        type="checkbox"
                        name="tools"
                        value={tool.id}
                        checked={isOn}
                        onChange={() => toggle(tool.id)}
                        className="sr-only"
                      />
                      <span
                        className={`mt-0.5 w-4 h-4 rounded-[5px] flex items-center justify-center flex-shrink-0 border transition-colors
                          ${
                            isOn
                              ? "bg-white border-white text-black"
                              : "border-white/20 text-transparent"
                          }`}
                        aria-hidden="true"
                      >
                        <Check size={11} strokeWidth={2.5} />
                      </span>
                      <span className="min-w-0">
                        <span
                          className={`block text-[13px] font-medium truncate ${
                            isOn ? "text-white" : "text-[#a1a1aa]"
                          }`}
                          style={{ letterSpacing: "-0.26px" }}
                        >
                          {tool.label}
                        </span>
                        <span className="block text-[11px] text-[#555555] truncate">
                          {tool.blurb}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-6 py-5 border-t border-white/10 flex items-center justify-between gap-4">
        <div className="min-h-[20px]">
          {state.error ? (
            <p
              className="text-[12px] text-[#f87171] flex items-center gap-1.5"
              role="alert"
            >
              <span className="inline-block w-1 h-1 rounded-full bg-[#f87171]" />
              {state.error}
            </p>
          ) : state.ok ? (
            <p className="text-[12px] text-[#4ade80] flex items-center gap-1.5">
              <Sparkles size={12} />
              Scan queued — orchestrating {selected.size} scanners.
            </p>
          ) : (
            <p className="text-[12px] font-mono text-[#444444]">
              {selected.size} of 20 scanners selected
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={pending || selected.size === 0}
          className="inline-flex items-center justify-center gap-2 h-10 px-5
                     text-[13px] font-medium text-black bg-white rounded-[8px]
                     hover:bg-[#e5e5e5] active:bg-[#d4d4d4]
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors shadow-card flex-shrink-0"
          style={{ letterSpacing: "-0.26px" }}
        >
          <ScanIcon size={14} />
          {pending ? "Queuing…" : "Run scan"}
        </button>
      </div>
    </form>
    </>
  )
}
