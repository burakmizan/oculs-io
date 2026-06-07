import { NavBar }       from "@/components/landing/NavBar";
import { Hero }         from "@/components/landing/Hero";
import { LogoStrip }    from "@/components/landing/LogoStrip";
import { Features }     from "@/components/landing/Features";
import { DarkShowcase } from "@/components/landing/DarkShowcase";
import { HowItWorks }   from "@/components/landing/HowItWorks";
import { Pricing }      from "@/components/landing/Pricing";
import { CtaBand }      from "@/components/landing/CtaBand";
import { Footer }       from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100]
                   focus:inline-flex focus:items-center focus:h-9 focus:px-3
                   focus:text-sm focus:font-medium focus:bg-white focus:text-[#171717]
                   focus:rounded-[6px] focus:shadow-card-lg"
      >
        Skip to content
      </a>

      <NavBar />

      <main id="main">
        <Hero />
        <LogoStrip />
        <Features />
        <DarkShowcase />
        <HowItWorks />
        <Pricing />
        <CtaBand />
      </main>

      <Footer />
    </>
  );
}
