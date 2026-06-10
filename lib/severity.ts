import type { SeverityLevel } from "@/types"

/**
 * Canonical severity visual language for the Oculs dashboard.
 * Single source of truth so components never re-declare hex codes.
 * Values mirror the colors already used across the dashboard pages.
 */
export interface SeverityStyle {
  fg: string
  badge: string
  hex: string
  label: string
}

export const SEVERITY_STYLES: Record<SeverityLevel, SeverityStyle> = {
  critical: { fg: "text-[#f87171]", badge: "text-[#f87171] bg-[#f87171]/10 border-[#f87171]/20", hex: "#f87171", label: "Critical" },
  high:     { fg: "text-[#fb923c]", badge: "text-[#fb923c] bg-[#fb923c]/10 border-[#fb923c]/20", hex: "#fb923c", label: "High" },
  medium:   { fg: "text-[#fbbf24]", badge: "text-[#fbbf24] bg-[#fbbf24]/10 border-[#fbbf24]/20", hex: "#fbbf24", label: "Medium" },
  low:      { fg: "text-[#60a5fa]", badge: "text-[#60a5fa] bg-[#60a5fa]/10 border-[#60a5fa]/20", hex: "#60a5fa", label: "Low" },
  info:     { fg: "text-[#a1a1aa]", badge: "text-[#a1a1aa] bg-white/[0.04] border-white/10",      hex: "#a1a1aa", label: "Info" },
}

export const SEVERITY_ORDER: SeverityLevel[] = ["critical", "high", "medium", "low", "info"]

/** Risk-score color thresholds — mirrors the dashboard RiskBadge. */
export function riskColorHex(score: number): string {
  if (score >= 70) return "#f87171"
  if (score >= 40) return "#f5a623"
  return "#4ade80"
}

export function riskLabel(score: number): string {
  if (score >= 70) return "Critical exposure"
  if (score >= 40) return "Elevated risk"
  if (score > 0) return "Low risk"
  return "Healthy"
}