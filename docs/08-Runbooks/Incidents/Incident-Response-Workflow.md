---
type: runbook
status: active
created: 2026-04-15
updated: 2026-04-15
owner: AI 4
source_of_truth: true
---

# Incident Response Workflow

> Part of [[Home]] > Runbooks | See also: [[08-Runbooks/System/Escalation-Matrix|Escalation Matrix]], [[00-System/Real-Tools-Integration-Layer|Real Tools Integration Layer]]

## Purpose

Define the emergency path from alert to stabilization, post-hotfix scan, and permanent cleanup.

Implementation preference:

- route alerts through a webhook-first `n8n` workflow or equivalent safe orchestrator
- keep severity classification explicit before any automated action

## Flow Logic

`Alert -> Classify Severity -> Route to AI 4 -> Stabilize -> AI 3 QA -> Permanent Cleanup -> Log`

## Step-by-step Procedure

1. Classify severity.
2. Notify Owner.
3. Route to AI 4 with incident context and rollback notes if available.
4. AI 4 applies the smallest safe fix.
5. AI 4 logs `[HOTFIX] [AI 4]`.
6. AI 3 performs post-hotfix scan.
7. AI 1 or AI 2 performs permanent cleanup in owned scope.
8. Update incident/runbook/decision docs if operating behavior changed.

## Trigger Sources

Common triggers:

- uptime alert
- Stripe failure event
- Telnyx error event
- manual production-issue report

## Severity Classifier

Use one of:

- `low`
- `high`
- `critical`

Suggested rule:

- `critical` -> production down, compliance risk, or financial risk
- `high` -> major user-facing breakage or blocked operations
- `low` -> degraded but not system-threatening

Operational routing rule:

- `critical` -> notify Owner immediately and route to AI 4
- `high` -> route to AI 4 and create incident log
- `low` -> create owned follow-up task for AI 1 or AI 2 when no emergency action is required

## AI 4 Response Contract

AI 4 should return:

- `action`
- `risk`
- `next_step`

with the smallest safe stabilization plan first.

## Execution Rule

The emergency path is for stabilization only.

Do not turn this workflow into architecture redesign during the alert itself.

## Obsidian Writeback

Every serious incident should leave behind:

- incident note
- hotfix log if applicable
- handoff to AI 3 / AI 1 / AI 2
- runbook or decision update if operating behavior changed
