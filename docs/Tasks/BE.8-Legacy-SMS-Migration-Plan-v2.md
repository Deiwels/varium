# BE.8 — Міграція Legacy SMS Статусів (FINAL v2)

> [[Home]] > Tasks | Owner: **AI 1 (Claude)** — реалізація після погодження плану
> Planner: AI 3 (Verdent) | Date: 2026-04-15 (REVISED per AI 1 + AI 2 review)
> Status: **PLAN APPROVED ✅ — READY FOR IMPLEMENTATION**
> Related: [[Tasks/3-AI-Remaining-Work-Split]], [[Features/SMS & 10DLC]]
> Review Gate: AI 1 ✅ | AI 2 ✅ | AI 4 ✅ | Owner ✅

---

## Зміни в цій версії (v2)

| Issue | Від кого | Виправлення |
|---|---|---|
| Dry-run mode | AI 1 | Додано `?dryRun=true` параметр до migration endpoint |
| Batch writes | AI 1 | Firestore `db.batch()` з лімітом 500 операцій |
| Rollback path | AI 1 | Pre-export step (Owner responsibility) + manual restore endpoint |
| Frontend dependencies | AI 2 | Додано розділ "Frontend Impact Analysis" |
| UI behavior change | AI 2 | Explicit: приймаємо спрощення до `pending`/`none` |
| Dev panel granularity | AI 2 | Explicit: приймаємо втрату деталізації в dev panel |

---

## Контекст

`LEGACY_SMS_STATUSES` Set містить 7 старих статусів. Мета — мігрувати workspaces на нову схему та видалити Set.

---

## Покроковий план

### Pre-Step 0 — Firestore Export (Owner)

**Перед будь-якою міграцією Owner має зробити:**
```
Google Cloud Console → Firestore → Export → 
Колекція: workspaces (усю)
Зберегти в: gs://vuriumbook-backups/firestore-pre-be8-migration/
```

Це дає повний rollback — можна відновити будь-який документ.

### Крок 1 — Audit Endpoint

```
GET /api/vurium-dev/sms/legacy-audit
```

Відповідь:
```json
{
  "total": 3,
  "workspaces": [
    { "id": "...", "slug": "...", "status": "pending_otp", "number_type": "10dlc" }
  ]
}
```

### Крок 2 — Migration Endpoint (з dry-run)

```
POST /api/vurium-dev/sms/migrate-legacy-statuses?dryRun=true
POST /api/vurium-dev/sms/migrate-legacy-statuses?dryRun=false
```

**Логіка:**

| Старий статус | Новий статус | Умова |
|---|---|---|
| `pending_otp` | `none` | немає `telnyx_brand_id` |
| `verified` | `none` | немає `telnyx_brand_id` |
| `brand_created` | `pending` | є `telnyx_brand_id` |
| `pending_campaign` | `pending` | є `telnyx_brand_id` |
| `pending_number` | `pending` | є `telnyx_brand_id` |
| `pending_approval` | `pending` | завжди |
| `pending_vetting` | `pending` | завжди |

**Правила:**
- Element Barbershop — **пропускаємо**
- `db.batch()` — максимум 500 операцій (audit покаже якщо більше)
- Логування: `console.log('[BE.8]', dryRun ? 'DRY' : 'MIGRATE', wsId, old, '→', new)`

**Відповідь:**
```json
{
  "dryRun": true,
  "total": 3,
  "transitions": [...],
  "elementSkipped": true,
  "batches": 1
}
```

### Крок 3 — Верифікація

```
GET /api/vurium-dev/sms/legacy-audit → total: 0
```

### Крок 4 — Видалення LEGACY_SMS_STATUSES

1. Видалити `const LEGACY_SMS_STATUSES = new Set([...])`
2. В `isLegacyManualSmsPath()` — видалити `|| LEGACY_SMS_STATUSES.has(status)`
3. Переконатися що функція коректна без Set

### Крок 5 — Rollback Endpoint (на випадок проблем)

```
POST /api/vurium-dev/sms/restore-legacy-status/{wsId}
```

Читає з backup export (Owner має дати шлях) і відновлює оригінальний статус.

---

## Frontend Impact Analysis (AI 2 input)

### Файли які залежать від legacy статусів:

1. **app/settings/page.tsx:118** — використовує `pending_otp` для resume
2. **app/settings/page.tsx** — `manualInReview` масив з 6 legacy статусів
3. **app/developer/sms/page.tsx:68** — рендерить детальні legacy step names

### Рішення (прийнято AI 2 + AI 3):

- ✅ **Приймаємо спрощення:** всі legacy статуси колапсуються в `pending` або `none`
- ✅ **Settings UI:** спрощується до двох станів — "очікує налаштування" vs "готово"
- ✅ **Dev panel:** втрачаємо деталізацію кроків, але gain — простота
- ✅ **Paired cleanup:** AI 2 робить cleanup frontend після того як AI 1 смерджить backend

---

## DoD

- [ ] Owner зробив Firestore export
- [ ] `GET /api/vurium-dev/sms/legacy-audit` показує `total: 0`
- [ ] `LEGACY_SMS_STATUSES` видалено
- [ ] `isLegacyManualSmsPath()` працює без Set
- [ ] Element Barbershop не змінено
- [ ] AI 2 зробив frontend cleanup
- [ ] Commit: `fix(backend): BE.8 migrate legacy SMS statuses`
- [ ] DevLog запис
