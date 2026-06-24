<div align="center">

# Oculs.io

### AI-powered DAST & Security Scanner for Modern Developers and Vibe Coders

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![AWS Aurora](https://img.shields.io/badge/AWS-Aurora_PostgreSQL-FF9900?logo=amazon-aws)](https://aws.amazon.com/rds/aurora/)
[![Deploy on Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://vercel.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Open Source](https://img.shields.io/badge/Open-Source-brightgreen)](CONTRIBUTING.md)

**Oculs.io** scans your GitHub repositories for security vulnerabilities using AI, delivers instant triage and auto-fix patches, and stores everything in a zero-backend architecture — no servers to manage, no ops overhead.

[Live Demo](https://oculs-io.vercel.app) · [Docs](docs/ARCHITECTURE.md) · [Contributing](CONTRIBUTING.md) · [Report Bug](#)

</div>

---

## What is Oculs.io?

Modern developers and vibe coders ship fast. Security audits often don't keep up. **Oculs.io** closes that gap by plugging a full DAST/SAST pipeline directly into your GitHub workflow — no dedicated security team required.

You push code. GitHub Actions runs Semgrep, OWASP ZAP, and Gitleaks. The JSON scan results are POSTed to a Next.js webhook endpoint hosted on Vercel. **Google Gemini AI** triages every finding, maps it to CWE/OWASP Top 10, and generates a ready-to-apply unified diff patch. Everything lands in **AWS Aurora PostgreSQL** and surfaces in a clean dashboard — in under 60 seconds.

### Core Capabilities

| Feature | Description |
|---|---|
| Automated SAST/DAST | Semgrep, OWASP ZAP, Gitleaks via GitHub Actions |
| AI Vulnerability Triage | Gemini maps findings to severity, CWE, OWASP Top 10 |
| AI Auto-Fix Patches | Unified diff patches generated per finding |
| Zero-Backend Architecture | Next.js Route Handlers replace a dedicated API server |
| Persistent Storage | AWS Aurora PostgreSQL — scan history, findings, fixes |
| Real-time Dashboard | React Server Components — no polling, no WebSockets |
| GitHub-native | Trigger scans on push, PR, or schedule |

---

## Hackathon

> **Built for the [H0: Hack the Zero Stack with Vercel v0 and AWS Databases](https://devpost.com) hackathon on Devpost.**

**Track:** Monetizable B2B App

**Stack compliance:**
- **Frontend & API:** Next.js 16 (App Router) deployed on **Vercel**
- **Database:** **AWS Aurora PostgreSQL** (Serverless v2) via Drizzle ORM
- **AI:** Google Gemini 3.5 Flash for vulnerability analysis and auto-fix generation
- **Zero-backend:** All business logic runs inside Next.js Route Handlers and React Server Components — no separate API server, no Lambda, no containers

The architecture demonstrates that a production-grade B2B security SaaS can be built and operated entirely within the Vercel + AWS database stack without spinning up a single dedicated backend service.

---

## Architecture

![Oculs.io Architecture Diagram](public/architecture.png)


Full architecture details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

---

## Getting Started

### Prerequisites

- Node.js >= 20.x
- An **AWS Aurora PostgreSQL** cluster (Serverless v2 recommended) — [Setup guide](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html)
- A **Google Gemini API key** — [Get one here](https://aistudio.google.com/app/apikey)
- A **GitHub Personal Access Token** with `repo` and `workflow` scopes

### 1. Clone the Repository

```bash
git clone https://github.com/burakmizan/oculs-io.git
cd oculs-io
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in every variable. The critical ones:

```env
# AWS Aurora PostgreSQL connection string
DATABASE_URL="postgresql://user:pass@your-cluster.rds.amazonaws.com:5432/oculs_db?sslmode=require"

# AWS credentials (IAM user with rds:connect permission)
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="us-east-1"

# Google Gemini
GEMINI_API_KEY="AIzaSy..."

# GitHub webhook secret (generate with: openssl rand -hex 32)
GITHUB_WEBHOOK_SECRET="..."
```

> **Never commit `.env.local`** — it is git-ignored by default.

### 3. Set Up the Database

```bash
# Generate and run Aurora migrations
npm run db:generate
npm run db:migrate
```

Ensure your Aurora security group allows inbound connections from Vercel's egress IP ranges (or use IAM authentication).

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Configure the GitHub Actions Webhook

In your target repository's GitHub settings, add a webhook:

- **Payload URL:** `https://your-app.vercel.app/api/webhook/scan`
- **Content type:** `application/json`
- **Secret:** your `GITHUB_WEBHOOK_SECRET` value
- **Events:** `workflow_run`

Then add the provided `.github/workflows/oculs-scan.yml` (coming soon) to your repository.

---

## Project Structure

```
oculs-io/
├── app/
│   ├── api/
│   │   └── webhook/
│   │       └── scan/         # POST — receives GitHub Actions payloads
│   └── (dashboard)/          # Dashboard pages (RSC)
├── components/
│   └── ui/                   # Minimalist, zero-dependency UI components
├── lib/
│   ├── db/                   # Aurora connection + Drizzle schema
│   └── ai/                   # Gemini agent orchestration
├── types/                    # Shared TypeScript interfaces
├── docs/                     # Architecture diagrams and ADRs
├── .env.example              # Environment variable reference
├── CONTRIBUTING.md
└── LICENSE
```

---

## Deployment

### Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fburakmizan%2Foculs-io)

1. Connect your GitHub repository to Vercel.
2. Add all environment variables from `.env.example` in the Vercel dashboard under **Settings → Environment Variables**.
3. Deploy — Vercel auto-detects Next.js and configures edge caching.

> **Important:** Set the `DATABASE_URL` to use `sslmode=require`. Aurora Serverless v2 may need the Data API enabled or a VPC-accessible connection. For production, use [Vercel's VPC peering](https://vercel.com/docs/infrastructure/compute) or an AWS PrivateLink endpoint.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS |
| Database | AWS Aurora PostgreSQL (Serverless v2) |
| ORM | Drizzle ORM |
| AI | Google Gemini 3.5 Flash |
| Hosting | Vercel |
| SAST Engine | Semgrep |
| DAST Engine | OWASP ZAP |
| Secret Scanning | Gitleaks |
| Auth | NextAuth.js |

---

## Roadmap

- [x] Core webhook handler + HMAC validation
- [x] Drizzle schema + Aurora migrations
- [x] Gemini triage pipeline
- [x] Auto-fix patch generation
- [x] Dashboard — scan history & findings list
- [ ] Dashboard — finding detail with diff viewer
- [ ] GitHub App (replace PAT-based webhooks)
- [x] Slack / email alert notifications
- [x] API key authentication for B2B customers
- [ ] Usage-based billing integration (Stripe)
- [ ] Multi-repo project support

### Team-aware features (roadmap)

Today, Oculs.io auto-creates a single organization per user. Teams exist (create, invite, switch) and share project and scan lists, but findings, AI reports, and AI fix suggestions are scoped to the scan owner's user ID — a teammate cannot yet open or act on another member's findings. Team-shared remediation (including one-click auto-fix PRs and a team-visible AI assistant) is on the roadmap.

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on branching, commit conventions, and the PR process.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">
  <sub>Built with ♥ for the H0: Hack the Zero Stack hackathon on Devpost.</sub>
</div>
