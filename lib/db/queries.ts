import { eq, and, count, desc, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
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
}): Promise<User> {
  const [user] = await db
    .insert(users)
    .values({
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
    })
    .returning()
  return user
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
  const [projectCount, scanCount, openBySeverity] = await Promise.all([
    db.select({ c: count() }).from(projects).where(eq(projects.userId, userId)),
    db.select({ c: count() }).from(scans).where(eq(scans.userId, userId)),
    db
      .select({ severity: vulnerabilities.severity, c: count() })
      .from(vulnerabilities)
      .where(
        and(
          eq(vulnerabilities.userId, userId),
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
    .where(eq(scans.userId, userId))
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

export async function getUserProjects(
  userId: string,
): Promise<ProjectOption[]> {
  return db
    .select({
      id: projects.id,
      name: projects.name,
      repoFullName: projects.repoFullName,
      targetUrl: projects.targetUrl,
    })
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt))
}

/* ── Scan orchestration ────────────────────────────────────────────── */

/** Idempotently resolve a project for `owner/repo`, then queue a scan. */
export async function queueScan(input: {
  userId: string
  repoFullName: string
  targetUrl: string | null
  tools: ScanTool[]
}): Promise<string> {
  const [project] = await db
    .insert(projects)
    .values({
      userId: input.userId,
      name: input.repoFullName.split("/").pop() ?? input.repoFullName,
      repoFullName: input.repoFullName,
      repoUrl: `https://github.com/${input.repoFullName}`,
      targetUrl: input.targetUrl,
    })
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
  createdAt: Date
  repoFullName: string
  scanId: string
}

export async function getVulnerabilities(
  userId: string,
  limit = 50,
): Promise<VulnerabilityRow[]> {
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
    .where(eq(vulnerabilities.userId, userId))
    .orderBy(desc(vulnerabilities.createdAt))
    .limit(limit)
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
  limit = 20,
): Promise<ScanListRow[]> {
  return db
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
    .where(eq(scans.userId, userId))
    .orderBy(desc(scans.createdAt))
    .limit(limit)
}

export async function getVulnerabilitiesByScan(
  scanId: string,
  userId: string,
): Promise<VulnerabilityRow[]> {
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
    .where(
      and(
        eq(vulnerabilities.scanId, scanId),
        eq(vulnerabilities.userId, userId),
      ),
    )
    .orderBy(desc(vulnerabilities.createdAt))
}