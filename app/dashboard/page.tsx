import type { Metadata } from "next"
import { auth } from "@/auth"
import {
  getDashboardStats,
  getRecentScans,
  getUserProjects,
  type RecentScanRow,
  type ProjectOption,
} from "@/lib/db/queries"
import type { DashboardStats } from "@/types"
import { ScanLauncher } from "@/components/dashboard/ScanLauncher"
import { RecentScans } from "@/components/dashboard/RecentScans"

export const metadata: Metadata = {
  title: "Overview",
}

const EMPTY_STATS: DashboardStats = {
  projects: 0,
  scans: 0,
  openVulnerabilities: 0,
  riskScore: null,
}

export default async function DashboardPage() {
  const session = await auth()
  const userId = session!.user.id
  const firstName =
    session?.user?.name?.split(" ")[0] ?? session?.user?.login ?? "there"

  // The dashboard reads Aurora directly. If the DB isn't provisioned yet
  // (e.g. local dev before DATABASE_URL is set), degrade gracefully to an
  // empty state instead of crashing the render.
  let stats: DashboardStats = EMPTY_STATS
  let recent: RecentScanRow[] = []
  let projects: ProjectOption[] = []
  let dbOffline = false

  try {
    ;[stats, recent, projects] = await Promise.all([
      getDashboardStats(userId),
      getRecentScans(userId),
      getUserProjects(userId),
    ])
  } catch {
    dbOffline = true
  }

  const statCards = [
    { label: "Repositories", value: String(stats.projects) },
    { label: "Total Scans", value: String(stats.scans) },
    { label: "Open Findings", value: String(stats.openVulnerabilities) },
    {
      label: "Risk Score",
      value: stats.riskScore === null ? "—" : String(stats.riskScore),
    },
  ]

  return (
    <div className="p-8 max-w-[1100px] mx-auto">
      {/* Page header */}
      <div className="mb-8 pb-6 border-b border-white/10">
        <p className="text-[11px] font-mono uppercase tracking-[0.08em] text-[#444444] mb-1.5">
          DASHBOARD
        </p>
        <h1
          className="text-[26px] font-semibold text-white"
          style={{ letterSpacing: "-1.04px" }}
        >
          Overview
        </h1>
        <p
          className="text-[14px] text-[#666666] mt-1"
          style={{ letterSpacing: "-0.28px" }}
        >
          Welcome back, {firstName}.
        </p>
      </div>

      {dbOffline && (
        <div className="mb-6 px-4 py-3 rounded-[10px] border border-[#f5a623]/20 bg-[#f5a623]/[0.04]">
          <p className="text-[12px] text-[#f5a623]">
            Database unreachable — showing empty state. Set{" "}
            <code className="font-mono">DATABASE_URL</code> to connect Aurora.
          </p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="bg-white/[0.02] border border-white/10 rounded-[10px] px-5 py-4"
          >
            <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#444444] mb-2">
              {stat.label}
            </p>
            <p
              className="text-[28px] font-semibold text-white"
              style={{ letterSpacing: "-1.12px" }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Scan launcher */}
      <div className="mb-8">
        <ScanLauncher projects={projects} />
      </div>

      {/* Recent scans */}
      <RecentScans scans={recent} />
    </div>
  )
}
