# TFV Inspection Result — 2026-04-15 (AI 1 / Chrome MCP)

> [[Home]] > Tasks | Related: [[AI5-Research-Brief-Reminder-SMS]], [[Reminder-SMS-Launch-Completion]], [[Reminder-SMS-TFV-Implementation-Plan]], [[TFV-Inspection-and-Submission-Runbook]], [[Features/SMS & 10DLC]]
> Inspector: AI 1 (Claude) via Chrome MCP on Owner's Telnyx portal session
> Date: 2026-04-15 ~11:40 CDT
> Purpose: close AI 1's slot in the [[Tasks/In Progress|In Progress]] "Action queue after AI 5 research" by capturing the exact live state of Toll-Free Verification inside Telnyx Portal, beyond the headline facts Codex recorded in commit `2f95184`.

---

## Scope

Codex already captured the headline facts in [[Features/SMS & 10DLC]] § "Reminder-launch blocker update (2026-04-15)":

- Request id `e23146a2-30d3-5ed4-a7be-c832da06ad4f`
- Business: Vurium Inc
- Status: Rejected
- Reason: Business Registration Number Is Missing or Invalid

This file captures the **additional nine specific facts** from the live portal form that Codex's note does not record, and then flags three layered concerns that change how the [[Reminder-SMS-TFV-Implementation-Plan]] should read. None of this contradicts Codex's note — it extends it.

---

## Full captured state

Single TFV request on the account (1 row / 1 total in `portal.telnyx.com` → Real-Time Communications → Messaging → Compliance → Toll Free Verification).

### General tab

| Field | Value |
|---|---|
| Request ID | `e23146a2-30d3-5ed4-a7be-c832da06ad4f` |
| Status | 🔴 **Rejected** |
| Reason | `Business Registration Number Is Missing or Invalid` |
| Ticket Number | — (none) |
| Created At | **Apr 9, 2026** |
| Updated At | **Apr 9, 2026** (same day — no resubmission attempt, request was created and rejected the same day and then sat idle for 6 days until now) |

### Business Details tab

| Field | Value | Notes |
|---|---|---|
| Business Name | `Vurium Inc` | Legal parent company, not a per-workspace brand |
| Corporate Website | `https://vurium.com` | Root marketing site — not a per-workspace `/book/<slug>` CTA URL |
| Legal form | `Private Company` | |
| DBA or brand name | `VuriumBook` | Platform product name, not a per-workspace DBA |
| Business Registration Number | `421832301` (displays as `42-1832301`) | **Field is filled.** EIN format is valid (9 digits). |
| Business Registration Type | `EIN (US)` | |
| Business Registration Issuing Country | 🔴 **EMPTY** (placeholder "Select..." visible) | **This is almost certainly the literal cause of "Missing or Invalid"** — a required field was left blank, so Telnyx cannot validate the EIN against any registry. |
| First Name | `Nazarii` | |
| Last Name | `Mykhailiuk` | |
| Email | `support@vurium.com` | |
| Phone Number | `+1 846 630 1884` | ⚠️ **Typo flag:** everywhere else in `docs/` and `backend/index.js` HELP responses this phone is `(847) 630-1884` — a different area code. One of the two is wrong. If the TFV form has the typo, that's a secondary compliance issue on its own. |
| Status update webhook URL | — (empty) | Minor: backend's `/api/webhooks/telnyx-10dlc` handler is not wired here, so TFV status updates won't be pushed to our backend. |
| Address line 1 | `1142 W Lake Cook Rd` | ⚠️ **This is Element Barbershop's address**, not Vurium Inc's Illinois corporate address. A TFV reviewer who cross-references the Vurium Inc public record (Illinois SOS File #75519095) will see a barbershop address instead of Vurium's legal HQ, which would look like another mismatch. |
| City / State / ZIP / Country | Not fully extracted, present in form | Based on Element's known address: Buffalo Grove, IL, 60089, US |

### Numbers tab

| Field | Value |
|---|---|
| Assigned Numbers | 1 |
| Phone Number | **`+18775902138`** (toll-free, US) |

### Use Case Details tab

| Field | Value | Notes |
|---|---|---|
| Expected messaging volume / month | `10,000` | |
| Use-case | `Appointments` | Valid Telnyx enum for toll-free per [[AI5-Research-Brief-Reminder-SMS]] § 4 |
| Use case summary | `"VuriumBook is a SaaS booking platform for barbershops and salons. We send transactional appointment-related SMS on behalf of businesses using our platform. Messages include booking confirmations, 24-hour and 2-hour reminders, and cancellation notices. Frequency: up to 5 messages per booking."` | 🔴 **Architectural red flag** — phrase `"on behalf of businesses using our platform"` declares the platform-sender model where one Vurium toll-free number carries multi-business traffic. This is the exact model that was rejected as `CKAOXOW` 710 "Reseller / Non-compliant KYC" and that [[Platform-Sender-Pivot-Decision]] explicitly discarded in favour of per-business architecture. |
| Message content sample 1 | `"Element Barbershop: Your appointment is confirmed for Mon Apr 7 at 2:00 PM with John. Msg & data rates may apply. Reply STOP to opt out, HELP for help."` | Uses `Element Barbershop:` prefix — specific to one tenant, not generic to the platform. Another sign this was built as a platform-sender request but with tenant-specific sample text. |
| Message content sample 2 | `"Element Barbershop: Reminder: Your appointment is tomorrow at 2:00 PM. Reply STOP to opt out, HELP for help."` | Same observation |
| Opt-In workflow image URL | `https://vurium.com/sms-optin-screenshot.png` | Static screenshot asset, not a live CTA URL |
| Opt in keywords | `START,YES` | |
| Opt in message | `"You're subscribed to appointment SMS. Msg frequency varies, up to 5 msgs per booking. Msg & data rates may apply. Reply HELP for help, STOP to opt out. Privacy Policy: https://vurium.com/privacy"` | |
| Help message | `"For help with appointment SMS, contact support@vurium.com or call (847) 630-1884. Visit https://vurium.com/support. Reply STOP to opt out."` | Note: this version of the help message does have `(847) 630-1884` correct, which means the `846` in the contact-phone field above is likely a typo isolated to that field. |
| Privacy policy URL | `https://vurium.com/privacy#sms` | |
| Terms and conditions URL | `https://vurium.com/terms#sms` | |
| ISV Reseller | `VuriumBook` | 🔴 **Flag is set.** This is a Telnyx-specific marker for platforms that resell their messaging service to other businesses. Combined with the `"on behalf of businesses"` use case summary, this is the same compliance class that previously earned the 710 "Reseller / Non-compliant KYC" rejection on `CKAOXOW`. |
| Age-Gated Content | No | |

### Per-workspace TFV requests

**Zero.** There is one TFV request on the entire Telnyx account, and it is the platform-level one described above. No workspace toll-free number has ever had a TFV submission.

This empirically confirms the gap I flagged in [[TFV-Inspection-and-Submission-Runbook]] Phase 2.d and in my grep of `backend/index.js`: `provisionTollFreeSmsForWorkspace()` purchases numbers, attaches them to messaging profiles, writes `sms_registration_status: 'active'`, but **never submits TFV**. So every fresh workspace sender is technically in Telnyx error-code `40329` (Toll-free not verified) territory for any real outbound reminder.

---

## Nine additional facts beyond Codex's `2f95184` headline

Codex's commit captured: id, business name, status, reason, one-line implication. The live portal form gives nine more facts that matter for planning:

1. **Created and Updated both Apr 9, 2026** — rejected same day, no resubmission attempt in the 6 days since.
2. **Only 1 TFV request exists on the account.** No per-workspace TFVs anywhere.
3. **Phone number `+18775902138`** — one toll-free number, not a workspace sender. The `877` area code confirms toll-free.
4. **EIN `42-1832301` is filled**, but `businessRegistrationIssuingCountry` is empty. The "Missing or Invalid" message almost certainly means "cannot validate without country context", not "number missing".
5. **Contact phone field shows `+1 846 630 1884`** (846 area code) while all other docs and backend code use `(847) 630-1884`. Isolated typo on one TFV field.
6. **Address line is Element Barbershop's** (`1142 W Lake Cook Rd`), not Vurium Inc's registered Illinois corporate address. Creates a cross-reference mismatch if a reviewer looks up Vurium Inc's public SOS record.
7. **`ISV Reseller: VuriumBook` flag is set.** This is the same compliance marker that contributed to the previous `CKAOXOW` 710 rejection.
8. **Use case summary describes platform-sender / on-behalf-of model** — exact same architecture that [[Platform-Sender-Pivot-Decision]] discarded.
9. **Sample messages use `Element Barbershop:` prefix**, not a generic VuriumBook prefix, which is inconsistent with "one platform sender for many businesses" in the same form.

---

## Three layered concerns for [[Reminder-SMS-TFV-Implementation-Plan]]

### Concern 1 — Surface-level: the rejection can be fixed in one click, but it will not unblock the architecture

Filling the missing `businessRegistrationIssuingCountry` = `US` and fixing the `846 → 847` typo may flip Telnyx's automated BRN-validation check green, but a human compliance review will then re-trigger the same class of issue that sank `CKAOXOW`: platform-sender + ISV Reseller flag + on-behalf-of-businesses description on a single toll-free number. Treating this as "one-field fix" is a trap.

### Concern 2 — Architectural: this existing TFV is for the **rejected** architecture, not the **accepted** one

The [[Reminder-SMS-TFV-Implementation-Plan]] (commit `208fd24`) correctly plans for **per-workspace TFV submissions**. But the existing rejected TFV `e23146a2` is a **platform-level submission**. These are two different architectures and the existing request should not be treated as "a TFV request that just needs remediation" — it should either:

(a) be **cancelled / left as dead state** (Telnyx allows unlimited resubmissions, so leaving a rejected one does no harm), OR
(b) be explicitly repurposed into the first real per-workspace TFV (requires editing business identity from `Vurium Inc` → one specific workspace's `shop_name`, use case summary from "on behalf of businesses" → "on behalf of {workspace}", samples to match), OR
(c) be kept as-is as a historical record and AI 3's plan should open brand-new per-workspace TFV requests from workspace provisioning.

My recommendation is **(c)** — the existing request is an artefact of a prior architectural direction and trying to repurpose it mid-fix just creates audit confusion. The plan should open fresh per-workspace TFV requests and this one should be annotated as "historical platform-sender attempt, not retried".

### Concern 3 — Data-schema: the plan's payload mapping is missing `businessRegistrationNumber` per workspace

[[Reminder-SMS-TFV-Implementation-Plan]] § 2.2 lists the payload mapping for the automatic TFV submission but does **not** mention the `businessRegistrationNumber` / `businessRegistrationType` / `businessRegistrationIssuingCountry` fields. Those are the exact fields Telnyx rejected on in `e23146a2`. For a per-workspace model there are three options, none of which are currently answered:

- **Option A — Collect per-workspace EIN at onboarding.** Owner-facing form change. Not in current workspace schema. Some Vurium customers will not have an EIN (sole proprietors). Not all US states issue SOS-retrievable BRNs for sole proprietors.
- **Option B — Telnyx Sole Proprietor TFV path.** Lower throughput cap, different compliance flow. Works for workspaces that cannot produce an EIN. Plan must say which workspaces go through this path and how.
- **Option C — Submit all workspace TFVs under Vurium Inc's EIN with per-workspace DBA**. This is what the existing rejected request did at a higher level. If Vurium Inc can legally cover the compliance obligation for each tenant, this is the smallest payload change — but it is exactly the ISV Reseller model that Jonathan / Telnyx said requires further conversation in plan § 5.1.

**Plan § 5.1 correctly calls this out as a gate**, but my inspection shows the gate is already empirically answered: the ISV model was already tried and rejected. Plan needs to pick Option A or Option B (or a hybrid) and update the payload accordingly.

---

## Hand-back format per [[TFV-Inspection-and-Submission-Runbook]] Phase 5

```
Target sender:      +18775902138 (not a workspace sender — platform-level Vurium Inc toll-free)
Inspection time:    2026-04-15 ~11:40 CDT
Pre-check:          phone_number_type=toll-free ✅, messaging_profile_id=?, status=active (not verified, but "active" in phone_numbers API ≠ Verified in TFV)
TFV request exists: yes, one
TFV request id:     e23146a2-30d3-5ed4-a7be-c832da06ad4f
TFV status:         Rejected
status_history:     (not retrieved via API because I came in via portal, not API)
Submission taken:   no — this is not the right architecture to resubmit
Submission id:      N/A
Blocker summary:
  (a) Literal rejection is "Business Registration Number Is Missing or Invalid" because the
      businessRegistrationIssuingCountry field is empty. The EIN itself is filled (42-1832301).
  (b) But even after fixing the country field, the request would re-fail compliance review because
      it declares a platform-sender / ISV Reseller / on-behalf-of-businesses model on a single
      toll-free number — the same architecture that was previously rejected as CKAOXOW 710
      "Reseller / Non-compliant KYC" and that docs explicitly moved away from in
      Platform-Sender-Pivot-Decision.
  (c) No per-workspace TFV requests exist anywhere on the account. provisionTollFreeSmsForWorkspace()
      has never submitted one. Every Vurium-provisioned fresh workspace sender is currently
      not-verified and cannot actually deliver reminder SMS.
  (d) Reminder SMS is not launch-ready and should stay on email-only fallback until the plan
      in Reminder-SMS-TFV-Implementation-Plan is 4-AI-approved and shipped.
```

---

## What AI 1 is doing next

1. **Formal AI 1 review** of [[Reminder-SMS-TFV-Implementation-Plan]] landed alongside this file in the same commit — see [[Reminder-SMS-TFV-Plan-AI1-Review]]
2. **In Progress.md**: AI 1's slot in the "Action queue after AI 5 research" flipped from "runbook-delivered, awaiting terminal execution" to "inspection complete — findings captured in this file + AI 1 review of AI 3 plan"
3. **No code changes.** Implementation is still gated on the 4-AI Plan Review Gate closing on the TFV plan, which still needs AI 4 review and Owner approval on Jonathan's Section 5.1 question.

---

## Privacy note

Names, email, phone, and EIN in this file are business-identity data already disclosed to Telnyx, Stripe, and US IRS as part of Vurium Inc's normal incorporation and compliance paperwork. They are not secrets. The EIN matches what Owner entered on the TFV form. If any value here should be redacted, Owner can edit this file — AI 1 will not silently rewrite it.
