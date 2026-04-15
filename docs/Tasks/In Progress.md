# In Progress

> [[Home]] > Tasks | See also: [[Tasks/3-AI-Remaining-Work-Split|3-AI Remaining Work Split]] (authoritative current sprint plan), [[Tasks/Backlog|Backlog]], [[Tasks/Launch Readiness Plan|Launch Readiness Plan]]

> **2026-04-15**: [[Tasks/3-AI-Remaining-Work-Split]] is now the authoritative split for all open work (not just SMS). This file remains the day-to-day activity tracker.
> ⚠️ **If a task needs planning, add it here as `@AI3 [PLAN REQUEST]` and do not start implementation until the 4-AI Plan Review Gate is fully approved.**
> 📥 **AI 4 review from GitHub counts only after the real review doc is synced locally into `docs/Tasks/` and linked here.**

> 🆕 **2026-04-15 02:00 CDT — AI 4 emergency readiness review landed.** See [[Tasks/AI4-Emergency-Readiness-Review-2026-04-15]]. 5 open asks (`AI4-REQ.1`–`AI4-REQ.5`) are directed to AI 1 and AI 3. Owner-requested sign-off: 🟢 launch readiness green from the emergency-response lens, with 3 gaps flagged before a larger launch push.
> 🆕 **AI 4 branch resolution is now written down.** See [[Tasks/AI4-Branch-Resolution-2026-04-15]]. `claude/read-docs-P7wBt` is archive-only; any new rule idea from AI 4 must re-enter via `@AI3 [PLAN REQUEST]`.

---

## 🟡 AI 1 → AI 2 HANDOFF — Sprint 2a BE.8 + BE.9 ready for Codex action

**Date:** 2026-04-15
**From:** AI 1 (Claude)
**To:** AI 2 (Codex) — read on Session Start Protocol step 3

Owner approved BE.8 v2 + BE.9 v2 plans. AI 1 backend work is pushed to `origin/main`:

| SHA | Scope | Status |
|---|---|---|
| `d40b5fa` | BE.8 commit 1 — audit/migrate/restore endpoints (future tool) | Pushed |
| `56cf4c6` | BE.9 Layer 1 — `dompurify` + `linkedom` helpers + `/api/settings` + `/api/ai/generate-style` routed through them + `/api/vurium-dev/sanitize-existing-custom-content` backfill | Pushed |
| `30232d3` | DevLog entries for BE.8 + BE.9 landing | Pushed |
| `d952785` | BE.8 commit 2 — removed `LEGACY_SMS_STATUSES` Set + guard from main flow (Owner decision: test-only data, no migration needed) | Pushed |

**Owner decision recorded:** all workspaces except Element are test-only, so the BE.8 audit/migrate/restore sequence is NOT being run. The endpoints stay in code as a future manual tool but nobody is running them. No BE.8 frontend cleanup is needed either — test workspaces with stale legacy status strings can stay as-is until they're deleted.

### Ask 1 — BE.9 FE.28 (Codex's core task)

Implement Layer 2 (frontend DOMPurify) per [[Tasks/BE.9-DOMPurify-Custom-HTML-Plan-v2]] Part 2:

1. `cd` to repo root, run `npm install dompurify` and `npm install --save-dev @types/dompurify`
2. `app/book/[id]/page.tsx` — import `DOMPurify from 'dompurify'`
3. Wrap the three `dangerouslySetInnerHTML` call sites (AI 1 verified line numbers against current file; they are accurate):
   - Line **937** — `siteConfig.ai_css` inside `<style>`
   - Line **1082** — `siteConfig.custom_css` inside `<style>`
   - Line **1087** — `processedCustomHTML` inside `<div>`
4. **Important per AI 2 + AI 1 review:** update `processCustomHTML` at line **161**. The sanitize ordering is: `escapeHtml()` on each placeholder value → template expansion (existing code) → `DOMPurify.sanitize()` on the **final expanded output**. Do NOT sanitize before expansion — AI 1 review Issue 4 explicitly clarified this.
5. Verify the backend contract hasn't drifted: backend already sanitizes at write time via `sanitizeCustomHtml()` / `sanitizeCustomCss()` in `backend/index.js` (commit `56cf4c6`), so Layer 2 is defense-in-depth, not primary. Test that existing booking pages still render after the change (Element Barbershop especially — it is live-pending MNO review and must not regress).
6. Commit as `feat(frontend): BE.9 FE.28 — client-side DOMPurify for custom HTML/CSS (Layer 2)`
7. DevLog entry obligatory before/with commit.

**Progress update — 2026-04-15 / AI 2 started**

- Codex has started FE.28.
- Patch now in local worktree:
  - `package.json` → adds `dompurify`
  - `app/book/[id]/page.tsx` → imports `DOMPurify`, adds render-layer sanitize helpers, sanitizes `processCustomHTML()` after placeholder expansion, wraps all 3 `dangerouslySetInnerHTML` call sites
- Local `npm install` / `npm run build` could **not** be executed in this desktop shell because `npm` is not available in PATH, so Vercel / CI build is the required verification path for dependency resolution on this step.

### Ask 2 — Deploy verification (Codex can run from terminal)

Owner asked AI 1 to delegate the smoke-test to Codex since Codex has a built-in terminal with `gh` / `curl` / `gcloud`. Not a blocker for FE.28 — backend and frontend merges are independent.

```bash
# 1. Check GitHub Actions deploy status
gh run list --workflow=deploy-backend.yml --limit 5
# Latest run should correspond to commits d40b5fa..d952785. If still running:
gh run watch

# 2. Smoke test the Cloud Run revision (after deploy goes READY)
curl -s https://vuriumbook-api-431945333485.us-central1.run.app/api/health
# Expected: 200 OK, JSON response. If you see "Cannot find module 'dompurify'" or
# "Cannot find module 'linkedom'" in Cloud Run logs → BE.9 deps not installed, blocker.

# 3. XSS smoke test against /api/settings (optional — needs an auth cookie for a test workspace)
# Verifies sanitizeCustomHtml actually strips <script>:
curl -X POST https://vuriumbook-api-431945333485.us-central1.run.app/api/settings \
  -H "Cookie: <test-workspace-owner-session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{"site_config":{"custom_html":"<script>alert(1)</script><p>Hello</p>"}}'
# Then GET /public/config/<wsId> and verify custom_html renders as "<p>Hello</p>" with no script tag.
```

If deploy fails → ping AI 1 with the Cloud Run error so AI 1 can fix the backend side. If it passes → update DevLog with the deploy confirmation and close BE.9 backend verification loop.

### Ask 3 — Status flip in [[Features/SMS & 10DLC]] after Codex's frontend lands

Once FE.28 is merged, the sprint 2a SMS/security cleanup is closed. Codex (or AI 3 via Verdent's verification pass) updates [[Features/SMS & 10DLC]] with "LEGACY_SMS_STATUSES removed from `isLegacyManualSmsPath` — 2026-04-15" in the revision history and notes that the new status pipeline (`none` / `provisioning` / `pending` / `active` / `failed*`) is the single source of truth going forward.

### Ask 4 — AI 3 parallel-safe work (can start now)

Verdent can work in parallel **right now** without conflicting with Codex FE.28:

✅ 1. Re-verify AI 1 backend landing (`56cf4c6`, `d952785`) and record the post-merge state in [[Tasks/QA-Scan-2026-04-15]]
✅ 2. Update stale QA/docs language where BE.8 still appears as an unlanded backend task; note the owner decision that the migration endpoints remain as future tools and are not being run on current test-only workspaces
✅ 3. Prepare the BE.9 7-case XSS verification pass so it is ready the moment Codex lands FE.28
✅ 4. After Codex merges FE.28, run the browser/QA validation on `/book/[id]` and write the results back to [[Tasks/QA-Scan-2026-04-15]] + DevLog
✅ 5. Explicitly verify AI 1's soft post-merge concern from [[Tasks/FE.28-AI1-PostMerge-Review]]:
   - CSS child combinators like `body > header`
   - pseudo-content strings that contain `<` or `>`
   - no visual regression on `https://vurium.com/book/elementbarbershop`

**Guardrail:** AI 3 stays out of `app/book/[id]/page.tsx` implementation and only handles verification / QA / docs on this track.

**Owner answer recorded:** yes — AI 3 may start these parallel tasks now.

### What AI 1 is doing now

- On standby for Codex-side questions about the backend contract
- Monitoring Element CICHCOJ — Pending MNO Review, 24-72 h window, will react to webhook outcome via `/api/webhooks/telnyx-10dlc`
- No new backend work started until Codex merges FE.28 or something new lands

---

## @AI3 [PLAN APPROVED ✅ — READY FOR IMPLEMENTATION]: BE.8 — Migrate legacy SMS statuses

**Date:** 2026-04-14 | **Plan drafted:** 2026-04-15 | **Plan finalized:** 2026-04-15 (`c5bc72b`)
**From:** AI 1 (Claude) | **Plan by:** AI 3 (Verdent)
**Final plan:** [[Tasks/BE.8-Legacy-SMS-Migration-Plan-v2]]
**Priority:** Sprint 2a
**Blocked:** ⏸ NO — final plan approved by Owner; implementation may begin in approved sequence

### 4-AI Plan Review Gate state

- [x] AI 3 (Verdent) published draft plan → [[Tasks/BE.8-Legacy-SMS-Migration-Plan]] (`8b03b8a`)
- [x] AI 1 (Claude) reviewed backend / data / infra / integration risk → [[Tasks/BE.8-BE.9-AI1-Review]] — **3 issues** (dry-run mode, batch writes, rollback/pre-export step)
- [x] AI 2 (Codex) reviewed frontend / UX / FE alignment → [[Tasks/BE.8-BE.9-AI2-Review]] — **3 issues** (frontend status dependencies, settings/dev-SMS drift, `pending_otp` UX consequence)
- [x] **AI 3 incorporated all feedback and republished as `PLAN FINAL v2`** → [[Tasks/BE.8-Legacy-SMS-Migration-Plan-v2]] (`c5bc72b`) — verified by AI 1: Pre-Step 0 Firestore export added, `?dryRun=true` flag added to migration endpoint, `db.batch()` with 500-op limit added, Rollback endpoint `POST /api/vurium-dev/sms/restore-legacy-status/:wsId` added, Frontend Impact Analysis section added with explicit product decision to collapse legacy statuses and paired frontend cleanup for AI 2. All 6 review issues addressed.
- [x] AI 4 (Phone AI) reviewed emergency / rollback / incident risk → [[Tasks/AI4-Emergency-Readiness-Review-2026-04-15]] · **5 follow-up asks recorded (`AI4-REQ.1`–`AI4-REQ.5`)** · launch readiness: 🟢 green
- [x] **Owner approved final plan** — approved in chat on 2026-04-15

**→ Owner approval is now recorded.** AI 1 may begin implementation per the 5-step sequence in [[Tasks/BE.8-Legacy-SMS-Migration-Plan-v2]], with Element Barbershop remaining protected during its live review window.

**AI 2 prep status (2026-04-15):**

- Frontend touch points re-audited and confirmed before implementation:
  - [app/settings/page.tsx](/Users/nazarii/Downloads/varium/app/settings/page.tsx) — `LEGACY_SMS_STATUSES`, `getSmsUxState()`, `resumeOtpStep`, `manualNeedsOtp`, `manualInReview`, `isManualVerified`
  - [app/developer/sms/page.tsx](/Users/nazarii/Downloads/varium/app/developer/sms/page.tsx) — `LEGACY_MANUAL_STATUSES`, `formatSmsStatus()`, legacy/manual workspace grouping
- AI 2 will not ship the cleanup before AI 1 merges the backend migration, because the approved plan explicitly keeps frontend cleanup paired to the new backend status model.
- As soon as AI 1 lands BE.8, AI 2 patch scope is already narrowed to:
  - remove legacy status sets from frontend
  - collapse UI to the approved `pending` / `none` simplification
  - keep Element protected and visually unaffected

**Problem**

`backend/index.js` still carries a `LEGACY_SMS_STATUSES` Set defined around line 1964 and consumed by `isLegacyManualSmsPath()` at line 1986. The status values in that Set are from the old manual 10DLC path and pre-date the dual-path model recorded in [[Architecture/Decision-Log]] DECISION-001. They cause two observable problems:

1. **UI drift:** the frontend receives stale status strings (e.g. `pending_approval`, `approved` without the new `sms_registration_status` subdocument shape) and has to render them via hardcoded translations
2. **Migration blocker:** as long as the Set exists, every new status must be added in two places (the Set + the `sms_registration_status` handler), which is error-prone and has already caused at least one mismatch in Element's own status flow

**Context**

- Canonical status definitions: `backend/index.js:1964` (the Set) and the `sms_registration_status` doc shape written by `POST /api/webhooks/telnyx-10dlc` at line 1873+
- Affected workspaces: all workspaces created before the dual-path model landed, plus Element Barbershop (grandfathered 10DLC, CICHCOJ) which is currently in `Pending MNO Review` after Telnyx approval — this migration **must not touch Element during its review window**
- Firestore collection: `workspaces/{wsId}/sms_registration_status` sub-doc (single doc pattern)
- Current consumers of `isLegacyManualSmsPath()`: grep `backend/index.js` for the function name before touching
- Frontend: AI 2 owns the UI rendering layer; any status-name change here requires a paired frontend adjustment

**Why this needs a plan (Rule 6 triggers)**

- Touches client data (`sms_registration_status` sub-docs across all workspaces)
- Schema-adjacent change — moving values between two representations
- Observable behavior change on an existing endpoint (`POST /api/webhooks/telnyx-10dlc` reply path)
- Ambiguous path: forward-migrate legacy values into new shape vs. one-shot delete of the Set with a code-level shim; both are valid
- Element is live-pending → any mistake risks corrupting CICHCOJ review data

**Expected result from AI 3 plan**

1. Clear decision: migrate legacy values forward into new shape, or keep both shapes and just remove dead code references
2. Safe ordering: when migration runs relative to Element's MNO review window (must not run during it)
3. Explicit safety net for Element (skip `wsId` = element until CICHCOJ reaches a terminal state)
4. List of files to change in `backend/index.js` with line ranges
5. Paired frontend work for Codex (AI 2) — which components render which legacy statuses and how they should map
6. Rollback plan if migration corrupts a workspace's status doc
7. QA checklist for Verdent (AI 3) to run post-commit

**Related**

- [[Tasks/3-AI-Remaining-Work-Split]] BE.8 row — canonical task source
- [[Architecture/Decision-Log]] DECISION-001 (SMS dual-path)
- [[Features/SMS & 10DLC]] — downstream doc that needs updating after migration

---

## @AI3 [PLAN APPROVED ✅ — READY FOR IMPLEMENTATION]: BE.9 — DOMPurify для Custom HTML/CSS

**Date:** 2026-04-14 | **Plan drafted:** 2026-04-15 | **Plan finalized:** 2026-04-15 (`c5bc72b`)
**From:** AI 1 (Claude) | **Plan by:** AI 3 (Verdent)
**Final plan:** [[Tasks/BE.9-DOMPurify-Custom-HTML-Plan-v2]]
**Priority:** Sprint 2a
**Blocked:** ⏸ NO — final plan approved by Owner; implementation may begin in approved sequence

### 4-AI Plan Review Gate state

- [x] AI 3 (Verdent) published draft plan → [[Tasks/BE.9-DOMPurify-Custom-HTML-Plan]] (`8b03b8a`)
- [x] AI 1 (Claude) reviewed backend / data / infra / integration risk → [[Tasks/BE.8-BE.9-AI1-Review]] — **6 issues**, 1 material (Issue 1: CSS parser decision)
- [x] AI 2 (Codex) reviewed frontend / UX → [[Tasks/BE.8-BE.9-AI2-Review]] — **4 issues**, 1 material (HTML vs CSS separation)
- [x] **AI 3 incorporated all feedback and republished as `PLAN FINAL v2`** → [[Tasks/BE.9-DOMPurify-Custom-HTML-Plan-v2]] (`c5bc72b`) — verified by AI 1: Defense-in-depth architecture diagram added, CSS: Option A (regex) accepted with explicit justification paragraph, jsdom → linkedom (~500 KB vs ~20 MB for Cloud Run cold start), one-shot re-sanitization endpoint `POST /api/vurium-dev/sanitize-existing-custom-content` added, `processCustomHTML` ordering clarified (sanitize AFTER placeholder expansion per AI 2), all 4 backend write sites listed, 7-case XSS test matrix added to DoD, scope boundary section added (public booking page only; developer/email out of scope). All 10 review issues addressed.
- [x] AI 4 (Phone AI) reviewed emergency / rollback / incident risk → [[Tasks/AI4-Emergency-Readiness-Review-2026-04-15]] · **5 follow-up asks recorded (`AI4-REQ.1`–`AI4-REQ.5`)** · launch readiness: 🟢 green
- [x] **Owner approved final plan** — approved in chat on 2026-04-15

**→ Owner approval is now recorded.** AI 1 may implement the backend half first per [[Tasks/BE.9-DOMPurify-Custom-HTML-Plan-v2]] Part 1, then merge, then AI 2 implements the frontend half per Part 2.

**AI 2 prep status (2026-04-15):**

- Frontend touch points re-audited and confirmed before implementation:
  - [app/book/[id]/page.tsx](/Users/nazarii/Downloads/varium/app/book/%5Bid%5D/page.tsx:161) — `processCustomHTML()`
  - [app/book/[id]/page.tsx](/Users/nazarii/Downloads/varium/app/book/%5Bid%5D/page.tsx:937) — AI CSS `<style dangerouslySetInnerHTML>`
  - [app/book/[id]/page.tsx](/Users/nazarii/Downloads/varium/app/book/%5Bid%5D/page.tsx:1082) — custom CSS `<style dangerouslySetInnerHTML>`
  - [app/book/[id]/page.tsx](/Users/nazarii/Downloads/varium/app/book/%5Bid%5D/page.tsx:1087) — custom HTML `dangerouslySetInnerHTML`
- AI 2 will follow the approved sequence and wait for AI 1’s backend sanitizer + dependency merge before landing the render-layer DOMPurify pass.
- As soon as AI 1 lands BE.9 backend, AI 2 patch scope is already narrowed to:
  - add frontend DOMPurify at the 3 render sites
  - sanitize after placeholder expansion in `processCustomHTML()`
  - leave non-booking admin/email renderers out of scope, per plan

**Problem**

Custom HTML and CSS fields on booking pages (AI-generated Style, owner-written custom CSS, saved templates) are currently sanitized by a hand-rolled regex pass in `backend/index.js` (`sanitizeHtml` / `processCustomHTML`) and then injected into the live page via `dangerouslySetInnerHTML` in `app/book/[id]/page.tsx` at lines 920, 1063, 1068. Regex-based HTML sanitization is a known XSS vector — any attribute or tag pattern the regex doesn't anticipate slips through. This is flagged BUG-016 / BUG-017 in the QA scan.

**Context**

- Backend sanitizer: search for `sanitizeHtml` and `processCustomHTML` in `backend/index.js` — both are regex-based
- Fields affected: `custom_html`, `custom_css`, AI Style output that becomes page CSS
- Frontend consumers: `app/book/[id]/page.tsx:920, 1063, 1068` (three `dangerouslySetInnerHTML` call sites)
- No `DOMPurify` import currently anywhere in the repo (verified via grep) — this would be a new dependency
- Paired work: AI 2 owns [[Tasks/3-AI-Remaining-Work-Split]] FE.28 which is the frontend half of this migration
- Runtime: backend runs on Cloud Run Node.js; DOMPurify requires a DOM implementation server-side (`jsdom` or `linkedom`) — this is a real dependency weight decision

**Why this needs a plan (Rule 6 triggers)**

- 3+ files touched (backend sanitizer + 3 frontend call sites, minimum)
- New external dependency (`dompurify` + a DOM implementation)
- Cross-scope: backend + frontend coordinated change
- Multiple valid implementation paths: pure backend sanitization (one place, thick backend), pure frontend sanitization (trust backend to pass through, sanitize at render), or defense in depth (both)
- Security-adjacent: a mistake here re-opens the XSS vector instead of closing it

**Expected result from AI 3 plan**

1. Library choice: `dompurify` + `jsdom`, `dompurify` + `linkedom` (lighter), or `sanitize-html` (different API but well-maintained)
2. Sanitization layer placement: backend-only, frontend-only, or defense-in-depth (my recommendation would be defense-in-depth but not my decision to make)
3. Allowlist spec: which tags and attributes survive sanitization (needs Owner input on what custom HTML features matter)
4. Migration path for existing custom_html / custom_css values already stored in Firestore — do they need a one-shot re-sanitization?
5. Backend file list with line ranges for AI 1
6. Frontend FE.28 alignment with AI 2 — what Codex needs to know so both halves ship together
7. Rollback plan if the new sanitizer rejects valid existing content
8. QA checklist for Verdent including specific XSS payload tests

**Related**

- [[Tasks/3-AI-Remaining-Work-Split]] BE.9 row (backend) + FE.28 row (frontend) — canonical task sources
- [[Tasks/QA-Scan-2026-04-15]] BUG-016 / BUG-017
- [[Architecture/Decision-Log]] — may need a new DECISION-007 for "defense-in-depth vs single-layer sanitization"

---

## SMS — 3-AI EXECUTION SPLIT

- Before touching SMS again, all AI should re-read:
  - `docs/Tasks/Telnyx-Integration-Plan.md`
  - `docs/Tasks/Platform-Sender-Pivot-Decision.md`
  - `docs/Tasks/SMS Finalization Plan.md`
  - `docs/AI-Work-Split.md`
- `Claude / AI 1` owns backend SMS hardening:
  - `backend/index.js`
  - `.github/workflows/deploy-backend.yml`
  - backend/docs updates for Gaps 2/3/4/5
- `Codex / AI 2` owns frontend SMS UX:
  - `app/settings/page.tsx`
  - `app/signup/page.tsx`
  - status-first / automatic-activation wording and flow cleanup
- `Verdent` owns review / verification / research support:
  - no parallel backend edits unless ownership changes first
  - use as reviewer, doc-sanity check, and external-research support
- `Owner` owns external unblockers:
  - `TELNYX_WEBHOOK_PUBLIC_KEY`
  - Jonathan / Telnyx follow-up
  - Verify Profile account issues

## ✅ iOS app incident — black screen + endless loading loop — RESOLVED 2026-04-14 20:10

**Status:** ✅ **CONFIRMED WORKING** — owner live-tested on device after Vercel deployed `c97e184`. All three hotfixes together (`95d40fc` + `59fdd7b` + `c97e184`) closed the loop. Full post-mortem in [[DevLog/2026-04-15]]. Permanent reference doc created: [[Web-Native-Auth-Contract]]. Architectural decision recorded as DECISION-006 in [[Decision-Log]].

**Protection for future sessions:** Before touching `middleware.ts`, `lib/auth-cookie.ts`, `lib/api.ts`, `components/Shell.tsx`, or `backend/index.js` `getTokenFromReq` — read [[Web-Native-Auth-Contract]]. It lists the load-bearing invariants and the full auth chain for cold start + expired token scenarios. The legacy `vuriumbook_auth` cookie fallback is **load-bearing** until the native iOS bundle is rebuilt with the canonical name.

### Historical record — original symptoms and root cause kept for reference

### Symptoms reported by owner

- Already logged-in iOS users see a black screen
- Fresh sign-in inside the native app can hang forever on loading
- The iOS app is the live website inside `WKWebView`, so this behaves like an auth bootstrap regression, not an isolated native screen bug

### Root cause

AI 2 traced the failure to a contract mismatch between the website and the native `WKWebView` wrapper:

- Web `middleware.ts` only trusted the canonical role cookie `VURIUMBOOK_TOKEN`
- Native `VuriumWebView.swift` still cold-started sessions with legacy cookies:
  - `vuriumbook_auth` = `role:uid`
  - `vuriumbook_token` = bearer token
- `components/Shell.tsx` assumed `localStorage.VURIUMBOOK_TOKEN` exists immediately on first paint; if missing, it set `status = noauth` and redirected to `/signin`

That creates the exact iOS loop we saw:

1. Native opens `/dashboard`
2. Middleware ignores `vuriumbook_auth` and redirects to `/signin`
3. Native/user-script restore races with the web bootstrap
4. `Shell.tsx` still sees no `localStorage` token and marks the session `noauth`
5. Result: black screen / endless loading loop inside `WKWebView`

### AI 2 web-side compatibility fix

- `middleware.ts`
  - accepts legacy `vuriumbook_auth` as a fallback role cookie
  - mirrors it into canonical `VURIUMBOOK_TOKEN` so the session self-heals
- `components/Shell.tsx`
  - restores `localStorage.VURIUMBOOK_TOKEN` from legacy `vuriumbook_token` before declaring `noauth`
- `lib/auth-cookie.ts`
  - writes both `VURIUMBOOK_TOKEN` and `vuriumbook_auth`
  - clears `VURIUMBOOK_TOKEN`, `vuriumbook_auth`, and `vuriumbook_token` on logout so stale iOS sessions do not resurrect themselves

### Follow-up auth-loop fix from Claude review branch

The first compatibility hotfix was not enough on its own. Claude identified the second half of the loop:

- when an expired JWT triggered a `401`, `lib/api.ts` cleared `localStorage` but left the JS role cookie alive
- Edge middleware then saw the surviving role cookie and bounced `/signin` right back to `/dashboard`
- on iOS, `WKWebView` + native UserDefaults kept replaying this flow, so the user saw the dashboard flash for a split second and then the app became unusable

Applied follow-up fix:

- `lib/api.ts` now calls `clearAuthCookie()` on any non-login `401`
- `lib/auth-cookie.ts` now deletes cookies with the `Secure` attribute when on HTTPS so Safari / WKWebView actually apply the delete
- `lib/api.ts` and `components/Shell.tsx` now also call the native `logout` bridge on forced auth teardown so `VuriumWebView.swift` clears `UserDefaults.vurium_auth_token` and stops re-injecting an expired token on every `/signin` load

This is the specific hotfix intended to stop the visible `/signin ⇄ dashboard` flicker loop.

### Native follow-up for Claude / AI 1

Native source investigated during this incident:

- `/Users/nazarii/Desktop/untitled folder/VuriumBook/VuriumBook/VuriumWebView.swift`

Relevant native areas:

- cold-start cookie bootstrap in `makeUIView(...)`
- token restore in `webView(_:didFinish:)`
- logout handler in `userContentController(_:didReceive:)`

Recommended cleanup after the web fix is verified:

- set canonical `VURIUMBOOK_TOKEN` during cold start
- stop depending on `vuriumbook_auth` as the primary route-gating cookie
- keep `vuriumbook_token` only if native still truly needs a bearer-cookie bootstrap path

### Verification after deploy

- [ ] iOS app, already logged-in user: opens directly into app content, no black screen
- [ ] iOS app, fresh sign-in: login completes and lands on `/dashboard` or `/calendar`
- [ ] Sign out in native app: session does **not** silently restore on reopen
- [ ] Safari / normal browser web app remains unchanged

## BE.1 — Distributed lock for background jobs (plan + implementation, 2026-04-15)

> AI 1 (Claude) · Status: **implementation in progress** · Owner greenlit + Codex confirmed parallel to FE.Element-Verify · AI 3 (Verdent) post-commit review requested

### Plan summary (Manifesto Rule 5 micro-plan)

This is a **low-risk additive defensive infra item** from [[Tasks/3-AI-Remaining-Work-Split|3-AI Remaining Work Split]] (now renamed 4-AI). Normally Rule 5 would require an AI 3 plan before architectural work; this entry is the inline plan-before-code record for the case where:
- Owner approved parallel execution
- AI 2 (Codex) explicitly confirmed "не заважає і не конфліктує" with FE.Element-Verify
- The change is 1 file (`backend/index.js`), additive only, no changes to existing job logic, no migration, no data touching

**Problem.** Seven background jobs run via `setInterval(..., 3 * 60 * 1000)` at `backend/index.js:10257` + `runAIDiagnosticScan` via a separate interval at 10270. When Cloud Run scales to multiple instances under load, every instance fires all seven jobs simultaneously on every cycle. Consequences: duplicate SMS reminders, duplicate auto-notify emails, duplicate Telnyx provision attempts, duplicate payroll audits, duplicate booking audits, double AI diagnostic spend.

Currently `min_instances=0` and typical warm instance count is 1, so the risk is low right now — but it is **real** any time Cloud Run decides to spin a second instance (load spike, cold start over warm, scale-to-zero → scale-up).

**Design.**

1. New top-level Firestore collection `job_locks/{jobName}`. Document shape: `{ job_name, locked_by (instance_id), locked_at, locked_until }`.
2. New module-level constant `JOB_INSTANCE_ID` — `crypto.randomBytes(8).toString('hex')` generated once at module load. Each Cloud Run revision/instance gets a unique id.
3. New helper `withJobLock(jobName, ttlSeconds, fn)`:
   - Uses `db.runTransaction` to read `job_locks/{jobName}` and conditionally write
   - If lock exists AND `locked_until > now` AND `locked_by !== JOB_INSTANCE_ID` → skip (return `{skipped: true}`)
   - Otherwise → write lock with our `JOB_INSTANCE_ID` and `locked_until = now + ttlSeconds`
   - Run `fn()` under try/catch
   - `finally`: release lock via a second transaction that only deletes the doc if `locked_by === JOB_INSTANCE_ID` (avoid stepping on a replacement holder that grabbed it after TTL)
   - If release fails, TTL naturally expires the lock
4. Wrap each setInterval call with `withJobLock(..., ...)`:
   - `runAutoReminders` · 600 s TTL
   - `runAutoMemberships` · 600 s TTL
   - `runRetentionCleanup` · 900 s TTL
   - `runPayrollAudit` · 900 s TTL
   - `runBookingAudit` · 900 s TTL
   - `runSmsAutoProvisionRetry` · 600 s TTL
   - `runAIDiagnosticScan` (separate setInterval) · 1800 s TTL
5. `resetSecurityCounters` stays unlocked — it's synchronous and purely in-memory; a double-run is harmless and would cost a Firestore round-trip for no benefit.

**What this does NOT change.**
- Internal throttles inside each job (`_lastReminderRun < 3 * 60 * 1000` etc.) stay in place — distributed lock is an additional outer guard, not a replacement for per-instance throttle
- Job function bodies — zero changes
- `setInterval` cadence — still every 3 min
- Job behavior when only one instance is running — functionally identical (lock always acquires on first try)
- Job behavior on failure — lock releases in `finally` OR expires via TTL within at most 15 min

**Cost estimate.** ~28 Firestore ops per 3-min cycle (7 jobs × (1 tx read + 1 tx write for acquire + 1 tx read + 1 tx delete for release)) = ~13k ops/day per instance. Well within Firestore free tier baseline.

**Rollback.** If anything breaks, revert the commit. Existing jobs go back to unlocked setInterval (current behavior). No data migration, no state to clean up except `job_locks/` docs which expire on their own.

### Owner ack

Recorded as owner greenlit in chat at 2026-04-15. Codex explicitly confirmed parallel execution does not conflict with FE.Element-Verify for Element Barbershop resubmission.

### AI 3 (Verdent) post-commit review request

After commit lands:
- [ ] Verdent: read the `withJobLock` helper in `backend/index.js` and the seven wrapped call sites
- [ ] Verdent: confirm the transaction pattern is correct for the `@google-cloud/firestore` client this repo uses (direct `db.runTransaction(async tx => { ... })`)
- [ ] Verdent: add a line to `docs/Tasks/QA-Scan-2026-04-15.md` under either "Fixed" or "Needs eyes" depending on assessment
- [ ] Verdent: check that Cloud Run logs show `[JOBS] Instance id: ...` on startup after deploy

---

## 🟢 ELEMENT 10DLC RESUBMIT — VERIFIED READY (2026-04-15)

**Status flipped BLOCKED → READY.** Owner fixed both Settings typos, Codex (AI 2) completed FE.Element-Verify.1–5 in live browser, AI 1 (Claude) independently re-verified the backend via `/public/config/` curl against production. All four pre-resubmit gates green.

### Independent backend verification (AI 1, live curl — 2026-04-15)

```
shop_name:    'Element Barbershop'
shop_address: '1142 W Lake Cook Rd, Buffalo Grove, IL 60089'
shop_email:   'contacts@element-barbershop.com'
shop_phone:   '+1 (224) 584-5072'
```

Both typos cleared: `Bufalo` → `Buffalo`, ZIP `60089` added, email domain now resolves to `element-barbershop.com`.

### Codex FE.Element-Verify.1–5 — all green

Confirmed in live Chrome DevTools + iPhone Safari 375 px:

- [x] **FE.Element-Verify.1** — `/book/elementbarbershop` renders `Verified business details` with name, address, phone, email
- [x] **FE.Element-Verify.2** — Booking CTA branded `Book with Element Barbershop`; SMS consent label reads `Element Barbershop Appointment Notifications` and renders on first paint
- [x] **FE.Element-Verify.3** — `Privacy Policy` / `Terms` links carry business context and the legal pages render the Element-branded highlight panels
- [x] **FE.Element-Verify.4** — Pill bar = 5 icons (`71a20e2` hotfix still good)
- [x] **FE.Element-Verify.5** — Custom template path unchanged

### MNO failure-reason mapping

| Original 2026-04-14 MNO rejection reason | Current remediation state |
|---|---|
| "The brand website is lacking sufficient information about the company and its products" | ✅ Fixed — name, full address + ZIP, phone, email, 40 services with prices, 6-person team, SMS consent all visible on `/book/elementbarbershop` |
| "Call-to-action does not contain registered/DBA brand name" | ✅ Fixed — CTA reads `Book with Element Barbershop`; SMS consent reads `Element Barbershop Appointment Notifications`; `messageFlow` submission field is now built from per-workspace URL via `getWorkspaceBookingUrl()` (backend commit `e97efd9`) |

### Owner final step — one Telnyx portal check, then click Resubmit

**Before clicking Resubmit in Telnyx Portal → 10DLC → Campaigns → CICHCOJ, verify the submission form contains:**

- **Brand website / CTA URL** → must be `https://vurium.com/book/elementbarbershop` (per-workspace URL, NOT generic `https://vurium.com/book/`)
- **messageFlow** (if the portal surfaces it for edit) → same per-workspace URL. Our backend already builds this correctly via `getWorkspaceBookingUrl()`, but if the portal pre-populated the form with the previous failed submission's values, the generic `/book/` could have carried over — worth a one-second glance
- **sample1 / sample2** → format `Element Barbershop: Your appointment ...` with the DBA name as the prefix

Then hit **Resubmit**.

### Expected MNO timeline

- T-Mobile: instant → 24 h
- AT&T: 1–3 business days
- Verizon: 1–3 business days

### Post-resubmit protocol

1. Record submit timestamp in `docs/DevLog/2026-04-15.md` under a new "Element CICHCOJ resubmitted" heading
2. Monitor `POST /api/webhooks/telnyx-10dlc` — it updates `sms_registration_status` on `workspaces/EZaC81SVGM0uuoYMxBCT/settings/config`
3. **On approval** (status → `active`): update `docs/Features/SMS & 10DLC.md` Element campaign row from `Failed MNO Review` → `Active`; move this whole block from In Progress into a DevLog "Done" section
4. **On second failure**: capture new MNO reasons verbatim, open `docs/Tasks/QA-Scan-YYYY-MM-DD.md`, treat as a separate analysis task — do NOT hot-patch without understanding the new failure class. Stop and re-plan with AI 3 (Verdent)

### ✅ Pre-Resubmit DoD

- [x] Owner fixed `shop_address` typo and added ZIP `60089`
- [x] Owner fixed `shop_email` domain typo
- [x] Codex ran FE.Element-Verify.1–5 live and reported all 5 green
- [x] AI 1 independently re-verified `/public/config/` in production
- [x] Element remediation pack deployed: `e97efd9` (backend messageFlow URL), `dbc8dfa` + `b74c79b` + `bed4537` + `8f7bec3` (frontend business proof + consent + custom pages), `c2d0a99` (legal-link context), `779f524` (Suspense wrapper for CSR bailout)
- [x] Unrelated same-day hotfixes covered in this sweep: `71a20e2` pill bar, `a3c885f` waitlist regression
- [x] BE.1 distributed lock for background jobs landed (`5dab7a1`) — no impact on Element flow, just hardening against Cloud Run multi-instance dupes
- [ ] **Owner: verify in Telnyx portal that CTA URL = `https://vurium.com/book/elementbarbershop`**
- [ ] **Owner: click Resubmit on CICHCOJ**
- [ ] Record submit timestamp in DevLog (AI 1 or AI 3 will do this after owner confirms)

**Why this matters:** MNO failure reason #1 was "brand website is lacking sufficient information about the company and its products." Reviewers cross-check address via Google and the email domain via web resolution. With `Bufalo Grove` (no Google match) and `element-barbersho.com` (domain does not exist), both checks fail — same failure class we already hit.

Verification command after Save (anyone can run this):

```bash
curl -s https://vuriumbook-api-431945333485.us-central1.run.app/public/config/EZaC81SVGM0uuoYMxBCT \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('addr:', d.get('shop_address')); print('mail:', d.get('shop_email'))"
```

Expected:
```
addr: 1142 W Lake Cook Rd, Buffalo Grove, IL 60089
mail: contacts@element-barbershop.com
```

### FE.Element-Verify — Codex (AI 2) scope

Full 5-step browser verification runbook is in [[Tasks/Element-10DLC-Resubmission-Checklist]] under "Step 2 — FE.Element-Verify". TL;DR:

- [ ] **FE.Element-Verify.1** — `/book/elementbarbershop` renders Business details + Services preview + team grid after hydration on Chrome desktop + iPhone Safari 375px
- [ ] **FE.Element-Verify.2** — Booking details step: SMS consent checkbox visible immediately, consent label mentions `Element Barbershop Appointment Notifications`, Privacy/Terms links contain `?business=Element%20Barbershop&slug=elementbarbershop` query params
- [ ] **FE.Element-Verify.3** — Privacy + Terms pages show `Legal · Element Barbershop` label and business-context highlight panels at top and inside `#sms` section
- [ ] **FE.Element-Verify.4** — Pill bar post-71a20e2 shows exactly 5 icons, no horizontal scroll strip, Dashboard shortcuts grid unchanged
- [ ] **FE.Element-Verify.5** — If Element uses `custom` design template, Business identity and SMS consent are visible on the custom page variant too (the `8f7bec3` fix)

**Why this is Codex scope:** `/book/[id]`, `/privacy`, `/terms` are `'use client'` Next.js routes. Curl only returns the Next.js shell + metadata — the React components do not render until JS hydrates in a real browser. AI 1 confirmed via curl that the pages return 200 and og metadata is business-branded, but could not confirm that the hydrated sections actually appear on screen. That is Codex's live-browser verification role.

### Backend content state (verified live by AI 1 on 2026-04-15)

- ✅ `shop_name = 'Element Barbershop'` (exact DBA match)
- ❌ `shop_address = '1142 W Lake Cook Rd, Bufalo Grove, IL'` — typo + no ZIP
- ✅ `shop_phone = '+1 (224) 584-5072'`
- ❌ `shop_email = 'contacts@element-barbersho.com'` — typo missing `p`
- ✅ `business_type = 'Barbershop'`
- ✅ `sms_brand_name = 'Element Barbershop'` (matches DBA)
- ✅ `online_booking_enabled = true`
- ✅ 40 real services via `/public/services/` with names + real prices ($24.99–$100) + durations
- ✅ 6 barbers via `/public/barbers/` (Arsen, Dan, Lili, Naz, Vio)
- ✅ og:title on `/book/elementbarbershop` = "Book with Element Barbershop"
- ✅ Backend submission code uses per-workspace URL in messageFlow (`getWorkspaceBookingUrl`, landed in `e97efd9`)
- ✅ Frontend legal-link context code landed in `c2d0a99`

### Unblock order

1. Owner fixes 2 typos (Step 1 in checklist)
2. Owner re-runs `curl` verification above → confirms corrected values
3. Codex runs FE.Element-Verify.1–5 (Step 2 in checklist) → reports results back here
4. Owner does independent incognito check on real iPhone + desktop (Step 3 in checklist)
5. Resubmit CICHCOJ in Telnyx portal (Step 4 in checklist)

See [[Tasks/Element-10DLC-Resubmission-Checklist]] + DevLog 2026-04-15 `Element Barbershop pre-resubmission live verification` for full evidence.

---

## HOTFIX 2026-04-15 — Element legal links now preserve business context

- [x] Owner raised a valid reviewer-flow concern: from `Element` booking page, `Privacy Policy` / `Terms` were opening generic Vurium legal pages with no obvious first-screen explanation of how `Element Barbershop` fit into the flow
- [x] AI 2 updated `app/book/[id]/page.tsx` so legal links and stored SMS consent text now carry `business` + `slug` context
- [x] AI 2 updated `app/privacy/page.tsx` and `app/terms/page.tsx` so the linked pages render a business-aware context panel, including the relationship:
  - customer books with the business
  - the appointment-notification program is branded to that business
  - VuriumBook is the scheduling / messaging platform
- [ ] Owner live-check after Vercel deploy:
  - [ ] Open `/book/elementbarbershop`
  - [ ] Click `Privacy Policy`
  - [ ] Confirm the page explicitly says the booking / SMS context is for `Element Barbershop` via VuriumBook
  - [ ] Click `Terms`
  - [ ] Confirm the same business-context panel appears near the `#sms` section

## BUILD HOTFIX — AI 2

- [x] Fixed Next.js prerender blocker for `/terms` and `/privacy`
  - Vercel failed with `useSearchParams() should be wrapped in a suspense boundary`
  - cause: legal pages were switched to `'use client'` only to read query params for Element reviewer context
  - AI 2 moved both pages back to server-side `searchParams` props
  - branded legal context remains intact; pages should prerender cleanly again
- [x] Fixed Vercel TypeScript build regression in `components/Shell.tsx`
  - build failure was caused by `setTab(t.id)` receiving a widened `string` instead of the local `'profile' | 'password'` union
  - AI 2 replaced the inline inferred tab list with a typed `profileTabs` array
  - no product behavior changed; this only restores a clean production build
- [x] Fixed Vercel TypeScript build regression in `app/book/[id]/page.tsx`
  - build failure was caused by `showCustomBusinessProof` referencing `activeTemplate` before `activeTemplate` was declared
  - AI 2 moved the custom-page proof flag below template resolution
  - no UI logic changed; this only restores the Element custom-page proof patch to a build-safe state

## HOTFIX 2026-04-15 — Waitlist regression (commit `a3c885f`)

- [x] Owner reported: `Join waitlist` CTA disappeared from public booking page
- [x] Root cause: my own SET-006 fix in `849e998` forced `waitlist_enabled: false` in `/public/config/` for every workspace that never touched the Settings toggle. Frontend `??` fallback could not kick in because `false` is not nullish.
- [x] Investigation uncovered two latent pre-existing backend bugs on the same code path (`POST /public/waitlist/:wsId` + `tryWaitlistAutoFill()`) both silently disabling the feature for untouched-toggle workspaces
- [x] Fix landed across all three sites in `a3c885f` with one consistent semantic: **waitlist is ON by default on any plan that includes the feature; Settings toggle is an explicit OFF override, not an opt-in**
- [ ] **Owner verification after `a3c885f` Cloud Run deploy lands:**
  - [ ] Public `/book/{salon-slug}` shows `Join waitlist` on a fully-booked day in incognito
  - [ ] Waitlist submit succeeds (no 403)
  - [ ] Admin `/waitlist` lists the new entry
  - [ ] Booking cancel triggers waitlist auto-notify
  - [ ] Salon+ workspace with explicit `waitlist_enabled: false` still hides form
  - [ ] Individual plan still hidden (plan gate)
  - [ ] Element Barbershop public page still renders Business details + Services preview (unaffected)
- [ ] Codex frontend re-verify: `app/book/[id]/page.tsx:442` and `app/book/[id]/page.tsx:430` still consume `/public/resolve` + `/public/config` correctly — fall-through via `??` is load-bearing
- [ ] Verdent: add retrospective bullet to `QA-Scan-2026-04-15.md` under a new "Regressions from Sprint 1 fixes" section so next scan catches similar default-flip patterns
- See `docs/DevLog/2026-04-15.md` → "Hotfix: Waitlist disappeared..." for full diagnosis, behavior matrix, and lessons-learned note

## HOTFIX 2026-04-15 — Mobile pill bar showed 8 icons instead of 5 (PERM-001 overshoot)

- [x] Owner screenshot from live waitlist page: bottom pill rendered 8 icons (dashboard, calendar, history, messages, waitlist, portfolio, clients, payments). Canonical design per CHANGELOG 2026-04-13 is a fixed 5-item pill: Home · History · Calendar · Messages · Settings
- [x] Root cause: Codex commit `074ddd2 fix(frontend): align role permissions` fixed PERM-001 by swapping the hardcoded 5-item pill render for `{visibleNav.map(...)}`. That made `visibleNav` render correctly but overshot — `visibleNav` is the full filtered list, so owners/admins got 8+ icons crammed into the mobile pill
- [x] Correct navigation architecture is **two-tier**: pill bar = fixed 5 canonical destinations; Dashboard shortcuts grid = everything else (and Codex already fixed its PERM-002 `isBarber` hardcoded filter so it respects `hasPerm()`)
- [x] Fix in `components/Shell.tsx`: restored hardcoded 5-item allowlist via `(['dashboard', 'history', 'calendar', 'messages', 'settings'] as const).map(id => visibleNav.find(item => item.id === id))`. Still filters each slot through `visibleNav`, so roles that cannot see a particular item simply drop that slot
- [x] PERM-001 remains fixed via the Dashboard shortcuts grid (the architecturally correct place for "reach every allowed page")
- [x] Ownership note: `components/Shell.tsx` is Codex (AI 2) scope, but Claude patched directly on explicit owner instruction — this is an emergency hotfix exception, recorded in DevLog so the pattern stays visible
- [x] Local preview verification not possible (this machine has no `npm` / Node locally). Deferred to post-Vercel-deploy visual confirmation
- [ ] **Owner verification after Vercel deploy lands:**
  - [ ] Open `/dashboard`, `/waitlist`, `/calendar`, `/messages` on iPhone → pill bar shows exactly Home · History · Calendar · Messages · Settings (5 icons)
  - [ ] Owner role sees all 5; barber/student may see fewer if role-gated
  - [ ] No horizontal scroll in pill on 375px width
  - [ ] Dashboard shortcuts grid still reaches Payments / Clients / Waitlist / Portfolio / Membership / Analytics (PERM-002 unaffected)
- [ ] Codex follow-up: if there is a long-term plan for a left sidebar drawer to render the full `visibleNav`, that belongs in Codex's own commit; `sidebarOpen` state already half-exists in Shell.tsx. Tracked in 3-AI split as a separate item if/when revisited
- See `docs/DevLog/2026-04-15.md` → "Hotfix: Mobile bottom pill bar..." for full post-mortem

## SMS — ELEMENT MANUAL REVIEW UPDATE

- [x] Element Barbershop received an MNO response for campaign `CICHCOJ`
  - Status: `Failed MNO Review`
  - Reasons:
    - website lacks sufficient company / product information
    - CTA does not contain registered / DBA brand name
- [ ] Before Element resubmission, fix submission fidelity:
  - use the exact Element booking / public URL, not generic `/book/`
  - confirm CTA copy matches the submitted DBA / brand name exactly
- [ ] Before Element resubmission, strengthen public business proof on the Element-facing page:
  - clear business identity
  - services / what the business offers
  - address / contact information
  - enough visible business information for reviewer verification
- [x] Website-side proof remediation started
  - `app/book/[id]/page.tsx` now shows a public `Business details` section and `Services` preview on the landing page
  - `/public/config/:workspace_id` now exposes allowlisted `shop_address`, `shop_phone`, and `shop_email` for the public booking page
- [x] Element reviewer-facing consent visibility patched on the frontend
  - `app/book/[id]/page.tsx` now renders SMS consent copy immediately on both booking and waitlist forms instead of waiting for phone input first
  - the checkbox stays disabled until a valid phone number is entered, but the consent language, Terms, and Privacy links are visible to the reviewer from first render
- [x] Custom-template public proof block added for reviewer visibility
  - `app/book/[id]/page.tsx` now renders a standardized branded compliance / business-proof section even when the page uses custom HTML
  - this block surfaces:
    - exact business name
    - address / phone / email when saved
    - services preview
    - SMS compliance footer text
    - public Privacy / Terms links
    - a branded CTA (`Book with {Business}`)
- [x] Booking page section toggles now actually control the public landing page
  - `site_config.sections_enabled` is now respected by `app/book/[id]/page.tsx` for:
    - hero
    - about
    - services
    - team
    - reviews
  - custom proof block now also respects the `Services` toggle instead of re-showing services after the owner hides that section
- [x] Custom-page compliance footer no longer duplicates the proof block
  - when the custom proof block is visible, the global footer now keeps only the lightweight `Powered by VuriumBook` line
  - the SMS compliance text + Privacy / Terms links stay in one place instead of appearing twice at the bottom
- [ ] Owner data dependency still remains for Element public proof
  - `Business details` only render when `shop_address`, `shop_phone`, and/or `shop_email` are actually saved in Element Settings
  - if those fields are empty in Firestore, no frontend patch can surface them for Telnyx review
- [x] Backend submission fidelity patched for future resubmission
  - `backend/index.js` 10DLC submission now builds `messageFlow` from the exact workspace booking URL instead of generic `/book/`
  - submission CTA wording now explicitly says `${shopName} Appointment Notifications via SMS`
- [x] New US A2P CTA / brand verification research distilled into docs
  - added [[Tasks/US-A2P-CTA-Brand-Verification-Notes]]
  - Element checklist now explicitly tracks:
    - no-login public proof
    - exact DBA / address matching discipline
    - policy pages as first-class artifacts
    - multiple opt-in methods in `messageFlow` when applicable
- [x] Temporary reminder fallback guidance distilled into docs
  - added [[Tasks/Temporary-Reminder-Delivery-Options]]
  - current team direction clarified:
    - immediate fallback = transactional email
    - short-term SMS alternative = per-business verified toll-free
    - not pursuing shared short codes / platform-wide shared sender / omnichannel expansion as a launch unblocker

## SUPPORT EMAIL STYLE — DONE

- Re-read `docs/Features/Email System.md`, `docs/Features/Developer Panel.md`, and the current `backend/index.js` / `app/developer/email/page.tsx` paths before changing any support-email behavior
- Replaced the old reminder-like support card with a mailbox-aware professional correspondence template used for:
  - direct admin support sends via `/api/vurium-dev/email/send`
  - Gmail send / reply from `support@`, `billing@`, `sales@`, and `security@`
  - inbound admin notify emails forwarded to `ADMIN_NOTIFY_EMAIL`
- Direct admin send now records the mailbox context and uses the matching display name (`Vurium Support`, `Vurium Billing`, etc.) instead of a generic `Vurium` sender label
- Developer Panel email UI copy now matches the new model too:
  - `Branded` wording removed
  - support/team correspondence language used instead

## DEVELOPER PANEL — SMS OPERATIONS SYNC — DONE

- Re-read `docs/Features/Developer Panel.md`, `docs/Features/Developer Panel — Improvement Plan.md`, and current `app/developer/*` code after AI Verdent's developer-panel work
- Confirmed the main gap was the SMS page still reflecting an older platform-level model
- Fixed:
  - `GET /api/vurium-dev/platform` now returns `sms_number_type`
  - added `GET /api/vurium-dev/sms/status`
  - added `POST /api/vurium-dev/sms/provision`
  - `app/developer/_lib/dev-fetch.ts` now throws on non-2xx responses, so developer toasts and actions respect real backend failures
  - rewrote `app/developer/sms/page.tsx` to match the real launch SMS architecture:
    - toll-free-first for new workspaces
    - email-only fallback when sender is missing
    - grandfathered manual / 10DLC visibility
    - explicit `Element Barbershop` protection
- Synced developer docs so Gmail is no longer marked as merely planned and developer SMS is no longer documented as frontend-only

## PERMISSIONS FIX — PERM-003 Backend (AI 1) — DONE

### Commits
- `a80d9da` — requireCustomPerm middleware + /api/payments fix
- `f0de2e0` — Square/Stripe status endpoints use custom permissions

### What was done
1. Created `requireCustomPerm(permKey)` middleware (line ~1294):
   - Owner/admin always pass
   - Barber/student: reads `role_permissions` from Firestore `settings/config`
   - Checks `role_permissions[role][permKey]` — returns 403 if not set
2. Fixed endpoints:
   - `GET /api/payments` → `requireCustomPerm('pages.payments')`
   - `GET /api/square/oauth/status` → `requireCustomPerm('financial.access_terminal')`
   - `GET /api/stripe-connect/status` → `requireCustomPerm('financial.access_terminal')`
3. Result: barbers with enabled permissions can now see payments, use terminal checkout

### Guest role fix — commit `97be886`
- **Problem**: `guest` role was missing from frontend `DEFAULT_PERMS` in `PermissionsProvider.tsx`
- AI 2's permission checks (`hasPerm('financial', 'pay_cash')` etc.) always returned `false` for guest
- Guest accounts saw only Cash button, no Terminal/Zelle/Other
- **Fix 1**: Added `guest` to `DEFAULT_PERMS` with sensible defaults (calendar, clients, bookings, checkout, terminal, all payment methods)
- **Fix 2**: Fixed `requireCustomPerm()` dot notation bug — `'financial.access_terminal'` was looked up as flat key instead of nested `perms.guest.financial.access_terminal`
- **Result**: Guest accounts now see Terminal, Cash, Zelle, Other based on custom permissions

### AI 2 permission batch — landed, then narrowed by shell hotfix
- `074ddd2` landed the core AI 2 permission batch:
  - `app/dashboard/page.tsx` shortcut filtering now uses permission-driven `pageId` checks plus `settings_access` visibility instead of hardcoded barber/student label filters
  - `app/payments/page.tsx` now imports `usePermissions()`, shows an access-restricted state when `pages.payments` is disabled, and no longer relies on raw `isOwner`
  - payments action visibility is closer to backend intent:
    - reconcile = owner/admin
    - sync tips = owner
    - refund = owner/admin
  - `components/Shell.tsx` profile password flow now matches backend validation with `min 8 characters`
  - `components/Shell.tsx` profile modal exposes the `Password` tab when the role has `settings_access.change_password`
- `71a20e2` then intentionally narrowed one part of the Shell change:
  - mobile bottom pill nav no longer renders the full `visibleNav`
  - it is back to the canonical 5-slot pill (`dashboard`, `history`, `calendar`, `messages`, `settings`)
  - reachability for the broader permission surface remains through the Dashboard shortcuts grid, not through a horizontally scrolling pill bar

---

## VERCEL BUILD BROKEN — FIXED local AI 2 patch 2026-04-13

**Commit**: `f2158a2` — Vercel build fails with TypeScript error

```
app/book/[id]/layout.tsx
Type error: Type '{ params: { id: string; }; }' does not satisfy the constraint 'LayoutProps'.
  Types of property 'params' are incompatible.
    Type '{ id: string; }' is missing the following properties from type 'Promise<any>'
```

**Fix applied**: `app/book/[id]/layout.tsx` now uses Next.js 15 async route params for both `generateMetadata()` and the default layout export.

**Owner**: AI 2 — file `app/book/[id]/layout.tsx`
**Status**: FIXED LOCAL — pending push/build confirmation

### Build error #2: `showConfirm` not found in Shell.tsx — FIXED local AI 2 patch 2026-04-13

**Commit**: `b18e73c`
```
./components/Shell.tsx:359:32
Type error: Cannot find name 'showConfirm'.
```

**What**: `showConfirm()` is called at line 359 but never declared/imported in Shell.tsx. Likely part of the P0.12 styled dialog refactor — the function definition may have been accidentally removed or not included in this commit.

**Fix applied**: `ProfileModal` in `components/Shell.tsx` now reads `showConfirm` from `useDialog()` directly, and the unused outer `Shell` reference was removed.

**Owner**: AI 2
**Status**: FIXED LOCAL — pending push/build confirmation

---

## P0 — Launch Readiness (AI 1: Backend)

- [x] P0.1 Webhook signature verification (Stripe + Square) — **DONE** commit `b1bdbe9` 2026-04-14
  - Stripe: HMAC-SHA256 verification of `stripe-signature` header
  - Square: HMAC-SHA256 verification of `x-square-hmacsha256-signature` header
  - Both reject invalid signatures with 400
- [x] P0.2 Fix `spAmountCents` → `spServiceCents` — **DONE** commit `b1bdbe9` 2026-04-14
  - 6 occurrences replaced in webhook + reconciliation handlers
- [x] P0.3 Cloud Run stability + health check — **DONE** commit `b1bdbe9` 2026-04-14
  - Added `GET /health` endpoint (status, uptime, timestamp)
  - Memory 1Gi, CPU 1, timeout 300s
  - Rollback: `gcloud run services update-traffic vuriumbook-api --to-revisions=PREVIOUS=100`
- [x] P0.4 Billing verification matrix — **DONE** commit `9d23103` 2026-04-14
  - Apple: added expiry date check in getEffectivePlan() — blocks access after apple_expires_at
  - Stripe Connect: added webhook signature verification (was unprotected)
  - Verified: Stripe subscription create/cancel/upgrade webhooks, Apple IAP verify/webhook, Square reconciliation
  - Found & fixed: Apple expired subscriptions could still access features if webhook delayed
- [x] P0.5 Auth and security audit — **DONE** commit `595b324` 2026-04-14
  - Added requireRole('owner','admin') to GET /api/payments, /api/square/oauth/status, /api/stripe-connect/status
  - Audit confirmed: JWT middleware on all /api routes, Apple/Google OAuth verified server-side, password reset single-use, rate limiting on login
  - Remaining: password hashing uses SHA256 (not bcrypt) — acceptable for launch, upgrade later
- [x] P0.6 Data integrity — full chain verification — **DONE** 2026-04-14
  - Covered by /api/payroll/audit (7 checks): unpaid bookings, booking↔payment match, cash reconciliation, admin hours, totals, amounts, Square verification
  - Tips: both `tip` and `tip_amount` saved consistently (fixed 2026-04-13)
  - Cash: service_amount (net) used correctly, not amount (gross)
  - Expenses: deducted from owner net, category breakdown working
- [x] P0.7 Server-side price verification — **DONE** commit `b1bdbe9` 2026-04-14
  - Compares payment amount vs booking service_amount
  - Rejects if >2x or <0.5x expected (tolerance for tax/fees)
- [x] P0.8 Booking idempotency — **DONE** commit `595b324` 2026-04-14
  - POST /public/bookings accepts `idempotency_key` in body
  - Duplicate key returns existing booking (no double-create)
  - Key stored on booking document

## P0 — Launch Readiness (AI 2: Frontend)

- [ ] P0.9 Settings mobile drill-down navigation — **IN PROGRESS**
  - Local implementation complete in `app/settings/page.tsx`
  - Pending: browser/iPhone verification before marking done
- [ ] P0.10 Settings save/load verification — **UNBLOCKED** by AI 1
  - Frontend/backend path re-checked for `online_booking_enabled`, `waitlist_enabled`, `booking.cancellation_hours`, `display.show_prices`, `display.require_phone`, `display.allow_notes`
  - **Backend blocker FIXED**: commit `911c1f4` — `POST /api/settings` now merges `booking` and `display` nested objects (AI 1)
  - Pending: AI 2 manual toggle → reload verification pass across categories
- [ ] P0.11 Full customer path audit
  - Session-expiry / stale-login black-screen fix added in `components/Shell.tsx`; protected pages now redirect to `/signin` instead of hanging on a blank screen
  - Edited auth-loss redirects now use `replace('/signin')` to avoid back-navigation into stale protected screens
  - `components/Shell.tsx` now uses a one-way auth redirect guard too, so repeated `401`/stale-session checks do not keep bouncing users through duplicate sign-in redirects
  - Periodic session expiry checks now reopen the PIN unlock flow when available instead of always dumping the user straight into a hard redirect
- [x] P0.12 Remove alert()/confirm() — **DONE**
  - `app/billing/page.tsx` moved to styled dialog flow for cancel/manage actions
  - `app/settings/page.tsx` key owner flows moved off native `confirm()`; team password reset and owner delete-account also moved off browser `prompt()`
  - `app/signin/page.tsx` forgot-password browser prompt replaced with branded modal
  - `components/Shell.tsx` sign-out confirmation now uses the shared styled dialog flow
  - Broad scan across AI 2-owned files is now clean for native `alert()`, `confirm()`, and `prompt()` usage
- [ ] P0.13 Role-based visibility verification
  - `app/settings/page.tsx` now also normalizes the URL when the current `tab` is not visible for the active role, so role-restricted users do not stay on a stale inaccessible settings slug
  - Settings content rendering now uses a role-safe fallback tab too, so a hidden category no longer keeps rendering just because stale local state or URL params still point at it
- [ ] P0.14 Mobile usability on key pages
  - `/billing` now stacks plan cards and management actions more cleanly on small screens instead of relying on desktop-like horizontal spacing
  - `Settings -> Roles & Permissions` now switches from a desktop permission matrix to stacked mobile cards, so owners can actually review and toggle role access on phone screens
  - `Settings -> Roles & Permissions` mobile cards now expand/collapse per page (`Dashboard`, `Calendar`, `History`, `Clients`, etc.) instead of rendering one extra-long always-open list
  - `Settings -> Team Accounts` now hooks into the existing mobile CSS too, so the create-member form, member header row, and action buttons stop behaving like fixed desktop rows on phones
  - The session PIN overlay in `components/Shell.tsx` now has a clear `Use password instead` escape hatch and supporting copy, so phone users no longer look visually trapped in a full-screen lock state
  - `Settings -> Taxes & Fees` and `Custom charges` now collapse into stacked/two-column mobile cards, keeping label, payment-method, and remove controls reachable on narrow screens instead of squeezing desktop grids
  - `Settings -> Payroll defaults` tip-option inputs now stack cleanly on phones too, and the Square Terminal preview chips wrap instead of overflowing
  - SMS/Telnyx registration fields in `Settings` now stack on mobile as well, so business identity/contact/address blocks stop behaving like rigid desktop forms
- [ ] P0.15 Timezone indicator on booking page — **IN PROGRESS**
  - Local implementation added to `app/book/[id]/page.tsx`
  - Pending: browser verification on live booking flow
- [ ] P0.16 Fix form data loss on booking page — **IN PROGRESS**
  - Session draft persistence added for `name`, `email`, `phone`, `notes`, `smsConsent`
  - Frontend now sends `idempotency_key` with booking creation to match backend duplicate-submit protection
  - Restored draft data is now surfaced back to the client with an inline notice on the details step, so saved info does not silently reappear without explanation
  - Pending: manual unavailable-slot/back-navigation verification
- [ ] P0.17 Calendar mobile layout — **IN PROGRESS**
  - Calendar grid now allows horizontal pan on mobile when the full barber schedule is wider than the viewport, instead of clipping extra columns behind `overflowX: hidden`
  - Calendar settings/team/service editors are being collapsed into single-column mobile layouts, and the weekly schedule grid now breaks to 2 columns on phone screens
  - Pending: browser verification on an actual narrow viewport before marking done

## P1 — Queued

- [x] P1.1 Fix N+1 queries (AI 1) — **DONE** commit `183209e` 2026-04-14
  - Square webhook uses merchant_id for fast workspace lookup; fallback to scan only if not found
- [x] P1.2 Fix silent .catch() (AI 1) — **DONE** commit `183209e` 2026-04-14
  - Payment booking updates and payment_request creates now log errors instead of silently swallowing
- [x] P1.3 Firestore indexes (AI 1) — **DONE** commit `183209e` 2026-04-14
  - Added backend/firestore.indexes.json: bookings(status+start_at), (phone_norm+start_at), (barber_id+start_at)
- [x] P1.4 Webhook logging (AI 1) — **DONE** commit `460363a` 2026-04-14
  - logWebhookEvent() helper stores to Firestore webhook_logs collection
  - All 4 handlers log: Stripe, Square, Apple, Stripe Connect
- [ ] P1.5 Button disabled states (AI 2) — **IN PROGRESS**
  - Public booking page now locks waitlist fields, booking form inputs, payment toggle buttons, and back navigation while submit/payment setup is running
  - Added inline status copy during booking/payment setup so the client sees that availability is still being checked
- [ ] P1.6 Dashboard timezone (AI 2) — **IN PROGRESS**
  - Dashboard key date/time formatting now rerenders after workspace timezone loads from `/api/settings/timezone`
  - Additional dashboard widgets now use workspace timezone consistently for day labels, clock-in timestamps, phone-access log times, and the analog clock / free-slots calculations
  - Weekly/monthly dashboard ranges are now being derived from workspace day boundaries too, so revenue/client/expense widgets stop drifting around midnight for owners outside the browser's local timezone
  - Pending: manual UI verification across widgets/cards after refresh
- [ ] P1.7 Dashboard clarity (AI 2) — **IN PROGRESS**
  - Dashboard now shows an owner launch checklist instead of dropping new owners straight into widgets with no guidance
  - Desktop gets a fuller checklist card with direct links into setup categories; mobile gets a compact "Finish setup" banner that opens the next missing step
  - Fixed a mobile/dashboard flicker where `Finish setup` could appear for a moment on stale default state and then disappear; the banner now waits for user hydration, settings/slug hydration, and the first dashboard load before rendering
- [ ] P1.8 Booking UX polish (AI 2) — **IN PROGRESS**
  - Public booking now has clearer helper text across staff, services, date/time, and details steps so the flow feels less abrupt for first-time clients
  - Empty states are more actionable too: no-services explains the booking menu is not live yet, and no-times now points people to another date or the waitlist instead of stopping cold
  - Waitlist submit-state copy is being cleaned up too, so the action reads like product UI (`Joining waitlist…`) instead of a raw loading placeholder
  - Waitlist success messaging is getting more reassuring too: once joined, the confirmation now points back to the actual contact method the client provided
- [ ] P1.9 Billing messaging (AI 2) — **IN PROGRESS**
  - Billing screen now explains whether the workspace is managed through Apple App Store subscriptions or VuriumBook web billing
  - Manage/cancel actions now have loading states and Apple-managed subscriptions use clearer “Manage in Apple” messaging instead of Stripe-style wording
  - Settings → Subscription now mirrors the same Apple-vs-web language and action states, so billing UX stays consistent across both surfaces
  - Trial/no-plan states are being cleaned up too, so users no longer see fallback labels like “No plan” or a misleading default “Individual” label when they have not subscribed yet
  - Checkout and restore-purchase states now use clearer action copy too (`Preparing checkout…`, `Restoring purchases…`) instead of generic processing text
  - Portal/cancel loading states are more explicit now too (`Opening billing…`, `Opening Apple subscriptions…`, `Cancelling subscription…`), and `Billing` / `Settings -> Subscription` use matching action labels
- [ ] P1.10 Empty states (AI 2) — **IN PROGRESS**
  - Replaced several generic `Loading...` states in owned customer-facing screens with clearer product copy (`Loading billing details…`, `Loading booking page…`, `Checking available times…`, `Loading team members…`, `Loading role permissions…`)
  - Dashboard and billing empty-state wording is getting more customer-friendly too (`No team members are clocked in right now`, `Traffic data will appear here once visits start coming in`, `No paid subscription is connected yet`)
  - Booking empty states now explain what to do next instead of just saying "No services available" or "No times are currently open for this day"
  - Action-state copy is being softened too: booking/payment CTAs and clock-in widgets now show clearer in-progress text instead of raw `...` or terse debug-style wording
  - Inline payment submit text on the booking page now reads `Processing payment…` instead of a generic `Processing...`
  - More raw three-dot action states were cleaned too (`Sending…`, `Adding…`, `Generating…`) so customer/admin surfaces stay consistent
  - `Payments` now uses more product-style loading/empty/detail placeholder copy too (`Loading payments…`, `No payments match this range or filter yet.`, `Select a payment to view the full details.`)

## P2 — After Core Launch

- [x] P2.1 API pagination (AI 1) — **DONE** commit `fafcdc5` 2026-04-14
  - /api/clients: limit param (max 500, default 200)
  - /api/payments: limit param (max 1000, default 200)
  - /api/messages: limit param (max 500, default 100)
- [x] P2.2 Rate limiting (AI 1) — **DONE** commit `fafcdc5` 2026-04-14
  - In-memory rate limiter for public endpoints (no Firestore cost)
  - Public booking: 10 req/min per IP, returns 429 on excess
- [x] P2.3 Email retry queue (AI 1) — **DONE** commit `91d9c98` 2026-04-14
  - sendEmail retries up to 2 times with 2s/4s backoff
  - Logs failures with recipient and subject for debugging
- [x] P2.4 Production monitoring (AI 1) — **DONE** commit `91d9c98` 2026-04-14
  - GET /health returns: ok, version, uptime, memory_mb, timestamp
  - Removed duplicate health endpoint
- [ ] P2.5 Marketing pages polish (AI 2) — **IN PROGRESS**
  - `/vuriumbook` pricing copy is being tightened so trial/billing messaging matches the real signup flow instead of contradicting itself
  - Sell-side trust copy is also being cleaned up to avoid unsupported claims on public marketing pages
  - `/`, `/about`, `/faq`, and `/support` are now being softened too so public pages stop promising unverified SLAs, compliance badges, or overly specific security claims
  - `contact` success copy and the getting-started blog post were aligned with the same safer trial/setup wording so marketing messaging stays consistent across the site
  - Additional exact-timeline claims were removed too (`24/7`, `under 2 minutes`, `within 30 days`) where we had not separately validated them as hard promises
- [ ] P2.6 Table sorting (AI 2) — **IN PROGRESS**
  - `Clients` now has owner-facing sort controls for last visit, name, status, team member, visits, and spend
  - `Payments` now has sort controls for date, amount, tip, client, status, and method, with shared asc/desc direction toggling across desktop and mobile list views
- [ ] P2.7 Bulk actions (AI 2) — **IN PROGRESS**
  - `Clients` now supports row selection, select-visible, clear-selection, and bulk delete for delete-authorized roles
  - Bulk delete uses the styled dialog flow and keeps partial-failure handling in-app instead of falling back to browser dialogs
  - Single-client delete in the profile panel now updates local state immediately too, instead of forcing a full page reload after delete
- [ ] P2.8 Open Graph tags (AI 2) — **IN PROGRESS**
  - Added route-level metadata layouts for key sell-side pages so `about`, `contact`, `faq`, `support`, `vuriumbook`, and the getting-started blog post now have page-specific title/description/Open Graph/Twitter previews
  - Public booking links now also have route-level metadata via `app/book/[id]/layout.tsx`, so direct booking shares can show a business-specific title/description/image instead of only the generic site metadata

## SMS & 10DLC Compliance

See also: [[Tasks/SMS Finalization Plan|SMS Finalization Plan]] · [[Tasks/Telnyx-Integration-Plan|Telnyx Integration Plan]] · [[Tasks/Platform-Sender-Pivot-Decision|Platform Sender Pivot Decision]]

### Decision log — 2026-04-15

Three-AI consensus (Claude / Codex / Verdent):

- **Launch path:** залишаємось на dual-path (per-workspace toll-free + grandfathered manual 10DLC + email-only fallback)
- **NOT doing now:** Verdent's proposed `allowGlobalFallback` removal / shared `TELNYX_FROM` sender — platform-as-sender вже був rejected code 710 у квітні, повторний спроб без Telnyx approval = другий 710
- **Doing now:** Telnyx hardening P0 (Verify profile, webhook sig, `phone_number_index`, pagination, auto-provision on plan activation) — див. [[Tasks/Telnyx-Integration-Plan]]
- **Gated behind Jonathan reply:** окремий Platform-Sender-Pivot-Plan — writen only after Telnyx confirms shared-sender is compliant; draft inquiry letter в [[Tasks/Platform-Sender-Pivot-Decision]]

### Telnyx hardening — active work items (AI 1)

- [ ] **Gap 1** — `TELNYX_VERIFY_PROFILE_ID` — **BLOCKED** on Telnyx account `whitelisted_destinations` issue (pending Jonathan call). Fallback path works; not a launch blocker.
- [x] **Gap 2** — `verifyTelnyxWebhookSignature()` Ed25519 helper implemented in `backend/index.js`, called in both Telnyx webhook handlers. **Enforcing gated** on `TELNYX_WEBHOOK_PUBLIC_KEY` — owner to add to GitHub Secrets + one-line append to `.github/workflows/deploy-backend.yml`. Helper is a safe no-op until the secret is set.
- [x] **Gap 3** — `phone_number_index` Firestore collection writes in both `provisionTollFreeSmsForWorkspace()` and `POST /api/sms/verify-otp`; `POST /api/webhooks/telnyx` uses O(1) lookup + `collectionGroup('clients')` for STOP/HELP opt-out propagation instead of scanning every workspace.
- [x] **Gap 4** — `runAutoReminders()` replaced `limit(100)` with `startAfter`-based pagination, 50 per batch, no upper cap per cycle.
- [x] **Gap 5** — `autoProvisionSmsOnActivation()` non-throwing helper with legacy/protected/in-flight/max-retries guards; exponential backoff (5m→15m→45m→2h→6h → `failed_max_retries`); audit log; wired into `/auth/signup`, `handleStripeEvent`, `/api/billing/apple-verify`. New `runSmsAutoProvisionRetry()` background job paginates workspaces and fires due retries, added to the main `setInterval`.
- [ ] Add `TELNYX_WEBHOOK_PUBLIC_KEY` secret + CI/CD wiring (**owner task**)
- [ ] Live verification after deploy: new workspace auto-activation, Element legacy untouched, OTP fallback vs Verify, STOP/HELP via `phone_number_index`, email-only fallback for failed provision

### Jonathan / Telnyx operational track

- [ ] Надіслати draft letter з [[Tasks/Platform-Sender-Pivot-Decision]] на `10dlcquestions@telnyx.com` (або Jonathan напряму)
- [ ] Записати відповідь в `DevLog/YYYY-MM-DD.md`
- [ ] Якщо Telnyx підтвердить shared-sender — створити новий `Platform-Sender-Pivot-Plan.md` з TFV, consent re-flow, legal diffs
- [ ] Якщо ні — оновити `SMS-Strategy-Review.md` як final decision

---


### SMS finalization checklist — do this now

#### AI 2 — frontend / UX / reviewer-facing validation
- [ ] Verify new workspace `Settings -> SMS Notifications` shows the toll-free-first card by default
- [ ] Verify new workspace does **not** surface EIN / SP registration as the primary setup path
- [ ] Verify toll-free states render correctly: `not enabled -> provisioning -> pending/configured/failed`
  - User-facing `Configured` currently maps from backend `sms_registration_status: 'active'`
- [x] Update frontend SMS UX for Gap 5 so new-workspace messaging is status-first / auto-activated instead of manual-enable-first
- [ ] Verify booking + waitlist consent copy uses `{shopName} Appointment Notifications`
- [ ] Verify email-only fallback copy is clear whenever workspace SMS is not active
- [ ] Verify the legal pages still match the live SMS consent text after deploy

#### AI 1 — backend / ops / Telnyx finalization
- [ ] Create the real Telnyx Verify Profile and capture `TELNYX_VERIFY_PROFILE_ID` — **BLOCKED**
  - Telnyx requires "whitelisted_destinations for call settings" even though we only need SMS
  - We added US+Canada to Outbound Voice Profile allowed destinations but Telnyx still blocks
  - **Action**: Ask Jonathan on next call to resolve this account-level blocker
  - **NOT a launch blocker**: OTP works via legacy fallback (local 6-digit code + SMS)
- [ ] Save `TELNYX_VERIFY_PROFILE_ID` as the GitHub secret — **BLOCKED** (waiting for profile creation)
- [x] Confirm OTP endpoints work before and after secret — **CODE VERIFIED**
  - Without secret: legacy local 6-digit code via Firestore + SMS
  - With secret: Telnyx Verify API. Both have rate limiting.
- [x] Confirm toll-free does not fall back to global sender — **CODE VERIFIED**
  - All reminder callers use `allowGlobalFallback: false`. No own number = email-only.
- [ ] Confirm toll-free status semantics match reality
  - `POST /api/sms/enable-tollfree` currently writes `sms_registration_status: 'active'` immediately after provisioning
  - AI 1 must confirm this matches real Telnyx delivery readiness; if not, change the status lifecycle before launch
- [x] Confirm Element Barbershop untouched — **CODE VERIFIED**
  - `enable-tollfree` blocks if status is not `none`/`rejected`. Element safe.
- [ ] Get written Telnyx confirmation or internal pilot sign-off — **OWNER TASK** (call with Jonathan)

#### Joint sign-off
- [ ] One fresh workspace passes toll-free-first SMS setup
- [ ] One grandfathered/pending manual workspace still shows the manual path
- [ ] OTP flow passes end-to-end
- [ ] Booking consent text, privacy, and terms all match the live product

### Product direction — dual path
- **New workspaces**: toll-free-first reminder setup
- **Existing / pending 10DLC workspaces**: grandfathered manual path
- **OTP**: stays on `POST /public/verify/send/:wsId` + `/check/:wsId`

### Backend (AI 1 + AI 2) — IN PROGRESS
- [x] 1.1 Telnyx Verify API — already at `/public/verify/send/:wsId` + `/check/:wsId`
- [x] 1.2 SP registration fields — **re-implemented** commit `2c8ce2c`
  - messageFlow: WEBFORM → descriptive opt-in narrative
  - optoutKeywords: added CANCEL,END,QUIT
  - optinMessage: added "Consent is not a condition of purchase"
  - SP status: pending_approval → active (auto-approves)
  - embeddedLink: false
- [x] 1.3 Appointment messaging now avoids platform/global sender fallback when workspace SMS is not active
  - New workspaces stay on email-only reminders until their own SMS sender is active
- [x] 1.4 Manual business registrations are now tagged with `sms_number_type: '10dlc'`
- [x] 1.5 Toll-free endpoint remains the default provisioning path for new workspaces
- [x] 1.6 Docs updated
- [x] 1.7 Backend fallback consent text aligned
  - Generic `sms_consent_text` fallback now matches the current appointment-notifications wording instead of the older pre-pivot SMS copy

### Frontend (AI 2) — IN PROGRESS
- [x] 2.1 Settings — toll-free-first SMS card for new workspaces
  - `Settings -> SMS Notifications` now treats toll-free as the default path
  - States are framed around enable/provisioning/pending/configured/failed instead of EIN-first setup
  - User-facing `Configured` currently maps to backend `sms_registration_status: 'active'`
- [x] 2.7 Legal copy alignment for reviewer-facing pages
  - `app/privacy/page.tsx` and `app/terms/page.tsx` now match the current booking consent text and the dual-path SMS architecture
  - Appointment SMS is described as `[Business Name] Appointment Notifications`, with toll-free default for new workspaces and grandfathered dedicated senders for manual paths
  - Payment language now reflects Stripe / Square / Apple instead of Stripe-only wording
  - Unsupported `99.9% uptime` / `status.vurium.com` language was removed from Terms
- [x] 2.2 Settings — manual SP / 10DLC flow hidden behind manual fallback for new workspaces
  - Grandfathered/pending manual workspaces still see the existing wizard
- [x] 2.3 Signup copy no longer frames EIN / business registration as the default reminder path
- [x] 2.4 Booking page — business-specific consent text
  - Booking and waitlist SMS opt-in copy uses `{shopName} Appointment Notifications`
  - Terms and Privacy links stay clickable directly inside the opt-in label
- [x] 2.5 Consent metadata
  - Booking, pay-online, group booking, and waitlist submissions send both `sms_consent_text` and `sms_consent_text_version`
- [x] 2.8 Toll-free copy softened
- [x] 2.9 SMS UI reframed around auto-activation
  - `app/settings/page.tsx` now treats SMS as automatic-first for new workspaces instead of a manual-enable-first flow
  - `app/signup/page.tsx` now frames dedicated toll-free SMS as something that normally starts automatically after trial or paid-plan activation
- [x] 2.10 Manual SMS CTA removed from new-workspace flow
  - `Settings -> SMS Notifications` now shows automatic activation / automatic retry messaging instead of a primary manual enable button
  - `app/signup/page.tsx` no longer offers a direct "Start SMS setup now" action for the default new-workspace path
  - `Settings` and `signup` SMS copy now avoids over-promising that toll-free reminders are already fully live before the remaining Telnyx / pilot sign-off is complete
- [x] 2.11 SMS state copy aligned with backend auto-retry lifecycle
  - `app/settings/page.tsx` now distinguishes between background auto-retry and terminal `failed_max_retries`
  - auto-retry stays framed as automatic, while terminal failure is shown as support-review-needed instead of a misleading generic retry state
- [x] 2.9 SMS settings auth path hardened
  - `Settings -> SMS Notifications` now uses the shared auth-aware API helper instead of raw `fetch(window.__API...)`
  - Toll-free enable, manual registration, and OTP verification now follow the same Bearer-token / session handling as the rest of Settings
- [ ] 2.6 Live verification
  - Pending browser pass for toll-free-first settings UX, grandfathered manual resume state, and email-only fallback behavior

### Pre-deploy
- [ ] Create Telnyx Verify Profile → `TELNYX_VERIFY_PROFILE_ID`
- [x] Add env var to Cloud Run deploy workflow — wired in `.github/workflows/deploy-backend.yml`
- [ ] Written Telnyx confirmation or internal pilot sign-off for Vurium-managed toll-free appointment reminders
- [ ] Confirm Element / existing manual 10DLC workspaces remain untouched after the pivot
  - `Element Barbershop` is the explicit protected failed-review remediation case; do not migrate or rewrite its SMS path while website / CTA fixes are in progress

## Code Quality & Security (2026-04-13)

> Виявлено в результаті повного аудиту codebase. Деталі: [[Production-Plan-AI1]] Phase 5, [[Production-Plan-AI2]] Phase 5.

### AI 1 — Claude (Backend)

- [ ] **5.1 P0** — Анулювати Twilio recovery code в консолі → видалити `docs/Telnyx/twilio_2FA_recovery_code.txt` з git history (`git filter-repo`)
- [ ] **5.2 P0** — Видалити demo credentials (`applereview@vurium.com / ReviewTest2026!`) з `docs/APPLE_REVIEW_CHECKLIST.md` → перенести в 1Password
- [ ] **5.3 P1** — Додати distributed lock для background jobs (Firestore TTL lock) щоб запобігти дублюванню при горизонтальному масштабуванні Cloud Run
- [ ] **5.4 P2** — Замінити plaintext `phone_norm` на HMAC-SHA256 blind index + написати migration script для існуючих clients
- [ ] **5.5 P2** — Розбити `backend/index.js` (10 351 рядок) на `routes/`, `lib/`, `jobs/` модулі без зміни логіки
- [ ] **5.6 P3** — Migrate legacy SMS statuses → видалити `LEGACY_SMS_STATUSES` Set після конвертації Firestore записів

### AI 2 — Codex (Frontend)

- [ ] **5.1 P1** — Прибрати дублювання auth в `lib/api.ts`: видалити `localStorage.getItem('VURIUMBOOK_TOKEN')`, залишити тільки `credentials: 'include'` (httpOnly cookie)
- [ ] **5.2 P2** — Розбити `app/settings/page.tsx` (2 559 рядків) на окремі таби в `app/settings/tabs/`
- [ ] **5.3 P3** — Замінити inline style-константи (`inp`, `card`, `lbl` тощо) в `settings/page.tsx` на Tailwind className або `styles.ts`
- [ ] **5.4 P0** *(docs — вже виконано)* — `app/signup/page.tsx` додано до ownership AI 2 в `AI-Work-Split.md`

---

## Other Active Tasks

- [ ] Verify Vurium Inc. brand on Telnyx (send CP-575A + Articles of Incorporation)
- [ ] Reply to 10dlcquestions about deleted brand BQY3UXK
- [ ] Call with Jonathan (Telnyx) — Mon-Fri next week, 10AM-4PM CT
- [x] Add ADMIN_NOTIFY_EMAIL GitHub Secret — user confirmed configured
- [ ] Save the real Telnyx Verify Profile ID as the GitHub secret `TELNYX_VERIFY_PROFILE_ID`
- [x] Gmail API integration for Developer panel — **CODE-COMPLETE** (verified 2026-04-15): 6 endpoints in `backend/index.js` (~2754–3040), frontend already wired at `app/developer/email/page.tsx`, secrets in `GitHub Secrets Inventory.md`. Only owner-side operation remains: verify OAuth redirect URI in Google Cloud Console + click Connect for each mailbox (support/billing/sales/security) in `/developer/email`
- [ ] Wait for TFN +1-877-590-2138 verification
- [ ] Create CUSTOMER_CARE campaign (after brand verified)

## Recently Completed (2026-04-14)
- [x] Vurium Inc. — Illinois corporation approved
- [x] Developer Panel — magic link auth, analytics, email, overview
- [x] Privacy Policy & Terms fixes (address format, section numbering)
- [x] Reply to Telnyx support (Jonathan) — ISV architecture thread
- [x] 10DLC brand Vurium Inc. registered on Telnyx (TCR: BCFAC3G)
- [x] Launch readiness audit and sell-ready execution plan
- [x] Obsidian vault setup & project documentation
