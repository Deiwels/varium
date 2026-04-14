# Launch Verification Runbook (VR.4)

> [[Home]] > Tasks | Owner: Verdent (reviewer)
> Related: [[Tasks/Launch Readiness Plan|Launch Readiness Plan]], [[Tasks/Deploy-Smoke-Test|Deploy Smoke Test]], [[Tasks/In Progress|In Progress]]
> Created: 2026-04-15

---

## Purpose

Step-by-step live verification to run **before each launch candidate**. Execute from top to bottom. Mark each item `✅ PASS` / `❌ FAIL / blocker` / `⚠️ WARN / acceptable`. A launch candidate is ready only when all items marked PASS or acceptable WARN.

Run this runbook **after every Sprint deployment** and record results in a new `DevLog/YYYY-MM-DD.md` entry.

---

## Pre-flight (owner)

| # | Action | Verified by |
|---|---|---|
| P1 | Cloud Run revision deployed (check GCP Console → Cloud Run → Revisions) | Owner |
| P2 | Vercel production deployment live (Vercel dashboard → Deployments) | Owner |
| P3 | GitHub Secrets present: `TELNYX_API_KEY`, `TELNYX_FROM`, `TELNYX_VERIFY_PROFILE_ID`, `TELNYX_WEBHOOK_PUBLIC_KEY` | Owner |
| P4 | All other required secrets present in Cloud Run env vars | Owner |
| P5 | A test phone number available for SMS verification | Owner |
| P6 | A test Apple sandbox account available | Owner |
| P7 | Two test workspace accounts available: `fresh_ws` (new, no SMS) and `element_ws` (legacy 10DLC) | Owner |

---

## Section 1 — Auth & Session

### 1.1 Sign In / Sign Out
- [ ] Open app → `/signin` → sign in with email/password → lands on dashboard
- [ ] Sign out from profile modal → redirected to `/signin`, no crash
- [ ] Open protected route with expired/no token → redirect to `/signin` (no black screen)

### 1.2 PIN
- [ ] Set up PIN from profile → lock screen → unlock with correct PIN ✓
- [ ] Enter wrong PIN → error shown, not logged out
- [ ] "Use password instead" link visible and works

### 1.3 Role access
- [ ] Login as **barber** → cannot access `/settings` billing section
- [ ] Login as **student** → only Calendar visible in nav, other pages blocked
- [ ] Login as **admin** → can see team + settings (non-billing)
- [ ] Login as **owner** → full access

---

## Section 2 — New Workspace / Onboarding (FE.1)

### 2.1 Signup
- [ ] Open `/signup` → create new workspace with salon plan
- [ ] OTP sent to phone (`POST /public/verify/send`) → code received on device
- [ ] Enter correct code → phone verified
- [ ] Workspace created → redirected to dashboard
- [ ] `autoProvisionSmsOnActivation` triggered → within 2-5 min `sms_registration_status: active` in Firestore

### 2.2 SMS auto-activation
- [ ] Open `Settings → SMS Notifications` → status shows `provisioning` then `configured` (no manual "Enable SMS" required)
- [ ] `sms_from_number` populated in Firestore workspace settings
- [ ] `phone_number_index/{digits}` document written in Firestore

### 2.3 First-run journey
- [ ] Dashboard shows setup checklist / onboarding prompts
- [ ] Can add a barber, create a service, open public booking link — no dead ends

---

## Section 3 — Element Barbershop (Legacy Path)

- [ ] Login as Element workspace owner
- [ ] `Settings → SMS` shows 10DLC / manual flow (NOT auto-provision button)
- [ ] `isProtectedLegacyWorkspace` guard intact — no auto-provision triggered
- [ ] Existing reminders still fire from Element's own TFN
- [ ] No regression in Element booking or staff flows

---

## Section 4 — Public Booking Flow (FE.2, FE.3)

### 4.1 Core booking
- [ ] Open public booking page `/book/:id`
- [ ] Select service → select barber → select time slot
- [ ] Fill name, email, phone, notes
- [ ] SMS/email consent checkbox visible and required
- [ ] Submit → success state → confirmation email received

### 4.2 Booking settings parity
- [ ] Owner turns off "Show prices" in Settings → public booking hides prices
- [ ] Owner enables "Require phone" → booking rejects without phone
- [ ] Owner disables online booking → page shows disabled message (not form-then-error)

### 4.3 Draft persistence
- [ ] Fill booking form → go back → form data still present

### 4.4 Timezone
- [ ] Time slot picker shows timezone label (e.g. "CST")

### 4.5 Waitlist
- [ ] On a fully-booked day → Waitlist option appears
- [ ] Join waitlist → success message

---

## Section 5 — SMS Flows

### 5.1 Appointment reminder
- [ ] Create booking for `fresh_ws` → `sms_reminders` documents written in Firestore
- [ ] Wait for `runAutoReminders` cycle (3 min) → reminder SMS received on test phone
- [ ] `sms_logs` top-level document written

### 5.2 Satisfaction ping
- [ ] Mark booking complete in CRM → `sms_reminders` ping record created with `+2h` delay
- [ ] After delay (or manual trigger) → satisfaction SMS received

### 5.3 STOP compliance
- [ ] Send "STOP" SMS from test phone to workspace TFN
- [ ] Telnyx webhook fires → `client.sms_opt_out: true` set in Firestore
- [ ] Pending `sms_reminders` for that phone marked `cancelled: true`
- [ ] `phone_number_index` O(1) lookup used (verify no workspace scan in logs)
- [ ] Auto-reply "You have been unsubscribed..." received on test phone

### 5.4 Email fallback
- [ ] Create booking on workspace where `sms_registration_status != active`
- [ ] Confirmation email received (no SMS)
- [ ] Reminder email received at 24h before (not SMS)

### 5.5 OTP flow
- [ ] `POST /public/verify/send/:wsId` → SMS OTP received
- [ ] `POST /public/verify/check/:wsId` with correct code → `{ ok: true }`
- [ ] Wrong code → `{ ok: false }`
- [ ] Rate limit: 4th attempt in 10 min → 429

---

## Section 6 — Webhook Security (Gap 2)

- [ ] `TELNYX_WEBHOOK_PUBLIC_KEY` set in GitHub Secrets
- [ ] `POST /api/webhooks/telnyx` without signature headers → 401
- [ ] `POST /api/webhooks/telnyx-10dlc` without signature headers → 401
- [ ] Valid signed webhook from Telnyx → 200

---

## Section 7 — Billing (FE.7)

### 7.1 Stripe
- [ ] Open `/billing` → upgrade from trial → Stripe checkout loads
- [ ] Complete test payment → plan upgrades → `billing_status: active` in Firestore
- [ ] `autoProvisionSmsOnActivation` triggered by `invoice.payment_succeeded` webhook

### 7.2 Apple IAP
- [ ] Open iOS app → billing → subscribe via Apple sandbox
- [ ] `/api/billing/apple-verify` → `billing_status: active`
- [ ] `autoProvisionSmsOnActivation` triggered with source `apple_paid`

### 7.3 Billing state parity
- [ ] UI plan badge matches Firestore `billing_status`
- [ ] Downgraded plan hides gated features

---

## Section 8 — Permissions (FE.15-FE.19)

- [ ] Owner enables `pages.clients` for barber → barber can see Clients in nav
- [ ] `visibleNav` rendered correctly (not hardcoded bottom 5 only)
- [ ] Dashboard shortcuts respect `hasPerm()` not hardcoded `isBarber`
- [ ] Backend: `GET /api/payments` respects `role_permissions` from Firestore (not just JWT role)
- [ ] Password change tab reachable in profile modal
- [ ] Password min-length: frontend and backend both enforce min 8

---

## Section 9 — Dashboard & CRM (FE.8)

- [ ] Dashboard loads on 375px iPhone width without horizontal scroll
- [ ] Calendar opens → team columns visible → booking creation works on mobile
- [ ] Clients list → sort and bulk-select work
- [ ] Payments list → sort works, reconcile correct
- [ ] Attendance clock-in → GPS check → clock-out

---

## Section 10 — runAutoReminders Scale

- [ ] Verify no `limit(100)` in `runAutoReminders` (check code or logs)
- [ ] `while (hasMore)` with `startAfter` pagination confirmed present
- [ ] If >50 workspaces available: second page processed (check logs)

---

## Pass/Fail Summary Template

Copy this block to DevLog entry after completing runbook:

```
## Launch Verification — YYYY-MM-DD

| Section | Status | Notes |
|---|---|---|
| 1. Auth & Session | ✅ / ❌ | |
| 2. New Workspace / Onboarding | ✅ / ❌ | |
| 3. Element Legacy Path | ✅ / ❌ | |
| 4. Public Booking | ✅ / ❌ | |
| 5. SMS Flows | ✅ / ❌ | |
| 6. Webhook Security | ✅ / ❌ | |
| 7. Billing | ✅ / ❌ | |
| 8. Permissions | ✅ / ❌ | |
| 9. Dashboard & CRM | ✅ / ❌ | |
| 10. runAutoReminders Scale | ✅ / ❌ | |

**Launch verdict:** READY / BLOCKED (list blockers)
```
