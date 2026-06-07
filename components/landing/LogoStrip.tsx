export function LogoStrip() {
  return (
    <section className="bg-[#000000] relative z-10">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        
        {/* Hero'nun altından devam eden, üstü açık Bento kutusu */}
        <div className="relative w-full border-x border-b border-white/10 px-6 py-12 flex flex-col items-center">
          
          {/* Köşe Reticle İkonları (+) Sadece alta, çünkü üst kısım Hero'ya yapışık */}
          <div className="absolute -bottom-[6px] -left-[4.5px] text-white/20 text-[10px] font-mono leading-none">+</div>
          <div className="absolute -bottom-[6px] -right-[4.5px] text-white/20 text-[10px] font-mono leading-none">+</div>

          <p
            className="text-center text-[11px] font-mono uppercase tracking-[0.08em] text-[#666666] mb-8"
          >
            Integrates with your existing workflow
          </p>

          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 w-full">
            {TOOLS.map((tool) => (
              <div
                key={tool.name}
                className="flex items-center gap-2.5 text-[#a1a1aa] hover:text-white transition-all duration-300 cursor-pointer grayscale hover:grayscale-0 opacity-70 hover:opacity-100"
              >
                <img 
                  src={tool.iconUrl} 
                  alt={tool.name} 
                  className="w-5 h-5 object-contain" 
                  aria-hidden="true"
                />
                <span
                  className="text-[14px] font-medium"
                  style={{ letterSpacing: "-0.28px" }}
                >
                  {tool.name}
                </span>
              </div>
            ))}
          </div>
          
        </div>
      </div>
    </section>
  );
}

const TOOLS = [
  { name: "GitHub Actions", iconUrl: "https://github.com/actions.png" },
  { name: "Semgrep",        iconUrl: "https://github.com/semgrep.png" },
  { name: "OWASP ZAP",      iconUrl: "https://github.com/zaproxy.png" },
  { name: "Gitleaks",       iconUrl: "https://github.com/gitleaks.png" },
  { name: "Vercel",         iconUrl: "https://cdn.simpleicons.org/vercel/white" },
  { name: "AWS Aurora",     iconUrl: "https://cdn.simpleicons.org/amazonaws/FF9900" },
] as const;
