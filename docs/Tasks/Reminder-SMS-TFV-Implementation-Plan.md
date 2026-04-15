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
- [x] AI 4 (Phone AI) — review emergency/rollback risk → notes recorded below (2 critical + 2 important incorporations requested, not blocking gate)
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

**Reviewer:** AI 4 / Phone AI · **Date:** 2026-04-15 · **Lens:** emergency / rollback / incident risk

**Verdict:** план sound з emergency перспективи. Rollback path існує, Element захищений через 2 незалежних guards, 99% існуючого прод трафіку не зачеплено. Я **не блокую** gate, але є 5 конкретних пунктів, які варто інкорпорувати перед Owner approval — з них 2 critical (rollback completeness + duplicate TFV requests), решта important/nice-to-have.

#### Issue 1 (Critical) — Rollback plan неповний: не адресує `runTfvStatusCheck` під час та після revert

План у § Rollback Plan каже "Revert один рядок: `configured` → `active`". Це не повний rollback якщо `runTfvStatusCheck` вже landed і в проді:

- Після revert нові provisions знов пишуть `active` ✅
- **Але** polling job все ще існує в коді і крутиться щохвилини
- Workspaces які застрягли у `tfv_pending` (провізовані ДО revert) залишаються там — polling продовжує їх чіпати, може overwrite'нути на `tfv_rejected`, на live workspace з'явиться неочікуваний статус
- Telnyx API calls за TFV status для workspaces що теоретично "вже active" — запити марні, можливий rate-limit burn

**Обов'язкова інкорпорація в план:**

```
Immediate rollback sequence (not single-line revert):

1. git revert <TFV commit SHA> — відкочує і lifecycle change, і runTfvStatusCheck
   (не revert'ити тільки частково — job і lifecycle мають йти парою)
2. POST /api/vurium-dev/sms/force-status для кожного workspace у tfv_pending
   або tfv_rejected, батч-переведення на active (або configured якщо Owner
   не хоче forcibly активувати непідтверджені)
3. Cloud Run traffic rollback до попередньої revision (pre-TFV)
4. Verify: Cloud Run logs більше не показують [TFV] prefix
```

Також у commit message TFV impl **обов'язково** додати `Last-known-good SHA: <preceding-SHA>` — AI4-REQ.2 convention тепер active per `e911506`, і для TFV цей SHA буде потрібен AI 4 найпершим при revert call.

#### Issue 2 (Critical) — Немає idempotency check перед TFV submit

Плану § 2.2 каже: "На успіх: записати `sms_tfv_request_id`". Але якщо `provisionTollFreeSmsForWorkspace` викликається двічі паралельно (signup race condition + Stripe webhook + Apple IAP verify — 3 entry points per [[Features/SMS & 10DLC]]), ми можемо отримати 2 незалежні TFV requests до Telnyx для одного workspace.

**Наслідки:**
- Telnyx рахує кожен request окремо — два `tfv_pending` requests у їхньому портал
- `runTfvStatusCheck` polling первісно бачить лише перший `sms_tfv_request_id`, другий висить orphan'ом у Telnyx
- Можливий "Rejected: duplicate business" результат на другий request

**Обов'язкова інкорпорація в план:**

```
Перед POST /v2/messaging_tollfree/verification/requests:
1. Read Firestore: sms_tfv_request_id вже existing?
2. Якщо exists AND поточний status ∈ {tfv_pending, active, tfv_rejected}
   → skip TFV submit, повернутись з already-submitted result
3. Інакше → submit і записати sms_tfv_request_id у transaction
   (db.runTransaction щоб race не привів до 2 паралельних writes)
```

Це дзеркалить BE.1 `withJobLock` pattern (`5dab7a1`) і тримає Gap 5 auto-provision architecture consistent.

#### Issue 3 (Important) — `tfv_pending` needs max-TTL + retry cap

План не описує що робити коли TFV застрягає у `Waiting For Telnyx` > N днів. Plausible real-world scenario: Telnyx ops не дотягнули, owner забув, workspace застряг навічно.

`runTfvStatusCheck` polling крутиться вічно без guardrail.

**Обов'язкова інкорпорація:**

- Додати `sms_tfv_submitted_at` → якщо > 14 днів у `tfv_pending` без прогресу, emit alert (DevLog або Cloud Run log з `[TFV] STUCK wsId=...`)
- Max retry cap для **самого TFV submit**: якщо Telnyx API повертає 5xx 3 рази підряд, залишити `configured` + `sms_tfv_last_error` + НЕ ретраї автоматично — потребує Owner manual resubmit через Step 2.6 endpoint
- Exponential backoff для polling викликів якщо Telnyx повертає 429 (rate limit)

Це синхронізується з pattern'ом `autoProvisionSmsOnActivation` (exponential backoff + max retries, landed в Gap 5).

#### Issue 4 (Important) — Pre-deploy existing `active` workspaces потребують explicit policy decision

На момент deploy є workspaces з `sms_registration_status: 'active'` які **НЕ** пройшли TFV (старий код ставив `active` одразу). План мовчить про них:

- Якщо нічого не робити → ці workspaces технічно не verified Telnyx'ом, можуть отримати 40329 error при наступному reminder
- Якщо backfill'ити (запустити TFV для них post-deploy) → raptor mass TFV submissions до Telnyx одночасно, може trigger rate limits or look suspicious
- Якщо grandfather'ити → треба явно позначити `sms_tfv_grandfathered: true` або щось подібне, щоб `runTfvStatusCheck` їх не чіпав

**Рекомендація:** план має чітко сказати:

```
Pre-deploy workspaces с status='active':
- НЕ backfill TFV автоматично
- Зберегти status='active' as-is
- Додати field sms_tfv_grandfathered: true щоб runTfvStatusCheck їх не
  підхопив (фільтрувати у query: WHERE status='tfv_pending' AND
  grandfathered != true)
- Owner decision у майбутньому чи запускати backfill TFV manually
```

Або — explicit decision "ignore for now, address if complaints" записано у план з rationale.

#### Issue 5 (Nice-to-have) — Webhook замість polling

Telnyx підтримує TFV status change webhooks. Polling кожні 3 хв × N workspaces = marne API traffic + latency update 0-3 min. Webhook = real-time + zero polling cost.

**Не блокер для MVP**, але варто записати в `Backlog.md` або новий plan doc на майбутню ітерацію. Якщо webhook імплементувати зараз — треба:
- Новий endpoint `POST /api/webhooks/telnyx-tfv` з signature verification (вже є `verifyTelnyxWebhookSignature` з Gap 2)
- Webhook subscription у Telnyx portal

Polling все одно треба залишити як fallback (у випадку пропущеного webhook). Architecture pattern: webhook = primary, polling every 30 min = backup.

#### Emergency hot zone impact

Додаю до моєї hot zones list:

```
Hot Zone #11 — Reminder SMS TFV lifecycle (post-deploy)
Status: 🟠 medium risk
Trigger scenarios:
  - Rollback cascade если Issue 1 не адресовано
  - Duplicate TFV requests якщо Issue 2 не адресовано
  - Stuck-forever pending без Issue 3 cap
Rollback SHA: <TBD — AI 1 додає в commit message>
Emergency runbook: [[Tasks/TFV-Inspection-and-Submission-Runbook]] + force-status endpoint
```

Після gate closure і deploy я оновлю цю hot zone у наступному standby check.

#### Element Barbershop safety — ✅ acceptable

Grep-verified (AI 1's BE.8 commit 2 confirmation): Element carries `numberType='10dlc'` + `telnyx_brand_id` + `telnyx_campaign_id`, тому `isLegacyManualSmsPath()` повертає `true` і `provisionTollFreeSmsForWorkspace` для нього не запуститься. Додатково `isProtectedLegacyWorkspace()` match'ить slug+name. Two independent guards — достатньо. План пункт § 4 коректно описує.

Одна додаткова перевірка для § 4 Element Guard Verify: `runTfvStatusCheck` query має також виключати Element defense-in-depth — навіть якщо Element якимсь чином отримає `sms_registration_status: 'tfv_pending'` (не повинен, але hypothetically), polling не повинен його зачепити:

```js
// У runTfvStatusCheck query:
WHERE sms_registration_status == 'tfv_pending'
  AND !isProtectedLegacyWorkspace(workspace)  // defense-in-depth
```

#### AI 4 close-out

- ✅ **Gate: дозволено** (не блокую)
- ⚠️ **Critical incorporations перед merge:** Issue 1 (rollback completeness) + Issue 2 (idempotency)
- ⚠️ **Important incorporations перед deploy:** Issue 3 (TTL/retry caps) + Issue 4 (grandfather policy)
- 🔜 **Post-launch follow-up:** Issue 5 (webhook) у Backlog
- 📱 **Post-deploy:** Hot Zone #11 додано до AI 4 watch list. Потрібен pilot-workspace monitoring від Owner + AI 3.

Якщо Verdent оновить план з issues 1-4 → я офіційно ставлю `[x]` без повторного review.

**Sign:** AI 4 / Phone AI · 2026-04-15
