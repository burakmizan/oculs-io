"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createTeam, inviteMembers, switchTeam, getUserTeams } from "@/app/dashboard/actions"
import {
  LayoutGrid,
  ScanIcon,
  AlertTriangle,
  Settings,
  LogOut,
  GitBranch,
  Search,
  Bell,
  Smile,
  Monitor,
  Sun,
  Moon,
  Home,
  HelpCircle,
  BookOpen,
  X,
  Meh,
  Frown,
  CheckCircle,
  AlertCircle,
  Info,
  ChevronDown,
  Plus,
  User,
} from "lucide-react"

interface SidebarUser {
  id?: string
  name?: string | null
  email?: string | null
  image?: string | null
  login?: string
}

const NAV_ITEMS: {
  label: string;
  href: string;
  icon: React.ElementType;
  subItems?: { label: string; href: string }[];
}[] = [
  { label: "Overview",  href: "/dashboard",           icon: LayoutGrid    },
  { label: "Projects",  href: "/dashboard/projects",  icon: GitBranch     },
  { label: "Scans",     href: "/dashboard/scans",     icon: ScanIcon      },
  { label: "Findings",  href: "/dashboard/findings",  icon: AlertTriangle },
  { label: "Settings",  href: "/dashboard/settings",  icon: Settings,
    subItems: [
      { label: "Personal Settings", href: "/dashboard/settings?tab=personal" },
      { label: "Team Settings", href: "/dashboard/settings?tab=team" }
    ]
  },
]

type Theme = "system" | "light" | "dark"
type FeedbackRating = "happy" | "neutral" | "sad" | null

interface Notification {
  id: string
  type: "success" | "warning" | "error" | "info"
  title: string
  body: string
  href: string
  time: Date | null
  read: boolean
}

export function Sidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname()
  const router = useRouter()

  const getTeamColor = (name: string) => {
    if (!name || name === "Personal Projects") return "bg-red-600";
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const colors = ["bg-blue-600", "bg-emerald-600", "bg-violet-600", "bg-amber-600", "bg-pink-600", "bg-cyan-600"];
    return colors[Math.abs(hash) % colors.length];
  };

  // ── Theme ────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<Theme>("dark")

  // ── Team Dropdown & Management ─────────────────────────────────────────────
  const [teamPopoverOpen, setTeamPopoverOpen] = useState(false)
  const [teamModalOpen, setTeamModalOpen] = useState(false)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [teamName, setTeamName] = useState("")
  const [inviteEmails, setInviteEmails] = useState<string[]>([""])
  const [activeTeam, setActiveTeam] = useState({ id: "personal", name: "Personal Projects" })
  const [myTeams, setMyTeams] = useState<{id: string, name: string}[]>([])

  // Kullanıcının sahip olduğu/dahil olduğu takımları sayfa yüklenince UI'a basar
  useEffect(() => {
    if (!user.id) return;
    getUserTeams(user.id).then(res => {
      if (res.ok) {
        setMyTeams(res.teams);
        if (res.activeTeamId && res.activeTeamId !== "personal") {
          const active = res.teams.find((t: any) => t.id === res.activeTeamId);
          if (active) setActiveTeam({ id: active.id, name: active.name });
        }
      }
    });
  }, [user.id]);

  function toggleTeamPopover() {
    setTeamPopoverOpen(o => !o)
  }

  async function handleCreateTeam() {
    if (!teamName.trim() || !user.id) return
    const res = await createTeam(teamName, user.id)
    if (res.ok) {
      setTeamModalOpen(false)
      setTeamName("")
      window.location.reload()
    }
  }

  async function handleSendInvites() {
    const res = await inviteMembers(activeTeam.id, inviteEmails)
    if (res.ok) {
      setInviteModalOpen(false)
      setInviteEmails([""])
      alert("Invitations generated successfully! (Check server logs for links)")
    }
  }

  useEffect(() => {
    const saved = (localStorage.getItem("oculs_theme") as Theme) ?? "dark"
    setTheme(saved)
    applyTheme(saved)
  }, [])

  function applyTheme(t: Theme) {
    const root = document.documentElement
    if (t === "dark") {
      root.classList.add("dark")
      root.style.colorScheme = "dark"
    } else if (t === "light") {
      root.classList.remove("dark")
      root.style.colorScheme = "light"
    } else {
      // System
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      prefersDark ? root.classList.add("dark") : root.classList.remove("dark")
      root.style.colorScheme = "normal"
    }
  }

  function handleTheme(t: Theme) {
    setTheme(t)
    localStorage.setItem("oculs_theme", t)
    applyTheme(t)
  }

  // ── Notifications ────────────────────────────────────────────────────────
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notifsLoading, setNotifsLoading] = useState(false)
  const hasUnread = notifications.some(n => !n.read)

  function loadNotifications() {
    setNotifsLoading(true)
    fetch("/api/notifications")
      .then(r => r.json())
      .then(d => setNotifications(d.notifications ?? []))
      .catch(() => {})
      .finally(() => setNotifsLoading(false))
  }

  function toggleNotifications() {
    if (!notifOpen) loadNotifications()
    setNotifOpen(o => !o)
    // Mark all as read
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  // ── Feedback ─────────────────────────────────────────────────────────────
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackTopic, setFeedbackTopic] = useState("general")
  const [feedbackMessage, setFeedbackMessage] = useState("")
  const [feedbackRating, setFeedbackRating] = useState<FeedbackRating>(null)
  const [feedbackSending, setFeedbackSending] = useState(false)
  const [feedbackDone, setFeedbackDone] = useState(false)

  async function submitFeedback() {
    if (!feedbackMessage.trim()) return
    setFeedbackSending(true)
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: feedbackTopic,
          message: feedbackMessage,
          rating: feedbackRating ?? "neutral",
        }),
      })
      setFeedbackDone(true)
      setTimeout(() => {
        setFeedbackOpen(false)
        setFeedbackDone(false)
        setFeedbackMessage("")
        setFeedbackRating(null)
      }, 1500)
    } catch { /* non-fatal */ }
    finally { setFeedbackSending(false) }
  }

  // ── Help ─────────────────────────────────────────────────────────────────
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpCategory, setHelpCategory] = useState("general")
  const [helpSubject, setHelpSubject] = useState("")
  const [helpDescription, setHelpDescription] = useState("")
  const [helpSending, setHelpSending] = useState(false)
  const [helpDone, setHelpDone] = useState(false)

  async function submitHelp() {
    if (!helpSubject.trim() || !helpDescription.trim()) return
    setHelpSending(true)
    try {
      await fetch("/api/help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: helpCategory,
          subject: helpSubject,
          description: helpDescription,
        }),
      })
      setHelpDone(true)
      setTimeout(() => {
        setHelpOpen(false)
        setHelpDone(false)
        setHelpSubject("")
        setHelpDescription("")
      }, 1500)
    } catch { /* non-fatal */ }
    finally { setHelpSending(false) }
  }

  // ── Sign out ──────────────────────────────────────────────────────────────
  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" })
    router.push("/")
    router.refresh()
  }

  const displayName = user.login ?? user.name ?? "User"
  const initial = displayName[0]?.toUpperCase() ?? "U"

  const formatTime = (d: Date | null) => {
    if (!d) return ""
    const diff = Date.now() - new Date(d).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    return `${Math.floor(mins / 60)}h ago`
  }

  return (
    <>
      <aside className="w-[220px] flex-shrink-0 flex flex-col bg-[#000000] border-r border-white/10 h-full">

      {/* Brand/Team Dropdown */}
          <div className="h-12 flex items-center border-b border-white/10 flex-shrink-0 relative">
            <button type="button" onClick={toggleTeamPopover}
              className="w-full flex items-center gap-2 px-4 h-full hover:bg-white/[0.04] transition-colors text-left">
              <div className={`w-6 h-6 rounded-full ${getTeamColor(activeTeam.name)} border border-white/10 flex-shrink-0`}
                   style={{ backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '4px 4px' }} />
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="text-white text-[14px] font-semibold truncate">
                  {activeTeam.name}
                </span>
                <span className="px-1.5 py-0.5 rounded-[4px] bg-white/[0.08] text-[10px] text-[#888888] uppercase tracking-wider font-mono">
                  {activeTeam.id === "personal" ? "Hobby" : "Free"}
                </span>
              </div>
              <ChevronDown size={14} className="text-[#666666] flex-shrink-0 ml-auto" />
            </button>
          </div>

        {/* Search */}
      <div className="px-3 pt-3 pb-2 border-b border-white/[0.05]">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("oculs:open-command"))}
          className="w-full flex items-center gap-3 h-10 px-3 rounded-[8px] bg-white/[0.03]
                        border border-white/10 text-[#888888] hover:border-white/20 hover:bg-white/[0.05] transition-colors text-left"
        >
          <Search size={16} />
          <span className="flex-1 text-[14px] text-[#555555]">Find...</span>
          <span className="text-[11px] font-mono text-[#555555] border border-white/10 rounded-[4px] px-1.5 py-0.5 bg-white/[0.02]">⌘K</span>
        </button>
      </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 flex flex-col gap-0.5 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            const isActive = item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href.split('?')[0])

            if (item.subItems) {
              return (
                <div key={item.label} className="flex flex-col">
                  <Link href={item.subItems[0].href}
                    className={`flex items-center justify-between h-10 px-3 rounded-[8px] text-[15px] transition-colors w-full
                      ${isActive ? "bg-white/[0.04] text-white" : "text-[#666666] hover:text-white hover:bg-white/[0.04]"}`}
                    style={{ letterSpacing: "-0.26px" }}>
                    <div className="flex items-center gap-3">
                      <Icon size={18} />
                      {item.label}
                    </div>
                    <ChevronDown size={14} className={`transition-transform duration-200 ${isActive ? "rotate-180" : "-rotate-90"}`} />
                  </Link>
                  {isActive && (
                    <div className="flex flex-col gap-0.5 mt-1 pl-9">
                      {item.subItems.map(sub => (
                        <Link key={sub.label} href={sub.href}
                          className="flex items-center h-8 px-3 rounded-[8px] text-[13px] text-[#888888] hover:text-white hover:bg-white/[0.04] transition-colors"
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <Link key={item.label} href={item.href}
                className={`flex items-center gap-3 h-10 px-3 rounded-[8px] text-[15px] transition-colors
                  ${isActive
                    ? "bg-white/[0.04] text-white"
                    : "text-[#666666] hover:text-white hover:bg-white/[0.04]"
                  }`}
                style={{ letterSpacing: "-0.26px" }}>
                <Icon size={18} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom section */}
        <div className="px-3 pb-3 flex flex-col gap-1 border-t border-white/[0.07] pt-3">

          {/* Theme switcher */}
          <div className="flex items-center justify-between px-2.5 h-8">
            <span className="text-[12px] text-[#555555]">Theme</span>
            <div className="flex items-center gap-0.5 bg-white/[0.04] border border-white/10 rounded-full p-0.5">
              {(["system", "light", "dark"] as Theme[]).map(t => {
                const Icon = t === "system" ? Monitor : t === "light" ? Sun : Moon
                return (
                  <button key={t} type="button" onClick={() => handleTheme(t)}
                    title={t.charAt(0).toUpperCase() + t.slice(1)}
                    className={`p-1 rounded-full transition-colors ${
                      theme === t ? "bg-white/15 text-white" : "text-[#555555] hover:text-[#a1a1aa]"
                    }`}>
                    <Icon size={12} />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Feedback */}
          <button type="button" onClick={() => setFeedbackOpen(true)}
            className="flex items-center gap-2.5 h-8 px-2.5 rounded-[6px] text-[13px]
                       text-[#666666] hover:text-white hover:bg-white/[0.04] transition-colors w-full text-left">
            <Smile size={14} />
            Feedback
          </button>

          {/* Help */}
          <button type="button" onClick={() => setHelpOpen(true)}
            className="flex items-center gap-2.5 h-8 px-2.5 rounded-[6px] text-[13px]
                       text-[#666666] hover:text-white hover:bg-white/[0.04] transition-colors w-full text-left">
            <HelpCircle size={14} />
            Help
          </button>

          {/* Docs */}
          <a href="https://docs.oculs.io" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2.5 h-8 px-2.5 rounded-[6px] text-[13px]
                       text-[#666666] hover:text-white hover:bg-white/[0.04] transition-colors">
            <BookOpen size={14} />
            Docs
          </a>

          <div className="h-px bg-white/[0.07] my-1" />

          {/* User row */}
          <div className="flex items-center gap-3 px-2.5 py-1.5">
            <div className="w-8 h-8 rounded-full bg-red-600 border border-white/10
                            flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm"
                 style={{ backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '4px 4px' }}>
              {user.image && (
                <img src={user.image} alt={displayName} className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-white truncate" style={{ letterSpacing: "-0.24px" }}>{displayName}</p>
              <p className="text-[10px] text-[#444444] truncate">{user.email ?? ""}</p>
            </div>

            {/* Notification bell */}
            <button type="button" onClick={toggleNotifications}
              className="relative w-6 h-6 flex items-center justify-center rounded-[4px]
                         text-[#666666] hover:text-white hover:bg-white/10 transition-colors flex-shrink-0">
              <Bell size={13} />
              {hasUnread && (
                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-[#f87171] rounded-full border border-black" />
              )}
            </button>

            {/* Sign out */}
            <button type="button" onClick={handleSignOut}
              className="w-6 h-6 flex items-center justify-center rounded-[4px]
                         text-[#666666] hover:text-[#f87171] hover:bg-white/10 transition-colors flex-shrink-0">
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Notifications Panel ───────────────────────────────────────────── */}
      {notifOpen && (
        <div className="fixed left-[220px] bottom-0 z-[9998] w-[300px] mb-3 ml-2">
          <div className="bg-[#0a0a0a] border border-white/15 rounded-[12px] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
              <p className="text-[13px] font-semibold text-white" style={{ letterSpacing: "-0.26px" }}>
                Notifications
              </p>
              <button type="button" onClick={() => setNotifOpen(false)}
                className="text-[#555555] hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>

            <div className="max-h-[320px] overflow-y-auto">
              {notifsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <span className="text-[12px] font-mono text-[#444444]">Loading…</span>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <Bell size={20} className="text-[#333333]" />
                  <p className="text-[12px] text-[#444444]">No notifications yet</p>
                </div>
              ) : notifications.map(n => {
                const Icon = n.type === "success" ? CheckCircle
                  : n.type === "error" ? AlertCircle
                  : n.type === "warning" ? AlertCircle
                  : Info
                const iconColor = n.type === "success" ? "text-[#4ade80]"
                  : n.type === "error" ? "text-[#f87171]"
                  : n.type === "warning" ? "text-[#fbbf24]"
                  : "text-[#60a5fa]"
                return (
                  <Link key={n.id} href={n.href}
                    onClick={() => setNotifOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors border-b border-white/[0.04] last:border-0">
                    <Icon size={14} className={`${iconColor} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-white truncate">{n.title}</p>
                      <p className="text-[11px] text-[#555555] mt-0.5">{n.body}</p>
                    </div>
                    <span className="text-[10px] font-mono text-[#333333] flex-shrink-0 mt-0.5">
                      {formatTime(n.time)}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Feedback Modal ────────────────────────────────────────────────── */}
      {feedbackOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setFeedbackOpen(false)} />
          <div className="relative z-10 w-full max-w-[420px] bg-[#0a0a0a] border border-white/15 rounded-[16px] overflow-hidden shadow-2xl">

            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
              <p className="text-[14px] font-semibold text-white" style={{ letterSpacing: "-0.28px" }}>
                Give Feedback
              </p>
              <button type="button" onClick={() => setFeedbackOpen(false)}
                className="text-[#555555] hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>

            {feedbackDone ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <CheckCircle size={24} className="text-[#4ade80]" />
                <p className="text-[13px] text-white">Thanks for your feedback!</p>
              </div>
            ) : (
              <div className="px-5 py-4 flex flex-col gap-4">
                {/* Topic */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#555555]">Topic</label>
                  <select value={feedbackTopic} onChange={e => setFeedbackTopic(e.target.value)}
                    className="h-9 px-3 rounded-[7px] bg-white/[0.03] border border-white/10
                               text-[13px] text-white focus:border-white/20 focus-visible:outline-none">
                    <option value="bug" className="bg-[#0a0a0a]">Bug Report</option>
                    <option value="feature" className="bg-[#0a0a0a]">Feature Request</option>
                    <option value="general" className="bg-[#0a0a0a]">General Feedback</option>
                    <option value="security" className="bg-[#0a0a0a]">Security Issue</option>
                  </select>
                </div>

                {/* Message */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#555555]">Message</label>
                  <textarea value={feedbackMessage} onChange={e => setFeedbackMessage(e.target.value)}
                    rows={3} placeholder="Tell us what you think…"
                    className="px-3 py-2.5 rounded-[7px] bg-white/[0.03] border border-white/10
                               text-[13px] text-white placeholder:text-[#333333] resize-none
                               focus:border-white/20 focus-visible:outline-none transition-colors" />
                </div>

                {/* Rating */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#555555]">Experience</label>
                  <div className="flex items-center gap-2">
                    {([
                      { key: "happy", Icon: Smile, color: "text-[#4ade80]", bg: "bg-[#4ade80]/10" },
                      { key: "neutral", Icon: Meh, color: "text-[#fbbf24]", bg: "bg-[#fbbf24]/10" },
                      { key: "sad", Icon: Frown, color: "text-[#f87171]", bg: "bg-[#f87171]/10" },
                    ] as const).map(({ key, Icon, color, bg }) => (
                      <button key={key} type="button"
                        onClick={() => setFeedbackRating(key as FeedbackRating)}
                        className={`p-2 rounded-full transition-colors border ${
                          feedbackRating === key
                            ? `${bg} ${color} border-current`
                            : "text-[#555555] border-white/10 hover:text-white"
                        }`}>
                        <Icon size={20} />
                      </button>
                    ))}
                  </div>
                </div>

                <button type="button" onClick={submitFeedback}
                  disabled={feedbackSending || !feedbackMessage.trim()}
                  className="h-9 rounded-[7px] bg-white text-black text-[13px] font-medium
                             hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {feedbackSending ? "Sending…" : "Submit Feedback"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Help Modal ────────────────────────────────────────────────────── */}
      {helpOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setHelpOpen(false)} />
          <div className="relative z-10 w-full max-w-[420px] bg-[#0a0a0a] border border-white/15 rounded-[16px] overflow-hidden shadow-2xl">

            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
              <p className="text-[14px] font-semibold text-white" style={{ letterSpacing: "-0.28px" }}>
                Get Help
              </p>
              <button type="button" onClick={() => setHelpOpen(false)}
                className="text-[#555555] hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>

            {helpDone ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <CheckCircle size={24} className="text-[#F01124]" />
                <p className="text-[13px] text-white">Your request has been sent!</p>
                <p className="text-[12px] text-[#555555]">We'll get back to you shortly.</p>
              </div>
            ) : (
              <div className="px-5 py-4 flex flex-col gap-4">
                {/* Category */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#555555]">Category</label>
                  <select value={helpCategory} onChange={e => setHelpCategory(e.target.value)}
                    className="h-9 px-3 rounded-[7px] bg-white/[0.03] border border-white/10
                               text-[13px] text-white focus:border-white/20 focus-visible:outline-none">
                    <option value="general" className="bg-[#0a0a0a]">General Question</option>
                    <option value="scan" className="bg-[#0a0a0a]">Scan Issues</option>
                    <option value="billing" className="bg-[#0a0a0a]">Billing</option>
                    <option value="integration" className="bg-[#0a0a0a]">Integrations</option>
                    <option value="bug" className="bg-[#0a0a0a]">Report a Bug</option>
                  </select>
                </div>

                {/* Subject */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#555555]">
                    Subject <span className="text-[#f87171]">*</span>
                  </label>
                  <input type="text" value={helpSubject} onChange={e => setHelpSubject(e.target.value)}
                    placeholder="Brief description of your issue"
                    className="h-9 px-3 rounded-[7px] bg-white/[0.03] border border-white/10
                               text-[13px] text-white placeholder:text-[#333333]
                               focus:border-white/20 focus-visible:outline-none transition-colors" />
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#555555]">
                    Description <span className="text-[#f87171]">*</span>
                  </label>
                  <textarea value={helpDescription} onChange={e => setHelpDescription(e.target.value)}
                    rows={4} placeholder="Describe your issue in detail…"
                    className="px-3 py-2.5 rounded-[7px] bg-white/[0.03] border border-white/10
                               text-[13px] text-white placeholder:text-[#333333] resize-none
                               focus:border-white/20 focus-visible:outline-none transition-colors" />
                </div>

                <button type="button" onClick={submitHelp}
                  disabled={helpSending || !helpSubject.trim() || !helpDescription.trim()}
                  className="h-9 rounded-[7px] bg-white text-black text-[13px] font-medium
                             hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {helpSending ? "Sending…" : "Submit Request"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    {/* ── Team Popover ───────────────────────────────────────────────────────────── */}
      {teamPopoverOpen && (
        <>
        <div className="fixed inset-0 z-[9998]" onClick={() => setTeamPopoverOpen(false)} />
        <div className="fixed left-0 top-[64px] z-[9999] w-[320px] ml-1 mt-1">
          <div className="bg-[#0a0a0a] border border-white/15 rounded-[12px] overflow-hidden shadow-2xl p-4 flex flex-col gap-4">
            {/* Search */}
            <div className="flex items-center gap-3 h-10 px-3 rounded-[8px] bg-white/[0.03] border border-white/10 text-[#888888]">
              <Search size={16} />
              <input type="text" placeholder="Find Team..." className="flex-1 bg-transparent border-none outline-none text-[14px] placeholder:text-[#555555] text-white" />
              <span className="text-[10px] font-mono text-[#444444] tracking-tight">Esc</span>
            </div>

            {/* Team List */}
            <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto pr-1">
              <button onClick={async () => { await switchTeam("personal"); window.location.reload(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] hover:bg-white/[0.04] transition-colors text-white text-left">
                <div className="w-6 h-6 rounded-full bg-red-600 border border-white/10"
                     style={{ backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '4px 4px' }} />
                <span className="flex-1 text-[14px] font-medium">Personal Projects</span>
                {activeTeam.id === "personal" && <CheckCircle size={16} className="text-[#4ade80]" />}
              </button>

              {myTeams.map(t => (
                <button key={t.id} onClick={async () => { await switchTeam(t.id); window.location.reload(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] hover:bg-white/[0.04] transition-colors text-white text-left">
                  <div className={`w-6 h-6 rounded-full ${getTeamColor(t.name)} border border-white/10 flex-shrink-0`}
                       style={{ backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '4px 4px' }} />
                  <span className="flex-1 text-[14px] font-medium">{t.name}</span>
                  {activeTeam.id === t.id && <CheckCircle size={16} className="text-[#4ade80]" />}
                </button>
              ))}
            </div>

            <div className="h-px bg-white/[0.07] my-1" />

            {/* Create Team */}
            <button type="button" onClick={() => { setTeamModalOpen(true); setTeamPopoverOpen(false); }} className="flex items-center gap-3 h-10 px-3 rounded-[8px] text-[14px] text-white bg-white/5 hover:bg-white/10 transition-colors w-full text-left">
              <Plus size={16} />
              <div>
                <span className="block font-medium">Create New Team</span>
              </div>
            </button>

            {/* Invite Members */}
            {activeTeam.id !== "personal" && (
              <button type="button" onClick={() => { setInviteModalOpen(true); setTeamPopoverOpen(false); }} className="flex items-center gap-3 h-10 px-3 rounded-[8px] text-[14px] text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 transition-colors w-full text-left">
                <User size={16} />
                <div>
                  <span className="block font-medium">Invite Members</span>
                </div>
              </button>
            )}
          </div>
        </div>
        </>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {teamModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-[400px] bg-[#0a0a0a] border border-white/10 rounded-[16px] p-5 shadow-2xl">
            <h4 className="text-[15px] font-semibold text-white mb-1">Create New Team</h4>
            <p className="text-[12px] text-zinc-400 mb-5">Establish an isolated collaborative space for team infrastructure scans.</p>
            <input 
              type="text" 
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              placeholder="e.g., My Team" 
              className="w-full h-10 px-3 rounded-[8px] bg-white/[0.03] border border-white/10 text-[13px] text-white focus:outline-none focus:border-white/30 mb-5"
            />
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setTeamModalOpen(false)} className="h-9 px-4 rounded-[8px] text-[13px] font-medium text-zinc-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleCreateTeam} className="h-9 px-4 rounded-[8px] bg-white text-black text-[13px] font-semibold hover:bg-white/90 transition-colors">Create Team</button>
            </div>
          </div>
        </div>
      )}

      {inviteModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-[420px] bg-[#0a0a0a] border border-white/10 rounded-[16px] p-5 shadow-2xl flex flex-col max-h-[80vh]">
            <h4 className="text-[15px] font-semibold text-white mb-1">Invite Members to Team</h4>
            <p className="text-[12px] text-zinc-400 mb-5">Input recipient email addresses to dispatch secure single-use access credentials.</p>
            
            <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 mb-5 pr-1">
              {inviteEmails.map((email, idx) => (
                <input 
                  key={idx}
                  type="email"
                  value={email}
                  onChange={e => {
                    const next = [...inviteEmails];
                    next[idx] = e.target.value;
                    setInviteEmails(next);
                  }}
                  placeholder="partner@agency.com"
                  className="w-full h-10 px-3 rounded-[8px] bg-white/[0.03] border border-white/10 text-[13px] text-white focus:outline-none focus:border-white/30 font-mono"
                />
              ))}
              <button 
                onClick={() => setInviteEmails([...inviteEmails, ""])}
                className="text-left text-[12px] text-emerald-400 hover:text-emerald-300 font-medium py-1"
              >
                + Add Another Email
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 flex-shrink-0">
              <button onClick={() => setInviteModalOpen(false)} className="h-9 px-4 rounded-[8px] text-[13px] font-medium text-zinc-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSendInvites} className="h-9 px-4 rounded-[8px] bg-emerald-500 text-black text-[13px] font-semibold hover:bg-emerald-400 transition-colors">Dispatch Invites</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}