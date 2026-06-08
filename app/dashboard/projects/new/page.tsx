"use client"

import { useActionState, useState } from "react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { createProject, type ProjectActionState } from "@/app/dashboard/projects/actions"

const INIT: ProjectActionState = {}

export default function NewProjectPage() {
  const router = useRouter()
  const [state, action, pending] = useActionState(createProject, INIT)
  const [targetEntries, setTargetEntries] = useState<string[]>([""])

  useEffect(() => {
    if (state.ok) router.push("/dashboard/projects")
  }, [state.ok, router])

  function addTargetEntry() {
    setTargetEntries((p) => [...p, ""])
  }

  function updateTargetEntry(i: number, val: string) {
    setTargetEntries((p) => p.map((v, idx) => (idx === i ? val : v)))
  }

  function removeTargetEntry(i: number) {
    setTargetEntries((p) => p.filter((_, idx) => idx !== i))
  }

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

        {/* GitHub repo */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#666666]">
            GitHub Repository <span className="text-[#f87171]">*</span>
          </label>
          <input
            name="repoFullName"
            type="text"
            placeholder="owner/repo or https://github.com/owner/repo"
            required
            className="h-10 px-3 rounded-[8px] bg-white/[0.02] border border-white/10
                       text-[14px] text-white placeholder:text-[#444444] font-mono
                       focus:border-white/25 focus:bg-white/[0.04]
                       focus-visible:outline-none transition-colors"
            style={{ letterSpacing: "-0.14px" }}
          />
        </div>

        {/* Target URLs — unlimited */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#666666]">
              Live Target URLs <span className="text-[#444444] normal-case tracking-normal">— for DAST (optional)</span>
            </label>
            <button
              type="button"
              onClick={addTargetEntry}
              className="text-[11px] font-mono text-[#555555] hover:text-[#a1a1aa] transition-colors"
            >
              + Add subdomain
            </button>
          </div>
          {targetEntries.map((val, i) => (
            <div key={i} className="flex gap-2">
              <input
                name={i === 0 ? "targetUrl" : `targetUrl_${i}`}
                type="url"
                value={val}
                onChange={(e) => updateTargetEntry(i, e.target.value)}
                placeholder="https://staging.example.com"
                className="flex-1 h-10 px-3 rounded-[8px] bg-white/[0.02] border border-white/10
                           text-[14px] text-white placeholder:text-[#444444] font-mono
                           focus:border-white/25 focus:bg-white/[0.04]
                           focus-visible:outline-none transition-colors"
                style={{ letterSpacing: "-0.14px" }}
              />
              {targetEntries.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTargetEntry(i)}
                  className="w-10 h-10 rounded-[8px] border border-white/10 text-[#555555]
                             hover:text-[#f87171] hover:border-[#f87171]/30 transition-colors flex items-center justify-center"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Server IP */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#666666]">
            Server IP <span className="text-[#444444] normal-case tracking-normal">— for network scans (optional)</span>
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

        {/* Error */}
        {state.error && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-[8px] border border-[#f87171]/20 bg-[#f87171]/[0.04]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f87171] flex-shrink-0" />
            <p className="text-[12px] text-[#f87171]">{state.error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="h-10 px-5 rounded-[8px] bg-white text-black text-[13px] font-medium
                       hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ letterSpacing: "-0.26px" }}
          >
            {pending ? "Creating…" : "Create Project"}
          </button>
          <a
            href="/dashboard/projects"
            className="h-10 px-4 rounded-[8px] border border-white/10 text-[13px] text-[#666666]
                       hover:text-white hover:bg-white/5 transition-colors flex items-center"
            style={{ letterSpacing: "-0.26px" }}
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  )
}