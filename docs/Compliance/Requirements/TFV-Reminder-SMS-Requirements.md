---
type: compliance-requirement
status: active
priority: p0
owner: AI 7
created: 2026-04-15
updated: 2026-04-15
source_of_truth: true
sources:
  - "[[Tasks/AI5-Research-Brief-Reminder-SMS]]"
  - "[[Tasks/TFV-Inspection-Result-2026-04-15]]"
  - "[[Tasks/Reminder-SMS-TFV-Implementation-Plan-v2]]"
---

# Compliance Requirements — TFV Reminder SMS

> [[Home]] > [[Compliance/Requirements/README|Compliance Requirements]] | Sources: [[Tasks/AI5-Research-Brief-Reminder-SMS|AI 5 Research Brief]], [[Tasks/TFV-Inspection-Result-2026-04-15|TFV Inspection Result]], [[Tasks/Reminder-SMS-TFV-Implementation-Plan-v2|AI 3 Plan v2]]
> Translated by: AI 7 (Compliance Executor) | 2026-04-15
> Vendor: Telnyx | See also: [[Compliance/Vendor-Constraints/Telnyx-TFV|Telnyx TFV Vendor Constraints]]

---

## Purpose

This document translates AI 5 source-backed research and AI 1 live portal inspection into binding implementation requirements. AI 3 and implementing AIs (AI 1 backend, AI 2 frontend) use this as the compliance-side checklist. Nothing in this document is original research — every requirement traces to a fact or inference in the AI 5 brief or TFV inspection result.

---

## Binding Constraint

**No reminder SMS may be sent from a workspace toll-free number unless that number's TFV status is `Verified`.**

Source: AI 5 Brief § 1 — "No official Telnyx source says that purchase + profile attachment alone makes a toll-free sender launch-ready." AI 5 Brief § 5 — "The only clearly positive TFV state across official sources is `Verified`."

This constraint is non-negotiable. All requirements below flow from it.

---

## SYS — System Requirements

### SYS.1 — Status lifecycle must reflect real carrier state

The `sms_registration_status` field must distinguish between "configured" (number purchased + profile attached) and "carrier-approved" (`Verified`). The following statuses are required:

| Status | Meaning | SMS sending allowed |
|---|---|---|
| `none` | No SMS setup | No |
| `provisioning` | Number purchase in progress | No |
| `configured` | Number + profile + STOP/HELP ready, awaiting business data for TFV | No |
| `tfv_pending` | TFV submitted, awaiting Telnyx/carrier review (1-7 business days) | No |
| `tfv_rejected` | TFV rejected — must fix and resubmit | No |
| `tfv_submit_failed` | TFV API submission failed after max retries | No |
| `active` | TFV = `Verified` | **Yes** |
| `failed` / `failed_max_retries` | Provision error | No |

Source: AI 5 Brief § 5 — status states; AI 5 Brief § 3 — configuration alone is not delivery readiness.

### SYS.2 — Per-workspace TFV architecture

Each workspace toll-free number requires its own TFV coverage matching that workspace's business identity and use case. Platform-level / ISV TFV is not viable — empirically rejected twice (campaign `CKAOXOW` code 710; TFV request `e23146a2` rejected for BRN).

Source: AI 5 Brief § 1 inference — "each dedicated workspace number should be treated as needing TFV coverage"; TFV Inspection Result — Concern 2.

### SYS.3 — Pattern B (Sole Proprietor) as default TFV path

TFV submissions for new workspaces must use the Sole Proprietor path (no EIN / BRN fields). This avoids the `Business Registration Number Is Missing or Invalid` rejection class.

Workspaces that have an EIN may optionally use Pattern A (with BRN fields) in future — but Pattern B is the safe default that unblocks launch for all workspace types including sole proprietors.

Source: TFV Inspection Result — Concern 3 (Options A/B/C analysis); AI 3 Plan v2 adopted Pattern B.

### SYS.4 — Element Barbershop exclusion

Element Barbershop remains on the grandfathered manual 10DLC path. No TFV code, no status migration, no auto-provisioning may touch Element's workspace. Element's `sms_registration_status` must remain unchanged after any TFV-related deploy.

Source: AI 5 Brief — Owner context; AI 3 Plan v2 § 8.

---

## BE — Backend Requirements

### BE.1 — Provisioning must write `configured`, not `active`

`provisionTollFreeSmsForWorkspace()` must set `sms_registration_status: 'configured'` after successful number purchase + profile attachment. Writing `active` at this point is a compliance violation because the number is not yet `Verified`.

Source: AI 5 Brief § 1, § 3 — "attached to messaging profile" proves only configuration, not carrier-approved readiness.

### BE.2 — TFV submission gate on business data completeness

TFV submission must not occur until workspace has all required fields populated:
- `shop_name` (maps to TFV `businessName`)
- `shop_address` (maps to TFV business address)
- `shop_phone` (maps to TFV `businessContactPhone`)
- `shop_email` (maps to TFV `businessContactEmail`)
- `sms_from_number` (maps to TFV `phoneNumbers`)
- `sms_registration_status === 'configured'`

TFV must be triggered from `POST /api/settings` after settings save, not at signup.

Source: TFV Inspection Result — Concern 3 (payload mapping); AI 5 Brief § 4 — TFV fields must match business identity.

### BE.3 — TFV payload must match workspace identity

| TFV Field | Source | Compliance rule |
|---|---|---|
| `businessName` | `shop_name` | Must be the workspace business name, not "Vurium Inc" |
| `corporateWebsite` | Per-workspace booking URL | Must be the workspace's public booking page, not `vurium.com` root |
| `businessContactEmail` | `shop_email` | Must be the workspace's business email |
| `businessContactPhone` | `shop_phone` | Must be the workspace's business phone |
| `useCase` | `'Appointments'` | Valid Telnyx enum per AI 5 Brief § 4 |
| `useCaseSummary` | Dynamic per workspace | Must describe that specific business sending appointment SMS to opted-in clients |
| `sampleMessage1`, `sampleMessage2` | Dynamic per workspace | Must use `{shop_name}:` prefix, not "VuriumBook:" |
| `optInWorkflowDescription` | Dynamic per workspace | Must reference the workspace's booking page URL |
| `privacyPolicyUrl` | `https://vurium.com/privacy` | Platform-level privacy policy |
| `termsAndConditionsUrl` | `https://vurium.com/terms` | Platform-level terms |

**Must NOT include**: `businessRegistrationNumber`, `businessRegistrationType`, `businessRegistrationIssuingCountry` (Pattern B — Sole Proprietor path).

**Must NOT include**: `ISV Reseller` flag or "on behalf of businesses" language.

Source: TFV Inspection Result — nine additional facts (ISV flag, on-behalf-of language, Element address mismatch all caused rejection); AI 5 Brief § 4 — CTA/consent matching requirements.

### BE.4 — Sending guard must block non-`active` statuses

`getWorkspaceSmsConfig()` must treat only `active` (and legacy `verified`) as send-eligible. All new statuses (`configured`, `tfv_pending`, `tfv_rejected`, `tfv_submit_failed`) must result in `canSend = false`.

Source: AI 5 Brief § 1 — only `Verified` means delivery-ready; § 5 — `40329` error for non-verified.

### BE.5 — TFV webhook handler required

The webhook handler (`/api/webhooks/telnyx-10dlc`) must process TFV status events:
- `verified` / `Verified` → set `sms_registration_status: 'active'`
- `rejected` / `Rejected` → set `sms_registration_status: 'tfv_rejected'` + store rejection reason

Webhook is the primary signal. Polling is the safety net.

Source: AI 5 Brief § 2 — Telnyx documents TFV webhook events; § 5 — only `Verified` is positive.

### BE.6 — Polling safety net at 30-minute intervals

A polling job must check TFV status for all `tfv_pending` workspaces every 30 minutes via `GET /v2/messaging_tollfree/verification/requests/{tfvId}`. TFV review takes 1-7 business days — polling more frequently (e.g., 3 minutes) is wasteful.

Source: AI 5 Brief § 5 — review timeline; AI 3 Plan v2 § 4.1.

### BE.7 — TFV submission retry with exponential backoff

If TFV API submission fails, retry with exponential backoff (5m, 15m, 1h, 4h, 24h). After 5 failed attempts, set `sms_registration_status: 'tfv_submit_failed'`.

Source: AI 5 Brief § 2 — "no limit on resubmissions"; AI 3 Plan v2 § 2.1.

### BE.8 — Atomic Firestore writes for TFV state transitions

All TFV-related Firestore updates must use single `set({...}, { merge: true })` calls. No multi-step writes that could leave status and metadata out of sync.

Source: AI 3 Plan v2 — AI 1 Improvement 3.

### BE.9 — TFV resubmission endpoint for rejected workspaces

`POST /api/sms/resubmit-tfv` (owner-only) must allow resubmission for workspaces in `tfv_rejected` status. Must use `PATCH` on existing TFV request. Must transition `tfv_rejected` → `tfv_pending`. Must write audit log.

Source: AI 5 Brief § 2 — Telnyx allows unlimited resubmissions + update/resubmit API; AI 3 Plan v2 § 2.3.

### BE.10 — Admin force-status endpoint

`POST /api/vurium-dev/sms/force-status` (superadmin-only) must allow manual status override for rollback/unsticking. Allowed values: `none`, `configured`, `tfv_pending`, `active`, `tfv_rejected`, `tfv_submit_failed`, `failed`. Must write audit log.

Source: AI 3 Plan v2 § 6.

---

## UI — Frontend / UX Requirements

### UI.1 — Status-aware SMS notifications UI

Each `sms_registration_status` value must have distinct, accurate UI copy:

| Status | Label | UX behavior |
|---|---|---|
| `not_enabled` | SMS not set up | Info text |
| `provisioning` | Setting up your dedicated SMS number... | Spinner |
| `configured` | Number assigned — complete your business profile to activate SMS | CTA → Business Profile |
| `tfv_pending` | Carrier verification in progress (typically 1-7 business days) | Progress indicator, no manual toggle |
| `tfv_rejected` | SMS verification needs attention | Warning + "Review and Resubmit" CTA |
| `active` | SMS active — appointment reminders will be sent | Green checkmark |
| `failed` | SMS setup failed | Error + retry button |

Source: AI 5 Brief § 5 — only `Verified` is positive; all other states must not suggest SMS is working.

### UI.2 — Remove stale copy

Remove any UI text that implies SMS is automatically ready after number purchase:
- Remove "SMS usually turns on automatically"
- Remove "No EIN is required for this default path"
- Replace with: "SMS activates after your business info is verified by carriers"

Source: AI 5 Brief § 1 — purchase + profile alone is not launch-ready.

### UI.3 — `tfv_rejected` must not suggest switching to manual 10DLC

The rejection UX must say: "Your toll-free number is ready, but carrier verification was not approved. Please review your business details and resubmit."

Must NOT show "Switch to manual 10DLC registration" — that is a different path for grandfathered workspaces only.

Source: AI 3 Plan v2 § 7.4; TFV Inspection Result — architectural separation.

### UI.4 — Block manual SMS toggle during `tfv_pending`

When workspace is in `tfv_pending`, manual enable/disable toggle must be disabled. Only status card is shown.

Source: AI 3 Plan v2 § 7.6 — no user action possible during carrier review.

### UI.5 — Consent checkbox compliance requirements

The SMS consent checkbox on the booking page must meet all of the following:

| Requirement | Source |
|---|---|
| Optional (not required to complete booking) | AI 5 Brief § 4 — "SMS checkbox must be optional" |
| Unchecked by default | AI 5 Brief § 4 — "unchecked by default" |
| Separate from email / other consents | AI 5 Brief § 4 — "SMS consent must be separate" |
| Uses workspace business name (not "VuriumBook") | AI 5 Brief § 4 — "branded with the same brand being registered" |
| Mentions STOP to opt out | AI 5 Brief § 4 — STOP disclosure |
| Mentions HELP for help | AI 5 Brief § 4 — HELP disclosure |
| Mentions message & data rates may apply | AI 5 Brief § 4 — rates disclosure |
| Mentions message frequency (e.g. "up to 5 per booking") | AI 5 Brief § 4 — frequency disclosure |
| Links to Privacy Policy | AI 5 Brief § 4 — privacy policy link required |
| Links to Terms of Service | AI 5 Brief § 4 — terms link required |
| Consent is not a condition of purchase | AI 5 Brief § 4 — optional checkbox |

### UI.6 — Developer panel TFV-aware grouping

`app/developer/sms/page.tsx` must group workspaces by TFV state:
- `verifiedSenders` (active)
- `pendingVerification` (tfv_pending, configured)
- `rejectedVerification` (tfv_rejected, tfv_submit_failed)

`configured` workspaces with a number must show as "Awaiting Verification", not "Configured Sender".

Source: AI 3 Plan v2 § 7.5.

---

## DOC — Documentation Requirements

### DOC.1 — Privacy Policy SMS section wording

The privacy policy at `vurium.com/privacy` must include language that covers:
- SMS communications description (appointment confirmations, reminders)
- Opt-in mechanism description
- Opt-out instructions (Reply STOP)
- Help instructions (Reply HELP)
- Message frequency disclosure
- Data rates disclosure
- Statement that mobile information will not be shared or sold for promotional/marketing purposes

Source: AI 5 Brief § 4 — "privacy-policy wording expectations around not sharing or selling mobile information."

### DOC.2 — Terms of Service SMS section

The terms at `vurium.com/terms` must include SMS program terms covering the same disclosures as DOC.1.

Source: AI 5 Brief § 4 — TFV submission requires `termsAndConditionsUrl`.

### DOC.3 — First-message disclaimer structure

The first SMS message sent to a new opt-in recipient should include:
- Brand name (workspace `shop_name`)
- Use case context (appointment confirmation/reminder)
- `Reply STOP to opt out`
- `Reply HELP for help`
- Message & data rates disclosure
- Frequency disclosure

Source: AI 5 Brief § 4 — "required disclaimer structure before the first message."

### DOC.4 — Sample messages must match actual traffic

TFV sample messages must reflect the actual SMS content the system sends. If reminder text format changes in code, TFV samples must be updated on next resubmission.

Source: AI 5 Brief § 4 — "Sample messages and use-case summary must match the opt-in flow and actual traffic."

---

## MON — Monitoring Requirements

### MON.1 — Track TFV status transitions

Log all TFV status transitions (webhook and poll) with timestamp, workspace ID, previous status, new status, and rejection reason if applicable.

Source: AI 5 Brief § 2 — API supports status-history retrieval; AI 3 Plan v2 § 3.

### MON.2 — Alert on Telnyx error codes

Backend must detect and log the following Telnyx error codes from send attempts:
- `40329` — toll-free not verified (should never occur if sending guard works)
- `40330` — toll-free not provisioned
- `40305` — not associated with messaging profile
- `40331` — destination whitelist missing
- `40333` — spend limit reached

If `40329` is ever observed in production, it means the sending guard (BE.4) has a bug.

Source: AI 5 Brief § 3 — error code reference.

### MON.3 — Post-verification ramp-up awareness

After a workspace reaches `Verified` / `active`, the first 1-2 weeks of sending should be treated as ramp-up. Telnyx warns that "some carriers may still filter newly verified toll-free traffic." No system enforcement is required, but operational awareness is needed.

Source: AI 5 Brief § 5 — "start lower and ramp up gradually over 1-2 weeks."

### MON.4 — Per-recipient message frequency limit

Telnyx guidance: do not send more than 10 messages to a single recipient in any 24-hour period unless the recipient is in active two-way communication or has explicitly opted in to higher frequency. For appointment reminders (confirmation + 24h + 2h = 3 messages per booking), this is well within limits, but must be monitored if message types expand.

Source: AI 5 Brief § 5 — "10 messages to a recipient in any 24-hour period."

### MON.5 — STOP/HELP live verification per workspace

After each workspace reaches `active`, STOP and HELP must be live-tested (not assumed from profile attachment). Carrier-level toll-free STOP includes a network-controlled response path that cannot be suppressed.

Source: AI 5 Brief § 5 — "STOP must be verified by live test on a real toll-free sender."

### MON.6 — Messaging profile isolation

Each workspace number should have a dedicated messaging profile to ensure STOP opt-out scope does not bleed across workspaces. If multiple workspace numbers share one messaging profile, a STOP from one workspace's client could block sends from another workspace's number on the same profile.

Source: AI 5 Brief § 5 — "If multiple workspace numbers ever share one messaging profile, STOP scope may bleed across the profile."

---

## OWN — Owner Action Requirements

### OWN.1 — Business data completeness per workspace

Owner (or workspace admin) must fill `shop_name`, `shop_address`, `shop_phone`, `shop_email` in Settings before TFV can be submitted. Incomplete business data blocks TFV submission by design (BE.2).

### OWN.2 — Live pilot protocol

Before broad rollout, Owner must complete a live pilot on one fresh workspace:
1. Create workspace, fill Business Profile
2. Verify auto-provision → `configured`
3. Save Settings → verify TFV submitted → `tfv_pending`
4. Check Telnyx Portal → confirm per-workspace TFV request exists
5. Wait for `Verified` (1-7 business days)
6. Verify Firestore → `active`
7. Create booking with SMS consent → verify SMS delivered
8. Send STOP → verify opt-out works
9. Send HELP → verify help response
10. Verify email-only fallback for non-`active` workspaces
11. Verify Element unchanged

Source: AI 3 Plan v2 § 9.

### OWN.3 — Element Barbershop manual protection

Owner must verify after every TFV-related deploy that Element's `sms_registration_status` has not changed. Element stays on manual 10DLC path.

### OWN.4 — Rejected TFV requests require investigation before resubmission

When a workspace TFV is rejected, Owner must review the rejection reason and update workspace data before resubmitting. Do not auto-resubmit rejected TFVs without human review.

Source: AI 5 Brief § 2 — "no limit on resubmissions after fixing issues"; TFV Inspection Result — "Treating this as one-field fix is a trap."

### OWN.5 — Historical TFV request `e23146a2` disposition

The existing rejected TFV request `e23146a2` (platform-level Vurium Inc submission) must be left as dead historical state. It must not be resubmitted or repurposed. New per-workspace TFV requests are created from scratch.

Source: TFV Inspection Result — Concern 2, recommendation (c).

---

## Source Truth Hierarchy

When official Telnyx sources conflict, use this hierarchy (per AI 5 Brief § 6):

1. **Live TFV object state** in Telnyx Portal or TFV API for the exact number = operational source of truth
2. **API reference + messaging error docs** = enforceable runtime / contract truth
3. **Help Center TFV / toll-free compliance guides** = policy / review-truth for CTA, opt-in, submission
4. **Generic comparison or marketing-style docs** = background only

When sources conflict, apply the stricter interpretation. Treat unverified as not launch-ready.

Source: AI 5 Brief § 6.
