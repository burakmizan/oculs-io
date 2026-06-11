"use client"
import { useState, useSyncExternalStore } from "react"
import { X, CheckCircle, Zap } from "lucide-react"

const SEEN_KEY = "oculs:welcome-pro-seen"

const subscribe = () => () => {}

function readSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) !== null
  } catch {
    return true // localStorage unavailable — never block the dashboard
  }
}

// Server snapshot: treat as seen so nothing renders during SSR/hydration.
const readSeenServer = () => true

/**
 * One-time launch-promo announcement: every account is on the Pro plan for
 * free. Shows once per browser (localStorage flag) — no DB involved.
 */
export function WelcomeProModal() {
  const seen = useSyncExternalStore(subscribe, readSeen, readSeenServer)
  const [dismissed, setDismissed] = useState(false)

  const dismiss = () => {
    try { localStorage.setItem(SEEN_KEY, "1") } catch { /* best effort */ }
    setDismissed(true)
  }

  if (seen || dismissed) return null

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/95 backdrop-blur-sm">
      <div className="w-full max-w-[440px] bg-black border border-white/10 rounded-[24px] overflow-hidden shadow-[0_0_100px_rgba(255,255,255,0.3)] p-8 relative animate-in fade-in zoom-in-95 duration-200">
        <button onClick={dismiss} className="absolute top-4 right-4 text-white/50 hover:text-white z-10 transition-colors">
          <X size={20}/>
        </button>

        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-6 border border-white/30">
          <Zap className="text-white" size={24} fill="currentColor" />
        </div>
        <h3 className="text-2xl font-semibold text-white mb-2">You&apos;re on the Pro plan</h3>
        <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
          Pro is free for everyone during our launch. The full scanning toolkit is unlocked on your account — on us.
        </p>

        <ul className="space-y-3 mb-8">
          <li className="flex items-center gap-3 text-sm text-zinc-300"><CheckCircle size={16} className="text-white"/> Unlimited repositories</li>
          <li className="flex items-center gap-3 text-sm text-zinc-300"><CheckCircle size={16} className="text-white"/> 50 scans per month</li>
          <li className="flex items-center gap-3 text-sm text-zinc-300"><CheckCircle size={16} className="text-white"/> SAST + DAST + Secret scanning</li>
          <li className="flex items-center gap-3 text-sm text-zinc-300"><CheckCircle size={16} className="text-white"/> AI auto-fix patch generation</li>
        </ul>

        <button onClick={dismiss} className="w-full h-11 bg-white hover:bg-zinc-200 text-black text-sm font-semibold rounded-[8px] transition-colors shadow-[0_0_30px_rgba(255,255,255,0.4)]">
          Start scanning
        </button>
      </div>
    </div>
  )
}
