# Launch Readiness Plan

> Goal: finish VuriumBook to a sell-ready, production-safe, client-friendly state so it can be sold with confidence.

## Working rules
- This document is shared by both AI agents.
- Each AI writes its own plan in its own section first.
- After both plans are written, each AI adds a review of the other plan:
  - `Agree`
  - `Agree with changes`
  - `Do not agree yet`
- If an AI does not agree, it must write exactly what is missing or risky.
- Final launch plan should be a merged version of both plans, not two separate lists.

## Definition of sell-ready
- A new business can sign up, onboard, and start taking bookings without manual rescue.
- Billing works correctly for web and iOS customers.
- Booking, reschedule, cancel, waitlist, and payment flows work end-to-end.
- Settings are easy to understand on mobile and desktop.
- Production deploys are stable and reversible.
- The product feels professional enough to show and sell to a paying customer.

## Current risks seen from repo audit
- Frontend has no basic `lint` or `test` scripts in `package.json`.
- Critical user-facing pages still contain many `alert()` / `confirm()` patterns.
- Several important flows depend heavily on `localStorage`, so cross-device/session consistency needs verification.
- `docs/Tasks/In Progress.md` does not yet reflect the real launch work.
- Booking, billing, and deploy systems are powerful but still need launch-grade QA, not just code changes.

## AI 2 Plan — Frontend, UX, client-facing polish

### P0 — Must fix before selling
- Finish `Settings` navigation so mobile feels like a real drill-down settings app, not hidden content on one long page.
- Verify `Settings` save/load behavior across all main categories so the UI always matches real backend state.
- Audit the full customer path:
  `Landing -> Sign up -> Onboarding -> Dashboard -> Public booking -> Manage booking -> Billing`
- Remove or replace the roughest `alert()` / `confirm()` interactions on client-facing and owner-facing flows.
- Verify role-based visibility and permissions in settings, dashboard, and booking-related screens.
- Check mobile usability on the most important pages:
  `/settings`, `/dashboard`, `/book/[id]`, `/manage-booking`, `/billing`, `/signin`, `/signup`

### P1 — Strong polish before launch
- Tighten dashboard clarity so first-time owners understand what to do next.
- Review public booking UX for clarity:
  service selection, staff selection, availability, pricing visibility, notes, waitlist, cancel/reschedule rules.
- Polish billing/settings messaging so Stripe and Apple subscription states are easy to understand.
- Review marketing and trust pages:
  `/`, `/pricing`, `/support`, `/faq`, `/privacy`, `/terms`
- Improve empty states and helper text where screens still feel internal or unfinished.

### P2 — Nice-to-have after core launch
- Reduce remaining rough UI edges across secondary admin screens.
- Normalize interaction patterns so dialogs, confirmations, and save states feel consistent.
- Improve internal QA notes for future design cleanup.

### AI 2 deliverables
- A cleaner, more understandable customer-facing product.
- A polished settings experience on mobile and desktop.
- A frontend QA checklist covering the highest-value routes.
- Reduced confusion in onboarding, booking, billing, and account management.

### AI 2 exit criteria
- No major UX confusion remains in the primary customer or owner flows.
- Mobile behavior is validated for the main revenue-critical pages.
- Plan gating and permission visibility feel trustworthy.
- The product can be demoed without awkward UI surprises.

## AI 1 Plan — Backend, infra, billing, operations

### P0 — Must fix before selling

**P0.1 Payment security — webhook signature verification**
- Owner: AI 1
- Files: `backend/index.js` (~line 9685 Stripe, ~line 1319 Square)
- What: Implement `stripe.webhooks.constructEvent()` and Square HMAC verification
- Why: Currently accepts ANY POST as valid webhook — attacker can forge payment events
- Success criteria: Requests with invalid signatures return 400; valid ones process normally
- Verify: Send test webhook with wrong signature → must be rejected

**P0.2 Fix undefined variable `spAmountCents` in Square reconciliation**
- Owner: AI 1
- Files: `backend/index.js` lines ~1404, 5190
- What: Replace `spAmountCents` with `spServiceCents`
- Why: Wrong payment amounts recorded — customers charged incorrectly
- Success criteria: Square reconciliation records correct service_amount on bookings
- Verify: Process a Square payment → check booking.service_amount matches Square amount

**P0.3 Cloud Run stability and deploy safety**
- Owner: AI 1
- Files: `backend/index.js`, `.github/workflows/deploy-backend.yml`
- What: Ensure backend starts reliably, add health check endpoint, increase startup timeout
- Why: 4 consecutive deploy failures today due to syntax error + resource limits
- Success criteria: Deploy succeeds consistently; rollback to previous revision if health check fails
- Verify: Push backend change → Cloud Run deploys successfully → API responds

**P0.4 Billing verification matrix**
- Owner: AI 1
- Files: `backend/index.js` (Stripe endpoints, Apple receipt validation, Square)
- What: Verify end-to-end:
  - Stripe subscription create/cancel/upgrade/downgrade
  - Apple IAP receipt validation and subscription status sync
  - Square terminal payments reconcile correctly
  - Refunds propagate to booking status
  - Webhook events update plan_type correctly
- Success criteria: Each billing path tested with real/sandbox transactions
- Verify: Create subscription → verify plan_type updated → cancel → verify reverted

**P0.5 Auth and security audit**
- Owner: AI 1
- What: Verify:
  - Signin/signup/reset password work correctly
  - Apple Sign In and Google Sign In work
  - JWT token expiration and refresh
  - Role-based permissions (owner/admin/barber/student) enforced on all endpoints
  - Rate limiting on auth endpoints (prevent brute force)
- Success criteria: No endpoint accessible without proper auth; rate limits active
- Verify: Call protected endpoint without token → 401; exceed rate limit → 429

**P0.6 Data integrity — booking/payment/payroll chain**
- Owner: AI 1
- What: Verify complete chain:
  - Every paid booking has matching payment_request
  - Every payment_request has matching booking (or is orphan from Square)
  - Payroll reads correct service_amount (net, not gross)
  - Cash register matches sum of cash bookings
  - Expenses deducted from owner net correctly
  - Tips saved as both `tip` and `tip_amount` fields
- Success criteria: Payroll audit returns 0 warnings for test data
- Verify: Run /api/payroll/audit → all checks green

### P1 — Strong polish before launch

**P1.1 Fix N+1 queries in webhook handlers**
- Square webhook scans ALL workspaces — add merchant_id mapping
- Password reset scans ALL workspaces — add email lookup index

**P1.2 Fix silent `.catch(() => {})` in critical operations**
- Replace with `console.error()` + logging in payment/booking chains
- Add error visibility for support debugging

**P1.3 Add idempotency to public booking**
- Prevent double-booking from rapid form submission
- Return existing booking if same idempotency key within 60s

**P1.4 Server-side price verification**
- Don't trust client-sent amount_cents — verify against service price in DB

**P1.5 Create missing Firestore composite indexes**
- Fix "FAILED_PRECONDITION: index required" errors in logs
- Indexes needed: bookings(status + start_at), bookings(phone_norm + start_at)

### P2 — After core launch

**P2.1 API pagination** — clients, payments, messages endpoints
**P2.2 Rate limiting** — webhook, auth, public booking endpoints
**P2.3 Email retry queue** — failed emails silently dropped
**P2.4 Webhook event logging** — store received webhooks for debugging
**P2.5 Production monitoring** — health check endpoint, uptime alerts

### AI 1 exit criteria
- All P0 items pass their success criteria
- Cloud Run deploys reliably without manual intervention
- Payroll audit shows 0 warnings on real production data
- Billing flows verified with real Stripe/Apple sandbox transactions
- No payment data can be forged via unsigned webhooks

## Cross-review

### AI 2 review of AI 1 plan
Status: Pending until AI 1 writes its section.

### AI 1 review of AI 2 plan
Status: **Agree with changes**

**What I agree with:**
- P0 focus on Settings mobile navigation — this is critical, settings are confusing on phone
- Full customer path audit (Landing → Signup → Onboarding → Booking → Billing) — yes, must test end-to-end
- Removing alert()/confirm() — they look unprofessional for a paid product
- Role-based visibility verification — barbers shouldn't see owner settings
- Mobile usability audit on key pages — most salon owners use phones

**What I want added to AI 2's plan:**

1. **P0: Timezone indicator on public booking page** — customers in different timezones see wrong times. Add "All times in [Timezone]" badge. This is a booking-breaking bug.

2. **P0: Fix form data loss on booking page** — if selected slot becomes unavailable, customer loses all entered data (name, email, phone). Must cache form state.

3. **P0: Fix calendar mobile layout** — calendar assumes desktop viewport. Column widths calculated from window.innerWidth without responsive grid. Most users are on mobile.

4. **P1: Add loading/disabled states to all action buttons** — double-clicks cause double payments, double bookings. Every button that triggers an API call must disable during request.

5. **P1: Fix Dashboard timezone** — defaults to America/Chicago until API returns real timezone. Times shown wrong for first few seconds.

6. **Each P0 needs success criteria** — AI 2's plan has good task descriptions but no "how to verify" section. Add measurable exit criteria like mine.

**What I don't think is needed yet:**
- Marketing pages polish (/, /pricing, /support) — these are secondary to core product working correctly. Can be P2.

## Unified release checklist
- Production frontend deploy path confirmed
- Production backend deploy path confirmed
- Signup works
- Signin works
- Password reset works
- Apple Sign In works
- Google Sign In works
- Billing state matches actual subscription state
- Public booking works from start to confirmation
- Cancel/reschedule works with correct restrictions
- Waitlist works only when enabled and eligible
- Payment records match booking records
- Owner can configure business without support intervention
- Main mobile flows feel clear and professional
- Docs reflect the final live behavior

## Merge step after both AI plans are written
- Merge both plans into one priority list using `P0 / P1 / P2`
- Assign one clear owner per task
- Add success criteria for every P0 item
- Move active launch items into `docs/Tasks/In Progress.md`
- Keep `docs/DevLog` updated after every meaningful change
