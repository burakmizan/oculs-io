export function DarkShowcase() {
  return (
    <section className="bg-[#000000] relative z-10">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        
        {/* Yukarıdan inen kesintisiz Bento Grid kılavuz çizgileri */}
        <div className="relative w-full border-x border-b border-white/10 px-6 py-[96px] flex flex-col items-center">
          
          {/* Köşe Reticle İkonları (+) - Sadece alt köşelere */}
          <div className="absolute -bottom-[6px] -left-[4.5px] text-white/20 text-[10px] font-mono leading-none">+</div>
          <div className="absolute -bottom-[6px] -right-[4.5px] text-white/20 text-[10px] font-mono leading-none">+</div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center w-full">

            {/* Copy */}
            <div className="flex flex-col gap-6">
              <div className="inline-flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-20"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white/50"></span>
                </span>
                <p className="text-[11px] font-mono uppercase tracking-[0.08em] text-[#a1a1aa]">
                  Coming Soon · 2026 Q4
                </p>
              </div>
              <h2
                className="text-[32px] font-semibold leading-[40px] text-white font-sans"
                style={{ letterSpacing: "-1.28px" }}
              >
                Oculs CLI.<br />Security in your terminal.
              </h2>
              <p className="text-[16px] leading-6 text-[#a1a1aa]">
                Navigate to your project, type <code className="text-white bg-white/10 px-1.5 py-0.5 rounded">oculs</code>, and you're in. 
                Authenticate seamlessly via magic link, choose your scan scope, and get AI-powered remediation without ever leaving your IDE.
              </p>

              {/* Callout chips */}
              <div className="flex flex-col gap-3 mt-2">
                {CALLOUTS.map((c) => (
                  <div
                    key={c.label}
                    className="flex items-start gap-3"
                  >
                    <div
                      className="flex-shrink-0 w-5 h-5 mt-0.5 rounded-full
                                 bg-white/5 border border-white/10 flex items-center justify-center"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#50e3c2]" />
                    </div>
                    <div>
                      <p
                        className="text-[14px] font-medium text-white leading-5"
                        style={{ letterSpacing: "-0.28px" }}
                      >
                        {c.label}
                      </p>
                      <p
                        className="text-[13px] leading-5 text-[#888888]"
                        style={{ letterSpacing: "-0.28px" }}
                      >
                        {c.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Oculs CLI Terminal Mockup */}
            <div className="rounded-[8px] overflow-hidden border border-white/10 bg-[#000000] font-mono text-[13px] shadow-2xl flex flex-col h-full min-h-[400px]">
              
              {/* Terminal Header */}
              <div className="flex items-center gap-4 px-4 py-3 border-b border-white/10 bg-white/[0.02]">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-white/20" />
                  <span className="w-3 h-3 rounded-full bg-white/20" />
                  <span className="w-3 h-3 rounded-full bg-white/20" />
                </div>
                <span className="text-[12px] text-[#888888] flex-1 text-center pr-8">
                  Oculs CLI v1.0.0-beta
                </span>
              </div>

              {/* Terminal Content */}
              <div className="p-5 flex flex-col gap-6 flex-1">
                
                {/* Main White Bordered Box (Claude Style) */}
                <div className="border border-white/30 rounded-[6px] p-5 flex flex-col md:flex-row gap-6 relative mt-2">
                  
                  {/* Embedded Box Title */}
                  <div className="absolute -top-[10px] left-4 bg-[#000000] px-2 text-[12px] text-white">
                    Oculs CLI
                  </div>

                  {/* Box Left: User Info & Logo */}
                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
                    <span className="text-white text-[14px]">Welcome back Burak!</span>
                    {/* Logoyu beyaz yapmak için invert filtre ekledik */}
                    <img 
                      src="/oculs.io.png" 
                      alt="Oculs Logo" 
                      className="h-10 w-auto opacity-90"
                      style={{ filter: "brightness(0) invert(1)" }} 
                    />
                    <div className="text-[12px] text-[#a1a1aa] leading-relaxed">
                      Oculs Pro<br />
                      burakmizankilic@gmail.com's Organization<br />
                      ~\Desktop\OculsProject
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="hidden md:block w-[1px] bg-white/20"></div>

                  {/* Box Right: Tips & Info */}
                  <div className="flex-1 flex flex-col gap-4 text-[12px] text-[#a1a1aa]">
                    <div>
                      <span className="text-[#50e3c2] font-medium">Tips for getting started</span><br />
                      Run <code className="text-white">oculs login</code> to authenticate via magic link.<br />
                      Browser session automatically synced.
                    </div>
                    <div className="w-full h-[1px] bg-white/10"></div>
                    <div>
                      <span className="text-[#50e3c2] font-medium">Available Scan Modes</span><br />
                      <span className="text-white">1. Comprehensive SAST & DAST</span><br />
                      <span className="text-white">2. Quick SAST only</span><br />
                      Run <code className="text-white">oculs scan --help</code> for details.
                    </div>
                  </div>
                </div>

                {/* Status Line */}
                <div className="flex items-center gap-2">
                  <div className="w-1 h-3.5 bg-white"></div>
                  <span className="text-white text-[13px]">Magic link login successful! Session active.</span>
                </div>

                {/* Prompt Line */}
                <div className="flex items-center gap-2 mt-auto border-t border-white/10 pt-4">
                  <span className="text-white font-bold">{`>`}</span>
                  <span className="text-[#a1a1aa]">try <span className="text-white">"oculs scan --sast"</span></span>
                  <span className="w-2 h-4 bg-white/50 animate-pulse ml-0.5"></span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}

const CALLOUTS = [
  {
    label: "Frictionless Authentication",
    detail: "Trigger a magic link from the terminal, approve in browser, and you're synced.",
  },
  {
    label: "Local Context Awareness",
    detail: "CLI automatically detects your framework, dependencies, and environment.",
  },
  {
    label: "Targeted Scan Modes",
    detail: "Run quick SAST checks locally, or dispatch full comprehensive scans to the cloud.",
  },
] as const;
