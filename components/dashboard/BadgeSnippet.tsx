"use client"

import { useState } from "react"

/**
 * Renders the live security badge + a one-click "copy README markdown" button.
 * The dev embeds this in their repo README — every README becomes a backlink.
 */
export function BadgeSnippet({ projectId }: { projectId: string }) {
  const [copied, setCopied] = useState(false)

  const base =
    typeof window !== "undefined" ? window.location.origin : "https://oculs-io.vercel.app"
  const badgeUrl = `${base}/api/badge/${projectId}.svg`
  const markdown = `[![Security](${badgeUrl})](https://oculs.io)`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard blocked — no-op */ }
  }

  return (
    <div className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={badgeUrl} alt="Security badge" className="h-5" />
      <button
        type="button"
        onClick={copy}
        className="h-7 px-2.5 rounded-[6px] border border-white/10 text-[11px] font-mono
                   text-[#888888] hover:text-white hover:bg-white/5 transition-colors"
      >
        {copied ? "Copied ✓" : "Copy badge"}
      </button>
    </div>
  )
}