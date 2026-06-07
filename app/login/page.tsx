import type { Metadata } from "next"
import Link from "next/link"
import { AuthForm } from "@/components/auth/AuthForm"

export const metadata: Metadata = {
  title: "Sign In — Oculs.io",
  description: "Sign in to your Oculs.io security console.",
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative bg-[#000000]">
      
      <div 
        className="absolute inset-0 z-0 opacity-15 pointer-events-none" 
        style={{ 
          backgroundImage: "url('/hands.jpg')", 
          backgroundSize: "cover", 
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat"
        }}
      ></div>

      <div className="relative z-10 w-full max-w-[400px]">
        
        <div className="bg-transparent border-y border-white/10 p-10 flex flex-col items-center gap-7 relative">

          {/* Logo */}
          <Link
            href="/"
            className="flex items-center justify-center hover:opacity-75 transition-opacity mb-2"
            aria-label="Oculs.io home"
          >
            <img 
              src="/oculs.io.png" 
              alt="Oculs.io Logo" 
              className="h-28 w-auto object-contain"
            />
          </Link>

          {/* Headline */}
          <div className="text-center flex flex-col gap-2">
            <h1
              className="text-[18px] font-semibold text-white"
              style={{ letterSpacing: "-0.54px" }}
            >
              Sign in to your security console
            </h1>
            <p
              className="text-[13px] leading-5 text-[#666666]"
              style={{ letterSpacing: "-0.26px" }}
            >
              Monitor vulnerabilities, review AI&#8209;generated patches, and ship with confidence.
            </p>
          </div>

          {/* Auth */}
          <AuthForm />

          {/* Legal */}
          <p className="text-center text-[11px] font-mono text-[#444444] leading-5">
            By continuing you agree to our{" "}
            <Link
              href="/terms"
              className="text-[#666666] hover:text-[#a1a1aa] transition-colors underline underline-offset-2"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="text-[#666666] hover:text-[#a1a1aa] transition-colors underline underline-offset-2"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        {/* Back to landing */}
        <p className="mt-6 text-center text-[12px] font-mono text-[#444444]">
          <Link href="/" className="hover:text-[#a1a1aa] transition-colors">
            ← Back to oculs.io
          </Link>
        </p>
      </div>
    </div>
  )
}
