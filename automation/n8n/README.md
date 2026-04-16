# n8n Execution Artifacts

Execution-first `n8n` artifacts for the approved rollout.

Current phase-1 workflows:

- `Owner_Intake.workflow.json`
- `AI3_Planning_Intake.workflow.json`
- `AI3_QA_Scan.workflow.json`
- `Gmail_Support_Inbox.workflow.json`
- `Growth_Asset_Flow.workflow.json`
- `Research_Brief.workflow.json`
- `Owner_Notification.workflow.json`
- `Obsidian_Writeback.workflow.json`

Local setup helpers:

- `.env.example`
- `.env.local.example`
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

Execution notes:

- without `ANTHROPIC_API_KEY` in the backend, the AI lanes now return structured local fallback results instead of hard-failing
- without `RESEND_API_KEY`, `Owner_Notification` stays runnable but returns a structured blocked notification result
- smoke tests for planning, QA, growth, and research create real markdown notes through backend writeback unless you point them at a disposable docs tree

Use [`.env.example`](/Users/nazarii/Downloads/varium/automation/n8n/.env.example) as the starter file.
For a local-only run, use [`.env.local.example`](/Users/nazarii/Downloads/varium/automation/n8n/.env.local.example) as the more direct template.

Backend note:
- use [backend/.env.local.example](/Users/nazarii/Downloads/varium/backend/.env.local.example) as the local backend secret/config template
- the backend currently expects env vars to be present in the process environment; it does not auto-load `.env.local` by itself

Important for local/self-hosted `n8n`:
- set `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`
- these workflows use `$env.VURIUM_API_BASE_URL`, `$env.VURIUM_ADMIN_TOKEN`, and related values inside node expressions
- if env access stays blocked, HTTP nodes fail with `access to env vars denied`

## Import in n8n

Use this exact order:

1. Open `n8n`.
2. Import the workflow JSON file from `automation/n8n/`.
3. Set `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`, `VURIUM_API_BASE_URL`, and `VURIUM_ADMIN_TOKEN` in the `n8n` environment.
4. Open the imported workflow and confirm the webhook path matches the filename intent.
5. Run one smoke test payload against the webhook before connecting any real trigger.
6. Only after a passing smoke test, wire the upstream real trigger.

Recommended import order:

1. `Owner_Intake.workflow.json`
2. `AI3_Planning_Intake.workflow.json`
3. `AI3_QA_Scan.workflow.json`
4. `Gmail_Support_Inbox.workflow.json`
5. `Growth_Asset_Flow.workflow.json`
6. `Research_Brief.workflow.json`
7. `Owner_Notification.workflow.json`
8. `Obsidian_Writeback.workflow.json`

## Current Backend Endpoints

- `POST /api/vurium-dev/ai/planning-intake`
- `POST /api/vurium-dev/ai/qa-scan`
- `POST /api/vurium-dev/ai/owner-intake`
- `POST /api/vurium-dev/ai/support-inbox-process`
- `POST /api/vurium-dev/ai/support-inbox-execute`
- `POST /api/vurium-dev/ai/growth-asset-flow`
- `POST /api/vurium-dev/ai/research-brief`
- `POST /api/vurium-dev/automation/owner-notify`
- `POST /api/vurium-dev/automation/obsidian-writeback`

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

- `Owner_Intake` -> `.../webhook/owner-intake`
- `AI3_Planning_Intake` -> `.../webhook/ai3-planning-intake`
- `AI3_QA_Scan` -> `.../webhook/ai3-qa-scan`
- `Gmail_Support_Inbox` -> `.../webhook/gmail-support-inbox`
- `Growth_Asset_Flow` -> `.../webhook/growth-asset-flow`
- `Research_Brief` -> `.../webhook/research-brief`
- `Owner_Notification` -> `.../webhook/owner-notification`
- `Obsidian_Writeback` -> `.../webhook/obsidian-writeback`

The AI 3 workflows are designed to be called by a queue/status bridge when a task changes stage.

The support workflow is designed to be called by a Gmail trigger bridge, inbound email worker, or any upstream inbox normalizer that can emit one normalized email event.

The growth asset workflow is designed to be called by a campaign request bridge, KPI trigger, or any upstream growth intake normalizer that can emit one structured campaign request.

The research workflow is designed to be called by an AI 3 planning handoff, external-dependency tag bridge, or any upstream research intake normalizer that can emit one structured research request with explicit official source URLs.

## Owner Intake Contract

`Owner_Intake.workflow.json` is the single-entry intake lane for Owner-created work.

Minimum payload:

```json
{
  "message": "Need to harden the booking confirmation flow before final submit.",
  "title": "Booking confirmation hardening",
  "priority": "high",
  "productContextLinks": [
    "[[Booking Flow MVP Product Brief]]"
  ],
  "knownConstraints": [
    "Do not break current booking speed"
  ]
}
```

Optional fields:

- `intakeKind`
  - `auto`, `task`, `growth`, `research`, `handoff`, `truth_update_draft`
- `sourceUrls`
- `questions`
- `targetSources`
- `relatedLinks`
- `audience`
- `channel`
- `approvedClaimsLink`
- `currentOfferLink`

What it does:

- classifies the Owner message into the correct lane
- writes one durable markdown note into the correct docs folder
- sets the note's queue stage / route target
- runs the downstream lane when supported:
  - `task` -> `AI3_Planning_Intake`
  - `growth` -> `Growth_Asset_Flow`
  - `research` -> `Research_Brief`
  - `handoff` -> note only
  - `truth_update_draft` -> draft note only

What it returns:

- `intake_id`
- `intake_kind`
- `created_note_relative_path`
- `queue_stage`
- `route_target`
- `downstream_workflow`
- `downstream_status`
- `writeback`
- `next_step`

## Local Fallback Behavior

These workflows are now usable locally before external secrets are added:

- `Owner_Intake` still creates the correct markdown intake note and routes the work even when AI providers are unavailable
- `AI3_Planning_Intake` returns a draft planning shell and routes to the next lane instead of failing when AI is not configured
- `AI3_QA_Scan` returns a manual-review QA result with follow-up routing instead of failing
- `Growth_Asset_Flow` returns a draft growth brief plus draft creative/video packages using offline fallbacks
- `Research_Brief` returns `queued` when no official `sourceUrls` are supplied, `blocked` when no sources can be fetched, and `partial` staged research when sources were fetched but AI is not configured
- `Gmail_Support_Inbox` already falls back to deterministic classification and routing when AI is not configured

This makes local validation possible while secrets are still missing, without weakening escalation or approval gates.

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

## Owner Notification Contract

`Owner_Notification.workflow.json` expects one automation alert event and sends an email notification through the backend notification route.

Minimum payload:

```json
{
  "workflowSource": "Gmail_Support_Inbox",
  "severity": "high",
  "subject": "Billing-sensitive support message requires Owner review",
  "summary": "A support inbox message was classified as billing-sensitive and cannot be auto-sent.",
  "details": [
    "message_id: gmail-message-id",
    "thread_id: gmail-thread-id"
  ],
  "nextStep": "Review the escalation payload and respond manually from the correct mailbox."
}
```

It returns:

- `status`
- `recipient`
- `subject`
- `reason`
- `next_step`

## Obsidian Writeback Contract

`Obsidian_Writeback.workflow.json` expects one markdown writeback event and writes the note through the guarded backend route.

Minimum payload:

```json
{
  "relativePath": "04-Tasks/Handoffs/TEST-Obsidian-Writeback.md",
  "mode": "create",
  "dryRun": true,
  "content": "# Handoff\n\n..."
}
```

Important:

- only `.md` files are allowed
- the target path must stay inside the configured `VURIUM_OBSIDIAN_ROOT`
- `dryRun = true` validates the write without creating the file
- `mode = create` refuses to overwrite an existing note

It returns:

- `status`
- `relative_path`
- `absolute_path`
- `bytes_written`
- `reason`
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
- [owner-notification.payload.json](/Users/nazarii/Downloads/varium/automation/n8n/smoke-tests/owner-notification.payload.json)
- [obsidian-writeback.payload.json](/Users/nazarii/Downloads/varium/automation/n8n/smoke-tests/obsidian-writeback.payload.json)

Expected first-pass outcomes:

- `AI3_Planning_Intake` -> structured planning output, usually with `AI-5` or `AI-7` escalation when dependencies exist
- `AI3_QA_Scan` -> `pass`, `fail`, or `needs_review`
- `Gmail_Support_Inbox` -> `sent_reply`, `escalated`, or `manual_review_required`
- `Growth_Asset_Flow` -> combined brief and asset draft package
- `Research_Brief` with sources -> source-backed findings or partial result
- `Research_Brief` without sources -> `queued`
- `Owner_Notification` -> Owner alert email sent or blocked if email config is missing
- `Obsidian_Writeback` with `dryRun = true` -> successful validation without creating a file

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
   - `Obsidian_Writeback.workflow.json`, file write, Notion, Airtable, Sheets, DB, or webhook to your writeback worker
4. one notification node
   - email, Slack, Telegram, or internal webhook

Use these routing rules:

- `AI3_Planning_Intake`
  - if `escalate_to = AI-5` -> create research handoff + notify next owner
  - if `escalate_to = AI-7` -> create compliance handoff
  - if `escalate_to = none` -> create plan shell + queue update
  - writeback suggestion:
    - `04-Tasks/TASK-123-Plan.md`
- `AI3_QA_Scan`
  - if `result = pass` and `escalate_to = none` -> mark queue ready for next review gate
  - otherwise -> create follow-up task + notify next owner
  - writeback suggestion:
    - `04-Tasks/TASK-123-QA-Scan.md`
- `Gmail_Support_Inbox`
  - `sent_reply` -> log outcome only
  - `escalated` -> create escalation note + if `escalate_to = Owner`, call `Owner_Notification.workflow.json`
  - `manual_review_required` -> call `Owner_Notification.workflow.json` or notify support lane
  - writeback suggestion:
    - `04-Tasks/Handoffs/gmail-message-id-support-escalation.md`
- `Growth_Asset_Flow`
  - write one campaign log note
  - create asset handoffs for AI 11 and AI 10 outputs if present
  - when `escalate_to = Owner`, call `Owner_Notification.workflow.json`
  - writeback suggestion:
    - `06-Growth/Experiments/GROWTH-022-Asset-Flow.md`
- `Research_Brief`
  - `done` or `partial` -> write research brief note + notify AI 7 or AI 3
  - `queued` -> notify requester that official `sourceUrls` are required
  - `blocked` -> call `Owner_Notification.workflow.json` or notify AI 3, depending on your research intake owner
  - writeback suggestion:
    - `07-Research/AI5-Research-Brief-R-203.md`

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

## Launch Today in n8n

Do this exactly:

1. Open `n8n`.
2. Create the env vars from [`.env.example`](/Users/nazarii/Downloads/varium/automation/n8n/.env.example).
3. Import these workflows in order:
   - `AI3_Planning_Intake`
   - `AI3_QA_Scan`
   - `Gmail_Support_Inbox`
   - `Growth_Asset_Flow`
   - `Research_Brief`
   - `Owner_Notification`
   - `Obsidian_Writeback`
4. Open `Obsidian_Writeback` first and run [obsidian-writeback.payload.json](/Users/nazarii/Downloads/varium/automation/n8n/smoke-tests/obsidian-writeback.payload.json) with `dryRun = true`.
5. Confirm the result is `done` and the returned `absolute_path` points inside your docs root.
6. Open `Owner_Notification` and run [owner-notification.payload.json](/Users/nazarii/Downloads/varium/automation/n8n/smoke-tests/owner-notification.payload.json).
7. Confirm the email sends to the configured Owner address.
8. Run the remaining smoke-test payloads one by one.
9. After all smoke tests pass, edit each live workflow and add:
   - one `If` node after validation
   - one call to `Obsidian_Writeback` for notes/logs
   - one call to `Owner_Notification` only for Owner-gated states
10. Only then connect real triggers like Gmail, queue bridge, and campaign intake.
