"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

interface ProjectLite { id: string; name?: string | null; repoFullName?: string | null }

interface Command {
  id: string
  label: string
  hint?: string
  group: string
  href: string
}

export function CommandPalette({ projects = [] }: { projects?: ProjectLite[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = [
      { id: "nav-overview", label: "Overview", group: "Navigate", href: "/dashboard" },
      { id: "nav-projects", label: "Projects", group: "Navigate", href: "/dashboard/projects" },
      { id: "nav-scans", label: "Scans", group: "Navigate", href: "/dashboard/scans" },
      { id: "nav-findings", label: "Findings", group: "Navigate", href: "/dashboard/findings" },
      { id: "nav-settings", label: "Settings", group: "Navigate", href: "/dashboard/settings" },
    ]
    const actions: Command[] = [
      { id: "act-scan", label: "New scan", hint: "Run security tools", group: "Actions", href: "/dashboard/scans" },
      { id: "act-project", label: "Add project", hint: "Connect a repository", group: "Actions", href: "/dashboard/projects/new" },
    ]
    const proj: Command[] = projects.map((p) => ({
      id: `proj-${p.id}`,
      label: p.name || p.repoFullName || "Untitled project",
      hint: p.repoFullName ?? undefined,
      group: "Projects",
      href: `/dashboard/projects/${p.id}/settings`,
    }))
    return [...nav, ...actions, ...proj]
  }, [projects])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        (c.hint ?? "").toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q),
    )
  }, [commands, query])

  // Global ⌘K / Ctrl+K toggle + a custom event hook (so other UI can open it)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === "Escape") {
        setOpen(false)
      }
    }
    const onOpenEvent = () => setOpen(true)
    window.addEventListener("keydown", onKey)
    window.addEventListener("oculs:open-command", onOpenEvent as EventListener)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("oculs:open-command", onOpenEvent as EventListener)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setQuery("")
      setActive(0)
      document.body.style.overflow = "hidden"
      requestAnimationFrame(() => inputRef.current?.focus())
    } else {
      document.body.style.overflow = ""
    }
  }, [open])

  useEffect(() => { setActive(0) }, [query])

  const run = (cmd: Command) => {
    setOpen(false)
    router.push(cmd.href)
  }

  const onKeyNav = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === "Enter") { e.preventDefault(); const c = filtered[active]; if (c) run(c) }
  }

  if (!open) return null

  const groups = ["Navigate", "Actions", "Projects"]

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-fade-in" onClick={() => setOpen(false)} aria-hidden />

      <div
        role="dialog" aria-modal="true" aria-label="Command palette"
        onKeyDown={onKeyNav}
        className="relative w-full max-w-[560px] bg-[#0a0a0a] border border-white/12 rounded-[14px]
                   shadow-card-lg overflow-hidden animate-fade-in oculs-grid"
      >
        <div className="flex items-center gap-3 px-4 h-12 border-b border-white/10">
          <span className="text-[#555555] text-[13px] font-mono">⌘K</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or jump to…"
            className="flex-1 bg-transparent text-[14px] text-white placeholder:text-[#555555] outline-none font-mono"
            style={{ letterSpacing: "-0.14px" }}
          />
          <kbd className="text-[10px] font-mono text-[#555555] border border-white/10 rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        <div className="max-h-[360px] overflow-y-auto py-2">
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-center text-[13px] text-[#555555] font-mono">No matches</p>
          )}
          {groups.map((group) => {
            const items = filtered.filter((c) => c.group === group)
            if (items.length === 0) return null
            return (
              <div key={group} className="mb-1">
                <p className="px-4 py-1.5 text-[10px] font-mono uppercase tracking-[0.08em] text-[#444444]">{group}</p>
                {items.map((cmd) => {
                  const idx = filtered.indexOf(cmd)
                  const isActive = idx === active
                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => run(cmd)}
                      className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 transition-colors
                        ${isActive ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}
                    >
                      <span className="text-[13px] text-white truncate" style={{ letterSpacing: "-0.26px" }}>{cmd.label}</span>
                      {cmd.hint && <span className="text-[11px] font-mono text-[#555555] truncate flex-shrink-0">{cmd.hint}</span>}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-4 px-4 h-9 border-t border-white/10 text-[10px] font-mono text-[#444444]">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}