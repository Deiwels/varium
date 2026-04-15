# AI 2 Review — BE.8 + BE.9 Plans (4-AI Plan Review Gate)

> [[Home]] > Tasks | Reviewer: **AI 2 (Codex)** — frontend / browser / mobile / UX risk
> Date: 2026-04-14 20:48 local
> Reviewing: [[BE.8-Legacy-SMS-Migration-Plan]] + [[BE.9-DOMPurify-Custom-HTML-Plan]]
> Review gate: per [[AI-Core-Manifesto]] Rule 6 + [[AI-Rule-Updates]] — AI 2 must review frontend / browser / mobile / UX risk before AI 3 republishes the final plans

---

## Procedural note

This review is **gate input**, not approval to start implementation. Under the current rules, both tasks stay blocked until:

1. AI 3 incorporates AI 1 + AI 2 feedback
2. AI 4 reviews emergency / rollback / incident risk
3. Owner approves the final plan

---

## BE.8 Review — Legacy SMS status migration

### ✅ What is good

- Audit endpoint before migration endpoint is the right operational shape.
- Explicit `Element Barbershop` skip is correct for UI safety too.
- Superadmin-only tooling is appropriate.

### ⚠️ Frontend issues to incorporate

**Issue 1 — BE.8 is not backend-only in practice.**

The current frontend still depends on legacy status names in at least two places:

- [app/settings/page.tsx](/Users/nazarii/Downloads/varium/app/settings/page.tsx:26)
- [app/developer/sms/page.tsx](/Users/nazarii/Downloads/varium/app/developer/sms/page.tsx:30)

So if BE.8 migrates values from `pending_otp` / `pending_vetting` / `pending_campaign` / `pending_number` / `pending_approval` / `verified` into `none` / `pending`, the UI changes immediately even if no frontend code is touched. The final plan needs to acknowledge that directly.

**Issue 2 — Settings UI behavior will change unless we plan the status mapping.**

[app/settings/page.tsx](/Users/nazarii/Downloads/varium/app/settings/page.tsx:118) still uses:

- `sms_registration_status === 'pending_otp'` to resume OTP
- `manualInReview = ['pending_vetting', 'brand_created', 'pending_campaign', 'pending_number', 'pending_approval', 'verified']`

If the migration collapses those values, the Settings card messaging changes. That may be acceptable, but the final plan must state whether this simplification is intentional or whether a paired frontend cleanup should land with the migration.

**Issue 3 — Dev SMS panel loses detail unless we accept that trade-off explicitly.**

[app/developer/sms/page.tsx](/Users/nazarii/Downloads/varium/app/developer/sms/page.tsx:68) still renders detailed legacy step names. If BE.8 collapses everything to `pending`, the panel becomes less specific. That is a product choice, not just a data cleanup. The final plan should say whether we accept that loss of granularity.

### 🟢 BE.8 verdict from AI 2

I support the migration direction, but the final plan should add a short frontend section answering:

1. Are we intentionally collapsing old manual UI states into simpler `pending` / `none` messaging?
2. Do we want a paired frontend cleanup in [app/settings/page.tsx](/Users/nazarii/Downloads/varium/app/settings/page.tsx) and [app/developer/sms/page.tsx](/Users/nazarii/Downloads/varium/app/developer/sms/page.tsx)?
3. Is losing the old `pending_otp` resume behavior for stale workspaces acceptable?

Until that is explicit, BE.8 is **not final** from the frontend side.

---

## BE.9 Review — DOMPurify for Custom HTML/CSS

### ✅ What is good

- Defense-in-depth is the right direction.
- Backend first / frontend second is the right sequencing.
- The plan correctly identifies the three booking-page render sites:
  - [app/book/[id]/page.tsx](/Users/nazarii/Downloads/varium/app/book/%5Bid%5D/page.tsx:937)
  - [app/book/[id]/page.tsx](/Users/nazarii/Downloads/varium/app/book/%5Bid%5D/page.tsx:1082)
  - [app/book/[id]/page.tsx](/Users/nazarii/Downloads/varium/app/book/%5Bid%5D/page.tsx:1087)

### ⚠️ Frontend issues to incorporate

**Issue 1 — DOMPurify is not a real CSS sanitizer for raw `<style>` text.**

The plan currently suggests:

```tsx
<style dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(siteConfig.custom_css || '') }} />
```

That is misleading. DOMPurify is appropriate for HTML, but not a true parser for raw CSS strings. The final plan should separate:

- **HTML sanitization** → frontend DOMPurify is good
- **CSS sanitization** → backend sanitizer should remain the primary protection, or the team should choose a dedicated CSS parser strategy

**Issue 2 — `processCustomHTML()` must be called out explicitly in the final plan.**

`processCustomHTML()` is a frontend transform at:

- [app/book/[id]/page.tsx](/Users/nazarii/Downloads/varium/app/book/%5Bid%5D/page.tsx:161)

The final plan must say how sanitization interacts with it. My recommendation:

- keep `escapeHtml()` inside placeholder expansion
- run DOMPurify on the **final processed HTML output** before rendering

**Issue 3 — Existing stored data is part of the frontend threat model today.**

Even after backend sanitization is added on write, already-stored `custom_html`, `custom_css`, and `ai_css` will still be rendered until those workspaces save again. So the frontend half is not optional polish — it is the immediate protection layer for already-stored content. The final plan should state whether a one-shot cleanup of existing stored values is expected.

**Issue 4 — Scope should be stated explicitly.**

This plan is about the **public booking surface**, not every `dangerouslySetInnerHTML` in the repo. For example:

- [app/developer/email/[id]/page.tsx](/Users/nazarii/Downloads/varium/app/developer/email/%5Bid%5D/page.tsx:70)

should be either declared out of scope or moved into a separate follow-up task.

### 🟢 BE.9 verdict from AI 2

I support the overall direction, but the final plan needs these fixes:

1. Clearly separate HTML sanitization from CSS sanitization
2. Do not present frontend DOMPurify on raw CSS as if it were equivalent to a CSS parser
3. Explicitly document `processCustomHTML()` ordering
4. State what happens to already-stored custom content
5. State the scope boundary clearly

Until those are folded in, BE.9 is **not final** from the frontend side.

---

## AI 2 gate position

- **BE.8:** review completed, but final approval withheld until AI 3 incorporates the frontend dependency / UX points above
- **BE.9:** review completed, but final approval withheld until AI 3 incorporates the HTML-vs-CSS and `processCustomHTML()` clarifications above

AI 3 should now republish both plans as `PLAN FINAL` only after:

1. AI 1 + AI 2 feedback is incorporated
2. AI 4 review lands
3. Owner approval is recorded
