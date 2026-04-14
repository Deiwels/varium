# Pre-Deploy Safety Audit

> [[Home]] > Tasks | Scan date: 2026-04-14
> Status: **Issues found — review before deploy**

---

## CRITICAL — Must review before deploy

### ~~BUG 1: Shell.tsx redirect loop risk (AI 2 scope)~~ — **FIXED** local AI 2 patch 2026-04-14
- Added a one-way auth redirect guard in `components/Shell.tsx`
- Repeated session checks now bail once redirect is already in flight instead of re-triggering `/signin`

### ~~BUG 2: Group booking missing rate limit recording~~ — **FIXED** commit `fb3fa7a`
- Added `recordBookingRateHit()` to group booking handler

---

## MEDIUM — Fix soon

### ~~BUG 3: Group booking missing sms_consent_text~~ — **FIXED** commit `fb3fa7a`
- Added `sms_consent_text` to group booking document

### ~~BUG 4: Square webhook empty merchant_id → full workspace scan~~ — **FIXED** commit `fb3fa7a`
- Fallback scan now limited to 20 most recent workspaces (was unlimited)

### ~~BUG 5: PIN overlay navigation trap~~ — **FIXED** local AI 2 patch 2026-04-14
- `components/Shell.tsx` PIN overlay now has a visible `Use password instead` fallback button
- Added supporting copy so users understand the PIN only unlocks the current device session

---

## LOW — Track but not blocking

### NOTE 6: Stripe Connect webhook signature fallback
- **File**: `backend/index.js` ~line 7248
- **What**: Redundant fallback path if signature parsing fails
- **Status**: Currently safe — verification happens before parsing
- **Owner**: AI 1

---

## VERIFIED SAFE

### Backend
- No syntax errors
- No duplicate variable declarations
- No duplicate route registrations
- No undefined variables
- All Number() calls have `|| 0` fallbacks
- Cents vs dollars properly separated
- All endpoints have try/catch
- All webhook signatures verified (Stripe, Square, Apple, Stripe Connect)
- Apple expiry check working in getEffectivePlan()
- sendEmail retry logic working (2 retries with backoff)
- Rate limiter functional (in-memory, auto-cleanup)
- Settings booking/display merge working
- Price verification working (rejects >2x or <0.5x)
- Booking idempotency working (idempotency_key)
- Container starts cleanly — no startup blockers

### Critical user flows verified
- Signup → onboarding: workspace creation + first user ✓
- Calendar → book → pay cash: booking + payment_request + booking update ✓
- Public booking → select → pick time → confirm: availability + booking creation ✓
- Payroll: service_amount (net) used correctly, tips consistent ✓
- Cash register: field normalization working ✓
- Expenses: date filtering + category breakdown ✓

---

## Frontend (AI 2 scope — needs AI 2 scan)

AI 2 is actively modifying these files. They should scan before pushing:
- `app/settings/page.tsx` — drill-down navigation changes
- `app/book/[id]/page.tsx` — timezone, form persistence, disabled states
- `app/dashboard/page.tsx` — checklist, timezone, widgets
- `app/billing/page.tsx` — Apple vs web messaging
- `app/signin/page.tsx` — forgot password modal
- `components/Shell.tsx` — auth redirect, sign-out dialog, black screen fix
- `lib/api.ts` — auth token handling

---

## Deploy Decision

| What | Safe? |
|------|-------|
| Backend (committed code on GitHub) | YES — safe to deploy |
| Frontend (committed code on GitHub) | YES — AI 2 changes not yet pushed |
| Group booking | Minor bugs — not blocking (low usage) |
| Main booking flow | Fully verified |
| Payments/Payroll | Fully verified |
| Webhooks | Signature-verified |

**Recommendation**: Current committed code is safe to deploy. Fix bugs 1-4 in next batch.
