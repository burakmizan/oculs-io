import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { vulnerabilities, projects } from "@/lib/db/schema"
import { and, eq, inArray, count } from "drizzle-orm"
import type { SeverityLevel } from "@/types"

export const runtime = "nodejs"

/**
 * GET /api/badge/[projectId].svg
 *
 * Public, unauthenticated live security badge for embedding in a repo README.
 * Renders a shields.io-style SVG grading the project by its open findings.
 * No auth — the badge only ever exposes an aggregate grade, never finding detail.
 */

const RISK_WEIGHTS: Record<SeverityLevel, number> = {
  critical: 40, high: 20, medium: 8, low: 2, info: 0,
}

function grade(score: number, hasCritical: boolean): { letter: string; color: string } {
  if (hasCritical) return { letter: "F", color: "#f87171" }
  if (score === 0) return { letter: "A+", color: "#4ade80" }
  if (score <= 10) return { letter: "A", color: "#4ade80" }
  if (score <= 25) return { letter: "B", color: "#a3e635" }
  if (score <= 45) return { letter: "C", color: "#fbbf24" }
  if (score <= 70) return { letter: "D", color: "#fb923c" }
  return { letter: "F", color: "#f87171" }
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] ?? c),
  )
}

function svg(label: string, value: string, color: string): string {
  const labelW = 74
  const valueW = Math.max(46, value.length * 9 + 22)
  const total = labelW + valueW
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="20" role="img" aria-label="${escapeXml(label)}: ${escapeXml(value)}">
  <title>${escapeXml(label)}: ${escapeXml(value)}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${total}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelW}" height="20" fill="#0a0a0a"/>
    <rect x="${labelW}" width="${valueW}" height="20" fill="${color}"/>
    <rect width="${total}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelW / 2}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(label)}</text>
    <text x="${labelW / 2}" y="14">${escapeXml(label)}</text>
    <text x="${labelW + valueW / 2}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(value)}</text>
    <text x="${labelW + valueW / 2}" y="14">${escapeXml(value)}</text>
  </g>
</svg>`
}

function respond(body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Short cache so README badges stay fresh but don't hammer Aurora
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
    },
  })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId: raw } = await params
  // Allow both "<id>" and "<id>.svg"
  const projectId = raw.replace(/\.svg$/i, "")

  try {
    // Confirm the project exists (so unknown IDs render "unknown" not a grade)
    const [proj] = await db
      .select({ id: projects.id, badgePublic: projects.badgePublic })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)

    if (!proj) {
      return respond(svg("security", "unknown", "#888888"))
    }
    // Respect the tenant's privacy choice — never leak a grade for private badges.
    if (!proj.badgePublic) {
      return respond(svg("security", "private", "#888888"))
    }

    const bySeverity = await db
      .select({ severity: vulnerabilities.severity, c: count() })
      .from(vulnerabilities)
      .where(
        and(
          eq(vulnerabilities.projectId, projectId),
          inArray(vulnerabilities.status, ["open", "in_review"]),
        ),
      )
      .groupBy(vulnerabilities.severity)

    const weighted = bySeverity.reduce(
      (sum, r) => sum + (RISK_WEIGHTS[r.severity as SeverityLevel] ?? 0) * r.c,
      0,
    )
    const score = Math.min(100, weighted)
    const hasCritical = bySeverity.some((r) => r.severity === "critical" && r.c > 0)
    const { letter, color } = grade(score, hasCritical)

    return respond(svg("security", letter, color))
  } catch {
    // Aurora offline / any error — never break the README image
    return respond(svg("security", "n/a", "#888888"))
  }
}