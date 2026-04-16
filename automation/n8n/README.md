# n8n Execution Artifacts

Execution-first `n8n` artifacts for the approved rollout.

Current phase-1 workflows:

- `AI3_Planning_Intake.workflow.json`
- `AI3_QA_Scan.workflow.json`
- `Gmail_Support_Inbox.workflow.json`
- `Growth_Asset_Flow.workflow.json`
- `Research_Brief.workflow.json`

Local setup helpers:

- `.env.example`
- `smoke-tests/*.payload.json`

## Required Environment

Set these in `n8n` before running the workflows:

- `VURIUM_API_BASE_URL`
  - example: `https://vuriumbook-api-431945333485.us-central1.run.app`
- `VURIUM_ADMIN_TOKEN`
  - superadmin bearer token for `/api/vurium-dev/**` routes

Optional local execution helpers:

- `VURIUM_OBSIDIAN_ROOT`
  - absolute docs path if your self-hosted `n8n` writes directly into the Obsidian repo
- `VURIUM_OWNER_EMAIL`
  - destination for high-risk or blocked workflow notifications
- `VURIUM_SUPPORT_MAILBOX`
  - useful if you add email notification nodes in the final mile

Use [`.env.example`](/Users/nazarii/Downloads/varium/automation/n8n/.env.example) as the starter file.

## Import in n8n

Use this exact order:

1. Open `n8n`.
2. Import the workflow JSON file from `automation/n8n/`.
3. Set `VURIUM_API_BASE_URL` and `VURIUM_ADMIN_TOKEN` in the `n8n` environment.
4. Open the imported workflow and confirm the webhook path matches the filename intent.
5. Run one smoke test payload against the webhook before connecting any real trigger.
6. Only after a passing smoke test, wire the upstream real trigger.

Recommended import order:

1. `AI3_Planning_Intake.workflow.json`
2. `AI3_QA_Scan.workflow.json`
3. `Gmail_Support_Inbox.workflow.json`
4. `Growth_Asset_Flow.workflow.json`
5. `Research_Brief.workflow.json`

## Current Backend Endpoints

- `POST /api/vurium-dev/ai/planning-intake`
- `POST /api/vurium-dev/ai/qa-scan`
- `POST /api/vurium-dev/ai/support-inbox-process`
- `POST /api/vurium-dev/ai/support-inbox-execute`
- `POST /api/vurium-dev/ai/growth-asset-flow`
- `POST /api/vurium-dev/ai/research-brief`

All AI execution endpoints accept either:

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

These workflows use real `POST` webhook triggers inside `n8n`:

- `AI3_Planning_Intake` -> `.../webhook/ai3-planning-intake`
- `AI3_QA_Scan` -> `.../webhook/ai3-qa-scan`
- `Gmail_Support_Inbox` -> `.../webhook/gmail-support-inbox`
- `Growth_Asset_Flow` -> `.../webhook/growth-asset-flow`
- `Research_Brief` -> `.../webhook/research-brief`

The AI 3 workflows are designed to be called by a queue/status bridge when a task changes stage.

The support workflow is designed to be called by a Gmail trigger bridge, inbound email worker, or any upstream inbox normalizer that can emit one normalized email event.

The growth asset workflow is designed to be called by a campaign request bridge, KPI trigger, or any upstream growth intake normalizer that can emit one structured campaign request.

The research workflow is designed to be called by an AI 3 planning handoff, external-dependency tag bridge, or any upstream research intake normalizer that can emit one structured research request with explicit official source URLs.

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

## Research Brief Contract

`Research_Brief.workflow.json` expects one research intake event and calls the AI 5 backend route.

Minimum payload:

```json
{
  "researchId": "R-203",
  "taskId": "TASK-123",
  "topic": "SMS consent wording requirements for booking reminders",
  "questions": [
    "What kind of consent language is required?",
    "What opt-out wording is required?"
  ],
  "target_sources": [
    "official vendor docs",
    "official policy docs"
  ],
  "related_links": [
    "[[Booking Flow MVP Product Brief]]"
  ],
  "sourceUrls": [
    "https://example.com/official-doc"
  ]
}
```

Important:

- AI 5 only produces source-backed findings from explicit `sourceUrls`
- if no official source URLs are provided, the workflow returns a structured `queued` result instead of inventing research
- if all provided sources fail to fetch, the workflow returns `blocked`

It returns:

- `facts`
- `inferences`
- `open_questions`
- `source_summary`
- `escalate_to`
- `next_step`

## What These Workflows Do

- accept one structured webhook event from the relevant upstream trigger
- normalize the event into the standard AI envelope
- call the live backend AI endpoint for that lane
- validate the returned JSON shape
- optionally call a follow-up execution endpoint when the lane uses a split `process -> execute` contract
- emit one structured result item that can then be wired into queue writeback, handoff creation, or notifications

## Smoke Tests

Use these fixtures for the first pass:

- [ai3-planning-intake.payload.json](/Users/nazarii/Downloads/varium/automation/n8n/smoke-tests/ai3-planning-intake.payload.json)
- [ai3-qa-scan.payload.json](/Users/nazarii/Downloads/varium/automation/n8n/smoke-tests/ai3-qa-scan.payload.json)
- [gmail-support-inbox.payload.json](/Users/nazarii/Downloads/varium/automation/n8n/smoke-tests/gmail-support-inbox.payload.json)
- [growth-asset-flow.payload.json](/Users/nazarii/Downloads/varium/automation/n8n/smoke-tests/growth-asset-flow.payload.json)
- [research-brief.with-sources.payload.json](/Users/nazarii/Downloads/varium/automation/n8n/smoke-tests/research-brief.with-sources.payload.json)
- [research-brief.without-sources.payload.json](/Users/nazarii/Downloads/varium/automation/n8n/smoke-tests/research-brief.without-sources.payload.json)

Expected first-pass outcomes:

- `AI3_Planning_Intake` -> structured planning output, usually with `AI-5` or `AI-7` escalation when dependencies exist
- `AI3_QA_Scan` -> `pass`, `fail`, or `needs_review`
- `Gmail_Support_Inbox` -> `sent_reply`, `escalated`, or `manual_review_required`
- `Growth_Asset_Flow` -> combined brief and asset draft package
- `Research_Brief` with sources -> source-backed findings or partial result
- `Research_Brief` without sources -> `queued`

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

## Last-Mile Wiring

Add these nodes after the final validation node in each workflow:

1. `If`
   - branch on `escalate_to !== "none"` or blocked/manual-review states
2. `Code`
   - build the exact queue or note payload for your storage target
3. one storage node
   - file write, Notion, Airtable, Sheets, DB, or webhook to your writeback worker
4. one notification node
   - email, Slack, Telegram, or internal webhook

Use these routing rules:

- `AI3_Planning_Intake`
  - if `escalate_to = AI-5` -> create research handoff + notify next owner
  - if `escalate_to = AI-7` -> create compliance handoff
  - if `escalate_to = none` -> create plan shell + queue update
- `AI3_QA_Scan`
  - if `result = pass` and `escalate_to = none` -> mark queue ready for next review gate
  - otherwise -> create follow-up task + notify next owner
- `Gmail_Support_Inbox`
  - `sent_reply` -> log outcome only
  - `escalated` -> create escalation note + notify target owner
  - `manual_review_required` -> notify Owner/support lane
- `Growth_Asset_Flow`
  - write one campaign log note
  - create asset handoffs for AI 11 and AI 10 outputs if present
  - notify Owner only when `escalate_to != none`
- `Research_Brief`
  - `done` or `partial` -> write research brief note + notify AI 7 or AI 3
  - `queued` -> notify requester that official `sourceUrls` are required
  - `blocked` -> notify Owner or AI 3, depending on your research intake owner

## Automatic Runtime Model

This is the correct end-to-end loop:

1. a real trigger fires
2. `n8n` normalizes the event
3. the workflow calls the matching live backend AI route
4. the workflow validates the AI output
5. the workflow writes back queue / handoff / log data
6. the workflow notifies the next owner only if action is needed
7. risky actions stay behind approval gates

When this is wired correctly:

- routine support can auto-send safely
- planning and QA can auto-route without chaos
- growth can auto-produce draft assets
- research can auto-intake without hallucinating facts
- Owner sees only true exceptions
