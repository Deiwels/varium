# AI 4 Emergency Readiness Review — 2026-04-15

> [[Home]] > Tasks | Reviewer: AI 4 (Phone AI) | Scope: emergency lens on 4-AI plan
> Related: [[AI/AI-4-Phone-AI]], [[AI-Core-Manifesto]], [[Tasks/3-AI-Remaining-Work-Split|4-AI Work Split]], [[Tasks/In Progress]], [[Tasks/QA-Scan-2026-04-15]], [[Web-Native-Auth-Contract]]

---

## ⚠️ Meta / Scope note

Цей doc написаний **AI 4 (Phone AI)** на явний запит Owner'а. Зазвичай reviews і runbooks — територія **AI 3 (Verdent)** за [[AI-Work-Split]] і [[AI/AI-3-Verdent]]. Owner override acknowledged. Після цього ревю я (AI 4) повертаюся в standby; подальші updates цього документа робить AI 3 або AI 1.

**Lens для ревю:** "Коли мене викличуть у наступні 7 днів, де найбільший ризик, чи зможу я реально зупинити кровотечу?"

---

## 1. Поточний стан — чи горить щось зараз?

**✅ Нема активних emergencies.** Останній закритий інцидент — iOS auth-loop 2026-04-14:

- Першим emergency запис у [[AI-Session-Acceptance-Log]]: **19:49 CDT**
- Перший hotfix commit `95d40fc`: **19:44:52 CDT**
- Повний fix chain (`95d40fc` + `59fdd7b` + `c97e184`) завершено: **19:57:28 CDT**
- Owner live-test on device — **20:10 CDT**
- Тривалість інциденту: ~25–30 хвилин

Жодних emergency acceptance-log записів після 2026-04-14 20:00 немає. Я у standby.

---

## 2. Hot zones — де найбільший ризик виклику AI 4 у найближчий тиждень

| # | Зона | Чому ризикова | Що я (AI 4) можу зробити швидко | Що вимагатиме AI 1 / AI 3 |
|---|---|---|---|---|
| 1 | **Auth / iOS WKWebView contract** | 3 recent hotfixes landed (`95d40fc` + `59fdd7b` + `c97e184`). Будь-який дотик до `middleware.ts` / `lib/auth-cookie.ts` / `lib/api.ts` / `Shell.tsx` ризикує знов зламати cookie-ланцюг. [[Web-Native-Auth-Contract]] — load-bearing | `git revert` одного з 3 hotfix комітів | Native rebuild iOS bundle — Owner + Xcode |
| 2 | **BE.1 distributed lock (`withJobLock`)** — commit `5dab7a1` | Нова Firestore transaction-логіка, **не тестована під multi-instance**. Якщо `job_locks/` deadlock — 7 background jobs перестають виконуватись (SMS reminders, payroll audit, auto-provision retry) | Manual очищення `job_locks/` collection у Firestore + `git revert 5dab7a1` → повертає unlocked `setInterval` | Root cause debug — AI 1 |
| 3 | **Telnyx webhook signature enforcement** (Gap 2) | Тепер ACTIVE в prod з `TELNYX_WEBHOOK_PUBLIC_KEY`. Якщо секрет rotates в GitHub Secrets без оновлення — ВСІ Telnyx webhooks 401, STOP handling / 10DLC status updates зупиняються | Швидко закоментувати `verifyTelnyxWebhookSignature()` — **але це security regression**, тільки з явним "go" Owner'а | Owner має поновити `TELNYX_WEBHOOK_PUBLIC_KEY` — це єдиний справжній фікс |
| 4 | **Stripe webhook** (BUG-013 fix `849e998`) | `isWebhookEndpoint()` bypass для CSRF+auth. Якщо регресія — payments webhooks 401 → subscriptions не активуються | `git revert` до попередньої версії helper | Payment-sensitive — Owner MUST know before commit |
| 5 | **Element 10DLC resubmit** | Owner має клікнути Resubmit. Якщо вдруге fail — Post-resubmit protocol says **STOP and re-plan with AI 3**, не hot-patch | — | AI 3 (Verdent) повний план |
| 6 | **Apple IAP Gap 5** — `autoProvisionSmsOnActivation` | Wired на 3 activation paths. Якщо Apple webhook падає з неdefined `wsId` — новий paying customer не отримує TFN | Швидкий null-guard patch; revert якщо логіка глибша | AI 1 повний root-cause |

---

## 3. Rollback paths — чи зможу я їх виконати?

| Сценарій | Rollback готовий? | Нотатки |
|---|---|---|
| **BE.1 lock регресія** | ✅ Явно прописано в `DevLog/2026-04-15.md`: "revert the commit. Existing jobs go back to unlocked setInterval. No data migration, no state to clean up except `job_locks/` docs which expire on their own within 30 minutes" | Я можу діяти впевнено |
| **Stripe webhook регресія** | ⚠️ Не документовано явно — є `isWebhookEndpoint()` helper, але revert треба буде точно підібрати SHA перед `849e998` | **Gap:** варто додати "last-known-good SHA" в DevLog для payment-критичних комітів |
| **iOS auth регресія** | ✅ [[Web-Native-Auth-Contract]] описує load-bearing contract; комміти `95d40fc` + `59fdd7b` + `c97e184` — відомий fix chain | Можу revert будь-який з трьох |
| **Cloud Run deploy failure** | ⚠️ Я **не маю** доступу до `gcloud run` revisions — тільки Owner через Google Cloud Console | **Gap:** якщо CI зламаний, я можу патчити workflow, але сам revision rollback — Owner |
| **Vercel deploy failure** | ⚠️ Аналогічно — я можу повернути код, але Vercel "Promote to Production" — Owner | Та сама історія |

---

## 4. Single points of failure (SPOF)

1. **Owner — SPOF для 12 external items у черзі.** Якщо Owner недоступний >24h, застигають:
   - CQ.1 / CQ.2 (Twilio recovery code purge, Apple demo creds migration)
   - OW-Gmail.1/2/3 (Gmail API OAuth consent)
   - OPS.1 `TELNYX_VERIFY_PROFILE_ID` (Jonathan call блокер)
   - Cloud Run + Vercel rollback permissions
   - Я не можу розблокувати нічого з цього. Це by design, але варто усвідомлювати
2. **`vuriumbook-api-*.us-central1.run.app`** — єдиний backend endpoint, `min_instances=0`. Cold start latency у normal час OK, але під час incident cold start = більше часу на fix-to-live
3. **Telnyx як SMS provider** — no fallback to Twilio. Якщо Telnyx API down → SMS reminders не йдуть, OTP верифікація не працює

---

## 5. Gaps у плані з точки зору emergency readiness

Що я **не бачу** в поточному плані і що хотілось би щоб AI 1 / AI 3 додали:

1. **Emergency runbook для `job_locks/` deadlock** — BE.1 це нова колекція; якщо треба manual-unlock, немає step-by-step.
   → **Пропоную AI 3 (Verdent) створити** `docs/Tasks/job_locks-Emergency-Runbook.md` (~10 min write)
2. **"Last-known-good SHA" tracker** для payment / auth / SMS hot zones — зараз є [[Web-Native-Auth-Contract]] для auth, але не для Stripe і не для Telnyx. Якщо мене викличуть — я буду копатись у `git log` замість одразу revert'ити
   → **Пропоную AI 1 (Claude)** у наступних payment/auth/SMS-критичних commits додавати `Last-known-good SHA: <SHA>` рядок у commit message
3. **On-call rotation / handoff protocol між AI 1 ↔ AI 4** — якщо AI 1 у процесі роботи і прод впав у той момент, хто приймає: я перехоплюю чи AI 1 перемикається? Manifesto § Rollback Protocol описує рівні, але не координацію в real-time
   → **Пропоную AI 3 додати розділ "AI 4 activation protocol"** у [[AI-Core-Manifesto]] або у [[AI/AI-4-Phone-AI]]
4. **Повний список `requireSuperadmin` ендпоінтів** — якщо в проді щось зламалось з auth middleware, треба швидко знати які endpoints impacted. Зараз треба grep'ати `backend/index.js`
   → **Пропоную AI 1** додати короткий список у [[API Routes]] або окремий `docs/Architecture/Superadmin-Endpoints.md`
5. **`TELNYX_WEBHOOK_PUBLIC_KEY` rotation protocol** — зараз секрет зафіксовано в GitHub Secrets, але немає runbook "що робити якщо треба повернути старий ключ екстренно"
   → **Пропоную AI 3** додати в [[Architecture/GitHub Secrets Inventory]] секцію "Rotation protocol per secret"

---

## 6. Що я зробив би, якби мене викликали прямо зараз

**На момент написання (2026-04-15 02:00 CDT):** нічого. Standby. План чистий, інцидентів нема.

**Сценарій "iOS app знов зламався":**

```
1. git log --oneline -5
2. Читаю [[Web-Native-Auth-Contract]] (Rule 6 вимагає)
3. Якщо регресія від свіжого коміту → git revert <SHA> + push
4. DevLog entry [HOTFIX] [AI 4]
5. Owner live-test + standby
```

**Сценарій "background jobs duplicated":**

```
1. git log --oneline → шукаю 5dab7a1 (BE.1)
2. Firestore console → job_locks/ — перевіряю stale локи з locked_until < now
3. Якщо так — видаляю вручну (з дозволу Owner)
4. Якщо deadlock рекурсивний → git revert 5dab7a1
5. DevLog entry
```

**Сценарій "Stripe webhooks 401":**

```
1. git log backend/index.js -10 → шукаю останню зміну біля isWebhookEndpoint
2. Перевіряю що /api/stripe/webhook ще в allowlist у isWebhookEndpoint
3. Якщо регресія — git revert або явний patch
4. Stop. Payment-sensitive — явний "go" Owner'а required before push
5. DevLog [HOTFIX] [AI 4] + AI 1 робить clean version наступного дня
```

---

## 7. Bottom line (AI 4 signoff)

**Launch readiness з моєї позиції:** 🟢 **ZELENY**
Система стабільна, rollback paths для більшості hot zones існують, план реалістичний.

**Що перестерігає:**
- ⚠️ BE.1 — untested at multi-instance scale. Перший реальний Cloud Run scale-up буде stress-test
- ⚠️ Gaps #1 і #2 з секції 5 (job_locks runbook + SHA tracker) — варто закрити **до** launch marketing push, не після
- ⚠️ Owner SPOF для 12 external items — якщо Owner візьме перерву у наступні 7 днів, більшість CQ/OW/OPS задач застигнуть

**Жодних emergency hotfix'ів я зараз не виконую.** Планом не передбачено, інцидентів нема. Повертаюсь у standby.

---

## 8. Action items for other AIs

Ці три запити — output цього ревю. Кожен AI вирішує сам чи прийняти, але якщо прийняти — прошу відмітити у [[Tasks/In Progress]] і виконати:

| # | Ask | Owner AI | Effort | Priority |
|---|---|---|---|---|
| AI4-REQ.1 | Створити `docs/Tasks/job_locks-Emergency-Runbook.md` з manual unlock procedure для `job_locks/` колекції + явний `git revert 5dab7a1` fallback | AI 3 (Verdent) | ~10 min | High — закриває #1 з gap list |
| AI4-REQ.2 | У наступних payment/auth/SMS-критичних commits додавати `Last-known-good SHA: <SHA>` рядок у commit message | AI 1 (Claude) | 0 min per commit — convention only | Medium — полегшує emergency revert |
| AI4-REQ.3 | Додати "AI 4 activation protocol" секцію у [[AI-Core-Manifesto]] або [[AI/AI-4-Phone-AI]]: хто кого перехоплює під час активної сесії AI 1, як handoff працює | AI 3 (Verdent) | ~15 min | Medium — процесна прогалина |
| AI4-REQ.4 | Додати короткий список `requireSuperadmin` endpoints у [[API Routes]] або окремий `docs/Architecture/Superadmin-Endpoints.md` | AI 1 (Claude) | ~15 min | Low — полегшує diagnostic |
| AI4-REQ.5 | Додати секцію "Rotation protocol per secret" у [[Architecture/GitHub Secrets Inventory]] — зокрема для `TELNYX_WEBHOOK_PUBLIC_KEY` (наслідки при ротації, fallback behavior) | AI 3 (Verdent) | ~15 min | Medium — Telnyx tight coupling |

---

*AI 4 / Phone AI · 2026-04-15 02:00 CDT · standby mode*
