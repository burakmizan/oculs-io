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

```bash
npm run db:generate   # generate migration files from schema changes
npm run db:migrate    # apply pending migrations to Aurora
npm run db:studio     # open Drizzle Studio GUI for the Aurora DB
```

There is no test runner configured yet. Add Vitest when writing the first tests.

## Architecture

This is a **zero-backend** app: all server-side logic runs inside Next.js Route Handlers and React Server Components deployed to Vercel. There is no separate API server, Lambda, or container.

**Auth split — critical pattern:**
Auth.js v5 requires two separate modules because the middleware runs on the Edge runtime (no Node APIs):
- `auth.config.ts` — edge-safe config: GitHub OAuth provider, route-protection `authorized()` callback, JWT session strategy, session/JWT callbacks. **No DB imports here.**
- `auth.ts` — Node-only: extends `authConfig` with the Drizzle adapter (persists OAuth accounts to Aurora) and the Credentials provider (bcrypt password auth).
- `proxy.ts` — Next.js 16's renamed `middleware.ts`. Instantiates `NextAuth(authConfig)` on the Edge to enforce `/dashboard/*` protection and redirect logged-in users away from `/login`.

**Request path for the core scan loop (partially implemented):**
1. User queues a scan via `createScan` server action (`app/dashboard/actions.ts`), which calls `queueScan()` in `lib/db/queries.ts` — upserts the project and inserts a `scans` row with `status: "queued"`.
2. *(Not yet implemented)* A GitHub Actions workflow POSTs results to `POST /api/webhook/scan`. The route handler will validate the HMAC-SHA256 signature, call the Gemini AI agent, and write `vulnerabilities` rows to Aurora.
3. The dashboard reads Aurora directly via React Server Components — no polling. The `getDashboardStats` query computes a weighted 0–100 risk score from open vulnerability severities.

**Module responsibilities:**

| Path | Responsibility |
|---|---|
| `proxy.ts` | Edge middleware — enforces `/dashboard` auth gate |
| `auth.config.ts` | Edge-safe Auth.js config (providers, callbacks, route protection) |
| `auth.ts` | Node-only Auth.js instance (Drizzle adapter + Credentials provider) |
| `app/login/actions.ts` | Server actions: `signInWithGitHub`, `signInWithCredentials`, `registerAccount` |
| `app/dashboard/actions.ts` | Server action: `createScan` — validates input, calls `queueScan` |
| `app/api/webhook/scan/route.ts` | **Stub** — entry point for GitHub Actions payloads (not yet implemented) |
| `lib/db/index.ts` | Aurora PostgreSQL client (postgres.js + Drizzle, `max: 1` for serverless) |
| `lib/db/schema.ts` | Drizzle schema: `users`, `accounts`, `sessions`, `verificationTokens`, `projects`, `scans`, `vulnerabilities` + 8 Postgres ENUMs |
| `lib/db/queries.ts` | Data-access helpers: auth lookups, dashboard stats, scan queuing |
| `lib/tools.ts` | 20-tool security catalog (`TOOLS`, `TOOLS_BY_ID`, `CATEGORY_META`); `id` values match the `scan_tool` Postgres ENUM exactly |
| `lib/ai/index.ts` | **Stub** — Gemini agent placeholders (`analyzeFindings`, `generateAutoFix`, `generateReport`) |
| `lib/auth/password.ts` | `hashPassword` / `verifyPassword` via bcryptjs (pure-JS, no native bindings) |
| `types/index.ts` | Re-exports Drizzle-inferred row types + enum string-literal unions + view models + `WebhookPayload` contract |
| `components/landing/` | Landing page sections (NavBar, Hero, Features, Pricing, etc.) |
| `components/dashboard/` | Dashboard UI: `Sidebar`, `ScanLauncher`, `RecentScans` |
| `components/auth/` | `AuthForm` — shared login/register form |

## Hard Constraints

- **No separate backend server.** Never introduce Express, Django, FastAPI, or standalone Node servers. All logic lives in Next.js Route Handlers or Server Actions.
- **AWS Aurora PostgreSQL is the only database.** No SQLite, no Supabase, no Neon. Connection string must include `sslmode=require`.
- **All environment variables** come from `.env.local` (dev) or Vercel Environment Variables (prod). See `.env.example` for the full list. Never hardcode credentials.
- **UI aesthetic:** minimalist, retro-corporate — suitable for a B2B security tool. Avoid colorful/playful component libraries.

## Key Conventions

- Path alias `@/*` maps to the repo root (e.g. `import { ScanTool } from "@/types"`).
- TypeScript strict mode is on. All new code must type-check cleanly.
- Row types come from Drizzle inference (`typeof table.$inferSelect`); never define manual interfaces that duplicate schema columns.
- Tool IDs in `lib/tools.ts` (`ScanTool` string literals) must stay in sync with the `scan_tool` Postgres ENUM in `lib/db/schema.ts`.
- `lib/ai/index.ts` must use `GEMINI_API_KEY` and `GEMINI_MODEL` env vars; default model: `gemini-3.5-flash`.
- Webhook HMAC validation must use `GITHUB_WEBHOOK_SECRET` and timing-safe comparison (`crypto.timingSafeEqual`).
- Aurora connection uses `max: 1, ssl: "require", idle_timeout: 20, max_lifetime: 300` — do not increase `max` in serverless context.
- Session augments `next-auth` `Session` type (declared in `auth.config.ts`) with `user.id: string` and `user.login?: string` (GitHub handle). Always read `session.user.id` (not `sub`) in server code.
