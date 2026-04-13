# In Progress

> [[Home]] > Tasks | See also: [[Tasks/Backlog|Backlog]], [[Tasks/Launch Readiness Plan|Launch Readiness Plan]]

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
- [ ] P0.4 Billing verification matrix
- [ ] P0.5 Auth and security audit
- [ ] P0.6 Data integrity — full chain verification
- [x] P0.7 Server-side price verification — **DONE** commit `b1bdbe9` 2026-04-14
  - Compares payment amount vs booking service_amount
  - Rejects if >2x or <0.5x expected (tolerance for tax/fees)
- [ ] P0.8 Booking idempotency

## P0 — Launch Readiness (AI 2: Frontend)

- [ ] P0.9 Settings mobile drill-down navigation — **IN PROGRESS**
  - Local implementation complete in `app/settings/page.tsx`
  - Pending: browser/iPhone verification before marking done
- [ ] P0.10 Settings save/load verification — **IN PROGRESS**
  - Frontend/backend path re-checked for `online_booking_enabled`, `waitlist_enabled`, `booking.cancellation_hours`, `display.show_prices`, `display.require_phone`, `display.allow_notes`
  - Pending: manual toggle → reload verification pass across categories
- [ ] P0.11 Full customer path audit
- [ ] P0.12 Remove alert()/confirm() — **IN PROGRESS**
  - `app/billing/page.tsx` moved to styled dialog flow for cancel/manage actions
  - `app/settings/page.tsx` key owner flows moved off native `confirm()`; team password reset and owner delete-account also moved off browser `prompt()`
  - `app/signin/page.tsx` forgot-password browser prompt replaced with branded modal
  - Remaining work: broader scan across remaining AI 2 pages before marking done
- [ ] P0.13 Role-based visibility verification
- [ ] P0.14 Mobile usability on key pages
- [ ] P0.15 Timezone indicator on booking page — **IN PROGRESS**
  - Local implementation added to `app/book/[id]/page.tsx`
  - Pending: browser verification on live booking flow
- [ ] P0.16 Fix form data loss on booking page — **IN PROGRESS**
  - Session draft persistence added for `name`, `email`, `phone`, `notes`, `smsConsent`
  - Pending: manual unavailable-slot/back-navigation verification
- [ ] P0.17 Calendar mobile layout

## P1 — Queued

- [ ] P1.1 Fix N+1 queries (AI 1)
- [ ] P1.2 Fix silent .catch() (AI 1)
- [ ] P1.3 Firestore indexes (AI 1)
- [ ] P1.4 Webhook logging (AI 1)
- [ ] P1.5 Button disabled states (AI 2)
- [ ] P1.6 Dashboard timezone (AI 2)
- [ ] P1.7 Dashboard clarity (AI 2)
- [ ] P1.8 Booking UX polish (AI 2)
- [ ] P1.9 Billing messaging (AI 2)
- [ ] P1.10 Empty states (AI 2)

## Other Active Tasks

- [ ] Verify Vurium Inc. brand on Telnyx (send CP-575A + Articles of Incorporation)
- [ ] Reply to 10dlcquestions about deleted brand BQY3UXK
- [ ] Call with Jonathan (Telnyx) — Mon-Fri next week, 10AM-4PM CT
- [ ] Add ADMIN_NOTIFY_EMAIL GitHub Secret
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
