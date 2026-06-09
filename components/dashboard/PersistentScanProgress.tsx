"use client"

import { useEffect, useState } from "react"
import { ScanProgress } from "@/components/dashboard/ScanProgress"

const STORAGE_KEY = "oculs_active_scan"

interface ActiveScan {
  scanId: string
  repoName: string
  toolCount: number
}

/**
 * Reads active scan from localStorage and renders ScanProgress
 * so the Dynamic Island persists across page navigations.
 */
export function PersistentScanProgress() {
  const [activeScan, setActiveScan] = useState<ActiveScan | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        setActiveScan(JSON.parse(raw))
      } catch { /* invalid JSON */ }
    }

    // Listen for storage changes (set by ScanProgress when scan starts)
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      if (e.newValue) {
        try { setActiveScan(JSON.parse(e.newValue)) } catch { /* ignore */ }
      } else {
        setActiveScan(null)
      }
    }
    window.addEventListener("storage", handler)
    return () => window.removeEventListener("storage", handler)
  }, [])

  if (!activeScan) return null

  return (
    <ScanProgress
      scanId={activeScan.scanId}
      repoName={activeScan.repoName}
      toolCount={activeScan.toolCount}
      onClose={() => {
        localStorage.removeItem(STORAGE_KEY)
        setActiveScan(null)
      }}
    />
  )
}