"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { MoreHorizontal, Smile, Meh, Frown, X } from "lucide-react"

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":             "Overview",
  "/dashboard/projects":    "Projects",
  "/dashboard/scans":       "Scans",
  "/dashboard/findings":    "Findings",
  "/dashboard/settings":    "Settings",
}

export function TopBar({ plan = "starter" }: { plan?: string }) {
  const pathname = usePathname()
  const isPaid = plan === "pro" || plan === "enterprise"
  const title = PAGE_TITLES[pathname] ?? "Dashboard"

  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false)
  const [feedbackRating, setFeedbackRating] = useState<"happy" | "neutral" | "sad" | null>(null)

  return (
    <>
      <header className="relative h-12 flex-shrink-0 flex items-center justify-between px-6 border-b border-white/10 bg-[#000000]">
        
        {/* Sol Boşluk (Başlığı ortalamak için) */}
        <div className="flex-1"></div>

        {/* Orta: Sayfa Başlığı (Tam Ortalanmış) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <span
            className="text-[13px] font-semibold text-white"
            style={{ letterSpacing: "-0.26px" }}
          >
            {title}
          </span>
        </div>

        {/* Sağ: Pro Butonu ve 3 Nokta Menüsü */}
        <div className="flex-1 flex items-center justify-end gap-3">
          {isPaid ? (
            <span className="h-7 px-3 inline-flex items-center rounded-[6px] text-[11px] font-mono uppercase tracking-[0.06em] text-[#E7000B] border border-[#E7000B]/30 bg-[#E7000B]/10">
              {plan === "enterprise" ? "Enterprise" : "Pro"}
            </span>
          ) : (
            <button className="h-7 px-4 rounded-[6px] text-[12px] font-medium transition-colors bg-white text-black hover:bg-white/90">
              Upgrade to Pro
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="h-7 w-7 flex items-center justify-center rounded-[6px] text-[#666666] hover:text-white hover:bg-white/[0.08] transition-colors"
            >
              <MoreHorizontal size={16} />
            </button>

            {/* Dropdown Menü */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-40 rounded-md border border-white/10 bg-[#0a0a0a] shadow-lg z-50">
                <div className="p-1">
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false)
                      setIsFeedbackModalOpen(true)
                    }}
                    className="w-full text-left px-3 py-2 text-[12px] text-white hover:bg-white/[0.08] rounded-sm transition-colors"
                  >
                    Give Feedback
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Feedback Modal (Form) */}
      {isFeedbackModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl relative">
            <button
              onClick={() => setIsFeedbackModalOpen(false)}
              className="absolute right-4 top-4 text-[#666666] hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
            
            <h2 className="text-lg font-semibold text-white mb-5">Give Feedback</h2>
            
            <div className="space-y-5">
              {/* Konu Seçimi */}
              <div className="space-y-2">
                <label className="text-[13px] text-[#a1a1aa]">Topic</label>
                <select className="w-full h-9 rounded-md border border-white/10 bg-transparent px-3 text-[13px] text-white focus:outline-none focus:border-white/30">
                  <option value="bug" className="bg-[#0a0a0a]">Bug Report</option>
                  <option value="feature" className="bg-[#0a0a0a]">Feature Request</option>
                  <option value="general" className="bg-[#0a0a0a]">General Feedback</option>
                </select>
              </div>

              {/* Geri Bildirim Metni */}
              <div className="space-y-2">
                <label className="text-[13px] text-[#a1a1aa]">Your Feedback</label>
                <textarea
                  rows={4}
                  className="w-full rounded-md border border-white/10 bg-transparent p-3 text-[13px] text-white focus:outline-none focus:border-white/30 resize-none placeholder:text-[#666666]"
                  placeholder="Tell us what you think..."
                />
              </div>

              {/* Yüz İfadeleri Değerlendirmesi */}
              <div className="space-y-2">
                <label className="text-[13px] text-[#a1a1aa]">How was your experience?</label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setFeedbackRating("happy")}
                    className={`p-2 rounded-full transition-all ${feedbackRating === "happy" ? "bg-green-500/20 text-green-500" : "text-[#666666] hover:text-white hover:bg-white/10"}`}
                  >
                    <Smile size={24} />
                  </button>
                  <button
                    onClick={() => setFeedbackRating("neutral")}
                    className={`p-2 rounded-full transition-all ${feedbackRating === "neutral" ? "bg-yellow-500/20 text-yellow-500" : "text-[#666666] hover:text-white hover:bg-white/10"}`}
                  >
                    <Meh size={24} />
                  </button>
                  <button
                    onClick={() => setFeedbackRating("sad")}
                    className={`p-2 rounded-full transition-all ${feedbackRating === "sad" ? "bg-red-500/20 text-red-500" : "text-[#666666] hover:text-white hover:bg-white/10"}`}
                  >
                    <Frown size={24} />
                  </button>
                </div>
              </div>

              {/* Gönder Butonu */}
              <button 
                onClick={() => setIsFeedbackModalOpen(false)}
                className="w-full h-9 mt-2 rounded-md bg-white text-black text-[13px] font-medium hover:bg-white/90 transition-colors"
              >
                Submit Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}