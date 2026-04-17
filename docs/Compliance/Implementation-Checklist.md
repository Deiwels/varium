---
type: task
status: active
created: 2026-04-15
owner: AI 7
---

# Compliance Implementation Checklist

> Part of [[Home]] > Compliance | See also: [[Compliance/Control-Matrix|Compliance Control Matrix]], [[Compliance/Requirements/README|Compliance Requirements]], [[Tasks/In Progress|In Progress]]

## Purpose

Execution-side checklist for AI 7 translations before AI 3 planning and before launch-sensitive implementation.

## Checklist Shape

Each section below maps to a requirement category. Items reference [[Compliance/Requirements/TFV-Reminder-SMS-Requirements|TFV Requirements]] IDs.

---

## TFV Reminder SMS — Implementation Checklist

Execution plan: [[Tasks/Reminder-SMS-TFV-Implementation-Plan-v2|AI 3 Plan v2]]
Requirements: [[Compliance/Requirements/TFV-Reminder-SMS-Requirements|TFV Requirements]]

### System Requirements

- [x] **SYS.1** — Status lifecycle implemented: `none` → `provisioning` → `configured` → `tfv_pending` → `active` (and error branches `tfv_rejected`, `tfv_submit_failed`, `failed`)
- [ ] **SYS.2** — Per-workspace TFV architecture confirmed (no platform-level ISV submissions)
- [ ] **SYS.3** — Pattern B (Sole Proprietor, no BRN fields) used as default TFV path
- [ ] **SYS.4** — Element Barbershop exclusion verified (status unchanged after deploy)

### Backend Requirements

- [x] **BE.1** — `provisionTollFreeSmsForWorkspace()` writes `configured`, not `active`
- [x] **BE.2** — TFV submission gated on `shop_name && shop_address && shop_phone && shop_email && sms_from_number && status === 'configured'`
- [x] **BE.3** — TFV payload uses per-workspace identity (`shop_name`, workspace booking URL, `shop_email`, `shop_phone`); no ISV flag; no "on behalf of" language
- [x] **BE.4** — `getWorkspaceSmsConfig()` blocks sending for all non-`active` statuses
- [x] **BE.5** — Webhook handler processes TFV events (`verified` → `active`, `rejected` → `tfv_rejected`)
- [x] **BE.6** — Polling job runs every 30 min for `tfv_pending` workspaces
- [x] **BE.7** — TFV submission retry: exponential backoff (5m→15m→1h→4h→24h), max 5 attempts → `tfv_submit_failed`
- [x] **BE.8** — All TFV Firestore writes use single atomic `set({...}, { merge: true })`
- [x] **BE.9** — `POST /api/sms/resubmit-tfv` endpoint for `tfv_rejected` workspaces (owner-only, audit log)
- [ ] **BE.10** — `POST /api/vurium-dev/sms/force-status` admin endpoint (superadmin-only, audit log)

### UI Requirements

- [ ] **UI.1** — `getSmsUxState()` returns correct state for all new statuses; SMS Notifications UI shows per-status copy
- [ ] **UI.2** — Stale copy removed ("SMS usually turns on automatically", "No EIN required")
- [ ] **UI.3** — `tfv_rejected` UX says "fix and resubmit TFV", not "switch to 10DLC"
- [ ] **UI.4** — Manual SMS toggle disabled during `tfv_pending`
- [ ] **UI.5** — Booking consent checkbox: unchecked default, SMS-only, branded with `{shop_name}`, STOP/HELP/rates/frequency/privacy/terms disclosures
- [ ] **UI.6** — Developer panel groups workspaces by TFV state; `configured` shows as "Awaiting Verification"

### Documentation Requirements

- [ ] **DOC.1** — `vurium.com/privacy` SMS section includes: opt-in description, opt-out (STOP), HELP, frequency, rates, no-sharing/no-selling mobile data language
- [ ] **DOC.2** — `vurium.com/terms` SMS section includes matching disclosures
- [ ] **DOC.3** — First-message disclaimer template includes: brand name, use case, STOP, HELP, rates, frequency, terms link, privacy link
- [ ] **DOC.4** — Sample messages in TFV submissions match actual SMS content sent by system

### Monitoring Requirements

- [ ] **MON.1** — TFV status transitions logged (timestamp, workspace ID, old status, new status, rejection reason)
- [ ] **MON.2** — Telnyx error codes `40329`/`40330`/`40305`/`40331`/`40333` detected and logged
- [ ] **MON.3** — Post-verification ramp-up awareness documented (1-2 weeks)
- [ ] **MON.4** — Per-recipient 10 msg/24h limit awareness (current 3/booking is safe, monitor if types expand)
- [ ] **MON.5** — STOP + HELP live-tested per workspace after reaching `active`
- [ ] **MON.6** — Messaging profile isolation verified (dedicated profile per workspace, no STOP scope bleed)

### Owner Action Requirements

- [ ] **OWN.1** — Business data completeness: `shop_name`, `shop_address`, `shop_phone`, `shop_email` filled per workspace
- [ ] **OWN.2** — Live pilot: one fresh workspace completes full cycle (provision → TFV → Verified → SMS delivered → STOP → HELP → email fallback → Element unchanged)
- [ ] **OWN.3** — Element Barbershop status verified unchanged after every TFV deploy
- [ ] **OWN.4** — Rejected TFVs reviewed by human before resubmission (no auto-resubmit)
- [ ] **OWN.5** — Historical TFV `e23146a2` left as dead state, not resubmitted
