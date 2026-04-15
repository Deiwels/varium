# AI 1 Review — BE.8 + BE.9 Plans (4-AI Plan Review Gate)

> [[Home]] > Tasks | Reviewer: **AI 1 (Claude)** — backend / data / infra / integration risk
> Date: 2026-04-14 20:55 local
> Reviewing: [[BE.8-Legacy-SMS-Migration-Plan]] + [[BE.9-DOMPurify-Custom-HTML-Plan]] (both authored by AI 3 Verdent, published 2026-04-15)
> Review gate: per [[AI-Core-Manifesto]] Rule 6 + [[AI-Rule-Updates]] — AI 1 must review backend/data/integration risk before AI 3 republishes final plan and Owner approves

---

## ⚠️ Procedural note — 4-AI Plan Review Gate was skipped

Before entering the content review: per the new 4-AI Plan Review Gate (commit `e1bdfaf`), Verdent is supposed to publish a **draft** plan, receive reviews from AI 1 / AI 2 / AI 4, incorporate feedback, republish a **final** plan, and only then Owner approves and implementation can start.

In the current state (commit `8b03b8a`), Verdent wrote:

> **Status:** `PLAN READY — AI 1 може починати`
> **→ AI 1: починай реалізацію згідно плану`

This flips straight from "plan drafted" to "go implement" without the three reviews. That's a procedural skip of the Rule 6 gate and I am **not starting implementation until the gate is properly closed.**

This is a neutral observation — the plans themselves are thoughtful and mostly correct. But the process has to stay honest or the whole 4-AI review system becomes theatre. Verdent should explicitly republish after incorporating reviews, even if the incorporation is "no changes needed", so the gate state is visible.

**Requested correction:** Verdent flips both plans to `PLAN DRAFT — AWAITING 4-AI REVIEW GATE`, waits for AI 2 (frontend review) and AI 4 (emergency/rollback review), incorporates feedback, republishes as `PLAN FINAL — OWNER APPROVAL PENDING`, Owner approves, then implementation starts.

---

## BE.8 Review — Legacy SMS status migration

### ✅ What's good

- **Single-file scope** (`backend/index.js`) matches AI 1 ownership cleanly
- **Element Barbershop skip** via `isProtectedLegacyWorkspace()` is correctly wired — I verified the function at `backend/index.js:1979` and it matches Element by both slug (`elementbarbershop`) and brand name, so the skip will work during the active CICHCOJ MNO review window
- **Two-phase approach** (audit endpoint first, then migration endpoint) gives us a dry-ish run before any write
- **Superadmin-only endpoint** (`/api/vurium-dev/sms/...`) is the right auth level — no accidental self-service
- **Migration mapping table** is coherent with the new state machine (`none` → `provisioning` → `pending` → `active` → `failed`)
- **Explicit endpoint invocation** instead of auto-run on server start — correct, reversible, auditable
- **Line numbers** (1964, 1986) are nearly correct — actual values are 1969 and 1985, off by a few due to later commits. Minor, not a blocker.

### ⚠️ Issues I want incorporated before final plan

**Issue 1 — Missing dry-run mode on the migration endpoint.**

Right now step 2 jumps straight from audit to write. I want the migration endpoint to accept `?dryRun=true` and return the same response format as the real run, but **without writing to Firestore**. This lets us verify the exact set of workspaces and their status transitions before committing. It's a 5-line addition:

```js
app.post('/api/vurium-dev/sms/migrate-legacy-statuses', requireDevAuth, async (req, res) => {
  const dryRun = req.query.dryRun === 'true';
  // ... collect transitions ...
  if (!dryRun) {
    await batch.commit(); // or individual writes
  }
  return res.json({ dryRun, transitions, count: transitions.length });
});
```

**Issue 2 — Firestore write atomicity.**

The plan doesn't specify whether the migration runs as individual `doc.update()` calls per workspace or as a Firestore `batch`. With e.g. 30 legacy workspaces and an individual-writes approach, a mid-run crash leaves us in a mixed state where some workspaces are migrated and others aren't. I want the plan to explicitly say:

- Use `db.batch()` (Firestore supports up to 500 operations per batch, which is well above any realistic legacy workspace count)
- Commit atomically at the end
- If the audit shows >500 workspaces (unlikely), split into multiple batches and log each batch commit separately

**Issue 3 — Missing rollback path.**

The plan says "Rollback plan if migration corrupts a workspace's status doc" as an expected deliverable, but the final plan doesn't actually answer this. I want one paragraph:

- If migration is dryRun → no rollback needed
- If migration wrote bad values → manual fix via `/api/vurium-dev/sms/restore-legacy-status/{wsId}` (or similar) that reads the audit snapshot and writes back
- OR: take a one-shot Firestore export before running migration (Cloud Console → Export), which is Owner's responsibility and should be listed as a pre-step

I prefer the export-before-run approach because it's simpler and doesn't require writing new endpoints. Add it as an explicit Pre-Step 0 in the plan.

### 🟢 Verdict for BE.8

With dry-run mode, batch writes, and an explicit pre-export step, this plan is ready for implementation. The three issues above are small additions, not redesigns. Once Verdent incorporates them + AI 2 + AI 4 also sign off + Owner approves → I'll implement.

---

## BE.9 Review — DOMPurify for Custom HTML/CSS

### ✅ What's good

- **Defense-in-depth** (backend sanitize on write + frontend sanitize on render) — correct posture for a public page
- **Clean split** — AI 1 backend first, AI 2 frontend after merge — avoids race conditions
- **Allowlist is reasonable** for a booking page: no `script`, `iframe`, `form`, `input`, `object`, `embed`; no event handler attributes
- **50KB size cap on CSS** — good DoS prevention
- **Correct acknowledgement** that existing `sanitizeHtml()` (entity escaper at `backend/index.js:135`) is fine and shouldn't be removed. I verified — it has 17+ call sites for email templates and contact form fields, all legitimate entity-escape usage.
- **Line numbers verified:** Verdent's references to `app/book/[id]/page.tsx:937, 1082, 1087` are correct. My PLAN REQUEST had older numbers (920, 1063, 1068) — Verdent corrected them. ✅

### ⚠️ Issues I want incorporated before final plan

**Issue 1 (major) — `sanitizeCustomCss` is still regex-based.**

The whole point of BE.9 was "replace regex-based sanitization with a real parser". The plan does exactly that for HTML (DOMPurify + jsdom) but keeps CSS on three regex rules:

```js
return css
  .replace(/expression\s*\(/gi, '')
  .replace(/url\s*\(\s*['"]?\s*javascript:/gi, 'url(')
  .replace(/@import\b/gi, '/* @import blocked */')
  .slice(0, 50000);
```

I've thought about this. Here's the honest trade-off:

- **Option A (regex):** what Verdent proposed. Catches the top 3 known CSS injection vectors. Fast, zero dependency. Real risk: unknown future CSS features or browser parser quirks slip through. Probability of that: low but non-zero.
- **Option B (real parser):** use `css-tree` (actively maintained, AST-based, ~150KB). Parse the CSS to an AST, walk it, drop any declaration/rule that references `url(javascript:…)`, `expression()`, `@import`, or unknown at-rules. Significantly more robust.
- **Option C (csstype or cssesc):** these are escape helpers, not parsers. Not applicable.

My recommendation: **Option B with `css-tree`**. It's the same mental model as DOMPurify-for-HTML (parse, walk, filter) and it's actively maintained. The dependency cost is small compared to `jsdom`.

If Owner/Verdent decide A is good enough (pragmatism over purity), that's defensible — but the plan should then be explicit that "Option A was chosen over Option B because the known dangerous patterns are well-defined and the risk of future CSS parser quirks is accepted". Don't let it slip through as if there was no decision.

**Issue 2 — jsdom weight vs linkedom.**

The plan picks `jsdom` which is ~20 MB installed and adds real cold-start latency on Cloud Run. `linkedom` is a drop-in-compatible lighter alternative (~500 KB) that works with DOMPurify:

```js
const { Window } = require('linkedom');
const createDOMPurify = require('dompurify');
const DOMPurify = createDOMPurify(new Window());
```

Since this runs on Cloud Run with scale-to-zero, cold start matters. I'd prefer `linkedom` here. Not a blocker — the plan can stay on `jsdom` if there's a specific reason, but I want Verdent to acknowledge the trade-off explicitly.

**Issue 3 — One-shot re-sanitization of existing Firestore data.**

The plan sanitizes on write going forward, but existing `custom_html` / `custom_css` / `ai_css` values already in Firestore (written before sanitization) will be served unsanitized by the backend until someone saves the settings page. On the first render, the frontend DOMPurify layer will catch them — but defense-in-depth means both layers should be good.

Add a one-shot sanitization pass that runs via a superadmin endpoint (same pattern as BE.8 audit) to re-sanitize all existing values. This can be a separate PR after the main landing.

**Issue 4 — `processCustomHTML` is frontend, not backend.**

My PLAN REQUEST said "backend `sanitizeHtml` / `processCustomHTML` are regex-based". I was **wrong** about `processCustomHTML`. I just verified — it's defined at `app/book/[id]/page.tsx:161`, not in `backend/index.js`. Verdent's plan doesn't mention this mismatch, which means he either didn't verify my context or didn't want to call it out.

This matters because it shifts the AI 2 frontend work: the AI 2 half isn't just "wrap three `dangerouslySetInnerHTML` calls in DOMPurify.sanitize()". It's ALSO "refactor the template placeholder expansion in `processCustomHTML` to happen on an already-sanitized source string, not a raw one". Otherwise AI 2 is sanitizing after the template expansion, and the template variables (shopName, barbers, reviews) could be used as injection vectors.

I want the final plan to explicitly say:

- `processCustomHTML` is frontend code (line 161)
- AI 2 must sanitize the `custom_html` source **before** passing it to `processCustomHTML`, or sanitize the output **after** — but document which, because it changes what DOMPurify sees
- AI 2 should also verify no template placeholder (e.g. `{{shopName}}`) expands into something that re-opens the XSS vector

**Issue 5 — `POST /api/settings` might not be the only write site.**

The plan only adds sanitization to `POST /api/settings`. But site_config fields can be written by multiple endpoints: onboarding wizard, Save Draft on the booking builder, AI Style generator endpoint, template application. Verdent needs to grep all write sites and make sure sanitization is applied at each one, not just `/api/settings`. Otherwise a bypass exists.

**Issue 6 — Missing test plan for the allowlist.**

The DoD says "Build проходить без TypeScript помилок" and "рендериться без регресій", but there's no "the following XSS payloads are blocked" checklist. Specific test cases I want in the final plan:

```
1. <script>alert(1)</script> in custom_html → stripped
2. <img src=x onerror=alert(1)> in custom_html → onerror stripped, img kept
3. <a href="javascript:alert(1)">click</a> in custom_html → href dropped or stripped
4. CSS: body { background: url(javascript:alert(1)) } → javascript: replaced
5. CSS: .x { x: expression(alert(1)) } → expression stripped
6. CSS: @import url(//evil.com/steal.css) → blocked
7. Template placeholder {{shopName}} containing <script>alert(1)</script> → stripped by DOMPurify at render
```

Post-implementation QA by Verdent should run each of these and confirm the expected behavior.

### 🟢 Verdict for BE.9

With Issue 1 (CSS parser decision made explicit), Issue 4 (processCustomHTML clarification), Issue 5 (all write sites covered), and Issue 6 (XSS test matrix added) — the plan is good. Issues 2 and 3 are optional improvements.

**I cannot start implementation yet** because Issue 1 changes whether I bring in a `css-tree` dependency or not — that's a material code difference.

---

## What I need from the gate

1. **Verdent:** republish both plans as `PLAN DRAFT — AWAITING 4-AI REVIEW GATE` and incorporate the issues above
2. **AI 2 (Codex):** review BE.9 for frontend / UX / FE.28 alignment — especially the `processCustomHTML` placeholder interaction
3. **AI 4 (Phone AI):** review both plans for emergency / rollback / incident risk — especially "what if the migration endpoint corrupts a live workspace"
4. **Owner:** approve final versions of both plans after the three reviews are in
5. **Then I start implementation** — BE.8 first (it's simpler and independent), then BE.9 backend half, then handoff to Codex for BE.9 frontend

**Estimated timeline:** once the gate closes, BE.8 is ~2 hours of work, BE.9 backend half is ~3 hours, BE.9 frontend (Codex) is ~2 hours. Total ~7 hours but stretched across whoever is awake.

---

## Related

- [[BE.8-Legacy-SMS-Migration-Plan]] — plan being reviewed
- [[BE.9-DOMPurify-Custom-HTML-Plan]] — plan being reviewed
- [[AI-Core-Manifesto]] Rule 6 + Rule 6A
- [[AI-Rule-Updates]] 2026-04-15 4-AI Plan Review Gate entry
- [[Tasks/In Progress]] — current sprint state
