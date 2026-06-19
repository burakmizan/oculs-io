---
name: features-6-15-implementation
description: Features 6–15 implemented in batch — DB migration required for api_keys table
metadata:
  type: project
---

Features 6–15 were fully implemented. A DB migration is required for the new `api_keys` table.

**Why:** Added API key authentication (feature 12) which introduces a new `api_keys` table in the schema.

**How to apply:** After implementing, always remind the user to run `npm run db:generate && npm run db:migrate` to apply the new schema.

Key files added/changed:
- `lib/grade.ts` — shared grade computation (A+/A/B/C/D/F)
- `lib/db/schema.ts` — added `apiKeys` table
- `lib/db/queries.ts` — added 6 new query helpers
- `lib/notify.ts` — enriched Slack/Discord alerts with top findings
- `app/api/ask/route.ts` — contextual AI chat per finding (Gemini)
- `app/api/api-keys/route.ts` — API key CRUD
- `app/api/webhook/scan/route.ts` — added PR auto-comment (postPRComment)
- `app/api/scan/trigger/route.ts` — added Bearer API key auth
- `app/sc/[projectId]/page.tsx` — public Security Score Card page
- `app/dashboard/compare/page.tsx` — scan diff comparison page
- `components/dashboard/SecurityCardSnippet.tsx` — badge+card snippet
- `components/dashboard/VulnerabilityTimeline.tsx` — SVG bar chart
- `components/dashboard/OnboardingChecklist.tsx` — getting started checklist
- `components/dashboard/OnboardingChecklistWrapper.tsx` — server action bridge
- `components/dashboard/ExportButton.tsx` — CSV/JSON export
- `components/dashboard/ApiKeysSection.tsx` — API key management UI
- `components/dashboard/CompareScanSelectors.tsx` — client scan picker
