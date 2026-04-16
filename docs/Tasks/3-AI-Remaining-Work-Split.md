# 11-AI Remaining Work Split

> [[Home]] > Tasks | Owner: AI 1 (docs) · Last full verification: **2026-04-15** (this pass)
> ⚠️ **Read [[AI-Rule-Updates]] and [[AI-Core-Manifesto]] first before starting any work.**
> ⛔ **Before touching any item in this file, add a current-session entry to [[AI-Session-Acceptance-Log]].**
> 🧠 **If a task needs planning, it must enter `In Progress.md` as `@AI3 [PLAN REQUEST]` and stay blocked until the 4-AI Plan Review Gate is complete.**
> 📥 **AI 4 reviews that live only in GitHub do not count until the real review doc is synced locally into `docs/Tasks/`.**
> 🔎 **AI 5 (GPT Chat Deep Research) is the external-facts lane. Use it before large work that depends on vendor/compliance/policy truth.**
> 📝 **When AI 5 is needed, create one shared `docs/Tasks/AI5-Research-Brief-<slug>.md` file, let all relevant AI add questions there, then let AI 5 answer in that same file before AI 3 plans.**
> Related: [[AI-Profiles/README|AI Profiles]], [[AI-Work-Split]], [[Tasks/In Progress|In Progress]], [[Tasks/Launch Readiness Plan|Launch Readiness Plan]], [[Production-Plan-AI1]], [[Production-Plan-AI2]], [[AI-Session-Acceptance-Log]]

---

## How this doc is maintained

This file is the **authoritative** split for what is open across the project. Every item was verified directly against the live `main` tree on 2026-04-15 — grep, read, or endpoint hit — not just copied from older plans. If something here conflicts with `In Progress.md`, `Production-Plan-AI1.md`, `Production-Plan-AI2.md`, or any of the improvement plans, this file wins.

## Roles (updated — 11 AI system)

| Role | Primary scope | Ownership rules |
|------|---------------|-----------------|
| **Claude / AI 1** | Backend (`backend/index.js`), CI/CD workflows, all docs under `docs/` | Final code review + commit on backend work; owns docs updates; no frontend edits |
| **Codex / AI 2** | Frontend (`app/**`, `components/**`, `lib/**`, `app/globals.css`) | Live browser verification; mobile testing; no backend edits |
| **Verdent / AI 3** | Planner + Verifier + QA | Складає детальні плани, перевіряє виконання, веде QA Scans та Runbooks. Не пише продуктовий код без погодженого плану. |
| **Phone AI / AI 4** | Universal Quick-Fixer | Повний доступ до всього коду — тільки для термінових emergency фіксів коли система падає або інші AI застрягли. GitHub-side reviews count only after the real review doc is synced locally. |
| **GPT Chat Deep Research / AI 5** | External research lane | Дає точну зовнішню інформацію: vendor docs, telecom/compliance constraints, policy interpretation, market comparisons. Не планує і не комітить код — підживлює AI 3 / AI 1 / AI 2 фактами. |
| **Product Strategist / AI 6** | Product framing lane | Формулює user problem, MVP, scope boundaries, out-of-scope, priority, and whether AI 5 research is required before planning. Не комітить код. |
| **Compliance Executor / AI 7** | Compliance translation lane | Перетворює AI 5 findings у системні, UI, backend, monitoring, documentation, and Owner-action requirements. Не комітить код. |
| **Growth / Marketing Operator / AI 8** | Growth lane | Веде funnel, onboarding, landing pages, conversion ideas, and launch messaging. Будь-які product-impacting зміни маршрутизуються назад у AI 6 → AI 3 flow. |
| **Support / Email Agent / AI 9** | Customer communication lane | Веде support replies, lead follow-ups, FAQ growth, and customer communication docs. Не invent-ить product/compliance truth; ескалює risky cases. |
| **Video Agent / AI 10** | Video execution lane | Робить promo/demo/ad video briefs, scripts, scene breakdowns, and motion-content execution under AI 8 direction. |
| **Creative / Ad Image Agent / AI 11** | Static creative lane | Робить ad creatives, social visuals, landing-page visuals, and creative variants under AI 8 direction. |
| **Owner (Nazarii)** | Telnyx portal, GitHub Secrets, Google Cloud Console, App Store Connect, legal, live runbook execution | Only one who can touch real secrets and third-party accounts |

Full file ownership is in [[AI-Work-Split]]. Core rules in [[AI-Core-Manifesto]].
Detailed working profiles live in [[AI-Profiles/README|AI Profiles]].

## Strategic lanes now available even when they are not active code lanes

- **AI 6** is the first stop when a new feature or product direction is unclear.
- **AI 7** becomes mandatory after AI 5 whenever compliance/vendor truth must be translated into implementation constraints.
- **AI 8** owns growth thinking, onboarding friction, positioning, and landing-page strategy, but routes implementation-impacting work back through the normal planning flow.
- **AI 9** owns customer communication execution, FAQ growth, and support follow-up inside approved product/compliance truth.
- **AI 10** owns video execution, not strategy.
- **AI 11** owns static creative execution, not product truth.
- These six non-engineering lanes reduce Owner bottleneck; they do not bypass AI 3 planning or AI 1 / AI 2 implementation ownership.

---

## ✅ What is already DONE (do not re-do)

### Backend (AI 1) — verified in `backend/index.js` 2026-04-15

**Launch readiness P0:**
- ✅ P0.1–P0.8 — Stripe/Square/Stripe Connect webhook signature verification, `spAmountCents` → `spServiceCents` fix, Cloud Run health + rollback, billing matrix (Apple expiry check), auth audit, payroll data integrity, server-side price verification, booking idempotency
- ✅ P1.1–P1.4 — Square webhook N+1 on merchant_id, silent `.catch()` fixes, Firestore composite indexes, webhook event logging
- ✅ P2.1–P2.4 — API pagination (clients/payments/messages), public-endpoint rate limiter, email retry queue, `/health` production monitoring

**Telnyx Integration Plan Gaps (commits `3efce7e`, `849e998`, `e8aa2ec`, `e97efd9`, `a3c885f`):**
- ✅ **Gap 2** — `verifyTelnyxWebhookSignature()` Ed25519 helper + wiring in both Telnyx webhooks. Currently **enforcing** on production (owner added `TELNYX_WEBHOOK_PUBLIC_KEY` to GitHub Secrets per `GitHub Secrets Inventory.md`).
- ✅ **Gap 3** — `phone_number_index` Firestore collection with writes from both toll-free and 10DLC provisioning paths; inbound webhook uses O(1) lookup + `collectionGroup('clients')` for STOP propagation.
- ✅ **Gap 4** — `runAutoReminders()` paginated via `startAfter(lastDoc)`, no workspace cap.
- ✅ **Gap 5** — `autoProvisionSmsOnActivation()` helper with legacy/protected/in-flight/max-retries guards, exponential backoff, audit log; wired into `/auth/signup`, `handleStripeEvent`, `/api/billing/apple-verify`; `runSmsAutoProvisionRetry()` background job.

**BUG-013 launch blocker (commit `849e998`):**
- ✅ `isWebhookEndpoint()` helper short-circuits global `express.json()`, CSRF middleware, and `/api` auth middleware for `/api/stripe/webhook`, `/api/webhooks/stripe-connect`, `/api/webhooks/apple`. Stripe HMAC, Apple JWS, and Stripe Connect webhooks actually reach their signature verifiers now.
- ✅ BUG-002 — `/api/push/status` gated behind `requireSuperadmin` (info disclosure closed).
- ✅ BUG-014 + NEW-002 — `req.workspaceId` → `req.wsId` in push register dedup and Apple IAP Gap 5 trigger (both were silently undefined).
- ✅ BUG-003 — `_wsPushPrefsCache` now `Map<wsId, {prefs, ts}>` with LRU bound (cross-tenant leak closed).
- ✅ BUG-008 — GDPR `/api/data-export` reads `req.user.uid` instead of undefined `req.userId`.
- ✅ BUG-009 — Square reconciliation fuzzy match uses `start_at` range instead of the nonexistent `date` field.
- ✅ BUG-010 — Owner delete-account now cleans up top-level `slugs` and `phone_number_index` entries.
- ✅ SET-001–SET-007 — `/public/config/:wsId` allowlist returns `display`, `booking`, `online_booking_enabled`, `business_type`, `shop_address`, `shop_phone`, `shop_email`, sanitized `tax`, `fees`, `charges`. `waitlist_enabled` now uses conditional spread so undefined falls through to `/public/resolve` plan feature (fixed in `a3c885f` after regression reported).
- ✅ NEW-001 — `docs/Features/SMS & 10DLC.md` implementation row updated to reflect Gap 5 auto-provision as live.

**BE.3 / BE.4:**
- ✅ **BE.3** Live-SMS-Verification-Checklist doc (`docs/Tasks/Live-SMS-Verification-Checklist.md`, 10 scenarios) — committed `3b9a27e`.
- ✅ **BE.4** `PATCH /api/messages/:id/reactions` — Firestore transaction + 6-emoji allowlist — committed `e8aa2ec` at backend line ~6336.

**BE.2 Gmail API integration — ⚠️ was wrongly listed as open:**
- ✅ **FULLY IMPLEMENTED AND DEPLOYED.** `backend/index.js` lines ~2754–3040 ship 6 endpoints behind `requireSuperadmin`:
  `GET /api/vurium-dev/gmail/auth`, `GET /callback`, `GET /status`, `GET /messages`, `GET /messages/:id`, `POST /send`, `POST /reply`
- ✅ OAuth client + Firestore `vurium_config/gmail_tokens` storage + auto-refresh + MIME multipart builder
- ✅ Frontend `app/developer/email/page.tsx` already calls all 6 endpoints at lines 58/79/103/116/136/176
- ✅ `GMAIL_CLIENT_ID` + `GMAIL_CLIENT_SECRET` wired in `.github/workflows/deploy-backend.yml` and confirmed in `docs/Architecture/GitHub Secrets Inventory.md`
- **What remains is owner-operational, not engineering** — see OW-Gmail below

**Element Barbershop 10DLC remediation (commit `e97efd9`):**
- ✅ `getWorkspaceBookingUrl()` helper in `backend/index.js`; `/api/sms/register` and `/api/sms/verify-otp` `messageFlow` now use the exact per-workspace URL, not generic `/book/`
- ✅ `/public/config/:wsId` allowlist exposes `shop_address`, `shop_phone`, `shop_email` for the public booking page rendering
- ✅ `docs/Tasks/Element-10DLC-Resubmission-Checklist.md` runbook for owner
- ✅ Campaign `CICHCOJ` resubmitted successfully; current state is `Telnyx Approved` -> `Pending MNO Review`

**PERM-003 (commits `a80d9da`, `f0de2e0`, `97be886`):**
- ✅ `requireCustomPerm(permKey)` middleware reads `role_permissions` from Firestore settings; wired on `/api/payments`, `/api/square/oauth/status`, `/api/stripe-connect/status`
- ✅ Guest role defaults added to frontend `PermissionsProvider.DEFAULT_PERMS`; dot-notation nested lookup bug fixed

### Frontend (AI 2) — verified 2026-04-15

**Permission system (Codex commit `074ddd2` + `f94cd12` build fix):**
- ✅ **PERM-001** — `Shell.tsx` bottom pill nav now renders `visibleNav` instead of a fixed 5-item list (line 1079 `{visibleNav.map(...)}`). Horizontally scrollable on narrow screens.
- ✅ **PERM-002** — Dashboard no longer has a hardcoded `isBarber && [...].includes(item.label)` filter. All role-based visibility now goes through `hasPerm()`.
- ✅ **PERM-004** — `app/payments/page.tsx` imports `usePermissions` and uses `hasPerm('pages', 'payments')` instead of hardcoded `isOwner`.
- ✅ **BUG-004** — `components/Shell.tsx:254` enforces `newPw.length < 8` (was `< 4`).
- ✅ **BUG-007** — ProfileModal password tab is now reachable via typed `profileTabs` array (`Shell.tsx:316, 330`). `f94cd12` fixed the TypeScript regression from the initial attempt.

**Element remediation frontend (Codex commits `dbc8dfa`, `b74c79b`, `bed4537`, `8f7bec3`):**
- ✅ `Business details` section (address/phone/email) rendered on `/book/[id]` public landing
- ✅ `Services` preview grid above booking flow
- ✅ SMS consent copy + Terms/Privacy links rendered on first paint (not deferred until phone input)
- ✅ Multiple Vercel build hotfixes for this line of work
- ✅ Live Element verification pass completed before resubmission; branded business proof and booking CTA survived hydration and mobile checks

**Launch readiness P0 frontend already in place:**
- ✅ P0.9 Settings mobile drill-down (code local; live browser verification still pending)
- ✅ P0.12 Removed `alert()` / `confirm()` / `prompt()` across settings, billing, signin, Shell
- ✅ Session-expiry black-screen fix + auth redirect loop guard in Shell
- ✅ PIN overlay `Use password instead` escape
- ✅ Settings role-safe fallback rendering when current tab is not visible for role
- ✅ Mobile usability passes on Billing, Permissions, Team Accounts, Taxes & Fees, Payroll defaults, SMS registration, Calendar, Public booking
- ✅ Route-level metadata (Open Graph) for `/about`, `/contact`, `/faq`, `/support`, `/vuriumbook`, blog, public booking
- ✅ Public booking helper text, empty states, draft persistence, timezone label, `idempotency_key` submit
- ✅ Dashboard timezone, launch checklist, setup banner
- ✅ Clients/Payments sort controls + bulk delete
- ✅ SMS UX reframed around auto-activation (Settings + signup) — no manual CTA as primary action for new workspaces
- ✅ FE.28 — client-side DOMPurify Layer 2 landed and passed AI 3's 7-case XSS matrix without Element visual regression

### Owner external — done

- ✅ `TELNYX_WEBHOOK_PUBLIC_KEY` in GitHub Secrets (confirmed 2026-04-14 in `GitHub Secrets Inventory.md`)
- ✅ `ADMIN_NOTIFY_EMAIL` in GitHub Secrets
- ✅ Vurium Inc. Illinois incorporation approved
- ✅ 10DLC brand Vurium Inc. registered on Telnyx (TCR: BCFAC3G)
- ✅ Privacy Policy + Terms address / section numbering fixes

---

## 🟡 Open work — AI 1 (Claude, Backend + Docs)

### P0 security housekeeping — still blocked on owner

| ID | Item | Why not done yet | Owner-unblock needed |
|----|------|------------------|----------------------|
| **CQ.1** | `docs/Telnyx/twilio_2FA_recovery_code.txt` — **still exists in repo** at that path. Purge via `git filter-repo --path docs/Telnyx/twilio_2FA_recovery_code.txt --invert-paths`, then force-push | I will not unilaterally invalidate the code in Twilio console or force-push without explicit owner go | OW-Sec.1 below |
| **CQ.2** | `docs/APPLE_REVIEW_CHECKLIST.md` lines 76-77 — **still has plaintext** `applereview@vurium.com / ReviewTest2026!`. Replace with `[stored in 1Password → Apple Review]` | I will not remove without confirmation that it was saved to 1Password first | OW-Sec.2 below |

### P1 — high-value non-blocking, I can start any time

| ID | Item | State on 2026-04-15 | Effort | Rationale |
|----|------|---------------------|--------|-----------|
| **BE.1** | Distributed lock for background jobs (Firestore TTL lock) | **NOT DONE.** `setInterval(...)` at line 10257 fires 7 background jobs unprotected: `runAutoReminders`, `runAutoMemberships`, `runRetentionCleanup`, `resetSecurityCounters`, `runPayrollAudit`, `runBookingAudit`, `runSmsAutoProvisionRetry`. When Cloud Run ever scales to >1 instance, every job will run once per instance per cycle | M | Stays relevant only if we ever set `--min-instances > 1` on Cloud Run. Currently `min_instances=0`, so effective risk is just the brief period where Cloud Run keeps multiple warm instances under load spike. Still worth doing before any launch marketing push |

### P2 — after core launch

| ID | Item | State | Effort |
|----|------|-------|--------|
| **BE.5-cont** | **BUG-005** (`POST /auth/forgot-password` + `/auth/login-email` O(N) workspace scan) and **BUG-006** (Square webhook merchant_id N+1) | NOT DONE — both require a new top-level `user_index` or `username_index` collection + backfill migration, and a `square_merchant_index` collection. These are structural changes, not quick patches. `/auth/login-email` still scans all workspaces; Square merchant_id still reads settings/square per workspace in a loop. Not launch blockers at current scale (<50 workspaces) but grow linearly with workspace count | M |
| **BE.6** | `phone_norm` HMAC blind index (`PHONE_INDEX_SECRET` env var) + migration script | NOT DONE — `phone_norm` still stored as plaintext digits in `clients` collection. grep for `PHONE_INDEX_SECRET` / `hmacPhone` returns nothing | L |
| **BE.7** | Refactor `backend/index.js` (11k lines) into `backend/routes/`, `backend/lib/`, `backend/jobs/` without logic changes | NOT DONE — `backend/` still contains only `Dockerfile`, `firestore.indexes.json`, `index.js`, `package.json`, `test-email.js`. No `routes/`, `lib/`, `jobs/` folders exist | XL |
| **BE.8** | Migrate legacy SMS statuses → delete `LEGACY_SMS_STATUSES` Set | DONE — Migration endpoint exists but owner paused execution for test data. Legacy Set removed. | M |
| **BE.9** | Replace regex-based `sanitizeHtml` / `processCustomHTML` for `custom_html` / `custom_css` with DOMPurify-equivalent parser (defense-in-depth) | DONE — Defense-in-depth implemented on backend (linkedom) and frontend (DOMPurify Layer 2). FE.28 completed. | M |

### Blocked on external (not my scope to unblock)

| ID | Item | Blocked on |
|----|------|-----------|
| **OPS.1** | Create Telnyx Verify Profile + set `TELNYX_VERIFY_PROFILE_ID` GitHub Secret | Telnyx account `whitelisted_destinations` account-level blocker (pending Jonathan call). Fallback path works; not a launch blocker |
| **OPS.2** | Write full Platform-Sender-Pivot-Plan.md with TFV checklist, consent re-flow, legal diffs, rollback plan, Phase-4 code patch | Jonathan reply to the draft inquiry letter in `docs/Tasks/Platform-Sender-Pivot-Decision.md`. Stays gated until Telnyx gives written greenlight or explicit no |

---

## 🟡 Open work — AI 2 (Codex, Frontend)

### P0 live verification (browser testing, not code)

| ID | Item | Scope |
|----|------|-------|
| **FE.1** | P0.9 Settings mobile drill-down — live iPhone verification | Code is local; visual pass needed |
| **FE.2** | P0.10 Settings save/load parity — toggle → refresh → confirm render | Code ready after AI 1 backend merge fix |
| **FE.3** | P0.11 Full first-run owner journey — signup → onboarding → dashboard → booking link | Live E2E smoke |
| **FE.4** | P0.13 Role-based visibility — login as owner/admin/barber/student/guest | Post-`074ddd2` verification — Shell nav + Dashboard + payments all fixed, needs live confirmation |
| **FE.5** | P0.14 Mobile usability on 375px for Settings / Dashboard / Book / Manage-booking / Billing / Signin / Signup | Cross-page visual sweep |
| **FE.6** | P0.15 Timezone indicator on booking page | Live verify |
| **FE.7** | P0.16 Booking form data persistence on back-navigation | Live verify |
| **FE.8** | P0.17 Calendar mobile layout on iPhone width | Live verify |

### P1 — polish verification + code quality

| ID | Item | State |
|----|------|-------|
| **FE.9** | P1.5 Button disabled states — live verify | Code done, visual pass needed |
| **FE.10** | P1.6 Dashboard timezone — manual verify widgets | Code done, visual pass |
| **FE.11** | P1.7 Dashboard clarity (checklist + finish-setup) | Code done, visual pass |
| **FE.12** | P1.8 Booking UX polish — empty states, helper text | Code done, visual pass |
| **FE.13** | P1.9 Billing messaging — Apple vs web paths | Code done, visual pass |
| **FE.14** | P1.10 Empty / loading states sweep | Code done, visual pass |
| **FE.20** | 5.1 Remove `localStorage.getItem('VURIUMBOOK_TOKEN')` from `lib/api.ts` line 8; keep only `credentials: 'include'` httpOnly cookie flow | **NOT DONE / EXPLICITLY GATED** — after the 2026-04-14 iOS auth incident, this refactor is blocked until Swift `WKWebView` auth bootstrap is aligned with [[Web-Native-Auth-Contract]]. Do not ship as a cleanup commit; it requires coordinated web + native verification |

### P2 — polish / refactor

| ID | Item | State |
|----|------|-------|
| **FE.25** | 5.2 Split `app/settings/page.tsx` (2,583 lines) into `app/settings/tabs/*` | **NOT DONE** — `app/settings/tabs/` directory does not exist; file is still 2,583 lines |
| **FE.26** | 5.3 Replace inline style constants (`inp`, `card`, `lbl`) in settings with className or `app/settings/styles.ts` | NOT DONE (same page) |
| **FE.27** | BUG-011 — `api()` helper in `app/book/[id]/page.tsx` silently swallows HTTP errors | Pending |

### P1 — improvement plans — NEW FINDING, WERE NOT IN PRIOR OPEN LIST

| ID | Plan doc | State on 2026-04-15 | Effort | Note |
|----|----------|---------------------|--------|------|
| **IMPR.Reg** | [[Registration-Improvement-AI1]] + [[Registration-Improvement-AI2]] — StepBar + sub-step 0a/0b split + social sign-up buttons + password show/hide toggle + mobile address grid fix on `app/signup/page.tsx` | **NOT DONE** — grep for `StepBar`, `subStep`, `setSubStep`, `handleSubStepContinue`, `showPw` in `app/signup/page.tsx` returns nothing. The signup page is still the pre-plan single-step form | M | Useful polish but not a launch blocker. Matches the current manual signup UX you already accepted for launch |
| **IMPR.PublicSite** | [[PublicSite-AI1]] (backend `/public/profile/:wsId` + `/public/portfolio/:wsId` + whitelisted settings fields) and [[PublicSite-AI2]] (frontend `PublicSiteNav` + `HomeTab` + `ServicesTab` + `PortfolioTab` + BookTab wrapping) | **NOT DONE** — no `/public/profile` or `/public/portfolio` endpoint in backend; no `PublicSiteNav` / `HomeTab` / `ServicesTab` / `PortfolioTab` identifiers in `app/book/[id]/page.tsx`. Current public booking page is single-screen with Business details + Services preview sections added for Element remediation, but no tabbed mini-site | L (both halves) | This was supposed to turn `/book/[id]` into a 4-tab mini-site (Home · Services · Portfolio · Book). Element remediation shipped a flatter version of the same idea in `dbc8dfa` + `bed4537`. **Open question:** is the 4-tab mini-site still the product goal, or does the flat Business details + Services preview replace it? See "Plans to re-evaluate" section below |
| **IMPR.Theme** | [[Theme-Light-AI1]] (CSS variables + `ThemeProvider` + anti-FOUC script) and [[Theme-Light-AI2]] (`ThemeToggle` component + per-element light-mode overrides) | **NOT DONE** — no `data-theme="light"` rules in `app/globals.css`, no `components/ThemeProvider.tsx`, no `components/ThemeToggle.tsx`. Product is still dark-only | L | Not launch blocker. Same question as PublicSite — is this still a priority for launch, or post-launch nice-to-have? |

---

## 🟡 Open work — Verdent (Reviewer / Verifier / Research)

### Active reviewer tasks

- **VR.1** — Post-commit diff sanity check on every backend commit landed today (7 commits since morning). Focus on Gap 5 + waitlist hotfix + Element remediation + BE.4 reactions + Gmail API discovery. Output: entries in `docs/Tasks/QA-Scan-2026-04-15.md`
- **VR.2** — Post-commit sanity on Codex frontend commits (`dbc8dfa`, `074ddd2`, `b74c79b`, `f94cd12`, `bed4537`, `8f7bec3`). Focus on PERM rendering correctness, Element Business details data path, Shell profileTabs typing
- **VR.3** — Docs cross-consistency pass: now that multiple open items have shifted, re-check `In Progress.md`, `Launch Readiness Plan.md`, `Production-Plan-AI1.md`, `Production-Plan-AI2.md` for contradictions with this file

### Already shipped by Verdent today ✅

- ✅ `docs/Tasks/Launch-Verification-Runbook.md` (VR.4)
- ✅ `docs/Tasks/Deploy-Smoke-Test.md` (VR.5)
- ✅ `docs/Tasks/QA-Scan-2026-04-15.md` (VR.6 — initial pass)
- ✅ `docs/Tasks/Element-10DLC-Resubmission-Checklist.md`
- ✅ `docs/Tasks/US-A2P-CTA-Brand-Verification-Notes.md`
- ✅ `docs/Architecture/GitHub Secrets Inventory.md`

### Open research

- **VR.7** — TFV submission research — only after Jonathan replies positively about shared-sender pattern
- **VR.8** — CPaaS alternatives monitoring — quarterly or as needed
- **VR.9** — Pre–App Store submission checklist against current state — before each iOS submit

### Explicit NON-tasks

- ❌ No edits to `backend/index.js` without handoff
- ❌ No edits to Codex-owned frontend files
- ❌ No parallel backend implementation tracks

---

## 🟡 Owner external — unblocker queue

### Security housekeeping (unblocks CQ.1 + CQ.2)

| ID | Item | Effort |
|----|------|--------|
| **OW-Sec.1** | Invalidate Twilio recovery code `RFXT548Z41JF65BU1AD1V8AL` in Twilio console. Confirm to me, then I `git filter-repo` the file out of history | 2 min |
| **OW-Sec.2** | Save `applereview@vurium.com / ReviewTest2026!` to 1Password → Apple Review entry. Confirm to me, then I replace the docs entry with a reference | 5 min |

### Gmail operational (unblocks BE.2 end-to-end)

| ID | Item | Effort |
|----|------|--------|
| **OW-Gmail.1** | Verify in Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client that Authorized redirect URI includes `https://vuriumbook-api-431945333485.us-central1.run.app/api/vurium-dev/gmail/callback` | 2 min |
| **OW-Gmail.2** | Verify OAuth consent screen covers scopes `gmail.readonly`, `gmail.send`, `gmail.modify`. If app is "testing" mode, either publish or add the 4 admin emails as test users | 5 min |
| **OW-Gmail.3** | Open `/developer/email`, click Connect for each of `support@`, `billing@`, `sales@`, `security@vurium.com`, approve OAuth, confirm inbox loads | 10 min |

### Telnyx + SMS

| ID | Item | Effort / status |
|----|------|-----------------|
| **OW-Tel.1** | Send draft Jonathan inquiry letter from `docs/Tasks/Platform-Sender-Pivot-Decision.md` to `10dlcquestions@telnyx.com` or Jonathan directly | 10 min |
| **OW-Tel.2** | Resolve `whitelisted_destinations` account-level blocker on Telnyx Voice Profile during the next Jonathan call → unblocks OPS.1 | Call-dependent |
| **OW-Tel.3** | Monitor campaign `CICHCOJ` while it is `Pending MNO Review`. If Telnyx / webhook returns approval or rejection, update docs and route the outcome back to AI 1 / AI 2 / AI 3 before any new submit action | External |
| **OW-Tel.4** | Verify Vurium Inc. brand with Telnyx (send CP-575A + Articles of Incorporation to `10dlcquestions@telnyx.com`) | 15 min |
| **OW-Tel.5** | Wait for TFN +1-877-590-2138 verification | External |
| **OW-Tel.6** | Create CUSTOMER_CARE campaign after Vurium Inc. brand verified | 10 min |

### Live verification after latest deploys

| ID | Item | Effort |
|----|------|--------|
| **OW-Verify.1** | Run `docs/Tasks/Live-SMS-Verification-Checklist.md` end-to-end on Cloud Run `a3c885f` or later | 30 min |
| **OW-Verify.2** | Run `docs/Tasks/Launch-Verification-Runbook.md` + `docs/Tasks/Deploy-Smoke-Test.md` | 20 min |
| **OW-Verify.3** | Run waitlist hotfix re-verification from `docs/DevLog/2026-04-15.md` → "Hotfix: Waitlist..." checklist (5 items) | 10 min |

### Business

| ID | Item | Effort |
|----|------|--------|
| **OW-Biz.1** | Vurium Inc. — file first annual report before April deadline + franchise tax | 30 min |

---

## 🔄 Plans to re-evaluate with owner (NOT ACTION — decision first)

Three improvement plans are documented but have not started implementation and may or may not still match product direction. Before spending engineering time on any of them, we need a yes/no/defer from the owner:

### Re-eval 1: `Registration-Improvement-AI1` + `AI2` (StepBar + sub-step signup + social sign-up buttons)

- **Current state:** signup page is the pre-plan single-step form
- **Still relevant?** This would turn signup into a 0a/0b split with social sign-up buttons and progress bar. Useful polish for conversion but not launch-blocking
- **Decision needed:** commit to it now (~half day Codex work), defer post-launch, or drop entirely

### Re-eval 2: `PublicSite-AI1` + `AI2` (`/book/[id]` as 4-tab mini-site: Home / Services / Portfolio / Book)

- **Current state:** `/book/[id]` is single-screen with Business details + Services preview blocks added for Element 10DLC remediation
- **Still relevant?** The Element remediation shipped a **flatter version** of the idea. The 4-tab mini-site doc called for `PublicSiteNav`, `HomeTab` (hero, about, team, hours, reviews, CTA), `ServicesTab`, `PortfolioTab` with lightbox, plus new backend `/public/profile/:wsId` and `/public/portfolio/:wsId` endpoints
- **Tension:** some of what the plan wanted (business details, services preview) is now on the page. The tabbed structure + portfolio lightbox are not
- **Decision needed:** does the owner still want the full 4-tab mini-site rewrite, or is "current flat page + light polish" enough for launch? If the 4-tab version is still the goal, that is ~1 day of Codex work + half-day of backend endpoint work from me

### Re-eval 3: `Theme-Light-AI1` + `AI2` (dark ↔ light theme switching)

- **Current state:** product is dark-only. No CSS variables, no `ThemeProvider`, no `ThemeToggle` component
- **Still relevant?** Was explicitly planned but has not started
- **Decision needed:** is light theme a launch requirement or post-launch nice-to-have? The ask requires CSS variable refactor across `globals.css` (AI 1-ish scope since touches shared file) + component overrides + a toggle in the navbar (AI 2 scope). Medium effort in total but no critical blocker tied to it

---

## 📋 Known-dead / deferred items that will not be done

- **Platform-as-sender SMS pivot** — intentionally NOT implemented; carrier code 710 rejection + current dual-path architecture decision. See `docs/Tasks/Platform-Sender-Pivot-Decision.md`
- **ISV single-sender retry** — same
- **Force migration of legacy 10DLC to toll-free** — Element Barbershop is explicit protected grandfathered case; no auto-migration

---

## 🧮 Recommended sprint order after this audit

### Sprint 2a — completed on 2026-04-15

1. **BE.1** Distributed lock for 7 background jobs — landed and post-commit reviewed
2. **BE.8** LEGACY_SMS_STATUSES cleanup — landed with owner decision to keep the audit tool as a future manual utility
3. **BE.9 / FE.28** defense-in-depth sanitization — landed on backend + frontend and verified by AI 3

### Sprint 2b — owner unblocks required

1. **CQ.1** after OW-Sec.1 (Twilio console invalidation)
2. **CQ.2** after OW-Sec.2 (1Password save)
3. **OW-Gmail.1/2/3** → BE.2 feature fully live
4. **OW-Verify.1/2/3** live verification of landed hardening work → any bugs become new hotfixes
5. **OW-Tel.1** Jonathan letter → unlocks OPS.2 decision tree after reply

### Sprint 2c — Codex (AI 2)

- Complete **FE.1–FE.14** live browser verification passes (post `074ddd2`, `f94cd12`)
- **FE.20** httpOnly cookie migration in `lib/api.ts` — coordinate with AI 1 first

### Sprint 3 — defer decisions

- **IMPR.Reg** / **IMPR.PublicSite** / **IMPR.Theme** — each needs a yes/no from owner before starting
- **BE.5-cont** (BUG-005/006 index collections) — structural, pair with BE.7 refactor
- **BE.6** phone_norm HMAC blind index — can happen alongside BE.7
- **BE.7** backend/index.js modular refactor — after everything else stabilizes

---

## 🧭 Metrics — launch readiness snapshot

| # | Condition | Status |
|---|-----------|--------|
| 1 | All P0 backend committed and deployed | ✅ |
| 2 | All P0 frontend committed | ✅ |
| 3 | Telnyx hardening Gaps 2/3/4/5 live | ✅ |
| 4 | Element 10DLC remediation pack live | ✅ |
| 5 | Waitlist regression fixed | ✅ (commit `a3c885f`) |
| 6 | Live browser verification (OW-Verify.1/2/3) | ⏳ owner |
| 7 | Element CICHCOJ submitted and awaiting MNO verdict | ⏳ external |
| 8 | Twilio recovery code purged (CQ.1) + Apple demo creds migrated (CQ.2) | ⏳ blocked on owner |
| 9 | Gmail API operationally connected (OW-Gmail.1/2/3) | ⏳ owner |
| 10 | Jonathan inquiry letter sent (OW-Tel.1) | ⏳ owner |
| 11 | PERM-001/002/004 + BUG-004/007 browser verification | ⏳ Codex |
| 12 | TELNYX_VERIFY_PROFILE_ID created (OPS.1) | 🔴 blocked on Telnyx account |

Launch green = items 1–6 done. Item 7 is now an external carrier-review wait state for Element, not an engineering blocker. Items 8–10 finish within the week if owner runs the external queue. Items 11–12 don't block launch.
