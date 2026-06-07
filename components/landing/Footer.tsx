import Link from "next/link";
import { OculsMark } from "@/components/ui/icons";

const COLUMNS = [
  {
    heading: "PRODUCT",
    links: [
      { label: "Features",    href: "#features"    },
      { label: "Pricing",     href: "#pricing"     },
      { label: "Changelog",   href: "/changelog"   },
      { label: "Roadmap",     href: "/roadmap"     },
      { label: "Status",      href: "/status"      },
    ],
  },
  {
    heading: "DEVELOPERS",
    links: [
      { label: "Documentation", href: "/docs"            },
      { label: "API Reference",  href: "/docs/api"       },
      { label: "GitHub",         href: "https://github.com/YOUR_USERNAME/oculs-ip" },
      { label: "Blog",           href: "/blog"           },
      { label: "Quickstart",     href: "/docs/quickstart"},
    ],
  },
  {
    heading: "COMPANY",
    links: [
      { label: "About",    href: "/about"   },
      { label: "Security", href: "/security"},
      { label: "Contact",  href: "/contact" },
    ],
  },
  {
    heading: "LEGAL",
    links: [
      { label: "Privacy Policy",    href: "/privacy" },
      { label: "Terms of Service",  href: "/terms"   },
      { label: "Cookie Policy",     href: "/cookies" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="bg-[#000000] border-t border-white/10 relative z-10">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-16">

        {/* Top row: logo + columns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-10 mb-12">

          {/* Brand column */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1 flex flex-col gap-4">
            <Link
              href="/"
              className="flex items-center gap-2.5 hover:opacity-75 transition-opacity w-fit"
            >
              <img 
                src="/oculs.io.png" 
                alt="Oculs" 
                className="h-18 w-auto opacity-80" 
              />
              <span 
                className="text-white text-[14px] font-mono tracking-widest"
                style={{ 
                  fontFamily: '"Press Start 2P", "Silkscreen", "Courier New", monospace',
                  WebkitFontSmoothing: "none",
                  fontSmooth: "never",
                  textRendering: "pixelated" as any
                }}
              >
                oculs.io
              </span>
            </Link>
            <p
              className="text-[13px] leading-5 text-[#a1a1aa] max-w-[200px]"
              style={{ letterSpacing: "-0.28px" }}
            >
              AI-powered security scanning for developers who ship fast.
            </p>
            <div className="flex items-center gap-1 mt-1">
              <span
                className="inline-flex items-center h-5 px-1.5 text-[10px] font-mono
                           bg-white/5 border border-white/10 text-[#a1a1aa] rounded-[4px]"
              >
                MIT
              </span>
              <span
                className="inline-flex items-center h-5 px-1.5 text-[10px] font-mono
                           bg-white/5 border border-white/10 text-[#a1a1aa] rounded-[4px]"
              >
                Open Source
              </span>
            </div>
          </div>

          {/* Nav columns */}
          {COLUMNS.map((col) => (
            <div key={col.heading} className="flex flex-col gap-3">
              <p
                className="text-[10px] font-mono uppercase tracking-[0.1em] text-[#666666]"
              >
                {col.heading}
              </p>
              <ul className="flex flex-col gap-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-[#a1a1aa] hover:text-white
                                 transition-colors"
                      style={{ letterSpacing: "-0.28px" }}
                      {...(link.href.startsWith("http")
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-8 border-t border-white/10">
          <p className="text-[12px] font-mono text-[#666666]">
            © {new Date().getFullYear()} Oculs.io. Open source under the MIT License.
          </p>
          <p className="text-[12px] font-mono text-[#666666]">
            Built for the{" "}
            <a
              href="https://devpost.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors underline underline-offset-2"
            >
              H0: Hack the Zero Stack
            </a>{" "}
            hackathon · Powered by Vercel + AWS Aurora
          </p>
        </div>
      </div>
    </footer>
  );
}
