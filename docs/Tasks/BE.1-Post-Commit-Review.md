# AI 3 Post-Commit Review: BE.1 withJobLock

> [[Home]] > QA | Reviewer: AI 3 (Verdent) | Date: 2026-04-15
> Related: [[Tasks/BE.1-Distributed-Lock]], [[Tasks/job_locks-Emergency-Runbook]]

---

## Статус: ✅ APPROVED з нотаткою

### Що перевірив

| # | Checkpoint | Результат |
|---|---|---|
| 1 | `withJobLock` helper в `backend/index.js` | ✅ Знайдено на рядку 10652 |
| 2 | Transaction pattern для Firestore | ✅ Коректний `db.runTransaction()` |
| 3 | 7 jobs wrapped | ✅ Всі 7 jobs (lines 10712-10726) |
| 4 | `[JOBS] Instance id` лог | ✅ Є (line 10657) |
| 5 | TTL/expiration logic | ⚠️ Потребує уваги — див. нижче |

### Код review

**Позитиви:**
- ✓ Lazy logging `_jobInstanceLogged` — логує instance ID тільки один раз
- ✓ Two-phase: acquire → run → release
- ✓ Conditional release: перевіряє `locked_by === JOB_INSTANCE_ID` перед delete
- ✓ Error handling: try/catch на acquire, run, і release
- ✓ Graceful degradation: якщо release fails — lock expire через TTL

**Потенційна проблема — TTL:**

Firestore **НЕ** має автоматичного TTL на поле `locked_until`. Документи в `job_locks/` **не видаляться автоматично** — вони залишаться назавжди якщо release не спрацює.

**Рекомендація:**
Додати Cloud Function або scheduled job що очищає `job_locks/` де `locked_until < now - 1 hour`. Або документувати що колекція потребує періодичного manual cleanup.

### Всі 7 jobs wrapped

```javascript
// Lines 10712-10726
withJobLock('runAutoReminders', 600, runAutoReminders)
withJobLock('runAutoMemberships', 600, runAutoMemberships)
withJobLock('runRetentionCleanup', 900, runRetentionCleanup)
withJobLock('runPayrollAudit', 900, runPayrollAudit)
withJobLock('runBookingAudit', 900, runBookingAudit)
withJobLock('runSmsAutoProvisionRetry', 600, runSmsAutoProvisionRetry)
withJobLock('runAIDiagnosticScan', 1800, ...)
```

### Cloud Run Logs

❌ Не маю доступу до `gcloud logging` (потрібна автентифікація).

**Owner:** Будь ласка, перевірте логи:
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=vuriumbook-api AND \"[JOBS]\"" --limit=20
```

Шукаємо:
- `[JOBS] Instance id: xxx · distributed lock active`
- `[JOBS] runAutoReminders lock acquired`
- `[JOBS] runAutoReminders lock released` (або `will expire on TTL`)

### Рекомендації

1. **High:** Додати TTL policy для `job_locks/` колекції або scheduled cleanup
2. **Medium:** Моніторити розмір `job_locks/` — якщо >100 документів, щось не так
3. **Low:** Додати метрику "job execution time" для оптимізації TTL values

### DoD Checklist

- [x] `withJobLock` helper прочитано і зрозуміло
- [x] Transaction pattern коректний
- [ ] Cloud Run logs перевірено (потрібен Owner)
- [x] 7 jobs wrapped
- [ ] QA-Scan оновлено

---

*Review by AI 3 (Verdent) · 2026-04-15*
