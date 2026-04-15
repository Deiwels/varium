# Reminder SMS — Launch Completion Path

> [[Home]] > Tasks | Related: [[Features/SMS & 10DLC]], [[Tasks/Live-SMS-Verification-Checklist]], [[Tasks/Launch-Verification-Runbook]], [[Tasks/Telnyx-Integration-Plan]], [[Tasks/3-AI-Remaining-Work-Split|5-AI Work Split]], [[Tasks/AI5-Research-Brief-Reminder-SMS]]
> Created: 2026-04-15

---

## Current state

The **code path exists** for appointment reminders:

- bookings schedule `sms_reminders`
- `runAutoReminders()` processes them every ~3 minutes
- reminders send only from the **workspace sender**
- if workspace SMS is not active, the product falls back to **email-only**, not the global sender

### Code facts already verified

- `autoProvisionSmsOnActivation()` runs from signup / Stripe / Apple paid activation
- `provisionTollFreeSmsForWorkspace()` buys a TFN, creates a Telnyx messaging profile, associates the number, and writes:
  - `sms_from_number`
  - `sms_number_type: 'toll-free'`
  - `sms_messaging_profile_id`
  - `sms_registration_status: 'active'`
- `getWorkspaceSmsConfig(wsId, { allowGlobalFallback: false })` is used for booking confirmations and reminder sends, so reminder traffic does **not** silently reuse the OTP/global sender

### What is still not fully proven

We do **not** yet have the final live proof that a **fresh workspace**:

1. gets a working toll-free sender end-to-end,
2. can actually deliver booking confirmations and reminders,
3. passes STOP / HELP compliance,
4. uses truthful status semantics (`active` means truly deliverable, not just "number purchased").

That means the blocker is no longer "missing core code". The blocker is the **last operational / verification mile**.

---

## Most likely reminder blockers now

### 1. Real Telnyx reminder deliverability not yet proven live

The code marks the workspace `active` immediately after TFN purchase + messaging profile setup. That may be correct — or it may be optimistic. We still need a live proof.

### 2. Toll-free verification / carrier readiness is now confirmed as the main blocker

AI 5 has now answered the external-facts question in [[Tasks/AI5-Research-Brief-Reminder-SMS]].

**Confirmed from official Telnyx sources:**

- buying a toll-free number + attaching a messaging profile is **not enough** to call the sender launch-ready
- reminder / customer-care toll-free traffic is allowed, but it still requires **Toll-Free Verification (TFV)**
- `Verified` is the only clearly positive state that should be treated as ready
- our current backend `sms_registration_status: active` is too optimistic if read as "customer-deliverable"

The repo does **not** currently submit TFV as part of `provisionTollFreeSmsForWorkspace()`, so the reminder blocker is now understood as a **real external readiness gap**, not a vague suspicion.

### 2A. Live TFV rejection received

Owner received a real Telnyx TFV rejection:

- Request ID: `e23146a2-30d3-5ed4-a7be-c832da06ad4f`
- Business: `Vurium Inc`
- Status: `Rejected`
- Reason: `Business Registration Number Is Missing or Invalid`

This confirms the current blocker is specifically:

- missing or invalid BRN data in TFV
- not a missing reminder engine
- not proof that toll-free is impossible

### 3. We still need one live pilot pass

Until one real fresh workspace receives:

- booking confirmation SMS
- scheduled reminder SMS
- STOP/HELP behavior

the reminder system is **not fully signed off**, even if the code looks ready.

---

## Execution order

### Step 1 — AI 5 research (completed)

Completed in:

- [[Tasks/AI5-Research-Brief-Reminder-SMS]]

**Operational conclusion from AI 5:**

- Treat each dedicated reminder sender as needing TFV coverage before it is considered truly live
- Treat `Verified` as the only clear ready state
- Do not treat purchased+attached+`active` as sufficient proof of deliverability

The research phase is now complete enough for AI 3 to plan and for AI 1 to validate one real sender.

### Step 2A — AI 3 implementation plan (completed)

AI 3 has published the implementation plan based on AI 5 findings:

- [[Tasks/Reminder-SMS-TFV-Implementation-Plan]]

Plan covers: status lifecycle change, TFV API integration, frontend alignment, Element protection, rollback, and live pilot.

**Status:** awaiting 4-AI Review Gate (AI 1, AI 2, AI 4, Owner must review and approve before implementation starts).

### Step 2B — AI 1 / Claude browser + portal check

Claude has the browser lane. He should verify in Telnyx portal:

1. A fresh workspace actually received a toll-free number
2. The number is attached to the expected messaging profile
3. Whether that specific number has a TFV request at all
4. The exact TFV status for that number
5. The profile exists and has STOP / HELP autoresponses
6. There is no visible "not verified / blocked / pending review" state that contradicts our `active` backend status
7. If TFV has not been submitted yet, Claude should prepare the smallest correct submission path (portal or API-backed ops path) with Owner approval
8. If TFV is already rejected, capture the exact fields needed for resubmission:
   - exact legal business name
   - exact BRN / EIN value
   - matching BRN type
   - `US` country
   - any portal/API mismatch that could trigger the same rejection again

### Step 3 — Owner live verification

Run the smallest high-value subset from [[Tasks/Live-SMS-Verification-Checklist]]:

- Scenario 1 — Auto-provision on fresh signup
- Scenario 4 — STOP via `phone_number_index`
- Scenario 5 — HELP response
- Scenario 8 — Email-only fallback

And from [[Tasks/Launch-Verification-Runbook]]:

- Section 5.1 — Appointment reminder

**Important:** do this only after AI 1 confirms the sender's real TFV/configuration state. Without that, a failed pilot does not tell us enough.

### Step 4 — Only if live test fails

If the fresh workspace still does **not** receive reminder SMS:

- AI 1 investigates logs + Firestore state
- AI 3 opens a formal plan if the fix is larger than a small patch
- AI 2 only joins if frontend state / status UI / settings flow needs to change

---

## Practical ownership

| Owner | Ask |
|---|---|
| **AI 5** | produce the exact external truth about Telnyx TFN reminder readiness / TFV requirements |
| **AI 1 / Claude** | inspect Telnyx portal via browser; verify number/profile state; help fill any required portal step |
| **Owner** | run live checklist on a fresh workspace and confirm whether real reminder SMS arrives |
| **AI 2 / Codex** | keep frontend/status/docs aligned; do not invent a new sender architecture without plan + research |
| **AI 3 / Verdent** | if Step 4 is needed, publish the formal fix plan and QA runbook |

---

## Done criteria

Reminder SMS is considered **truly launch-ready** only when all are true:

- one fresh workspace auto-provisions its reminder sender,
- that sender has real TFV/verification truth confirming it is launch-ready,
- a booking confirmation SMS is received,
- a scheduled reminder SMS is received,
- STOP works,
- HELP works,
- email-only fallback works when SMS is unavailable,
- docs are updated to say this is verified, not assumed.

---

## Current practical verdict

The reminder path is **code-complete but not launch-complete**.

What is missing now is:

1. real TFV state for one fresh reminder sender
2. corrected BRN / TFV resubmission for the rejected Vurium Inc request
3. one confirmed live pilot
4. a final AI 3 plan for truthful status semantics and any required follow-up implementation
