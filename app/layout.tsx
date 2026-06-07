import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Oculs.io — AI-powered Security Scanner for Vibe Coders",
  description:
    "Oculs.io runs AI-powered DAST and SAST scans directly from your GitHub Actions workflow. Instant triage, CWE mapping, and auto-fix patches in under 60 seconds.",
  keywords: [
    "DAST", "SAST", "security scanner", "GitHub Actions",
    "AI security", "vulnerability scanner", "vibe coders",
  ],
  openGraph: {
    title: "Oculs.io — AI-powered Security Scanner",
    description: "Secure your code before it ships.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Oculs.io — AI-powered Security Scanner",
    description: "Secure your code before it ships.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
