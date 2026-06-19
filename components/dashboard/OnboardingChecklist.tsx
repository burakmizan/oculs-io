"use client"

import { useState } from "react"
import Link from "next/link"
import type { OnboardingStatus } from "@/lib/db/queries"

interface Step {
  key: keyof OnboardingStatus
  label: string
  detail: string
  href: string
}

const STEPS: Step[] = [
  { key: "hasProject",        label: "Create a project",       detail: "Connect a GitHub repository.",                     href: "/dashboard/projects/new" },
  { key: "hasCompletedScan",  label: "Run your first scan",    detail: "Scan a repository for vulnerabilities.",            href: "/dashboard/scans" },
  { key: "hasAppliedFix",     label: "Apply an AI fix",        detail: "Apply an AI-generated fix to a finding.",           href: "/dashboard/findings" },
  { key: "hasScheduledScan",  label: "Schedule a scan",        detail: "Enable automatic recurring scans on a project.",    href: "/dashboard/projects" },
]

function CheckIcon({ done }: { done: boolean }) {
  return done ? (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
      <circle cx="8" cy="8" r="7.5" fill="#4ade80" fillOpacity="0.15" stroke="#4ade80" strokeOpacity="0.5" />
      <path d="M5 8l2 2 4-4" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
      <circle cx="8" cy="8" r="7.5" stroke="rgba(255,255,255,0.15)" />
    </svg>
  )
}

export function OnboardingChecklist({
  status,
  onDismiss,
}: {
  status: OnboardingStatus
  onDismiss: () => void
}) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const done = STEPS.filter(s => status[s.key]).length
  const total = STEPS.length
  const pct = Math.round((done / total) * 100)

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss()
  }

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-[12px] mb-8 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
        <div className="flex items-center gap-3">
          <h2 className="text-[13px] font-mono uppercase tracking-[0.08em] text-[#a1a1aa]">Getting Started</h2>
          <div className="flex items-center gap-2">
            <div className="w-24 h-1 bg-white/[0.08] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: pct === 100 ? "#4ade80" : "rgba(255,255,255,0.3)" }}
              />
            </div>
            <span className="text-[11px] font-mono text-[#555555]">{done}/{total}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="w-6 h-6 flex items-center justify-center text-[#444444] hover:text-white transition-colors rounded"
          aria-label="Dismiss checklist"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <ul className="divide-y divide-white/[0.04]">
        {STEPS.map(step => {
          const isDone = !!status[step.key]
          return (
            <li key={step.key}>
              <Link
                href={isDone ? "#" : step.href}
                onClick={isDone ? e => e.preventDefault() : undefined}
                className={`flex items-center gap-4 px-5 py-3.5 transition-colors
                  ${isDone ? "cursor-default" : "hover:bg-white/[0.02]"}`}
              >
                <CheckIcon done={isDone} />
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] transition-colors ${isDone ? "line-through text-[#444444]" : "text-white"}`}
                    style={{ letterSpacing: "-0.26px" }}>
                    {step.label}
                  </p>
                  {!isDone && (
                    <p className="text-[11px] text-[#555555] mt-0.5">{step.detail}</p>
                  )}
                </div>
                {!isDone && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[#555555] flex-shrink-0">
                    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
