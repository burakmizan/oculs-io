/**
 * Oculs.io — shared TypeScript interfaces
 */

export type SeverityLevel = "critical" | "high" | "medium" | "low" | "info";

export interface ScanFinding {
  id: string;
  scanId: string;
  severity: SeverityLevel;
  title: string;
  description: string;
  filePath: string;
  lineNumber?: number;
  cwe?: string;
  owasp?: string;
  remediation?: string;
}

export interface ScanResult {
  id: string;
  projectId: string;
  status: "pending" | "running" | "completed" | "failed";
  triggeredAt: string;
  completedAt?: string;
  findings: ScanFinding[];
  summary?: ScanSummary;
}

export interface ScanSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  riskScore: number;
}

export interface Project {
  id: string;
  name: string;
  repoUrl: string;
  ownerId: string;
  createdAt: string;
  lastScanAt?: string;
}

export interface WebhookPayload {
  event: "scan.completed" | "scan.failed" | "scan.started";
  projectId: string;
  scanId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface AutoFix {
  findingId: string;
  patch: string;
  explanation: string;
  aiModel: string;
  confidence: number;
}
