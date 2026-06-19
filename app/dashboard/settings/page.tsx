import type { Metadata } from "next"
import { auth } from "@/auth"
import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { teams, teamMembers, users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { updateProfile, disconnectGitHub, deleteAccount, updateTeamName, removeTeamMember, inviteMembers } from "@/app/dashboard/actions"
import { redirect } from "next/navigation"
import { getUserApiKeys } from "@/lib/db/queries"
import { ApiKeysSection } from "@/components/dashboard/ApiKeysSection"

export const metadata: Metadata = { title: "Settings" }

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return redirect("/login")

  const { tab } = await searchParams
  const currentTab = tab === "team" ? "team" : "personal"

  const isGitHubUser = !!session.user.login
  const cookieStore = await cookies()
  const activeTeamId = cookieStore.get("active_team_id")?.value || "personal"

  let teamData = null
  let membersData: { memberId: string; role: string; name: string | null; email: string }[] = []
  const apiKeysList = await getUserApiKeys(session.user.id).catch(() => [])

  if (activeTeamId !== "personal") {
    const [t] = await db.select().from(teams).where(eq(teams.id, activeTeamId)).limit(1)
    if (t) {
      teamData = t
      // Retrieve members and associated user data
      membersData = await db
        .select({
          memberId: teamMembers.userId,
          role: teamMembers.role,
          name: users.name,
          email: users.email
        })
        .from(teamMembers)
        .innerJoin(users, eq(teamMembers.userId, users.id))
        .where(eq(teamMembers.teamId, activeTeamId))
    }
  }

  return (
    <div className="p-8 max-w-[720px] mx-auto">
      <div className="mb-6 border-b border-white/10 pb-4">
        <h1 className="text-2xl font-semibold text-white mb-4">Settings</h1>
        <div className="flex items-center gap-6">
          <a href="?tab=personal" className={`text-sm font-medium pb-4 border-b-2 transition-colors ${currentTab === "personal" ? "text-white border-blue-500" : "text-zinc-500 border-transparent hover:text-zinc-300"}`}>
            Personal Settings
          </a>
          <a href="?tab=team" className={`text-sm font-medium pb-4 border-b-2 transition-colors ${currentTab === "team" ? "text-white border-blue-500" : "text-zinc-500 border-transparent hover:text-zinc-300"}`}>
            Team Settings
          </a>
        </div>
      </div>

      {currentTab === "personal" && (
        <div className="space-y-6">
          {/* Profile Section */}
          <div className="bg-white/[0.02] border border-white/10 rounded-[12px]">
            <div className="px-5 py-4 border-b border-white/[0.07]">
              <h2 className="text-[13px] font-mono uppercase tracking-[0.08em] text-[#a1a1aa]">Profile Information</h2>
            </div>
            <div className="px-5 py-5 flex flex-col gap-5">
              <form action={async (formData) => {
                "use server";
                await updateProfile(formData.get("name") as string);
              }} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#444444]">Name</label>
                  <div className="flex gap-3">
                    <input name="name" defaultValue={session.user.name ?? ""} className="flex-1 h-9 px-3 rounded-[6px] bg-white/[0.03] border border-white/10 text-sm text-white focus:outline-none focus:border-white/30" />
                    <button type="submit" className="h-9 px-4 rounded-[6px] bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors">Save</button>
                  </div>
                </div>
              </form>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#444444]">Email Address</label>
                <input disabled value={session.user.email ?? ""} className="w-full h-9 px-3 rounded-[6px] bg-white/[0.01] border border-white/5 text-sm text-zinc-500 cursor-not-allowed" />
                <p className="text-[11px] text-zinc-500 mt-1">Email addresses are locked to prevent account hijacking.</p>
              </div>
            </div>
          </div>

          {/* Integrations Section */}
          <div className="bg-white/[0.02] border border-white/10 rounded-[12px]">
            <div className="px-5 py-4 border-b border-white/[0.07]">
              <h2 className="text-[13px] font-mono uppercase tracking-[0.08em] text-[#a1a1aa]">Integrations</h2>
            </div>
            <div className="px-5 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <div>
                  <p className="text-[13px] text-white" style={{ letterSpacing: "-0.26px" }}>GitHub</p>
                  <p className="text-[11px] text-[#555555]">
                    {isGitHubUser ? `Connected as @${session.user.login}` : "Not connected"}
                  </p>
                </div>
              </div>
              {isGitHubUser ? (
                <form action={async () => {
                  "use server";
                  await disconnectGitHub();
                }}>
                  <button type="submit" className="h-8 px-4 rounded-[6px] border border-red-500/20 bg-red-500/10 text-[12px] text-red-400 hover:bg-red-500/20 transition-colors">
                    Disconnect
                  </button>
                </form>
              ) : (
                <a href="/api/connect/github" className="h-8 px-4 rounded-[6px] border border-white/15 text-[12px] text-[#a1a1aa] hover:bg-white/5 hover:text-white transition-colors flex items-center justify-center">
                  Connect →
                </a>
              )}
            </div>
          </div>

          {/* API Keys Section (feature 12) */}
          <ApiKeysSection initialKeys={apiKeysList} />

          {/* Danger Zone Section */}
          <div className="bg-red-500/5 border border-red-500/20 rounded-[12px]">
            <div className="px-5 py-4 border-b border-red-500/20">
              <h2 className="text-[13px] font-mono uppercase tracking-[0.08em] text-red-400">Danger Zone</h2>
            </div>
            <div className="px-5 py-5 flex items-center justify-between">
              <div>
                <p className="text-[14px] font-medium text-white">Delete Account</p>
                <p className="text-[12px] text-zinc-400 mt-1">Permanently delete your account and all associated projects and scans.</p>
              </div>
              <form action={async () => {
                "use server";
                await deleteAccount();
                redirect("/api/auth/signout");
              }}>
                <button type="submit" className="h-9 px-4 rounded-[6px] bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors whitespace-nowrap">
                  Delete Account
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {currentTab === "team" && (
        <div className="space-y-6">
          {activeTeamId === "personal" ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-white/10 rounded-[12px] bg-white/[0.02]">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-4 border border-blue-500/20">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-blue-400">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <h3 className="text-white font-medium mb-2">Personal Workspace Active</h3>
              <p className="text-zinc-400 text-sm max-w-sm">You are currently in your personal workspace. Please utilize the sidebar menu to select a specific team to manage its configuration.</p>
            </div>
          ) : teamData ? (
            <>
              {/* Team Profile */}
              <div className="bg-white/[0.02] border border-white/10 rounded-[12px]">
                <div className="px-5 py-4 border-b border-white/[0.07]">
                  <h2 className="text-[13px] font-mono uppercase tracking-[0.08em] text-[#a1a1aa]">Team Profile</h2>
                </div>
                <div className="px-5 py-5">
                  <form action={async (formData) => {
                    "use server";
                    await updateTeamName(activeTeamId, formData.get("name") as string);
                  }} className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#444444]">Team Name</label>
                    <div className="flex gap-3">
                      <input name="name" defaultValue={teamData.name} className="flex-1 h-9 px-3 rounded-[6px] bg-white/[0.03] border border-white/10 text-sm text-white focus:outline-none focus:border-white/30" />
                      <button type="submit" className="h-9 px-4 rounded-[6px] bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors">Save Name</button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Team Members */}
              <div className="bg-white/[0.02] border border-white/10 rounded-[12px]">
                <div className="px-5 py-4 border-b border-white/[0.07] flex justify-between items-center">
                  <h2 className="text-[13px] font-mono uppercase tracking-[0.08em] text-[#a1a1aa]">Team Members</h2>
                </div>
                <div className="px-5 py-4 border-b border-white/[0.04]">
                  <form action={async (formData) => {
                    "use server";
                    const email = formData.get("email") as string;
                    if (email) await inviteMembers(activeTeamId, [email]);
                  }} className="flex gap-3">
                    <input name="email" type="email" placeholder="Invite member by email address..." className="flex-1 h-9 px-3 rounded-[6px] bg-white/[0.03] border border-white/10 text-sm text-white focus:outline-none focus:border-white/30" />
                    <button type="submit" className="h-9 px-4 rounded-[6px] bg-emerald-500 text-black text-sm font-medium hover:bg-emerald-400 transition-colors whitespace-nowrap">Send Invite</button>
                  </form>
                </div>
                <ul className="divide-y divide-white/[0.04]">
                  {membersData.map(m => (
                    <li key={m.memberId} className="px-5 py-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{m.name || "Unknown User"}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{m.email}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 bg-white/5 px-2 py-1 rounded">{m.role}</span>
                        {m.memberId !== session.user.id && (
                          <form action={async () => {
                            "use server";
                            await removeTeamMember(activeTeamId, m.memberId);
                          }}>
                            <button type="submit" className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors">Remove</button>
                          </form>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}