# Decision Log — Журнал Архітектурних Рішень

> [[Home]] > Architecture | Owner: AI 3 (Verdent — веде реєстр)
> Related: [[AI-Core-Manifesto]], [[Tasks/3-AI-Remaining-Work-Split|8-AI Work Split]]
> Created: 2026-04-15

---

> **Інструкція для всіх AI:**
> Перед тим як прийняти нове архітектурне рішення — прочитай цей файл.
> Якщо рішення вже тут є — дій відповідно до нього, не переосмислюй.
> Якщо приймаєш нове важливе рішення — додай сюди запис за шаблоном.

**Шаблон:**
```
## [DECISION-XXX] Назва рішення
Date: YYYY-MM-DD
Status: Accepted | Deprecated
Context: Чому виникло питання
Decision: Що вирішили
Alternatives considered: Що відкинули і чому
Consequences: Що це означає для майбутнього
```

---

## [DECISION-001] SMS Sender Model: Per-Workspace TFN (Dual-Path)

**Date:** 2026-04-15
**Status:** Accepted

**Context:**
Нам потрібно відправляти SMS клієнтам від імені кожного бізнесу. Виникло питання: використовувати один централізований номер платформи (як Booksy/Square) чи окремий toll-free номер (TFN) для кожного workspace.

**Decision:**
Залишаємось на **dual-path** моделі:
- Нові workspace → автоматичний per-workspace toll-free номер (`autoProvisionSmsOnActivation`)
- Grandfathered legacy → manual 10DLC шлях (Element та інші що реєстрували раніше)
- Email-only fallback якщо SMS не активний

**Alternatives considered:**
- **Platform-as-sender (один номер на всіх):** Спробували — отримали rejection з кодом **710** ("Reseller / Non-compliant KYC"). Carrier побачив різні назви бізнесів у sample messages і вирішив що VuriumBook є агенцією. Відкинуто.
- **Twilio замість Telnyx:** Досліджували. Дорожче, складніша реєстрація. Відкинуто.

**Consequences:**
- Кожен новий workspace отримує унікальний TFN автоматично при активації salon плану
- STOP від клієнта ізольований для конкретного workspace (правильно по CTIA)
- Platform-sender pivot можливий в майбутньому — тільки після письмового OK від Telnyx/Jonathan і повного TFV approval. Поки заблоковано.
- `getWorkspaceSmsConfig` з `allowGlobalFallback: false` залишається для reminder flows (навмисно)

---

## [DECISION-002] Element Barbershop — Protected Legacy Path

**Date:** 2026-04-15
**Status:** Accepted

**Context:**
Element Barbershop проходить manual 10DLC реєстрацію (brand + campaign CICHCOJ). Їхній шлях відрізняється від нових workspace. Виникло питання чи застосовувати до них нові автоматизації.

**Decision:**
Element Barbershop є **protected legacy workspace** — жодна автоматизація не зачіпає цей workspace без явного OK від Owner.
- `isProtectedLegacyWorkspace(wsId)` guard присутній у backend
- `autoProvisionSmsOnActivation` повертає 409 для Element — це не помилка, це очікувана поведінка
- 10DLC campaign CICHCOJ реєструється вручну через Telnyx portal

**Alternatives considered:**
- Міграція Element на toll-free: відкинуто — вони вже в процесі 10DLC review, переривати не можна
- Застосування auto-provision: відкинуто — порушить поточний manual flow і може зламати 10DLC submission

**Consequences:**
- Будь-яка задача що стосується Element → Escalation Trigger, потрібен OK від Owner
- `isProtectedLegacyWorkspace` guard не видаляти
- Після успішного 10DLC approval Element може перейти на стандартний шлях — але це окреме рішення Owner'а

---

## [DECISION-003] Real-time Messages: Polling замість WebSockets

**Date:** 2026-04-15
**Status:** Accepted

**Context:**
Внутрішній чат між стаф-членами потребує оновлення повідомлень. Питання: використовувати WebSockets (real-time) чи polling (інтервальні запити).

**Decision:**
Використовуємо **polling кожні 15 секунд** через `useVisibilityPolling` hook.
- Polling автоматично зупиняється коли вкладка не активна (visibility API)
- Відновлюється одразу при поверненні на вкладку

**Alternatives considered:**
- **WebSockets:** Потребує persistent connection, складніша інфраструктура на Cloud Run (stateless контейнери), додаткові коти. Відкинуто як over-engineering для поточного масштабу.
- **Firestore real-time listeners:** Додає залежність від Firebase SDK на фронті, складніша auth інтеграція. Відкинуто.
- **Server-Sent Events (SSE):** Потребує підтримки на Cloud Run, складніше ніж polling для поточного обсягу. Відкинуто.

**Consequences:**
- Максимальна затримка доставки повідомлення: 15 секунд
- При переході на real-time в майбутньому: змінити `useVisibilityPolling` у `lib/useVisibilityPolling.ts` і відповідний backend endpoint
- Polling є прийнятним рішенням до ~1000 активних користувачів одночасно

---

## [DECISION-004] Auth токен: localStorage vs httpOnly Cookie

**Date:** 2026-04-15
**Status:** Accepted (з планом міграції)

**Context:**
JWT токен зберігається в `localStorage` на фронті. Це вразливо до XSS атак. Backend вже видає `vuriumbook_token` як httpOnly cookie.

**Decision:**
Поточний стан — `localStorage` (залишаємо для launch). Міграція на httpOnly cookie запланована як **FE.20** після launch (потребує координації AI 1 + AI 2).

**Alternatives considered:**
- **Негайна міграція:** Відкинуто — ризик зламати auth flow перед launch, потребує синхронної зміни frontend + backend
- **Memory-only storage (не localStorage, не cookie):** Відкинуто — втрачається сесія при refresh

**Consequences:**
- До міграції: XSS вразливість теоретично існує (прийнятний ризик для pre-launch)
- Міграція FE.20: `apiFetch` змінює `Authorization: Bearer` на `credentials: 'include'`, backend приймає cookie замість header
- Не починати FE.20 без погодженого плану від AI 3

---

## [DECISION-005] Firestore: Multi-tenant під одним проєктом

**Date:** 2026-04-15
**Status:** Accepted

**Context:**
Всі workspace зберігаються в одному Firestore проєкті під шляхом `workspaces/{wsId}/...`. Питання: чи потрібна ізоляція на рівні проєктів.

**Decision:**
Залишаємось на **single Firestore project, multi-tenant через wsId** в middleware.
- `resolveWorkspace` middleware встановлює `req.wsId` для кожного запиту
- Всі queries фільтруються через `wsId` — дані між workspace не перетікають

**Alternatives considered:**
- **Окремий Firestore проєкт на workspace:** Надмірно складно, дорого, не потрібно на поточному масштабі. Відкинуто.
- **Firestore Security Rules для ізоляції:** Складно підтримувати поряд з backend auth. Відкинуто на користь backend-side isolation.

**Consequences:**
- Помилка в `resolveWorkspace` або пропущений `wsId` фільтр = потенційний cross-tenant data leak
- Кожен новий endpoint обов'язково використовує `req.wsId` (не `req.params.wsId` або захардкоджений ID)
- Escalation Trigger: будь-яка зміна в `resolveWorkspace` middleware потребує review AI 3 + Owner

---

## [DECISION-006] Web ↔ Native iOS Auth: Legacy Cookie Compatibility Layer

**Date:** 2026-04-14
**Status:** Accepted
**Trigger:** Production regression + 3 hotfixes (`95d40fc`, `59fdd7b`, `c97e184`) на 2026-04-14

**Context:**
Next.js web app використовує канонічну cookie `VURIUMBOOK_TOKEN` (role:uid) для middleware redirect logic. Shipped iOS app (`VuriumWebView.swift`) при cold start ставить `vuriumbook_auth` (legacy alias) + `vuriumbook_token` (HttpOnly JWT). Web і native розбіглись у двох контрактах. Результат на prod 2026-04-14: для logged-in iOS user — чорний екран; для fresh signin — безкінечний `/dashboard → /signin → /dashboard` loop. Apple review був активний коли регресія трапилась.

**Decision:**
Веб-сторона **тримає legacy compatibility layer** поки не перевипущений iOS bundle. Конкретно:

1. `middleware.ts` приймає **обидва** `VURIUMBOOK_TOKEN` і `vuriumbook_auth`. Якщо присутній тільки legacy — дзеркалить у canonical на response.
2. `lib/auth-cookie.ts` `setAuthCookie()` пише **обидві** cookies одночасно при web login.
3. `clearAuthCookie()` чистить **усі три** (`VURIUMBOOK_TOKEN`, `vuriumbook_auth`, `vuriumbook_token`) **з прапором `Secure`** при HTTPS (інакше Safari/WKWebView ігнорують видалення).
4. `lib/api.ts` на будь-який non-login 401: `clearAuthCookie()` + **`window.webkit.messageHandlers.logout.postMessage('logout')`** щоб native Swift очистив `UserDefaults.vurium_auth_token` + `vurium_user_json`. Без postMessage Swift реінжектить токен на наступному page load через restore script (`VuriumWebView.swift:468-488`).
5. `components/Shell.tsx` має fallback: якщо `localStorage.VURIUMBOOK_TOKEN` порожній — читати legacy `vuriumbook_token` cookie і промотувати в localStorage.

**Alternatives considered:**
- **Emergency native bundle release:** Відкинуто — App Store review пауза + активний Apple review running = ризик відхилення і тижневий delay.
- **Перейменувати web-сторону назад на legacy:** Відкинуто — ще гірше, зламає web-only users. Canonical name залишається.
- **Відкласти compatibility layer, дочекатися native release:** Відкинуто — prod був down для всіх iOS installs.

**Consequences:**
- **Load-bearing legacy:** `vuriumbook_auth` cookie є **обов'язковим** для роботи iOS users. Її не можна видалити поки не зроблений coordinated native release + не оновлена найстаріша підтримувана версія iOS app.
- **Will it lock?** Так, поки native bundle не буде rebuilt with canonical name + користувачі не оновлять app з App Store.
- **Escalation Trigger:** Будь-яка зміна в `middleware.ts` cookie check, `lib/auth-cookie.ts`, `lib/api.ts` 401 handler, `Shell.tsx` `redirectToSignIn`, backend `getTokenFromReq`, або native `VuriumWebView.swift` UserDefaults keys — потребує read [[Web-Native-Auth-Contract]] + escalation до Owner.
- **Cleanup path:** Після native rebuild з canonical name → `middleware.ts` і `lib/auth-cookie.ts` можуть прибрати legacy fallback. **Не раніше.**
- Повна специфікація контракту + auth chain + failure modes → [[Web-Native-Auth-Contract]]
