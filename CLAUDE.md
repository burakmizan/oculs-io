# CLAUDE.md

> 🚨 **CRITICAL SYSTEM DIRECTIVE:** DO NOT MODIFY, DELETE, OR RESTRUCTURE ANYTHING FROM HERE DOWN TO THE "END OF IMMUTABLE SECTION" MARKER. THIS UPPER SECTION IS STRICTLY READ-ONLY UNDER ALL CIRCUMSTANCES. 🚨

# SYSTEM CONTEXT: DEVPOST HACKATHON RULES & GUIDELINES
**Hackathon Name:** H0: Hack the Zero Stack with Vercel v0 and AWS Databases
**Deadline:** June 30, 2026 @ 3:00am GMT+3
**Target Track:** Track 2: Monetizable B2B app

## 1. CORE TECHNOLOGY STACK (MANDATORY)
* **Frontend:** MUST be deployed on Vercel (or v0.app). Next.js is the preferred framework.
* **Backend / Database:** MUST use one of three designated AWS Databases as the primary data store:
    * **Amazon Aurora PostgreSQL (Our Choice)**
    * Amazon Aurora DSQL
    * Amazon DynamoDB
* **Architecture Concept:** "Zero Stack". Focus on shipping quickly using serverless/API routes directly connecting to the operationally proven AWS database, avoiding heavy traditional backend infrastructure.

## 2. PROJECT REQUIREMENTS (OCULS.IO)
* **Product:** A full-stack, monetizable Business-to-Business (B2B) application.
* **Viability:** The project must be "shippable software," not just a demo. It needs a deliberate data model and architecture capable of real-world traffic.
* **Current Project:** Oculs.io - An AI-powered Dynamic Application Security Testing (DAST) micro-SaaS for developers ("vibe coders").

## 3. SUBMISSION DELIVERABLES TO PREPARE FOR
When generating code and documentation, keep in mind we need to output the following for the final submission:
1.  **Working Application:** Hosted on a Vercel URL.
2.  **Architecture Diagram:** Showing how the Vercel frontend connects to backend components and the AWS Database.
3.  **Proof of DB:** Screenshots of the Vercel/v0 Storage Configuration proving AWS Database usage.
4.  **Text Description:** Explaining features and explicitly naming the AWS Database used.

## 4. JUDGING CRITERIA (OPTIMIZE CODE FOR THESE)
* **Technological Implementation:** Does the project show real software craftsmanship? Is the AWS Database integrated with a deliberate data model/schema? Does the Vercel deployment go beyond basics? Clean, purposeful, intentional architecture.
* **Design:** Intuitive UX. Cohesive balance between frontend and backend reflecting full-stack thinking.
* **Impact & Real-world Applicability:** Solves a meaningful problem for a real audience. Viable and potentially shippable.
* **Originality:** Creative concept. Pushes the implementation forward.

## 5. DEVELOPER INSTRUCTIONS FOR THIS WORKSPACE
* **Strict Constraints:** NEVER suggest standing up a separate traditional backend server (like Django, Express, or a standalone Python server). All backend logic MUST be handled via Next.js API Routes/Server Actions communicating directly with AWS Aurora PostgreSQL and external APIs (e.g., GitHub Actions, LLM APIs).
* **Environment Variables:** Do NOT hardcode credentials. Always utilize `.env` variables (`DATABASE_URL`, `AWS_ACCESS_KEY_ID`, etc.) and Vercel's environment configuration.
* **Aesthetic:** The UI components must reflect a modern, minimalist, and "retro-corporate" blend suitable for B2B cybersecurity tools.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 0. BEHAVIORAL GUIDELINES (CRITICAL)
Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.
**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

**1. Think Before Coding**
* Don't assume. Don't hide confusion. Surface tradeoffs.
* Before implementing:
  * State your assumptions explicitly. If uncertain, ask.
  * If multiple interpretations exist, present them - don't pick silently.
  * If a simpler approach exists, say so. Push back when warranted.
  * If something is unclear, stop. Name what's confusing. Ask.

**2. Simplicity First**
* Minimum code that solves the problem. Nothing speculative.
* No features beyond what was asked.
* No abstractions for single-use code.
* No "flexibility" or "configurability" that wasn't requested.
* No error handling for impossible scenarios.
* If you write 200 lines and it could be 50, rewrite it.
* Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

**3. Surgical Changes**
* Touch only what you must. Clean up only your own mess.
* When editing existing code:
  * Don't "improve" adjacent code, comments, or formatting.
  * Don't refactor things that aren't broken.
  * Match existing style, even if you'd do it differently.
  * If you notice unrelated dead code, mention it - don't delete it.
* When your changes create orphans:
  * Remove imports/variables/functions that YOUR changes made unused.
  * Don't remove pre-existing dead code unless asked.
* The test: Every changed line should trace directly to the user's request.

**4. Goal-Driven Execution**
* Define success criteria. Loop until verified.
* Transform tasks into verifiable goals:
  * "Add validation" → "Write tests for invalid inputs, then make them pass"
  * "Fix the bug" → "Write a test that reproduces it, then make it pass"
  * "Refactor X" → "Ensure tests pass before and after"
* For multi-step tasks, state a brief plan:
  1. [Step] → verify: [check]
  2. [Step] → verify: [check]
  3. [Step] → verify: [check]
* Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
* These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

> 🚨 **END OF IMMUTABLE SECTION.** You may update the sections below (Project Context, Commands, Architecture, etc.) as the project evolves. 🚨

## Project Context

**Oculs.io** — AI-powered DAST/SAST micro-SaaS for developers. Built for the **H0: Hack the Zero Stack with Vercel v0 and AWS Databases** hackathon (Devpost, deadline: 2026-06-30, Track 2: Monetizable B2B App).

## Commands

```bash
npm run dev        # start development server (http://localhost:3000)
npm run build      # production build (also runs tsc type-check)
npm run lint       # ESLint across all files
npm run start      # serve production build locally
```

Database (once Drizzle is wired up):
```bash
npm run db:generate   # generate migration files from schema changes
npm run db:migrate    # apply pending migrations to Aurora
```

There is no test runner configured yet. Add Vitest when writing the first tests.

## Architecture

This is a **zero-backend** app: all server-side logic runs inside Next.js Route Handlers and React Server Components deployed to Vercel. There is no separate API server, Lambda, or container.

**Request path for the core scan loop:**
1. GitHub Actions runs SAST/DAST tools on a developer's repo.
2. It POSTs a JSON payload to `POST /api/webhook/scan`.
3. The route handler validates the HMAC-SHA256 signature (`GITHUB_WEBHOOK_SECRET`), calls Gemini AI for triage and auto-fix patch generation, then writes findings to AWS Aurora PostgreSQL.
4. The Next.js dashboard reads Aurora directly via React Server Components — no polling.

**Module responsibilities:**

| Path | Responsibility |
|---|---|
| `app/api/webhook/scan/route.ts` | Entry point for all GitHub Actions payloads |
| `lib/db/index.ts` | Aurora PostgreSQL client (postgres.js + Drizzle) |
| `lib/db/schema.ts` | Drizzle table definitions (projects, scans, findings, auto_fixes, users) |
| `lib/ai/index.ts` | Gemini agent: `analyzeFindings`, `generateAutoFix`, `generateReport` |
| `types/index.ts` | Canonical TypeScript interfaces shared across the entire app |
| `components/ui/` | Zero-dependency, minimalist UI primitives |

## Hard Constraints

- **No separate backend server.** Never introduce Express, Django, FastAPI, or standalone Node servers. All logic lives in Next.js Route Handlers or Server Actions.
- **AWS Aurora PostgreSQL is the only database.** No SQLite, no Supabase, no Neon. Connection string must include `sslmode=require`.
- **All environment variables** come from `.env.local` (dev) or Vercel Environment Variables (prod). See `.env.example` for the full list. Never hardcode credentials.
- **UI aesthetic:** minimalist, retro-corporate — suitable for a B2B security tool. Avoid colorful/playful component libraries.

## Key Conventions

- Path alias `@/*` maps to the repo root (e.g. `import { ScanFinding } from "@/types"`).
- TypeScript strict mode is on. All new code must type-check cleanly.
- `lib/ai/index.ts` should use `GEMINI_API_KEY` and `GEMINI_MODEL` env vars; default model: `gemini-1.5-pro`.
- Webhook HMAC validation must use `GITHUB_WEBHOOK_SECRET` and timing-safe comparison (`crypto.timingSafeEqual`).
- Aurora connection must handle serverless cold-start reconnection (use `max: 1` connections in edge/serverless context).
