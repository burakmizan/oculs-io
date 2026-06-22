/**
 * Canonical TypeScript contracts shared across the entire app.
 *
 * Row shapes are inferred from the Drizzle schema (single source of truth);
 * the string-literal unions below mirror the Postgres ENUM types so that UI
 * and API code can reference them without importing the schema.
 */

export type {
  User,
  Organization,
  NewOrganization,
  Project,
  NewProject,
  Scan,
  NewScan,
  Vulnerability,
  NewVulnerability,
} from "@/lib/db/schema"

/* ── Enum mirrors ──────────────────────────────────────────────────── */

export type ScanTool =
  | "semgrep" | "codeql" | "sonarscanner" | "horusec" | "bearer"
  | "nodejsscan" | "bandit" | "gosec" | "trivy" | "gitleaks"
  | "eslint_security" | "npm_audit" | "detect_secrets"
  | "owasp_zap" | "nuclei" | "nmap_vulners" | "nikto" | "wapiti"
  | "sqlmap" | "arachni" | "dirsearch" | "testssl" | "wpscan"

export type ToolCategory = "sast" | "dast" | "secrets" | "infra"

export type SeverityLevel = "critical" | "high" | "medium" | "low" | "info"

export type Confidence = "high" | "medium" | "low"

/** AI-assessed likelihood a finding can actually be exploited in practice. */
export type ExploitabilityLevel = "high" | "medium" | "low"

export type ScanStatus = "pending" | "queued" | "running" | "completed" | "failed"

export type ScanTrigger = "manual" | "webhook" | "schedule"

export type VulnerabilityStatus =
  | "open"
  | "in_review"
  | "resolved"
  | "dismissed"
  | "false_positive"

export type FixStatus =
  | "none"
  | "generating"
  | "suggested"
  | "applied"
  | "failed"

/* ── View models ───────────────────────────────────────────────────── */

/** Severity rollup cached on `scans.summary` and rendered on the dashboard. */
export interface ScanSummary {
  total: number
  critical: number
  high: number
  medium: number
  low: number
  info: number
  /** 0–100 weighted risk score. */
  riskScore: number
}

/**
 * Detected technology profile of a scanned repository, derived from its
 * dependency manifest (package.json, requirements.txt, …) at scan-trigger
 * time and cached on `scans.techStack`. Fed to every Gemini prompt so the AI
 * can reason about framework-specific exploitability and remediation.
 */
export interface TechStack {
  /** Primary language family, e.g. "TypeScript/Node.js", "Python", "Go". */
  language: string | null
  /** Detected web framework, e.g. "Next.js", "Django", "Rails". */
  framework: string | null
  /** A handful of notable dependencies for context. */
  dependencies: string[]
  /** Manifest file the profile was derived from. */
  manifest: string | null
  /** One-line human summary prepended to AI prompts. */
  summary: string
}

/** Aggregate counters powering the dashboard stat cards. */
export interface DashboardStats {
  projects: number
  scans: number
  openVulnerabilities: number
  riskScore: number | null
  /** Critical+high findings with fixAppliedAt in the last 30 days. */
  closedLast30d: number
  /** Critical+high findings created in the last 30 days. */
  openedLast30d: number
}

/* ── Webhook ingestion contract (GitHub Actions → /api/webhook/scan) ── */

export interface WebhookFinding {
  tool: ScanTool
  ruleId?: string
  title: string
  description?: string
  severity: SeverityLevel
  confidence?: Confidence
  cweId?: string
  owaspCategory?: string
  cvssScore?: string
  filePath?: string
  lineStart?: number
  lineEnd?: number
  targetUrl?: string
  codeSnippet?: string
  references?: string[]
}

export interface ScanToolProgress {
  tool: string
  findingCount: number
  completedAt: string
}

export interface WebhookPayload {
  event: "scan.started" | "scan.completed" | "scan.failed" | "tool.completed"
  scanId: string
  repository: string
  branch: string
  commitSha: string
  findings?: WebhookFinding[]
  /** Tool name — present on per-tool completion events. */
  tool?: string
  /** True on the workflow-level final event that closes the scan. */
  final?: boolean
}

/* ── Auth form action state ────────────────────────────────────────── */

export interface AuthActionState {
  error?: string
  ok?: boolean
}
