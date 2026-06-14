"use client"

import { useEffect, useState, useCallback } from "react"
import type { VulnerabilityRow } from "@/lib/db/queries"

interface FixCard {
  vulnerabilityId: string
  title: string
  severity: string
  filePath: string | null
  lineStart: number | null
  findText: string
  replaceText: string
  explanation: string
  isFalsePositive: boolean
}

interface Props {
  scanId: string
  repoName: string
  repository: string
  findings: (VulnerabilityRow & { count: number })[]
}

const SEV_COLOR: Record<string, string> = {
  critical: "text-[#f87171] border-[#f87171]/30 bg-[#f87171]/5",
  high:     "text-[#fb923c] border-[#fb923c]/30 bg-[#fb923c]/5",
  medium:   "text-[#fbbf24] border-[#fbbf24]/30 bg-[#fbbf24]/5",
  low:      "text-[#60a5fa] border-[#60a5fa]/30 bg-[#60a5fa]/5",
  info:     "text-[#a1a1aa] border-white/10 bg-white/[0.02]",
}

function CodeBlock({ label, code, accent }: { label: string; code: string; accent: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(code).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-mono uppercase tracking-[0.08em] ${accent}`}>{label}</span>
        <button
          type="button" onClick={copy}
          className="text-[10px] font-mono text-[#555555] hover:text-white transition-colors"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <pre className="text-[11.5px] font-mono text-[#cbd5e1] bg-black/50 border border-white/10
                      rounded-[8px] p-3.5 overflow-x-auto leading-relaxed whitespace-pre">
        {code || "(empty — remove these lines)"}
      </pre>
    </div>
  )
}

function PushButton({
  card, repository, onDone,
}: {
  card: FixCard
  repository: string
  onDone: (commitUrl: string | null) => void
}) {
  const [state, setState] = useState<"idle" | "pushing" | "done" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [commitUrl, setCommitUrl] = useState<string | null>(null)

  const push = async () => {
    if (!card.filePath) {
      setErrorMsg("No file path — cannot auto-push.")
      setState("error")
      return
    }
    setState("pushing")
    try {
      const res = await fetch("/api/fix/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vulnerabilityId: card.vulnerabilityId,
          findText: card.findText,
          replaceText: card.replaceText,
          filePath: card.filePath,
          repository,
        }),
      })
      const data = await res.json() as { ok?: boolean; error?: string; commitUrl?: string }
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error ?? "Push failed.")
        setState("error")
        return
      }
      setCommitUrl(data.commitUrl ?? null)
      setState("done")
      onDone(data.commitUrl ?? null)
    } catch {
      setErrorMsg("Network error.")
      setState("error")
    }
  }

  if (state === "done") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-mono text-[#4ade80]">✓ Pushed to GitHub</span>
        {commitUrl && (
          <a href={commitUrl} target="_blank" rel="noopener noreferrer"
            className="text-[11px] font-mono text-[#60a5fa] hover:underline">
            View commit ↗
          </a>
        )}
      </div>
    )
  }

  if (state === "error") {
    return (
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-mono text-[#f87171]">{errorMsg}</span>
        <button type="button" onClick={() => setState("idle")}
          className="text-[11px] font-mono text-[#555555] hover:text-white transition-colors">
          Retry
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={push}
      disabled={state === "pushing"}
      className="h-8 px-4 rounded-[6px] bg-white text-black text-[12px] font-medium
                 hover:bg-white/90 disabled:opacity-50 transition-colors flex items-center gap-2"
    >
      {state === "pushing" ? (
        <>
          <span className="w-3 h-3 rounded-full border-2 border-black/30 border-t-black animate-spin" />
          Pushing…
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          Push Fix to GitHub
        </>
      )}
    </button>
  )
}

export function ReportAIStep({ scanId, repoName, repository, findings }: Props) {
  const [cards, setCards] = useState<FixCard[]>([])
  const [loadingCards, setLoadingCards] = useState(true)
  const [pushedIds, setPushedIds] = useState<Set<string>>(new Set())

  const handlePushDone = useCallback((id: string) => {
    setPushedIds(prev => new Set([...prev, id]))
  }, [])

  useEffect(() => {
    const cacheKey = `fix-cards-${scanId}`
    const cached = typeof window !== "undefined" ? localStorage.getItem(cacheKey) : null
    if (cached) {
      try {
        setCards(JSON.parse(cached) as FixCard[])
        setLoadingCards(false)
        return
      } catch { /* stale cache — regenerate */ }
    }

    fetch("/api/fix/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scanId,
        repoName,
        findings: findings
          .filter(f => f.status !== "false_positive" && f.status !== "dismissed")
          .map(f => ({
            id: f.id,
            title: f.title,
            severity: f.severity,
            tool: f.tool,
            filePath: f.filePath,
            lineStart: f.lineStart,
            codeSnippet: f.codeSnippet,
            description: f.description,
            remediation: f.remediation,
            status: f.status,
          })),
      }),
    })
      .then(r => r.json())
      .then((d: { cards?: FixCard[] }) => {
        const result = d.cards ?? []
        setCards(result)
        if (result.length > 0 && typeof window !== "undefined") {
          localStorage.setItem(cacheKey, JSON.stringify(result))
        }
      })
      .catch(() => setCards([]))
      .finally(() => setLoadingCards(false))
  }, [scanId, repoName, findings])

  if (loadingCards) {
    return (
      <div className="flex flex-col gap-3">
        <div className="bg-white/[0.02] border border-white/10 rounded-[12px] px-6 py-8">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[#60a5fa] animate-pulse" />
            <p className="text-[13px] font-semibold text-white" style={{ letterSpacing: "-0.26px" }}>
              Gemini is reading the repository and generating fixes…
            </p>
          </div>
          <p className="text-[12px] text-[#444444] font-mono mt-2">
            This may take 15–30 seconds for large codebases.
          </p>
        </div>
      </div>
    )
  }

  const realFindings = cards.filter(c => !c.isFalsePositive)
  const falsePositives = cards.filter(c => c.isFalsePositive)

  return (
    <div className="flex flex-col gap-5">

      {falsePositives.length > 0 && (
        <div className="bg-white/[0.02] border border-white/10 rounded-[12px] px-5 py-4">
          <p className="text-[11px] font-mono uppercase tracking-[0.08em] text-[#555555] mb-3">
            False Positives ({falsePositives.length}) — Suppressed
          </p>
          <ul className="flex flex-col gap-1.5">
            {falsePositives.map(c => (
              <li key={c.vulnerabilityId} className="flex items-center gap-2">
                <span className="inline-flex items-center h-4 px-1.5 rounded-[3px] border
                                 border-[#f87171]/30 bg-[#f87171]/5 text-[#f87171]
                                 text-[9px] font-mono uppercase tracking-[0.04em]">
                  False Positive
                </span>
                <span className="text-[12px] text-[#555555] truncate">{c.title}</span>
                {c.filePath && (
                  <span className="text-[11px] font-mono text-[#333333] flex-shrink-0">
                    {c.filePath.split("/").pop()}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {realFindings.length === 0 && !loadingCards && (
        <div className="bg-white/[0.02] border border-white/10 rounded-[12px] px-6 py-10 text-center">
          <p className="text-[14px] text-white font-semibold mb-1" style={{ letterSpacing: "-0.28px" }}>
            No actionable findings
          </p>
          <p className="text-[12px] text-[#555555]">
            All findings were identified as false positives or have no auto-fixable pattern.
          </p>
        </div>
      )}

      {realFindings.map(card => (
        <div
          key={card.vulnerabilityId}
          className={`border rounded-[12px] overflow-hidden ${pushedIds.has(card.vulnerabilityId) ? "opacity-60" : ""}`}
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className={`inline-flex items-center h-5 px-2 rounded-[4px] border
                                  text-[10px] font-mono uppercase tracking-[0.04em]
                                  ${SEV_COLOR[card.severity] ?? SEV_COLOR.info}`}>
                  {card.severity}
                </span>
                {card.filePath && (
                  <span className="text-[11px] font-mono text-[#555555]">
                    {card.filePath}
                    {card.lineStart ? `:${card.lineStart}` : ""}
                  </span>
                )}
              </div>
              <p className="text-[14px] font-semibold text-white" style={{ letterSpacing: "-0.28px" }}>
                {card.title}
              </p>
              {card.explanation && (
                <p className="text-[12px] text-[#777777] mt-1 leading-relaxed">
                  {card.explanation}
                </p>
              )}
            </div>
            {pushedIds.has(card.vulnerabilityId) && (
              <span className="text-[11px] font-mono text-[#4ade80] flex-shrink-0">✓ Fixed</span>
            )}
          </div>

          <div className="px-5 py-4 flex flex-col gap-4 bg-white/[0.01]">
            <CodeBlock
              label="Find this code"
              code={card.findText}
              accent="text-[#f87171]"
            />
            <CodeBlock
              label="Replace with this"
              code={card.replaceText}
              accent="text-[#4ade80]"
            />
          </div>

          {!pushedIds.has(card.vulnerabilityId) && card.filePath && (
            <div className="px-5 py-3.5 border-t border-white/[0.06] flex items-center justify-between">
              <p className="text-[11px] font-mono text-[#444444]">
                Applies fix directly to <span className="text-[#888888]">{card.filePath}</span> on default branch
              </p>
              <PushButton
                card={card}
                repository={repository}
                onDone={(url) => handlePushDone(card.vulnerabilityId)}
              />
            </div>
          )}
        </div>
      ))}

      <p className="text-center text-[11px] font-mono text-[#333333] pt-2">
        oculs.io may make mistakes — please review all suggestions before applying.
      </p>
    </div>
  )
}
