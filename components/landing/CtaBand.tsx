import { ArrowRight } from "@/components/ui/icons";

export function CtaBand() {
  return (
    <section className="bg-[#000000] relative overflow-hidden z-10">

      {/* Content Container (Bento Grid'i Kapatan Çerçeve) */}
      <div className="relative z-10 mx-auto max-w-[1200px] px-4 sm:px-6">
        
        {/* Yukarıdan inen çizgilerin SON bulduğu kutu */}
        <div className="relative w-full border-x border-b border-white/10 px-6 py-[96px] flex flex-col items-center overflow-hidden">
          
          {/* Subtle gradient tint (Artık kutunun içinde) */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: `
                  radial-gradient(ellipse at 20% 50%, rgba(0,124,240,0.5) 0%, transparent 50%),
                  radial-gradient(ellipse at 80% 50%, rgba(121,40,202,0.4) 0%, transparent 50%)
                `,
                filter: "blur(80px)",
              }}
            />
          </div>

          {/* Köşe Reticle İkonları (+) - Kutunun en alt köşelerine (Final kapanış) */}
          <div className="absolute -bottom-[6px] -left-[4.5px] text-white/20 text-[10px] font-mono leading-none">+</div>
          <div className="absolute -bottom-[6px] -right-[4.5px] text-white/20 text-[10px] font-mono leading-none">+</div>

          <div className="flex flex-col items-center text-center gap-8 max-w-[640px] mx-auto relative z-10">
            <div className="flex flex-col gap-4">
              <h2
                className="text-[32px] font-semibold leading-[40px] text-white font-sans"
                style={{ letterSpacing: "-1.28px" }}
              >
                Start securing your code today.
              </h2>
              <p className="text-[16px] leading-6 text-[#a1a1a1]">
                Free for up to 3 repositories. No credit card required.
                Open source under the MIT license.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <a
                href="/signup"
                className="inline-flex items-center gap-2 h-12 px-5 text-base font-medium
                           text-[#171717] bg-white rounded-full
                           hover:bg-[#f5f5f5] transition-colors"
              >
                Get started for free
                <ArrowRight size={14} />
              </a>
              <a
                href="https://github.com/YOUR_USERNAME/oculs-ip"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 h-12 px-5 text-base font-medium
                           text-white/70 hover:text-white transition-colors"
              >
                View source on GitHub
              </a>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap items-center justify-center gap-8 pt-4 border-t border-white/10 w-full">
              {STATS.map((stat) => (
                <div key={stat.label} className="flex flex-col items-center gap-0.5">
                  <span
                    className="text-[24px] font-semibold text-white font-sans"
                    style={{ letterSpacing: "-0.96px" }}
                  >
                    {stat.value}
                  </span>
                  <span className="text-[12px] font-mono text-[#888888]">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const STATS = [
  { value: "< 60s",  label: "scan-to-result" },
  { value: "3+",     label: "scan engines"   },
  { value: "MIT",    label: "open source"    },
  { value: "∞",      label: "CWE coverage"   },
] as const;
