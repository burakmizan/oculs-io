"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { queueScan } from "@/lib/db/queries"
import { db } from "@/lib/db"
import { scans, vulnerabilities, teams, teamMembers, teamInvites, projects, users, accounts } from "@/lib/db/schema"
import { cookies } from "next/headers"
import { eq, and, count, gte } from "drizzle-orm"
import { TOOLS_BY_ID } from "@/lib/tools"
import type { ScanTool } from "@/types"

export interface ScanActionState {
  error?: string
  ok?: boolean
  scanId?: string
}

const REPO_RE = /^[\w.-]+\/[\w.-]+$/

/**
 * Triggers the GitHub Actions workflow_dispatch directly from the server action.
 * No HTTP round-trip — uses the session token directly.
 */
async function triggerGitHubWorkflow(
  scanId: string,
  repoFullName: string,
  tools: ScanTool[],
  githubToken: string,
  targetUrl: string | null,
): Promise<void> {
  const [owner, repo] = repoFullName.split("/")
  if (!owner || !repo) return

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/oculs-scan.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          scan_id: scanId,
          tools: tools.join(","),
          target_url: targetUrl ?? "",
        },
      }),
    },
  )

  if (!res.ok) {
    const err = await res.text()
    console.error("[createScan] GitHub workflow dispatch failed:", res.status, err)
    // 422 = workflow_dispatch trigger not found in the branch
    // This happens when YAML changes haven't been pushed to default branch yet
    if (res.status === 422) {
      console.warn("[createScan] Tip: Push the workflow YAML to main branch first, then retry.")
    }
  } else {
    console.log(`[createScan] Workflow dispatched: ${repoFullName} scan=${scanId}`)
  }
}

export async function createScan(
  _prev: ScanActionState,
  formData: FormData,
): Promise<ScanActionState> {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: "Your session expired. Please sign in again." }
  }

  const repoFullName = String(formData.get("repoFullName") ?? "").trim()
  const targetUrlRaw = String(formData.get("targetUrl") ?? "").trim()

  const tools = formData
    .getAll("tools")
    .map(String)
    .filter((t): t is ScanTool => t in TOOLS_BY_ID)

  if (!REPO_RE.test(repoFullName)) {
    return { error: "Enter a repository as owner/repo." }
  }
  if (tools.length === 0) {
    return { error: "Select at least one scanner to run." }
  }

  // ── PLAN LIMIT KONTROLÜ ──
  const [userRecord] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, session.user.id)).limit(1)
  
  if (userRecord?.plan === "starter") {
    // 1. DAST Engeli
    const isDastSelected = targetUrlRaw !== "" || tools.some(t => ["owasp_zap", "nuclei", "nikto", "wapiti", "sqlmap", "arachni", "dirsearch", "testssl", "wpscan", "nmap_vulners"].includes(t))
    if (isDastSelected) {
      return { error: "UPGRADE_REQUIRED_DAST" }
    }

    // 2. Aylık Tarama Limiti (Max 3)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const [scanCount] = await db.select({ c: count() })
      .from(scans)
      .where(
        and(
          eq(scans.userId, session.user.id),
          gte(scans.createdAt, thirtyDaysAgo),
        )
      )
    
    if (scanCount.c >= 3) {
      return { error: "UPGRADE_REQUIRED_SCANS" }
    }
  }

  let scanId: string
  try {
    scanId = await queueScan({
      userId: session.user.id,
      repoFullName,
      targetUrl: targetUrlRaw || null,
      tools,
    })
    revalidatePath("/dashboard")
  } catch {
    return {
      error: "Couldn't queue the scan — the database isn't reachable. Check DATABASE_URL.",
    }
  }

  // Trigger GitHub Actions directly — token from session (GitHub OAuth)
  // or fall back to GITHUB_TOKEN env var (PAT set in Vercel).
  const githubToken =
    session.user.githubAccessToken ??
    process.env.GITHUB_TOKEN

  if (githubToken) {
    try {
      await triggerGitHubWorkflow(scanId, repoFullName, tools, githubToken, targetUrlRaw || null)
    } catch (err) {
      // Non-fatal — scan is queued in Aurora, can retry manually
      console.error("[createScan] triggerGitHubWorkflow threw:", err)
    }
  } else {
    console.warn("[createScan] No GitHub token — workflow not dispatched. Set GITHUB_TOKEN in env.")
  }

  return { ok: true, scanId }
}

export async function createTeam(name: string, userId: string) {
  try {
    const [newTeam] = await db.insert(teams).values({ name }).returning();
    
    // Create member as owner
    await db.insert(teamMembers).values({
      teamId: newTeam.id,
      userId,
      role: "owner"
    });

    // Set active team cookie
    const cookieStore = await cookies();
    cookieStore.set("active_team_id", newTeam.id);
    
    return { ok: true, teamId: newTeam.id };
  } catch (err) {
    console.error("Failed to create team:", err);
    return { ok: false, error: "Failed to create team" };
  }
}

export async function inviteMembers(teamId: string, emails: string[]) {
  try {
    const inviteRecords = emails.filter(email => email.trim() !== "").map(email => {
      const token = globalThis.crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

      return {
        teamId,
        email: email.trim(),
        token,
        expiresAt
      };
    });

    if (inviteRecords.length === 0) return { ok: false, error: "No valid emails provided" };

    await db.insert(teamInvites).values(inviteRecords);

    // Dynamic Hackathon URL generation
    const inviteLinks = inviteRecords.map(r => ({
      email: r.email,
      link: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/invite/accept?token=${r.token}`
    }));

    // In a hackathon production runtime, print links to logs or return them
    console.log("[INVITE LINKS GENERATED]:", inviteLinks);

    return { ok: true, invites: inviteLinks };
  } catch (err) {
    console.error("Failed to process invites:", err);
    return { ok: false, error: "Failed to process invitations" };
  }
}

export async function switchTeam(teamId: string) {
  const cookieStore = await cookies();
  cookieStore.set("active_team_id", teamId);
  return { ok: true };
}

export async function getUserTeams(userId: string) {
  try {
    const userTeams = await db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .innerJoin(teamMembers, eq(teams.id, teamMembers.teamId))
      .where(eq(teamMembers.userId, userId));

    const cookieStore = await cookies();
    const activeTeamId = cookieStore.get("active_team_id")?.value || "personal";

    return { ok: true, teams: userTeams, activeTeamId };
  } catch (err) {
    console.error("Failed to fetch teams:", err);
    return { ok: false, teams: [], activeTeamId: "personal" };
  }
}

export async function updateProfile(name: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }
  try {
    await db.update(users).set({ name }).where(eq(users.id, session.user.id))
    revalidatePath("/dashboard/settings")
    return { ok: true }
  } catch (e) {
    return { error: "Failed to update profile" }
  }
}

export async function disconnectGitHub() {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }
  try {

    await db.delete(accounts).where(and(eq(accounts.userId, session.user.id), eq(accounts.provider, "github")))
    revalidatePath("/dashboard/settings")
    return { ok: true }
  } catch (e) {
    return { error: "Failed to disconnect GitHub" }
  }
}

export async function deleteAccount() {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }
  try {
    await db.delete(users).where(eq(users.id, session.user.id))
    return { ok: true }
  } catch (e) {
    return { error: "Failed to delete account" }
  }
}

export async function updateTeamName(teamId: string, name: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }
  try {
    await db.update(teams).set({ name }).where(eq(teams.id, teamId))
    revalidatePath("/dashboard/settings")
    return { ok: true }
  } catch (e) {
    return { error: "Failed to update team name" }
  }
}

export async function removeTeamMember(teamId: string, targetUserId: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }
  try {
    await db.delete(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, targetUserId)))
    revalidatePath("/dashboard/settings")
    return { ok: true }
  } catch (e) {
    return { error: "Failed to remove member" }
  }
}

export async function dismissOnboardingChecklist() {
  const session = await auth()
  if (!session?.user?.id) return
  try {
    await db
      .update(users)
      .set({ onboardingCompletedAt: new Date() })
      .where(and(eq(users.id, session.user.id)))
    revalidatePath("/dashboard")
  } catch { /* non-fatal */ }
}
