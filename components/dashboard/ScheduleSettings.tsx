"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { updateProjectSettings, type ProjectActionState } from "@/app/dashboard/projects/actions"
import { TOOLS, CATEGORY_META } from "@/lib/tools"
import type { ScanTool } from "@/types"
import type { ProjectSettings } from "@/lib/db/queries"

const INIT: ProjectActionState = {}
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function Toggle({ name, value, onChange, label, hint }: {
  name: string; value: boolean; onChange: (v: boolean) => void; label: string; hint?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <p className="text-[13px] text-white" style={{ letterSpacing: "-0.26px" }}>{label}</p>
        {hint && <p className="text-[11px] text-[#555555] mt-0.5">{hint}</p>}
      </div>
      <input type="hidden" name={name} value={value ? "true" : "false"} />
      <button
        type="button"
        onClick={() => onChange(!value)}
        aria-pressed={value}
        className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0
          ${value ? "bg-[#4ade80]" : "bg-white/10"}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform
          ${value ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </button>
    </div>
  )
}

export function ScheduleSettings({ settings }: { settings: ProjectSettings }) {
  const router = useRouter()
  const [state, action, pending] = useActionState(updateProjectSettings, INIT)

  const [enabled, setEnabled] = useState(settings.scanScheduleEnabled)
  const [frequency, setFrequency] = useState(settings.scanFrequency)
  const [autoFix, setAutoFix] = useState(settings.autoFixEnabled)
  const [badge, setBadge] = useState(settings.badgePublic)
  const [tools, setTools] = useState<Set<ScanTool>>(
    new Set(settings.scheduledTools ?? ["semgrep", "gitleaks", "trivy"]),
  )

  useEffect(() => { if (state.ok) router.refresh() }, [state.ok, router])

  const toggleTool = (id: ScanTool) =>
    setTools(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })

  return (
    <form action={action} className="flex flex-col gap-7">
      <input type="hidden" name="projectId" value={settings.id} />

      {/* ── Scheduled scans ── */}
      <section className="border border-white/10 rounded-[12px] p-5 bg-white/[0.02]">
        <Toggle
          name="scanScheduleEnabled" value={enabled} onChange={setEnabled}
          label="Automatic scheduled scans"
          hint="Oculs queues a scan for you automatically on your chosen cadence."
        />

        {enabled && (
          <div className="mt-4 flex flex-col gap-4 pt-4 border-t border-white/[0.06]">
            {/* Frequency + time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#666666]">Frequency</label>
                <select
                  name="scanFrequency" value={frequency}
                  onChange={e => setFrequency(e.target.value)}
                  className="h-10 px-3 rounded-[8px] bg-white/[0.02] border border-white/10 text-[13px] text-white
                             focus:border-white/25 focus-visible:outline-none transition-colors"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#666666]">Time (UTC)</label>
                <select
                  name="scanHourUtc" defaultValue={settings.scanHourUtc}
                  className="h-10 px-3 rounded-[8px] bg-white/[0.02] border border-white/10 text-[13px] text-white
                             focus:border-white/25 focus-visible:outline-none transition-colors"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{String(h).padStart(2, "0")}:00 UTC</option>
                  ))}
                </select>
              </div>
            </div>

            {frequency === "weekly" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#666666]">Day of week</label>
                <select
                  name="scanDayOfWeek" defaultValue={settings.scanDayOfWeek}
                  className="h-10 px-3 rounded-[8px] bg-white/[0.02] border border-white/10 text-[13px] text-white
                             focus:border-white/25 focus-visible:outline-none transition-colors"
                >
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
            )}

            {/* Tools */}
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#666666]">Tools to run</label>
              <div className="max-h-[220px] overflow-y-auto flex flex-col gap-1 pr-1">
                {TOOLS.map(t => {
                  const on = tools.has(t.id as ScanTool)
                  return (
                    <label key={t.id}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-[8px] cursor-pointer transition-colors
                        ${on ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}>
                      <input
                        type="checkbox" name="tools" value={t.id} checked={on}
                        onChange={() => toggleTool(t.id as ScanTool)} className="sr-only"
                      />
                      <span className={`w-4 h-4 rounded-[4px] border flex items-center justify-center flex-shrink-0
                        ${on ? "border-white bg-white" : "border-white/20"}`}>
                        {on && <span className="w-1.5 h-1.5 rounded-[1px] bg-black block" />}
                      </span>
                      <span className="text-[13px] text-white flex-1 truncate" style={{ letterSpacing: "-0.26px" }}>
                        {(t as any).label || (t as any).name || t.id}
                      </span>
                      <span className="text-[10px] font-mono uppercase tracking-[0.06em] text-[#555555]">
                        {CATEGORY_META[t.category]?.label ?? t.category}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Policies ── */}
      <section className="border border-white/10 rounded-[12px] p-5 bg-white/[0.02] flex flex-col gap-1">
        <div className="flex flex-col gap-1.5 pb-3">
          <label className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#666666]">PR / merge gate threshold</label>
          <select
            name="gateThreshold" defaultValue={settings.gateThreshold}
            className="h-10 px-3 rounded-[8px] bg-white/[0.02] border border-white/10 text-[13px] text-white
                       focus:border-white/25 focus-visible:outline-none transition-colors"
          >
            <option value="off">Off — never block merges</option>
            <option value="critical">Block on Critical</option>
            <option value="high">Block on High or above</option>
            <option value="medium">Block on Medium or above</option>
          </select>
          <p className="text-[11px] text-[#555555] mt-0.5">
            Posts a GitHub commit status. Enable branch protection on the check named <span className="font-mono text-[#888]">oculs/security</span>.
          </p>
        </div>

        <div className="border-t border-white/[0.06] pt-1">
          <Toggle name="autoFixEnabled" value={autoFix} onChange={setAutoFix}
            label="One-click AI-fix pull requests" hint="Allow Oculs to open fix PRs on this repository." />
          <Toggle name="badgePublic" value={badge} onChange={setBadge}
            label="Public security badge" hint="Expose a live grade at /api/badge for README embedding." />
        </div>
      </section>

      {state.error && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-[8px] border border-[#f87171]/20 bg-[#f87171]/[0.04]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#f87171] flex-shrink-0" />
          <p className="text-[12px] text-[#f87171]">{state.error}</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending}
          className="h-10 px-5 rounded-[8px] bg-white text-black text-[13px] font-medium
                     hover:bg-white/90 disabled:opacity-50 transition-colors" style={{ letterSpacing: "-0.26px" }}>
          {pending ? "Saving…" : "Save settings"}
        </button>
        {state.ok && <span className="text-[12px] font-mono text-[#4ade80]">Saved ✓</span>}
      </div>
    </form>
  )
}