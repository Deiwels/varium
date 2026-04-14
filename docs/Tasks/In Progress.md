# In Progress

> [[Home]] > Tasks | See also: [[Tasks/3-AI-Remaining-Work-Split|3-AI Remaining Work Split]] (authoritative current sprint plan), [[Tasks/Backlog|Backlog]], [[Tasks/Launch Readiness Plan|Launch Readiness Plan]]

> **2026-04-15**: [[Tasks/3-AI-Remaining-Work-Split]] is now the authoritative split for all open work (not just SMS). This file remains the day-to-day activity tracker.

## SMS — 3-AI EXECUTION SPLIT

- Before touching SMS again, all AI should re-read:
  - `docs/Tasks/Telnyx-Integration-Plan.md`
  - `docs/Tasks/Platform-Sender-Pivot-Decision.md`
  - `docs/Tasks/SMS Finalization Plan.md`
  - `docs/AI-Work-Split.md`
- `Claude / AI 1` owns backend SMS hardening:
  - `backend/index.js`
  - `.github/workflows/deploy-backend.yml`
  - backend/docs updates for Gaps 2/3/4/5
- `Codex / AI 2` owns frontend SMS UX:
  - `app/settings/page.tsx`
  - `app/signup/page.tsx`
  - status-first / automatic-activation wording and flow cleanup
- `Verdent` owns review / verification / research support:
  - no parallel backend edits unless ownership changes first
  - use as reviewer, doc-sanity check, and external-research support
- `Owner` owns external unblockers:
  - `TELNYX_WEBHOOK_PUBLIC_KEY`
  - Jonathan / Telnyx follow-up
  - Verify Profile account issues

## BUILD HOTFIX — AI 2

- [x] Fixed Vercel TypeScript build regression in `components/Shell.tsx`
  - build failure was caused by `setTab(t.id)` receiving a widened `string` instead of the local `'profile' | 'password'` union
  - AI 2 replaced the inline inferred tab list with a typed `profileTabs` array
  - no product behavior changed; this only restores a clean production build
- [x] Fixed Vercel TypeScript build regression in `app/book/[id]/page.tsx`
  - build failure was caused by `showCustomBusinessProof` referencing `activeTemplate` before `activeTemplate` was declared
  - AI 2 moved the custom-page proof flag below template resolution
  - no UI logic changed; this only restores the Element custom-page proof patch to a build-safe state

## HOTFIX 2026-04-15 — Waitlist regression (commit `a3c885f`)

- [x] Owner reported: `Join waitlist` CTA disappeared from public booking page
- [x] Root cause: my own SET-006 fix in `849e998` forced `waitlist_enabled: false` in `/public/config/` for every workspace that never touched the Settings toggle. Frontend `??` fallback could not kick in because `false` is not nullish.
- [x] Investigation uncovered two latent pre-existing backend bugs on the same code path (`POST /public/waitlist/:wsId` + `tryWaitlistAutoFill()`) both silently disabling the feature for untouched-toggle workspaces
- [x] Fix landed across all three sites in `a3c885f` with one consistent semantic: **waitlist is ON by default on any plan that includes the feature; Settings toggle is an explicit OFF override, not an opt-in**
- [ ] **Owner verification after `a3c885f` Cloud Run deploy lands:**
  - [ ] Public `/book/{salon-slug}` shows `Join waitlist` on a fully-booked day in incognito
  - [ ] Waitlist submit succeeds (no 403)
  - [ ] Admin `/waitlist` lists the new entry
  - [ ] Booking cancel triggers waitlist auto-notify
  - [ ] Salon+ workspace with explicit `waitlist_enabled: false` still hides form
  - [ ] Individual plan still hidden (plan gate)
  - [ ] Element Barbershop public page still renders Business details + Services preview (unaffected)
- [ ] Codex frontend re-verify: `app/book/[id]/page.tsx:442` and `app/book/[id]/page.tsx:430` still consume `/public/resolve` + `/public/config` correctly — fall-through via `??` is load-bearing
- [ ] Verdent: add retrospective bullet to `QA-Scan-2026-04-15.md` under a new "Regressions from Sprint 1 fixes" section so next scan catches similar default-flip patterns
- See `docs/DevLog/2026-04-15.md` → "Hotfix: Waitlist disappeared..." for full diagnosis, behavior matrix, and lessons-learned note

## SMS — ELEMENT MANUAL REVIEW UPDATE

- [x] Element Barbershop received an MNO response for campaign `CICHCOJ`
  - Status: `Failed MNO Review`
  - Reasons:
    - website lacks sufficient company / product information
    - CTA does not contain registered / DBA brand name
- [ ] Before Element resubmission, fix submission fidelity:
  - use the exact Element booking / public URL, not generic `/book/`
  - confirm CTA copy matches the submitted DBA / brand name exactly
- [ ] Before Element resubmission, strengthen public business proof on the Element-facing page:
  - clear business identity
  - services / what the business offers
  - address / contact information
  - enough visible business information for reviewer verification
- [x] Website-side proof remediation started
  - `app/book/[id]/page.tsx` now shows a public `Business details` section and `Services` preview on the landing page
  - `/public/config/:workspace_id` now exposes allowlisted `shop_address`, `shop_phone`, and `shop_email` for the public booking page
- [x] Element reviewer-facing consent visibility patched on the frontend
  - `app/book/[id]/page.tsx` now renders SMS consent copy immediately on both booking and waitlist forms instead of waiting for phone input first
  - the checkbox stays disabled until a valid phone number is entered, but the consent language, Terms, and Privacy links are visible to the reviewer from first render
- [x] Custom-template public proof block added for reviewer visibility
  - `app/book/[id]/page.tsx` now renders a standardized branded compliance / business-proof section even when the page uses custom HTML
  - this block surfaces:
    - exact business name
    - address / phone / email when saved
    - services preview
    - SMS compliance footer text
    - public Privacy / Terms links
    - a branded CTA (`Book with {Business}`)
- [x] Booking page section toggles now actually control the public landing page
  - `site_config.sections_enabled` is now respected by `app/book/[id]/page.tsx` for:
    - hero
    - about
    - services
    - team
    - reviews
  - custom proof block now also respects the `Services` toggle instead of re-showing services after the owner hides that section
- [x] Custom-page compliance footer no longer duplicates the proof block
  - when the custom proof block is visible, the global footer now keeps only the lightweight `Powered by VuriumBook` line
  - the SMS compliance text + Privacy / Terms links stay in one place instead of appearing twice at the bottom
- [ ] Owner data dependency still remains for Element public proof
  - `Business details` only render when `shop_address`, `shop_phone`, and/or `shop_email` are actually saved in Element Settings
  - if those fields are empty in Firestore, no frontend patch can surface them for Telnyx review
- [x] Backend submission fidelity patched for future resubmission
  - `backend/index.js` 10DLC submission now builds `messageFlow` from the exact workspace booking URL instead of generic `/book/`
  - submission CTA wording now explicitly says `${shopName} Appointment Notifications via SMS`
- [x] New US A2P CTA / brand verification research distilled into docs
  - added [[Tasks/US-A2P-CTA-Brand-Verification-Notes]]
  - Element checklist now explicitly tracks:
    - no-login public proof
    - exact DBA / address matching discipline
    - policy pages as first-class artifacts
    - multiple opt-in methods in `messageFlow` when applicable
- [x] Temporary reminder fallback guidance distilled into docs
  - added [[Tasks/Temporary-Reminder-Delivery-Options]]
  - current team direction clarified:
    - immediate fallback = transactional email
    - short-term SMS alternative = per-business verified toll-free
    - not pursuing shared short codes / platform-wide shared sender / omnichannel expansion as a launch unblocker

## SUPPORT EMAIL STYLE — DONE

- Re-read `docs/Features/Email System.md`, `docs/Features/Developer Panel.md`, and the current `backend/index.js` / `app/developer/email/page.tsx` paths before changing any support-email behavior
- Replaced the old reminder-like support card with a mailbox-aware professional correspondence template used for:
  - direct admin support sends via `/api/vurium-dev/email/send`
  - Gmail send / reply from `support@`, `billing@`, `sales@`, and `security@`
  - inbound admin notify emails forwarded to `ADMIN_NOTIFY_EMAIL`
- Direct admin send now records the mailbox context and uses the matching display name (`Vurium Support`, `Vurium Billing`, etc.) instead of a generic `Vurium` sender label
- Developer Panel email UI copy now matches the new model too:
  - `Branded` wording removed
  - support/team correspondence language used instead

## DEVELOPER PANEL — SMS OPERATIONS SYNC — DONE

- Re-read `docs/Features/Developer Panel.md`, `docs/Features/Developer Panel — Improvement Plan.md`, and current `app/developer/*` code after AI Verdent's developer-panel work
- Confirmed the main gap was the SMS page still reflecting an older platform-level model
- Fixed:
  - `GET /api/vurium-dev/platform` now returns `sms_number_type`
  - added `GET /api/vurium-dev/sms/status`
  - added `POST /api/vurium-dev/sms/provision`
  - `app/developer/_lib/dev-fetch.ts` now throws on non-2xx responses, so developer toasts and actions respect real backend failures
  - rewrote `app/developer/sms/page.tsx` to match the real launch SMS architecture:
    - toll-free-first for new workspaces
    - email-only fallback when sender is missing
    - grandfathered manual / 10DLC visibility
    - explicit `Element Barbershop` protection
- Synced developer docs so Gmail is no longer marked as merely planned and developer SMS is no longer documented as frontend-only

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

### AI 2 local permission batch — pending commit / verification
- FE.15 / PERM-001: `components/Shell.tsx` now uses the computed `visibleNav` list for the bottom pill nav instead of a fixed 5-item bar, so Payments / Clients / Waitlist / Portfolio / Attendance / Cash / Membership / Analytics / Billing / Settings are reachable from the UI when the role has access
- FE.15 follow-up: the pill nav is now horizontally scrollable on narrow screens, and missing icon cases (`portfolio`, `cash`, `billing`) were added so the expanded nav still looks intentional
- FE.16 / PERM-002: `app/dashboard/page.tsx` shortcut filtering now uses permission-driven `pageId` checks plus `settings_access` visibility instead of hardcoded barber/student label filters, so enabling a page in Roles & Permissions can actually surface the shortcut
- FE.17 / PERM-004: `app/payments/page.tsx` now imports `usePermissions()`, shows a clean access-restricted state when `pages.payments` is disabled, and stops using a raw `isOwner` gate as the only frontend permission model
- FE.17 follow-up: Payments actions now match backend intent more closely:
  - reconcile = owner/admin
  - sync tips = owner
  - refund button = owner/admin
- FE.18 / BUG-004: `components/Shell.tsx` profile password flow now matches backend validation with `min 8 characters` copy and guardrails
- FE.19 / BUG-007: `components/Shell.tsx` profile modal now exposes the `Password` tab when the role has `settings_access.change_password`

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
  - `Settings -> Roles & Permissions` mobile cards now expand/collapse per page (`Dashboard`, `Calendar`, `History`, `Clients`, etc.) instead of rendering one extra-long always-open list
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

See also: [[Tasks/SMS Finalization Plan|SMS Finalization Plan]] · [[Tasks/Telnyx-Integration-Plan|Telnyx Integration Plan]] · [[Tasks/Platform-Sender-Pivot-Decision|Platform Sender Pivot Decision]]

### Decision log — 2026-04-15

Three-AI consensus (Claude / Codex / Verdent):

- **Launch path:** залишаємось на dual-path (per-workspace toll-free + grandfathered manual 10DLC + email-only fallback)
- **NOT doing now:** Verdent's proposed `allowGlobalFallback` removal / shared `TELNYX_FROM` sender — platform-as-sender вже був rejected code 710 у квітні, повторний спроб без Telnyx approval = другий 710
- **Doing now:** Telnyx hardening P0 (Verify profile, webhook sig, `phone_number_index`, pagination, auto-provision on plan activation) — див. [[Tasks/Telnyx-Integration-Plan]]
- **Gated behind Jonathan reply:** окремий Platform-Sender-Pivot-Plan — writen only after Telnyx confirms shared-sender is compliant; draft inquiry letter в [[Tasks/Platform-Sender-Pivot-Decision]]

### Telnyx hardening — active work items (AI 1)

- [ ] **Gap 1** — `TELNYX_VERIFY_PROFILE_ID` — **BLOCKED** on Telnyx account `whitelisted_destinations` issue (pending Jonathan call). Fallback path works; not a launch blocker.
- [x] **Gap 2** — `verifyTelnyxWebhookSignature()` Ed25519 helper implemented in `backend/index.js`, called in both Telnyx webhook handlers. **Enforcing gated** on `TELNYX_WEBHOOK_PUBLIC_KEY` — owner to add to GitHub Secrets + one-line append to `.github/workflows/deploy-backend.yml`. Helper is a safe no-op until the secret is set.
- [x] **Gap 3** — `phone_number_index` Firestore collection writes in both `provisionTollFreeSmsForWorkspace()` and `POST /api/sms/verify-otp`; `POST /api/webhooks/telnyx` uses O(1) lookup + `collectionGroup('clients')` for STOP/HELP opt-out propagation instead of scanning every workspace.
- [x] **Gap 4** — `runAutoReminders()` replaced `limit(100)` with `startAfter`-based pagination, 50 per batch, no upper cap per cycle.
- [x] **Gap 5** — `autoProvisionSmsOnActivation()` non-throwing helper with legacy/protected/in-flight/max-retries guards; exponential backoff (5m→15m→45m→2h→6h → `failed_max_retries`); audit log; wired into `/auth/signup`, `handleStripeEvent`, `/api/billing/apple-verify`. New `runSmsAutoProvisionRetry()` background job paginates workspaces and fires due retries, added to the main `setInterval`.
- [ ] Add `TELNYX_WEBHOOK_PUBLIC_KEY` secret + CI/CD wiring (**owner task**)
- [ ] Live verification after deploy: new workspace auto-activation, Element legacy untouched, OTP fallback vs Verify, STOP/HELP via `phone_number_index`, email-only fallback for failed provision

### Jonathan / Telnyx operational track

- [ ] Надіслати draft letter з [[Tasks/Platform-Sender-Pivot-Decision]] на `10dlcquestions@telnyx.com` (або Jonathan напряму)
- [ ] Записати відповідь в `DevLog/YYYY-MM-DD.md`
- [ ] Якщо Telnyx підтвердить shared-sender — створити новий `Platform-Sender-Pivot-Plan.md` з TFV, consent re-flow, legal diffs
- [ ] Якщо ні — оновити `SMS-Strategy-Review.md` як final decision

---


### SMS finalization checklist — do this now

#### AI 2 — frontend / UX / reviewer-facing validation
- [ ] Verify new workspace `Settings -> SMS Notifications` shows the toll-free-first card by default
- [ ] Verify new workspace does **not** surface EIN / SP registration as the primary setup path
- [ ] Verify toll-free states render correctly: `not enabled -> provisioning -> pending/configured/failed`
  - User-facing `Configured` currently maps from backend `sms_registration_status: 'active'`
- [x] Update frontend SMS UX for Gap 5 so new-workspace messaging is status-first / auto-activated instead of manual-enable-first
- [ ] Verify booking + waitlist consent copy uses `{shopName} Appointment Notifications`
- [ ] Verify email-only fallback copy is clear whenever workspace SMS is not active
- [ ] Verify the legal pages still match the live SMS consent text after deploy

#### AI 1 — backend / ops / Telnyx finalization
- [ ] Create the real Telnyx Verify Profile and capture `TELNYX_VERIFY_PROFILE_ID` — **BLOCKED**
  - Telnyx requires "whitelisted_destinations for call settings" even though we only need SMS
  - We added US+Canada to Outbound Voice Profile allowed destinations but Telnyx still blocks
  - **Action**: Ask Jonathan on next call to resolve this account-level blocker
  - **NOT a launch blocker**: OTP works via legacy fallback (local 6-digit code + SMS)
- [ ] Save `TELNYX_VERIFY_PROFILE_ID` as the GitHub secret — **BLOCKED** (waiting for profile creation)
- [x] Confirm OTP endpoints work before and after secret — **CODE VERIFIED**
  - Without secret: legacy local 6-digit code via Firestore + SMS
  - With secret: Telnyx Verify API. Both have rate limiting.
- [x] Confirm toll-free does not fall back to global sender — **CODE VERIFIED**
  - All reminder callers use `allowGlobalFallback: false`. No own number = email-only.
- [ ] Confirm toll-free status semantics match reality
  - `POST /api/sms/enable-tollfree` currently writes `sms_registration_status: 'active'` immediately after provisioning
  - AI 1 must confirm this matches real Telnyx delivery readiness; if not, change the status lifecycle before launch
- [x] Confirm Element Barbershop untouched — **CODE VERIFIED**
  - `enable-tollfree` blocks if status is not `none`/`rejected`. Element safe.
- [ ] Get written Telnyx confirmation or internal pilot sign-off — **OWNER TASK** (call with Jonathan)

#### Joint sign-off
- [ ] One fresh workspace passes toll-free-first SMS setup
- [ ] One grandfathered/pending manual workspace still shows the manual path
- [ ] OTP flow passes end-to-end
- [ ] Booking consent text, privacy, and terms all match the live product

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
- [x] 1.7 Backend fallback consent text aligned
  - Generic `sms_consent_text` fallback now matches the current appointment-notifications wording instead of the older pre-pivot SMS copy

### Frontend (AI 2) — IN PROGRESS
- [x] 2.1 Settings — toll-free-first SMS card for new workspaces
  - `Settings -> SMS Notifications` now treats toll-free as the default path
  - States are framed around enable/provisioning/pending/configured/failed instead of EIN-first setup
  - User-facing `Configured` currently maps to backend `sms_registration_status: 'active'`
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
- [x] 2.8 Toll-free copy softened
- [x] 2.9 SMS UI reframed around auto-activation
  - `app/settings/page.tsx` now treats SMS as automatic-first for new workspaces instead of a manual-enable-first flow
  - `app/signup/page.tsx` now frames dedicated toll-free SMS as something that normally starts automatically after trial or paid-plan activation
- [x] 2.10 Manual SMS CTA removed from new-workspace flow
  - `Settings -> SMS Notifications` now shows automatic activation / automatic retry messaging instead of a primary manual enable button
  - `app/signup/page.tsx` no longer offers a direct "Start SMS setup now" action for the default new-workspace path
  - `Settings` and `signup` SMS copy now avoids over-promising that toll-free reminders are already fully live before the remaining Telnyx / pilot sign-off is complete
- [x] 2.11 SMS state copy aligned with backend auto-retry lifecycle
  - `app/settings/page.tsx` now distinguishes between background auto-retry and terminal `failed_max_retries`
  - auto-retry stays framed as automatic, while terminal failure is shown as support-review-needed instead of a misleading generic retry state
- [x] 2.9 SMS settings auth path hardened
  - `Settings -> SMS Notifications` now uses the shared auth-aware API helper instead of raw `fetch(window.__API...)`
  - Toll-free enable, manual registration, and OTP verification now follow the same Bearer-token / session handling as the rest of Settings
- [ ] 2.6 Live verification
  - Pending browser pass for toll-free-first settings UX, grandfathered manual resume state, and email-only fallback behavior

### Pre-deploy
- [ ] Create Telnyx Verify Profile → `TELNYX_VERIFY_PROFILE_ID`
- [x] Add env var to Cloud Run deploy workflow — wired in `.github/workflows/deploy-backend.yml`
- [ ] Written Telnyx confirmation or internal pilot sign-off for Vurium-managed toll-free appointment reminders
- [ ] Confirm Element / existing manual 10DLC workspaces remain untouched after the pivot
  - `Element Barbershop` is the explicit protected failed-review remediation case; do not migrate or rewrite its SMS path while website / CTA fixes are in progress

## Code Quality & Security (2026-04-13)

> Виявлено в результаті повного аудиту codebase. Деталі: [[Production-Plan-AI1]] Phase 5, [[Production-Plan-AI2]] Phase 5.

### AI 1 — Claude (Backend)

- [ ] **5.1 P0** — Анулювати Twilio recovery code в консолі → видалити `docs/Telnyx/twilio_2FA_recovery_code.txt` з git history (`git filter-repo`)
- [ ] **5.2 P0** — Видалити demo credentials (`applereview@vurium.com / ReviewTest2026!`) з `docs/APPLE_REVIEW_CHECKLIST.md` → перенести в 1Password
- [ ] **5.3 P1** — Додати distributed lock для background jobs (Firestore TTL lock) щоб запобігти дублюванню при горизонтальному масштабуванні Cloud Run
- [ ] **5.4 P2** — Замінити plaintext `phone_norm` на HMAC-SHA256 blind index + написати migration script для існуючих clients
- [ ] **5.5 P2** — Розбити `backend/index.js` (10 351 рядок) на `routes/`, `lib/`, `jobs/` модулі без зміни логіки
- [ ] **5.6 P3** — Migrate legacy SMS statuses → видалити `LEGACY_SMS_STATUSES` Set після конвертації Firestore записів

### AI 2 — Codex (Frontend)

- [ ] **5.1 P1** — Прибрати дублювання auth в `lib/api.ts`: видалити `localStorage.getItem('VURIUMBOOK_TOKEN')`, залишити тільки `credentials: 'include'` (httpOnly cookie)
- [ ] **5.2 P2** — Розбити `app/settings/page.tsx` (2 559 рядків) на окремі таби в `app/settings/tabs/`
- [ ] **5.3 P3** — Замінити inline style-константи (`inp`, `card`, `lbl` тощо) в `settings/page.tsx` на Tailwind className або `styles.ts`
- [ ] **5.4 P0** *(docs — вже виконано)* — `app/signup/page.tsx` додано до ownership AI 2 в `AI-Work-Split.md`

---

## Other Active Tasks

- [ ] Verify Vurium Inc. brand on Telnyx (send CP-575A + Articles of Incorporation)
- [ ] Reply to 10dlcquestions about deleted brand BQY3UXK
- [ ] Call with Jonathan (Telnyx) — Mon-Fri next week, 10AM-4PM CT
- [x] Add ADMIN_NOTIFY_EMAIL GitHub Secret — user confirmed configured
- [ ] Save the real Telnyx Verify Profile ID as the GitHub secret `TELNYX_VERIFY_PROFILE_ID`
- [x] Gmail API integration for Developer panel — **CODE-COMPLETE** (verified 2026-04-15): 6 endpoints in `backend/index.js` (~2754–3040), frontend already wired at `app/developer/email/page.tsx`, secrets in `GitHub Secrets Inventory.md`. Only owner-side operation remains: verify OAuth redirect URI in Google Cloud Console + click Connect for each mailbox (support/billing/sales/security) in `/developer/email`
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
