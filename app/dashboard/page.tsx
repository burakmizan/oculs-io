import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/auth"
import { QuickScanDropdown } from "@/components/dashboard/QuickScanDropdown"
import {
  getDashboardStats,
  getRecentScans,
  getUserProjects,
  getOwaspCoverage,
  getMttrStats,
  getRiskTrend,
  getUserPlan,
  getOnboardingStatus,
  hasCompletedOnboarding,
  type RecentScanRow,
  type ProjectOption,
  type OwaspCell,
  type MttrStats,
  type RiskTrendPoint,
  type OnboardingStatus,
} from "@/lib/db/queries"
import type { DashboardStats } from "@/types"
import { RiskGauge } from "@/components/dashboard/RiskGauge"
import { RiskTrend } from "@/components/dashboard/RiskTrend"
import { OwaspGrid } from "@/components/dashboard/OwaspGrid"
import { MttrCard } from "@/components/dashboard/MttrCard"
import { OnboardingChecklistWrapper } from "@/components/dashboard/OnboardingChecklistWrapper"
import { dismissOnboardingChecklist } from "./actions"

export const metadata: Metadata = { title: "Overview" }

const EMPTY_STATS: DashboardStats = {
  projects: 0,
  scans: 0,
  openVulnerabilities: 0,
  riskScore: null,
  closedLast30d: 0,
  openedLast30d: 0,
}

/** Plan-aware display limits for the Usage card. null = unlimited (∞). */
const PLAN_META: Record<
  string,
  { label: string; scans: number | null; projects: number | null; findings: number | null }
> = {
  starter:    { label: "Free Plan",       scans: 3,    projects: 1,    findings: 500  },
  pro:        { label: "Pro Plan",         scans: 50,   projects: null, findings: null },
  enterprise: { label: "Enterprise Plan",  scans: null, projects: null, findings: null },
}

function RiskBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-[#444444]">—</span>
  const color =
    score >= 70 ? "text-[#f87171]" : score >= 40 ? "text-[#f5a623]" : "text-[#4ade80]"
  return <span className={color}>{score}</span>
}

function UsageBar({ used, total, label }: { used: number; total: number | null; label: string }) {
  const unlimited = total === null
  const pct = unlimited || total === 0 ? 0 : Math.min(100, Math.round((used / total) * 100))
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono text-[#555555] uppercase tracking-[0.06em]">{label}</span>
        <span className="text-[11px] font-mono text-[#666666]">
          {used.toLocaleString()} / {unlimited ? "∞" : total.toLocaleString()}
        </span>
      </div>
      <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full bg-white/30 rounded-full transition-all"
          style={{ width: unlimited ? "100%" : `${pct}%`, opacity: unlimited ? 0.25 : 1 }}
        />
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const session = await auth()
  const userId = session!.user.id
  const firstName = session?.user?.name?.split(" ")[0] ?? session?.user?.login ?? "there"
  const isGitHubUser = !!session?.user?.login

  let stats: DashboardStats = EMPTY_STATS
  let recent: RecentScanRow[] = []
  let projects: ProjectOption[] = []
  let owaspCells: OwaspCell[] = []
  let mttr = {} as MttrStats // Component hata vermesin diye boş state
  let riskTrend: RiskTrendPoint[] = []
  let userPlan = "starter"
  let onboardingStatus: OnboardingStatus | null = null

  try {
    const [dashData, onboarded] = await Promise.all([
      Promise.all([
        getDashboardStats(userId),
        getRecentScans(userId, 5),
        getUserProjects(userId),
        getOwaspCoverage(userId),
        getMttrStats(userId),
        getRiskTrend(userId, 20),
        getUserPlan(userId),
      ]),
      hasCompletedOnboarding(userId),
    ])
    ;[stats, recent, projects, owaspCells, mttr, riskTrend, userPlan] = dashData
    // Show checklist only for users who haven't completed onboarding
    if (!onboarded) {
      onboardingStatus = await getOnboardingStatus(userId)
    }
  } catch { /* Aurora offline in local dev — show empty state */ }

  const planMeta = PLAN_META[userPlan] ?? PLAN_META.starter

  return (
    <div className="p-8 max-w-[1100px] mx-auto">

      {/* Welcome + action row */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <p className="text-[14px] text-[#666666]" style={{ letterSpacing: "-0.28px" }}>
            Welcome back, {firstName}.
          </p>
          <span className={`text-[10px] font-mono uppercase tracking-[0.06em] px-2 py-0.5 rounded-[5px] border
            ${userPlan === "pro" || userPlan === "enterprise"
              ? "text-[#E7000B] border-[#E7000B]/30 bg-[#E7000B]/10"
              : "text-[#888888] border-white/10 bg-white/[0.04]"}`}>
            {userPlan.charAt(0).toUpperCase() + userPlan.slice(1)} plan
          </span>
        </div>
        <QuickScanDropdown projects={projects} />
      </div>

      {/* Onboarding checklist (feature 15) — shown until completed or dismissed */}
      {onboardingStatus && !onboardingStatus.allDone && (
        <OnboardingChecklistWrapper
          status={onboardingStatus}
          dismiss={dismissOnboardingChecklist}
        />
      )}

      {/* Risk gauge hero */}
      <RiskGauge
        score={stats.riskScore}
        openFindings={stats.openVulnerabilities}
        totalScans={stats.scans}
      />

      {/* Risk trend */}
      <RiskTrend points={riskTrend} />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-8">
        {[
          { label: "Repositories", value: stats.projects },
          { label: "Total Scans", value: stats.scans },
          { label: "Open Findings", value: stats.openVulnerabilities },
          { label: "Risk Score", value: stats.riskScore, isRisk: true },
        ].map((s) => (
          <div key={s.label} className="bg-white/[0.02] border border-white/10 rounded-[10px] px-5 py-4">
            <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#444444] mb-2">{s.label}</p>
            <p className="text-[28px] font-semibold" style={{ letterSpacing: "-1.12px" }}>
              {s.isRisk
                ? <RiskBadge score={s.value as number | null} />
                : <span className="text-white">{s.value}</span>
              }
            </p>
          </div>
        ))}
        {/* 30-day trend boxes */}
        <div className="bg-white/[0.02] border border-white/10 rounded-[10px] px-5 py-4">
          <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#444444] mb-2">↓ 30d Closed</p>
          <p className="text-[28px] font-semibold text-[#4ade80]" style={{ letterSpacing: "-1.12px" }}>
            {stats.closedLast30d}
          </p>
        </div>
        <div className="bg-white/[0.02] border border-white/10 rounded-[10px] px-5 py-4">
          <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#444444] mb-2">↑ 30d Opened</p>
          <p className="text-[28px] font-semibold text-[#f87171]" style={{ letterSpacing: "-1.12px" }}>
            {stats.openedLast30d}
          </p>
        </div>
      </div>

      {/* Recent scans */}
      <div className="bg-white/[0.02] border border-white/10 rounded-[12px] mb-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <h2 className="text-[13px] font-mono uppercase tracking-[0.08em] text-[#a1a1aa]">
            Recent Scans
          </h2>
          {recent.length > 0 && (
            <Link href="/dashboard/scans" className="text-[11px] font-mono text-[#555555] hover:text-[#a1a1aa] transition-colors">
              View all →
            </Link>
          )}
        </div>

        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#333333]">
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div>
              <p className="text-[13px] font-medium text-white mb-1" style={{ letterSpacing: "-0.26px" }}>Run your first scan</p>
              <p className="text-[12px] text-[#555555] max-w-[260px]">Connect a repository and scan it — results appear here in under 60 seconds.</p>
            </div>
            <Link href="/dashboard/scans"
              className="h-8 px-4 rounded-[7px] border border-white/10 text-[12px] font-mono text-[#a1a1aa] hover:bg-white/5 hover:text-white transition-colors">
              Start scanning →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {recent.map((scan) => {
              const statusColor: Record<string, string> = {
                completed: "bg-[#4ade80]", running: "bg-[#60a5fa]",
                failed: "bg-[#f87171]", queued: "bg-[#a1a1aa]", pending: "bg-[#666666]",
              }
              const dot = statusColor[scan.status] ?? "bg-[#666666]"
              const diff = Date.now() - new Date(scan.createdAt).getTime()
              const mins = Math.round(diff / 60000)
              const age = mins < 1 ? "just now" : mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`
              return (
                <li key={scan.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-mono text-white truncate" style={{ letterSpacing: "-0.14px" }}>
                      {scan.repoFullName}
                    </p>
                    <p className="text-[11px] text-[#555555] mt-0.5">
                      {scan.tools.slice(0, 3).join(" · ")}{scan.tools.length > 3 ? ` · +${scan.tools.length - 3}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] text-white tabular-nums">{scan.vulnerabilitiesCount}</p>
                    <p className="text-[10px] font-mono uppercase tracking-[0.06em] text-[#444444]">findings</p>
                  </div>
                  <div className="flex items-center gap-1.5 w-[80px] justify-end">
                    <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                    <span className="text-[12px] text-[#a1a1aa] capitalize">{scan.status}</span>
                  </div>
                  <span className="text-[11px] font-mono text-[#444444] w-[60px] text-right">{age}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* MTTR KPIs */}
      <MttrCard stats={mttr} />

      {/* OWASP Top 10 coverage */}
      <OwaspGrid cells={owaspCells} />

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

        {/* Projects list — 2/3 width */}
        <div className="lg:col-span-2 bg-white/[0.02] border border-white/10 rounded-[12px]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
            <h2 className="text-[13px] font-mono uppercase tracking-[0.08em] text-[#a1a1aa]">
              Projects
            </h2>
            <Link
              href="/dashboard/scans"
              className="text-[11px] font-mono text-[#555555] hover:text-[#a1a1aa] transition-colors"
            >
              + Add project
            </Link>
          </div>

          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center text-[18px]">
                ⬡
              </div>
              <p className="text-[14px] text-white font-medium" style={{ letterSpacing: "-0.28px" }}>
                No projects yet
              </p>
              <p className="text-[12px] text-[#555555]">
                Connect a repository to start scanning for vulnerabilities.
              </p>
              <Link
                href="/dashboard/scans"
                className="mt-1 text-[12px] font-mono text-[#a1a1aa] border border-white/10 rounded-[6px] px-3 py-1.5 hover:bg-white/5 transition-colors"
              >
                Create first project →
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {projects.map((p) => (
                <li key={p.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                  <div className="w-7 h-7 rounded-[6px] bg-white/[0.05] border border-white/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-[11px] font-mono text-[#a1a1aa]">
                      {p.repoFullName.split("/")[0]?.[0]?.toUpperCase() ?? "R"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-mono text-white truncate" style={{ letterSpacing: "-0.14px" }}>
                      {p.repoFullName}
                    </p>
                    {p.targetUrl && (
                      <p className="text-[11px] text-[#444444] truncate mt-0.5">{p.targetUrl}</p>
                    )}
                  </div>
                  <Link
                    href={`/dashboard/scans?repo=${encodeURIComponent(p.repoFullName)}`}
                    className="text-[11px] font-mono text-[#555555] hover:text-[#a1a1aa] transition-colors flex-shrink-0"
                  >
                    Scan →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Usage card — 1/3 width */}
        <div className="bg-white/[0.02] border border-white/10 rounded-[12px]">
          <div className="px-5 py-4 border-b border-white/[0.07]">
            <h2 className="text-[13px] font-mono uppercase tracking-[0.08em] text-[#a1a1aa]">Usage</h2>
          </div>
          <div className="px-5 py-5 flex flex-col gap-5">
            {/* Account info */}
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#444444]">Account</p>
              <p className="text-[13px] text-white" style={{ letterSpacing: "-0.26px" }}>
                {session?.user?.email ?? session?.user?.login ?? "—"}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E7000B]" />
                <span className="text-[11px] font-mono text-[#E7000B]">{planMeta.label}</span>
              </div>
            </div>

            <div className="h-px bg-white/[0.06]" />

            {/* Usage bars */}
            <UsageBar used={stats.scans} total={planMeta.scans} label="Scans / month" />
            <UsageBar used={stats.projects} total={planMeta.projects} label="Projects" />
            <UsageBar used={stats.openVulnerabilities} total={planMeta.findings} label="Active findings" />

            <div className="h-px bg-white/[0.06]" />

            {/* GitHub connect */}
            {!isGitHubUser && (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#444444]">Integrations</p>
                <Link
                  href="/api/connect/github"
                  className="flex items-center gap-2 h-8 px-3 rounded-[6px] border border-white/10 text-[12px] text-[#a1a1aa] hover:bg-white/5 hover:text-white transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  Connect GitHub
                </Link>
              </div>
            )}

            <div className="flex items-center justify-between mt-1">
              <Link
                href="/dashboard/settings"
                className="text-[11px] font-mono text-[#555555] hover:text-white transition-colors"
              >
                Manage plan →
              </Link>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}