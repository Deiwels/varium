# BE.8 — Міграція Legacy SMS Статусів

> [[Home]] > Tasks | Owner: **AI 1 (Claude)** — реалізація після погодження плану
> Planner: AI 3 (Verdent) | Date: 2026-04-15
> Status: **PLAN READY — AI 1 може починати**
> Related: [[Tasks/3-AI-Remaining-Work-Split]], [[Features/SMS & 10DLC]]

---

## Контекст (чому це потрібно)

В `backend/index.js` є `LEGACY_SMS_STATUSES` — `Set` з 7 старими статусами SMS-реєстрації:
```js
const LEGACY_SMS_STATUSES = new Set([
  'pending_otp', 'verified', 'brand_created',
  'pending_campaign', 'pending_number',
  'pending_approval', 'pending_vetting'
]);
```

Ці статуси залишились від старої 10DLC/SP-реєстраційної логіки. Новий шлях використовує:
- `none` → `provisioning` → `pending` → `active` → `failed` / `failed_max_retries`

`LEGACY_SMS_STATUSES` використовується в `isLegacyManualSmsPath()` — функції, яка вирішує, чи workspace на старому manual шляху. Поки ці статуси є в Firestore у деяких workspaces — Set потрібен. Але ціль — прибрати цю залежність.

**Ризик якщо не робити:** Код стає складніше підтримувати. Нові AI не розуміють логіку "старих" vs "нових" статусів.

---

## Скоуп змін

**Тільки `backend/index.js`** — один файл, AI 1 scope.
Firestore workspaces — читання для міграції, не видалення.

---

## Покроковий план (AI 1 виконує)

### Крок 1 — Аудит (без коду)
Перевірити скільки workspaces мають legacy статус. Додати тимчасовий endpoint (тільки для superadmin):

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

Це дає точну картину — скільки записів треба мігрувати.

### Крок 2 — Migration endpoint (тільки для superadmin)

```
POST /api/vurium-dev/sms/migrate-legacy-statuses
```

Логіка міграції для кожного workspace з legacy статусом:

| Старий статус | Новий статус | Умова |
|---|---|---|
| `pending_otp` | `none` | якщо немає `telnyx_brand_id` |
| `verified` | `none` | якщо немає `telnyx_brand_id` |
| `brand_created` | `pending` | якщо є `telnyx_brand_id` |
| `pending_campaign` | `pending` | якщо є `telnyx_brand_id` |
| `pending_number` | `pending` | якщо є `telnyx_brand_id` |
| `pending_approval` | `pending` | завжди |
| `pending_vetting` | `pending` | завжди |

**Правила:**
- `Element Barbershop` (`isProtectedLegacyWorkspace`) — **пропускаємо**, не змінюємо
- Якщо є `telnyx_campaign_id` або `telnyx_phone_number` → мігруємо в `pending`, не `none`
- Зберегти `sms_number_type: '10dlc'` — не чіпати
- Логувати кожну зміну в DevLog через `console.log('[BE.8 MIGRATION]', wsId, oldStatus, '→', newStatus)`

### Крок 3 — Верифікація після міграції

Запустити знову `GET /api/vurium-dev/sms/legacy-audit` — має повернути `total: 0`.

### Крок 4 — Видалення LEGACY_SMS_STATUSES

Тільки після того як `total: 0` підтверджено:

1. Видалити `const LEGACY_SMS_STATUSES = new Set([...])` (~line 1969)
2. В `isLegacyManualSmsPath()` — видалити рядок `|| LEGACY_SMS_STATUSES.has(status)`
3. Переконатися що функція досі коректна:
```js
function isLegacyManualSmsPath(workspace, settings) {
  const numberType = safeStr(settings?.sms_number_type || '');
  return numberType === '10dlc'
    || !!settings?.telnyx_brand_id
    || !!settings?.telnyx_campaign_id
    || isProtectedLegacyWorkspace(workspace, settings);
}
```

### Крок 5 — Commit

```
fix(backend): BE.8 migrate legacy SMS statuses + remove LEGACY_SMS_STATUSES Set
```

DevLog запис обов'язковий перед комітом.

---

## Що НЕ робити (обмеження)

- ❌ Не видаляти `LEGACY_SMS_STATUSES` до підтвердження міграції через audit endpoint
- ❌ Не чіпати Element Barbershop
- ❌ Не видаляти `sms_number_type`, `telnyx_brand_id`, `telnyx_campaign_id` поля
- ❌ Не робити автоматичну міграцію при старті сервера (тільки через explicit endpoint)

---

## DoD

- [ ] `GET /api/vurium-dev/sms/legacy-audit` показує `total: 0` після міграції
- [ ] `LEGACY_SMS_STATUSES` видалено з коду
- [ ] `isLegacyManualSmsPath()` працює без `Set`
- [ ] Element Barbershop статус не змінено
- [ ] Commit `fix(backend): BE.8...` в main
- [ ] DevLog запис
