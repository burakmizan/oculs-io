import type { ReactNode } from "react";

interface Feature {
  title: string;
  body: string;
  visual: ReactNode;
}

const FEATURES: Feature[] = [
  {
    title: "Connect your project",
    body: "Connect your GitHub repository in seconds and start scanning immediately. No complicated setup, security expertise, or extra infrastructure required.",
    visual: (
      <div className="w-[180px] h-[80px] rounded-t-xl border-x border-t border-white/10 bg-[#0a0a0a] flex items-center justify-center shadow-2xl relative translate-y-6 group-hover:translate-y-2 transition-transform duration-500">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          </div>
          <div className="w-4 h-[1px] bg-white/20"></div>
          <div className="w-8 h-8 rounded-lg bg-black border border-white/20 flex items-center justify-center">
             <div className="w-4 h-4 bg-white/20 rounded-sm"></div>
          </div>
        </div>
      </div>
    )
  },
  {
    title: "Scan your code",
    body: "Oculs analyzes your codebase, dependencies, secrets, and application behavior to uncover potential security risks before deployment.",
    visual: (
      <div className="w-full max-w-[220px] h-[90px] border-x border-t border-white/10 bg-[#0a0a0a] rounded-t-xl p-4 relative overflow-hidden translate-y-6 group-hover:translate-y-2 transition-transform duration-500">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>
        <div className="space-y-2.5">
          <div className="h-1.5 w-3/4 bg-white/10 rounded-sm"></div>
          <div className="h-1.5 w-1/2 bg-white/10 rounded-sm"></div>
          <div className="h-1.5 w-5/6 bg-white/10 rounded-sm"></div>
        </div>
        <div className="absolute top-0 left-0 w-full h-10 bg-gradient-to-b from-blue-500/10 to-transparent group-hover:animate-pulse"></div>
      </div>
    )
  },
  {
    title: "Discover vulnerabilities",
    body: "Find exposed secrets, authentication flaws, insecure configurations, and common attack vectors before attackers do.",
    visual: (
      <div className="flex gap-2 items-end h-[80px] translate-y-6 group-hover:translate-y-2 transition-transform duration-500">
         <div className="w-10 h-12 rounded-t-lg border-x border-t border-white/10 bg-white/5"></div>
         <div className="w-10 h-20 rounded-t-lg border-x border-t border-red-500/30 bg-red-500/10 flex items-start justify-center pt-3 relative overflow-hidden">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-red-500/20 to-transparent"></div>
         </div>
         <div className="w-10 h-16 rounded-t-lg border-x border-t border-white/10 bg-white/5"></div>
      </div>
    )
  },
  {
    title: "Understand the risk",
    body: "Every finding is explained in plain English. Learn what the vulnerability means, why it matters, and how it could impact your application.",
    visual: (
      <div className="w-[200px] p-3 rounded-t-xl border-x border-t border-white/10 bg-[#0a0a0a] translate-y-6 group-hover:translate-y-2 transition-transform duration-500">
        <div className="flex flex-col gap-2">
           <div className="flex justify-between items-center bg-white/5 p-2 rounded border border-white/5">
             <div className="h-1.5 w-12 bg-white/20 rounded-sm"></div>
             <div className="h-1.5 w-4 bg-red-500 rounded-sm shadow-[0_0_8px_#ef4444]"></div>
           </div>
           <div className="flex justify-between items-center bg-white/5 p-2 rounded border border-white/5">
             <div className="h-1.5 w-16 bg-white/20 rounded-sm"></div>
             <div className="h-1.5 w-4 bg-orange-500 rounded-sm shadow-[0_0_8px_#f97316]"></div>
           </div>
        </div>
      </div>
    )
  },
  {
    title: "Get AI-powered fixes",
    body: "Receive clear remediation steps and AI-generated patch suggestions that help you resolve issues faster.",
    visual: (
      <div className="w-full max-w-[220px] rounded-t-xl border-x border-t border-white/10 bg-[#0a0a0a] p-3 space-y-2 translate-y-6 group-hover:translate-y-2 transition-transform duration-500">
        <div className="flex items-center gap-2 p-1.5 rounded bg-red-500/10 border border-red-500/20">
          <span className="text-red-500 font-mono text-[10px] leading-none">-</span>
          <div className="h-1.5 w-3/4 bg-red-500/40 rounded-sm"></div>
        </div>
        <div className="flex items-center gap-2 p-1.5 rounded bg-emerald-500/10 border border-emerald-500/20">
          <span className="text-emerald-500 font-mono text-[10px] leading-none">+</span>
          <div className="h-1.5 w-full bg-emerald-500/40 rounded-sm"></div>
        </div>
      </div>
    )
  },
  {
    title: "Deploy with confidence",
    body: "Launch knowing your application has been reviewed for critical security risks, reducing surprises in production.",
    visual: (
      <div className="space-y-1.5 w-[160px] translate-y-6 group-hover:translate-y-2 transition-transform duration-500">
        <div className="h-8 w-full rounded-md border border-white/10 bg-white/5 flex items-center px-3 gap-2 relative z-10 backdrop-blur-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
          <div className="h-1.5 w-12 bg-white/20 rounded-sm"></div>
        </div>
        <div className="h-8 w-full rounded-md border border-white/10 bg-white/5 flex items-center px-3 gap-2 opacity-50 scale-95 mx-auto -mt-3">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
          <div className="h-1.5 w-12 bg-white/20 rounded-sm"></div>
        </div>
      </div>
    )
  },
];

export function Features() {
  return (
    <section id="features" className="bg-[#000000] relative z-10">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        
        {/* Üst ve alt sectionlarla tam birleşen ana dikey kılavuz çizgileri */}
        <div className="relative w-full border-x border-white/10 flex flex-col items-center">
          
          {/* Grid'in kendisi. Padding kaldırıldı, doğrudan üst çizgiye yapıştı. */}
          <div className="grid grid-cols-1 md:grid-cols-3 w-full border-t border-b border-white/10 relative">

  {/* Dikey kılavuz çizgileri */}
  <div className="hidden md:block absolute top-0 bottom-0 left-1/3 w-px bg-white/10 pointer-events-none" />
  <div className="hidden md:block absolute top-0 bottom-0 left-2/3 w-px bg-white/10 pointer-events-none" />

  {/* Yatay kılavuz çizgisi */}
  <div className="hidden md:block absolute left-0 right-0 top-1/2 h-px bg-white/10 pointer-events-none" />
            
            {/* Köşe Reticle İkonları (+) */}
            <div className="absolute -top-[6px] -left-[4.5px] text-white/20 text-[10px] font-mono leading-none z-10">+</div>
            <div className="absolute -top-[6px] -right-[4.5px] text-white/20 text-[10px] font-mono leading-none z-10">+</div>
            <div className="absolute -bottom-[6px] -left-[4.5px] text-white/20 text-[10px] font-mono leading-none z-10">+</div>
            <div className="absolute -bottom-[6px] -right-[4.5px] text-white/20 text-[10px] font-mono leading-none z-10">+</div>

            {FEATURES.map((feature, index) => (
              <FeatureCard key={index} {...feature} />
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}

function FeatureCard({ title, body, visual }: Feature) {
  return (
    <div
      className="group relative flex flex-col p-8 border-white/10 
                 border-b last:border-b-0
                 md:border-r md:[&:nth-child(3n)]:border-r-0
                 md:[&:nth-child(n+4)]:border-b-0
                 hover:bg-white/[0.02] transition-colors duration-300 min-h-[280px] overflow-hidden"
    >
      {/* Top Content: Text */}
      <div className="flex flex-col gap-3 relative z-10">
        <h3
          className="text-[20px] font-semibold leading-7 text-white font-sans"
          style={{ letterSpacing: "-0.6px" }}
        >
          {title}
        </h3>
        <p className="text-[14px] leading-relaxed text-[#a1a1aa]" style={{ letterSpacing: "-0.28px" }}>
          {body}
        </p>
      </div>

      {/* Bottom Visual Component */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center items-end pointer-events-none">
        {visual}
      </div>
    </div>
  );
}
