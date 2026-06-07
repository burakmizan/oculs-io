/**
 * Canonical TypeScript contracts shared across the entire app.
 *
 * Row shapes are inferred from the Drizzle schema (single source of truth);
 * the string-literal unions below mirror the Postgres ENUM types so that UI
 * and API code can reference them without importing the schema.
 */

export type {
  User,
  Project,
  NewProject,
  Scan,
  NewScan,
  Vulnerability,
  NewVulnerability,
} from "@/lib/db/schema"

/* ── Enum mirrors ──────────────────────────────────────────────────── */

export type ScanTool =
  | "semgrep"
  | "codeql"
  | "sonarscanner"
  | "horusec"
  | "bearer"
  | "nodejsscan"
  | "bandit"
  | "gosec"
  | "trivy"
  | "gitleaks"
  | "owasp_zap"
  | "nuclei"
  | "nmap_vulners"
  | "nikto"
  | "wapiti"
  | "sqlmap"
  | "arachni"
  | "dirsearch"
  | "testssl"
  | "wpscan"

export type ToolCategory = "sast" | "dast" | "secrets" | "infra"

export type SeverityLevel = "critical" | "high" | "medium" | "low" | "info"

export type Confidence = "high" | "medium" | "low"

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

/** Aggregate counters powering the dashboard stat cards. */
export interface DashboardStats {
  projects: number
  scans: number
  openVulnerabilities: number
  riskScore: number | null
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

export interface WebhookPayload {
  event: "scan.started" | "scan.completed" | "scan.failed"
  scanId: string
  repository: string
  branch: string
  commitSha: string
  findings?: WebhookFinding[]
}

/* ── Auth form action state ────────────────────────────────────────── */

export interface AuthActionState {
  error?: string
  ok?: boolean
}
