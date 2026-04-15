# AI 1 Post-Merge Review — FE.28 (commit `0000a0f`)

> [[Home]] > Tasks | Reviewer: AI 1 (Claude) · Date: 2026-04-15
> Scope: backend-adjacent concerns in Codex's frontend FE.28 landing
> Related: [[Tasks/BE.9-DOMPurify-Custom-HTML-Plan-v2]], [[Tasks/BE.8-BE.9-AI1-Review]]

---

## TL;DR

FE.28 is **good enough to ship** — all three `dangerouslySetInnerHTML` sites are wrapped, `processCustomHTML` sanitizes **after** placeholder expansion (per plan), and the HTML profile is sensible. **One concern below is a latent bug for a small subset of CSS, not a security regression.** Not a revert request. Posted for Codex's awareness and optional follow-up.

---

## ✅ What is correct in FE.28

| Plan requirement | Code | Status |
|---|---|---|
| Wrap AI CSS `<style>` render site | `app/book/[id]/page.tsx:947` — `sanitizeInlineCss(siteConfig.ai_css)` | ✅ |
| Wrap custom CSS `<style>` render site | `:1092` — `sanitizeInlineCss(siteConfig.custom_css)` | ✅ |
| Wrap custom HTML render site | `:1097` — `sanitizeCustomMarkup(processedCustomHTML)` | ✅ |
| `processCustomHTML` order: expand → sanitize | `:202` — `return sanitizeCustomMarkup(result)` at the end of the function, AFTER all placeholder expansion | ✅ — exactly per plan |
| HTML sanitizer uses sensible allowlist | `sanitizeCustomMarkup` uses `USE_PROFILES: { html: true }` (DOMPurify's vetted default HTML profile) | ✅ |
| `dompurify` added to root `package.json` | Yes, `^3.3.0` | ✅ |
| No changes to auth / data / backend contracts | Correct — pure frontend sanitization layer | ✅ |

**Defense-in-depth now live end-to-end:**

- Layer 1 (backend): `sanitizeCustomHtml()` + `sanitizeCustomCss()` in `backend/index.js` via `dompurify + linkedom` + regex, applied at `/api/settings` and `/api/ai/generate-style` write time (commit `56cf4c6`)
- Layer 2 (frontend): DOMPurify at render time in `app/book/[id]/page.tsx` (commit `0000a0f`, this review target)

---

## ⚠️ One concern — `sanitizeInlineCss` may corrupt CSS that contains `<` or `>`

### The code

```tsx
function sanitizeInlineCss(css: string): string {
  // Backend is the primary CSS sanitizer. Frontend strips any accidental HTML.
  return DOMPurify.sanitize(css, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
}
```

### The concern

DOMPurify is an **HTML** sanitizer. When you pass a CSS string to `DOMPurify.sanitize(...)`, it first parses the input as HTML via `DOMParser.parseFromString` or equivalent. For **most** CSS strings this is harmless because CSS rarely contains `<` or `>`. But CSS legitimately can contain angle brackets in at least two places:

1. **Child combinator selectors** — `body > header { color: red }` or `.nav > a:hover { ... }`. AI-generated CSS from `/api/ai/generate-style` often uses these.
2. **Content strings in pseudo-elements** — `::before { content: "<" }` or similar.

When DOMPurify HTML-parses a string like `body > header { color: red }`, the HTML parser either:
- encodes the `>` as `&gt;` in the text output (most common behavior), OR
- drops characters after the orphan `>` as malformed markup, OR
- leaves it alone (if the parser is lenient)

If the output is `body &gt; header { color: red }` and that string is injected via `dangerouslySetInnerHTML` into a `<style>` tag, the browser's CSS parser sees `&gt;` **literally** (because inside `<style>` the browser does not HTML-decode entities — CSS rules are parsed as CSS, not as HTML text). So the combinator breaks and the rule silently fails to match.

### Who is affected

- **AI-generated CSS** via `/api/ai/generate-style` — real risk. AI Style output from Claude Sonnet often uses `body > header`, `.booking-page > main`, etc. to scope rules.
- **Owner-written custom CSS** — risk depends on owner style. Moderate.
- **Element Barbershop** — unknown. Element has `ai_css` or `custom_css` from its own onboarding. If either uses `>` selectors, this would cause visual regression on `https://vurium.com/book/elementbarbershop`. Element is live-pending MNO review, so any visual regression here is higher-stakes than usual.

### Why this is not a security issue

- **Layer 1 (backend)** already strips the actual dangerous CSS patterns: `expression(`, `url(javascript:`, `@import` except Google Fonts. Those are what matters security-wise.
- **`<style>` tag is not an executable HTML context** — CSS cannot execute JavaScript in modern browsers except via `expression()` (IE legacy, already blocked). So even if a malicious CSS string gets through, the attack surface is style-based UI phishing at worst.
- Layer 2 frontend sanitization of CSS is **nice-to-have defense in depth**, not the primary security boundary.

### Verification suggestions (for Verdent or Codex terminal)

Open DevTools console on a test booking page with AI-generated CSS and paste:

```js
// Simulate what sanitizeInlineCss does to a child combinator rule
DOMPurify.sanitize('body > header { color: red }', { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
// Check: does it return the string unchanged, HTML-encoded, or truncated?
```

If the output is the input verbatim → no bug, this review is over-cautious, close the concern.
If the output contains `&gt;` or drops characters after `>` → the bug is real and the two options below apply.

### Recommended fixes (two options, pick one or leave as-is if the verification shows no bug)

**Option A — mirror the backend regex (my recommendation):**

```tsx
function sanitizeInlineCss(css: string): string {
  if (!css || typeof css !== 'string') return ''
  return css
    .replace(/expression\s*\(/gi, '')
    .replace(/url\s*\(\s*['"]?\s*javascript:/gi, 'url(')
    .replace(/@import\b(?!\s*url\s*\(\s*['"]?https?:\/\/fonts\.googleapis\.com)/gi, '/* @import blocked */')
}
```

Pros: exact parity with backend `sanitizeCustomCss()`, zero CSS corruption, defense-in-depth preserved.
Cons: regex duplication between backend and frontend (acceptable — both layers want the same rules).

**Option B — drop frontend CSS Layer 2 entirely:**

```tsx
// Frontend CSS Layer 2 removed 2026-04-15 after FE.28 review.
// Layer 1 (backend/index.js sanitizeCustomCss) is authoritative; <style>
// tag is not a JavaScript execution context so frontend sanitization of
// CSS is nice-to-have, not a security boundary.

// And at the render sites:
<style dangerouslySetInnerHTML={{ __html: siteConfig.ai_css }} />
<style dangerouslySetInnerHTML={{ __html: siteConfig.custom_css }} />
```

Pros: simpler, no regex duplication, zero risk of CSS corruption.
Cons: no defense-in-depth on CSS — if backend sanitizer has a bug, there's no second layer.

**Note on Option B:** the HTML sanitizer (`sanitizeCustomMarkup`) is still needed for the custom HTML render site, which **is** an executable HTML context. Removing CSS Layer 2 does not affect HTML Layer 2.

---

## Other notes

- **Double sanitization at line 1097:** `processCustomHTML()` already ends with `return sanitizeCustomMarkup(result)`, so the consumer at `:1097` wrapping it in `sanitizeCustomMarkup(processedCustomHTML)` applies DOMPurify twice. DOMPurify is idempotent on clean markup, so this is harmless but slightly wasteful (extra DOM parse per render). Not a bug. Optional cleanup: pass `processedCustomHTML` directly at `:1097` and rely on the sanitization inside `processCustomHTML`.
- **DOMPurify version mismatch:** backend has `^3.2.0`, frontend has `^3.3.0`. Independent installations — not a bug. Will converge on next dep bump.
- **Codex's Vercel-CI-only verification path:** because Codex's shell has no `npm`, the only way to confirm `dompurify` resolves correctly is the Vercel build. If Vercel build goes green, the dep installed fine and the code compiles. If Vercel fails → blocker, need to fix.

---

## Sign-off

AI 1 (Claude) reviewed FE.28 from the backend-contract and defense-in-depth angle. **No blocker.** One soft concern about CSS sanitizer behavior which may or may not be a real bug depending on DOMPurify's output for CSS-with-`>` inputs. Recommended path: verify in DevTools, then apply Option A if the bug is confirmed.

Not a Rule 6 gate item — this is post-merge follow-up, not pre-merge review. FE.28 can stay in main; any CSS sanitizer fix can land as a separate small PR.

Handoff to **Verdent (AI 3)** for the XSS test matrix (7 cases from [[BE.9-DOMPurify-Custom-HTML-Plan-v2]]) + optional verification of the CSS-with-`>` concern above.
