---
type: plan
status: active
priority: p0
owner: AI 3
created: 2026-04-15
---

# Reminder SMS TFV Implementation Plan v2

> [[Home]] > Tasks | Related: [[Tasks/Reminder-SMS-TFV-Implementation-Plan|v1 (archived)]], [[Tasks/Reminder-SMS-TFV-Plan-AI1-Review|AI 1 Review]], [[Tasks/TFV-Inspection-Result-2026-04-15|TFV Inspection Result]], [[Tasks/AI5-Research-Brief-Reminder-SMS|AI 5 Research Brief]], [[Tasks/Reminder-SMS-Launch-Completion|Launch Completion]], [[Features/SMS & 10DLC]], [[Tasks/Live-SMS-Verification-Checklist|Live SMS Verification Checklist]]
> Created: 2026-04-15 | Plan by: AI 3 (Verdent) | v2 incorporates: AI 1 review (3 blockers + 4 improvements + 2 data additions) + AI 2 review (4 frontend points) + TFV portal inspection

---

## 4-AI Review Gate (v2)

> ⚠️ **Перед початком імплементації цей план має бути reviewed і approved.**

- [ ] AI 1 (Claude) — re-review v2 (всі 3 blockers + 4 improvements incorporated). v1 review: [[Tasks/Reminder-SMS-TFV-Plan-AI1-Review]]
- [ ] AI 2 (Codex) — re-review v2 (all 4 frontend points incorporated). v1 inline review preserved below.
- [ ] AI 4 (Phone AI) — review emergency/rollback risk
- [ ] Owner — approve v2 + confirm Pattern B (Sole Proprietor) is acceptable

**Поки всі 4 чекбокси не зелені — код не пишемо.**

---

## Що змінилось між v1 і v2

| Проблема з v1 | Рішення у v2 | Джерело |
|---|---|---|
| Payload без BRN полів → Telnyx відхилить | Pattern B (Sole Proprietor) — без EIN, без BRN fields | AI 1 Blocker 1 |
| TFV подається при signup коли shop_* порожні | Gate на `shop_name && shop_address && shop_phone && shop_email` + тригер з `POST /api/settings` | AI 1 Blocker 2 |
| Webhook handler не знає TFV events | Розширити `/api/webhooks/telnyx-10dlc` для TFV status events | AI 1 Blocker 3 |
| Polling 3 хв — занадто часто | 30 хв (TFV review = 1-7 днів) | AI 1 Improvement 1 |
| Немає retry strategy для TFV submission | Exponential backoff як `autoProvisionSmsOnActivation` | AI 1 Improvement 2 |
| Не atomic writes | Single `set({...}, { merge: true })` | AI 1 Improvement 3 |
| `getSmsUxState()` не знає нові статуси | Додати `configured`, `tfv_pending`, `tfv_rejected` | AI 2 Point 1 |
| TollFreeStatusCard copy стейл | Оновити — прибрати "No EIN required" | AI 2 Point 2 |
| `app/developer/sms/page.tsx` не в scope | Додати до frontend scope | AI 2 Point 3 |
| `tfv_rejected` може плутатись з manual 10DLC | Чіткий "fix and resubmit TFV" flow | AI 2 Point 4 |
| Немає historical context `e23146a2` | Секція "Historical Context" | AI 1 Data 1 |
| Телефон `846` замість `847` | Правильний fallback `(847) 630-1884` | AI 1 Data 2 |
| § 5.1 ISV gate невідомий | Емпірично відповіджений: ISV НЕ працює → per-workspace | AI 1 inspection |

---

## Мета

Інтегрувати Telnyx Toll-Free Verification (TFV) у provisioning flow з **per-workspace Sole Proprietor** моделлю (Pattern B), щоб `sms_registration_status: 'active'` реально означав "carrier-approved + delivery-ready".

---

## Historical Context

Запит `e23146a2-30d3-5ed4-a7be-c832da06ad4f` (Apr 9, 2026) — це спроба **platform-ISV** TFV (повні деталі: [[Tasks/TFV-Inspection-Result-2026-04-15]]):

- `Vurium Inc` + ISV Reseller flag + "on behalf of businesses" → **Rejected** (`Business Registration Number Is Missing or Invalid`)
- Це та сама архітектура що провалилась як `CKAOXOW` 710 ("Reseller / Non-compliant KYC")
- Цей запит **НЕ перевикористовується** — він залишається як historical dead state
- Нові per-workspace TFV requests створюються з нуля

**§ 5.1 ISV gate відповідь**: ISV model емпірично відхилений двома rejection-ами. v2 план комітить на **per-workspace TFV** як єдину архітектуру.

---

## Новий Status Lifecycle

```
none → provisioning → configured ─── [onboarding complete] ──→ tfv_pending → active
                    ↘ failed → retry → failed_max_retries       ↘ tfv_rejected → [fix+resubmit] → tfv_pending
                                                                  ↘ tfv_submit_failed (max retries exhausted)
```

| Status | Значення | SMS | Тригер переходу |
|--------|----------|-----|-----------------|
| `none` | Нічого | ❌ | Initial state |
| `provisioning` | Купуємо номер | ❌ | `autoProvisionSmsOnActivation()` |
| `configured` | Номер + profile + STOP/HELP готові, **чекаємо бізнес-дані** | ❌ | Successful provision |
| `tfv_pending` | TFV submitted, чекаємо 1-7 днів | ❌ | `shop_*` complete → auto-submit |
| `tfv_rejected` | TFV відхилено — потрібно виправити і resubmit | ❌ | Telnyx webhook/poll |
| `tfv_submit_failed` | TFV submission API errors × 5 | ❌ | Max retries exhausted |
| `active` | TFV = `Verified` | ✅ | Telnyx webhook/poll |
| `failed` / `failed_max_retries` | Provision error | ❌ | Telnyx API error |

---

## Крок 1 — Backend: Provisioning → `configured` (AI 1)

**Файл**: `backend/index.js`, функція `provisionTollFreeSmsForWorkspace()` (~рядок 2191)

### 1.1 — Замінити `active` → `configured`

```diff
- sms_registration_status: 'active',
+ sms_registration_status: 'configured',
```

Після покупки номера + profile + STOP/HELP — статус `configured`. TFV submission НЕ відбувається тут (бо shop_* поля ще можуть бути порожні).

### 1.2 — Fallback phone fix

Якщо будь-який код використовує platform-level fallback phone, він має бути `(847) 630-1884`, а НЕ `(846)`.

---

## Крок 2 — Backend: TFV submission з `POST /api/settings` (AI 1)

**Файл**: `backend/index.js`

### 2.1 — Новий helper `submitTfvForWorkspace(wsId)`

Функція, яка:

1. Читає workspace settings
2. Перевіряє gate: `shop_name && shop_address && shop_phone && shop_email && sms_from_number && status === 'configured'`
3. Формує TFV payload (**Pattern B — Sole Proprietor**):

| TFV Field | Value Source |
|---|---|
| `phoneNumbers` | `[data.sms_from_number]` |
| `businessName` | `data.shop_name` |
| `corporateWebsite` | `getWorkspaceBookingUrl(workspace)` |
| `businessContactEmail` | `data.shop_email` |
| `businessContactPhone` | `data.shop_phone` |
| `useCase` | `'Appointments'` |
| `useCaseSummary` | `"${shopName} sends appointment confirmations and reminders to clients who opt in during online booking at ${bookingUrl}."` |
| `messageVolume` | `'100'` |
| `optInWorkflowDescription` | `"Clients opt in via an SMS consent checkbox on the booking page at ${bookingUrl}. The checkbox is optional and unchecked by default."` |
| `optInWorkflowImageURLs` | `[bookingUrl]` |
| `sampleMessage1` | `"${shopName}: Your appointment is confirmed for tomorrow at 2:00 PM. Reply STOP to opt out."` |
| `sampleMessage2` | `"${shopName}: Reminder - your appointment is in 1 hour. Reply HELP for help."` |
| `webhookUrl` | `${apiBaseUrl}/api/webhooks/telnyx-10dlc` |
| `privacyPolicyUrl` | `'https://vurium.com/privacy'` |
| `termsAndConditionsUrl` | `'https://vurium.com/terms'` |

**Pattern B означає**: поля `businessRegistrationNumber`, `businessRegistrationType`, `businessRegistrationIssuingCountry` **НЕ** включаються. Sole Proprietor TFV path не вимагає BRN.

4. На успіх — **ATOMIC write** (single `set` call):

```javascript
await settingsRef.set({
  sms_registration_status: 'tfv_pending',
  sms_tfv_request_id: tfvResult.data.id,
  sms_tfv_submitted_at: toIso(new Date()),
  sms_status_updated_at: toIso(new Date()),
}, { merge: true });
```

5. На помилку — schedule retry (match `autoProvisionSmsOnActivation` pattern):

- `sms_tfv_submit_retry_count++`
- `sms_tfv_submit_next_retry_at` = exponential backoff (5m, 15m, 1h, 4h, 24h)
- `sms_tfv_submit_last_error` = error message
- Якщо max 5 retries → `sms_registration_status: 'tfv_submit_failed'`

### 2.2 — Trigger з `POST /api/settings` (~рядок 7570)

У handler `POST /api/settings`, після `await ref.set(patch, { merge: true })`:

```javascript
// Check if onboarding just completed and workspace needs TFV
const saved = await ref.get();
const savedData = saved.data() || {};
if (savedData.sms_registration_status === 'configured' &&
    savedData.shop_name && savedData.shop_address &&
    savedData.shop_phone && savedData.shop_email &&
    savedData.sms_from_number) {
  submitTfvForWorkspace(req.workspaceId).catch(e =>
    console.warn('TFV auto-submit from settings failed:', e?.message)
  );
}
```

### 2.3 — TFV resubmission endpoint (owner-only)

`POST /api/sms/resubmit-tfv` — для workspaces у `tfv_rejected`:

- Reads workspace settings (fresh shop_* data)
- `PATCH /v2/messaging_tollfree/verification/requests/{tfvId}` з оновленим payload
- Переводить `tfv_rejected` → `tfv_pending`
- Audit log обов'язковий

---

## Крок 3 — Backend: Webhook handler для TFV events (AI 1)

**Файл**: `backend/index.js`, handler `/api/webhooks/telnyx-10dlc` (~рядок 1954)

На початку handler, **перед** перевіркою `brandId`/`campaignId`:

```javascript
// TFV status events
if (eventType === 'verification_request.status_updated' ||
    eventType === 'toll_free_verification.updated') {
  const tfvId = payload.id || payload.verification_request_id || '';
  const tfvStatus = payload.status || '';
  if (tfvId) {
    const wsSnap = await db.collectionGroup('config')
      .where('sms_tfv_request_id', '==', tfvId)
      .limit(1).get();
    if (!wsSnap.empty) {
      const configDoc = wsSnap.docs[0];
      if (tfvStatus === 'verified' || tfvStatus === 'Verified') {
        await configDoc.ref.set({
          sms_registration_status: 'active',
          sms_tfv_verified_at: toIso(new Date()),
          sms_status_updated_at: toIso(new Date()),
        }, { merge: true });
      } else if (tfvStatus === 'rejected' || tfvStatus === 'Rejected') {
        await configDoc.ref.set({
          sms_registration_status: 'tfv_rejected',
          sms_tfv_rejection_reason: safeStr(payload.rejection_reason || payload.reason || '').slice(0, 500),
          sms_status_updated_at: toIso(new Date()),
        }, { merge: true });
      }
    }
  }
  return res.status(200).json({ ok: true });
}
```

Webhook — **primary signal**. Polling (Крок 4) — safety net.

---

## Крок 4 — Backend: Polling job як safety net (AI 1)

**Файл**: `backend/index.js`

### 4.1 — `runTfvStatusCheck()` кожні 30 хвилин

- Query: `sms_registration_status == 'tfv_pending'`, limit 50
- Для кожного: `GET /v2/messaging_tollfree/verification/requests/{tfvId}`
- `Verified` → `active`; `Rejected` → `tfv_rejected`; інші → залишити `tfv_pending`
- Обгорнутий у `withJobLock('runTfvStatusCheck', 1800, ...)`
- **Окремий** `setInterval` кожні 30 хвилин (НЕ в 3-хвилинному циклі):

```javascript
setInterval(() => withJobLock('runTfvStatusCheck', 1800, runTfvStatusCheck), 30 * 60 * 1000);
```

### 4.2 — TFV submission retry job

В основний 3-хвилинний `setInterval`:

```javascript
async function runTfvSubmitRetry() {
  // Query: status === 'configured', sms_tfv_submit_next_retry_at <= now
  // Attempt submitTfvForWorkspace()
}
```

---

## Крок 5 — Backend: Sending guard verification (AI 1)

**Файл**: `backend/index.js:524`

`getWorkspaceSmsConfig()` вже перевірено (AI 3 + AI 1):

```javascript
const isVerified = status === 'active' || status === 'verified';
const canSend = (hasOwnNumber && isVerified) || (!hasOwnNumber && !!fallbackFrom);
```

Нові статуси `configured`, `tfv_pending`, `tfv_rejected`, `tfv_submit_failed` **автоматично** блокують sending. **Зміна коду НЕ потрібна** — лише QA верифікація.

---

## Крок 6 — Backend: Admin endpoint (AI 1)

`POST /api/vurium-dev/sms/force-status` (superadmin-only):

- Приймає `workspace_id` і `status`
- Дозволені: `none`, `configured`, `tfv_pending`, `active`, `tfv_rejected`, `tfv_submit_failed`, `failed`
- Audit log обов'язковий
- Для unsticking workspaces при rollback

---

## Крок 7 — Frontend: Status UI (AI 2)

**Файли**: `app/settings/page.tsx`, `app/developer/sms/page.tsx`

### 7.1 — Оновити `getSmsUxState()` (~рядок 25)

Додати нові tollFreeState значення:

```typescript
type TollFreeState = 'not_enabled' | 'provisioning' | 'configured' | 'tfv_pending' | 'tfv_rejected' | 'active' | 'failed'

// New mappings:
if (smsStatus === 'configured') tollFreeState = 'configured'
else if (smsStatus === 'tfv_pending') tollFreeState = 'tfv_pending'
else if (smsStatus === 'tfv_rejected') tollFreeState = 'tfv_rejected'
else if (smsStatus === 'tfv_submit_failed') tollFreeState = 'failed'
```

### 7.2 — Оновити SMS Notifications UI

| tollFreeState | UI label | UX |
|---|---|---|
| `not_enabled` | SMS not set up | Info: auto-setup runs on plan activation |
| `provisioning` | Setting up your dedicated SMS number... | Spinner |
| `configured` | Number assigned — complete your business profile to activate SMS | **CTA**: go to Business Profile |
| `tfv_pending` | Carrier verification in progress (typically 1-7 business days) | Progress indicator, no manual toggle |
| `tfv_rejected` | SMS verification needs attention | Warning + "Review and Resubmit" button |
| `active` | SMS active — appointment reminders will be sent | Green checkmark |
| `failed` | SMS setup failed | Error + retry button |

### 7.3 — Оновити copy

Прибрати стейл copy:

- ~~"SMS usually turns on automatically"~~ → "SMS activates after your business info is verified by carriers"
- ~~"No EIN is required for this default path"~~ → (прибрати повністю)

### 7.4 — `tfv_rejected` UX

Чітко відокремити від manual 10DLC:

- "Your toll-free number is ready, but carrier verification was not approved. Please review your business details and resubmit."
- **НЕ** показувати "Switch to manual 10DLC registration"
- CTA: "Review and Resubmit Verification"

### 7.5 — `app/developer/sms/page.tsx`

- Оновити `formatSmsStatus()` для нових статусів
- Summary grouping: `verifiedSenders`, `pendingVerification`, `rejectedVerification`
- `configured` workspace з номером — показувати як "Awaiting Verification", НЕ "Configured Sender"

### 7.6 — Заблокувати manual SMS toggle при `tfv_pending`

Коли workspace у `tfv_pending` — manual enable/disable НЕ доступний. Лише status card.

---

## Крок 8 — Element Barbershop Protection

`isLegacyManualSmsPath()` + `isProtectedLegacyWorkspace()` повністю обходять TFV flow. **Жоден рядок TFV коду не торкається Element.**

Верифікація: AI 3 перевіряє що Element's `sms_registration_status` не змінився після deploy.

---

## Крок 9 — Owner Live Pilot

1. Створити fresh workspace, заповнити Business Profile (shop_name, address, phone, email)
2. Переконатися що auto-provision спрацював: `sms_registration_status === 'configured'`
3. Зберегти Settings → перевірити що TFV submitted: `sms_registration_status === 'tfv_pending'`
4. Перевірити Telnyx Portal → TFV Requests → побачити новий per-workspace request
5. Дочекатися `Verified` (1-7 бізнес-днів)
6. Перевірити Firestore: `sms_registration_status === 'active'`
7. Створити booking з SMS consent → перевірити що SMS приходить
8. Відправити STOP → перевірити opt-out
9. Відправити HELP → перевірити help response
10. Перевірити email-only fallback для workspace без `active`
11. Перевірити Element — нічого не змінилось
12. Записати результати в DevLog

---

## Rollback Plan

1. **Single-line revert**: `configured` → `active` у `provisionTollFreeSmsForWorkspace()` — повертає v1 (оптимістичну) поведінку
2. **Stuck workspaces**: `POST /api/vurium-dev/sms/force-status` → `active`
3. **Cloud Run**: `gcloud run services update-traffic vuriumbook-api --to-revisions=PREVIOUS=100`
4. **Frontend**: revert `getSmsUxState()` changes
5. Записати incident в DevLog і QA-Scan

---

## AI Ownership Split

| Крок | Owner | Files |
|------|-------|-------|
| 1 — Provision → configured | AI 1 | `backend/index.js` |
| 2 — TFV submission + settings trigger | AI 1 | `backend/index.js` |
| 3 — Webhook TFV events | AI 1 | `backend/index.js` |
| 4 — Polling job (30 min) | AI 1 | `backend/index.js` |
| 5 — Sending guard verification | AI 1 (verify only) | `backend/index.js` |
| 6 — Admin force-status | AI 1 | `backend/index.js` |
| 7 — Frontend status UI | AI 2 | `app/settings/page.tsx`, `app/developer/sms/page.tsx` |
| 8 — Element guard verify | AI 3 | QA-Scan |
| 9 — Live pilot | Owner | Telnyx portal, live test |
| Docs — plan v2, Home, In Progress | AI 3 | `docs/Tasks/*.md`, `docs/Home.md` |

---

## Definition of Done

1. `provisionTollFreeSmsForWorkspace()` пише `configured`, не `active`
2. `submitTfvForWorkspace()` подає TFV через API після заповнення shop_* полів (Pattern B)
3. `POST /api/settings` автоматично тригерить TFV коли onboarding complete
4. `/api/webhooks/telnyx-10dlc` обробляє TFV status events → `active` або `tfv_rejected`
5. `runTfvStatusCheck()` polling job працює кожні 30 хвилин як safety net
6. TFV submission має retry strategy (5 спроб з exponential backoff)
7. Всі TFV Firestore writes — atomic (single `set({...}, {merge: true})`)
8. `getSmsUxState()` розуміє `configured`, `tfv_pending`, `tfv_rejected`, `tfv_submit_failed`
9. SMS Notifications UI правильно відображає кожен стан
10. `app/developer/sms/page.tsx` оновлений з TFV-aware statuses
11. `tfv_rejected` UI — чіткий "fix and resubmit", не "switch to 10DLC"
12. `getWorkspaceSmsConfig()` блокує sending для не-`active` (верифіковано)
13. Element Barbershop не торкнутий
14. Один fresh workspace пройшов повний цикл: provision → settings → TFV → Verified → SMS delivered
15. Historical context `e23146a2` задокументований
16. `docs/` оновлені

---

## Step → Targets → Verification

| Step | Target | Verification |
|------|--------|-------------|
| 1.1 | `backend/index.js:~2191` | Firestore shows `configured` after provision |
| 2.1 | `backend/index.js` new `submitTfvForWorkspace()` | TFV API called only when shop_* complete |
| 2.2 | `backend/index.js:~7570` (POST /api/settings) | Saving settings triggers TFV for `configured` workspace |
| 2.3 | `backend/index.js` new endpoint | `tfv_rejected` → resubmit → `tfv_pending` |
| 3 | `backend/index.js:~1958` (webhook handler) | TFV webhook event → `active`/`tfv_rejected` in Firestore |
| 4.1 | `backend/index.js` new job + 30-min setInterval | Logs show `runTfvStatusCheck`; transitions observed |
| 5 | `backend/index.js:524` | Non-`active` → canSend=false (no code change) |
| 6 | `backend/index.js` new endpoint | Dev panel can force-set status |
| 7.1 | `app/settings/page.tsx:25-51` | `getSmsUxState()` returns correct state per backend |
| 7.5 | `app/developer/sms/page.tsx` | Admin sees TFV-aware grouping |
| 8 | Element Firestore | `sms_registration_status` unchanged after deploy |
| 9 | Live workspace | Full lifecycle verified end-to-end |

---

## AI Review Notes (v2)

> Інші AI: запишіть review notes тут або створіть окремий doc з лінком.

### AI 1 (Claude) review — v2
*(pending — re-review after v2 incorporates all 3 blockers + 4 improvements)*

### AI 2 (Codex) review — v2
*(pending — re-review after v2 incorporates all 4 frontend points)*

### AI 4 (Phone AI) review
*(pending)*
