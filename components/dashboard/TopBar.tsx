"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutGrid,
  ScanIcon,
  AlertTriangle,
  Cog,
  GitBranch,
} from "@/components/ui/icons"

const NAV_ITEMS = [
  { label: "Overview",  href: "/dashboard",           icon: LayoutGrid    },
  { label: "Projects",  href: "/dashboard/projects",  icon: GitBranch     },
  { label: "Scans",     href: "/dashboard/scans",     icon: ScanIcon      },
  { label: "Findings",  href: "/dashboard/findings",  icon: AlertTriangle },
  { label: "Settings",  href: "/dashboard/settings",  icon: Cog           },
] as const

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":             "Overview",
  "/dashboard/projects":    "Projects",
  "/dashboard/scans":       "Scans",
  "/dashboard/findings":    "Findings",
  "/dashboard/settings":    "Settings",
}

export function TopBar() {
  const pathname = usePathname()
  const title = PAGE_TITLES[pathname] ?? "Dashboard"

  return (
    <header className="h-12 flex-shrink-0 flex items-center justify-between
                       px-6 border-b border-white/10 bg-[#000000]">
      {/* Current page title */}
      <span
        className="text-[13px] font-semibold text-white"
        style={{ letterSpacing: "-0.26px" }}
      >
        {title}
      </span>

      {/* Nav links */}
      <nav className="flex items-center gap-1" aria-label="Top navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-1.5 h-7 px-3 rounded-[6px] text-[12px] transition-colors
                ${isActive
                  ? "bg-white/[0.08] text-white"
                  : "text-[#666666] hover:text-[#a1a1aa] hover:bg-white/[0.04]"
                }`}
              style={{ letterSpacing: "-0.24px" }}
            >
              <Icon size={12} />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}