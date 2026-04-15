# Superadmin Endpoints Inventory

> [[Home]] > Architecture | Related: [[AI-Profiles/AI-4-Phone-AI|AI 4 — Phone AI]], [[Tasks/AI4-Emergency-Readiness-Review-2026-04-15]], [[Architecture/GitHub Secrets Inventory]]
> Maintained by: AI 1 (Claude) · Last updated: 2026-04-15
> Purpose: one-page reference for emergency use when auth middleware breaks in production — which backend routes are gated by `requireSuperadmin` and what they do.

---

## Why this file exists

Per [[Tasks/AI4-Emergency-Readiness-Review-2026-04-15]] `AI4-REQ.4`: if a production incident breaks the `requireSuperadmin` middleware or the Developer Panel magic-link auth, AI 4 needs an at-a-glance list of which endpoints are affected so they can be triaged, not grep'd for under incident pressure.

This is a **living inventory** — every new `requireSuperadmin`-gated route added to `backend/index.js` must be appended here in the same commit. If you see a grep count mismatch between this file and `backend/index.js`, that is a doc drift bug and the first action is to re-sync.

---

## Auth chain (how `requireSuperadmin` works)

`requireSuperadmin` is defined at `backend/index.js:1958`. The contract:

1. Client must send the `vurium_admin_token` HttpOnly cookie set by `/api/vurium-dev/auth/verify` after the magic-link flow
2. Token is verified against `VURIUM_ADMIN_TOKEN_SECRET` (env var)
3. If valid → `req.isSuperadmin = true` → handler runs
4. If missing / expired / bad signature → `401 { error: 'superadmin_required' }`

The magic-link entry points (`/api/vurium-dev/auth/request` + `/api/vurium-dev/auth/verify`) are **intentionally unprotected** — they are the only way to bootstrap a superadmin session. `/api/vurium-dev/auth/logout` clears the cookie.

Related:

- Developer Panel frontend at `/developer/*` calls `/api/vurium-dev/ping` to verify session on each navigation
- Middleware at `middleware.ts` passes through everything under `/developer/*` without checking cookies — the auth gate is purely backend-side
- Cross-reference: [[Web-Native-Auth-Contract]] for the separate web/native auth contract (different cookie set)

---

## Gated endpoints (as of 2026-04-15)

Grep source: `backend/index.js`. Count: **19 routes gated by `requireSuperadmin`** + 3 auth bootstrap routes (unprotected by design).

### Auth bootstrap (unprotected, magic-link flow)

| Line | Method | Route | Purpose |
|---|---|---|---|
| 2283 | `POST` | `/api/vurium-dev/auth/request` | Request magic-link to Owner email |
| 2324 | `POST` | `/api/vurium-dev/auth/verify` | Verify token from magic-link, set `vurium_admin_token` cookie |
| 2361 | `POST` | `/api/vurium-dev/auth/logout` | Clear `vurium_admin_token` cookie |
| 2882 | `GET` | `/api/vurium-dev/gmail/callback` | Gmail OAuth callback (unprotected because OAuth redirect carries its own state token) |
| 2663 | `POST` | `/api/vurium-dev/email/inbound` | Inbound email webhook from Resend (signed payload verified at handler level, not middleware) |

### Push notifications

| Line | Method | Route | Purpose |
|---|---|---|---|
| 1133 | `GET` | `/api/push/status` | Report APNs certificate status and recent push events |

### Developer Panel session + platform overview

| Line | Method | Route | Purpose |
|---|---|---|---|
| 2367 | `GET` | `/api/vurium-dev/ping` | Heartbeat used by `/developer/*` layout to verify superadmin session on each page load |
| 2372 | `GET` | `/api/vurium-dev/platform` | Platform-wide metrics: workspace count, user count, recent signups, billing state |

### SMS / 10DLC ops

| Line | Method | Route | Purpose |
|---|---|---|---|
| 2478 | `GET` | `/api/vurium-dev/sms/status` | Telnyx brand/campaign status across all workspaces |
| 2495 | `POST` | `/api/vurium-dev/sms/provision` | Force-provision a toll-free SMS number for a given workspace |
| ~2600 | `GET` | `/api/vurium-dev/sms/legacy-audit` | BE.8 — list workspaces still carrying legacy SMS status values (Element skipped) |
| ~2615 | `POST` | `/api/vurium-dev/sms/migrate-legacy-statuses?dryRun=true\|false` | BE.8 — migrate legacy statuses to new pipeline (atomic batch, dry-run by default) |
| ~2790 | `POST` | `/api/vurium-dev/sms/restore-legacy-status/:wsId` | BE.8 — per-workspace rollback using snapshot written by migration |

### Custom content sanitization

| Line | Method | Route | Purpose |
|---|---|---|---|
| ~2700 | `POST` | `/api/vurium-dev/sanitize-existing-custom-content?dryRun=true\|false` | BE.9 — one-shot re-sanitization of existing `custom_html` / `custom_css` / `ai_css` across all workspaces (defense-in-depth backfill for pre-BE.9 stored values) |

### Analytics

| Line | Method | Route | Purpose |
|---|---|---|---|
| 2554 | `GET` | `/api/vurium-dev/analytics` | Platform-level booking / traffic / source analytics |

### Email ops

| Line | Method | Route | Purpose |
|---|---|---|---|
| 2633 | `POST` | `/api/vurium-dev/email/send` | Send a one-off email through Resend (Developer Panel composer) |
| 2720 | `GET` | `/api/vurium-dev/emails` | List inbound + outbound emails |
| 2738 | `GET` | `/api/vurium-dev/emails/:id` | Read one email thread |
| 2749 | `PATCH` | `/api/vurium-dev/emails/:id` | Mark email read / archived / resolved |

### Gmail integration (OAuth on behalf of Owner)

| Line | Method | Route | Purpose |
|---|---|---|---|
| 2866 | `GET` | `/api/vurium-dev/gmail/auth` | Start Gmail OAuth flow — redirects to Google consent |
| 2901 | `GET` | `/api/vurium-dev/gmail/status` | Check whether Gmail token is still valid |
| 2916 | `GET` | `/api/vurium-dev/gmail/messages` | List Gmail inbox |
| 2958 | `GET` | `/api/vurium-dev/gmail/messages/:id` | Read one Gmail thread |
| 2989 | `POST` | `/api/vurium-dev/gmail/send` | Send email via Gmail API |
| 3008 | `POST` | `/api/vurium-dev/gmail/reply` | Reply to Gmail thread |

### AI diagnostic scans

| Line | Method | Route | Purpose |
|---|---|---|---|
| 3320 | `GET` | `/api/vurium-dev/ai/scans` | List recent AI diagnostic scan runs |
| 3351 | `POST` | `/api/vurium-dev/ai/scan` | Trigger a new AI scan across a workspace or the whole platform |
| 3366 | `GET` | `/api/vurium-dev/ai/scans/:id` | Read one scan result |

### Planned but not yet deployed

None currently. BE.8 (audit/migrate/restore) shipped in `d40b5fa`. BE.9 (sanitize-existing-custom-content) shipped alongside the BE.9 backend helpers commit. When a new `requireSuperadmin` route is added, this file must be updated in the **same commit**.

---

## Emergency use

### Scenario 1 — "Developer Panel returns 401 on every page"

1. Check `vurium_admin_token` cookie in browser devtools — is it present and unexpired?
2. If missing → re-run magic-link flow: `/developer/login` → submit Owner email → click link in email
3. If present but still 401 → check `VURIUM_ADMIN_TOKEN_SECRET` in Cloud Run env vars. If it rotated recently, all sessions are invalidated and Owner must re-login
4. If all above checks pass → `git log backend/index.js -10` around `requireSuperadmin` for recent changes

### Scenario 2 — "One specific superadmin endpoint returns 500"

1. Find the route in the table above → jump to the line number
2. Check Cloud Run logs for stack trace
3. Common causes: Firestore rule mismatch, missing env var, upstream service (Telnyx / Gmail / Resend) returning unexpected shape
4. Cross-reference with [[Architecture/GitHub Secrets Inventory]] to see if any secret affects this route

### Scenario 3 — "Entire `/api/vurium-dev/*` cohort is down"

1. Suspect `requireSuperadmin` middleware regression → `git log backend/index.js -10 | grep -E "auth|superadmin"`
2. If the magic-link routes themselves (2283, 2324, 2361) are broken → no bootstrap path left, `git revert` the offending commit and redeploy
3. Cloud Run `vuriumbook-api-431945333485` → Logs → filter `requireSuperadmin` errors

---

## Maintenance rules

- Every new `requireSuperadmin`-gated route added to `backend/index.js` → append here in the same commit
- Route moves → update line numbers
- Route removals → remove from this file + mention in DevLog
- If this file drifts from grep count → that's a P1 doc bug, fix before next deploy
