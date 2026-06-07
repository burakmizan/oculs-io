export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-[#000000] relative z-10">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        
        {/* Yukarıdan inen ana kılavuz çizgileri (Bento Grid) ve kutu yapısı */}
        <div className="relative w-full border-x border-b border-white/10 px-6 py-[96px] flex flex-col items-center">
          
          {/* Köşe Reticle İkonları (+) - Kutunun en altına */}
          <div className="absolute -bottom-[6px] -left-[4.5px] text-white/20 text-[10px] font-mono leading-none">+</div>
          <div className="absolute -bottom-[6px] -right-[4.5px] text-white/20 text-[10px] font-mono leading-none">+</div>

          {/* Section header */}
          <div className="max-w-[600px] w-full mx-auto text-center mb-16">
            <p
              className="text-[11px] font-mono uppercase tracking-[0.08em] text-[#a1a1aa] mb-4"
            >
              GETTING STARTED
            </p>
            <h2
              className="text-[32px] font-semibold leading-[40px] text-white font-sans"
              style={{ letterSpacing: "-1.28px" }}
            >
              Security in three steps.
            </h2>
            <p className="mt-4 text-[16px] leading-6 text-[#a1a1aa]">
              From zero to scanning in under five minutes. No infrastructure
              to manage, no agents to install.
            </p>
          </div>

        {/* Steps grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative w-full">
            {/* Connector line (desktop) - Dark Theme uyumlu ince hat */}
            <div
              className="hidden md:block absolute top-[14px] left-[calc(16.67%+16px)] right-[calc(16.67%+16px)] h-px bg-white/10"
              aria-hidden="true"
            />

            {STEPS.map((step, i) => (
              <Step key={step.title} step={i + 1} {...step} />
            ))}
          </div>

          {/* Bottom CTA - Dark Theme Kontrast Butonları */}
          <div className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
            <a
              href="/docs/quickstart"
              className="inline-flex items-center gap-2 h-10 px-5 text-sm font-medium
                         text-black bg-white rounded-full hover:bg-[#e5e5e5] transition-colors shadow-card"
            >
              Read the quickstart guide →
            </a>
            <a
              href="/docs"
              className="inline-flex items-center gap-2 h-10 px-5 text-sm font-medium
                         text-[#a1a1aa] bg-transparent border border-white/10 rounded-full hover:bg-white/5 hover:text-white transition-colors"
            >
              Browse documentation
            </a>
          </div>
          
        </div>
      </div>
    </section>
  );
}

interface StepProps {
  step: number;
  title: string;
  body: string;
  code: string;
}

const STEPS: Omit<StepProps, "step">[] = [
  {
    title: "Connect your repository.",
    body: "Add the Oculs GitHub App to your repository and drop a workflow file. One-time setup, under two minutes.",
    code: "gh app install oculs-io",
  },
  {
    title: "Push your code.",
    body: "Every push and pull request automatically triggers the full SAST/DAST scan pipeline via GitHub Actions.",
    code: "git push origin main",
  },
  {
    title: "Review and fix with AI.",
    body: "Open the Oculs dashboard, see triaged findings sorted by severity, and apply the AI-generated patch in one click.",
    code: "oculs apply-patch scn_01Hx",
  },
];

function Step({ step, title, body, code }: StepProps) {
  return (
    <div className="flex flex-col gap-4 relative border-l border-white/10 pl-6 md:border-l-0 md:pl-0">
      {/* Step number */}
      <div className="flex items-center gap-3 mb-2">
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full bg-white/10 text-white
                     flex items-center justify-center font-mono text-[12px]"
        >
          {step}
        </div>
      </div>

      {/* Card */}
      <div className="bg-white/5 rounded-[8px] p-5 border border-white/10 flex flex-col gap-3 h-full">
        <h3
          className="text-[18px] font-semibold leading-7 text-white font-sans"
          style={{ letterSpacing: "-0.6px" }}
        >
          {title}
        </h3>
        <p className="text-[14px] leading-5 text-[#a1a1aa]" style={{ letterSpacing: "-0.28px" }}>
          {body}
        </p>

        <div
          className="flex items-center gap-2 bg-[#000000] border border-white/10 rounded-[6px]
                     px-3 py-2 mt-2"
        >
          <span className="text-[#50e3c2] font-mono text-[11px] select-none">$</span>
          <code className="text-[12px] font-mono text-[#e5e5e5]">{code}</code>
        </div>
      </div>
    </div>
  );
}
