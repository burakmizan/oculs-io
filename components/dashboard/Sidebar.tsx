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

  return (
    <aside className="w-[220px] flex-shrink-0 flex flex-col bg-[#000000] border-r border-white/10 h-full">

      {/* Brand */}
      <div className="h-16 flex items-center px-6 border-b border-white/10 flex-shrink-0 bg-[#050505]">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 hover:opacity-75 transition-opacity"
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
      <div className="p-4 border-t border-white/10 flex-shrink-0 bg-[#050505]">
        <div className="flex items-center gap-3 px-3 py-2.5 mb-2 bg-[#000000] rounded-[8px] border border-white/5">
          {user.image ? (
            <Image
              src={user.image}
              alt={displayName}
              width={32}
              height={32}
              className="rounded-[6px] flex-shrink-0 border border-white/10"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-[6px] bg-white/10 border border-white/10 flex items-center justify-center
                         text-white text-[12px] font-mono font-medium flex-shrink-0"
              aria-hidden="true"
            >
              {initial}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p
              className="text-[13px] font-semibold text-white truncate"
              style={{ letterSpacing: "-0.26px" }}
            >
              {displayName}
            </p>
            {user.email && (
              <p className="text-[11px] text-[#888888] truncate font-mono mt-0.5">
                {user.email}
              </p>
            )}
          </div>
        </div>

        <form action={handleSignOut}>
          <button
            type="submit"
            className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px]
                       text-[13px] font-medium text-[#888888]
                       hover:text-[#ef4444] hover:bg-red-500/10 border border-transparent hover:border-red-500/20
                       transition-all duration-200"
            style={{ letterSpacing: "-0.26px" }}
          >
            <div className="text-[#555555] group-hover:text-[#ef4444] transition-colors duration-200">
              <LogOut size={16} />
            </div>
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}
