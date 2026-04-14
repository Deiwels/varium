# Production Readiness Plan — AI 1 (Backend & Finance)

> [[Home]] > Plans & Process | See also: [[Production-Plan-AI2]], [[AI-Work-Split]], [[Tasks/Launch Readiness Plan|Launch Readiness Plan]]

> Scan date: 2026-04-13
> Based on: full backend audit, frontend scan, public booking flow audit

---

## Phase 1 — CRITICAL (Must fix before selling)

### 1.1 Fix undefined variable `spAmountCents`
- `backend/index.js` lines ~1404, 5190 — should be `spServiceCents`
- Causes wrong payment amounts in Square reconciliation
- **Risk**: Customers charged incorrectly

### 1.2 Implement Stripe webhook signature verification
- `backend/index.js` line ~9685 — use `stripe.webhooks.constructEvent()`
- Currently accepts any POST as valid webhook
- **Risk**: Payment fraud — attacker can forge payment events

### 1.3 Implement Square webhook signature verification
- `backend/index.js` line ~1319 — verify HMAC signature
- Same fraud risk as Stripe

### 1.4 Fix silent `.catch(() => {})` in payment operations
- Replace with `console.error()` + proper logging in booking/payment chains
- If booking update fails after payment recorded — data desyncs
- Critical paths: payment recording, booking status updates, tip saving

### 1.5 Fix N+1 queries in webhook handlers
- Square webhook scans ALL workspaces for every event — O(N) queries
- Password reset scans ALL workspaces — O(N) queries
- Fix: add merchant_id → workspace mapping collection

---

## Phase 2 — HIGH (Fix within first week)

### 2.1 Fix cash register accuracy
- Verify `service_amount` always present on paid bookings
- Add migration to backfill missing `service_amount` from `amount`
- Some old bookings have `amount` (gross with tax) but no `service_amount` (net)

### 2.2 Add idempotency to booking creation
- Prevent double-booking from rapid form submission
- Add idempotency key check in POST /public/bookings
- Return existing booking if same key sent within 60 seconds

### 2.3 Add server-side price verification
- Don't trust client-sent `amount_cents` — verify against service price in DB
- Prevents price manipulation attacks

### 2.4 Fix payroll edge cases
- Handle bookings with `service_amount = 0` (no-price services)
- Handle tip-only payments correctly in commission calculation
- Verify admin profit formula handles 0 days in period

---

## Phase 3 — MEDIUM (Fix within two weeks)

### 3.1 Add pagination to API endpoints
- `/api/clients`, `/api/payments`, `/api/messages` — add `limit` + `offset`
- Currently loads all data at once — breaks with 10K+ records

### 3.2 Add rate limiting
- Webhook endpoints: 100 req/min
- Auth endpoints: 10 req/min per IP
- Public booking: 20 req/min per IP

### 3.3 Create missing Firestore composite indexes
- Cloud Run logs show repeated "FAILED_PRECONDITION: index required"
- Need indexes for: bookings(status + start_at), bookings(phone_norm + start_at)

### 3.4 Add webhook event logging
- Store received webhooks in Firestore for debugging
- Currently no way to trace payment issues

---

## Phase 4 — POLISH

### 4.1 Email delivery improvements
- Failed emails silently dropped — add retry queue
- Log delivery failures for support debugging

### 4.2 Improve audit system
- Add check: service prices match between booking and payment
- Add check: duplicate bookings for same client+time
- Weekly summary email instead of per-issue alerts

---

## What I think about the overall project

**Strengths:**
- Multi-tenant architecture is solid (workspace isolation via Firestore subcollections)
- Payment flow covers cash, card, terminal, Zelle — comprehensive
- Payroll system with configurable commission is advanced for this segment
- Audit system is unique — most competitors don't have this

**Biggest risks for paying customers:**
1. Webhook security — this is the #1 priority. Without signature verification, payment data can be forged.
2. Cash accuracy — barbers/salon owners are very sensitive about money. If cash register shows wrong number, they lose trust immediately.
3. Square reconciliation bug (`spAmountCents`) — silently records wrong amounts. Hard to detect until payroll is wrong.

**Production readiness estimate:** Fix Phase 1 + 2 = ready to sell. Phase 3 + 4 = ready to scale.

---

## Phase 5 — Code Quality & Security

### 5.1 Видалити Twilio recovery code — P0
- **Файл**: `docs/Telnyx/twilio_2FA_recovery_code.txt`
- Анулювати код `RFXT548Z41JF65BU1AD1V8AL` в Twilio console
- Видалити файл з git history: `git filter-repo --path docs/Telnyx/twilio_2FA_recovery_code.txt --invert-paths`
- **Ризик**: активний recovery code в репозиторії — повний доступ до Twilio акаунту

### 5.2 Видалити demo credentials з docs — P0
- **Файл**: `docs/APPLE_REVIEW_CHECKLIST.md`
- Перенести `applereview@vurium.com / ReviewTest2026!` в 1Password або GitHub Secrets
- Замінити в doc на `Email: [в 1Password → Apple Review] / Password: [в 1Password → Apple Review]`
- **Ризик**: якщо репо коли-небудь стане public — credentials відразу скомпрометовані

### 5.3 Захист background jobs від дублювання — P1
- **Файл**: `backend/index.js` (секція background jobs, ~лінії 8960–9521)
- При горизонтальному масштабуванні Cloud Run кожен інстанс запускає `setInterval` jobs паралельно
- **Варіант A (простіший)**: Distributed lock через Firestore — документ `jobs/lock/{jobName}` з полем `locked_until`. Job стартує тільки якщо lock відсутній або прострочений
- **Варіант B (правильніший)**: Перенести jobs на Cloud Scheduler → окремий ендпоінт `POST /internal/jobs/:name`, захищений `X-Internal-Secret` header
- Рекомендується Варіант A для швидкого старту, Варіант B — після стабілізації

### 5.4 HMAC blind index для `phone_norm` — P2
- **Файл**: `backend/index.js` (функції `encryptPhone`, запис клієнтів)
- Зараз `phone_norm` зберігається plaintext для Firestore query — будь-який злив бази дає всі телефони
- Замінити на `HMAC-SHA256(normalizedPhone, PHONE_INDEX_SECRET)` де `PHONE_INDEX_SECRET` — env змінна
- Написати одноразовий migration script: читає всі `clients` колекції, перераховує `phone_norm`, записує назад
- Зберегти зворотну сумісність: запустити міграцію до деплою нового коду

### 5.5 Розбити `backend/index.js` (10 351 рядок) — P2
- Мінімальне розбиття без зміни логіки — тільки переміщення коду:
```
backend/
  routes/auth.js         — /auth/*
  routes/bookings.js     — /api/bookings, /public/bookings
  routes/sms.js          — /api/sms/*
  routes/billing.js      — /api/billing/*, /api/webhooks/*
  routes/settings.js     — /api/settings
  routes/public.js       — /public/*
  lib/telnyx.js          — sendSms, telnyxApi
  lib/square.js          — Square OAuth, terminal
  lib/email.js           — sendEmail, templates
  lib/push.js            — APNs
  lib/crypto.js          — encrypt/decrypt helpers
  jobs/reminders.js      — background jobs (setInterval)
  index.js               — тільки app setup + route mounting
```
- Після рефакторингу всі нові файли в `backend/routes/` і `backend/lib/` належать AI 1
- **Ризик при рефакторингу**: запустити `node backend/index.js` і перевірити всі ендпоінти після розбиття

### 5.6 Migrate legacy SMS statuses — P3
- **Файл**: `backend/index.js` (константа `LEGACY_SMS_STATUSES`)
- Прибрати `Set(['pending_vetting', 'pending_otp', 'brand_created', 'pending_campaign', 'pending_number', 'pending_approval', 'verified'])`
- Написати одноразовий Firestore script: знайти всі workspaces де `sms_registration_status` є в legacy set → конвертувати до нової схеми
- Після міграції legacy код можна видалити безпечно
