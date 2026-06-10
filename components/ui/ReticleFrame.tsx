import type { ReactNode } from "react"

/**
 * Signature Oculs "reticle" panel: a hairline-bordered surface with
 * monospace "+" registration marks in each corner. Mirrors the motif
 * used across the landing page for a cohesive retro-corporate look.
 */
export function ReticleFrame({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`relative border border-white/10 bg-white/[0.02] ${className}`}>
      <span aria-hidden className="absolute -top-[6px] -left-[4.5px] text-white/20 text-[10px] font-mono leading-none">+</span>
      <span aria-hidden className="absolute -top-[6px] -right-[4.5px] text-white/20 text-[10px] font-mono leading-none">+</span>
      <span aria-hidden className="absolute -bottom-[6px] -left-[4.5px] text-white/20 text-[10px] font-mono leading-none">+</span>
      <span aria-hidden className="absolute -bottom-[6px] -right-[4.5px] text-white/20 text-[10px] font-mono leading-none">+</span>
      {children}
    </div>
  )
}