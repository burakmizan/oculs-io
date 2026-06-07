"use client"

import { useActionState, useMemo, useState } from "react"
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

  return (
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

      {/* Target inputs */}
      <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-3 border-b border-white/10">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#666666] flex items-center gap-1.5">
            <GitBranch size={11} /> Repository
          </span>
          <input
            name="repoFullName"
            list="oculs-projects"
            placeholder="owner/repo"
            required
            className="h-10 px-3 rounded-[8px] bg-white/[0.02] border border-white/10
                       text-[14px] text-white placeholder:text-[#444444] font-mono
                       focus:border-white/25 focus:bg-white/[0.04]
                       focus-visible:outline-none transition-colors"
            style={{ letterSpacing: "-0.14px" }}
          />
          <datalist id="oculs-projects">
            {projects.map((p) => (
              <option key={p.id} value={p.repoFullName} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#666666]">
            Target URL{" "}
            <span className="text-[#444444] normal-case">— for DAST (optional)</span>
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
  )
}
