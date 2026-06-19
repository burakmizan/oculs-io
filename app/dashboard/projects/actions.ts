"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { TOOLS_BY_ID } from "@/lib/tools"
import { projects, organizations, users, scans } from "@/lib/db/schema"
import { eq, count, and } from "drizzle-orm"
import { cookies } from "next/headers"
import type { ScanTool } from "@/types"

export interface ProjectActionState {
  error?: string
  ok?: boolean
}

const REPO_RE = /^[\w.-]+\/[\w.-]+$/

export async function createProject(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Session expired." }

  const userId = session.user.id
  const name        = String(formData.get("name") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  const repoRaw     = String(formData.get("repoFullName") ?? "").trim()
  const targetUrl   = String(formData.get("targetUrl") ?? "").trim()
  const serverIp    = String(formData.get("serverIp") ?? "").trim()

  if (!name)    return { error: "Project name is required." }
  if (!repoRaw) return { error: "Repository is required." }

  // Accept full GitHub URL or owner/repo slug
  const repoFullName = repoRaw.startsWith("https://github.com/")
    ? repoRaw.replace("https://github.com/", "").replace(/\/$/, "")
    : repoRaw

  if (!REPO_RE.test(repoFullName)) {
    return { error: "Enter repository as owner/repo (e.g. acme/api)." }
  }

  try {
    const [userRecord] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, userId)).limit(1)
    if (!userRecord || userRecord.plan === "starter") {
      const [projectCount] = await db.select({ c: count() }).from(projects).where(eq(projects.userId, userId))
      if (projectCount.c >= 1) {
        return { error: "UPGRADE_REQUIRED_PROJECTS" }
      }
    }
  } catch (err) {

    try {
      const [projectCount] = await db.select({ c: count() }).from(projects).where(eq(projects.userId, userId))
      if (projectCount.c >= 1) {
        return { error: "UPGRADE_REQUIRED_PROJECTS" }
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Resolve or create the user's organization
  const [existingOrg] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.ownerId, userId))
    .limit(1)

  let orgId = existingOrg?.id
  if (!orgId) {
    const [newOrg] = await db
      .insert(organizations)
      .values({
        ownerId: userId,
        name: session.user.name ?? "My Workspace",
        slug: (session.user.login ?? session.user.email ?? "workspace")
          .toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60),
      })
      .onConflictDoUpdate({
        target: [organizations.ownerId, organizations.slug],
        set: { name: session.user.name ?? "My Workspace" },
      })
      .returning({ id: organizations.id })
    orgId = newOrg!.id
  }

  // Build target URL — prefer explicit field, fall back to server IP
  const resolvedTargetUrl = targetUrl || (serverIp ? `http://${serverIp}` : null)

  try {
    await db
      .insert(projects)
      .values({
        userId,
        organizationId: orgId,
        name,
        description: description || null,
        repoFullName,
        repoUrl: `https://github.com/${repoFullName}`,
        targetUrl: resolvedTargetUrl || null,
      })
      .onConflictDoUpdate({
        target: [projects.userId, projects.repoFullName],
        set: {
          name,
          description: description || null,
          targetUrl: resolvedTargetUrl || null,
          updatedAt: new Date(),
        },
      })

    revalidatePath("/dashboard/projects")
    revalidatePath("/dashboard/scans")
    revalidatePath("/dashboard")
    return { ok: true }
  } catch {
    return { error: "Could not save project. Check your connection and try again." }
  }
}

export async function updateProject(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Session expired." }

  const userId      = session.user.id
  const projectId   = String(formData.get("projectId") ?? "").trim()
  const name        = String(formData.get("name") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  const repoRaw     = String(formData.get("repoFullName") ?? "").trim()
  const targetUrl   = String(formData.get("targetUrl") ?? "").trim()
  const serverIp    = String(formData.get("serverIp") ?? "").trim()

  if (!projectId) return { error: "Project ID missing." }
  if (!name)      return { error: "Project name is required." }
  if (!repoRaw)   return { error: "Repository is required." }

  const repoFullName = repoRaw.startsWith("https://github.com/")
    ? repoRaw.replace("https://github.com/", "").replace(/\/$/, "")
    : repoRaw

  if (!REPO_RE.test(repoFullName)) {
    return { error: "Enter repository as owner/repo (e.g. acme/api)." }
  }

  const resolvedTargetUrl = targetUrl || (serverIp ? `http://${serverIp}` : null)

  try {
    await db
      .update(projects)
      .set({
        name,
        description: description || null,
        repoFullName,
        repoUrl: `https://github.com/${repoFullName}`,
        targetUrl: resolvedTargetUrl || null,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))

    revalidatePath("/dashboard/projects")
    revalidatePath("/dashboard/scans")
    revalidatePath("/dashboard")
    return { ok: true }
  } catch {
    return { error: "Could not update project. Try again." }
  }
}

export async function deleteProject(projectId: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Session expired." }

  try {
    await db.delete(projects).where(and(eq(projects.id, projectId), eq(projects.userId, session.user.id)))
    revalidatePath("/dashboard/projects")
    revalidatePath("/dashboard")
    return { ok: true }
  } catch {
    return { error: "Could not delete project." }
  }
}

export async function clearScanHistory(projectId: string): Promise<{ ok?: boolean; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Session expired." }

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, session.user.id)))
    .limit(1)

  if (!project) return { error: "Project not found." }

  try {
    await db.delete(scans).where(and(eq(scans.projectId, projectId), eq(scans.userId, session.user.id)))
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/projects")
    revalidatePath(`/dashboard/projects/${projectId}/settings`)
    return { ok: true }
  } catch {
    return { error: "Could not clear scan history." }
  }
}

export async function toggleSchedule(projectId: string, enabled: boolean) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Session expired." }

  try {
    await db
      .update(projects)
      .set({ scanScheduleEnabled: enabled, updatedAt: new Date() })
      .where(and(eq(projects.id, projectId), eq(projects.userId, session.user.id)))
    revalidatePath("/dashboard/projects")
    return { ok: true }
  } catch {
    return { error: "Could not update schedule." }
  }
}

const VALID_FREQ = new Set(["daily", "weekly"])
const VALID_GATE = new Set(["off", "critical", "high", "medium"])

export async function updateProjectSettings(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Session expired." }

  const projectId = String(formData.get("projectId") ?? "").trim()
  if (!projectId) return { error: "Project ID missing." }

  // Schedule
  const scanScheduleEnabled = formData.get("scanScheduleEnabled") === "true"
  const freqRaw = String(formData.get("scanFrequency") ?? "daily")
  const scanFrequency = VALID_FREQ.has(freqRaw) ? freqRaw : "daily"
  const scanHourUtc = Math.min(23, Math.max(0, Number(formData.get("scanHourUtc") ?? 2) || 0))
  const scanDayOfWeek = Math.min(6, Math.max(0, Number(formData.get("scanDayOfWeek") ?? 1) || 0))
  const tools = formData
    .getAll("tools")
    .map(String)
    .filter((t): t is ScanTool => t in TOOLS_BY_ID)

  // Policies
  const gateRaw = String(formData.get("gateThreshold") ?? "critical")
  const gateThreshold = VALID_GATE.has(gateRaw) ? gateRaw : "critical"
  const autoFixEnabled = formData.get("autoFixEnabled") === "true"
  const badgePublic = formData.get("badgePublic") === "true"

  try {
    await db
      .update(projects)
      .set({
        scanScheduleEnabled,
        scanFrequency,
        scanHourUtc,
        scanDayOfWeek,
        scheduledTools: tools.length > 0 ? tools : null,
        gateThreshold,
        autoFixEnabled,
        badgePublic,
        updatedAt: new Date(),
      })
      .where(and(eq(projects.id, projectId), eq(projects.userId, session.user.id)))

    revalidatePath("/dashboard/projects")
    revalidatePath(`/dashboard/projects/${projectId}/settings`)
    return { ok: true }
  } catch {
    return { error: "Could not save settings. Try again." }
  }
}