# Emergency Runbook: job_locks Collection

> [[Home]] > Tasks | Owner: AI 3 (Verdent) | Created: 2026-04-15
> Related: [[Tasks/BE.1-Distributed-Lock]], [[DevLog/2026-04-15]], [[AI-Profiles/AI-4-Phone-AI]]

---

## Коли використовувати цей runbook

**Тригер:** Background jobs (SMS reminders, payroll audit, auto-provision retry) перестали виконуватись або виконуються дубльовано на кількох Cloud Run instances.

**Причина:** `job_locks/` колекція в Firestore має stale locks після crash або deadlock.

---

## Швидка діагностика (2 хвилини)

### 1. Перевірити Cloud Run logs
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=vuriumbook-api AND \"[JOBS]\"" --limit=50 --format="value(timestamp,textPayload)"
```

**Шукаємо:**
- `[JOBS] Instance id: xxx` — чи є різні instance ID (multi-instance scale)
- `[JOBS] Lock acquired: runAutoReminders` — чи бере лок хоча б один instance
- `[JOBS] Lock skipped: runAutoReminders` — нормально якщо інший instance взяв
- **Проблема:** `[JOBS] Lock failed: runAutoReminders` або відсутність будь-яких `[JOBS]` логів

### 2. Перевірити job_locks колекцію в Firestore

**Firebase Console → Firestore Database → job_locks/**

**Нормально:**
- Документи з `locked_until` в майбутньому (now + TTL)
- `locked_by` відповідає активному instance ID з logs

**Проблема:**
- `locked_until` в минулому + документ не видалився (stale lock)
- Документи з `locked_by` що не з'являються в логах (orphaned lock)
- Більше 7 документів (по одному на job) — зайві документи

---

## Emergency Fix Option A: Manual Lock Cleanup (5 хвилин)

**Використовуємо коли:** stale locks, але система не в critical state.

### Кроки:

1. **Зупинити background jobs** (щоб не створювали нові locks під час cleanup):
   ```bash
   # В Cloud Run console → Edit & Deploy New Revision
   # Додати тимчасово: DISABLE_BACKGROUND_JOBS=true
   # Або через gcloud:
   gcloud run services update vuriumbook-api --set-env-vars=DISABLE_BACKGROUND_JOBS=true
   ```

2. **Очистити job_locks колекцію:**
   ```javascript
   // Firebase Console → Firestore → job_locks/ → Delete collection
   // Або через Node.js скрипт (якщо маємо доступ):
   const batch = db.batch();
   const locks = await db.collection('job_locks').get();
   locks.docs.forEach(doc => batch.delete(doc.ref));
   await batch.commit();
   console.log(`Deleted ${locks.size} stale locks`);
   ```

3. **Відновити background jobs:**
   ```bash
   gcloud run services update vuriumbook-api --remove-env-vars=DISABLE_BACKGROUND_JOBS
   ```

4. **Перевірити в логах:**
   - `[JOBS] Instance id: xxx` з'являється
   - `[JOBS] Lock acquired: ...` для кожного job
   - Jobs виконуються (SMS відправляються, audit логи з'являються)

---

## Emergency Fix Option B: Revert BE.1 (10 хвилин)

**Використовуємо коли:** deadlock рекурсивний, cleanup не допоміг, або критичний incident.

### Кроки:

1. **Знайти SHA для revert:**
   ```bash
   git log --oneline --grep="BE.1" | head -5
   # Шукаємо: 5dab7a1 feat(backend): BE.1 distributed lock...
   ```

2. **Revert:**
   ```bash
   git revert 5dab7a1 --no-edit
   git push origin main
   ```

3. **Перевірити deploy:**
   - Vercel / Cloud Run deploy успішний
   - Логи показують `setInterval` без `[JOBS]` префікса (unlocked mode)

4. **DevLog запис:**
   ```
   [HOTFIX] [AI 4] Reverted BE.1 distributed lock due to deadlock
   Reason: <опис проблеми>
   Reverted SHA: 5dab7a1
   ```

5. **AI 1 робить clean fix наступного дня** — не залишаємо на unlocked setInterval довго.

---

## Профілактика

### Перед кожним deploy що чіпає `job_locks/`:

1. **Перевірити TTL логіку:**
   - `locked_until = now + ttlSeconds` має бути коректним
   - `ttlSeconds` для кожного job: 600s (reminders), 900s (cleanup, audit), 1800s (AI scan)

2. **Перевірити release в `finally`:**
   ```javascript
   // Має бути:
   try {
     await acquireLock();
     await jobFn();
   } finally {
     await releaseLock(); // Це критично!
   }
   ```

3. **Перевірити instance ID:**
   - `[JOBS] Instance id: xxx` в логах при старті
   - Кожен instance має унікальний ID

---

## Контакти ескалації

| Рівень | Хто | Коли |
|---|---|---|
| 1 | AI 4 (Phone AI) | Emergency fix за цим runbook |
| 2 | AI 1 (Claude) | Root cause analysis, clean fix |
| 3 | Owner | Cloud Run console access, Firebase console |

---

## Last-known-good

**Якщо цей runbook не допоміг:**
- Остання відома робоча версія без distributed lock: **commit перед `5dab7a1`**
- Знайти: `git log 5dab7a1~1 --oneline -1`
- Повний revert BE.1 повертає до unlocked `setInterval`

---

*Created by AI 3 (Verdent) per AI4-REQ.1 · 2026-04-15*
