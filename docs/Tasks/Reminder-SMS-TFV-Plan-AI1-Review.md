# AI 1 Review — [[Reminder-SMS-TFV-Implementation-Plan]]

> [[Home]] > Tasks | Reviewer: **AI 1 (Claude)** — backend / data / infra / integration risk lens
> Date: 2026-04-15 ~12:00 CDT
> Plan under review: [[Reminder-SMS-TFV-Implementation-Plan]] (published by AI 3 / Verdent in commit `208fd24`)
> Related: [[TFV-Inspection-Result-2026-04-15]] (AI 1 portal inspection, same commit), [[AI5-Research-Brief-Reminder-SMS]] (AI 5 research), [[TFV-Inspection-and-Submission-Runbook]] (AI 1 API runbook)

---

## TL;DR

Plan **direction is correct** — introducing a real `configured → tfv_pending → active` lifecycle, auto-submitting TFV via API, polling for status, and guarding `getWorkspaceSmsConfig()` from non-`active` senders is the right shape. But there are **three hard blockers** that must be resolved before any backend implementation starts, plus **four improvements** and **two data-capture additions from the live portal inspection** that change what the plan assumes as its starting state. I am leaving my gate box unchecked until the three hard blockers are addressed in a v2 of the plan.

AI 2 (Codex) already left a frontend review inside the plan doc itself covering four frontend-specific gaps. This review covers backend/data/integration only and is orthogonal to Codex's — we agree the plan is directionally sound, we both want specific incorporations.

---

## Procedural note — empirical input from my portal inspection

The plan's § 5.1 ("⛔ GATE: Уточнити з Jonathan / Telnyx") asks:

> "Чи може Vurium Inc. як ISV/platform подавати TFV requests для кожного end-business workspace під Vurium's brand/EIN, чи кожен workspace потребує власні business registration дані (EIN, legal name)?"

My portal inspection ([[TFV-Inspection-Result-2026-04-15]]) **empirically answers this gate** — at least partially. The only TFV request on the Telnyx account today is `e23146a2-30d3-5ed4-a7be-c832da06ad4f`, created 2026-04-09, and it is the **platform-ISV variant** of this question:

- `businessName = Vurium Inc`, `dba = VuriumBook`
- `ISV Reseller = VuriumBook` (flag is set)
- Use case summary: `"on behalf of businesses using our platform"`
- 1 toll-free number covering platform-level traffic
- Status: **Rejected** with reason `Business Registration Number Is Missing or Invalid`

The literal reason is a missing `businessRegistrationIssuingCountry` field (the EIN field itself is filled). But the architectural shape of this request — single toll-free carrying multi-business traffic, `on behalf of businesses` framing, ISV Reseller flag set — is the same class that was already rejected as the `CKAOXOW` 10DLC campaign ("710 Reseller / Non-compliant KYC"), and that [[Platform-Sender-Pivot-Decision]] explicitly moved away from in favour of per-business architecture.

**So Jonathan's answer, as evidenced by Telnyx's own compliance engine twice rejecting this class, is already "no, ISV model doesn't work here"**. The plan's § 5.1 gate is effectively answered, and the v2 plan should commit to **per-workspace TFV** as the architecture before the backend implementation starts.

---

## Hard blockers (must be in v2 before AI 1 implementation)

### Blocker 1 — Plan § 2.2 payload mapping is missing the `businessRegistrationNumber` / `Type` / `IssuingCountry` fields

Plan § 2.2 lists the TFV submission payload fields but **omits the three fields that Telnyx just rejected on**:

- `businessRegistrationNumber`
- `businessRegistrationType`
- `businessRegistrationIssuingCountry`

These are not optional. The rejected request `e23146a2` shows Telnyx actively validates them: the EIN was filled (`42-1832301`) but the issuing country was empty, which produced the literal `Business Registration Number Is Missing or Invalid` rejection. For a per-workspace model the question is: **what values go in these three fields for each workspace?**

Three answer patterns exist, and the v2 plan must pick one (or declare a hybrid):

| Pattern | BRN source | Pros | Cons |
|---|---|---|---|
| **A — per-workspace EIN collection** | owner provides their own EIN/BRN at onboarding | truest per-business compliance fit, independent from Vurium Inc's reseller flag | workspace schema does not currently have EIN fields; many Vurium customers are sole proprietors with no EIN; owner-facing form change required; blocks workspace activation until EIN entered |
| **B — Telnyx Sole Proprietor TFV path** | no BRN required; use lower-throughput path | works for workspaces that cannot produce an EIN; no schema change; no owner form change | lower throughput cap (Telnyx limits SP senders to lower MPS and daily volume); not all use cases qualify for SP; still requires per-workspace brand identity data |
| **C — Vurium Inc EIN with per-workspace DBA** | single EIN for all workspaces, DBA field is workspace name | simplest backend change; matches Vurium Inc's existing IRS CP-575A paperwork | this is the ISV model already rejected twice; Telnyx compliance engine has signaled this does not pass the MNO human review pass |

**My recommendation:** start with **Pattern B (Sole Proprietor)** as the default for every new workspace because (a) no schema change, (b) works without collecting EINs, (c) throughput limits are above what a single barbershop's appointment reminders actually need (10 msgs/recipient/24h is already the Telnyx ceiling per [[AI5-Research-Brief-Reminder-SMS]] § 5). Add **Pattern A** as an upgrade path for workspaces that genuinely need higher throughput and are willing to provide an EIN. Do not use Pattern C.

Until this is decided and the payload template is updated, `backend/index.js` cannot implement § 2.2. **This is the #1 hard blocker.**

### Blocker 2 — Plan assumes workspace `shop_*` fields are populated at `provisionTollFreeSmsForWorkspace()` call time, but that is not generally true

Plan § 2.2 maps TFV fields like this:

```
businessContactEmail → data.shop_email || 'support@vurium.com'
businessContactPhone → data.shop_phone || phoneNumber
```

But `provisionTollFreeSmsForWorkspace()` runs from **three activation paths**:

1. Signup trial activation (see `backend/index.js` signup flow)
2. Stripe subscription activation webhook
3. Apple IAP subscription activation webhook

None of those three paths guarantee that the owner has completed the onboarding wizard where `shop_name`, `shop_address`, `shop_phone`, `shop_email` get populated. Actually the opposite is more common: **workspaces activate first**, THEN the owner fills in business details during onboarding. The plan's payload mapping would at the time of TFV submission produce:

- `businessName = ""` or a default
- `businessContactEmail = "support@vurium.com"` (fallback to a Vurium platform email, which is itself an ISV-like signal)
- `businessContactPhone = phoneNumber` (the toll-free number, which is a circular reference that Telnyx will reject)

**TFV submitted with half-empty workspace data will be rejected by Telnyx the same way `e23146a2` was**, and now we have rejected TFVs stacking up on the account.

**Fix:** gate TFV submission on a stricter condition than "provision succeeded". Something like:

```js
if (data.shop_name && data.shop_address && data.shop_phone && data.shop_email) {
  // submit TFV now
} else {
  // mark sms_registration_status: 'configured'
  // onboarding completion handler submits TFV later
}
```

And add a new code path triggered from the settings save handler in `POST /api/settings` that submits TFV the first time a workspace's required fields become complete.

This is a non-trivial architectural addition that the current plan does not cover. **This is the #2 hard blocker.**

### Blocker 3 — Plan does not update the `/api/webhooks/telnyx-10dlc` handler for TFV status events

Plan § 2.3 proposes a polling job `runTfvStatusCheck()` every 3 minutes. Polling works, but Telnyx also sends TFV status-change events to the webhook URL configured on the request (per [[AI5-Research-Brief-Reminder-SMS]] § 2). The existing webhook handler at `backend/index.js:1873` (`POST /api/webhooks/telnyx-10dlc`) maps TCR-campaign events (`TCR_PENDING`, `MNO_PROVISIONED`, etc.) but has **zero TFV event mapping** — I grep-verified this in [[TFV-Inspection-and-Submission-Runbook]] Phase 2.d.

Plan § 2.2 payload mapping includes `webhookUrl` but omits which endpoint to use. If TFV events arrive at our existing `/api/webhooks/telnyx-10dlc` endpoint (the most likely choice to keep webhook surface consolidated), the handler currently silently drops them. That means:

- TFV state transitions are **not** auto-captured
- The plan's polling job is the **only** source of truth for TFV status
- TFV → `Verified` transitions that happen between polls are delayed by up to 3 minutes (not a big deal alone, but combined with the rate-limit concern in Improvement 1 below, polling pressure compounds)

**Fix:** the v2 plan must include updating `/api/webhooks/telnyx-10dlc` handler to branch on `event_type === 'verification_request.status_updated'` and update the same `sms_registration_status` / `sms_tfv_*` fields as the polling job, so polling and webhook both converge on the same state. Polling stays as a safety net (webhooks can miss), but the primary signal should be the webhook.

**This is the #3 hard blocker.** Without webhook handling, the polling job becomes the single point of failure for TFV status propagation.

---

## Improvements (should incorporate but not strictly blocking)

### Improvement 1 — Polling frequency `3 minutes` is too aggressive for TFV review timelines

Plan § 2.3 says "кожні 3 хвилини". TFV reviews take **1–7 business days** per Telnyx documentation (see [[AI5-Research-Brief-Reminder-SMS]] § 5). Polling every 3 minutes across potentially dozens of `tfv_pending` workspaces will:

- hit Telnyx TFV API rate limits
- waste Cloud Run background-job budget
- pressure `withJobLock('runTfvStatusCheck', 600, ...)` lock contention against the 6 other jobs already locked at the same cadence (see [[BE.1-Post-Commit-Review]])

**Fix:** poll every **30 minutes** instead of 3, and trust the webhook as the primary signal. Also limit per-poll batch size to 50 (plan already says `limit 50` — good). If webhook is truly unavailable, 30 minutes still converges within a few hours on a terminal transition.

### Improvement 2 — Retry strategy is unspecified for TFV API failures (network, 429, 5xx)

Plan § 2.2 says: "На помилку: залишити `configured`, записати `sms_tfv_last_error`. Не кидати exception — номер вже куплений, TFV можна retry." But there is no retry schedule. The existing pattern for `autoProvisionSmsOnActivation` uses exponential backoff via `runSmsAutoProvisionRetry()` (see `backend/index.js`) with a `failed_max_retries` terminal state. The plan should use the same pattern for TFV submission:

- Immediate attempt during provisioning
- If 5xx or 429 → queue for retry via a `runTfvSubmitRetry()` background job (can coexist with `runTfvStatusCheck()` or share the same job)
- Exponential backoff: 5 min, 15 min, 1 h, 4 h, 24 h
- Max 5 attempts, then `tfv_submit_failed` terminal state
- Manual intervention via existing `POST /api/vurium-dev/sms/force-status` admin endpoint

### Improvement 3 — Firestore write atomicity for status + tfv_request_id

Plan § 2.2 says: "На успіх: записати `sms_registration_status: 'tfv_pending'`, `sms_tfv_request_id`, `sms_tfv_submitted_at`." These three fields must land **atomically** — otherwise a crash between writes leaves the workspace in `tfv_pending` without a `sms_tfv_request_id`, and the polling job will silently skip it (plan says `sms_tfv_request_id != null` filter).

**Fix:** use `db.runTransaction()` or `settingsRef.set({...all three...}, { merge: true })` in a single call. Plan-level note: "all TFV-related workspace writes must be single atomic set/update calls, not sequential writes."

### Improvement 4 — `getWorkspaceSmsConfig()` assumption needs verification before plan § 2.4 ticks

Plan § 2.4 says: "`getWorkspaceSmsConfig()` (рядки 514-533) **вже** повертає sender тільки коли `status === 'active'`. Нові статуси автоматично блокують відправку. **Потрібна лише верифікація через тест, не зміна коду.**"

I want to verify this claim before implementation because if the current code actually accepts any non-empty status, the guard is wrong. Let me cite: at `backend/index.js:514-533` the function signature takes `allowGlobalFallback`. Need to check whether the gate is on `data.sms_registration_status === 'active'` specifically or just on `!!data.sms_from_number`. If the latter, the new statuses are insufficient — the guard must be updated to require `status === 'active'` explicitly, otherwise configured-but-not-verified senders would start sending immediately (which was the whole thing AI 5 research flagged as wrong).

This is not a blocker — plan says it needs verification — but AI 1 flags that the verification is meaningful, not a rubber stamp. I'll verify when I implement.

---

## Two data-capture additions from the portal inspection

### Addition 1 — Annotate `e23146a2` as historical in the plan, not as "a request to remediate"

The plan talks about "reminder SMS is blocked by the last external verification mile" but does not yet acknowledge that an actual TFV request already exists and is rejected. Now that [[TFV-Inspection-Result-2026-04-15]] exists, the plan v2 should have a "Historical Context" section referencing that request id + rejection reason + why it is **not** the base for the per-workspace plan (it's the platform-ISV variant from the rejected architecture). This prevents a future AI 3 planning session from accidentally trying to "fix and resubmit" the existing request as a shortcut.

### Addition 2 — Rectify the `846 → 847` contact phone typo in the old TFV form

Purely cosmetic for now (that request is dead), but when Owner or backend opens the first real per-workspace TFV submission flow, the contact phone should be sourced from `data.shop_phone` (per-workspace) — and if it falls back to a platform default, the platform default must be `(847) 630-1884` exactly, not `(846) 630-1884`. The plan payload mapping currently says `data.shop_phone || phoneNumber` which works for per-workspace, but if any platform-level fallback enters the code, it must not repeat the typo.

---

## What AI 1 wants in v2 before ticking this gate

1. **Blocker 1 resolved**: plan picks Pattern A / B / C for BRN sourcing (my recommendation: B by default, A as upgrade). Payload mapping includes the three BRN fields with exact value sources.
2. **Blocker 2 resolved**: TFV submission is gated on "shop_* fields complete", not "provision succeeded". New trigger path from `POST /api/settings` when onboarding completes.
3. **Blocker 3 resolved**: `/api/webhooks/telnyx-10dlc` handler explicitly extended to map TFV events. Polling remains as safety net.
4. **Improvement 1**: polling frequency adjusted to 30 minutes.
5. **Improvement 2**: retry strategy matches existing `autoProvisionSmsOnActivation` pattern.
6. **Improvement 3**: atomic Firestore writes documented.
7. **Addition 1**: historical context section referencing `e23146a2`.

Once those land in a v2 plan doc, I tick the AI 1 box in the 4-AI Review Gate. Until then, gate stays open from my side.

## What AI 1 is NOT blocking on

- **Codex's frontend concerns** — those are in the plan doc inline AI 2 review and I agree with all four.
- **AI 4 emergency review slot** — separate lane, let Phone AI look at it when they come back on.
- **Owner approval** — last gate, happens after AI 3 republishes v2.
- **Element Barbershop protection** — plan § 4 correctly says `isLegacyManualSmsPath()` + `isProtectedLegacyWorkspace()` already guard Element. I verified this earlier today in the BE.8 work. No additional change needed.
- **Status lifecycle diagram** — plan's `none → provisioning → configured → tfv_pending → active` is clean. Agree.

---

## Closing

Plan direction ✅. Three hard blockers listed, four improvements listed, two data additions. AI 3 republishes as v2, I review again, tick the box, then AI 2 + AI 4 + Owner close their gates, and implementation starts. This should be ~30 minutes of AI 3 v2 work, not a major redesign.

— AI 1 (Claude), 2026-04-15 ~12:00 CDT
