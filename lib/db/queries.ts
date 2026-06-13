import { eq, and, count, desc, gte, inArray, notInArray, isNotNull, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { cookies } from "next/headers"
import {
  users,
  organizations,
  projects,
  scans,
  vulnerabilities,
  type User,
  type Organization,
} from "@/lib/db/schema"
import type { DashboardStats, SeverityLevel, ScanTool } from "@/types"


/**
 * Data-access helpers. Kept free of request/runtime concerns so they can be
 * reused from server actions, route handlers, and the Credentials provider.
 */

/* ── Auth ──────────────────────────────────────────────────────────── */

export async function getUserByEmail(email: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1)
  return user ?? null
}

export async function createCredentialsUser(input: {
  name: string
  email: string
  passwordHash: string
  plan?: string
}): Promise<User> {
  const [user] = await db
    .insert(users)
    .values({
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      ...(input.plan ? { plan: input.plan } : {}),
    })
    .returning()
  return user
}

/* ── Plans ─────────────────────────────────────────────────────────── */

/**
 * Launch promo: every account is on the Pro plan for free.
 * Idempotent and cheap — only issues an UPDATE while the user is still on
 * the schema-default Starter plan (covers OAuth signups and older accounts).
 */
export async function promoteStarterToPro(userId: string): Promise<string> {
  const [row] = await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (row?.plan === "starter") {
    await db.update(users).set({ plan: "pro" }).where(eq(users.id, userId))
    return "pro"
  }
  return row?.plan ?? "starter"
}

/** Reads the user's current plan for display. Defaults to "starter" on error. */
export async function getUserPlan(userId: string): Promise<string> {
  try {
    const [row] = await db
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    return row?.plan ?? "starter"
  } catch {
    return "starter"
  }
}

/** Finding-history retention window per plan, in days; null = unlimited. */
const PLAN_RETENTION_DAYS: Record<string, number | null> = {
  starter: 7,
  pro: 90,
  enterprise: null,
}

/**
 * Oldest `createdAt` still visible to this user's plan, or null when the
 * plan has unlimited retention. Fails open: if the plan cannot be read
 * (DB hiccup, unknown plan value), returns null so no data is hidden.
 */
export async function getRetentionCutoff(userId: string): Promise<Date | null> {
  try {
    const [row] = await db
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    const days = PLAN_RETENTION_DAYS[row?.plan ?? ""] ?? null
    if (days === null) return null
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    return cutoff
  } catch {
    return null
  }
}

/* ── Onboarding ────────────────────────────────────────────────────── */

export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ onboardingCompletedAt: users.onboardingCompletedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return row?.onboardingCompletedAt != null
}

export async function createOrganization(input: {
  ownerId: string
  name: string
  slug: string
}): Promise<Organization> {
  const [org] = await db
    .insert(organizations)
    .values({
      ownerId: input.ownerId,
      name: input.name,
      slug: input.slug,
    })
    .onConflictDoUpdate({
      target: [organizations.ownerId, organizations.slug],
      set: { name: input.name },
    })
    .returning()
  return org
}

export async function createOnboardingProject(input: {
  userId: string
  organizationId: string
  name: string
  description: string | null
  repoFullName: string
  repoUrl: string | null
}): Promise<string> {
  const [project] = await db
    .insert(projects)
    .values({
      userId: input.userId,
      organizationId: input.organizationId,
      name: input.name,
      description: input.description,
      repoFullName: input.repoFullName,
      repoUrl: input.repoUrl,
    })
    .onConflictDoUpdate({
      target: [projects.userId, projects.repoFullName],
      set: {
        name: input.name,
        description: input.description,
        organizationId: input.organizationId,
        updatedAt: new Date(),
      },
    })
    .returning({ id: projects.id })
  return project.id
}

export async function markOnboardingComplete(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ onboardingCompletedAt: new Date() })
    .where(eq(users.id, userId))
}

/* ── Dashboard ─────────────────────────────────────────────────────── */

/** Severity weights for the 0–100 composite risk score. */
const RISK_WEIGHTS: Record<SeverityLevel, number> = {
  critical: 40,
  high: 20,
  medium: 8,
  low: 2,
  info: 0,
}

export async function getDashboardStats(
  userId: string,
): Promise<DashboardStats> {
  const cookieStore = await cookies()
  const activeTeamId = cookieStore.get("active_team_id")?.value || "personal"

  // Takıma veya kişisele göre Where şartı
  const projectCondition = activeTeamId === "personal" 
    ? eq(projects.userId, userId) 
    : eq((projects as any).teamId, activeTeamId)

  // Scan ve zafiyetler projectId'ye bağlı olduğu için alt sorgu kullanıyoruz
  const scanCondition = activeTeamId === "personal"
    ? eq(scans.userId, userId)
    : inArray(scans.projectId, db.select({ id: projects.id }).from(projects).where(eq((projects as any).teamId, activeTeamId)))

  const vulnCondition = activeTeamId === "personal"
    ? eq(vulnerabilities.userId, userId)
    : inArray(vulnerabilities.projectId, db.select({ id: projects.id }).from(projects).where(eq((projects as any).teamId, activeTeamId)))

  const [projectCount, scanCount, openBySeverity] = await Promise.all([
    db.select({ c: count() }).from(projects).where(projectCondition),
    db.select({ c: count() }).from(scans).where(scanCondition),
    db
      .select({ severity: vulnerabilities.severity, c: count() })
      .from(vulnerabilities)
      .where(
        and(
          vulnCondition,
          inArray(vulnerabilities.status, ["open", "in_review"]),
        ),
      )
      .groupBy(vulnerabilities.severity),
  ])

  const openVulnerabilities = openBySeverity.reduce((sum, r) => sum + r.c, 0)
  const weighted = openBySeverity.reduce(
    (sum, r) => sum + RISK_WEIGHTS[r.severity] * r.c,
    0,
  )

  return {
    projects: projectCount[0]?.c ?? 0,
    scans: scanCount[0]?.c ?? 0,
    openVulnerabilities,
    // No scans yet → no meaningful score.
    riskScore: (scanCount[0]?.c ?? 0) === 0 ? null : Math.min(100, weighted),
  }
}

/* ── OWASP Top 10 coverage ─────────────────────────────────────────── */

export const OWASP_TOP_10: { id: string; title: string }[] = [
  { id: "A01", title: "Broken Access Control" },
  { id: "A02", title: "Cryptographic Failures" },
  { id: "A03", title: "Injection" },
  { id: "A04", title: "Insecure Design" },
  { id: "A05", title: "Security Misconfiguration" },
  { id: "A06", title: "Vulnerable & Outdated Components" },
  { id: "A07", title: "Identification & Auth Failures" },
  { id: "A08", title: "Software & Data Integrity Failures" },
  { id: "A09", title: "Logging & Monitoring Failures" },
  { id: "A10", title: "Server-Side Request Forgery" },
]

export interface OwaspCell {
  id: string
  title: string
  count: number
  topSeverity: SeverityLevel | null
}

export async function getOwaspCoverage(userId: string): Promise<OwaspCell[]> {
  const cookieStore = await cookies()
  const activeTeamId = cookieStore.get("active_team_id")?.value || "personal"

  const vulnCondition = activeTeamId === "personal"
    ? eq(vulnerabilities.userId, userId)
    : inArray(vulnerabilities.projectId, db.select({ id: projects.id }).from(projects).where(eq((projects as any).teamId, activeTeamId)))

  let rows: { owaspCategory: string | null; severity: SeverityLevel }[] = []
  try {
    rows = await db
      .select({ owaspCategory: vulnerabilities.owaspCategory, severity: vulnerabilities.severity })
      .from(vulnerabilities)
      .where(and(vulnCondition, inArray(vulnerabilities.status, ["open", "in_review"])))
  } catch {
    rows = []
  }

  const sevRank: SeverityLevel[] = ["critical", "high", "medium", "low", "info"]
  return OWASP_TOP_10.map((cat) => {
    // owaspCategory is stored free-form (e.g. "A03:2021 – Injection"); match by ID prefix.
    const matches = rows.filter((r) => (r.owaspCategory ?? "").toUpperCase().includes(cat.id))
    let topSeverity: SeverityLevel | null = null
    for (const m of matches) {
      if (topSeverity === null || sevRank.indexOf(m.severity) < sevRank.indexOf(topSeverity)) {
        topSeverity = m.severity
      }
    }
    return { id: cat.id, title: cat.title, count: matches.length, topSeverity }
  })
}

/* ── MTTR (mean time to remediate) ─────────────────────────────────── */

export interface MttrStats {
  /** Average hours between finding creation and fix application. */
  avgHours: number | null
  /** Number of findings that have actually been fixed (sample size). */
  fixedCount: number
  /** Currently open findings (not yet fixed). */
  openCount: number
}

export async function getMttrStats(userId: string): Promise<MttrStats> {
  const cookieStore = await cookies()
  const activeTeamId = cookieStore.get("active_team_id")?.value || "personal"

  const vulnCondition = activeTeamId === "personal"
    ? eq(vulnerabilities.userId, userId)
    : inArray(vulnerabilities.projectId, db.select({ id: projects.id }).from(projects).where(eq((projects as any).teamId, activeTeamId)))

  try {
    const [fixed, open] = await Promise.all([
      db
        .select({ createdAt: vulnerabilities.createdAt, fixAppliedAt: vulnerabilities.fixAppliedAt })
        .from(vulnerabilities)
        .where(and(vulnCondition, isNotNull(vulnerabilities.fixAppliedAt))),
      db
        .select({ c: count() })
        .from(vulnerabilities)
        .where(and(vulnCondition, inArray(vulnerabilities.status, ["open", "in_review"]))),
    ])

    if (fixed.length === 0) {
      return { avgHours: null, fixedCount: 0, openCount: open[0]?.c ?? 0 }
    }
    const totalMs = fixed.reduce((sum, r) => {
      if (!r.fixAppliedAt) return sum
      return sum + (r.fixAppliedAt.getTime() - r.createdAt.getTime())
    }, 0)
    const avgHours = totalMs / fixed.length / (1000 * 60 * 60)
    return { avgHours: Math.round(avgHours * 10) / 10, fixedCount: fixed.length, openCount: open[0]?.c ?? 0 }
  } catch {
    return { avgHours: null, fixedCount: 0, openCount: 0 }
  }
}

/* ── Risk trend (time series of completed-scan risk scores) ────────── */

export interface RiskTrendPoint {
  date: Date
  score: number
  repoFullName: string
}

export async function getRiskTrend(userId: string, limit = 20): Promise<RiskTrendPoint[]> {
  const cookieStore = await cookies()
  const activeTeamId = cookieStore.get("active_team_id")?.value || "personal"

  const scanCondition = activeTeamId === "personal"
    ? eq(scans.userId, userId)
    : inArray(
        scans.projectId,
        db.select({ id: projects.id }).from(projects).where(eq((projects as any).teamId, activeTeamId)),
      )

  let rows: { createdAt: Date; summary: Record<string, number> | null; repoFullName: string }[] = []
  try {
    rows = await db
      .select({ createdAt: scans.createdAt, summary: scans.summary, repoFullName: projects.repoFullName })
      .from(scans)
      .innerJoin(projects, eq(scans.projectId, projects.id))
      .where(and(scanCondition, eq(scans.status, "completed")))
      .orderBy(desc(scans.createdAt))
      .limit(limit)
  } catch {
    return []
  }

  // Reverse to chronological (oldest → newest) for left-to-right charting.
  return rows.reverse().map((r) => ({
    date: r.createdAt,
    score: typeof r.summary?.riskScore === "number" ? r.summary.riskScore : 0,
    repoFullName: r.repoFullName,
  }))
}

export interface RecentScanRow {
  id: string
  repoFullName: string
  status: string
  tools: ScanTool[]
  vulnerabilitiesCount: number
  createdAt: Date
}

export async function getRecentScans(
  userId: string,
  limit = 6,
): Promise<RecentScanRow[]> {
  const cookieStore = await cookies()
  const activeTeamId = cookieStore.get("active_team_id")?.value || "personal"

  return db
    .select({
      id: scans.id,
      repoFullName: projects.repoFullName,
      status: scans.status,
      tools: scans.tools,
      vulnerabilitiesCount: scans.vulnerabilitiesCount,
      createdAt: scans.createdAt,
    })
    .from(scans)
    .innerJoin(projects, eq(scans.projectId, projects.id))
    .where(activeTeamId === "personal" 
      ? eq(scans.userId, userId) 
      : eq((projects as any).teamId, activeTeamId))
    .orderBy(desc(scans.createdAt))
    .limit(limit)
}

export interface ProjectOption {
  id: string
  name: string
  repoFullName: string
  targetUrl: string | null
}

export async function getProjectById(
  projectId: string,
  userId: string,
): Promise<{ id: string; name: string; description: string | null; repoFullName: string; targetUrl: string | null; repoUrl: string | null } | null> {
  const [row] = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      repoFullName: projects.repoFullName,
      targetUrl: projects.targetUrl,
      repoUrl: projects.repoUrl,
    })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1)
  return row ?? null
}

export interface ProjectSettings {
  id: string
  name: string
  repoFullName: string
  scanScheduleEnabled: boolean
  scanFrequency: string
  scanHourUtc: number
  scanDayOfWeek: number
  scheduledTools: ScanTool[] | null
  gateThreshold: string
  autoFixEnabled: boolean
  badgePublic: boolean
}

export async function getProjectSettings(
  projectId: string,
  userId: string,
): Promise<ProjectSettings | null> {
  const [row] = await db
    .select({
      id: projects.id,
      name: projects.name,
      repoFullName: projects.repoFullName,
      scanScheduleEnabled: projects.scanScheduleEnabled,
      scanFrequency: projects.scanFrequency,
      scanHourUtc: projects.scanHourUtc,
      scanDayOfWeek: projects.scanDayOfWeek,
      scheduledTools: projects.scheduledTools,
      gateThreshold: projects.gateThreshold,
      autoFixEnabled: projects.autoFixEnabled,
      badgePublic: projects.badgePublic,
    })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1)
  return row ?? null
}

export async function getUserProjects(
  userId: string,
): Promise<ProjectOption[]> {
  const cookieStore = await cookies()
  const activeTeamId = cookieStore.get("active_team_id")?.value || "personal"

  return db
    .select({
      id: projects.id,
      name: projects.name,
      repoFullName: projects.repoFullName,
      targetUrl: projects.targetUrl,
    })
    .from(projects)
    .where(activeTeamId === "personal" 
      ? eq(projects.userId, userId) 
      : eq((projects as any).teamId, activeTeamId))
    .orderBy(desc(projects.updatedAt))
}

export interface ProjectWithStatus extends ProjectOption {
  /** Most recent scan for this project, or null when never scanned. */
  latestScan: {
    status: string
    commitSha: string | null
    vulnerabilitiesCount: number
    summary: Record<string, number> | null
    completedAt: Date | null
  } | null
}

export async function getUserProjectsWithStatus(
  userId: string,
): Promise<ProjectWithStatus[]> {
  const cookieStore = await cookies()
  const activeTeamId = cookieStore.get("active_team_id")?.value || "personal"

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      repoFullName: projects.repoFullName,
      targetUrl: projects.targetUrl,
    })
    .from(projects)
    .where(activeTeamId === "personal"
      ? eq(projects.userId, userId)
      // team_id is not in the Drizzle schema yet — raw SQL avoids an `any` cast.
      : sql`${projects}."team_id" = ${activeTeamId}`)
    .orderBy(desc(projects.updatedAt))

  if (rows.length === 0) return []

  // Latest scan per project via Postgres DISTINCT ON (projectId, newest first).
  const latest = await db
    .selectDistinctOn([scans.projectId], {
      projectId: scans.projectId,
      status: scans.status,
      commitSha: scans.commitSha,
      vulnerabilitiesCount: scans.vulnerabilitiesCount,
      summary: scans.summary,
      completedAt: scans.completedAt,
    })
    .from(scans)
    .where(inArray(scans.projectId, rows.map((r) => r.id)))
    .orderBy(scans.projectId, desc(scans.createdAt))

  const byProject = new Map(latest.map((s) => [s.projectId, s]))
  return rows.map((p) => {
    const s = byProject.get(p.id)
    return {
      ...p,
      latestScan: s
        ? {
            status: s.status,
            commitSha: s.commitSha,
            vulnerabilitiesCount: s.vulnerabilitiesCount,
            summary: s.summary,
            completedAt: s.completedAt,
          }
        : null,
    }
  })
}

/* ── Scan orchestration ────────────────────────────────────────────── */

/** Idempotently resolve a project for `owner/repo`, then queue a scan. */
export async function queueScan(input: {
  userId: string
  repoFullName: string
  targetUrl: string | null
  tools: ScanTool[]
}): Promise<string> {
  // Resolve or create organization for this user
  let orgId: string | null = null
  try {
    const [existingOrg] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.ownerId, input.userId))
      .limit(1)

    if (existingOrg) {
      orgId = existingOrg.id
    } else {
      const [newOrg] = await db
        .insert(organizations)
        .values({
          ownerId: input.userId,
          name: "My Workspace",
          slug: input.userId.slice(0, 60).replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
        })
        .onConflictDoUpdate({
          target: [organizations.ownerId, organizations.slug],
          set: { name: "My Workspace" },
        })
        .returning({ id: organizations.id })
      orgId = newOrg?.id ?? null
    }
  } catch { /* non-fatal — proceed without org */ }

  const cookieStore = await cookies()
  const activeTeamId = cookieStore.get("active_team_id")?.value || "personal"
  const finalTeamId = activeTeamId === "personal" ? null : activeTeamId

  const [project] = await db
    .insert(projects)
    .values({
      userId: input.userId,
      organizationId: orgId,
      teamId: finalTeamId,
      name: input.repoFullName.split("/").pop() ?? input.repoFullName,
      repoFullName: input.repoFullName,
      repoUrl: `https://github.com/${input.repoFullName}`,
      targetUrl: input.targetUrl,
    } as any)
    .onConflictDoUpdate({
      target: [projects.userId, projects.repoFullName],
      set: { targetUrl: input.targetUrl, updatedAt: new Date() },
    })
    .returning({ id: projects.id })

  const [scan] = await db
    .insert(scans)
    .values({
      projectId: project.id,
      userId: input.userId,
      tools: input.tools,
      status: "queued",
      trigger: "manual",
    })
    .returning({ id: scans.id })

  return scan.id
}

export interface VulnerabilityRow {
  id: string
  title: string
  severity: string
  tool: string
  filePath: string | null
  targetUrl: string | null
  lineStart: number | null
  cweId: string | null
  owaspCategory: string | null
  remediation: string | null
  aiFixPatch: string | null
  status: string
  fingerprint?: string | null
  createdAt: Date
  repoFullName: string
  scanId: string
}

export async function getVulnerabilities(
  userId: string,
  limit = 50,
): Promise<VulnerabilityRow[]> {
  const cookieStore = await cookies()
  const activeTeamId = cookieStore.get("active_team_id")?.value || "personal"

  return db
    .select({
      id: vulnerabilities.id,
      title: vulnerabilities.title,
      severity: vulnerabilities.severity,
      tool: vulnerabilities.tool,
      filePath: vulnerabilities.filePath,
      targetUrl: vulnerabilities.targetUrl,
      lineStart: vulnerabilities.lineStart,
      cweId: vulnerabilities.cweId,
      owaspCategory: vulnerabilities.owaspCategory,
      remediation: vulnerabilities.remediation,
      aiFixPatch: vulnerabilities.aiFixPatch,
      status: vulnerabilities.status,
      createdAt: vulnerabilities.createdAt,
      repoFullName: projects.repoFullName,
      scanId: vulnerabilities.scanId,
    })
    .from(vulnerabilities)
    .innerJoin(projects, eq(vulnerabilities.projectId, projects.id))
    .where(activeTeamId === "personal" 
      ? eq(vulnerabilities.userId, userId) 
      : eq((projects as any).teamId, activeTeamId))
    .orderBy(desc(vulnerabilities.createdAt))
    .limit(limit)
}

export interface PublicReport {
  repoFullName: string
  createdAt: Date
  completedAt: Date | null
  summary: Record<string, number> | null
  vulns: VulnerabilityRow[]
}

/**
 * Resolves a scan by its public share token (no auth — read-only).
 * Returns null when the token is unknown or sharing is disabled.
 */
export async function getReportByShareToken(token: string): Promise<PublicReport | null> {
  if (!token) return null
  try {
    const [scan] = await db
      .select({
        id: scans.id,
        repoFullName: projects.repoFullName,
        createdAt: scans.createdAt,
        completedAt: scans.completedAt,
        summary: scans.summary,
      })
      .from(scans)
      .innerJoin(projects, eq(scans.projectId, projects.id))
      .where(eq(scans.shareToken, token))
      .limit(1)

    if (!scan) return null

    const vulns = await db
      .select({
        id: vulnerabilities.id,
        title: vulnerabilities.title,
        severity: vulnerabilities.severity,
        tool: vulnerabilities.tool,
        filePath: vulnerabilities.filePath,
        targetUrl: vulnerabilities.targetUrl,
        lineStart: vulnerabilities.lineStart,
        cweId: vulnerabilities.cweId,
        owaspCategory: vulnerabilities.owaspCategory,
        remediation: vulnerabilities.remediation,
        aiFixPatch: vulnerabilities.aiFixPatch,
        status: vulnerabilities.status,
        createdAt: vulnerabilities.createdAt,
        repoFullName: projects.repoFullName,
        scanId: vulnerabilities.scanId,
      })
      .from(vulnerabilities)
      .innerJoin(projects, eq(vulnerabilities.projectId, projects.id))
      .where(and(eq(vulnerabilities.scanId, scan.id), notInArray(vulnerabilities.status, ["false_positive", "dismissed"])))
      .orderBy(desc(vulnerabilities.createdAt))

    return {
      repoFullName: scan.repoFullName,
      createdAt: scan.createdAt,
      completedAt: scan.completedAt,
      summary: scan.summary,
      vulns: vulns as VulnerabilityRow[],
    }
  } catch {
    return null
  }
}

export interface ScanListRow {
  id: string
  repoFullName: string
  status: string
  vulnerabilitiesCount: number
  createdAt: Date
  completedAt: Date | null
  tools: ScanTool[]
}

export async function getUserScans(
  userId: string,
  limit = 50,
): Promise<ScanListRow[]> {
  const cookieStore = await cookies()
  const activeTeamId = cookieStore.get("active_team_id")?.value || "personal"

  const rows = await db
    .select({
      id: scans.id,
      repoFullName: projects.repoFullName,
      status: scans.status,
      vulnerabilitiesCount: scans.vulnerabilitiesCount,
      createdAt: scans.createdAt,
      completedAt: scans.completedAt,
      tools: scans.tools,
    })
    .from(scans)
    .innerJoin(projects, eq(scans.projectId, projects.id))
    .where(activeTeamId === "personal" 
      ? eq(scans.userId, userId) 
      : eq((projects as any).teamId, activeTeamId))
    .orderBy(desc(scans.createdAt))
    .limit(limit)

  return rows
}

export async function getVulnerabilitiesByScan(
  scanId: string,
  userId: string,
  view: "active" | "muted" = "active",
  /** Plan-based history cutoff (see getRetentionCutoff); null = no limit. */
  retentionCutoff: Date | null = null,
): Promise<VulnerabilityRow[]> {
  const mutedStatuses = ["false_positive", "dismissed"] as const
  return db
    .select({
      id: vulnerabilities.id,
      title: vulnerabilities.title,
      severity: vulnerabilities.severity,
      tool: vulnerabilities.tool,
      filePath: vulnerabilities.filePath,
      targetUrl: vulnerabilities.targetUrl,
      lineStart: vulnerabilities.lineStart,
      cweId: vulnerabilities.cweId,
      owaspCategory: vulnerabilities.owaspCategory,
      remediation: vulnerabilities.remediation,
      aiFixPatch: vulnerabilities.aiFixPatch,
      status: vulnerabilities.status,
      fingerprint: vulnerabilities.fingerprint,
      createdAt: vulnerabilities.createdAt,
      repoFullName: projects.repoFullName,
      scanId: vulnerabilities.scanId,
    })
    .from(vulnerabilities)
    .innerJoin(projects, eq(vulnerabilities.projectId, projects.id))
    .where(
      and(
        eq(vulnerabilities.scanId, scanId),
        eq(vulnerabilities.userId, userId),
        view === "muted"
          ? inArray(vulnerabilities.status, [...mutedStatuses])
          : notInArray(vulnerabilities.status, [...mutedStatuses]),
        retentionCutoff ? gte(vulnerabilities.createdAt, retentionCutoff) : undefined,
      ),
    )
    .orderBy(desc(vulnerabilities.createdAt))
}

export async function getScanShareToken(scanId: string, userId: string): Promise<string | null> {
  try {
    const [row] = await db
      .select({ shareToken: scans.shareToken })
      .from(scans)
      .where(and(eq(scans.id, scanId), eq(scans.userId, userId)))
      .limit(1)
    return row?.shareToken ?? null
  } catch {
    return null
  }
}