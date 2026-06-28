"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { queueScan, saveScanTechStack } from "@/lib/db/queries"
import { detectTechStack } from "@/lib/ai"
import { db } from "@/lib/db"
import { scans, vulnerabilities, teams, teamMembers, teamInvites, projects, users, accounts } from "@/lib/db/schema"
import { cookies } from "next/headers"
import { eq, and, count, gte, desc } from "drizzle-orm"
import { callGeminiSast, makeFingerprint, SEVERITY_WEIGHTS, VALID_SEV, VALID_EXPL } from "@/lib/ai/zip-sast"
import type { SastFinding } from "@/lib/ai/zip-sast"
import type { SeverityLevel, ExploitabilityLevel } from "@/types"
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
  if (tools.length === 0 && !repoFullName.startsWith("zip/")) {
    return { error: "Select at least one scanner to run." }
  }

  // ── PLAN LIMIT KONTROLÜ ──
  const [userRecord] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, session.user.id)).limit(1)
  
  if (userRecord?.plan === "starter") {
    // 1. DAST Engeli (ZIP projects are always SAST-only)
    if (!repoFullName.startsWith("zip/")) {
      const isDastSelected = targetUrlRaw !== "" || tools.some(t => ["owasp_zap", "nuclei", "nikto", "wapiti", "sqlmap", "arachni", "dirsearch", "testssl", "wpscan", "nmap_vulners"].includes(t))
      if (isDastSelected) {
        return { error: "UPGRADE_REQUIRED_DAST" }
      }
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

  // ── ZIP RESCAN ────────────────────────────────────────────────────────────
  if (repoFullName.startsWith("zip/")) {
    const [zipProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.userId, session.user.id), eq(projects.repoFullName, repoFullName)))
      .limit(1)

    if (!zipProject) return { error: "Project not found." }

    const [lastScan] = await db
      .select({ id: scans.id, summary: scans.summary })
      .from(scans)
      .where(and(eq(scans.projectId, zipProject.id), eq(scans.status, "completed")))
      .orderBy(desc(scans.createdAt))
      .limit(1)

    const codeFiles = (lastScan?.summary as any)?.codeFiles as
      { path: string; content: string }[] | undefined

    const [newScan] = await db
      .insert(scans)
      .values({
        projectId: zipProject.id,
        userId: session.user.id,
        branch: "main",
        tools: ["semgrep"],
        status: "running",
        trigger: "manual",
        startedAt: new Date(),
      })
      .returning({ id: scans.id })
    const zipScanId = newScan!.id

    if (!codeFiles?.length && lastScan) {
      // Fallback for old scans without codeFiles: copy findings from last scan
      const prevFindings = await db
        .select()
        .from(vulnerabilities)
        .where(eq(vulnerabilities.scanId, lastScan.id))

      if (prevFindings.length > 0) {
        const BATCH = 50
        for (let i = 0; i < prevFindings.length; i += BATCH) {
          await db.insert(vulnerabilities).values(
            prevFindings.slice(i, i + BATCH).map(
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              ({ id: _id, scanId: _sid, createdAt: _ca, updatedAt: _ua, ...rest }) => ({
                ...rest,
                scanId: zipScanId,
              }),
            ) as any[],
          )
        }
      }

      await db.update(scans).set({
        status: "completed",
        completedAt: new Date(),
        vulnerabilitiesCount: prevFindings.length,
        summary: lastScan.summary,
      }).where(eq(scans.id, zipScanId))
    } else {
      let sastFindings: SastFinding[] = []
      if (codeFiles && codeFiles.length > 0) {
        try {
          sastFindings = await callGeminiSast(codeFiles)
        } catch (err) {
          console.error("[createScan/zip] Gemini SAST failed (non-fatal):", err)
        }
      }

      const cleanFindings = sastFindings.filter(
        (f) => f.title && f.filePath && VALID_SEV.has(f.severity as SeverityLevel),
      )

      if (cleanFindings.length > 0) {
        const rows = cleanFindings.map((f) => {
          const sev = VALID_SEV.has(f.triageSeverity as SeverityLevel)
            ? (f.triageSeverity as SeverityLevel)
            : (f.severity as SeverityLevel)
          const expl = VALID_EXPL.has(f.exploitability as ExploitabilityLevel)
            ? (f.exploitability as ExploitabilityLevel)
            : null
          const lineStart = typeof f.lineStart === "number" ? f.lineStart : null
          const lineEnd   = typeof f.lineEnd   === "number" ? f.lineEnd   : null
          return {
            scanId:          zipScanId,
            projectId:       zipProject.id,
            userId:          session.user.id,
            tool:            "semgrep" as const,
            category:        "sast"   as const,
            ruleId:          f.ruleId          || null,
            title:           f.title,
            description:     f.description     || null,
            severity:        sev,
            confidence:      null,
            exploitability:  expl,
            cweId:           f.cweId           || null,
            owaspCategory:   f.owaspCategory   || null,
            cvssScore:       f.cvssScore       || null,
            filePath:        f.filePath        || null,
            lineStart,
            lineEnd,
            targetUrl:       null,
            codeSnippet:     f.codeSnippet     || null,
            remediation:     f.remediation     || null,
            aiFixPatch:      null,
            aiFixExplanation: null,
            aiFixModel:      null,
            fixStatus:       "none" as const,
            status:          "open"  as const,
            references:      null,
            fingerprint:     makeFingerprint(
              f.ruleId || f.title.slice(0, 20),
              f.filePath,
              lineStart ?? 0,
            ),
            raw: f as unknown as Record<string, unknown>,
          }
        })
        const BATCH = 50
        try {
          for (let i = 0; i < rows.length; i += BATCH) {
            await db.insert(vulnerabilities).values(rows.slice(i, i + BATCH))
          }
        } catch (err) {
          console.error("[createScan/zip] Vulnerability insert failed:", err)
        }
      }

      const finalSummary: Record<SeverityLevel, number> = {
        critical: 0, high: 0, medium: 0, low: 0, info: 0,
      }
      for (const f of cleanFindings) {
        const sev = VALID_SEV.has(f.triageSeverity as SeverityLevel)
          ? (f.triageSeverity as SeverityLevel)
          : (f.severity as SeverityLevel)
        finalSummary[sev]++
      }
      const riskScore = Math.min(
        100,
        Object.entries(finalSummary).reduce(
          (acc, [sev, cnt]) => acc + SEVERITY_WEIGHTS[sev as SeverityLevel] * cnt,
          0,
        ),
      )
      try {
        await db.update(scans).set({
          status: "completed",
          completedAt: new Date(),
          vulnerabilitiesCount: cleanFindings.length,
          summary: { ...finalSummary, riskScore, codeFiles: codeFiles ?? [] } as any,
        }).where(eq(scans.id, zipScanId))
      } catch (err) {
        console.error("[createScan/zip] Scan finalize failed:", err)
      }
    }

    revalidatePath("/dashboard/projects")
    revalidatePath("/dashboard/scans")
    revalidatePath("/dashboard")
    return { ok: true, scanId: zipScanId }
  }
  // ── END ZIP RESCAN ────────────────────────────────────────────────────────

  let scanId: string
  try {
    scanId = await queueScan({
      userId: session.user.id,
      repoFullName,
      targetUrl: targetUrlRaw || null,
      tools,
    })
    revalidatePath("/dashboard")
  } catch (err) {
    console.error("[createScan] queueScan failed:", err)
    return {
      error: "Couldn't queue the scan — the database isn't reachable. Check DATABASE_URL.",
    }
  }

  // Trigger GitHub Actions directly — token from session (GitHub OAuth)
  // or fall back to GITHUB_TOKEN env var (PAT set in Vercel).
  let userGithubToken = session.user.githubAccessToken
  
  // Hayalet token kontrolü: Kullanıcı GitHub hesabını ayırmışsa token'ı güvenlik gereği yoksay.
  if (userGithubToken) {
    const [githubAccount] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, session.user.id), eq(accounts.provider, "github")))
      .limit(1)
    if (!githubAccount) {
      userGithubToken = undefined
    }
  }

  const githubToken = userGithubToken ?? process.env.GITHUB_TOKEN

  if (githubToken) {
    try {
      await triggerGitHubWorkflow(scanId, repoFullName, tools, githubToken, targetUrlRaw || null)
    } catch (err) {
      // Non-fatal — scan is queued in Aurora, can retry manually
      console.error("[createScan] triggerGitHubWorkflow threw:", err)
    }

    // Detect the repo's framework/language profile from its dependency manifest
    // and cache it on the scan row, so AI triage in the webhook can reason about
    // framework-specific exploitability. Fully best-effort — never blocks a scan.
    try {
      const techStack = await detectTechStack(repoFullName, githubToken)
      await saveScanTechStack(scanId, techStack)
    } catch (err) {
      console.error("[createScan] tech stack detection failed (non-fatal):", err)
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
    const [membership] = await db.select().from(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, session.user.id), eq(teamMembers.role, "owner"))).limit(1)
    if (!membership) return { error: "Unauthorized: You must be a team owner." }

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
    if (session.user.id !== targetUserId) {
      const [membership] = await db.select().from(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, session.user.id), eq(teamMembers.role, "owner"))).limit(1)
      if (!membership) return { error: "Unauthorized: You must be a team owner to remove others." }
    }

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
