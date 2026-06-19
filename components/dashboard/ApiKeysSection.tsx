"use client"

import { useState } from "react"
import type { ApiKeyRow } from "@/lib/db/queries"

export function ApiKeysSection({ initialKeys }: { initialKeys: ApiKeyRow[] }) {
  const [keys, setKeys] = useState<ApiKeyRow[]>(initialKeys)
  const [name, setName] = useState("")
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState<{ key: string; name: string } | null>(null)
  const [copiedNew, setCopiedNew] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async () => {
    if (!name.trim() || creating) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json() as { id: string; key: string; name: string; keySuffix: string; createdAt: string; error?: string }
      if (!res.ok) { setError(data.error ?? "Failed to create key"); return }
      setNewKey({ key: data.key, name: data.name })
      setKeys(prev => [{ id: data.id, name: data.name, keySuffix: data.keySuffix, createdAt: new Date(data.createdAt), lastUsedAt: null }, ...prev])
      setName("")
    } catch {
      setError("Request failed")
    } finally {
      setCreating(false)
    }
  }

  const revoke = async (id: string) => {
    try {
      await fetch("/api/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      setKeys(prev => prev.filter(k => k.id !== id))
    } catch { /* non-fatal */ }
  }

  const copyNew = async () => {
    if (!newKey) return
    try { await navigator.clipboard.writeText(newKey.key) } catch { /* blocked */ }
    setCopiedNew(true)
    setTimeout(() => setCopiedNew(false), 1800)
  }

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-[12px]">
      <div className="px-5 py-4 border-b border-white/[0.07]">
        <h2 className="text-[13px] font-mono uppercase tracking-[0.08em] text-[#a1a1aa]">API Keys</h2>
        <p className="text-[12px] text-[#555555] mt-1">For CI/CD pipelines that need to trigger scans without a browser session.</p>
      </div>

      {/* New key revealed once */}
      {newKey && (
        <div className="mx-5 mt-5 p-4 rounded-[8px] border border-[#4ade80]/30 bg-[#4ade80]/[0.04]">
          <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#4ade80] mb-2">
            Key created — copy it now, it won&apos;t be shown again
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[12px] font-mono text-white bg-black/40 border border-white/10 rounded-[6px] px-3 py-2 overflow-x-auto whitespace-nowrap">
              {newKey.key}
            </code>
            <button
              type="button"
              onClick={copyNew}
              className="flex-shrink-0 h-8 px-3 rounded-[6px] border border-[#4ade80]/30 text-[11px] font-mono
                         text-[#4ade80] hover:bg-[#4ade80]/10 transition-colors"
            >
              {copiedNew ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <p className="text-[11px] font-mono text-[#555555] mt-2">
            Use as: <code className="text-[#888888]">Authorization: Bearer {newKey.key.slice(0, 14)}…</code>
          </p>
        </div>
      )}

      {/* Create form */}
      <div className="px-5 py-4 border-b border-white/[0.07]">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") create() }}
            placeholder="Key name (e.g. GitHub Actions)"
            className="flex-1 h-9 px-3 rounded-[6px] bg-white/[0.03] border border-white/10 text-sm text-white
                       focus:outline-none focus:border-white/30 placeholder:text-[#444444]"
          />
          <button
            type="button"
            onClick={create}
            disabled={creating || !name.trim()}
            className="h-9 px-4 rounded-[6px] bg-white text-black text-sm font-medium hover:bg-zinc-200
                       transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {creating ? "Creating…" : "Create Key"}
          </button>
        </div>
        {error && <p className="text-[12px] text-[#f87171] mt-2">{error}</p>}
      </div>

      {/* Key list */}
      {keys.length === 0 ? (
        <div className="px-5 py-6 text-center">
          <p className="text-[12px] text-[#555555]">No API keys yet. Create one to use in CI/CD pipelines.</p>
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.04]">
          {keys.map(k => (
            <li key={k.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-white" style={{ letterSpacing: "-0.26px" }}>{k.name}</p>
                <p className="text-[11px] font-mono text-[#555555] mt-0.5">
                  …{k.keySuffix}
                  <span className="ml-3">Created {k.createdAt.toLocaleDateString()}</span>
                  {k.lastUsedAt && <span className="ml-3">Last used {k.lastUsedAt.toLocaleDateString()}</span>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => revoke(k.id)}
                className="flex-shrink-0 h-7 px-3 rounded-[6px] border border-red-500/20 bg-red-500/5 text-[11px] font-mono
                           text-[#f87171] hover:bg-red-500/10 transition-colors"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
