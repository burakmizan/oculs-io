"use client"

import { useState } from "react"

export function SecurityCardSnippet({ projectId }: { projectId: string }) {
  const [copied, setCopied] = useState(false)

  const base = typeof window !== "undefined" ? window.location.origin : "https://oculs-io.vercel.app"
  const badgeUrl = `${base}/api/badge/${projectId}.svg`
  const cardUrl = `${base}/sc/${projectId}`
  const markdown = `[![Security Grade](${badgeUrl})](${cardUrl})`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard blocked */ }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={badgeUrl} alt="Security grade badge" className="h-5" />
        <a
          href={cardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-mono text-[#555555] hover:text-[#a1a1aa] transition-colors"
        >
          View public card ↗
        </a>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-[11px] font-mono text-[#60a5fa] bg-black/40 border border-white/10 rounded-[6px] px-3 py-2 overflow-x-auto whitespace-nowrap">
          {markdown}
        </code>
        <button
          type="button"
          onClick={copy}
          className="flex-shrink-0 h-8 px-3 rounded-[6px] border border-white/10 text-[11px] font-mono
                     text-[#888888] hover:text-white hover:bg-white/5 transition-colors"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
    </div>
  )
}
