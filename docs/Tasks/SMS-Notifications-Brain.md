---
type: brain
status: active
priority: p0
owner: AI 3
created: 2026-04-17
updated: 2026-04-17
topic: sms-notifications
working_memory: true
---

# SMS / Notifications Brain

> [[Home]] > [[Tasks/In Progress|In Progress]]
> Canonical stack: [[Tasks/SMS Finalization Plan|SMS Finalization Plan]], [[Tasks/Reminder-SMS-TFV-Implementation-Plan-v2|TFV Implementation Plan v2]], [[Tasks/Reminder-SMS-Launch-Completion|Launch Completion]], [[Compliance/Requirements/TFV-Reminder-SMS-Requirements|TFV Reminder SMS Requirements]], [[Features/SMS & 10DLC|SMS & 10DLC]]
> Supporting evidence: [[Tasks/AI5-Research-Brief-Reminder-SMS|AI 5 Research Brief]], [[Tasks/TFV-Inspection-Result-2026-04-15|TFV Inspection Result]], [[Tasks/Live-SMS-Verification-Checklist|Live SMS Verification Checklist]]

## Purpose

This note is the current working-memory hub for `SMS / notifications / reminder SMS / TFV / Telnyx` inside VuriumBook.

Owner Copilot should read this note first for broad status questions before opening a new task or inventing a new plan.

## Current verdict

- The reminder SMS code path already exists.
- The system is **not launch-complete yet**.
- The real blocker is no longer "build reminder SMS from scratch."
- The real blocker is **truthful readiness**:
  - per-workspace TFV / carrier approval
  - accurate lifecycle statuses (`configured` vs `tfv_pending` vs `active`)
  - one real fresh-workspace pilot proving confirmations + reminders + STOP + HELP

## Current source-of-truth stack

### 1. Execution order and ownership

- [[Tasks/SMS Finalization Plan|SMS Finalization Plan]]
- Use this as the top-level owner/AI split and launch gate.

### 2. Implementation plan

- [[Tasks/Reminder-SMS-TFV-Implementation-Plan-v2|Reminder-SMS-TFV-Implementation-Plan-v2]]
- Use this as the main implementation plan.
- Do not create a brand-new SMS plan unless scope materially changes.

### 3. Compliance and vendor truth

- [[Compliance/Requirements/TFV-Reminder-SMS-Requirements|TFV Reminder SMS Requirements]]
- [[Tasks/AI5-Research-Brief-Reminder-SMS|AI 5 Research Brief]]
- [[Tasks/TFV-Inspection-Result-2026-04-15|TFV Inspection Result]]

### 4. Launch gate and live proof

- [[Tasks/Reminder-SMS-Launch-Completion|Reminder-SMS Launch Completion]]
- [[Tasks/Live-SMS-Verification-Checklist|Live SMS Verification Checklist]]

## What is already known

- New reminder senders use the toll-free-first path.
- The code already schedules and attempts reminder SMS.
- The backend currently risks overstating readiness if `active` means "customer-delivery ready" before TFV is really verified.
- AI 5 research already established that `Verified` is the only clearly positive TFV-ready state.
- AI 1 portal inspection already captured a real rejected TFV request and the exact failure mode.

## What still blocks completion

1. **TFV / carrier approval is not fully closed**
   - reminder senders need the correct TFV path
   - rejected / pending states must be handled truthfully

2. **Status semantics still need to match reality**
   - `configured` must not be treated like `active`
   - the product must only show true readiness when the sender is actually ready

3. **Live proof is still missing**
   - one fresh workspace must receive:
     - booking confirmation SMS
     - reminder SMS
     - correct STOP behavior
     - correct HELP behavior

## Current recommended execution path

1. Use [[Tasks/Reminder-SMS-TFV-Implementation-Plan-v2|TFV Implementation Plan v2]] as the main implementation plan.
2. Use [[Tasks/SMS Finalization Plan|SMS Finalization Plan]] as the owner / AI sequencing layer.
3. Use [[Compliance/Requirements/TFV-Reminder-SMS-Requirements|TFV Reminder SMS Requirements]] as the binding compliance checklist.
4. Use [[Tasks/Reminder-SMS-Launch-Completion|Launch Completion]] and [[Tasks/Live-SMS-Verification-Checklist|Live SMS Verification Checklist]] as the last-mile verification gate.

## Immediate next action

The next practical step is **not** to invent another SMS plan.

The next practical step is:

- consolidate the existing SMS plans into one execution checklist,
- finish the TFV / status / send-guard path,
- then run one real pilot and sign off the result.

## Recent operational thread

- [[04-Tasks/TASK-20260417120223-fix-notifications-delivery-issue-SMS-reminders..md|Fix notifications delivery issue — SMS reminders]]
- [[04-Tasks/TASK-20260417120223-Plan|Fix notifications delivery issue — Plan]]
- [[04-Tasks/TASK-20260417120452-SMS|SMS status request]]
- [[04-Tasks/TASK-20260417120452-Plan|SMS status request — Plan]]

## Owner Copilot rule

For owner questions like:

- "що нам треба для закінчення sms"
- "який зараз статус по sms"
- "на який план спираємось"
- "що ще блокує notifications"

Owner Copilot should:

1. read this brain note first,
2. summarize the current blocker and current next action,
3. cite the canonical plans above,
4. only open a new task when the owner explicitly says to start execution or when the existing plans are insufficient.
