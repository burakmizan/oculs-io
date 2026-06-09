import Link from "next/link"
import Image from "next/image"
import { signOut } from "@/auth"
import {
  LayoutGrid,
  ScanIcon,
  AlertTriangle,
  Settings,
  LogOut,
  GitBranch,
  Search,
  MoreHorizontal,
  Bell,
  Smile,
  Monitor,
  Sun,
  Moon,
  Home,
  PenLine,
  HelpCircle,
  BookOpen
} from "lucide-react"

interface SidebarUser {
  name?: string | null
  email?: string | null
  image?: string | null
  login?: string
}

const NAV_ITEMS = [
  { label: "Overview",  href: "/dashboard",           icon: LayoutGrid    },
  { label: "Projects",  href: "/dashboard/projects",  icon: GitBranch     },
  { label: "Scans",     href: "/dashboard/scans",     icon: ScanIcon      },
  { label: "Findings",  href: "/dashboard/findings",  icon: AlertTriangle },
  { label: "Settings",  href: "/dashboard/settings",  icon: Settings      },
] as const

export function Sidebar({ user }: { user: SidebarUser }) {
  async function handleSignOut() {
    "use server"
    await signOut({ redirectTo: "/" })
  }

  const displayName = user.login ?? user.name ?? "User"
  const initial = displayName[0]?.toUpperCase() ?? "U"
  const hasNotifications = false // Dinamik bildirim durumu (true yaparsan kırmızı nokta yanar)

  return (
    <aside className="w-[220px] flex-shrink-0 flex flex-col bg-[#000000] border-r border-white/10 h-full">

      {/* Brand */}
      <div className="h-16 flex items-center px-4 border-b border-white/10 flex-shrink-0 bg-[#000000]">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 hover:opacity-75 transition-opacity px-2"
          aria-label="Dashboard home"
        >
          <img 
            src="/oculs.io.png" 
            alt="Oculs Logo" 
            className="h-15 w-auto"
            style={{ filter: "brightness(0) invert(1)" }} 
          />
          {/* Pixel Art / Terminal Font */}
          <span className="text-white font-mono text-[14px] font-bold tracking-tight mt-0.5 select-none">
            oculs.io
          </span>
        </Link>
      </div>

      {/* Search Box */}
      <div className="px-3 pt-4 pb-2 border-b border-white/5">
        <div className="flex items-center gap-2 h-8 px-2.5 rounded-[6px] bg-[#111111] border border-white/10 text-[#888888] focus-within:border-white/20 focus-within:text-white transition-colors">
          <Search size={14} />
          <input 
            type="text" 
            placeholder="Find..." 
            className="flex-1 bg-transparent border-none outline-none text-[13px] placeholder:text-[#666666] text-white"
          />
          <div className="flex items-center justify-center w-5 h-5 rounded-[4px] bg-white/[0.05] border border-white/10 text-[10px] font-mono text-[#888888]">
            F
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 p-4 flex flex-col gap-1.5 overflow-y-auto"
        aria-label="Dashboard navigation"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.label}
              href={item.href}
              className="group flex items-center gap-3 px-3 py-2.5 rounded-[8px]
                         text-[14px] font-medium text-[#888888]
                         hover:text-white hover:bg-white/[0.04] border border-transparent hover:border-white/5
                         transition-all duration-200"
              style={{ letterSpacing: "-0.3px" }}
            >
              <div className="text-[#555555] group-hover:text-white transition-colors duration-200">
                <Icon size={18} />
              </div>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="relative p-3 border-t border-white/10 flex-shrink-0 bg-[#000000]">
        
        {/* Profile Row with Pop-up Menu */}
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/[0.04] transition-colors text-white relative">
          
          <div 
            className="w-6 h-6 rounded-full flex-shrink-0" 
            style={{ background: "repeating-linear-gradient(45deg, #ff0000, #b40000 2px, #a80202 2px, #ff0e0e 4px)" }}
          ></div>
          
          <div className="flex-1 truncate text-[14px] font-medium">
            {displayName}
          </div>
          
          <details className="relative group">
            <summary className="w-7 h-7 flex items-center justify-center rounded-md text-[#888888] hover:text-white hover:bg-white/10 transition-colors list-none cursor-pointer [&::-webkit-details-marker]:hidden">
              <MoreHorizontal size={16} />
            </summary>
            
            {/* Pop-up Menu */}
            <div className="absolute bottom-[120%] left-1/2 -translate-x-1/2 w-[240px] rounded-lg border border-white/10 bg-[#0a0a0a] shadow-2xl z-50 py-1 overflow-hidden cursor-default">
              <div className="px-3 py-2.5 border-b border-white/10 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-white truncate">{displayName}</p>
                  <p className="text-[12px] text-[#888888] truncate">{user.email || "burakmizankilic@gmail.com"}</p>
                </div>
                <Settings size={14} className="text-[#888888] hover:text-white cursor-pointer flex-shrink-0" />
              </div>
              
              <div className="p-1 border-b border-white/10">
                <button className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[13px] text-[#a1a1aa] hover:bg-white/[0.08] hover:text-white transition-colors">
                  <span>Feedback</span>
                  <Smile size={14} />
                </button>
                <div className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[13px] text-[#a1a1aa] hover:bg-white/[0.08] hover:text-white transition-colors">
                  <span>Theme</span>
                  <div className="flex items-center bg-[#111111] rounded-full border border-white/10 p-0.5">
                    <div className="p-1 bg-white/10 rounded-full text-white"><Monitor size={12} /></div>
                    <div className="p-1 text-[#666666] hover:text-white"><Sun size={12} /></div>
                    <div className="p-1 text-[#666666] hover:text-white"><Moon size={12} /></div>
                  </div>
                </div>
                <Link href="/" className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[13px] text-[#a1a1aa] hover:bg-white/[0.08] hover:text-white transition-colors">
                  <span>Home Page</span>
                  <Home size={14} />
                </Link>
                <button className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[13px] text-[#a1a1aa] hover:bg-white/[0.08] hover:text-white transition-colors">
                  <span>Changelog</span>
                  <PenLine size={14} />
                </button>
                <button className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[13px] text-[#a1a1aa] hover:bg-white/[0.08] hover:text-white transition-colors">
                  <span>Help</span>
                  <HelpCircle size={14} />
                </button>
                <button className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[13px] text-[#a1a1aa] hover:bg-white/[0.08] hover:text-white transition-colors">
                  <span>Docs</span>
                  <BookOpen size={14} />
                </button>
                <form action={handleSignOut} className="w-full">
                  <button type="submit" className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[13px] text-[#a1a1aa] hover:bg-white/[0.08] hover:text-white transition-colors">
                    <span>Log Out</span>
                    <LogOut size={14} />
                  </button>
                </form>
              </div>

              <div className="p-1.5 border-b border-white/10">
                <button className="w-full py-1.5 rounded-md bg-white text-black text-[13px] font-medium hover:bg-white/90 transition-colors">
                  Upgrade to Pro
                </button>
              </div>

              <div className="px-3 py-2 flex items-center justify-between">
                <div>
                  <p className="text-[12px] text-[#888888]">Platform Status</p>
                  <p className="text-[12px] text-[#ff0000]">All systems normal.</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-[#ff0000]"></div>
              </div>
            </div>
          </details>

          <button className="relative w-7 h-7 flex items-center justify-center rounded-md text-[#888888] hover:text-white hover:bg-white/10 transition-colors">
            <Bell size={16} />
            {hasNotifications && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-black"></span>
            )}
          </button>
        </div>

      </div>
    </aside>
  )
}
