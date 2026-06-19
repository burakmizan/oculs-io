"use client"

import { useEffect, useRef, useState } from "react"
import { SEVERITY_STYLES } from "@/lib/severity"
import { setFindingStatus } from "@/app/dashboard/findings/actions"
import type { SeverityLevel } from "@/types"

export interface FindingRow {
  id: string
  title: string
  severity: string
  tool: string
  ruleId?: string | null
  description?: string | null
  cweId?: string | null
  owaspCategory?: string | null
  cvssScore?: string | null
  filePath?: string | null
  lineStart?: number | null
  lineEnd?: number | null
  targetUrl?: string | null
  codeSnippet?: string | null
  remediation?: string | null
  aiFixPatch?: string | null
  aiFixExplanation?: string | null
  references?: string[] | null
  repoFullName?: string | null
  status?: string | null
  count: number
  lines: number[]
}

function AskOculs({ finding }: { finding: FindingRow }) {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const ask = async () => {
    const q = question.trim()
    if (!q || loading) return
    setLoading(true)
    setAnswer(null)
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          context: {
            title: finding.title,
            severity: finding.severity,
            filePath: finding.filePath,
            lineStart: finding.lineStart,
            cweId: finding.cweId,
            owaspCategory: finding.owaspCategory,
            codeSnippet: finding.codeSnippet,
            description: finding.description,
            remediation: finding.remediation,
          },
        }),
      })
      const data = await res.json() as { answer?: string; error?: string }
      setAnswer(data.answer ?? data.error ?? "No response.")
    } catch {
      setAnswer("Request failed. Check your connection.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mb-6 border border-white/[0.08] rounded-[10px] overflow-hidden">
      <button
        type="button"
        onClick={() => { setOpen(v => !v); setTimeout(() => inputRef.current?.focus(), 50) }}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#60a5fa]">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinejoin="round" />
          </svg>
          <span className="text-[12px] font-mono text-[#a1a1aa]">Ask Oculs about this finding</span>
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`text-[#555555] transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-white/[0.06]">
          <div className="flex gap-2 mt-3">
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") ask() }}
              placeholder="How does this affect me? Can it be exploited? How do I test it?"
              className="flex-1 h-8 px-3 rounded-[6px] bg-white/[0.04] border border-white/10 text-[12px]
                         font-mono text-white placeholder:text-[#444444] focus:outline-none focus:border-white/25"
            />
            <button
              type="button"
              onClick={ask}
              disabled={loading || !question.trim()}
              className="h-8 px-3 rounded-[6px] bg-white/[0.08] border border-white/10 text-[12px] font-mono
                         text-[#a1a1aa] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "…" : "Ask"}
            </button>
          </div>
          {answer && (
            <div className="mt-3 text-[12px] leading-relaxed text-[#a1a1aa] bg-white/[0.02] border border-white/[0.06]
                            rounded-[8px] p-3 whitespace-pre-wrap" style={{ letterSpacing: "-0.24px" }}>
              {answer}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-white/[0.06]">
      <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#555555] flex-shrink-0">{label}</span>
      <span className="text-[12px] font-mono text-[#cccccc] text-right break-all">{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="text-[11px] font-mono uppercase tracking-[0.08em] text-[#666666] mb-2.5">{title}</p>
      {children}
    </div>
  )
}

function MuteButton({ finding, onDone }: { finding: FindingRow; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const isMuted = finding.status === "false_positive" || finding.status === "dismissed"

  const run = async () => {
    setBusy(true)
    const res = await setFindingStatus(finding.id, isMuted ? "open" : "dismissed")
    setBusy(false)
    if (res.ok) onDone()
  }

  return (
    <button
      type="button" onClick={run} disabled={busy}
      className={`h-8 px-3 rounded-[6px] border text-[11px] font-mono transition-colors disabled:opacity-50
        ${isMuted
          ? "border-white/10 text-[#888888] hover:text-white hover:bg-white/5"
          : "border-[#fbbf24]/20 text-[#fbbf24] hover:bg-[#fbbf24]/10"}`}
    >
      {busy ? "…" : isMuted ? "Restore" : "Mute (false positive)"}
    </button>
  )
}

export function FindingDrawer({
  finding,
  onClose,
  onPrev,
  onNext,
}: {
  finding: FindingRow | null
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
}) {
  useEffect(() => {
    if (!finding) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return }
      const tag = (document.activeElement as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      if ((e.key === "j" || e.key === "J") && onNext) { e.preventDefault(); onNext() }
      if ((e.key === "k" || e.key === "K") && onPrev) { e.preventDefault(); onPrev() }
    }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [finding, onClose, onPrev, onNext])

  if (!finding) return null

  const sev = SEVERITY_STYLES[finding.severity as SeverityLevel] ?? SEVERITY_STYLES.info
  const location = finding.filePath
    ? `${finding.filePath}${finding.lineStart ? `:${finding.lineStart}` : ""}`
    : finding.targetUrl ?? "—"

  return (
    <div className="fixed inset-0 z-[80] flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-fade-in" onClick={onClose} aria-hidden />

      <div
        role="dialog" aria-modal="true" aria-label={finding.title}
        className="relative h-full w-full max-w-[520px] bg-[#0a0a0a] border-l border-white/10
                   overflow-y-auto animate-drawer-in oculs-grid"
      >
        <div className="sticky top-0 z-10 bg-[#0a0a0a]/95 backdrop-blur border-b border-white/10 px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {/* FALSE POSITIVE badge — shown ONLY when AI or user marked it as such */}
                {finding.status === "false_positive" && (
                  <span className="inline-flex items-center h-5 px-2 rounded-[4px] border
                                   border-[#f87171]/40 bg-[#f87171]/10 text-[#f87171]
                                   text-[10px] font-mono uppercase tracking-[0.04em]">
                    False Positive
                  </span>
                )}
                <span className={`inline-flex items-center h-5 px-2 rounded-[4px] border text-[10px] font-mono uppercase tracking-[0.04em] ${sev.badge}`}>
                  {finding.severity}
                </span>
                <span className="text-[11px] font-mono text-[#555555]">{finding.tool}</span>
                {finding.count > 1 && (
                  <span className="text-[11px] font-mono text-[#555555]">· {finding.count}× occurrences</span>
                )}
              </div>
              <h2 className="text-[16px] font-semibold text-white leading-snug" style={{ letterSpacing: "-0.4px" }}>
                {finding.title}
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <MuteButton finding={finding} onDone={onClose} />
              <div className="flex items-center border border-white/10 rounded-[6px] overflow-hidden">
                <button
                  onClick={onPrev} disabled={!onPrev} aria-label="Previous finding (K)"
                  className="w-8 h-8 flex items-center justify-center text-[#888888]
                             hover:text-white hover:bg-white/5 transition-colors
                             disabled:opacity-30 disabled:cursor-not-allowed border-r border-white/10"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  onClick={onNext} disabled={!onNext} aria-label="Next finding (J)"
                  className="w-8 h-8 flex items-center justify-center text-[#888888]
                             hover:text-white hover:bg-white/5 transition-colors
                             disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              <button
                onClick={onClose} aria-label="Close"
                className="w-8 h-8 rounded-[6px] border border-white/10 text-[#888888]
                           hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="mb-6">
            <MetaRow label="Rule" value={finding.ruleId || "—"} />
            <MetaRow label="Location" value={location} />
            {finding.cweId && <MetaRow label="CWE" value={finding.cweId} />}
            {finding.owaspCategory && <MetaRow label="OWASP" value={finding.owaspCategory} />}
            {finding.cvssScore && <MetaRow label="CVSS" value={finding.cvssScore} />}
            {finding.lines.length > 1 && <MetaRow label="Lines" value={finding.lines.slice(0, 12).join(", ")} />}
          </div>

          {finding.description && (
            <Section title="Description">
              <p className="text-[13px] leading-relaxed text-[#a1a1aa]" style={{ letterSpacing: "-0.26px" }}>{finding.description}</p>
            </Section>
          )}

          {finding.codeSnippet && (
            <Section title="Vulnerable code">
              <pre className="text-[11.5px] font-mono text-[#cbd5e1] bg-black/40 border border-white/10 rounded-[8px] p-3.5 overflow-x-auto leading-relaxed whitespace-pre">{finding.codeSnippet}</pre>
            </Section>
          )}

          {finding.remediation && (
            <Section title="Remediation">
              <p className="text-[13px] leading-relaxed text-[#a1a1aa]" style={{ letterSpacing: "-0.26px" }}>{finding.remediation}</p>
            </Section>
          )}

          <AskOculs finding={finding} />

          {finding.aiFixPatch && (
            <Section title="AI-suggested fix">
              {finding.aiFixExplanation && (
                <p className="text-[12px] leading-relaxed text-[#888888] mb-2.5" style={{ letterSpacing: "-0.24px" }}>{finding.aiFixExplanation}</p>
              )}
              <pre className="text-[11.5px] font-mono bg-black/40 border border-white/10 rounded-[8px] p-3.5 overflow-x-auto leading-relaxed whitespace-pre">
                {finding.aiFixPatch.split("\n").map((line, i) => (
                  <div key={i} className={
                    line.startsWith("+") && !line.startsWith("+++") ? "text-[#4ade80]"
                    : line.startsWith("-") && !line.startsWith("---") ? "text-[#f87171]"
                    : "text-[#888888]"
                  }>{line || " "}</div>
                ))}
              </pre>
            </Section>
          )}

          {finding.references && finding.references.length > 0 && (
            <Section title="References">
              <ul className="flex flex-col gap-1.5">
                {finding.references.filter(Boolean).map((ref, i) => (
                  <li key={i}>
                    <a href={ref} target="_blank" rel="noopener noreferrer"
                      className="text-[12px] font-mono text-[#60a5fa] hover:underline break-all">{ref}</a>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}