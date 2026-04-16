# n8n Execution Artifacts

Execution-first `n8n` artifacts for the approved rollout.

Current phase-1 workflows:

- `AI3_Planning_Intake.workflow.json`
- `AI3_QA_Scan.workflow.json`
- `Gmail_Support_Inbox.workflow.json`

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

It returns a structured AI 9 decision with:

- classification label
- route lane
- draft reply
- safe-to-send decision
- escalation target
- a prebuilt `gmail_reply_request` object when safe send is allowed

## What These Workflows Do

- accept a queue/status event webhook
- normalize the event into the standard AI envelope
- call the live backend AI endpoint
- validate the returned JSON shape
- emit one structured result item that can then be wired into queue writeback, handoff creation, or notifications

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
