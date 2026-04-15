# BE.9 — DOMPurify для Custom HTML/CSS (Defense-in-Depth)

> [[Home]] > Tasks | Owner: **AI 1 (Claude) + AI 2 (Codex)** — координована задача
> Planner: AI 3 (Verdent) | Date: 2026-04-15
> Status: **PLAN READY — читати розподіл перед початком**
> Related: [[Tasks/3-AI-Remaining-Work-Split]], [[Tasks/QA-Scan-2026-04-15]]

---

## Контекст (чому це потрібно)

### Поточна ситуація

В `backend/index.js` є функція `sanitizeHtml()` (line 135):
```js
function sanitizeHtml(str) {
  return String(str).replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}
```

Ця функція **правильна і достатня** для більшості випадків — вона ескейпує HTML-символи. **Проблема не в ній.**

Проблема у трьох місцях на фронтенді де `dangerouslySetInnerHTML` рендерить **довільний HTML/CSS від власника workspace** без бекенд-санітизації:

```tsx
// app/book/[id]/page.tsx:937
<style dangerouslySetInnerHTML={{ __html: siteConfig.ai_css }} />

// app/book/[id]/page.tsx:1082
<style dangerouslySetInnerHTML={{ __html: siteConfig.custom_css }} />

// app/book/[id]/page.tsx:1087
dangerouslySetInnerHTML={{ __html: processedCustomHTML }}
```

`ai_css` і `custom_css` — це CSS-рядки, які зберігаються в Firestore і повертаються через `/public/config/`. `custom_html` — це довільний HTML від власника.

### Реальний ризик

- **CSS injection**: `custom_css` може містити `expression()`, `url(javascript:...)`, `@import` для зовнішніх ресурсів — рідкісно, але реально
- **HTML injection**: `custom_html` може містити `<script>`, `onerror=`, `onload=` атрибути — якщо власник workspace є зловмисником або його акаунт зламано

**Хто під загрозою:** Клієнти, які відкривають публічну booking сторінку (`/book/[id]`). Це публічна сторінка без авторизації.

---

## Розподіл роботи

| Частина | Owner | Файл |
|---|---|---|
| Бекенд — санітизація при записі в Firestore | **AI 1** | `backend/index.js` |
| Фронтенд — санітизація при рендерингу | **AI 2** | `app/book/[id]/page.tsx` |

**Послідовність:** AI 1 робить бекенд першим → AI 2 робить фронтенд після merge AI 1.

---

## Частина 1 — AI 1 (Backend)

### Що додати

Встановити пакет `dompurify` + `jsdom` (для server-side DOMPurify):

```bash
npm install dompurify jsdom
```

Додати helper в `backend/index.js` після `sanitizeHtml()`:

```js
const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');
const { window: domWindow } = new JSDOM('');
const DOMPurify = createDOMPurify(domWindow);

function sanitizeCustomCss(css) {
  if (!css || typeof css !== 'string') return '';
  // Дозволяємо лише CSS — видаляємо expression(), url(javascript:), @import
  return css
    .replace(/expression\s*\(/gi, '')
    .replace(/url\s*\(\s*['"]?\s*javascript:/gi, 'url(')
    .replace(/@import\b/gi, '/* @import blocked */')
    .slice(0, 50000); // ліміт 50KB
}

function sanitizeCustomHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p','br','b','i','strong','em','u','h1','h2','h3','h4',
                   'ul','ol','li','a','img','div','span','section','hr','table',
                   'thead','tbody','tr','th','td','blockquote','pre','code'],
    ALLOWED_ATTR: ['href','src','alt','title','class','id','style','target'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script','object','embed','form','input','iframe'],
    FORBID_ATTR: ['onerror','onload','onclick','onmouseover','onfocus'],
  });
}
```

### Де застосувати

При **записі** `custom_html` та `custom_css`/`ai_css` в Firestore — в `POST /api/settings` handler:

```js
// при збереженні site_config
if (updates.site_config?.custom_html !== undefined) {
  updates.site_config.custom_html = sanitizeCustomHtml(updates.site_config.custom_html);
}
if (updates.site_config?.custom_css !== undefined) {
  updates.site_config.custom_css = sanitizeCustomCss(updates.site_config.custom_css);
}
if (updates.site_config?.ai_css !== undefined) {
  updates.site_config.ai_css = sanitizeCustomCss(updates.site_config.ai_css);
}
```

### Commit (AI 1)

```
feat(backend): BE.9 server-side DOMPurify sanitization for custom HTML/CSS
```

---

## Частина 2 — AI 2 (Frontend)

Після того як AI 1 смерджив свій commit:

### Що додати

Встановити `dompurify` на фронтенді:
```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

В `app/book/[id]/page.tsx` додати:
```tsx
import DOMPurify from 'dompurify';
```

### Замінити три місця

**Місце 1 (line ~937) — ai_css:**
```tsx
// БУЛО:
<style dangerouslySetInnerHTML={{ __html: siteConfig.ai_css }} />

// СТАЛО:
<style dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(siteConfig.ai_css || '', { FORCE_BODY: false, WHOLE_DOCUMENT: false }) }} />
```

**Місце 2 (line ~1082) — custom_css:**
```tsx
// БУЛО:
<style dangerouslySetInnerHTML={{ __html: siteConfig.custom_css }} />

// СТАЛО:
<style dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(siteConfig.custom_css || '', { FORCE_BODY: false }) }} />
```

**Місце 3 (line ~1087) — processedCustomHTML:**
```tsx
// БУЛО:
dangerouslySetInnerHTML={{ __html: processedCustomHTML }}

// СТАЛО:
dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(processedCustomHTML || '') }}
```

> ⚠️ DOMPurify на фронтенді працює тільки в браузері (не на сервері). Переконатися що ці місця не рендеряться під час SSR (вони вже `'use client'`).

### Commit (AI 2)

```
feat(frontend): BE.9 client-side DOMPurify for dangerouslySetInnerHTML in booking page
```

---

## Що НЕ робити

- ❌ Не видаляти існуючу `sanitizeHtml()` — вона потрібна для ескейпінгу в email templates
- ❌ Не застосовувати DOMPurify до звичайних текстових полів (`shop_name`, `email` тощо) — там regex-sanitize достатній
- ❌ AI 2 не починає поки AI 1 не змерджив бекенд частину

---

## DoD

- [ ] `sanitizeCustomHtml()` та `sanitizeCustomCss()` додані в `backend/index.js`
- [ ] `POST /api/settings` санітизує `custom_html`, `custom_css`, `ai_css` при записі
- [ ] `app/book/[id]/page.tsx` — всі 3 `dangerouslySetInnerHTML` обгорнуті в `DOMPurify.sanitize()`
- [ ] Build проходить без TypeScript помилок
- [ ] Публічна booking сторінка Element Barbershop рендериться без регресій
- [ ] Два commit-и: AI 1 (backend) → AI 2 (frontend)
- [ ] DevLog записи від обох AI
