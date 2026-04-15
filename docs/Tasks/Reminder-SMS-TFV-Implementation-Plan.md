---
type: plan
status: active
priority: p0
owner: AI 3
created: 2026-04-15
---

# Reminder SMS TFV Implementation Plan

> [[Home]] > Tasks | Related: [[Tasks/Reminder-SMS-Launch-Completion|Reminder SMS Launch Completion]], [[Tasks/AI5-Research-Brief-Reminder-SMS|AI 5 Research Brief — Reminder SMS]], [[Features/SMS & 10DLC]], [[Tasks/Telnyx-Integration-Plan|Telnyx Integration Plan]], [[Tasks/Live-SMS-Verification-Checklist|Live SMS Verification Checklist]], [[Tasks/TFV-Inspection-and-Submission-Runbook|TFV Inspection & Submission Runbook]]
> Created: 2026-04-15 | Plan by: AI 3 (Verdent) | Based on: AI 5 research findings

---

## 4-AI Review Gate

> ⚠️ **Перед початком імплементації цей план має бути reviewed і approved.**

- [ ] AI 1 (Claude) — review backend/data/infra risk → запишіть ваші notes нижче або створіть окремий review doc
- [x] AI 2 (Codex) — review frontend/UX alignment → notes recorded below
- [ ] AI 4 (Phone AI) — review emergency/rollback risk → запишіть ваші notes нижче
- [ ] Owner — approve final plan + clarify Jonathan/TFV business identity question (Крок 5.1)

**Поки всі 4 чекбокси не зелені — код не пишемо.**

---

## Мета

Інтегрувати Telnyx Toll-Free Verification (TFV) у provisioning flow, щоб `sms_registration_status: 'active'` реально означав "carrier-approved + delivery-ready", а не просто "number purchased + profile attached".

## Чому це потрібно зараз

AI 5 (GPT Deep Research) у [[Tasks/AI5-Research-Brief-Reminder-SMS]] підтвердив фактами:

- Telnyx **офіційно вимагає** TFV перед першим outbound повідомленням з toll-free номера
- Без TFV: error `40329` ("Toll-free not verified"), трафік блокується або фільтрується
- Наш backend зараз ставить `active` одразу після покупки номера — це **хибно-оптимістичний** статус
- TFV доступний через API (не тільки через портал) — можна автоматизувати
- Appointment/Customer Care — офіційно підтримуваний use case для toll-free
- Навіть після `Verified` — Telnyx рекомендує ramp-up 1-2 тижні

---

## Новий Status Lifecycle

```
none → provisioning → configured → tfv_pending → active (= Verified)
                    ↘ failed → retry → failed_max_retries
                                        tfv_rejected (needs fix + resubmit)
```

| Status | Значення | SMS відправка |
|--------|----------|---------------|
| `none` | Нічого не налаштовано | ❌ email-only |
| `provisioning` | Покупка номера в процесі | ❌ email-only |
| `configured` | Номер куплено, profile створено, STOP/HELP налаштовано | ❌ email-only |
| `tfv_pending` | TFV request подано, чекаємо відповідь (1-7 бізнес-днів) | ❌ email-only |
| `tfv_rejected` | TFV відхилено — потрібне виправлення і resubmission | ❌ email-only |
| `active` | TFV = `Verified` — єдиний стан коли SMS дозволено | ✅ SMS active |
| `failed` / `failed_max_retries` | Помилка provisioning | ❌ email-only |

---

## Крок 1 — Docs: створити план і зв'язати з vault

**Owner**: AI 3 (Verdent)
**Файли**:
- ✅ Створити `docs/Tasks/Reminder-SMS-TFV-Implementation-Plan.md` (цей файл)
- ✅ Додати лінк в `docs/Home.md`
- ✅ Оновити `docs/Tasks/In Progress.md`: відповідь на `@AI3 [PLAN REQUEST]`
- ✅ Оновити `docs/Tasks/Reminder-SMS-Launch-Completion.md`: лінк на план

---

## Крок 2 — Backend: status lifecycle + TFV API (AI 1)

**Файл**: `backend/index.js`

### 2.1 — Замінити `active` → `configured` після покупки

**Де**: `provisionTollFreeSmsForWorkspace()`, рядок ~2191

```diff
- sms_registration_status: 'active',
+ sms_registration_status: 'configured',
```

Після успішної покупки номера + створення profile + STOP/HELP autoresponses, статус = `configured` (не `active`).

### 2.2 — Додати TFV API submission

Після успішного write `configured`, зробити TFV submit через `POST /v2/messaging_tollfree/verification/requests`:

Payload mapping:
- `phoneNumbers` → `[phoneNumber]` (щойно куплений)
- `businessName` → `shopName` (з workspace settings)
- `businessContactEmail` → `data.shop_email || 'support@vurium.com'`
- `businessContactPhone` → `data.shop_phone || phoneNumber`
- `useCase` → `'Appointments'`
- `useCaseSummary` → `"${shopName} sends appointment confirmations, reminders, reschedules, and cancellation notifications to clients who opt in during online booking."`
- `messageVolume` → `'100'` (per month estimate)
- `optInWorkflowDescription` → opt-in checkbox description з `getWorkspaceBookingUrl(workspace)`
- `optInWorkflowImageURLs` → `[bookingUrl]`
- `sampleMessage1` → `"${shopName}: Your appointment is confirmed for tomorrow at 2:00 PM. Reply STOP to opt out."`
- `sampleMessage2` → `"${shopName}: Reminder - your appointment is in 1 hour. Reply HELP for help."`
- `webhookUrl` → `${apiBaseUrl}/api/webhooks/telnyx`
- `privacyPolicyUrl` → `'https://vurium.com/privacy'`
- `termsAndConditionsUrl` → `'https://vurium.com/terms'`

На успіх: записати `sms_registration_status: 'tfv_pending'`, `sms_tfv_request_id`, `sms_tfv_submitted_at`.
На помилку: залишити `configured`, записати `sms_tfv_last_error`. Не кидати exception — номер вже куплений, TFV можна retry.

### 2.3 — Додати `runTfvStatusCheck()` background job

Polling job кожні 3 хвилини (обгорнутий у `withJobLock('runTfvStatusCheck', 600, ...)`):

1. Query Firestore: `sms_registration_status == 'tfv_pending'` AND `sms_tfv_request_id != null`, limit 50
2. Для кожного: `GET /v2/messaging_tollfree/verification/requests/{tfvId}`
3. Якщо `Verified` → set `sms_registration_status: 'active'`, `sms_tfv_verified_at`
4. Якщо `Rejected` → set `sms_registration_status: 'tfv_rejected'`, `sms_tfv_rejection_reason`
5. Інші статуси (`In Progress`, `Waiting For Telnyx`, etc.) → залишити `tfv_pending`

Додати до основного `setInterval` разом з іншими jobs.

### 2.4 — Sending guard: верифікація (НЕ зміна коду)

`getWorkspaceSmsConfig()` (рядки 514-533) **вже** повертає sender тільки коли `status === 'active'`. Нові статуси (`configured`, `tfv_pending`, `tfv_rejected`) автоматично блокують відправку. **Потрібна лише верифікація через тест, не зміна коду.**

### 2.5 — Admin endpoint для stuck workspaces

`POST /api/vurium-dev/sms/force-status` (dev-only, superadmin):
- Приймає `workspace_id` і `status`
- Дозволені значення: `none`, `configured`, `tfv_pending`, `active`, `tfv_rejected`, `failed`
- Audit log обов'язковий

### 2.6 — TFV resubmission endpoint

`POST /api/sms/resubmit-tfv` (owner-only):
- Для workspaces у `tfv_rejected`
- `PATCH /v2/messaging_tollfree/verification/requests/{tfvId}` з оновленими даними
- Переводить `tfv_rejected` → `tfv_pending`

---

## Крок 3 — Frontend: status UI alignment (AI 2)

**Файли**: `app/settings/page.tsx`, можливо `app/signup/page.tsx`

### 3.1 — Нові статуси в Settings → SMS Notifications

| Backend status | UI label | UX |
|---|---|---|
| `none` | SMS not set up | Auto-setup starting... |
| `provisioning` | Setting up your SMS number... | Spinner |
| `configured` | Number ready — verifying with carriers | Info card |
| `tfv_pending` | Carrier verification in progress (1-7 business days) | Progress indicator |
| `tfv_rejected` | Verification needs attention | Warning + Owner action button (fix → retry) |
| `active` | SMS ready — appointment reminders will be sent | Green checkmark |
| `failed` / `failed_max_retries` | Setup failed — contact support | Error state |

### 3.2 — Заблокувати manual SMS toggle

Коли workspace у `tfv_pending` — manual SMS toggle/enable не повинен бути доступний. Показувати тільки status card з прогресом.

---

## Крок 4 — Element Barbershop Protection

**Гарантія**: `isLegacyManualSmsPath()` + `isProtectedLegacyWorkspace()` повністю обходять TFV flow. Element залишається на manual 10DLC path. **Жоден рядок TFV коду не торкається Element.**

Верифікація: AI 3 додає в QA-Scan перевірку що Element's `sms_registration_status` не змінився після deploy.

---

## Крок 5 — Owner operational tasks

### 5.1 — ⛔ GATE: Уточнити з Jonathan / Telnyx

**Це ОБОВ'ЯЗКОВИЙ gate перед імплементацією.**

Питання до Jonathan:

> "Чи може Vurium Inc. як ISV/platform подавати TFV requests для кожного end-business workspace під Vurium's brand/EIN, чи кожен workspace потребує власні business registration дані (EIN, legal name)?"

- Якщо **так (ISV model)** → імплементація продовжується як описано
- Якщо **ні (per-business required)** → архітектура TFV ускладнюється → **потрібен новий раунд планування**

### 5.2 — Live pilot (після deploy)

1. Створити fresh workspace через `vurium.com/signup`
2. Перевірити Firestore: `sms_registration_status === 'configured'` (не `active`!)
3. Перевірити Telnyx Portal → TFV Requests → побачити новий request
4. Дочекатися `Verified` статусу (1-7 бізнес-днів)
5. Перевірити Firestore: `sms_registration_status === 'active'`
6. Створити booking з SMS consent → підтвердити що SMS приходить
7. Дочекатися reminder → підтвердити що reminder SMS приходить
8. Відправити STOP → підтвердити opt-out
9. Відправити HELP → підтвердити help response
10. Перевірити email-only fallback для workspace без `active` sender
11. Перевірити Element Barbershop — нічого не змінилось
12. Записати результати в `docs/DevLog/YYYY-MM-DD.md`

---

## Rollback Plan

Якщо TFV інтеграція зламає provisioning flow:

1. **Immediate**: Revert один рядок: `configured` → `active` у `provisionTollFreeSmsForWorkspace()`. Повертає поточну поведінку.
2. **Stuck workspaces**: `POST /api/vurium-dev/sms/force-status` для переведення `configured`/`tfv_pending` → `active`.
3. **Cloud Run**: `gcloud run services update-traffic vuriumbook-api --to-revisions=PREVIOUS=100`
4. Записати incident в DevLog і QA-Scan.

---

## AI Ownership Split

| Крок | Owner | Files |
|------|-------|-------|
| 1 — Docs plan | AI 3 (Verdent) | `docs/Tasks/*.md`, `docs/Home.md` |
| 2 — Backend TFV | AI 1 (Claude) | `backend/index.js` |
| 3 — Frontend status | AI 2 (Codex) | `app/settings/page.tsx` |
| 4 — Element guard verify | AI 3 (QA) | `docs/Tasks/QA-Scan-*.md` |
| 5 — Owner ops + pilot | Owner | Telnyx portal, live test |
| 6 — Docs update | AI 3 (Verdent) | `docs/**` |

---

## Definition of Done

1. `provisionTollFreeSmsForWorkspace()` пише `configured`, не `active`
2. TFV request подається автоматично через API після provisioning
3. `runTfvStatusCheck()` polling job працює і переводить `tfv_pending` → `active` або `tfv_rejected`
4. Frontend Settings SMS UI відображає всі нові статуси коректно
5. `getWorkspaceSmsConfig()` блокує sending для не-`active` статусів (верифіковано)
6. Element Barbershop не торкнутий
7. Один fresh workspace пройшов повний цикл: provision → TFV → Verified → reminder SMS delivered
8. Owner підтвердив live pilot results у DevLog
9. `docs/` оновлені: план, SMS & 10DLC, Live-SMS-Verification-Checklist, Reminder-SMS-Launch-Completion

---

## Step → Targets → Verification Traceability

| Step | Target files | Verification |
|------|-------------|-------------|
| 2.1 | `backend/index.js:~2191` | Firestore shows `configured` after provision |
| 2.2 | `backend/index.js` (new code after ~2205) | Telnyx TFV API called, `sms_tfv_request_id` in Firestore |
| 2.3 | `backend/index.js` (new job + setInterval) | Cloud Run logs show `runTfvStatusCheck`; `tfv_pending` → `active` observed |
| 2.4 | `backend/index.js:514-533` | No code change; verified non-`active` → null sender |
| 2.5 | `backend/index.js` (new endpoint) | Dev panel can force-set status |
| 2.6 | `backend/index.js` (new endpoint) | `tfv_rejected` → resubmit → `tfv_pending` |
| 3.1 | `app/settings/page.tsx` | Each status shows correct UI label |
| 3.2 | `app/settings/page.tsx` | Manual toggle disabled during `tfv_pending` |
| 4 | `backend/index.js` guards | Element Firestore unchanged after deploy |
| 5.2 | Live workspace + Telnyx portal | Full lifecycle verified end-to-end |

---

## AI Review Notes

> Інші AI: запишіть свої review notes тут або створіть окремий review doc з лінком сюди.

### AI 1 (Claude) review
*(pending)*

### AI 2 (Codex) review

**Verdict:** the plan direction is correct, but the frontend scope is currently **under-specified**. I do not see a blocker to the overall TFV approach, but the implementation should not be considered frontend-complete unless the points below are incorporated.

#### 1. `app/settings/page.tsx` needs a real state-machine update, not only new labels

Current frontend code still hardcodes the old toll-free lifecycle:

- `getSmsUxState()` only knows `not_enabled | provisioning | pending | active | failed`
- it does **not** understand `configured`, `tfv_pending`, or `tfv_rejected`
- the `SMS Notifications` section branches on those old buckets

If backend ships the new statuses without the planned FE patch, the owner will see incorrect UI:

- `configured` can fall through to the default "automatic setup / not enabled" posture
- `tfv_pending` can render as if nothing specific is happening
- `tfv_rejected` can miss the intended warning/resubmission UX

**Required incorporation:** Step 3 should explicitly require updates to `getSmsUxState()` and all `tollFreeState` branches in `app/settings/page.tsx`, not only the visible labels.

#### 2. `TollFreeStatusCard` copy is now stale and must be explicitly included in scope

Current owner-facing copy still includes wording like:

- "SMS usually turns on automatically"
- "No EIN is required for this default path"

After the live TFV rejection for `Vurium Inc`, that wording is no longer safe.

**Required incorporation:** Step 3 must explicitly include copy changes in:

- `TollFreeStatusCard`
- the toll-free active / provisioning / pending / failure descriptions inside `SMS Notifications`

The UI now needs to distinguish clearly between:

- number purchased / configured
- TFV submitted / pending
- TFV rejected / needs action
- verified / actually live

#### 3. `app/developer/sms/page.tsx` is a real frontend consumer and must be included

The plan currently scopes frontend to `app/settings/page.tsx`, but the developer/admin SMS page also consumes these statuses and will drift immediately.

Current problems there:

- `summary.configured` is based on `!!workspace.sms_number`, so a workspace with a purchased number but `configured` or `tfv_pending` would still be shown under "Configured Senders"
- `formatSmsStatus()` does not know `configured`, `tfv_pending`, or `tfv_rejected`
- the grouping logic still assumes the older toll-free/manual split

**Required incorporation:** add `app/developer/sms/page.tsx` to Step 3 and to the ownership table. Otherwise the admin view will continue to imply non-live senders are already configured/live.

#### 4. `tfv_rejected` must read as "fix and resubmit TFV", not "switch to manual 10DLC"

The current settings UI already has a "Manual business registration fallback" block. If `tfv_rejected` is not separated carefully, owners may assume they should switch sender architecture instead of correcting TFV.

**Required incorporation:** the rejection state should explicitly say:

- the toll-free sender exists
- verification failed
- this is a fix-and-resubmit flow
- manual 10DLC remains a separate legacy path, not the default answer to TFV rejection

#### AI 2 close-out

I consider the **overall plan sound**. My review is complete, but frontend sign-off assumes the four incorporation points above become part of the actual implementation + verification scope.

### AI 4 (Phone AI) review
*(pending)*
