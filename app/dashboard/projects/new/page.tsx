"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createProject, type ProjectActionState } from "@/app/dashboard/projects/actions"

const INIT: ProjectActionState = {}

export default function NewProjectPage() {
  const router = useRouter()
  const [state, action, pending] = useActionState(createProject, INIT)
  const [targetEntries, setTargetEntries] = useState<string[]>([""])

  // GitHub repos
  const [githubRepos, setGithubRepos] = useState<{ fullName: string; private: boolean; language: string | null }[]>([])
  const [reposLoading, setReposLoading] = useState(false)
  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false)
  const [repoSearch, setRepoSearch] = useState("")
  const [selectedRepo, setSelectedRepo] = useState("")
  const [manualRepo, setManualRepo] = useState("")
  const [useManual, setUseManual] = useState(false)

  useEffect(() => {
    // Fetch GitHub repos on mount
    setReposLoading(true)
    fetch("/api/github/repos")
      .then(r => r.json())
      .then(d => { if (d.repos) setGithubRepos(d.repos) })
      .catch(() => {})
      .finally(() => setReposLoading(false))
  }, [])

  useEffect(() => {
    if (state.ok) router.push("/dashboard/projects")
  }, [state.ok, router])

  const filteredRepos = githubRepos.filter(r =>
    !repoSearch || r.fullName.toLowerCase().includes(repoSearch.toLowerCase())
  )

  function addTarget() { setTargetEntries(p => [...p, ""]) }
  function updateTarget(i: number, v: string) {
    setTargetEntries(p => p.map((x, idx) => idx === i ? v : x))
  }
  function removeTarget(i: number) {
    setTargetEntries(p => p.filter((_, idx) => idx !== i))
  }

  const repoValue = useManual ? manualRepo : selectedRepo

  return (
    <div className="p-8 max-w-[640px] mx-auto">
      <div className="mb-6">
        <p className="text-[14px] text-[#666666]" style={{ letterSpacing: "-0.28px" }}>
          Connect a repository and configure scan targets.
        </p>
      </div>

      <form action={action} className="flex flex-col gap-5">

        {/* Project name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#666666]">
            Project Name <span className="text-[#f87171]">*</span>
          </label>
          <input
            name="name"
            type="text"
            placeholder="Core API"
            maxLength={80}
            required
            className="h-10 px-3 rounded-[8px] bg-white/[0.02] border border-white/10
                       text-[14px] text-white placeholder:text-[#444444]
                       focus:border-white/25 focus:bg-white/[0.04]
                       focus-visible:outline-none transition-colors"
            style={{ letterSpacing: "-0.28px" }}
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#666666]">
            Description <span className="text-[#444444] normal-case tracking-normal">— optional</span>
          </label>
          <textarea
            name="description"
            placeholder="Backend REST API powering the main product"
            rows={2}
            maxLength={280}
            className="px-3 py-2.5 rounded-[8px] bg-white/[0.02] border border-white/10
                       text-[14px] text-white placeholder:text-[#444444] resize-none
                       focus:border-white/25 focus:bg-white/[0.04]
                       focus-visible:outline-none transition-colors"
            style={{ letterSpacing: "-0.28px" }}
          />
        </div>

        {/* GitHub repo — switcher */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#666666]">
              GitHub Repository <span className="text-[#f87171]">*</span>
            </label>
            <button
              type="button"
              onClick={() => setUseManual(m => !m)}
              className="text-[11px] font-mono text-[#555555] hover:text-[#a1a1aa] transition-colors"
            >
              {useManual ? "← Pick from list" : "Enter manually →"}
            </button>
          </div>

          {/* Hidden field for form submission */}
          <input type="hidden" name="repoFullName" value={repoValue} />

          {useManual ? (
            /* Manual input */
            <input
              type="text"
              value={manualRepo}
              onChange={e => setManualRepo(e.target.value)}
              placeholder="owner/repo or https://github.com/owner/repo"
              className="h-10 px-3 rounded-[8px] bg-white/[0.02] border border-white/10
                         text-[14px] text-white placeholder:text-[#444444] font-mono
                         focus:border-white/25 focus:bg-white/[0.04]
                         focus-visible:outline-none transition-colors"
              style={{ letterSpacing: "-0.14px" }}
            />
          ) : (
            /* Dropdown switcher */
            <div className="relative">
              <button
                type="button"
                onClick={() => setRepoDropdownOpen(o => !o)}
                className={`w-full flex items-center justify-between h-10 px-3 rounded-[8px] border text-left transition-colors
                  ${selectedRepo
                    ? "border-white/25 bg-white/[0.04] text-white"
                    : "border-white/10 bg-white/[0.02] text-[#444444]"
                  }`}
              >
                <span className="text-[13px] font-mono truncate" style={{ letterSpacing: "-0.14px" }}>
                  {reposLoading ? "Loading repositories…" : selectedRepo || "Select a repository…"}
                </span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0 ml-2 text-[#555555]">
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {repoDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50
                                bg-[#0a0a0a] border border-white/15 rounded-[10px] overflow-hidden shadow-2xl">
                  {/* Search */}
                  <div className="p-2 border-b border-white/[0.07]">
                    <input
                      type="text"
                      placeholder="Search repositories…"
                      value={repoSearch}
                      onChange={e => setRepoSearch(e.target.value)}
                      autoFocus
                      className="w-full h-8 px-3 rounded-[6px] bg-white/[0.04] border border-white/10
                                 text-[12px] text-white placeholder:text-[#444444] font-mono
                                 focus:border-white/20 focus-visible:outline-none transition-colors"
                    />
                  </div>

                  {/* Repo list */}
                  <div className="max-h-[240px] overflow-y-auto">
                    {reposLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <span className="text-[12px] font-mono text-[#444444]">Loading…</span>
                      </div>
                    ) : filteredRepos.length === 0 ? (
                      <div className="flex items-center justify-center py-8">
                        <span className="text-[12px] font-mono text-[#444444]">No repositories found</span>
                      </div>
                    ) : filteredRepos.map(r => {
                      const isOn = selectedRepo === r.fullName
                      return (
                        <button
                          key={r.fullName}
                          type="button"
                          onClick={() => {
                            setSelectedRepo(r.fullName)
                            setRepoDropdownOpen(false)
                            setRepoSearch("")
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors
                            ${isOn ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}
                        >
                          <span className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                            isOn ? "border-white bg-white" : "border-white/20"
                          }`}>
                            {isOn && <span className="w-1.5 h-1.5 rounded-full bg-black block" />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-mono text-white truncate" style={{ letterSpacing: "-0.14px" }}>
                              {r.fullName}
                            </p>
                            {r.language && (
                              <p className="text-[10px] font-mono text-[#444444]">{r.language}</p>
                            )}
                          </div>
                          {r.private && (
                            <span className="text-[10px] font-mono text-[#555555] border border-white/10 px-1.5 py-0.5 rounded-[4px]">
                              private
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Target URLs */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#666666]">
              Live Target URLs <span className="text-[#444444] normal-case tracking-normal">— DAST (optional)</span>
            </label>
            <button type="button" onClick={addTarget}
              className="text-[11px] font-mono text-[#555555] hover:text-[#a1a1aa] transition-colors">
              + Add subdomain
            </button>
          </div>
          {targetEntries.map((val, i) => (
            <div key={i} className="flex gap-2">
              <input
                name={i === 0 ? "targetUrl" : `targetUrl_${i}`}
                type="url"
                value={val}
                onChange={e => updateTarget(i, e.target.value)}
                placeholder="https://staging.example.com"
                className="flex-1 h-10 px-3 rounded-[8px] bg-white/[0.02] border border-white/10
                           text-[14px] text-white placeholder:text-[#444444] font-mono
                           focus:border-white/25 focus:bg-white/[0.04]
                           focus-visible:outline-none transition-colors"
                style={{ letterSpacing: "-0.14px" }}
              />
              {targetEntries.length > 1 && (
                <button type="button" onClick={() => removeTarget(i)}
                  className="w-10 h-10 rounded-[8px] border border-white/10 text-[#555555]
                             hover:text-[#f87171] hover:border-[#f87171]/30 transition-colors
                             flex items-center justify-center">
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Server IP */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#666666]">
            Server IP <span className="text-[#444444] normal-case tracking-normal">— network scans (optional)</span>
          </label>
          <input
            name="serverIp"
            type="text"
            placeholder="192.168.1.100 or 203.0.113.42"
            className="h-10 px-3 rounded-[8px] bg-white/[0.02] border border-white/10
                       text-[14px] text-white placeholder:text-[#444444] font-mono
                       focus:border-white/25 focus:bg-white/[0.04]
                       focus-visible:outline-none transition-colors"
            style={{ letterSpacing: "-0.14px" }}
          />
        </div>

        {state.error && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-[8px] border border-[#f87171]/20 bg-[#f87171]/[0.04]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f87171] flex-shrink-0" />
            <p className="text-[12px] text-[#f87171]">{state.error}</p>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={pending || !repoValue}
            className="h-10 px-5 rounded-[8px] bg-white text-black text-[13px] font-medium
                       hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ letterSpacing: "-0.26px" }}
          >
            {pending ? "Creating…" : "Create Project"}
          </button>
          <a href="/dashboard/projects"
            className="h-10 px-4 rounded-[8px] border border-white/10 text-[13px] text-[#666666]
                       hover:text-white hover:bg-white/5 transition-colors flex items-center"
            style={{ letterSpacing: "-0.26px" }}>
            Cancel
          </a>
        </div>
      </form>
    </div>
  )
}