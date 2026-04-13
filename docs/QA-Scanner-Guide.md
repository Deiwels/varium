# QA Scanner Guide

> [[Home]] > Process | For: dedicated QA/bug-hunting AI sessions

## What this is

A separate AI chat session that ONLY searches for bugs. It does NOT fix code — it writes findings to docs for AI 1 and AI 2 to fix.

## Project context

**Varium (VuriumBook)** — multi-tenant SaaS booking platform for barbershops/salons.

### Tech stack
- **Frontend**: Next.js 15, React 19, TypeScript, inline styles (no Tailwind)
- **Backend**: Express.js, Google Cloud Firestore, single file `backend/index.js` (~10K lines)
- **Payments**: Stripe (subscriptions), Square (terminal), Apple IAP
- **SMS**: Telnyx
- **Deploy**: Vercel (frontend), Google Cloud Run (backend)
- **Auth**: JWT, Apple Sign In, Google Sign In

### Two AI agents work on this project simultaneously

| AI | Scope | Files |
|----|-------|-------|
| **AI 1** (Backend) | Server, API, payments, payroll, audit | `backend/index.js`, `.github/workflows/`, `app/payroll/`, `app/cash/`, `app/expenses/`, `app/messages/`, `app/calendar/booking-modal.tsx` |
| **AI 2** (Frontend) | UI, settings, booking page, dashboard, auth flow | `app/settings/`, `app/dashboard/`, `app/book/`, `app/billing/`, `app/signin/`, `components/Shell.tsx`, `lib/api.ts` |

See `docs/AI-Work-Split.md` for full ownership map.

## How to scan

### What to check
1. **Backend** (`backend/index.js`):
   - Syntax errors, undefined variables, duplicate declarations
   - Missing error handling (endpoints without try/catch)
   - Payment accuracy (cents vs dollars, tips, service amounts)
   - Webhook security (signature verification)
   - Auth/permissions (endpoints without role checks)
   - Firestore query efficiency (N+1, missing limits)
   - Memory leaks (in-memory Maps/Sets without cleanup)

2. **Frontend** (`app/**/*.tsx`, `components/*.tsx`):
   - API response format mismatches (backend returns X, frontend expects Y)
   - Silent `.catch(() => {})` that hide errors from users
   - Missing loading/error states
   - Mobile layout issues (hardcoded widths, tiny touch targets)
   - Timezone handling (UTC vs local)

3. **Integration** (frontend ↔ backend):
   - Field name mismatches (e.g., `payment_method` vs `method`)
   - Data flow: booking → payment → payroll → cash register
   - Auth token handling (expiry, refresh, redirect)

4. **Public booking flow** (`app/book/[id]/page.tsx`):
   - Can customer double-book?
   - What if slot becomes unavailable during form fill?
   - Phone/email validation
   - Price manipulation prevention

### What NOT to do
- Do NOT edit any code files
- Do NOT fix bugs — only document them
- Do NOT push commits with code changes
- Do NOT duplicate findings already in existing audit docs
- Skip cosmetic/styling issues — focus on functional bugs

## Where to write findings

### New bugs → `docs/Tasks/QA-Scan-YYYY-MM-DD.md`

Create a new file for each scan session. Format:

```markdown
# QA Scan — YYYY-MM-DD

> Scanner: [AI session ID or name]
> Files scanned: [list]
> Duration: [approximate]

## CRITICAL (breaks functionality)

### [BUG-001] Short title
- **File**: `path/to/file.tsx` line ~NNN
- **What**: Description of the bug
- **Impact**: What breaks for the user
- **Repro**: Steps to reproduce
- **Fix owner**: AI 1 or AI 2
- **Status**: NEW

## HIGH (wrong data or bad UX)

### [BUG-002] ...

## MEDIUM (edge cases)

### [BUG-003] ...

## Passed checks
- List of things that were checked and found OK
```

### Check existing audits first

Before writing new findings, read these to avoid duplicates:
- `docs/Tasks/Pre-Deploy Safety Audit.md` — already fixed bugs
- `docs/Tasks/Edge Case Bugs.md` — known edge cases
- `docs/Tasks/In Progress.md` — what AI 1 and AI 2 are working on
- `docs/Tasks/Launch Readiness Plan.md` — the full plan

### After writing findings

1. Commit only the docs file: `git add docs/Tasks/QA-Scan-*.md`
2. Push with message: `docs: QA scan YYYY-MM-DD — N issues found`
3. AI 1 and AI 2 will read the file and fix bugs in their scope

## Key files to scan

### Backend (AI 1 scope)
- `backend/index.js` — the entire API server
- `backend/package.json` — dependencies
- `backend/Dockerfile` — container build
- `.github/workflows/deploy-backend.yml` — CI/CD

### Frontend critical paths (AI 2 scope)
- `components/Shell.tsx` — auth, navigation, PIN overlay
- `app/book/[id]/page.tsx` — public booking (customer-facing)
- `app/calendar/page.tsx` — main daily tool for salon owners
- `app/dashboard/page.tsx` — first screen after login
- `app/settings/page.tsx` — business configuration
- `app/billing/page.tsx` — subscription management
- `lib/api.ts` — API client, token handling

### Shared / integration
- `app/calendar/booking-modal.tsx` — payment flow (AI 1)
- `app/payroll/page.tsx` — salary calculations (AI 1)
- `app/cash/page.tsx` — cash register (AI 1)

## Production URLs
- Frontend: https://vurium.com
- Backend API: https://vuriumbook-api-431945333485.us-central1.run.app
- Health check: GET /health
