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

- [ ] P0.9 Settings mobile drill-down navigation
- [ ] P0.10 Settings save/load verification
- [ ] P0.11 Full customer path audit
- [ ] P0.12 Remove alert()/confirm()
- [ ] P0.13 Role-based visibility verification
- [ ] P0.14 Mobile usability on key pages
- [ ] P0.15 Timezone indicator on booking page
- [ ] P0.16 Fix form data loss on booking page
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
