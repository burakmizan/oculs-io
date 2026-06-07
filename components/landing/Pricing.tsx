import { Check } from "@/components/ui/icons";

interface Tier {
  name: string;
  price: string;
  period: string;
  description: string;
  cta: string;
  ctaHref: string;
  featured: boolean;
  features: string[];
}

const TIERS: Tier[] = [
  {
    name: "Hobby",
    price: "$0",
    period: "forever",
    description: "For solo developers exploring security scanning.",
    cta: "Get started free",
    ctaHref: "/signup",
    featured: false,
    features: [
      "Up to 3 repositories",
      "50 scans per month",
      "SAST + secret scanning",
      "AI severity triage",
      "7-day finding history",
      "Community support",
    ],
  },
  {
    name: "Pro",
    price: "$49",
    period: "per month",
    description: "For teams that ship continuously and need full coverage.",
    cta: "Start free trial",
    ctaHref: "/signup?plan=pro",
    featured: true,
    features: [
      "Unlimited repositories",
      "Unlimited scans",
      "SAST + DAST + secret scanning",
      "AI severity triage + CWE mapping",
      "AI auto-fix patch generation",
      "OWASP Top 10 reporting",
      "90-day finding history",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "contact us",
    description: "For organizations with compliance and audit requirements.",
    cta: "Talk to sales",
    ctaHref: "mailto:sales@oculs.io",
    featured: false,
    features: [
      "Everything in Pro",
      "SSO / SAML 2.0",
      "Audit logs",
      "Custom scan policies",
      "Dedicated support",
      "SLA guarantee",
      "On-premises option",
      "Custom data retention",
    ],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="bg-[#000000] relative z-10">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        
        {/* Yukarıdan inen Bento Grid kılavuz çizgileri */}
        <div className="relative w-full border-x border-b border-white/10 px-6 py-[96px] flex flex-col items-center">
          
          {/* Köşe Reticle İkonları (+) - Sadece alt köşelere */}
          <div className="absolute -bottom-[6px] -left-[4.5px] text-white/20 text-[10px] font-mono leading-none">+</div>
          <div className="absolute -bottom-[6px] -right-[4.5px] text-white/20 text-[10px] font-mono leading-none">+</div>

          {/* Section header */}
          <div className="max-w-[600px] w-full mx-auto text-center mb-16">
            <p
              className="text-[11px] font-mono uppercase tracking-[0.08em] text-[#a1a1aa] mb-4"
            >
              PRICING
            </p>
            <h2
              className="text-[32px] font-semibold leading-[40px] text-white font-sans"
              style={{ letterSpacing: "-1.28px" }}
            >
              Start free. Scale when you&apos;re ready.
            </h2>
            <p className="mt-4 text-[16px] leading-6 text-[#a1a1aa]">
              No per-seat pricing. No surprise overages. Pay for what your
              team actually uses.
            </p>
          </div>

          {/* 3-up tier grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start w-full">
            {TIERS.map((tier) => (
              <TierCard key={tier.name} tier={tier} />
            ))}
          </div>

          {/* Fine print */}
          <p className="mt-10 text-center text-[12px] font-mono text-[#666666] w-full">
            All plans include HMAC-verified webhooks, AWS Aurora storage, and
            the open-source GitHub Actions workflow.
          </p>

        </div>
      </div>
    </section>
  );
}

function TierCard({ tier }: { tier: Tier }) {
  const base =
    "flex flex-col gap-6 rounded-[12px] p-8";
  const surface = tier.featured
    ? `${base} bg-white/5 border border-white/20 text-white shadow-[0_0_40px_-15px_rgba(255,255,255,0.1)] relative`
    : `${base} bg-[#000000] border border-white/10 text-[#a1a1aa]`;

  return (
    <div className={surface}>
      {/* Glow Effect for Featured Tier */}
      {tier.featured && (
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      )}

      {/* Tier header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span
            className="text-[14px] font-medium font-sans text-white"
            style={{ letterSpacing: "-0.28px" }}
          >
            {tier.name}
          </span>
                    {tier.featured && (
            <span
              className="inline-flex items-center h-[18px] px-2 text-[10px] font-medium font-mono
                         bg-[#38bdf8]/10 text-[#38bdf8] border border-[#38bdf8]/20 rounded-full"
            >
              POPULAR
            </span>
          )}
        </div>

        <div className="flex items-end gap-1.5 mt-2">
          <span
            className="text-[48px] font-semibold leading-none font-sans text-white"
            style={{ letterSpacing: "-2.4px" }}
          >
            {tier.price}
          </span>
          <span
            className={`text-[13px] pb-2 ${tier.featured ? "text-[#a1a1aa]" : "text-[#666666]"}`}
          >
            /{tier.period}
          </span>
        </div>

        <p
          className={`text-[14px] leading-5 mt-1 ${tier.featured ? "text-[#a1a1aa]" : "text-[#666666]"}`}
          style={{ letterSpacing: "-0.28px" }}
        >
          {tier.description}
        </p>
      </div>

      {/* CTA */}
      <a
        href={tier.ctaHref}
        className={`
          inline-flex items-center justify-center h-10 px-5 rounded-full
          text-[14px] font-medium transition-colors w-full
          ${tier.featured
            ? "bg-white text-black hover:bg-[#e5e5e5] shadow-card"
            : "bg-transparent text-white border border-white/20 hover:bg-white/5"
          }
        `}
      >
        {tier.cta}
      </a>

      {/* Divider */}
      <div
        className="h-px bg-white/10"
        aria-hidden="true"
      />

      {/* Feature list */}
      <ul className="flex flex-col gap-3">
        {tier.features.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-2.5"
          >
            <span
              className={`flex-shrink-0 mt-0.5 ${tier.featured ? "text-[#50e3c2]" : "text-white"}`}
            >
              <Check size={14} />
            </span>
            <span
              className={`text-[13px] leading-5 ${tier.featured ? "text-white" : "text-[#a1a1aa]"}`}
              style={{ letterSpacing: "-0.28px" }}
            >
              {feature}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
