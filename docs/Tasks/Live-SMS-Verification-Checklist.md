---
doc_class: canonical
topic: sms-notifications
brain_link: /Users/nazarii/Obsidian/Vurium-Brain/Projects/VuriumBook/Topics/SMS-Notifications-Brain.md
brain_execution_checklist: /Users/nazarii/Obsidian/Vurium-Brain/Projects/VuriumBook/Topics/SMS-Notifications-Execution-Checklist.md
---

# Live SMS Verification Checklist (BE.3)

> [[Home]] > Tasks | Owner: AI 1 (backend) — runbook executed by owner
> Related: [[Tasks/Telnyx-Integration-Plan|Telnyx Integration Plan]], [[Tasks/Launch-Verification-Runbook|Launch Verification Runbook]], [[Tasks/Deploy-Smoke-Test|Deploy Smoke Test]], [[Features/SMS & 10DLC|SMS & 10DLC]]
> Created: 2026-04-15

---

## Purpose

SMS-specific deep verification for the Telnyx hardening pack (Gaps 2–5) that landed in commit `3efce7e`. Complements the generic [[Tasks/Launch-Verification-Runbook|Launch Verification Runbook]] (VR.4) and fast [[Tasks/Deploy-Smoke-Test|Deploy Smoke Test]] (VR.5) — this runbook focuses on flows that only exist because of Gap 5 auto-provisioning and Gap 2/3 webhook changes.

Run this **once** after the Cloud Run deploy of `3efce7e` (or any later backend commit that touches SMS) to confirm the new architecture works end-to-end. Do not treat this as a recurring smoke test — it is a one-shot deep validation.

Record every result in `docs/DevLog/YYYY-MM-DD.md` under a `## SMS Verification` heading.

---

## Pre-flight

| # | Check | Expected | How |
|---|-------|----------|-----|
| PF.1 | Cloud Run revision is `3efce7e` or later | Revision serving 100% traffic matches commit | GCP Console → Cloud Run → `vuriumbook-api` → Revisions |
| PF.2 | `TELNYX_API_KEY` env var present | Set on Cloud Run | Cloud Run → Edit → Variables |
| PF.3 | `TELNYX_FROM` env var present | E.164 format | Same |
| PF.4 | `TELNYX_WEBHOOK_PUBLIC_KEY` env var present | Base64 SPKI key | Same — if **missing**, Gap 2 is in no-op mode (not a blocker, but flag in DevLog) |
| PF.5 | `TELNYX_VERIFY_PROFILE_ID` env var present | UUID or empty | If empty, OTP runs via legacy Firestore fallback (acceptable) |
| PF.6 | Test phone with SMS enabled | Can receive and send SMS | US / CA mobile with known carrier |
| PF.7 | Two workspace accounts ready | `ws_fresh` (newly created, no SMS history), `ws_element` (elementbarbershop slug on manual 10DLC) | Owner's workspace inventory |
| PF.8 | Cloud Run logs tail open | Filter: `resource.type="cloud_run_revision" AND resource.labels.service_name="vuriumbook-api"` | GCP Logging |

If any pre-flight fails, stop and fix before running the rest.

---

## Scenario 1 — Auto-provision on brand-new signup (Gap 5 "signup_trial")

**Goal:** confirm a brand-new workspace gets a dedicated toll-free number **without the owner pressing Enable SMS**.

### Steps

| # | Action | Expected |
|---|--------|----------|
| S1.1 | Create a fresh workspace via `vurium.com/signup` with a never-before-used email | Signup succeeds, lands on dashboard / plan selection |
| S1.2 | Immediately inspect Cloud Run logs for `[Apple IAP]` / `Telnyx` / `autoProvisionSmsOnActivation` entries within 30 seconds of signup | Log line `provisionTollFreeSmsForWorkspace` or equivalent indicates a Telnyx number-search call was made |
| S1.3 | In Firestore Console, open `workspaces/{newWsId}/settings/config` | After ~30-90 s: `sms_registration_status === 'configured'`, `sms_from_number` set to a `+1800...` / `+1888...` / etc toll-free number, `sms_number_type === 'toll-free'`, `sms_messaging_profile_id` present |
| S1.4 | Check Firestore `phone_number_index/{e164digits}` for the new number | Doc exists with `workspace_id === newWsId`, `shop_name`, `from_number`, `updated_at` |
| S1.5 | Check `workspaces/{newWsId}/audit_logs` for `sms.enable_tollfree` entry | `data.actor === 'auto_provision'` or `data.source === 'auto:signup_trial'` |
| S1.6 | Open `/settings` → SMS Notifications in the browser signed in as the new workspace | UI shows that a dedicated toll-free number is assigned but not yet delivery-ready, with the E.164 number visible. No manual "Enable SMS" CTA as primary action |

### Pass / fail

- ✅ **Pass** if S1.3 shows `active` + a real number within 90 s, S1.4 index exists, S1.6 UI reflects configured state
- ❌ **Fail** if status stuck at `provisioning` for >5 min or jumps straight to `failed` / `failed_max_retries`

If failure:
- Check Cloud Run logs for the exception trace
- Check Telnyx dashboard → Numbers for an order attempt
- Inspect `workspaces/{newWsId}/settings/config.sms_auto_provision_last_error`

---

## Scenario 2 — Element Barbershop is NOT touched (legacy guard)

**Goal:** confirm the auto-provision helper skips Element because of `isLegacyManualSmsPath()` / `isProtectedLegacyWorkspace()`.

### Steps

| # | Action | Expected |
|---|--------|----------|
| S2.1 | Open Firestore `workspaces/{elementWsId}/settings/config` and note current `sms_from_number`, `sms_registration_status`, `sms_number_type`, `telnyx_brand_id`, `telnyx_campaign_id` | Snapshot values |
| S2.2 | Trigger an activation event for the Element workspace — easiest: log in, go to `/billing`, touch a manage/refresh action that fires `handleStripeEvent` or simulate a Stripe `invoice.payment_succeeded` webhook to the staging endpoint | No Telnyx number-search call for Element |
| S2.3 | Wait 2 min, re-open Firestore settings doc | **Exact same values** as S2.1. No status change. No new fields (`sms_auto_provision_*` all unset or unchanged) |
| S2.4 | Check Element's `phone_number_index` entry (if it has one) | Unchanged |
| S2.5 | Check Cloud Run logs for `autoProvisionSmsOnActivation` + `elementbarbershop` | Should show `skipped: legacy_manual_path` return value (either in a log line or inferred by absence of provisioning log) |

### Pass / fail

- ✅ **Pass** if S2.3 shows no diff in settings
- ❌ **Fail** if any sms field changed — immediately check `isProtectedLegacyWorkspace()` + `isLegacyManualSmsPath()` logic

---

## Scenario 3 — Auto-retry backoff on transient failure

**Goal:** confirm exponential backoff works when the first attempt fails (e.g., Telnyx API returns 429 or 5xx).

### Option A — natural observation

Watch Firestore writes for any new workspace that happened to hit a transient Telnyx error. Look for `sms_auto_provision_retry_count: 1`, `sms_auto_provision_next_retry_at` set ~5 min ahead, and `sms_auto_provision_last_error` populated.

### Option B — synthetic test (staging only)

If you have a staging backend, temporarily force `telnyxApi` to throw by setting `TELNYX_API_KEY=invalid` on a staging revision. Then:

| # | Action | Expected |
|---|--------|----------|
| S3.1 | Create a fresh workspace on staging | `autoProvisionSmsOnActivation('signup_trial')` fires |
| S3.2 | Immediately check settings doc | `sms_registration_status === 'failed'`, `sms_auto_provision_retry_count === 1`, `sms_auto_provision_next_retry_at` ~5 min ahead, `sms_auto_provision_last_error` contains "Unauthorized" or similar |
| S3.3 | Wait 5 minutes | `runSmsAutoProvisionRetry()` fires next cycle → retry attempt 2 |
| S3.4 | Check settings doc again | `sms_auto_provision_retry_count === 2`, `sms_auto_provision_next_retry_at` ~15 min ahead |
| S3.5 | Fix `TELNYX_API_KEY` on staging | Next retry cycle should succeed → status `active` |

### Pass / fail

- ✅ **Pass** if retry counter increments with correct backoff (5 min → 15 min → 45 min → 2 h → 6 h)
- ✅ **Pass** if after 5 failed attempts `sms_registration_status === 'failed_max_retries'` and `sms_auto_provision_next_retry_at === null`
- ❌ **Fail** if retries fire faster than the backoff schedule, or if it loops forever past 5 attempts

---

## Scenario 4 — STOP/HELP via `phone_number_index` (Gap 3 reader)

**Goal:** confirm inbound STOP resolves via O(1) phone_number_index lookup and `collectionGroup('clients')` propagates opt-out without scanning every workspace.

### Steps

| # | Action | Expected |
|---|--------|----------|
| S4.1 | On the newly provisioned workspace from Scenario 1, create a public booking at `/book/{slug}` with the test phone number, SMS consent enabled | Booking created; `workspaces/{wsId}/clients/{clientId}` has `phone_norm` set |
| S4.2 | From the test phone, send an SMS with body `STOP` to the workspace's `sms_from_number` | Telnyx inbound webhook fires → `POST /api/webhooks/telnyx` |
| S4.3 | Check Cloud Run logs | Webhook handled, no `workspaces.limit(100).get()` scan, `phone_number_index` doc read once |
| S4.4 | Check `workspaces/{wsId}/clients/{clientId}` in Firestore | `sms_opt_out: true`, `sms_opt_out_at` set |
| S4.5 | Check `workspaces/{wsId}/sms_reminders` for any pending reminders for this phone | All affected reminders marked `sent: true, cancelled: true` |
| S4.6 | On the test phone, confirm you received the opt-out confirmation SMS | Text matches: `{shopName}: You have been unsubscribed and will not receive further messages. Reply HELP for help.` |

### Pass / fail

- ✅ **Pass** if S4.4 shows `sms_opt_out: true` and S4.6 receives the confirmation text with the **business shop name** (not "Vurium")
- ❌ **Fail** if confirmation text says "Vurium" — means `phone_number_index` read failed and fell through to the default shop name

---

## Scenario 5 — HELP response via Gap 3 reader

### Steps

| # | Action | Expected |
|---|--------|----------|
| S5.1 | From another test phone (not opted-out), send `HELP` to the workspace's `sms_from_number` | Webhook fires |
| S5.2 | Confirm the HELP response SMS arrives | Text matches: `{shopName}: For help, email support@vurium.com or visit https://vurium.com/privacy. Msg & data rates may apply. Reply STOP to opt out.` |

---

## Scenario 6 — Webhook signature enforcement (Gap 2)

**Goal:** confirm the webhook rejects unsigned requests **only if** `TELNYX_WEBHOOK_PUBLIC_KEY` is set.

### Case A — secret NOT set (pre-launch / dev)

| # | Action | Expected |
|---|--------|----------|
| S6.A.1 | Verify `TELNYX_WEBHOOK_PUBLIC_KEY` is unset on Cloud Run revision | Confirmed via GCP Console |
| S6.A.2 | Send a synthetic POST to `/api/webhooks/telnyx` with no `telnyx-signature-ed25519` header (use `curl`) | Returns 200 (no-op pass-through), logs show normal webhook processing |

### Case B — secret SET (production)

| # | Action | Expected |
|---|--------|----------|
| S6.B.1 | Verify `TELNYX_WEBHOOK_PUBLIC_KEY` is set on Cloud Run revision | Confirmed via `GitHub Secrets Inventory.md` + GCP Console |
| S6.B.2 | Send a synthetic POST to `/api/webhooks/telnyx` with no `telnyx-signature-ed25519` header (`curl`) | Handler throws `Missing Telnyx webhook signature`, outer catch returns 200 but no opt-out / processing happens. Logs show the warn |
| S6.B.3 | Send a real STOP SMS from a test phone (triggers real Telnyx → webhook with valid signature) | Normal processing: opt-out applied, confirmation sent |

### Pass / fail

- ✅ **Pass** Case A if unsigned POST is accepted without signature check
- ✅ **Pass** Case B if unsigned POST is rejected at entry (nothing written to Firestore) AND real signed webhook still works

---

## Scenario 7 — Pagination in `runAutoReminders()` (Gap 4)

**Goal:** confirm reminders fire for workspaces beyond position 100 in the workspace list.

### Test only useful if we have >100 workspaces in the environment. Otherwise skip.

| # | Action | Expected |
|---|--------|----------|
| S7.1 | Count workspaces: Firestore Console → `workspaces` collection count | If <100, skip scenario |
| S7.2 | Identify a workspace in position 101+ (sorted by `__name__`) with at least one pending `sms_reminder` | Scheduled reminder `send_at <= now`, `sent: false` |
| S7.3 | Wait for `runAutoReminders()` to run (every ~3 min) | Reminder is picked up and sent |
| S7.4 | Check `sms_logs` for the outbound SMS | Log entry present with correct `to`, `from`, `workspace_id` |
| S7.5 | Check reminder doc | `sent: true`, `sent_at` set |

---

## Scenario 8 — Email-only fallback when SMS is unavailable

**Goal:** confirm booking confirmations still go through via email when a workspace has no active `sms_from_number`.

### Steps

| # | Action | Expected |
|---|--------|----------|
| S8.1 | Create another fresh workspace; immediately after signup, **before** auto-provision completes, manually force-set `sms_registration_status: 'failed_max_retries'` in Firestore so provision is skipped | Workspace stays without `sms_from_number` |
| S8.2 | Create a public booking on `/book/{slug}` with a valid email | Booking succeeds |
| S8.3 | Check that a confirmation **email** arrived at the client's inbox | Email present with `vuriumEmailTemplate` branding |
| S8.4 | Check `sms_logs` for any outbound attempt to this client | **No entry** — SMS was not attempted |
| S8.5 | Check `runAutoReminders()` next cycle | Workspace's pending reminders are skipped (no `canSend` → continue) |

### Pass / fail

- ✅ **Pass** if S8.3 email arrives and S8.4 shows no SMS attempt
- ❌ **Fail** if SMS log shows an attempt from the global `TELNYX_FROM` sender — that would mean `allowGlobalFallback: false` guard is broken

---

## Scenario 9 — OTP fallback (Telnyx Verify vs legacy local code)

**Goal:** confirm the `/public/verify/send/:wsId` + `/public/verify/check/:wsId` endpoints work in both modes.

### Case A — Telnyx Verify active (`TELNYX_VERIFY_PROFILE_ID` set)

| # | Action | Expected |
|---|--------|----------|
| S9.A.1 | Run `curl -X POST https://vuriumbook-api-431945333485.us-central1.run.app/public/verify/send/{wsId} -H 'Content-Type: application/json' -d '{"phone":"+1..."}'` | 200 `{ok: true}`, SMS with 6-digit code arrives from Telnyx Verify sender |
| S9.A.2 | `curl -X POST .../verify/check/{wsId} -d '{"phone":"+1...","code":"123456"}'` | 200 `{ok: true, verified: true}` |

### Case B — Telnyx Verify unavailable (Verify profile missing or blocked)

| # | Action | Expected |
|---|--------|----------|
| S9.B.1 | Same curl | 200 `{ok: true}`, SMS with 6-digit code arrives — but from the workspace's own `sms_from_number` (legacy fallback) |
| S9.B.2 | Check Firestore `workspaces/{wsId}/phone_verify` | Code doc exists with `phone`, `code`, `expires_at` |
| S9.B.3 | Verify endpoint returns 200 on correct code | Same as A.2 |

### Pass / fail

- ✅ **Pass** if either Case A or Case B flow completes end-to-end (matching current env var state)
- ❌ **Fail** if both paths error out — means neither Telnyx Verify nor the fallback is wired correctly

---

## Scenario 10 — Audit log coverage

After Scenarios 1-9, spot-check the audit trail is readable:

| # | Action | Expected |
|---|--------|----------|
| S10.1 | Query `workspaces/{freshWsId}/audit_logs` for all entries in the last hour | At least one `sms.enable_tollfree` with `source: 'auto:signup_trial'` |
| S10.2 | For any failed scenario (if Scenario 3 was run), check for `sms.auto_provision_failed` entries | Entries exist with `retry_count` and `error` fields |
| S10.3 | For Scenario 3 max-retries case, check for `sms.auto_provision_exhausted` entry | Present with final retry count |

---

## Reporting

After running the runbook, create a `DevLog/YYYY-MM-DD.md` section titled `## SMS Verification — Live Run YYYY-MM-DD` and record:

1. Cloud Run revision tested
2. Pre-flight results
3. Scenario 1 through 10 outcomes (PASS / FAIL / SKIPPED + notes)
4. Any Firestore anomalies observed
5. Any Cloud Run log warnings
6. Launch readiness verdict: `GREEN` (all scenarios pass or acceptable WARN) / `YELLOW` (non-launch-critical warnings) / `RED` (blocker found)

If RED, create a follow-up issue in `docs/Tasks/Edge Case Bugs.md` or open a `docs/Tasks/QA-Scan-YYYY-MM-DD.md` entry for Verdent to triage.

---

## Rollback

If a critical failure is observed (e.g., Element state changed, or production workspace billing broke because of Gap 5 wire-points):

```bash
# Roll Cloud Run back to the previous revision
gcloud run services update-traffic vuriumbook-api \
  --region us-central1 \
  --to-revisions=PREVIOUS=100
```

Then file the root cause in `docs/DevLog/YYYY-MM-DD.md` and reopen the relevant Gap in `docs/Tasks/Telnyx-Integration-Plan.md`.

---

## DoD for this runbook

- [ ] Owner executed runbook once against Cloud Run revision `3efce7e` (or later)
- [ ] All pre-flight checks green
- [ ] Scenarios 1, 2, 4, 5, 8 completed end-to-end (hard launch-critical)
- [ ] Scenarios 6, 9 completed in the mode matching current env vars
- [ ] Scenarios 3, 7, 10 completed if environment allows
- [ ] Results recorded in DevLog with launch verdict
- [ ] Any RED findings triaged to Edge Case Bugs / QA-Scan doc
