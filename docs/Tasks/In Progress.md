# In Progress

> [[Home]] > Tasks | See also: [[Tasks/Backlog|Backlog]], [[Tasks/Launch Readiness Plan|Launch Readiness Plan]]

## PERMISSIONS FIX — PERM-003 Backend (AI 1) — DONE

### Commits
- `a80d9da` — requireCustomPerm middleware + /api/payments fix
- `f0de2e0` — Square/Stripe status endpoints use custom permissions

### What was done
1. Created `requireCustomPerm(permKey)` middleware (line ~1294):
   - Owner/admin always pass
   - Barber/student: reads `role_permissions` from Firestore `settings/config`
   - Checks `role_permissions[role][permKey]` — returns 403 if not set
2. Fixed endpoints:
   - `GET /api/payments` → `requireCustomPerm('pages.payments')`
   - `GET /api/square/oauth/status` → `requireCustomPerm('financial.access_terminal')`
   - `GET /api/stripe-connect/status` → `requireCustomPerm('financial.access_terminal')`
3. Result: barbers with enabled permissions can now see payments, use terminal checkout

### Guest role fix — commit `97be886`
- **Problem**: `guest` role was missing from frontend `DEFAULT_PERMS` in `PermissionsProvider.tsx`
- AI 2's permission checks (`hasPerm('financial', 'pay_cash')` etc.) always returned `false` for guest
- Guest accounts saw only Cash button, no Terminal/Zelle/Other
- **Fix 1**: Added `guest` to `DEFAULT_PERMS` with sensible defaults (calendar, clients, bookings, checkout, terminal, all payment methods)
- **Fix 2**: Fixed `requireCustomPerm()` dot notation bug — `'financial.access_terminal'` was looked up as flat key instead of nested `perms.guest.financial.access_terminal`
- **Result**: Guest accounts now see Terminal, Cash, Zelle, Other based on custom permissions

### Remaining PERM issues (AI 2 scope)
- PERM-001: Dashboard hardcodes `if (isBarber && [...].includes(item.label)) return false` — ignores hasPerm()
- PERM-002: Pill nav bottom bar only has 5 items — no way to navigate to Payments/Clients etc.
- PERM-004: Payments page uses `isOwner` check instead of hasPerm()

---

## VERCEL BUILD BROKEN — FIXED local AI 2 patch 2026-04-13

**Commit**: `f2158a2` — Vercel build fails with TypeScript error

```
app/book/[id]/layout.tsx
Type error: Type '{ params: { id: string; }; }' does not satisfy the constraint 'LayoutProps'.
  Types of property 'params' are incompatible.
    Type '{ id: string; }' is missing the following properties from type 'Promise<any>'
```

**Fix applied**: `app/book/[id]/layout.tsx` now uses Next.js 15 async route params for both `generateMetadata()` and the default layout export.

**Owner**: AI 2 — file `app/book/[id]/layout.tsx`
**Status**: FIXED LOCAL — pending push/build confirmation

### Build error #2: `showConfirm` not found in Shell.tsx — FIXED local AI 2 patch 2026-04-13

**Commit**: `b18e73c`
```
./components/Shell.tsx:359:32
Type error: Cannot find name 'showConfirm'.
```

**What**: `showConfirm()` is called at line 359 but never declared/imported in Shell.tsx. Likely part of the P0.12 styled dialog refactor — the function definition may have been accidentally removed or not included in this commit.

**Fix applied**: `ProfileModal` in `components/Shell.tsx` now reads `showConfirm` from `useDialog()` directly, and the unused outer `Shell` reference was removed.

**Owner**: AI 2
**Status**: FIXED LOCAL — pending push/build confirmation

---

## P0 — Launch Readiness (AI 1: Backend)

- [x] P0.1 Webhook signature verification (Stripe + Square) — **DONE** commit `b1bdbe9` 2026-04-14
  - Stripe: HMAC-SHA256 verification of `stripe-signature` header
  - Square: HMAC-SHA256 verification of `x-square-hmacsha256-signature` header
  - Both reject invalid signatures with 400
- [x] P0.2 Fix `spAmountCents` → `spServiceCents` — **DONE** commit `b1bdbe9` 2026-04-14
  - 6 occurrences replaced in webhook + reconciliation handlers
- [x] P0.3 Cloud Run stability + health check — **DONE** commit `b1bdbe9` 2026-04-14
  - Added `GET /health` endpoint (status, uptime, timestamp)
  - Memory 1Gi, CPU 1, timeout 300s
  - Rollback: `gcloud run services update-traffic vuriumbook-api --to-revisions=PREVIOUS=100`
- [x] P0.4 Billing verification matrix — **DONE** commit `9d23103` 2026-04-14
  - Apple: added expiry date check in getEffectivePlan() — blocks access after apple_expires_at
  - Stripe Connect: added webhook signature verification (was unprotected)
  - Verified: Stripe subscription create/cancel/upgrade webhooks, Apple IAP verify/webhook, Square reconciliation
  - Found & fixed: Apple expired subscriptions could still access features if webhook delayed
- [x] P0.5 Auth and security audit — **DONE** commit `595b324` 2026-04-14
  - Added requireRole('owner','admin') to GET /api/payments, /api/square/oauth/status, /api/stripe-connect/status
  - Audit confirmed: JWT middleware on all /api routes, Apple/Google OAuth verified server-side, password reset single-use, rate limiting on login
  - Remaining: password hashing uses SHA256 (not bcrypt) — acceptable for launch, upgrade later
- [x] P0.6 Data integrity — full chain verification — **DONE** 2026-04-14
  - Covered by /api/payroll/audit (7 checks): unpaid bookings, booking↔payment match, cash reconciliation, admin hours, totals, amounts, Square verification
  - Tips: both `tip` and `tip_amount` saved consistently (fixed 2026-04-13)
  - Cash: service_amount (net) used correctly, not amount (gross)
  - Expenses: deducted from owner net, category breakdown working
- [x] P0.7 Server-side price verification — **DONE** commit `b1bdbe9` 2026-04-14
  - Compares payment amount vs booking service_amount
  - Rejects if >2x or <0.5x expected (tolerance for tax/fees)
- [x] P0.8 Booking idempotency — **DONE** commit `595b324` 2026-04-14
  - POST /public/bookings accepts `idempotency_key` in body
  - Duplicate key returns existing booking (no double-create)
  - Key stored on booking document

## P0 — Launch Readiness (AI 2: Frontend)

- [ ] P0.9 Settings mobile drill-down navigation — **IN PROGRESS**
  - Local implementation complete in `app/settings/page.tsx`
  - Pending: browser/iPhone verification before marking done
- [ ] P0.10 Settings save/load verification — **UNBLOCKED** by AI 1
  - Frontend/backend path re-checked for `online_booking_enabled`, `waitlist_enabled`, `booking.cancellation_hours`, `display.show_prices`, `display.require_phone`, `display.allow_notes`
  - **Backend blocker FIXED**: commit `911c1f4` — `POST /api/settings` now merges `booking` and `display` nested objects (AI 1)
  - Pending: AI 2 manual toggle → reload verification pass across categories
- [ ] P0.11 Full customer path audit
  - Session-expiry / stale-login black-screen fix added in `components/Shell.tsx`; protected pages now redirect to `/signin` instead of hanging on a blank screen
  - Edited auth-loss redirects now use `replace('/signin')` to avoid back-navigation into stale protected screens
  - `components/Shell.tsx` now uses a one-way auth redirect guard too, so repeated `401`/stale-session checks do not keep bouncing users through duplicate sign-in redirects
  - Periodic session expiry checks now reopen the PIN unlock flow when available instead of always dumping the user straight into a hard redirect
- [x] P0.12 Remove alert()/confirm() — **DONE**
  - `app/billing/page.tsx` moved to styled dialog flow for cancel/manage actions
  - `app/settings/page.tsx` key owner flows moved off native `confirm()`; team password reset and owner delete-account also moved off browser `prompt()`
  - `app/signin/page.tsx` forgot-password browser prompt replaced with branded modal
  - `components/Shell.tsx` sign-out confirmation now uses the shared styled dialog flow
  - Broad scan across AI 2-owned files is now clean for native `alert()`, `confirm()`, and `prompt()` usage
- [ ] P0.13 Role-based visibility verification
  - `app/settings/page.tsx` now also normalizes the URL when the current `tab` is not visible for the active role, so role-restricted users do not stay on a stale inaccessible settings slug
  - Settings content rendering now uses a role-safe fallback tab too, so a hidden category no longer keeps rendering just because stale local state or URL params still point at it
- [ ] P0.14 Mobile usability on key pages
  - `/billing` now stacks plan cards and management actions more cleanly on small screens instead of relying on desktop-like horizontal spacing
  - `Settings -> Roles & Permissions` now switches from a desktop permission matrix to stacked mobile cards, so owners can actually review and toggle role access on phone screens
  - `Settings -> Team Accounts` now hooks into the existing mobile CSS too, so the create-member form, member header row, and action buttons stop behaving like fixed desktop rows on phones
  - The session PIN overlay in `components/Shell.tsx` now has a clear `Use password instead` escape hatch and supporting copy, so phone users no longer look visually trapped in a full-screen lock state
  - `Settings -> Taxes & Fees` and `Custom charges` now collapse into stacked/two-column mobile cards, keeping label, payment-method, and remove controls reachable on narrow screens instead of squeezing desktop grids
  - `Settings -> Payroll defaults` tip-option inputs now stack cleanly on phones too, and the Square Terminal preview chips wrap instead of overflowing
  - SMS/Telnyx registration fields in `Settings` now stack on mobile as well, so business identity/contact/address blocks stop behaving like rigid desktop forms
- [ ] P0.15 Timezone indicator on booking page — **IN PROGRESS**
  - Local implementation added to `app/book/[id]/page.tsx`
  - Pending: browser verification on live booking flow
- [ ] P0.16 Fix form data loss on booking page — **IN PROGRESS**
  - Session draft persistence added for `name`, `email`, `phone`, `notes`, `smsConsent`
  - Frontend now sends `idempotency_key` with booking creation to match backend duplicate-submit protection
  - Restored draft data is now surfaced back to the client with an inline notice on the details step, so saved info does not silently reappear without explanation
  - Pending: manual unavailable-slot/back-navigation verification
- [ ] P0.17 Calendar mobile layout — **IN PROGRESS**
  - Calendar grid now allows horizontal pan on mobile when the full barber schedule is wider than the viewport, instead of clipping extra columns behind `overflowX: hidden`
  - Calendar settings/team/service editors are being collapsed into single-column mobile layouts, and the weekly schedule grid now breaks to 2 columns on phone screens
  - Pending: browser verification on an actual narrow viewport before marking done

## P1 — Queued

- [x] P1.1 Fix N+1 queries (AI 1) — **DONE** commit `183209e` 2026-04-14
  - Square webhook uses merchant_id for fast workspace lookup; fallback to scan only if not found
- [x] P1.2 Fix silent .catch() (AI 1) — **DONE** commit `183209e` 2026-04-14
  - Payment booking updates and payment_request creates now log errors instead of silently swallowing
- [x] P1.3 Firestore indexes (AI 1) — **DONE** commit `183209e` 2026-04-14
  - Added backend/firestore.indexes.json: bookings(status+start_at), (phone_norm+start_at), (barber_id+start_at)
- [x] P1.4 Webhook logging (AI 1) — **DONE** commit `460363a` 2026-04-14
  - logWebhookEvent() helper stores to Firestore webhook_logs collection
  - All 4 handlers log: Stripe, Square, Apple, Stripe Connect
- [ ] P1.5 Button disabled states (AI 2) — **IN PROGRESS**
  - Public booking page now locks waitlist fields, booking form inputs, payment toggle buttons, and back navigation while submit/payment setup is running
  - Added inline status copy during booking/payment setup so the client sees that availability is still being checked
- [ ] P1.6 Dashboard timezone (AI 2) — **IN PROGRESS**
  - Dashboard key date/time formatting now rerenders after workspace timezone loads from `/api/settings/timezone`
  - Additional dashboard widgets now use workspace timezone consistently for day labels, clock-in timestamps, phone-access log times, and the analog clock / free-slots calculations
  - Weekly/monthly dashboard ranges are now being derived from workspace day boundaries too, so revenue/client/expense widgets stop drifting around midnight for owners outside the browser's local timezone
  - Pending: manual UI verification across widgets/cards after refresh
- [ ] P1.7 Dashboard clarity (AI 2) — **IN PROGRESS**
  - Dashboard now shows an owner launch checklist instead of dropping new owners straight into widgets with no guidance
  - Desktop gets a fuller checklist card with direct links into setup categories; mobile gets a compact "Finish setup" banner that opens the next missing step
  - Fixed a mobile/dashboard flicker where `Finish setup` could appear for a moment on stale default state and then disappear; the banner now waits for user hydration, settings/slug hydration, and the first dashboard load before rendering
- [ ] P1.8 Booking UX polish (AI 2) — **IN PROGRESS**
  - Public booking now has clearer helper text across staff, services, date/time, and details steps so the flow feels less abrupt for first-time clients
  - Empty states are more actionable too: no-services explains the booking menu is not live yet, and no-times now points people to another date or the waitlist instead of stopping cold
  - Waitlist submit-state copy is being cleaned up too, so the action reads like product UI (`Joining waitlist…`) instead of a raw loading placeholder
  - Waitlist success messaging is getting more reassuring too: once joined, the confirmation now points back to the actual contact method the client provided
- [ ] P1.9 Billing messaging (AI 2) — **IN PROGRESS**
  - Billing screen now explains whether the workspace is managed through Apple App Store subscriptions or VuriumBook web billing
  - Manage/cancel actions now have loading states and Apple-managed subscriptions use clearer “Manage in Apple” messaging instead of Stripe-style wording
  - Settings → Subscription now mirrors the same Apple-vs-web language and action states, so billing UX stays consistent across both surfaces
  - Trial/no-plan states are being cleaned up too, so users no longer see fallback labels like “No plan” or a misleading default “Individual” label when they have not subscribed yet
  - Checkout and restore-purchase states now use clearer action copy too (`Preparing checkout…`, `Restoring purchases…`) instead of generic processing text
  - Portal/cancel loading states are more explicit now too (`Opening billing…`, `Opening Apple subscriptions…`, `Cancelling subscription…`), and `Billing` / `Settings -> Subscription` use matching action labels
- [ ] P1.10 Empty states (AI 2) — **IN PROGRESS**
  - Replaced several generic `Loading...` states in owned customer-facing screens with clearer product copy (`Loading billing details…`, `Loading booking page…`, `Checking available times…`, `Loading team members…`, `Loading role permissions…`)
  - Dashboard and billing empty-state wording is getting more customer-friendly too (`No team members are clocked in right now`, `Traffic data will appear here once visits start coming in`, `No paid subscription is connected yet`)
  - Booking empty states now explain what to do next instead of just saying "No services available" or "No times are currently open for this day"
  - Action-state copy is being softened too: booking/payment CTAs and clock-in widgets now show clearer in-progress text instead of raw `...` or terse debug-style wording
  - Inline payment submit text on the booking page now reads `Processing payment…` instead of a generic `Processing...`
  - More raw three-dot action states were cleaned too (`Sending…`, `Adding…`, `Generating…`) so customer/admin surfaces stay consistent
  - `Payments` now uses more product-style loading/empty/detail placeholder copy too (`Loading payments…`, `No payments match this range or filter yet.`, `Select a payment to view the full details.`)

## P2 — After Core Launch

- [x] P2.1 API pagination (AI 1) — **DONE** commit `fafcdc5` 2026-04-14
  - /api/clients: limit param (max 500, default 200)
  - /api/payments: limit param (max 1000, default 200)
  - /api/messages: limit param (max 500, default 100)
- [x] P2.2 Rate limiting (AI 1) — **DONE** commit `fafcdc5` 2026-04-14
  - In-memory rate limiter for public endpoints (no Firestore cost)
  - Public booking: 10 req/min per IP, returns 429 on excess
- [x] P2.3 Email retry queue (AI 1) — **DONE** commit `91d9c98` 2026-04-14
  - sendEmail retries up to 2 times with 2s/4s backoff
  - Logs failures with recipient and subject for debugging
- [x] P2.4 Production monitoring (AI 1) — **DONE** commit `91d9c98` 2026-04-14
  - GET /health returns: ok, version, uptime, memory_mb, timestamp
  - Removed duplicate health endpoint
- [ ] P2.5 Marketing pages polish (AI 2) — **IN PROGRESS**
  - `/vuriumbook` pricing copy is being tightened so trial/billing messaging matches the real signup flow instead of contradicting itself
  - Sell-side trust copy is also being cleaned up to avoid unsupported claims on public marketing pages
  - `/`, `/about`, `/faq`, and `/support` are now being softened too so public pages stop promising unverified SLAs, compliance badges, or overly specific security claims
  - `contact` success copy and the getting-started blog post were aligned with the same safer trial/setup wording so marketing messaging stays consistent across the site
  - Additional exact-timeline claims were removed too (`24/7`, `under 2 minutes`, `within 30 days`) where we had not separately validated them as hard promises
- [ ] P2.6 Table sorting (AI 2) — **IN PROGRESS**
  - `Clients` now has owner-facing sort controls for last visit, name, status, team member, visits, and spend
  - `Payments` now has sort controls for date, amount, tip, client, status, and method, with shared asc/desc direction toggling across desktop and mobile list views
- [ ] P2.7 Bulk actions (AI 2) — **IN PROGRESS**
  - `Clients` now supports row selection, select-visible, clear-selection, and bulk delete for delete-authorized roles
  - Bulk delete uses the styled dialog flow and keeps partial-failure handling in-app instead of falling back to browser dialogs
  - Single-client delete in the profile panel now updates local state immediately too, instead of forcing a full page reload after delete
- [ ] P2.8 Open Graph tags (AI 2) — **IN PROGRESS**
  - Added route-level metadata layouts for key sell-side pages so `about`, `contact`, `faq`, `support`, `vuriumbook`, and the getting-started blog post now have page-specific title/description/Open Graph/Twitter previews
  - Public booking links now also have route-level metadata via `app/book/[id]/layout.tsx`, so direct booking shares can show a business-specific title/description/image instead of only the generic site metadata

## SMS & 10DLC Compliance

### Product direction — dual path
- **New workspaces**: toll-free-first reminder setup
- **Existing / pending 10DLC workspaces**: grandfathered manual path
- **OTP**: stays on `POST /public/verify/send/:wsId` + `/check/:wsId`

### Backend (AI 1 + AI 2) — IN PROGRESS
- [x] 1.1 Telnyx Verify API — already at `/public/verify/send/:wsId` + `/check/:wsId`
- [x] 1.2 SP registration fields — **re-implemented** commit `2c8ce2c`
  - messageFlow: WEBFORM → descriptive opt-in narrative
  - optoutKeywords: added CANCEL,END,QUIT
  - optinMessage: added "Consent is not a condition of purchase"
  - SP status: pending_approval → active (auto-approves)
  - embeddedLink: false
- [x] 1.3 Appointment messaging now avoids platform/global sender fallback when workspace SMS is not active
  - New workspaces stay on email-only reminders until their own SMS sender is active
- [x] 1.4 Manual business registrations are now tagged with `sms_number_type: '10dlc'`
- [x] 1.5 Toll-free endpoint remains the default provisioning path for new workspaces
- [x] 1.6 Docs updated

### Frontend (AI 2) — IN PROGRESS
- [x] 2.1 Settings — toll-free-first SMS card for new workspaces
  - `Settings -> SMS Notifications` now treats toll-free as the default path
  - States are framed around enable/provisioning/pending/active/failed instead of EIN-first setup
- [x] 2.7 Legal copy alignment for reviewer-facing pages
  - `app/privacy/page.tsx` and `app/terms/page.tsx` now match the current booking consent text and the dual-path SMS architecture
  - Appointment SMS is described as `[Business Name] Appointment Notifications`, with toll-free default for new workspaces and grandfathered dedicated senders for manual paths
  - Payment language now reflects Stripe / Square / Apple instead of Stripe-only wording
  - Unsupported `99.9% uptime` / `status.vurium.com` language was removed from Terms
- [x] 2.2 Settings — manual SP / 10DLC flow hidden behind manual fallback for new workspaces
  - Grandfathered/pending manual workspaces still see the existing wizard
- [x] 2.3 Signup copy no longer frames EIN / business registration as the default reminder path
- [x] 2.4 Booking page — business-specific consent text
  - Booking and waitlist SMS opt-in copy uses `{shopName} Appointment Notifications`
  - Terms and Privacy links stay clickable directly inside the opt-in label
- [x] 2.5 Consent metadata
  - Booking, pay-online, group booking, and waitlist submissions send both `sms_consent_text` and `sms_consent_text_version`
- [ ] 2.6 Live verification
  - Pending browser pass for toll-free-first settings UX, grandfathered manual resume state, and email-only fallback behavior

### Pre-deploy
- [ ] Create Telnyx Verify Profile → `TELNYX_VERIFY_PROFILE_ID`
- [x] Add env var to Cloud Run deploy workflow — wired in `.github/workflows/deploy-backend.yml`
- [ ] Written Telnyx confirmation or internal pilot sign-off for Vurium-managed toll-free appointment reminders
- [ ] Confirm Element / existing manual 10DLC workspaces remain untouched after the pivot
  - `Element Barbershop` is the explicit protected pending-review case; do not migrate or rewrite its SMS path while approval is in progress

## Other Active Tasks

- [ ] Verify Vurium Inc. brand on Telnyx (send CP-575A + Articles of Incorporation)
- [ ] Reply to 10dlcquestions about deleted brand BQY3UXK
- [ ] Call with Jonathan (Telnyx) — Mon-Fri next week, 10AM-4PM CT
- [x] Add ADMIN_NOTIFY_EMAIL GitHub Secret — user confirmed configured
- [ ] Save the real Telnyx Verify Profile ID as the GitHub secret `TELNYX_VERIFY_PROFILE_ID`
- [ ] Gmail API integration for Developer panel
- [ ] Wait for TFN +1-877-590-2138 verification
- [ ] Create CUSTOMER_CARE campaign (after brand verified)

## Recently Completed (2026-04-14)
- [x] Vurium Inc. — Illinois corporation approved
- [x] Developer Panel — magic link auth, analytics, email, overview
- [x] Privacy Policy & Terms fixes (address format, section numbering)
- [x] Reply to Telnyx support (Jonathan) — ISV architecture thread
- [x] 10DLC brand Vurium Inc. registered on Telnyx (TCR: BCFAC3G)
- [x] Launch readiness audit and sell-ready execution plan
- [x] Obsidian vault setup & project documentation
