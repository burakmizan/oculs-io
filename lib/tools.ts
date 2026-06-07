import type { ScanTool, ToolCategory } from "@/types"

/**
 * The 20-tool security orchestration matrix Oculs.io drives.
 *
 * This catalog is the single source of truth shared by the scan launcher
 * UI, the webhook ingestion layer, and reporting. `id` matches the
 * `scan_tool` Postgres enum in lib/db/schema.ts exactly.
 */
export interface ToolSpec {
  id: ScanTool
  label: string
  category: ToolCategory
  /** One-line description of what the tool inspects. */
  blurb: string
}

export const TOOLS: readonly ToolSpec[] = [
  // ── SAST — static analysis of source code ───────────────────────────
  { id: "semgrep",      label: "Semgrep",       category: "sast",    blurb: "Pattern-based static analysis across 30+ languages." },
  { id: "codeql",       label: "CodeQL",        category: "sast",    blurb: "Semantic dataflow queries for deep vulnerability detection." },
  { id: "sonarscanner", label: "SonarScanner",  category: "sast",    blurb: "Code quality and security hotspot analysis." },
  { id: "horusec",      label: "Horusec",       category: "sast",    blurb: "Multi-language SAST aggregator with secret detection." },
  { id: "bearer",       label: "Bearer",        category: "sast",    blurb: "Privacy & security risk analysis for sensitive data flows." },
  { id: "nodejsscan",   label: "NodeJsScan",    category: "sast",    blurb: "Static analysis tuned for Node.js applications." },
  { id: "bandit",       label: "Bandit",        category: "sast",    blurb: "Security linter for Python codebases." },
  { id: "gosec",        label: "Gosec",         category: "sast",    blurb: "Go source security analyzer." },
  { id: "trivy",        label: "Trivy",         category: "infra",   blurb: "Dependency, container & IaC misconfiguration scanner." },
  { id: "gitleaks",     label: "Gitleaks",      category: "secrets", blurb: "Detects hardcoded secrets and credentials in git history." },

  // ── DAST / Infrastructure — runtime & network testing ───────────────
  { id: "owasp_zap",    label: "OWASP ZAP",     category: "dast",    blurb: "Full active/passive web application attack proxy." },
  { id: "nuclei",       label: "Nuclei",        category: "dast",    blurb: "Template-driven vulnerability scanning at scale." },
  { id: "nmap_vulners", label: "Nmap Vulners",  category: "infra",   blurb: "Network discovery with CVE correlation." },
  { id: "nikto",        label: "Nikto",         category: "dast",    blurb: "Web server misconfiguration and outdated-software checks." },
  { id: "wapiti",       label: "Wapiti",        category: "dast",    blurb: "Black-box web app fuzzing for injection flaws." },
  { id: "sqlmap",       label: "SQLmap",        category: "dast",    blurb: "Automated SQL injection detection and exploitation." },
  { id: "arachni",      label: "Arachni",       category: "dast",    blurb: "High-performance modular web application scanner." },
  { id: "dirsearch",    label: "Dirsearch",     category: "dast",    blurb: "Brute-forces hidden paths and exposed endpoints." },
  { id: "testssl",      label: "testssl.sh",    category: "infra",   blurb: "TLS/SSL configuration and cipher strength auditing." },
  { id: "wpscan",       label: "WPScan",        category: "dast",    blurb: "WordPress core, plugin & theme vulnerability scanner." },
] as const

export const TOOLS_BY_ID: Record<ScanTool, ToolSpec> = Object.fromEntries(
  TOOLS.map((t) => [t.id, t]),
) as Record<ScanTool, ToolSpec>

/** Human-facing labels for each analysis family, in display order. */
export const CATEGORY_META: Record<
  ToolCategory,
  { label: string; description: string }
> = {
  sast: { label: "SAST", description: "Static source analysis" },
  secrets: { label: "Secrets", description: "Credential & secret leakage" },
  infra: { label: "Infrastructure", description: "Dependencies, network & TLS" },
  dast: { label: "DAST", description: "Runtime web application testing" },
}

export const CATEGORY_ORDER: readonly ToolCategory[] = [
  "sast",
  "secrets",
  "infra",
  "dast",
]

export function toolsByCategory(category: ToolCategory): ToolSpec[] {
  return TOOLS.filter((t) => t.category === category)
}
