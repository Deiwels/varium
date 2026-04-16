# n8n Execution Artifacts

Execution-first `n8n` artifacts for the approved rollout.

Current phase-1 workflows:

- `AI3_Planning_Intake.workflow.json`
- `AI3_QA_Scan.workflow.json`

## Required Environment

Set these in `n8n` before running the workflows:

- `VURIUM_API_BASE_URL`
  - example: `https://vuriumbook-api-431945333485.us-central1.run.app`
- `VURIUM_ADMIN_TOKEN`
  - superadmin bearer token for `/api/vurium-dev/**` routes

## Current Backend Endpoints

- `POST /api/vurium-dev/ai/planning-intake`
- `POST /api/vurium-dev/ai/qa-scan`

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

## What These Workflows Do

- start from a manual test trigger
- build a sample phase-1 payload
- call the live backend AI endpoint
- validate the returned JSON shape
- emit one structured result item that can then be wired into queue writeback, handoff creation, or notifications

## Next Wiring Step

After import:

1. replace the `Manual Trigger` with the real queue/status trigger
2. wire the last node into your writeback path:
   - queue update
   - handoff note
   - Owner notification
   - next-owner notification

These artifacts intentionally stop before file/database mutation so they stay version-tolerant and easy to adapt.
