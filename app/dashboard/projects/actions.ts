"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { projects, organizations } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

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