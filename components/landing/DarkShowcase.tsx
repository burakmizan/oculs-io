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
              <p
                className="text-[11px] font-mono uppercase tracking-[0.08em] text-[#a1a1aa]"
              >
                ZERO OPS
              </p>
              <h2
                className="text-[32px] font-semibold leading-[40px] text-white font-sans"
                style={{ letterSpacing: "-1.28px" }}
              >
                Your security pipeline,<br />without the infrastructure.
              </h2>
              <p className="text-[16px] leading-6 text-[#a1a1aa]">
                GitHub Actions runs the scans. Oculs processes the results with
                Gemini AI. Everything surfaces in your dashboard — no ops, no
                servers, no configuration overhead.
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

            {/* Code editor mockup */}
            <div className="rounded-[8px] overflow-hidden border border-white/10 bg-[#000000]">
              {/* Title bar */}
              <div
                className="flex items-center justify-between px-4 py-3
                           bg-white/5 border-b border-white/10"
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                  <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                  <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
                </div>
                <span className="text-[11px] font-mono text-[#888888]">
                  POST /api/webhook/scan
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-mono
                               text-[#50e3c2] bg-[#50e3c2]/10 px-2 py-0.5 rounded-full border border-[#50e3c2]/20"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#50e3c2] animate-pulse" />
                    LIVE
                  </span>
                </div>
              </div>

              {/* Payload */}
              <div className="bg-[#000000] px-5 py-5 overflow-x-auto">
                <pre className="text-[12px] leading-[22px] font-mono">
                  <code>
                    <DL>{"{"}</DL>
                    <DL>{"  "}<DK>"event"</DK>{":     "}<DV>"scan.completed"</DV>{","}</DL>
                    <DL>{"  "}<DK>"project"</DK>{":   "}<DV>"acme/api-service"</DV>{","}</DL>
                    <DL>{"  "}<DK>"scan_id"</DK>{":   "}<DV>"scn_01Hx7Y2k"</DV>{","}</DL>
                    <DL>{"  "}<DK>"timestamp"</DK>{": "}<DV>"2026-06-07T14:32:01Z"</DV>{","}</DL>
                    <DL>{"  "}<DK>"findings"</DK>{": "}<span className="text-[#a1a1aa]">2</span>{","}</DL>
                    <DL>{"  "}<DK>"critical"</DK>{": "}<span className="text-[#a1a1aa]">0</span>{","}</DL>
                    <DL>{"  "}<DK>"high"</DK>{":     "}<DH>1</DH>{","}</DL>
                    <DL>{"  "}<DK>"medium"</DK>{":   "}<DM>1</DM>{","}</DL>
                    <DL>{"  "}<DK>"patches"</DK>{":  "}<DG>2</DG>{","}</DL>
                    <DL>{"  "}<DK>"ai_model"</DK>{": "}<DV>"gemini-1.5-pro"</DV></DL>
                    <DL>{"}"}</DL>
                  </code>
                </pre>
              </div>

              {/* Status footer */}
              <div
                className="flex items-center justify-between px-4 py-2.5
                           bg-white/5 border-t border-white/10"
              >
                <span className="text-[11px] font-mono text-[#888888]">
                  200 OK · 312ms
                </span>
                <span className="text-[11px] font-mono text-[#50e3c2]">
                  ✓ Stored to Aurora · AI patches queued
                </span>
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
    label: "GitHub Actions native",
    detail: "Drop a workflow file in your repo — no new accounts, no SDK.",
  },
  {
    label: "HMAC-verified webhook",
    detail: "Every payload is signature-validated before processing.",
  },
  {
    label: "Persisted to AWS Aurora",
    detail: "Scan history and findings are stored with full ACID guarantees.",
  },
] as const;

/* Dark-band syntax-highlight helpers */
function DL({ children }: { children: React.ReactNode }) {
  return <div className="text-[#555]">{children}</div>;
}
function DK({ children }: { children: React.ReactNode }) {
  return <span className="text-[#7dd3fc]">{children}</span>;
}
function DV({ children }: { children: React.ReactNode }) {
  return <span className="text-[#c4b5fd]">{children}</span>;
}
function DH({ children }: { children: React.ReactNode }) {
  return <span className="text-[#fca5a5] font-medium">{children}</span>;
}
function DM({ children }: { children: React.ReactNode }) {
  return <span className="text-[#fcd34d] font-medium">{children}</span>;
}
function DG({ children }: { children: React.ReactNode }) {
  return <span className="text-[#86efac] font-medium">{children}</span>;
}
