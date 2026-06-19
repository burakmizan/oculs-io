import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { projects } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getProjectScoreData } from "@/lib/db/queries"
import { computeGrade } from "@/lib/grade"

export const metadata: Metadata = { title: "Security Score Card — Oculs.io" }

const SEV_HEX: Record<string, string> = {
  critical: "#f87171", high: "#fb923c", medium: "#fbbf24", low: "#60a5fa", info: "#a1a1aa",
}
const SEV_ORDER = ["critical", "high", "medium", "low", "info"]

interface Props {
  params: Promise<{ projectId: string }>
}

export default async function SecurityScoreCardPage({ params }: Props) {
  const { projectId } = await params

  const [proj] = await db
    .select({ id: projects.id, name: projects.name, repoFullName: projects.repoFullName, badgePublic: projects.badgePublic })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!proj) notFound()
  if (!proj.badgePublic) {
    return (
      <div className="min-h-screen bg-[#000000] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-[13px] font-mono text-[#555555]">This project&apos;s security card is private.</p>
        </div>
      </div>
    )
  }

  const data = await getProjectScoreData(projectId)
  const grade = data ? computeGrade(data.breakdown) : { letter: "?", color: "#888888", score: 0, hasCritical: false }

  const counts = SEV_ORDER.reduce((acc, s) => {
    acc[s] = data?.breakdown.find(b => b.severity === s)?.count ?? 0
    return acc
  }, {} as Record<string, number>)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://oculs-io.vercel.app"
  const badgeUrl = `${appUrl}/api/badge/${projectId}.svg`
  const cardUrl = `${appUrl}/sc/${projectId}`
  const badgeMd = `[![Security Grade](${badgeUrl})](${cardUrl})`

  return (
    <div className="min-h-screen bg-[#000000] text-white">
      <div className="max-w-[480px] mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <span className="text-[13px] font-mono text-[#888888]">oculs.io</span>
          <span className="text-[11px] font-mono text-[#444444]">Security Score Card</span>
        </div>

        {/* Repo name */}
        <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#555555] mb-1">Repository</p>
        <h1 className="text-[22px] font-semibold mb-6" style={{ letterSpacing: "-0.66px" }}>
          {proj.repoFullName}
        </h1>

        {/* Grade hero */}
        <div className="flex items-center gap-6 mb-8 p-6 rounded-[14px] border border-white/10 bg-white/[0.02]">
          <div
            className="w-20 h-20 rounded-[12px] flex items-center justify-center flex-shrink-0 border"
            style={{ borderColor: `${grade.color}40`, backgroundColor: `${grade.color}18` }}
          >
            <span className="text-[40px] font-bold tabular-nums" style={{ color: grade.color, letterSpacing: "-2px" }}>
              {grade.letter}
            </span>
          </div>
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.08em] text-[#555555] mb-1">Security Grade</p>
            <p className="text-[28px] font-semibold tabular-nums" style={{ color: grade.color, letterSpacing: "-1.12px" }}>
              {grade.score}<span className="text-[16px] text-[#555555]">/100</span>
            </p>
            <p className="text-[11px] font-mono text-[#555555] mt-1">
              {data?.lastScan
                ? `Last scan ${data.lastScan.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                : "No scans yet"}
            </p>
          </div>
        </div>

        {/* Severity breakdown */}
        <div className="grid grid-cols-5 gap-2 mb-8">
          {SEV_ORDER.map(s => (
            <div key={s} className="border border-white/10 rounded-[10px] bg-white/[0.02] px-2 py-3 text-center">
              <p className="text-[9px] font-mono uppercase tracking-[0.06em] text-[#444444] mb-1">{s}</p>
              <p className="text-[20px] font-semibold tabular-nums" style={{ color: counts[s] > 0 ? SEV_HEX[s] : "#333333", letterSpacing: "-0.8px" }}>
                {counts[s]}
              </p>
            </div>
          ))}
        </div>

        {/* Grade scale explanation */}
        <div className="mb-8 p-4 rounded-[10px] border border-white/[0.07] bg-white/[0.01]">
          <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#444444] mb-3">How grades are calculated</p>
          <p className="text-[12px] text-[#666666] leading-relaxed">
            Grade is derived from open findings using weighted risk scoring: critical (×40), high (×20), medium (×8), low (×2).
            Any critical finding immediately results in grade F. Score 0 = A+.
          </p>
          <div className="flex gap-2 mt-3 flex-wrap">
            {[["A+/A", "#4ade80", "0–10"], ["B", "#a3e635", "11–25"], ["C", "#fbbf24", "26–45"], ["D", "#fb923c", "46–70"], ["F", "#f87171", "71+"]]
              .map(([l, c, r]) => (
                <span key={l} className="flex items-center gap-1 text-[11px] font-mono">
                  <span className="w-4 h-4 rounded-[3px] inline-flex items-center justify-center text-[9px] font-bold"
                    style={{ background: `${c}20`, color: c, border: `1px solid ${c}40` }}>{l}</span>
                  <span className="text-[#444444]">{r}</span>
                </span>
              ))}
          </div>
        </div>

        {/* Badge snippet */}
        <div className="mb-6 p-4 rounded-[10px] border border-white/[0.07] bg-white/[0.01]">
          <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#444444] mb-2">README badge</p>
          <pre className="text-[11px] font-mono text-[#60a5fa] bg-black/40 border border-white/10 rounded-[6px] p-3 overflow-x-auto whitespace-pre-wrap break-all select-all">
            {badgeMd}
          </pre>
        </div>

        <p className="text-[11px] font-mono text-[#333333] text-center">
          Powered by <a href="https://oculs.io" className="text-[#555555] hover:text-white">Oculs.io</a>
        </p>
      </div>
    </div>
  )
}
