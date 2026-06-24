# Oculs.io — Architecture Overview

![Architecture Diagram](../public/architecture.png)

## Zero-Backend Stack

Oculs.io runs entirely on **Vercel + AWS Aurora PostgreSQL** — no separate backend server, no Lambda, no containers. All business logic lives inside Next.js Route Handlers and React Server Components.

| Layer | Technology | Role |
|---|---|---|
| Frontend & API | Next.js 16 (App Router) on Vercel | Dashboard UI + all Route Handlers |
| Database | AWS Aurora PostgreSQL (Serverless v2) | Single source of truth — 12 tables, 8 Postgres ENUMs |
| ORM | Drizzle + postgres.js (max:1) | Serverless-safe, TypeScript-native |
| AI | Google Gemini 3.5 Flash | Vulnerability triage, false positive detection, auto-fix generation |
| CI/CD Scanner | GitHub Actions (oculs-scan.yml) | 20+ SAST tools — Semgrep, Gitleaks, Trivy, CodeQL, Bearer, Horusec… |
| Auth | Auth.js v5 | GitHub OAuth + Credentials, Edge-safe middleware |

## Core Scan Pipeline
Developer

│  triggers scan from dashboard

▼

POST /api/scan/trigger  (Vercel Route Handler)

│  workflow_dispatch → GitHub Actions

▼

oculs-scan.yml  (20+ SAST tools run in parallel)

│  HMAC-SHA256 signed JSON payload per tool

▼

POST /api/webhook/scan  (Vercel Route Handler)

│

├─► isUniversalFalsePositive()   pre-filter (rule-based, ~60% noise reduction)

│

├─► analyzeFindings()            Gemini AI triage

│     • triageSeverity + triageReasoning

│     • exploitability: high / medium / low

│     • CWE ID + OWASP Top 10 category

│     • CVSS score estimate

│     • isFalsePositive detection

│     • cross-tool correlationGroup (attack chain detection)

│

├─► bulk INSERT → vulnerabilities (Aurora)

│

├─► UPDATE scans → completed (Aurora)

│

├─► POST commit status → GitHub (PR gate)

│

└─► Slack / Discord alert (lib/notify.ts)

## Database Schema

Aurora PostgreSQL — 12 tables, 8 ENUMs, Drizzle ORM.

| Table | Purpose |
|---|---|
| `users` | Auth — plan (starter / pro / enterprise), onboarding state |
| `accounts` | OAuth tokens (GitHub access token for repo API calls) |
| `organizations` | Auto-created per user — multi-tenant foundation |
| `teams` + `team_members` + `team_invites` | Team workspace support |
| `projects` | Connected repos — repoFullName, targetUrl, schedule config |
| `scans` | Scan runs — status, tools, summary, riskScore, techStack |
| `vulnerabilities` | 34 columns: severity, exploitability, CWE, OWASP, fingerprint, correlationGroup, aiFixPatch, fixStatus… |
| `api_keys` | Hashed API keys for CI/CD pipeline authentication |

**Key schema decisions:**
- `vulnerabilities.fingerprint` — stable hash for cross-scan dedup, mute carry-forward
- `vulnerabilities.correlationGroup` — Gemini-detected attack chains elevate severity
- `vulnerabilities.exploitability` — AI-assessed real-world exploitability (not just CVSS)
- `scans.techStack` — framework detection (Next.js, Express, Django…) for context-aware triage
- `postgres.js max:1` — single connection per serverless invocation, prevents Aurora connection exhaustion

## AI Layer

Three Gemini functions, all lazy (never in the hot webhook path):

| Function | When called | Output |
|---|---|---|
| `analyzeFindings()` | Webhook finalize | Triage + CWE + OWASP + exploitability + isFalsePositive per finding |
| `correlateFindings()` | Webhook finalize (post-insert) | Attack chain groups, severity elevation |
| `generateReport()` | On-demand (report page) | Markdown security summary |

**False positive pipeline (two layers):**
1. `isUniversalFalsePositive()` — rule-based pre-filter: `.env.example`, lock files, generated code, CI config, placeholder values (AKIAIOSFODNN7EXAMPLE…)
2. Gemini `isFalsePositive` field — AI reads actual file content fetched from GitHub API, makes context-aware judgment

## Key Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| No separate backend | Next.js Route Handlers | True Zero Stack — Vercel handles scaling |
| `max:1` DB connection | postgres.js config | Aurora Serverless — each invocation gets one connection |
| Lazy AI calls | Report page, not webhook | Gemini free-tier rate limits — webhook stays fast |
| HMAC-SHA256 | Webhook verification | Timing-safe comparison, prevents spoofed payloads |
| Drizzle migrations | `db:generate` + `db:migrate` | Schema-as-code, Aurora-compatible, no raw SQL |
| Fingerprint dedup | Hash of tool+title+file+line | Same finding across scans stays muted |