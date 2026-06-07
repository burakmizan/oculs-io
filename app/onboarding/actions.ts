"use server"

import { redirect } from "next/navigation"
import { auth } from "@/auth"
import {
  createOrganization,
  createOnboardingProject,
  markOnboardingComplete,
} from "@/lib/db/queries"

export interface WorkspaceActionState {
  error?: string
  ok?: boolean
  orgId?: string
}

export interface IntegrationActionState {
  error?: string
}

const NAME_MAX = 80

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "workspace"
}

/** Step 1 — creates the tenant organization, returns its id to the client. */
export async function completeWorkspaceStep(
  _prev: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: "Session expired. Please sign in again." }
  }

  const rawName = String(formData.get("workspaceName") ?? "").trim()
  const name = rawName.slice(0, NAME_MAX) || session.user.name || "My Workspace"

  try {
    const org = await createOrganization({
      ownerId: session.user.id,
      name,
      slug: toSlug(name),
    })
    return { ok: true, orgId: org.id }
  } catch {
    return { error: "Could not create workspace. Check your connection and try again." }
  }
}

/**
 * Step 3 — persists the project row (with Step 2 data passed as hidden fields),
 * marks the user as onboarded, and redirects to the dashboard.
 */
export async function completeIntegration(
  _prev: IntegrationActionState,
  formData: FormData,
): Promise<IntegrationActionState> {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: "Session expired. Please sign in again." }
  }

  const userId = session.user.id
  const orgId = String(formData.get("orgId") ?? "").trim()
  const projectName = String(formData.get("projectName") ?? "").trim()
  const projectDescription = String(formData.get("projectDescription") ?? "").trim()
  const sourceType = String(formData.get("sourceType") ?? "")
  const repoFullName = String(formData.get("repoFullName") ?? "").trim()

  if (!orgId) return { error: "Workspace data missing. Please restart onboarding." }
  if (!projectName) return { error: "Project name is required." }
  if (!["github", "zip"].includes(sourceType)) {
    return { error: "Select a code source to continue." }
  }

  let finalRepoFullName: string
  let repoUrl: string | null = null

  if (sourceType === "github") {
    if (!repoFullName) return { error: "Select or enter a GitHub repository." }
    // Accept both "owner/repo" and a full GitHub URL.
    const slug = repoFullName.startsWith("https://github.com/")
      ? repoFullName.replace("https://github.com/", "")
      : repoFullName
    finalRepoFullName = slug
    repoUrl = `https://github.com/${slug}`
  } else {
    // ZIP — build a stable, unique identifier from the project name.
    const nameSlug = projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
    finalRepoFullName = `zip/${nameSlug || "project"}`
  }

  try {
    await createOnboardingProject({
      userId,
      organizationId: orgId,
      name: projectName,
      description: projectDescription || null,
      repoFullName: finalRepoFullName,
      repoUrl,
    })
    await markOnboardingComplete(userId)
  } catch {
    return { error: "Could not save your project. Check your connection and try again." }
  }

  redirect("/dashboard")
}
