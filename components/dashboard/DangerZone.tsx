"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { clearScanHistory, deleteProject } from "@/app/dashboard/projects/actions"

interface Props {
  projectId: string
  projectName: string
}

function ConfirmModal({
  title,
  description,
  confirmLabel,
  confirmInputLabel,
  confirmInputMatch,
  onConfirm,
  onClose,
  danger,
}: {
  title: string
  description: string
  confirmLabel: string
  confirmInputLabel?: string
  confirmInputMatch?: string
  onConfirm: () => void
  onClose: () => void
  danger?: boolean
}) {
  const [input, setInput] = useState("")
  const inputOk = !confirmInputMatch || input === confirmInputMatch

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[420px] bg-[#0a0a0a] border border-white/15 rounded-[16px] overflow-hidden shadow-2xl">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-[8px] bg-[#E7000B]/10 border border-[#E7000B]/20 flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E7000B" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round" />
                <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-[15px] font-semibold text-white" style={{ letterSpacing: "-0.3px" }}>{title}</p>
          </div>
          <p className="text-[13px] text-[#888888] leading-relaxed" style={{ letterSpacing: "-0.26px" }}>{description}</p>
        </div>

        {confirmInputLabel && confirmInputMatch && (
          <div className="px-6 pb-4">
            <label className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#555555] mb-1.5 block">
              {confirmInputLabel}
            </label>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={confirmInputMatch}
              autoFocus
              className="w-full h-9 px-3 rounded-[7px] bg-white/[0.03] border border-white/10
                         text-[12px] text-white placeholder:text-[#333333] font-mono
                         focus:border-white/20 focus-visible:outline-none transition-colors"
            />
          </div>
        )}

        <div className="px-6 pb-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 rounded-[6px] border border-white/10 text-[12px] font-mono text-[#888888]
                       hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!inputOk}
            className={`h-8 px-4 rounded-[6px] text-[12px] font-mono font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed
              ${danger
                ? "bg-[#E7000B] text-white hover:bg-[#c5000a]"
                : "bg-white/10 text-white hover:bg-white/15"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function DangerZone({ projectId, projectName }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [modal, setModal] = useState<"clear" | "delete" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleClear = () => {
    setModal(null)
    startTransition(async () => {
      const res = await clearScanHistory(projectId)
      if (res.error) setError(res.error)
    })
  }

  const handleDelete = () => {
    setModal(null)
    startTransition(async () => {
      const res = await deleteProject(projectId)
      if (res.error) { setError(res.error); return }
      router.push("/dashboard/projects")
    })
  }

  return (
    <>
      <div className="mt-8 rounded-[12px] border border-[#E7000B]/20 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E7000B]/10 bg-[#E7000B]/[0.04]">
          <p className="text-[11px] font-mono uppercase tracking-[0.08em] text-[#E7000B]">Danger Zone</p>
        </div>

        <div className="divide-y divide-white/[0.04]">
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-[13px] font-medium text-white" style={{ letterSpacing: "-0.26px" }}>
                Clear scan history
              </p>
              <p className="text-[11px] text-[#555555] mt-0.5">
                Delete all scans and findings for this project. The project itself will remain.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModal("clear")}
              disabled={isPending}
              className="flex-shrink-0 h-8 px-3 rounded-[6px] border border-[#E7000B]/30 text-[12px] font-mono
                         text-[#E7000B] hover:bg-[#E7000B]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear history
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-[13px] font-medium text-white" style={{ letterSpacing: "-0.26px" }}>
                Delete project
              </p>
              <p className="text-[11px] text-[#555555] mt-0.5">
                Permanently delete this project and all its data. This cannot be undone.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModal("delete")}
              disabled={isPending}
              className="flex-shrink-0 h-8 px-3 rounded-[6px] bg-[#E7000B]/10 border border-[#E7000B]/30 text-[12px] font-mono
                         text-[#E7000B] hover:bg-[#E7000B]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete project
            </button>
          </div>
        </div>

        {error && (
          <div className="px-5 py-3 border-t border-[#E7000B]/10 bg-[#E7000B]/[0.04]">
            <p className="text-[12px] font-mono text-[#f87171]">{error}</p>
          </div>
        )}
      </div>

      {modal === "clear" && (
        <ConfirmModal
          title="Clear scan history?"
          description="All scans and vulnerability findings for this project will be permanently deleted. The project itself and its settings will remain."
          confirmLabel="Yes, clear history"
          onConfirm={handleClear}
          onClose={() => setModal(null)}
          danger
        />
      )}

      {modal === "delete" && (
        <ConfirmModal
          title="Delete project?"
          description="This will permanently delete the project, all scans, and all vulnerability findings. This action cannot be undone."
          confirmLabel="Delete forever"
          confirmInputLabel={`Type "${projectName}" to confirm`}
          confirmInputMatch={projectName}
          onConfirm={handleDelete}
          onClose={() => setModal(null)}
          danger
        />
      )}
    </>
  )
}
