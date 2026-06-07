# Oculs.io — Architecture Overview

## Zero-Backend Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User / Vibe Coder                        │
└───────────────────────────────┬─────────────────────────────────┘
                                │  HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Vercel Edge Network                            │
│                                                                 │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │              Next.js App (App Router)                    │  │
│   │                                                          │  │
│   │  /app          → Dashboard & Report UI (RSC)             │  │
│   │  /api/webhook  → Webhook receiver (Route Handler)        │  │
│   │  /api/scan     → Scan trigger endpoint                   │  │
│   └──────────────────────────────────────────────────────────┘  │
└───────────┬──────────────────────────┬──────────────────────────┘
            │ Triggers                 │ Reads / Writes
            ▼                          ▼
┌───────────────────────┐   ┌────────────────────────────────────┐
│   GitHub Actions      │   │      AWS Aurora PostgreSQL         │
│   (SAST / DAST CI)    │   │                                    │
│                       │   │  Tables:                           │
│  ┌─────────────────┐  │   │    projects, scans, findings,      │
│  │ semgrep / ZAP   │  │   │    auto_fixes, users               │
│  │ gitleaks / etc. │  │   │                                    │
│  └────────┬────────┘  │   │  Connection: postgres.js           │
│           │ webhook   │   │  ORM: Drizzle                      │
└───────────┼───────────┘   └────────────────────────────────────┘
            │ JSON payload
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  POST /api/webhook/scan                         │
│                                                                 │
│  1. Verify HMAC-SHA256 signature (GITHUB_WEBHOOK_SECRET)        │
│  2. Parse & validate scan JSON payload                          │
│  3. Send findings to Gemini AI for triage & auto-fix            │
│  4. Persist structured results to Aurora                        │
│  5. Revalidate Next.js dashboard cache (revalidatePath)         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Google Gemini AI Layer                         │
│                                                                 │
│  • analyzeFindings()  → severity triage + CWE mapping           │
│  • generateAutoFix()  → unified diff patch                      │
│  • generateReport()   → Markdown security summary               │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

1. **Developer pushes code** → GitHub Actions workflow triggers SAST/DAST tools (Semgrep, OWASP ZAP, Gitleaks).
2. **GitHub Actions** POSTs a structured JSON payload to `/api/webhook/scan` on the Vercel-hosted Next.js app.
3. **Webhook handler** validates the HMAC signature, then calls Gemini AI to triage findings and generate auto-fix patches.
4. **Structured results** are written to AWS Aurora PostgreSQL via Drizzle ORM.
5. **Next.js dashboard** (React Server Components) reads from Aurora and renders the security report — no separate backend process required.
6. **Developers** review findings, apply AI-generated patches, and track remediation progress in the Oculs.io dashboard.

## Key Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Frontend hosting | Vercel | Edge network, zero-config CI/CD, hackathon requirement |
| Database | AWS Aurora PostgreSQL | Serverless scaling, hackathon requirement, ACID compliance |
| ORM | Drizzle | Lightweight, TypeScript-native, no heavyweight abstractions |
| AI | Google Gemini | Large context window suited for code analysis |
| Auth | NextAuth.js | GitHub OAuth for repo access, minimal setup |
| No separate backend | Vercel Route Handlers | True "zero backend" stack; all logic runs at the edge |
