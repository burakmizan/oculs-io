import type { SeverityLevel } from "@/types"

export const GRADE_RISK_WEIGHTS: Record<SeverityLevel, number> = {
  critical: 40, high: 20, medium: 8, low: 2, info: 0,
}

export interface GradeResult {
  letter: string
  color: string
  score: number
  hasCritical: boolean
}

export function computeGrade(
  bySeverity: { severity: string; count: number }[],
): GradeResult {
  const hasCritical = bySeverity.some(r => r.severity === "critical" && r.count > 0)
  const score = Math.min(
    100,
    bySeverity.reduce(
      (sum, r) => sum + (GRADE_RISK_WEIGHTS[r.severity as SeverityLevel] ?? 0) * r.count,
      0,
    ),
  )
  const letter =
    hasCritical ? "F" :
    score === 0  ? "A+" :
    score <= 10  ? "A" :
    score <= 25  ? "B" :
    score <= 45  ? "C" :
    score <= 70  ? "D" : "F"
  const color =
    letter === "A+" || letter === "A" ? "#4ade80" :
    letter === "B"                    ? "#a3e635" :
    letter === "C"                    ? "#fbbf24" :
    letter === "D"                    ? "#fb923c" : "#f87171"
  return { letter, color, score, hasCritical }
}
