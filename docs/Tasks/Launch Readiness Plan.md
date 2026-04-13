# Launch Readiness Plan — Unified

> [[Home]] > Tasks | See also: [[Production-Plan-AI1]], [[Production-Plan-AI2]], [[AI-Work-Split]]

> Goal: finish VuriumBook to a sell-ready, production-safe, client-friendly state.
> Both AI agents agreed on this merged plan (2026-04-14).

## Definition of sell-ready
- New business can sign up, onboard, and start taking bookings without manual rescue
- Billing works correctly for web and iOS customers
- Booking, reschedule, cancel, waitlist, and payment flows work end-to-end
- Settings are easy to understand on mobile and desktop
- Production deploys are stable and reversible
- Product feels professional enough to demo and sell

---

## P0 — Must fix before selling

### Backend & Security (AI 1)

**P0.1 Webhook signature verification (Stripe + Square)**
- Owner: AI 1
- What: Implement `stripe.webhooks.constructEvent()` and Square HMAC verification
- Why: Currently accepts ANY POST as valid — attacker can forge payment events
- Success criteria: Invalid signatures → 400; valid ones process normally
- Verify: Send test webhook with wrong signature → rejected

**P0.2 Fix `spAmountCents` in Square reconciliation**
- Owner: AI 1
- What: Replace `spAmountCents` with `spServiceCents` (~lines 1404, 5190)
- Why: Wrong payment amounts recorded silently
- Success criteria: Square reconciliation records correct service_amount
- Verify: Process Square payment → booking.service_amount matches

**P0.3 Cloud Run stability + rollback runbook**
- Owner: AI 1
- What: Add health check endpoint, ensure reliable startup, document rollback procedure
- Why: 4 consecutive deploy failures (2026-04-13) due to syntax error
- Success criteria: Deploy succeeds; if it fails, previous revision stays active
- Verify: Push backend change → deploys → API responds at /health
- Runbook: if deploy fails → `gcloud run services update-traffic vuriumbook-api --to-revisions=PREVIOUS=100`

**P0.4 Billing verification matrix**
- Owner: AI 1
- What: Verify end-to-end: Stripe create/cancel/upgrade, Apple IAP receipt validation, Square reconciliation, refunds, webhook → plan_type updates
- Why: Billing is revenue — must be bulletproof
- Success criteria: Each billing path tested with sandbox transactions
- Verify: Create subscription → plan_type updated → cancel → reverted
- Include: Frontend-visible state (plan badge, gated features, cancel actions) must match backend

**P0.5 Auth and security audit**
- Owner: AI 1
- What: Verify signin/signup/reset, Apple/Google auth, JWT, role permissions, rate limiting
- Success criteria: No endpoint accessible without auth; rate limits active
- Verify: Protected endpoint without token → 401; rate limit exceeded → 429

**P0.6 Data integrity — full chain verification**
- Owner: AI 1
- What: Verify booking → payment → tip → payroll → cash → expenses chain
- Success criteria: Payroll audit returns 0 warnings on real production data
- Verify: Run /api/payroll/audit → all green; test real workflow: book → pay cash → check payroll → check cash register → add expense → check owner net

**P0.7 Server-side price verification**
- Owner: AI 1
- What: Don't trust client-sent amount_cents — verify against service price in DB
- Why: Revenue risk — customer could manipulate payment amount
- Success criteria: Backend rejects amount that doesn't match service price (within tolerance)
- Verify: Send booking with wrong amount → rejected or corrected

**P0.8 Booking idempotency**
- Owner: AI 1
- What: Prevent double-booking from rapid form submission
- Why: Double-submit creates duplicate bookings — confusing for barber and client
- Success criteria: Same idempotency key within 60s returns existing booking
- Verify: Submit same booking twice rapidly → only one created

### Frontend & UX (AI 2)

**P0.9 Settings mobile drill-down navigation**
- Owner: AI 2
- What: Mobile settings feels like iPhone-style navigation, not hidden content
- Why: Settings currently confusing on phone — users don't know to scroll down
- Success criteria: Tap category → dedicated screen; back button works
- Verify: Open settings on iPhone → navigate all categories without confusion

**P0.10 Settings save/load verification**
- Owner: AI 2
- What: UI always matches backend state across all settings categories
- Success criteria: Change setting → reload → same value shown
- Verify: Toggle each setting type → refresh page → values persist

**P0.11 Full customer path audit**
- Owner: AI 2
- What: Test: Landing → Sign up → Onboarding → Dashboard → Public booking → Manage booking → Billing
- Success criteria: New user completes full path without getting stuck
- Verify: Create new workspace from scratch → complete all steps

**P0.12 Remove alert()/confirm() from client-facing flows**
- Owner: AI 2
- What: Replace native dialogs with styled modal components
- Why: alert() looks unprofessional for a paid product
- Success criteria: No native browser dialogs in owner or customer flows
- Verify: Use product for 10 min → no alert() popups

**P0.13 Role-based visibility verification**
- Owner: AI 2
- What: Barbers don't see owner settings; students see limited views
- Success criteria: Login as each role → only see permitted UI
- Verify: Login as barber → settings/payroll/billing not accessible

**P0.14 Mobile usability on key pages**
- Owner: AI 2
- What: Verify: /settings, /dashboard, /book/[id], /manage-booking, /billing, /signin
- Success criteria: All flows usable on iPhone SE (375px) without horizontal scroll
- Verify: Test each page on mobile Safari

**P0.15 Timezone indicator on booking page**
- Owner: AI 2
- What: Show "All times in [Timezone]" near time slots
- Why: Customers in different timezone see wrong times without knowing
- Success criteria: Timezone badge visible on step 2 (time selection)
- Verify: Open booking page → timezone shown

**P0.16 Fix form data loss on booking page**
- Owner: AI 2
- What: If slot becomes unavailable, don't lose name/email/phone
- Why: Customer fills form → slot taken → all data gone → frustration
- Success criteria: Form fields preserved when going back to time selection
- Verify: Fill form → go back → fields still populated

**P0.17 Calendar mobile layout**
- Owner: AI 2
- What: Fix calendar responsive layout — currently assumes desktop viewport
- Why: Most salon owners use phones; calendar is main daily tool
- Success criteria: Calendar usable on 375px width without horizontal scroll
- Verify: Open calendar on iPhone → view/create bookings

---

## P1 — Strong polish before launch

### AI 1
- **P1.1** Fix N+1 queries in webhook handlers (add merchant_id mapping)
- **P1.2** Fix silent `.catch(() => {})` in payment/booking chains (add logging)
- **P1.3** Create missing Firestore composite indexes
- **P1.4** Add webhook event logging for debugging

### AI 2
- **P1.5** Add loading/disabled states to all action buttons (prevent double-clicks)
- **P1.6** Fix Dashboard timezone (defaults to Chicago until API responds)
- **P1.7** Tighten dashboard clarity for first-time owners
- **P1.8** Polish booking UX (service selection, pricing visibility, waitlist)
- **P1.9** Polish billing/settings messaging (Stripe + Apple subscription states)
- **P1.10** Improve empty states and helper text

---

## P2 — After core launch

### AI 1
- API pagination (clients, payments, messages)
- Rate limiting per endpoint
- Email retry queue
- Production monitoring + health check

### AI 2
- Marketing pages polish (/, /pricing, /support, /faq)
- Normalize dialog/confirmation patterns
- Sorting on payment/client tables
- Bulk actions (delete multiple clients)
- Open Graph tags for booking page social sharing

---

## Shared tasks (coordinate before working)

| Task | AI 1 scope | AI 2 scope |
|------|-----------|-----------|
| Billing state | Backend webhooks + plan_type | Frontend plan badge + gated features |
| Booking flow | Backend validation + idempotency | Frontend UX + form persistence |
| Calendar | Backend schedule/availability API | Frontend mobile layout |
| Payroll audit | Backend /api/payroll/audit | Frontend audit panel display |

---

## Unified release checklist
- [ ] Production frontend deploy confirmed (Vercel)
- [ ] Production backend deploy confirmed (Cloud Run)
- [ ] Signup → Onboarding → Dashboard works
- [ ] Signin / Password reset / Apple / Google auth works
- [ ] Billing state matches subscription (Stripe + Apple)
- [ ] Public booking: select → book → pay → confirm
- [ ] Cancel/reschedule with correct restrictions
- [ ] Waitlist works when enabled
- [ ] Payment records match booking records
- [ ] Payroll audit → 0 warnings
- [ ] Cash register matches calendar
- [ ] Owner can configure business on mobile
- [ ] Settings mobile drill-down works
- [ ] No alert()/confirm() in customer flows
- [ ] Role permissions enforced (barber/admin/owner)
- [ ] Webhook signatures verified (Stripe + Square)
- [ ] Calendar usable on mobile
- [ ] Timezone shown on booking page
