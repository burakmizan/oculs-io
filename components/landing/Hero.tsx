import Link from "next/link";
import { ArrowRight, GitHub } from "@/components/ui/icons";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#000000]">

      {/* ── Logo watermark ── */}
      <div
        className="absolute inset-0 pointer-events-none select-none flex items-start justify-center -top-20"
        aria-hidden="true"
      >
        <img
          src="/oculs.io.png"
          alt=""
          className="w-[950px] h-auto opacity-[0.05] grayscale"
        />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 mx-auto max-w-[1200px] px-4 sm:px-6 pt-8 pb-0 flex flex-col items-center">
        
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 mb-8 z-20">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#3f0f0f] text-[#ef4444] text-[13px] font-medium tracking-wide border border-[#7f1d1d]/50">
            NEW
          </span>
          <span className="text-[14px] sm:text-[15px] text-white font-medium">
            AI auto-fix patches now in beta
          </span>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#f8fafc] text-[#0f172a] text-[13px] font-semibold hover:bg-white transition-colors"
          >
            Get early access <ArrowRight size={14} strokeWidth={2.5} />
          </Link>
        </div>

        <div className="relative w-full border border-white/10 px-6 pt-[80px] pb-[160px] md:pt-[100px] md:pb-[200px] flex flex-col items-center text-center">

          <div className="absolute -top-[17px] -left-[10px] text-white/20 text-[30px] font-mono leading-none">+</div>
          <div className="absolute -top-[17px] -right-[10px] text-white/20 text-[30px] font-mono leading-none">+</div>

          <div className="max-w-[720px] mx-auto flex flex-col items-center">

          {/* Headline */}
          <h1
            className="text-[48px] font-semibold leading-[48px] text-white mb-6 font-sans"
            style={{ letterSpacing: "-2.4px" }}
          >
            Secure your code<br />before it ships.
          </h1>

          {/* Lead body */}
          <p
            className="text-[18px] font-normal leading-7 text-[#a1a1aa] max-w-[560px] mb-10"
          >
            Oculs.io performs AI-powered DAST and SAST scans. It offers real-time prioritization, CWE matching, and automated remediation patches.
          </p>

          {/* CTA row */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 h-12 px-5 text-base font-medium
                         text-black bg-white rounded-full
                         hover:bg-[#e5e5e5] transition-colors shadow-card"
            >
              Start for free
              <ArrowRight size={14} />
            </Link>
            <a
              href="https://github.com/YOUR_USERNAME/oculs-ip"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-12 px-5 text-base font-medium
                         text-white bg-transparent border border-[#333333] rounded-full
                         hover:bg-[#111111] transition-colors shadow-card"
            >
              <GitHub size={14} />
              View on GitHub
            </a>
          </div>
            </div>
          </div>
        </div>
      </section>
    );
}
