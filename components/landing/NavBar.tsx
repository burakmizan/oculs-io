"use client";

import { useState } from "react";
import Link from "next/link";
import { OculsMark, Menu, Close, GitHub } from "@/components/ui/icons";

const NAV_LINKS = [
  { label: "Features",    href: "#features"  },
  { label: "How it works",href: "#how-it-works" },
  { label: "Pricing",     href: "#pricing"   },
  { label: "Docs",        href: "/docs"      },
  { label: "Open Source", href: "https://github.com/burakmizan/oculs-io" },
] as const;

export function NavBar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-[#000000] border-b border-white/10">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6">

        {/* ── Sol Kısım: Logo ve Menü Linkleri ── */}
        <div className="flex items-center gap-8">
          {/* ── Logo ── */}
          <Link
            href="/"
            className="flex items-center hover:opacity-75 transition-opacity"
          >
            <img 
              src="/oculs.io.png" 
              alt="Oculs" 
              className="h-20 w-auto" 
            />
          </Link>

          {/* ── Desktop nav links ── */}
          <nav
            className="hidden md:flex items-center gap-1"
            aria-label="Primary navigation"
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[14px] leading-5 text-[#a1a1aa] hover:text-white
                           transition-colors rounded-full px-3 py-1.5 hover:bg-white/5"
                style={{ letterSpacing: "-0.28px" }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* ── Desktop CTAs ── */}
        <div className="hidden md:flex items-center gap-2">
          <Link
            href="/login"
            className="h-8 px-3 flex items-center text-[13px] font-medium text-[#a1a1aa]
                       bg-transparent border border-transparent rounded-[6px]
                       hover:bg-white/5 hover:text-white transition-colors"
            style={{ letterSpacing: "-0.28px" }}
          >
            Log In
          </Link>
          <Link
            href="/signup"
            className="h-8 px-3 flex items-center text-[13px] font-medium text-black
                       bg-white rounded-[6px] hover:bg-[#e5e5e5] transition-colors shadow-card"
            style={{ letterSpacing: "-0.28px" }}
          >
            Sign Up
          </Link>
        </div>

        {/* ── Mobile hamburger ── */}
        <button
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-full
                     text-white hover:bg-white/10 transition-colors"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
        >
          {open ? <Close size={16} /> : <Menu size={16} />}
        </button>
      </div>

      {/* ── Mobile menu drawer ── */}
      {open && (
        <div
          id="mobile-menu"
          className="md:hidden absolute top-full left-0 right-0 bg-[#000000] border-b border-white/10 shadow-xl"
        >
          <nav className="flex flex-col gap-0.5 p-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm text-[#a1a1aa] hover:text-white px-3 py-2.5
                           rounded-[8px] hover:bg-white/5 transition-colors"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-2">
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 text-sm font-medium
                           text-white py-2.5 rounded-[6px] border border-white/10
                           hover:bg-white/5 transition-colors"
                onClick={() => setOpen(false)}
              >
                Log In
              </Link>
              <Link
                href="/signup"
                className="flex items-center justify-center gap-2 text-sm font-medium
                           text-black bg-white py-2.5 rounded-[6px]
                           hover:bg-[#e5e5e5] transition-colors"
                onClick={() => setOpen(false)}
              >
                Sign Up
              </Link>
              <a
                href="https://github.com/YOUR_USERNAME/oculs-ip"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-sm text-[#a1a1aa]
                           py-2 rounded-[6px] hover:text-white transition-colors"
                onClick={() => setOpen(false)}
              >
                <GitHub size={14} />
                View on GitHub
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
