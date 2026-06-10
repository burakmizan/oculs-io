"use client"

import { useState } from "react"
import { toggleReportShare } from "@/app/dashboard/report/[scanId]/actions"

export function ShareReportButton({ scanId, initialToken }: { scanId: string; initialToken: string | null }) {
  const [token, setToken] = useState<string | null>(initialToken)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const base = typeof window !== "undefined" ? window.location.origin : "https://oculs-io.vercel.app"
  const shareUrl = token ? `${base}/r/${token}` : null

  const toggle = async () => {
    setBusy(true)
    const res = await toggleReportShare(scanId, !token)
    setBusy(false)
    if (!res.error) setToken(res.token)
  }

  const copy = async () => {
    if (!shareUrl) return
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch {}
  }

  return (
    <div className="flex items-center gap-2">
      {shareUrl && (
        <button onClick={copy}
          className="h-8 px-3 rounded-[6px] border border-white/10 text-[11px] font-mono text-[#888888]
                     hover:text-white hover:bg-white/5 transition-colors max-w-[220px] truncate">
          {copied ? "Copied ✓" : shareUrl.replace(/^https?:\/\//, "")}
        </button>
      )}
      <button onClick={toggle} disabled={busy}
        className={`h-8 px-3 rounded-[6px] border text-[12px] transition-colors disabled:opacity-50
          ${token ? "border-[#f87171]/20 text-[#f87171] hover:bg-[#f87171]/10" : "border-white/10 text-[#a1a1aa] hover:text-white hover:bg-white/5"}`}>
        {busy ? "…" : token ? "Stop sharing" : "Share report ↗"}
      </button>
    </div>
  )
}