# Reminder SMS — Launch Completion Path

> [[Home]] > Tasks | Related: [[Features/SMS & 10DLC]], [[Tasks/Live-SMS-Verification-Checklist]], [[Tasks/Launch-Verification-Runbook]], [[Tasks/Telnyx-Integration-Plan]], [[Tasks/3-AI-Remaining-Work-Split|5-AI Work Split]]
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

### 2. Toll-free verification / carrier readiness may still matter

The repo does **not** currently submit a TFV request as part of `provisionTollFreeSmsForWorkspace()`.

So before we trust reminder SMS at launch scale, we need an exact answer:

- Is the current per-workspace TFN path already enough to deliver appointment reminders?
- Or does each reminder sender need an additional TFV / carrier verification step outside the code path?

This is precisely the kind of question AI 5 should answer before we design any bigger follow-up patch.

### 3. We still need one live pilot pass

Until one real fresh workspace receives:

- booking confirmation SMS
- scheduled reminder SMS
- STOP/HELP behavior

the reminder system is **not fully signed off**, even if the code looks ready.

---

## Execution order

### Step 1 — AI 5 research (first, before bigger changes)

**Question for AI 5:**

For Telnyx US reminder traffic using a **dedicated toll-free number per workspace**, what is required for real deliverability?

Need exact answers to:

1. Does each per-workspace toll-free number require its own TFV submission before appointment reminders can be sent reliably in the US?
2. If yes, can that verification be automated through Telnyx API or is it portal/manual only?
3. Does attaching a number to a messaging profile make it operationally send-ready, or only portal-configured?
4. What is the exact official Telnyx position for customer-care / appointment reminders over toll-free numbers for end-business traffic?

**Expected output:** a short research memo with official sources and a recommendation we can act on.

### Step 2 — AI 1 / Claude browser + portal check

Claude has the browser lane. He should verify in Telnyx portal:

1. A fresh workspace actually received a toll-free number
2. The number is attached to the expected messaging profile
3. The profile exists and has STOP / HELP autoresponses
4. There is no visible "not verified / blocked / pending review" state that contradicts our `active` backend status
5. If a TFV form exists and AI 5 confirms it is required, Claude can prepare/fill the portal data with Owner approval

### Step 3 — Owner live verification

Run the smallest high-value subset from [[Tasks/Live-SMS-Verification-Checklist]]:

- Scenario 1 — Auto-provision on fresh signup
- Scenario 4 — STOP via `phone_number_index`
- Scenario 5 — HELP response
- Scenario 8 — Email-only fallback

And from [[Tasks/Launch-Verification-Runbook]]:

- Section 5.1 — Appointment reminder

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
- a booking confirmation SMS is received,
- a scheduled reminder SMS is received,
- STOP works,
- HELP works,
- email-only fallback works when SMS is unavailable,
- docs are updated to say this is verified, not assumed.

