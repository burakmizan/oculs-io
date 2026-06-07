import Link from "next/link"
import Image from "next/image"
import { signOut } from "@/auth"
import {
  OculsMark,
  LayoutGrid,
  ScanIcon,
  AlertTriangle,
  Cog,
  LogOut,
} from "@/components/ui/icons"

interface SidebarUser {
  name?: string | null
  email?: string | null
  image?: string | null
  login?: string
}

const NAV_ITEMS = [
  { label: "Overview",  href: "/dashboard",          icon: LayoutGrid    },
  { label: "Scans",     href: "/dashboard/scans",    icon: ScanIcon      },
  { label: "Findings",  href: "/dashboard/findings", icon: AlertTriangle },
  { label: "Settings",  href: "/dashboard/settings", icon: Cog           },
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
      <div className="h-16 flex items-center px-5 border-b border-white/10 flex-shrink-0">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 hover:opacity-75 transition-opacity"
          aria-label="Dashboard home"
        >
          <OculsMark size={18} className="text-white" />
          <span
            className="text-[14px] font-semibold text-white"
            style={{ letterSpacing: "-0.36px" }}
          >
            oculs.io
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 p-3 flex flex-col gap-0.5 overflow-y-auto"
        aria-label="Dashboard navigation"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-[6px]
                         text-[13px] text-[#a1a1aa]
                         hover:text-white hover:bg-white/5
                         transition-colors"
              style={{ letterSpacing: "-0.26px" }}
            >
              <Icon size={14} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-0.5">
          {user.image ? (
            <Image
              src={user.image}
              alt={displayName}
              width={24}
              height={24}
              className="rounded-full flex-shrink-0"
            />
          ) : (
            <div
              className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center
                         text-white text-[10px] font-medium flex-shrink-0"
              aria-hidden="true"
            >
              {initial}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p
              className="text-[12px] font-medium text-white truncate"
              style={{ letterSpacing: "-0.24px" }}
            >
              {displayName}
            </p>
            {user.email && (
              <p className="text-[11px] text-[#555555] truncate font-mono">
                {user.email}
              </p>
            )}
          </div>
        </div>

        <form action={handleSignOut}>
          <button
            type="submit"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[6px]
                       text-[13px] text-[#555555]
                       hover:text-[#a1a1aa] hover:bg-white/5
                       transition-colors"
            style={{ letterSpacing: "-0.26px" }}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}
