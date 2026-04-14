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

*Created 2026-04-13. Update this file if responsibilities shift.*
