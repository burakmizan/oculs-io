"use client"
import { X, CheckCircle, Zap } from "lucide-react"

interface Props {
  isOpen: boolean
  onClose: () => void
  feature: string
  description: string
}

export function UpgradeModal({ isOpen, onClose, feature, description }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/95 backdrop-blur-sm">
      <div className="w-full max-w-[800px] bg-black border border-white/10 rounded-[24px] overflow-hidden shadow-[0_0_100px_rgba(255,255,255,0.3)] flex flex-col md:flex-row relative animate-in fade-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white z-10 transition-colors">
          <X size={20}/>
        </button>

        {/* Left - Context */}
        <div className="md:w-[45%] p-8 bg-black flex flex-col justify-center">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-6 border border-white/30">
            <Zap className="text-white" size={24} fill="currentColor" />
          </div>
          <h3 className="text-2xl font-semibold text-white mb-2">Upgrade to Pro</h3>
          <p className="text-sm text-white font-medium mb-4">{feature}</p>
          <p className="text-sm text-zinc-400 mb-8 leading-relaxed">{description}</p>
          
          <ul className="space-y-3">
            <li className="flex items-center gap-3 text-sm text-zinc-300"><CheckCircle size={16} className="text-white"/> Unlimited repositories</li>
<li className="flex items-center gap-3 text-sm text-zinc-300"><CheckCircle size={16} className="text-white"/> 50 scans per month</li>
<li className="flex items-center gap-3 text-sm text-zinc-300"><CheckCircle size={16} className="text-white"/> SAST + DAST + Secret scanning</li>
<li className="flex items-center gap-3 text-sm text-zinc-300"><CheckCircle size={16} className="text-white"/> AI auto-fix patch generation</li>
          </ul>
        </div>

        {/* Right - Pricing */}
        <div className="md:w-[55%] p-8 bg-black flex flex-col justify-center">
          <div className="border border-white/50 bg-white/5 rounded-[16px] p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-white text-black text-[10px] font-bold px-3 py-1 rounded-bl-[12px] uppercase tracking-wider">Popular</div>
            <h4 className="text-xl font-semibold text-white">Pro Plan</h4>
            <div className="flex items-baseline gap-1 mt-2 mb-6">
              <span className="text-4xl font-bold text-white">$19</span>
              <span className="text-zinc-500 text-sm">/per month</span>
            </div>
            <button className="w-full h-11 bg-white hover:bg-zinc-200 text-black text-sm font-semibold rounded-[8px] transition-colors mb-3 shadow-[0_0_30px_rgba(255,255,255,0.4)]">
              Start free trial
            </button>
            <p className="text-center text-xs text-zinc-500">For teams that ship continuously.</p>
          </div>

          <div className="mt-4 flex items-center justify-between px-5 py-4 border border-white/5 rounded-[16px] bg-white/[0.02]">
            <div>
              <h5 className="text-sm font-medium text-white">Enterprise</h5>
              <p className="text-xs text-zinc-500 mt-0.5">Custom scan policies & SSO.</p>
            </div>
            <button className="px-4 py-2 rounded-[8px] border border-white/10 text-xs font-medium text-white hover:bg-white/5 transition-colors">
              Talk to sales
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}