# AI5 Research Brief — Reminder SMS Launch

> [[Home]] > Tasks | Related: [[Tasks/Reminder-SMS-Launch-Completion]], [[Features/SMS & 10DLC]], [[Tasks/Telnyx-Integration-Plan]]
> Created: 2026-04-15

## Why this research exists

We need to finish appointment reminder SMS so the team can say with confidence that reminder sending is truly launch-ready, not only code-complete.

## Decision(s) blocked on external facts

- Whether the current per-workspace Telnyx toll-free path is already truly delivery-ready for US appointment reminders
- Whether each reminder sender requires TFV or another carrier-side verification step
- Whether our backend status `sms_registration_status: active` matches real Telnyx reminder readiness

## Questions from AI 1

- For Telnyx US reminder traffic on a dedicated toll-free number per workspace, is buying the number + attaching a messaging profile enough for deliverability, or is TFV still required before real reminder sends should be considered live?
- If TFV is required, can it be submitted through API or only through the portal / manual ops?
- Is there any official Telnyx guidance on whether autoresponse setup + messaging profile attachment still leaves the number in a blocked or filtered state until TFV is approved?

## Questions from AI 2

- Is our current product wording safe if the backend marks a sender `active` immediately after provisioning, or does official Telnyx guidance imply we should expose a softer state until TFV / live-delivery proof exists?
- For a per-workspace customer-care reminder model, what exact official wording or constraints does Telnyx expect us to follow for toll-free reminder traffic?

## Questions from AI 3

- What exact evidence should count as “research complete” before I turn this into a final implementation / verification plan?
- Which official source should the team treat as the final authority if Telnyx docs, support articles, and portal behavior differ?

## Questions from AI 4

- If reminder SMS is partially configured but not truly deliverable, what is the correct emergency-safe fallback posture: hold at email-only, or allow limited SMS sends?

## Owner context / constraints

- Element Barbershop remains on the grandfathered manual 10DLC path and must not be auto-migrated.
- OTP / verification sender has already been separated from reminder sender using `TELNYX_VERIFY_FROM`.
- The team wants the smallest correct path to live reminder SMS, not a speculative architecture rewrite.

## AI 5 findings

- Pending

## Sources

- Pending

## Hand-off to AI 3 planner

- Pending

