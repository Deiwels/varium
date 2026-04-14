# 3-AI Remaining Work Split

> [[Home]] > Tasks | Owner: AI 1 (docs) · Last updated: 2026-04-15
> Related: [[AI-Work-Split]], [[Tasks/In Progress|In Progress]], [[Tasks/Launch Readiness Plan|Launch Readiness Plan]], [[Production-Plan-AI1]], [[Production-Plan-AI2]]

---

## Purpose

Consolidates every open work item from `In Progress.md`, `Launch Readiness Plan.md`, `Production-Plan-AI1.md`, `Production-Plan-AI2.md`, and the `QA-Scan-*.md` files into one split across **3 AI agents + owner**. Replaces the older "AI 1 / AI 2" binary split for remaining work.

## Role definitions (agreed 2026-04-15)

| Role | Primary scope | Ownership rules |
|------|---------------|-----------------|
| **Claude / AI 1** | Backend (`backend/index.js`, `backend/jobs/`, `backend/routes/`, `backend/lib/`), CI/CD (`.github/workflows/`), all docs under `docs/` | Final code review + commit on backend work; owns docs/DevLog/In Progress/Feature docs updates; no frontend edits |
| **Codex / AI 2** | Frontend (`app/**`, `components/**`, `lib/**`, `app/globals.css`), public pages, Shell, booking page, settings page, signup page | Live browser verification; mobile testing; no backend edits |
| **Verdent** | Reviewer + verifier + research support; QA-Scan docs; Launch-verification checklists; external research (Telnyx / CPaaS / carrier rules) | No parallel edits to owned backend/frontend files without explicit handoff; owns `docs/Tasks/QA-Scan-*.md` and verification runbooks |
| **Owner (Nazarii)** | External unblockers: Telnyx/Jonathan, GitHub Secrets, App Store config, legal documents, 1Password migrations, live in-browser runs of test plans | Only one who can touch real workspace data, secrets, and Telnyx portal |

Full file ownership is still authoritative in [[AI-Work-Split]].

---

## What is already DONE (do not re-do)

### Backend (AI 1)
- ✅ P0.1 Stripe + Square + Stripe Connect webhook signature verification (HMAC-SHA256)
- ✅ P0.2 `spAmountCents` → `spServiceCents` fix (6 occurrences)
- ✅ P0.3 Cloud Run health check + rollback path
- ✅ P0.4 Billing verification matrix (Apple expiry check, Stripe Connect sig)
- ✅ P0.5 Auth audit + role checks on payments/square/stripe-connect endpoints
- ✅ P0.6 Payroll audit (7-check data integrity)
- ✅ P0.7 Server-side price verification
- ✅ P0.8 Booking idempotency (`idempotency_key`)
- ✅ P1.1 N+1 fix in Square webhook
- ✅ P1.2 Silent `.catch()` fix in payment chain
- ✅ P1.3 Firestore composite indexes
- ✅ P1.4 Webhook event logging to Firestore
- ✅ P2.1 API pagination (clients/payments/messages)
- ✅ P2.2 Rate limiting on public endpoints
- ✅ P2.3 Email retry queue (sendEmail 2 retries)
- ✅ P2.4 Production monitoring (`/health`)
- ✅ Telnyx Gap 2 — webhook signature verification helper (enforcing gated on `TELNYX_WEBHOOK_PUBLIC_KEY`)
- ✅ Telnyx Gap 3 — `phone_number_index` + O(1) inbound lookup + `collectionGroup('clients')` STOP propagation
- ✅ Telnyx Gap 4 — `runAutoReminders()` pagination
- ✅ Telnyx Gap 5 — `autoProvisionSmsOnActivation()` + retry job + wire-points
- ✅ PERM-003 — `requireCustomPerm()` middleware on `/api/payments`, Square/Stripe Connect status endpoints

### Frontend (AI 2)
- ✅ P0.12 Remove `alert()` / `confirm()` / `prompt()` across owned files
- ✅ P0.9 Settings mobile drill-down (local, browser verify still pending)
- ✅ Session expiry / stale-login black-screen fix in `Shell.tsx`
- ✅ PIN overlay "Use password instead" escape
- ✅ Guest role added to frontend `DEFAULT_PERMS`
- ✅ SMS UX reframe around auto-activation (Settings + signup)
- ✅ Consent metadata (`sms_consent_text`, `sms_consent_text_version`) on bookings
- ✅ Booking CTA uses `{shopName} Appointment Notifications`
- ✅ Legal pages aligned with dual-path SMS model
- ✅ Mobile usability passes for Billing, Permissions, Team Accounts, Taxes & Fees, Payroll defaults, SMS registration
- ✅ Route-level metadata (Open Graph) for about/contact/faq/support/vuriumbook/blog/book
- ✅ Public booking helper text, empty states, draft persistence, timezone label
- ✅ Dashboard timezone, launch checklist, setup banner
- ✅ Clients/Payments sort + bulk delete

---

## AI 1 — Claude (Backend + Docs) — OPEN

### P0 — launch / security critical

| ID | Item | Blocker | File | Effort |
|----|------|---------|------|--------|
| **CQ.1** | Purge `docs/Telnyx/twilio_2FA_recovery_code.txt` from git history via `git filter-repo`, after owner invalidates the code in Twilio console | Owner must invalidate code first | git history | S |
| **CQ.2** | Remove demo credentials (`applereview@vurium.com / ReviewTest2026!`) from `docs/APPLE_REVIEW_CHECKLIST.md`; replace with `[stored in 1Password → Apple Review]` | Owner must save to 1Password first | `docs/APPLE_REVIEW_CHECKLIST.md` | S |

### P1 — high-value non-blocking

| ID | Item | File | Effort |
|----|------|------|--------|
| **BE.1** | Distributed lock for background jobs (Firestore TTL lock) — prevent `runAutoReminders`, `runBookingAudit`, `runPayrollAudit`, `runSmsAutoProvisionRetry` duplication when Cloud Run scales horizontally | `backend/index.js` | M |
| **BE.2** | Gmail API integration for Developer Panel — OAuth wiring, inbox read, send endpoints (frontend already exists under `app/developer/email/`) | `backend/index.js` | M |
| **BE.3** | Live SMS Verification Test Plan — step-by-step runbook that the owner executes after Cloud Run deploy to confirm Gap 5 auto-activation, Element legacy untouched, STOP routing via `phone_number_index`, email-only fallback | `docs/Tasks/Live-SMS-Verification-Checklist.md` (new) | S |
| **BE.4** | Reactions endpoint `PATCH /api/messages/:id/reactions` — backend currently returns 404; frontend long-press reactions already exist. Toggle via `FieldValue.arrayUnion` / `arrayRemove` | `backend/index.js` | S |
| **BE.5** | Bug cleanup from `QA-Scan-2026-04-13.md`: <br/> • BUG-002 `/api/push/status` pre-auth middleware (info disclosure) <br/> • BUG-003 `_wsPushPrefsCache` cross-tenant cache leak <br/> • BUG-005 `forgot-password` / `login-email` O(N) workspace scan <br/> • BUG-006 Square webhook merchant_id lookup still N+1 <br/> • BUG-008 GDPR export uses undefined `req.userId` (should be `req.user.uid`) <br/> • BUG-009 Square reconciliation fuzzy match references nonexistent `date` field <br/> • BUG-010 Owner delete doesn't clean up `slugs` collection <br/> • BUG-012 `runAutoReminders` cap 100 (already fixed via Gap 4) <br/> • BUG-013 Stripe webhook placement (verify route is actually before `/api` auth middleware — re-check) <br/> • BUG-014 Push token dedup uses undefined `req.workspaceId` (should be `req.wsId`) | `backend/index.js` | M |

### P2 — after core launch

| ID | Item | File | Effort |
|----|------|------|--------|
| **BE.6** | Replace plaintext `phone_norm` with HMAC-SHA256 blind index (`PHONE_INDEX_SECRET` env var) + one-time migration script | `backend/index.js` | L |
| **BE.7** | Refactor `backend/index.js` (~10.9K lines) into `backend/routes/`, `backend/lib/`, `backend/jobs/` modules without logic changes. Update `AI-Work-Split` ownership after split | `backend/**` | XL |

### P3 — housekeeping

| ID | Item | File | Effort |
|----|------|------|--------|
| **BE.8** | Migrate legacy SMS statuses → convert Firestore records → delete `LEGACY_SMS_STATUSES` Set | `backend/index.js` + migration script | M |
| **BE.9** | Custom HTML sanitization hardening — move from regex-based to DOMPurify-equivalent server-side parser for `custom_html` / `custom_css` (defense-in-depth, custom-plan-only surface) | `backend/index.js` + frontend renderer | M |

### Blocked (external)

| ID | Item | Blocked on |
|----|------|-----------|
| **OPS.1** | `TELNYX_VERIFY_PROFILE_ID` — Telnyx Verify Profile creation + GitHub secret | Telnyx account `whitelisted_destinations` issue (Jonathan call) |
| **OPS.2** | Platform-Sender-Pivot-Plan.md — write only if Jonathan confirms shared-sender is compliant | Jonathan reply |

---

## AI 2 — Codex (Frontend) — OPEN

### P0 — launch verification (not code — live browser testing)

| ID | Item | Effort |
|----|------|--------|
| **FE.1** | P0.9 Settings mobile drill-down — live iPhone verification: open `/settings`, enter every category, back-out navigation, nothing hidden below fold | S |
| **FE.2** | P0.10 Settings save/load parity — toggle booking/display settings, refresh, confirm values render and public booking reflects them | S |
| **FE.3** | P0.11 Full customer path audit — first-run owner journey from signup → onboarding → dashboard → booking link without dead ends | M |
| **FE.4** | P0.13 Role-based visibility verification — login as owner/admin/barber/student/guest, confirm hidden screens stay hidden, restricted settings blocked | M |
| **FE.5** | P0.14 Mobile usability on `/settings`, `/dashboard`, `/book/[id]`, `/manage-booking`, `/billing`, `/signin`, `/signup` at 375px width | M |
| **FE.6** | P0.15 Timezone indicator on booking page — verify booking step 2 and summary show timezone label | S |
| **FE.7** | P0.16 Form data persistence on booking page — fill form, go back, force unavailable slot, confirm client data still there | S |
| **FE.8** | P0.17 Calendar mobile layout — pan team columns at 375px, create/edit booking without layout breakage | M |

### P1 — polish verification

| ID | Item | Effort |
|----|------|--------|
| **FE.9** | P1.5 Button disabled states — verify on live booking flow | S |
| **FE.10** | P1.6 Dashboard timezone — manual verify widgets after refresh | S |
| **FE.11** | P1.7 Dashboard clarity — complete checklist + finish-setup flow | S |
| **FE.12** | P1.8 Booking UX polish — complete helper text + empty states | S |
| **FE.13** | P1.9 Billing messaging — Apple vs web paths end-to-end | S |
| **FE.14** | P1.10 Empty states / loading copy — final sweep | S |

### P0 perm fixes (from QA Scan 2026-04-13)

| ID | Item | File | Effort |
|----|------|------|--------|
| **FE.15** | **PERM-001** — Render `visibleNav` properly. Currently `visibleNav` is computed in `Shell.tsx` but never rendered in JSX; only the hardcoded 5-item pill bar is visible. No way to navigate to Payments/Clients/Waitlist/Portfolio/Attendance/Cash/Membership/Analytics/Expenses from the UI | `components/Shell.tsx` | M |
| **FE.16** | **PERM-002** — Dashboard tool shortcuts have a hardcoded `if (isBarber && [...].includes(item.label))` filter at `app/dashboard/page.tsx:668` that ignores `hasPerm()`. Even with perms enabled, barbers never see Clients/Payments/Cash/Membership | `app/dashboard/page.tsx` | S |
| **FE.17** | **PERM-004** — Payments page uses `isOwner = user?.role === 'owner'` instead of `hasPerm()`. Does not import or use `usePermissions()` at all | `app/payments/page.tsx` | S |
| **FE.18** | **BUG-004** — Frontend password validation allows min 4 chars in `Shell.tsx:236` but backend requires min 8; placeholder says "Min 8 chars". Confusing UX when backend rejects | `components/Shell.tsx` | S |
| **FE.19** | **BUG-007** — ProfileModal `password` tab is unreachable — tab selector only renders `['profile']`, password change UI exists but no navigation to it | `components/Shell.tsx` | S |

### P1 — code quality

| ID | Item | File | Effort |
|----|------|------|--------|
| **FE.20** | 5.1 Remove `localStorage.getItem('VURIUMBOOK_TOKEN')` from `lib/api.ts`; keep only `credentials: 'include'` (httpOnly cookie). XSS defense. Coordinate with AI 1 first — backend must accept cookies on all paths | `lib/api.ts` | S |

### P2 — polish / refactor

| ID | Item | File | Effort |
|----|------|------|--------|
| **FE.21** | P2.5 Marketing pages polish — final sweep of `/`, `/vuriumbook`, `/about`, `/faq`, `/support` for unsupported claims | `app/**` | M |
| **FE.22** | P2.6 Table sorting — final verification on Clients + Payments | `app/clients/page.tsx`, `app/payments/page.tsx` | S |
| **FE.23** | P2.7 Bulk actions verification | `app/clients/page.tsx` | S |
| **FE.24** | P2.8 Open Graph tags — final sweep | `app/**/layout.tsx` | S |
| **FE.25** | 5.2 Split `app/settings/page.tsx` (2.6K lines) into `app/settings/tabs/*` components | `app/settings/**` | L |
| **FE.26** | 5.3 Replace inline style constants (`inp`, `card`, `lbl`) with `app/settings/styles.ts` or className | `app/settings/page.tsx` | M |
| **FE.27** | BUG-011 `api()` helper in `app/book/[id]/page.tsx` silently swallows HTTP errors — align with `apiFetch` throw-on-error pattern | `app/book/[id]/page.tsx` | S |
| **FE.28** | BUG-016/017 Custom HTML render hardening — frontend side of DOMPurify adoption | `app/book/[id]/page.tsx`, `app/dashboard/page.tsx` | M |

---

## Verdent — Reviewer / Verifier / Research — OPEN

### Reviewer tasks (post-commit diff sanity checks)

| ID | Item | Trigger |
|----|------|---------|
| **VR.1** | Review AI 1's next backend commit (whichever lands next) for: logic correctness, security regressions, Firestore query efficiency, audit log coverage, ownership boundary respect | Every backend commit |
| **VR.2** | Review AI 2's next frontend commit for: API contract alignment with backend, mobile layout regressions, accessibility basics, copy consistency | Every frontend commit |
| **VR.3** | Cross-check `docs/` for outdated / contradictory statements after major decisions land (e.g., when Jonathan replies, when platform-sender pivot happens, when Gap 1 unblocks) | Decision events |

### Verification runbook owner

| ID | Item | Output |
|----|------|--------|
| **VR.4** | Build a complete **Live Verification Checklist** doc that walks through launch-critical flows after every deploy: signup → onboarding → booking → SMS → payment → payroll → settings → billing → public pages. Generic, re-runnable. Owner can follow it after each push | `docs/Tasks/Launch-Verification-Runbook.md` (new) |
| **VR.5** | Build a **Deploy Smoke Test** doc — quick 10-minute post-deploy check that hits the health endpoint, signs in as demo account, creates a test booking, verifies Cloud Run logs for no startup errors | `docs/Tasks/Deploy-Smoke-Test.md` (new) |
| **VR.6** | Own all `docs/Tasks/QA-Scan-YYYY-MM-DD.md` files going forward per [[QA-Scanner-Guide]]. Fresh full-codebase scan every 3-5 days, or after any big landing | `docs/Tasks/QA-Scan-*.md` |

### External research

| ID | Item | Trigger |
|----|------|---------|
| **VR.7** | Telnyx TFV submission research — when Jonathan replies positively about shared-sender, research the exact TFV submission checklist, sample message wording that passed similar ISV reviews, expected review timeline | After Jonathan reply |
| **VR.8** | Monitor CPaaS alternatives (Bandwidth, Sinch, Telesign, Plivo) pricing and ISV policy — inform the platform-sender pivot or country-aware SMS plans if we expand | Quarterly / as needed |
| **VR.9** | Verify Apple App Store review checklist against current state — flag any gaps before next submission | Before each App Store submission |

### Explicit NON-tasks for Verdent

- ❌ No edits to `backend/index.js` without explicit handoff from AI 1
- ❌ No edits to `app/settings/page.tsx`, `app/signup/page.tsx`, `components/Shell.tsx`, `app/dashboard/page.tsx`, `app/book/[id]/page.tsx`, `lib/api.ts` — AI 2 scope
- ❌ No parallel implementation tracks for items already in AI 1/AI 2 queues

---

## Owner (Nazarii) — External unblockers

### Launch-critical

| ID | Item | Effort |
|----|------|--------|
| ~~**OW.1**~~ | ~~Add `TELNYX_WEBHOOK_PUBLIC_KEY` to GitHub Secrets~~ — ✅ **DONE** (confirmed in `docs/Architecture/GitHub Secrets Inventory.md` 2026-04-14). Next deploy flips Gap 2 from no-op to enforcing. | — |
| **OW.1b** | Confirm `TELNYX_VERIFY_PROFILE_ID` is actually present in GitHub Secrets — **not visible** in the 2026-04-14 snapshot. Either re-confirm or recreate | 5 min |
| **OW.2** | Send draft Jonathan inquiry letter from `docs/Tasks/Platform-Sender-Pivot-Decision.md` to `10dlcquestions@telnyx.com` or Jonathan directly | 10 min |
| **OW.3** | Execute AI 1's Live-SMS-Verification-Checklist after next Cloud Run deploy | 30 min |
| **OW.4** | Execute Verdent's Launch-Verification-Runbook + Deploy-Smoke-Test after next deploy | 20 min |

### Telnyx operational

| ID | Item | Effort |
|----|------|--------|
| **OW.5** | Resolve `whitelisted_destinations` blocker on Telnyx Voice Profile during Jonathan call | Call-dependent |
| **OW.6** | Verify Vurium Inc. brand on Telnyx (send CP-575A + Articles of Incorporation) to `10dlcquestions@telnyx.com` | 15 min |
| **OW.7** | Reply to 10dlcquestions about deleted brand BQY3UXK | 5 min |
| **OW.8** | Wait for TFN +1-877-590-2138 verification | External |
| **OW.9** | Create CUSTOMER_CARE campaign after brand verified | 10 min post-verification |

### Security housekeeping

| ID | Item | Effort |
|----|------|--------|
| **OW.10** | Invalidate Twilio recovery code `RFXT548Z41JF65BU1AD1V8AL` in Twilio console (then AI 1 purges from git history) | 2 min |
| **OW.11** | Save `applereview@vurium.com / ReviewTest2026!` to 1Password → Apple Review entry (then AI 1 removes from docs) | 5 min |

### Business

| ID | Item | Effort |
|----|------|--------|
| **OW.12** | Vurium Inc. — file first annual report before April deadline + franchise tax | 30 min |

---

## Recommended execution order

### Sprint 1 (now — next 1-2 days)

**AI 1 does in parallel:**
1. BE.3 — Live-SMS-Verification-Checklist doc (small, enables OW.3)
2. BE.5 — QA Scan 2026-04-13 bug cleanup batch (one commit per bug group: auth/perm fixes, data integrity fixes, N+1 fixes)
3. BE.4 — Reactions endpoint (small, unlocks frontend UI that already exists)

**AI 2 does in parallel:**
4. FE.1 → FE.8 — P0 launch verification passes (live browser testing on iPhone / responsive)
5. FE.15 → FE.19 — PERM + BUG fixes from QA Scan (small code patches)

**Verdent does in parallel:**
6. VR.4 — Launch-Verification-Runbook doc
7. VR.5 — Deploy-Smoke-Test doc
8. VR.6 — New QA-Scan-YYYY-MM-DD.md after Sprint 1 commits land

**Owner does in parallel:**
9. OW.1 — `TELNYX_WEBHOOK_PUBLIC_KEY` secret (5 min, unblocks Gap 2 enforcement)
10. OW.2 — Send Jonathan letter (10 min, unblocks Platform-Sender-Pivot-Plan)
11. OW.10 + OW.11 — Security housekeeping (unblocks BE's CQ.1 + CQ.2)

### Sprint 2 (after Sprint 1 green)

- AI 1: CQ.1 + CQ.2 (purge sensitive data) after owner unblocks, then BE.1 (distributed lock), then BE.2 (Gmail API)
- AI 2: FE.9 → FE.14 polish verification, FE.20 (httpOnly cookie coordination)
- Verdent: Review Sprint 1 commits, run fresh QA scan
- Owner: OW.3 + OW.4 live verification runs, OW.5 Telnyx call

### Sprint 3 (post-launch backlog)

- AI 1: BE.6 (phone_norm HMAC), BE.7 (backend refactor), BE.8 (legacy SMS cleanup), BE.9 (custom HTML sanitizer)
- AI 2: FE.21-FE.28 polish + refactor (settings tabs, inline styles, marketing polish)
- Verdent: Continuous review + research
- Owner: OW.12 business housekeeping, platform-sender pivot execution if Jonathan greenlights

---

## Coordination rules

1. **Before editing a file in your own scope** — `git pull --rebase` to absorb any other AI's changes
2. **Before editing a file in another AI's scope** — stop, flag it in this doc, wait for handoff
3. **After committing** — Verdent performs VR.1 or VR.2 post-commit review
4. **After any decision change** — AI 1 updates `In Progress.md` + this doc + `Home.md`
5. **All docs changes** — AI 1 owns write access; AI 2 and Verdent may propose updates via chat, AI 1 lands them
6. **External secrets / Telnyx / App Store / legal** — never touched by any AI; owner-only

---

## Metrics — how we know we are ready to sell

1. ✅ All P0 backend items committed and deployed to Cloud Run — **DONE**
2. ✅ All P0 frontend items committed — **DONE** (verification pending)
3. ⏳ FE.1 → FE.8 live verification complete
4. ⏳ OW.3 live SMS verification complete
5. ⏳ VR.4 Launch-Verification-Runbook executed cleanly at least once
6. ⏳ OW.1 `TELNYX_WEBHOOK_PUBLIC_KEY` secret in place (Gap 2 enforcing)
7. ⏳ Zero `NEW` / `IN PROGRESS` items in the latest `QA-Scan-*.md` file
8. 🔴 Gmail API integration (BE.2) — not launch-blocking but explicit TODO
9. 🔴 OPS.1 `TELNYX_VERIFY_PROFILE_ID` — not launch-blocking (fallback works), but needed for clean OTP UX

Launch goes on green for items 1-7. Items 8-9 are post-launch cleanup.
