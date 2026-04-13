# Launch Readiness Plan — Closure

> [[Home]] > Tasks | See also: [[Production-Plan-AI1]], [[Production-Plan-AI2]], [[AI-Work-Split]], [[Tasks/In Progress|In Progress]], [[Tasks/SMS-Strategy-Review|SMS Strategy Review]]
> Updated: 2026-04-15

> Goal: close the remaining gap between “implemented” and “sell-ready.”
> This document is the stable launch decision doc. Day-to-day movement belongs in [[Tasks/In Progress|In Progress]].

## 1. Completed foundation

### Backend / platform foundation

- Webhook verification is implemented for Stripe, Square, and Stripe Connect
- Server-side price verification is implemented
- Booking idempotency is implemented for public booking submission
- Cloud Run health check and rollback path are implemented
- Billing backend fixes are in place, including Apple expiry handling and billing-state hardening
- Core payroll / cash / expenses integrity checks are implemented
- Telnyx Verify support exists in the backend and deploy wiring now includes `TELNYX_VERIFY_PROFILE_ID`

### Frontend / customer-facing foundation

- Stale-session black-screen behavior was fixed; protected screens redirect to `/signin`
- Native `alert()` / `confirm()` / `prompt()` usage was removed from the edited sell-critical flows
- Booking draft persistence and `idempotency_key` support are implemented
- Settings mobile drill-down navigation is implemented
- Booking timezone indicator, billing messaging, dashboard clarity work, and major mobile polish are implemented
- Marketing copy cleanup, route metadata, sorting, and bulk-action work are implemented

These items are no longer open discovery work. They now need verification, not redesign.

## 2. Launch verification now

This is the real pre-sale checklist. Each item should be verified live and then marked done in [[Tasks/In Progress|In Progress]].

### Settings and owner setup

**Settings mobile drill-down**
- Owner: AI 2
- Success criteria: On iPhone, category tap opens a dedicated detail view and back navigation is obvious
- Verify scenario: Open `/settings` on iPhone, enter every major category, return back out, confirm nothing feels hidden below the fold

**Settings save/load parity**
- Owner: AI 2
- Success criteria: Edited values survive refresh and public behavior matches saved state
- Verify scenario: Toggle booking/display settings, refresh, then confirm the same values render and public booking reflects them

**Role-based access**
- Owner: AI 2
- Success criteria: Owner/admin/barber/student only see permitted screens and settings content
- Verify scenario: Login as each role and confirm restricted settings, payroll, billing, and navigation stay blocked or hidden as expected

**First-run owner journey**
- Owner: AI 2
- Success criteria: A new workspace can go from signup to a usable dashboard and booking link without manual rescue
- Verify scenario: Signup, complete onboarding, land on dashboard, follow setup prompts, open booking link, and confirm there are no dead ends

### Booking and client experience

**Public booking core flow**
- Owner: AI 2
- Success criteria: Service, staff, time, details, payment, and confirmation all feel coherent
- Verify scenario: Open a live booking page, choose service and time, fill details, pay or confirm, and verify final success state

**Booking draft persistence**
- Owner: AI 2
- Success criteria: Name, email, phone, notes, and consent survive back-navigation or slot loss
- Verify scenario: Fill the form, go back or force an unavailable slot path, then confirm the client data is still present

**Timezone clarity**
- Owner: AI 2
- Success criteria: Booking time selection clearly shows the timezone
- Verify scenario: Open booking step 2 and summary, confirm the timezone label is visible and understandable

**Waitlist path**
- Owner: AI 2
- Success criteria: Waitlist join flow works when enabled and communicates next steps clearly
- Verify scenario: Choose a no-times day, join waitlist, and confirm success copy plus saved consent metadata behavior

**Manage booking restrictions**
- Owner: AI 2
- Success criteria: Cancel/reschedule rules match configured restrictions
- Verify scenario: Open manage-booking links in allowed and blocked windows and confirm the UI matches the business rules

### Billing, auth, and dashboard behavior

**Billing state parity**
- Owners: AI 1 + AI 2
- Success criteria: UI and backend agree on Apple-managed vs web-managed subscription state
- Verify scenario: Test one Apple-managed workspace and one web-billing workspace; compare plan badge, available actions, and gated features

**Auth/session resilience**
- Owner: AI 2
- Success criteria: Expired sessions redirect cleanly and PIN unlock offers a safe fallback
- Verify scenario: Open a protected page with a stale session, confirm redirect to `/signin`; test PIN flow and `Use password instead`

**Dashboard mobile setup behavior**
- Owner: AI 2
- Success criteria: The owner setup banner/checklist appears only when appropriate and does not flicker or trap the user
- Verify scenario: Open dashboard on mobile with an incomplete workspace and confirm `Finish setup` is stable, useful, and opens the right next step

**Calendar mobile usability**
- Owner: AI 2
- Success criteria: Calendar is usable on 375px width and key editing surfaces remain reachable
- Verify scenario: Open `/calendar` on iPhone width, pan through team columns, and create/edit a booking without layout breakage

### SMS verification and setup

**Settings SMS wizard**
- Owner: AI 2
- Success criteria: The wizard is understandable on mobile and can resume pending verification state
- Verify scenario: Open `Settings -> SMS Notifications`, walk through the steps, refresh mid-flow, and confirm resume state stays coherent

**Telnyx Verify OTP**
- Owner: AI 1 + AI 2
- Success criteria: Public OTP uses fallback safely without the secret, and Telnyx Verify once the secret exists
- Verify scenario: Test `/public/verify/send/:wsId` and `/public/verify/check/:wsId` first without `TELNYX_VERIFY_PROFILE_ID`, then again after the real secret is configured

## 3. External blockers / operational prerequisites

These are not code redesign items. They are operational steps that must be finished around launch.

- Create a Telnyx Verify Profile and obtain the real `TELNYX_VERIFY_PROFILE_ID`
- Save `TELNYX_VERIFY_PROFILE_ID` as a GitHub secret so Cloud Run can use Telnyx Verify
- Verify Vurium Inc. brand with Telnyx and finish required messaging compliance steps
- Confirm remaining runtime secrets are present and correct in GitHub / Cloud Run
- Confirm the production frontend revision on Vercel and backend revision on Cloud Run are the intended launch revisions
- Confirm Apple sandbox/live billing coverage is sufficient for the current subscription paths

## 4. Post-launch backlog

These items are valid next steps, but they are not launch blockers.

- Toll-free auto-provisioning research
- ISV single-sender / partner retry path
- Gmail API work for the developer panel
- Secondary UI cleanup and visual consistency passes
- Additional monitoring, reporting, and non-critical operational polish

## 5. Planning doc ownership

- `[[Tasks/Launch Readiness Plan|Launch Readiness Plan]]` = stable launch decision document
- `[[Tasks/In Progress|In Progress]]` = operational tracker for what is currently open, verified, or blocked
- `[[DevLog/2026-04-14|DevLog]]` and newer dev logs = historical record of what changed
- `[[Tasks/SMS-Strategy-Review|SMS Strategy Review]]` = architecture decision memo for messaging only

This separation should prevent the same issue from being described three different ways across planning, tracking, and history.
