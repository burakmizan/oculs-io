import type { Metadata } from "next"

export const metadata: Metadata = { title: "Findings" }

export default function FindingsPage() {
  return (
    <div className="p-8 max-w-[1100px] mx-auto">
      <div className="mb-8 pb-6 border-b border-white/10">
        <p className="text-[11px] font-mono uppercase tracking-[0.08em] text-[#444444] mb-1.5">
          FINDINGS
        </p>
        <h1 className="text-[26px] font-semibold text-white" style={{ letterSpacing: "-1.04px" }}>
          Findings
        </h1>
        <p className="text-[14px] text-[#666666] mt-1" style={{ letterSpacing: "-0.28px" }}>
          All vulnerabilities detected across your repositories.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-24 text-center gap-3 border border-white/10 rounded-[12px] bg-white/[0.01]">
        <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center text-[16px]">
          △
        </div>
        <p className="text-[14px] text-white font-medium" style={{ letterSpacing: "-0.28px" }}>
          No findings yet
        </p>
        <p className="text-[12px] text-[#555555]">
          Run your first scan to see vulnerabilities here.
        </p>
      </div>
    </div>
  )
}