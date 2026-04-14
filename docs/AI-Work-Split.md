# AI Work Split

> [[Home]] > Plans & Process | See also: [[Production-Plan-AI1]], [[Production-Plan-AI2]], [[Tasks/Launch Readiness Plan|Launch Readiness Plan]]

Two AI agents work on this project simultaneously. To avoid conflicts (duplicate variables, merge issues, broken deploys), each AI owns specific files.

**Rule: never edit files owned by the other AI without explicit approval from the user.**

---

## AI 1 — Backend & Finance (Claude Code CLI)

### Owns
- `backend/index.js` — server, all API endpoints, payroll, audit, payments
- `backend/routes/` — route modules (після рефакторингу Phase 5.5)
- `backend/lib/` — shared helpers: telnyx, square, email, push, crypto (після рефакторингу Phase 5.5)
- `backend/jobs/` — background jobs (після рефакторингу Phase 5.5)
- `backend/package.json`, `backend/Dockerfile`
- `app/payroll/page.tsx` — payroll page
- `app/cash/page.tsx` — cash register
- `app/expenses/page.tsx` — expenses
- `app/calendar/booking-modal.tsx` — payment flow in booking modal
- `app/messages/page.tsx` — team messaging
- `.github/workflows/` — CI/CD, deploy pipelines
- `docs/` — documentation, DevLog, Features

### Responsibilities
- All backend API logic and endpoints
- Payroll calculations, audit system, notifications
- Payment processing (Square, cash, zelle)
- Cash register, expenses integration
- Cloud Run deployment and infrastructure
- Documentation updates after every session

---

## AI 2 — Frontend & UI (Claude Code Web/Desktop)

### Owns
- `app/settings/page.tsx` — settings page UI
- `app/settings/tabs/` — settings tab components (після рефакторингу Phase 5.2)
- `app/dashboard/page.tsx` — dashboard, widgets, onboarding
- `app/book/` — public booking pages
- `app/signin/page.tsx` — auth pages
- `app/signup/page.tsx` — signup flow (Stripe Elements, Apple IAP, step flow)
- `app/landing/`, `app/pricing/` — marketing pages
- `components/Shell.tsx` — navigation, layout, bottom nav
- `components/OnboardingWizard.tsx` — onboarding wizard
- `components/StyledDialog.tsx` — shared dialog component
- `lib/` — utilities, terminology, templates
- `app/globals.css` — global styles
- Landing and public-facing pages

### Responsibilities
- Settings UI and navigation patterns
- Dashboard widgets and layout
- Onboarding flow
- Public booking page styling
- Shell/navigation changes
- Global CSS and design system

---

## AI 3 — Verdent (Reviewer / Verifier / Research)

### Owns
- `docs/Tasks/QA-Scan-*.md` — QA scan reports
- `docs/Tasks/Launch-Verification-Runbook.md` / `Live-SMS-Verification-Checklist.md` / `Deploy-Smoke-Test.md` — verification runbooks
- External research support (carrier docs, legal, third-party integrations)

### Responsibilities
- Read-only review of backend and frontend changes from AI 1 / AI 2
- Writes QA findings and verification checklists, does not fix code
- Surfaces bugs and edge cases for AI 1 / AI 2 triage
- No parallel edits to owned backend (`backend/**`) or frontend (`app/**`, `components/**`) files
- Full role definition lives in [[Tasks/3-AI-Remaining-Work-Split]]

---

## AI 4 — Claude Opus project-review agent (claude.ai/code)

### Owns
- Nothing by default — read-only reviewer / doc pass operating on a dedicated review branch (`claude/review-project-*`)
- May write to `docs/**` (DevLog entries, summary docs) to record review findings and emergency patches

### Responsibilities
- Project-wide read-through of code + docs (`app/**`, `backend/**`, `components/**`, `lib/**`, `docs/**`) — large-context audit
- Records news and status updates into the relevant feature docs and DevLog (e.g. Telnyx campaign status updates, carrier review outcomes)
- Writes summaries and reports to the owner on demand (no direct action without explicit ask)
- Emergency hotfixes on explicit owner instruction only, even outside scope (e.g. Vercel build failure on a legal page owned by AI 2) — each such patch must be recorded in DevLog with an "ownership note" section so the exception does not erode the normal split
- Branches: operates on a review branch, not `main`; does not merge on its own
- Does not touch real secrets, Telnyx portal, GitHub Secrets, Stripe, Apple, or any third-party console — those remain Owner (Nazarii) scope

### Coordination
- Before patching any file owned by AI 1 or AI 2, must confirm with the owner that the patch should come from AI 4 and not be routed back to the file owner
- After an out-of-scope emergency patch, AI 4 must hand the ownership back to the original owner for follow-up work (e.g. AI 4 fixes a build break on `app/terms/page.tsx`, then any copy / behavior edits route back to AI 2)

---

## Shared files (coordinate before editing)
- `app/calendar/page.tsx` — large file, both may need to touch
- `components/Shell.tsx` — if backend needs badge/notification changes, coordinate
- `next.config.mjs` — rare changes, coordinate
- `vercel.json` — rare changes, coordinate

## How to coordinate
1. Before editing a shared file, check git log to see if the other AI recently changed it
2. Always `git pull --rebase` before pushing
3. If conflict: fix it, don't skip commits
4. After changes: update `docs/DevLog/YYYY-MM-DD.md`

---

## Documentation Rules (Obsidian)

We use Obsidian as the shared project brain. Every AI must write docs so both Obsidian and humans can follow the project without re-explaining context in chat.

### Required rules
- Re-read the relevant docs before changing code or plans
- Record every substantial change in `docs/DevLog/YYYY-MM-DD.md`
- Update the matching tracker doc when status changes:
  - `docs/Tasks/In Progress.md` for active work
  - feature docs under `docs/Features/` for product behavior
  - plan docs under `docs/Tasks/` for decisions, rollouts, and execution plans
- Use Obsidian wiki links `[[Like This]]` for internal references whenever the target doc already exists
- If you create a new important doc, add a link from `docs/Home.md` or the nearest parent doc so it does not become orphaned
- Do not create duplicate docs for the same topic if an existing doc can be updated instead
- Write concrete status, ownership, and dates; avoid vague notes like "fixed stuff" or "updated SMS"
- When a decision changes, update the old plan/tracker docs too so Obsidian does not show contradictory versions of reality

### Writing style
- Prefer short sections with clear headings over long chat-style paragraphs
- State who owns the work when multiple AI are involved
- Use exact names for files, routes, env vars, and commits when relevant
- Keep terminology consistent across docs (`toll-free-first`, `grandfathered manual 10DLC`, `Element Barbershop`, etc.)
- If something is blocked by an external dependency, say exactly what is blocked and who must unblock it

### Goal
- Any AI should be able to open Obsidian, read the linked docs, and understand:
  - what changed
  - what is still open
  - who owns the next step
  - which doc is the source of truth

---

*Created 2026-04-13. Update this file if responsibilities shift.*
