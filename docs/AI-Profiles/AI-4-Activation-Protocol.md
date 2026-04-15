# AI 4 Activation Protocol

> [[Home]] > AI Profiles | Owner: AI 3 (Verdent) | Created: 2026-04-15
> Related: [[AI-Core-Manifesto]], [[AI-Profiles/AI-4-Phone-AI]], [[Tasks/job_locks-Emergency-Runbook]]

---

## Коли активується AI 4

AI 4 (Phone AI) — **Universal Quick-Fixer**. Він втручається тільки в emergency ситуації.

### Тригери активації (escalation conditions)

| # | Ситуація | Хто активує | Як активує |
|---|---|---|---|
| 1 | Production down (сайт не відкривається, 500 errors) | Owner або AI 1/2/3 | Повідомлення в `In Progress.md`: `@AI4 [EMERGENCY]: site down` |
| 2 | Critical data loss або corruption | Owner | Прямий запит до AI 4 |
| 3 | Auth system повністю зламаний (ніхто не може залогінитись) | AI 1 або AI 2 | `@AI4 [EMERGENCY]: auth broken` |
| 4 | Payments не працюють (Stripe webhooks 401, гроші не проходять) | Owner | Прямий запит — payment sensitive |
| 5 | AI 1/2/3 застрягли і не можуть вирішити конфлікт | Owner | Прямий запит |
| 6 | Security incident (підозра на breach, leaked credentials) | Owner | Прямий запит |

### Що НЕ є тригером для AI 4

- ❌ Regular bug (не critical, не blocking)
- ❌ Feature request
- ❌ Code review (це робить AI 3)
- ❌ Plan drafting (це робить AI 3)
- ❌ QA scanning (це робить AI 3)

---

## Протокол активації (Step-by-step)

### Крок 1: Хто активує — записує в `In Progress.md`

```markdown
## @AI4 [EMERGENCY]: <короткий опис>
**Time:** YYYY-MM-DD HH:MM UTC
**Activated by:** Owner / AI 1 / AI 2 / AI 3
**Severity:** P0 (down) / P1 (critical feature broken) / P2 (workaround exists)
**Symptoms:** <що саме зламалось>
**Last known good:** <commit SHA або час>
**AI 4: investigate and fix**
```

### Крок 2: AI 4 бере на себе задачу

AI 4 **одразу** (в межах тієї ж сесії):
1. Читає запис у `In Progress.md`
2. Діагностує проблему (logs, git history, recent commits)
3. Вирішує: revert, patch, або config change
4. **Не питає дозволу** — emergency = act first, ask later

### Крок 3: AI 4 виконує fix

**Дозволено в emergency:**
- `git revert` будь-якого коміту
- Edit будь-якого файлу (cross-scope allowed)
- Push до main
- Manual Firestore edits (з логуванням)

**Заборонено навіть в emergency:**
- Видалення даних клієнтів без Owner підтвердження
- Зміна secrets (тільки Owner)
- Force-push, reset --hard
- Skip DevLog запису

### Крок 4: AI 4 записує в DevLog

**Обов'язково одразу після fix:**

```markdown
# YYYY-MM-DD

## [HOTFIX] [AI 4] <назва проблеми>
**Time:** HH:MM UTC
**Activated by:** <хто активував>
**Root cause:** <що зламалось>
**Fix applied:** <що зробив AI 4>
**Files changed:** <список>
**Commits:** <SHA>
**Verification:** <як перевірили що працює>
**Follow-up:** <що треба зробити AI 1/2/3 після emergency>
```

### Крок 5: Owner verification

Owner **в той же день**:
- Перевіряє що production працює
- Підтверджує в `In Progress.md`: `✅ Verified by Owner`

### Крок 6: Clean fix by AI 1/2

AI 4 робить **hotfix** — швидко, може бути dirty.

AI 1 або AI 2 **наступного дня**:
- Роблять "clean version" фіксу у своєму scope
- Дотримуються всіх правил (tests, review, etc.)
- DevLog запис

---

## AI 4 ↔ AI 1/2/3 координація

### Якщо AI 1/2/3 активні під час emergency

**Сценарій:** AI 1 пише код, і тут падає production.

**Правило:**
1. AI 1 **зупиняється** — зберігає локальні зміни (stash або commit в WIP branch)
2. AI 4 бере на себе emergency
3. AI 4 фіксить
4. AI 1 **відновлює** свою роботу з master (можливо з merge conflicts)

**AI 1 не продовжує свою задачу поки emergency не закритий.**

### Якщо AI 4 потребує допомоги

AI 4 може попросити:
- **AI 1:** backend context, database schema
- **AI 2:** frontend context, UI behavior
- **AI 3:** plan context, architectural decisions

**Формат запиту:**
```
@AI1 [AI 4 NEEDS CONTEXT]: <питання>
Emergency in progress, need quick answer.
```

---

## Приклади активації

### Приклад 1: Site down

```markdown
## @AI4 [EMERGENCY]: Site returns 500 on all pages
**Time:** 2026-04-15 14:30 UTC
**Activated by:** Owner
**Severity:** P0
**Symptoms:** https://vurium.com shows "Application Error"
**Last known good:** commit abc1234 (2 hours ago)
**AI 4: investigate and fix**
```

AI 4 діє:
1. Дивиться логи — помилка в `middleware.ts`
2. `git log` — AI 2 зробив commit 30 хв тому
3. `git revert <bad-commit> --no-edit`
4. Push, перевіряє що site працює
5. DevLog: `[HOTFIX] [AI 4] Reverted middleware regression`
6. AI 2 наступного дня робить clean fix

### Приклад 2: Auth completely broken

```markdown
## @AI4 [EMERGENCY]: No one can login
**Time:** 2026-04-15 16:00 UTC
**Activated by:** AI 1
**Severity:** P0
**Symptoms:** /signin returns 401 for valid credentials
**Last known good:** commit def5678 (1 hour ago)
**AI 4: investigate and fix**
```

AI 4 діє:
1. Дивиться `lib/auth-cookie.ts` — недавня зміна
2. Швидкий patch: revert змінену строку
3. Push, тестує login
4. DevLog + повідомляє AI 1
5. AI 1 робить clean fix наступного дня

---

## AI 4 standby mode

Коли немає emergency:
- AI 4 **не читає** регулярно docs
- AI 4 **не пише** код
- AI 4 **не робить** review

AI 4 активується **тільки** за explicit trigger з цього протоколу.

---

## Related docs

- [[AI-Core-Manifesto]] — Rule 6, Rollback Protocol
- [[AI-Profiles/AI-4-Phone-AI]] — AI 4 profile
- [[Tasks/job_locks-Emergency-Runbook]] — конкретний runbook для BE.1
- [[Web-Native-Auth-Contract]] — auth-specific emergency context

---

*Created by AI 3 (Verdent) per AI4-REQ.3 · 2026-04-15*
