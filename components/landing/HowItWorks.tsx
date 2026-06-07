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
              WHY DEVELOPERS USE OCULS
            </p>
            <h2
              className="text-[32px] font-semibold leading-[40px] text-white font-sans"
              style={{ letterSpacing: "-1.28px" }}
            >
              Building is easy.<br />Staying secure isn't.
            </h2>
          </div>

          {/* Reasons grid - Seamless technical spec sheet style */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 w-full border-t border-white/10">
            {REASONS.map((reason, index) => (
              <ReasonCard key={reason.title} index={index} {...reason} />
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
            <a
              href="/login"
              className="inline-flex items-center gap-2 h-10 px-5 text-[13px] font-mono
                         text-black bg-white hover:bg-[#e5e5e5] transition-colors"
            >
              Start securing your code →
            </a>
          </div>
          
        </div>
      </div>
    </section>
  );
}

interface ReasonProps {
  title: string;
  body: string;
}

const REASONS: ReasonProps[] = [
  {
    title: "Ship Faster",
    body: "Spend less time manually reviewing code and more time building features.",
  },
  {
    title: "Understand Every Risk",
    body: "Security findings explained in plain English instead of confusing security jargon.",
  },
  {
    title: "Fix Issues Faster",
    body: "Get actionable remediation steps and AI-powered patch suggestions.",
  },
  {
    title: "Built for Modern Stacks",
    body: "Works with applications built using AI tools, modern frameworks, and rapid development workflows.",
  },
  {
    title: "Reduce Production Surprises",
    body: "Catch security problems before customers or attackers discover them.",
  },
  {
    title: "Security Without Expertise",
    body: "No AppSec team required.",
  },
];

function ReasonCard({ title, body, index }: ReasonProps & { index: number }) {
  return (
    <div className="group relative flex flex-col p-8 border-b border-white/10 md:border-r md:[&:nth-child(3n)]:border-r-0 hover:bg-white/[0.02] transition-colors duration-300 overflow-hidden min-h-[220px]">
      
      {/* Dev Arka Plan Numarası (Watermark Effect) */}
      <div className="absolute -bottom-6 -right-2 text-[120px] font-bold text-white/[0.02] group-hover:text-white/[0.04] transition-colors duration-500 leading-none select-none z-0 pointer-events-none font-mono tracking-tighter">
        {index + 1}
      </div>
      
      {/* İçerik */}
      <div className="relative z-10 flex flex-col h-full justify-between">
        <div>
          {/* Teknik Rozet */}
          <div className="flex items-center mb-5">
            <span className="font-mono text-[10px] text-[#a1a1aa] border border-white/10 px-2 py-0.5 rounded-full bg-[#000000]">
              SEC_0{index + 1}
            </span>
          </div>
          
          <h3
            className="text-[18px] font-medium leading-7 text-white font-sans mb-2"
            style={{ letterSpacing: "-0.5px" }}
          >
            {title}
          </h3>
          
          <p className="text-[14px] leading-relaxed text-[#888888]" style={{ letterSpacing: "-0.28px" }}>
            {body}
          </p>
        </div>
        
        {/* Alt Çizgi Animasyonu */}
        <div className="w-0 h-[1px] bg-[#a1a1aa] group-hover:w-8 transition-all duration-500 mt-6 opacity-0 group-hover:opacity-100"></div>
      </div>
    </div>
  );
}
