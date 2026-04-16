# n8n Execution Artifacts

Execution-first `n8n` artifacts for the approved rollout.

Current phase-1 workflows:

- `AI3_Planning_Intake.workflow.json`
- `AI3_QA_Scan.workflow.json`
- `Gmail_Support_Inbox.workflow.json`
- `Growth_Asset_Flow.workflow.json`

## Required Environment

Set these in `n8n` before running the workflows:

- `VURIUM_API_BASE_URL`
  - example: `https://vuriumbook-api-431945333485.us-central1.run.app`
- `VURIUM_ADMIN_TOKEN`
  - superadmin bearer token for `/api/vurium-dev/**` routes

## Current Backend Endpoints

- `POST /api/vurium-dev/ai/planning-intake`
- `POST /api/vurium-dev/ai/qa-scan`
- `POST /api/vurium-dev/ai/support-inbox-process`
- `POST /api/vurium-dev/ai/support-inbox-execute`
- `POST /api/vurium-dev/ai/growth-asset-flow`

Both endpoints accept either:

1. a plain payload body
2. or the standard envelope:

```json
{
  "meta": {},
  "context": {},
  "payload": {}
}
```

## Trigger Mode

Both workflows now use real `POST` webhook triggers inside `n8n`:

- `AI3_Planning_Intake` -> `.../webhook/ai3-planning-intake`
- `AI3_QA_Scan` -> `.../webhook/ai3-qa-scan`
- `Gmail_Support_Inbox` -> `.../webhook/gmail-support-inbox`

The AI 3 workflows are designed to be called by a queue/status bridge when a task changes stage.

The support workflow is designed to be called by a Gmail trigger bridge, inbound email worker, or any upstream inbox normalizer that can emit one normalized email event.

The growth asset workflow is designed to be called by a campaign request bridge, KPI trigger, or any upstream growth intake normalizer that can emit one structured campaign request.

## Queue Stage Contract

Use the canonical queue stages from [Workflow Queue](/Users/nazarii/Downloads/varium/docs/04-Tasks/Workflow-Queue.md):

- `Ready for Planning` -> planning intake
- `Waiting for QA` -> QA scan

Compatibility note:

- the QA workflow still accepts legacy `Ready for QA` in the incoming payload and normalizes it to canonical `Waiting for QA`

## Support Inbox Contract

`Gmail_Support_Inbox.workflow.json` expects one inbound email event and calls the consolidated AI 9 backend route.

Minimum payload:

```json
{
  "messageId": "gmail-message-id",
  "threadId": "gmail-thread-id",
  "from": "user@example.com",
  "subject": "Need help with booking page",
  "bodyText": "Hello, I cannot find...",
  "bodyHtml": "<p>Hello, I cannot find...</p>",
  "receivedAt": "2026-04-16T14:00:00Z",
  "account": "support@vurium.com"
}
```

It first returns a structured AI 9 decision with:

- classification label
- route lane
- draft reply
- safe-to-send decision
- escalation target

The workflow then calls the execution route, which returns one of:

- `sent_reply`
- `escalated`
- `manual_review_required`

This keeps the `n8n` lane simple:

- AI logic stays in `/api/vurium-dev/ai/support-inbox-process`
- send/escalate gate stays in `/api/vurium-dev/ai/support-inbox-execute`

## Growth Asset Flow Contract

`Growth_Asset_Flow.workflow.json` expects one campaign request event and calls the consolidated growth asset route.

Minimum payload:

```json
{
  "requestId": "GROWTH-022",
  "campaignName": "Spring Signup Push",
  "goal": "Increase barbershop trial signups",
  "audience": "US barbershop owners with small teams",
  "channel": "landing page + social ads",
  "currentOfferLink": "[[Current Offer]]",
  "product_truth_links": [
    "[[Booking Flow MVP Product Brief]]"
  ],
  "approvedClaimsLink": "[[Approved Claims and Angles]]",
  "known_objections": [
    "setup takes too long"
  ],
  "needStaticCreatives": true,
  "needVideoBrief": true
}
```

It returns one combined result with:

- `growth_brief`
- optional `creative_output`
- optional `video_output`
- one top-level `escalate_to`
- one top-level `next_step`

## What These Workflows Do

- accept a queue/status event webhook
- normalize the event into the standard AI envelope
- call the live backend AI decision endpoint
- validate the returned JSON shape
- call the live backend execution endpoint
- emit one structured execution result item that can then be wired into queue writeback, handoff creation, or notifications

## Minimum Incoming Payloads

### Planning intake

```json
{
  "current_stage": "Ready for Planning",
  "task_id": "TASK-123",
  "title": "Improve booking flow SMS consent",
  "description": "Need safer onboarding consent flow for SMS reminders",
  "requested_by": "Owner",
  "complexity": "non-trivial",
  "external_dependency": true,
  "product_context_links": [
    "[[Booking Flow MVP Product Brief]]"
  ],
  "known_constraints": [
    "Must preserve current signup speed"
  ],
  "priority": "high"
}
```

### QA scan

```json
{
  "current_stage": "Waiting for QA",
  "task_id": "TASK-123",
  "plan_link": "[[TASK-123-Plan]]",
  "acceptance_criteria": [
    "Consent copy is explicit"
  ],
  "implementation_summary": [
    "frontend consent checkbox added"
  ],
  "changed_areas": [
    "backend/index.js"
  ],
  "hotfix": false
}
```

## Next Wiring Step

After import:

1. point your queue/status emitter at the correct webhook path
2. wire the last node into your writeback path:
   - queue update
   - handoff note
   - Owner notification
   - next-owner notification

These artifacts intentionally stop before file/database mutation so they stay version-tolerant and easy to adapt.
