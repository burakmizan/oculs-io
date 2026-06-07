# Contributing to Oculs.io

Thank you for your interest in contributing! Oculs.io is an open-source project and we welcome contributions of all kinds.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Workflow](#development-workflow)
- [Commit Message Convention](#commit-message-convention)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you agree to uphold these standards.

---

## Getting Started

### Prerequisites

- **Node.js** >= 20.x
- **npm** >= 10.x (or pnpm/yarn)
- An **AWS Aurora PostgreSQL** instance (or a local PostgreSQL 15+ for development)
- A **Google Gemini API key** (for AI features)

### Local Setup

```bash
# 1. Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/oculs-ip.git
cd oculs-ip

# 2. Install dependencies
npm install

# 3. Copy env example and fill in your values
cp .env.example .env.local

# 4. Run database migrations (once DB is configured)
npm run db:migrate

# 5. Start the development server
npm run dev
```

---

## How to Contribute

### Good First Issues

Look for issues tagged [`good first issue`](../../issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) — these are scoped to be approachable for new contributors.

### Areas of Contribution

| Area | Description |
|---|---|
| `components/ui/` | New minimalist UI components (zero external UI libraries preferred) |
| `lib/ai/` | Improved AI prompting, model switching, agentic logic |
| `lib/db/` | Schema improvements, query optimization |
| `app/api/` | New API route handlers |
| `docs/` | Architecture diagrams, tutorials, ADRs |
| Tests | Unit and integration tests (Vitest preferred) |

---

## Development Workflow

```
main          ← stable, protected
  └── dev     ← integration branch, PRs target this
        └── feat/your-feature-name
        └── fix/bug-description
        └── chore/task-name
```

1. Create your branch from `dev`.
2. Make focused, atomic commits.
3. Open a PR against `dev` (not `main`).

---

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]
[optional footer]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`

**Examples:**

```
feat(ai): add Gemini streaming for real-time scan analysis
fix(db): handle Aurora connection pool exhaustion
docs(readme): add AWS RDS IAM auth setup steps
```

---

## Pull Request Guidelines

- Keep PRs **small and focused** — one concern per PR.
- Reference the related issue: `Closes #123`.
- Ensure `npm run build` and `npm run lint` pass before opening.
- Add or update tests for any changed logic.
- Update `docs/` or inline comments if behavior changes.
- Do **not** commit `.env.local` or any real credentials.

---

## Reporting Bugs

Open an issue with the `bug` label. Include:

- Steps to reproduce
- Expected vs. actual behavior
- Node.js / npm versions
- Relevant `.env.example` variables you've set (no real values)
- Any console errors or stack traces

---

## Suggesting Features

Open an issue with the `enhancement` label. Describe:

- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

---

## Questions?

Open a [Discussion](../../discussions) or reach out via the issue tracker. We appreciate every contribution, big or small.
