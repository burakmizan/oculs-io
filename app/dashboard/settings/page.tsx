import type { Metadata } from "next"
import { auth } from "@/auth"

export const metadata: Metadata = { title: "Settings" }

export default async function SettingsPage() {
  const session = await auth()
  const isGitHubUser = !!session?.user?.login

  return (
    <div className="p-8 max-w-[720px] mx-auto">
      <div className="mb-8 pb-6 border-b border-white/10">
        <p className="text-[11px] font-mono uppercase tracking-[0.08em] text-[#444444] mb-1.5">
          SETTINGS
        </p>
        <h1 className="text-[26px] font-semibold text-white" style={{ letterSpacing: "-1.04px" }}>
          Settings
        </h1>
      </div>

      {/* Profile */}
      <div className="mb-6 bg-white/[0.02] border border-white/10 rounded-[12px]">
        <div className="px-5 py-4 border-b border-white/[0.07]">
          <h2 className="text-[13px] font-mono uppercase tracking-[0.08em] text-[#a1a1aa]">Profile</h2>
        </div>
        <div className="px-5 py-5 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#444444]">Name</p>
            <p className="text-[13px] text-white">{session?.user?.name ?? "—"}</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#444444]">Email</p>
            <p className="text-[13px] text-white">{session?.user?.email ?? "—"}</p>
          </div>
          {session?.user?.login && (
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#444444]">GitHub</p>
              <p className="text-[13px] text-white font-mono">@{session.user.login}</p>
            </div>
          )}
        </div>
      </div>

      {/* Plan */}
      <div className="mb-6 bg-white/[0.02] border border-white/10 rounded-[12px]">
        <div className="px-5 py-4 border-b border-white/[0.07]">
          <h2 className="text-[13px] font-mono uppercase tracking-[0.08em] text-[#a1a1aa]">Plan</h2>
        </div>
        <div className="px-5 py-5 flex items-center justify-between">
          <div>
            <p className="text-[14px] font-medium text-white" style={{ letterSpacing: "-0.28px" }}>Free</p>
            <p className="text-[12px] text-[#555555] mt-0.5">5 projects · 50 scans/month · Community support</p>
          </div>
          <a
            href="/#pricing"
            className="h-8 px-4 rounded-[6px] border border-white/15 text-[12px] text-[#a1a1aa] hover:bg-white/5 hover:text-white transition-colors"
          >
            Upgrade →
          </a>
        </div>
      </div>

      {/* Integrations */}
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
                {isGitHubUser ? `Connected as @${session?.user?.login}` : "Not connected"}
              </p>
            </div>
          </div>
          {isGitHubUser ? (
            <span className="flex items-center gap-1.5 text-[12px] text-[#4ade80]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
              Connected
            </span>
          ) : (
            <a
              href="/api/connect/github"
              className="h-8 px-4 rounded-[6px] border border-white/15 text-[12px] text-[#a1a1aa] hover:bg-white/5 hover:text-white transition-colors"
            >
              Connect →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}