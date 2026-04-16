---
type: runbook
status: active
doc_class: reference-only
created: 2026-04-15
updated: 2026-04-16
owner: AI 3
source_of_truth: false
---

# Operational Pipelines MVP

> Part of [[Home]] > Runbooks | See also: [[00-System/Real-Tools-Integration-Layer|Real Tools Integration Layer]], [[08-Runbooks/Support/Gmail-Support-Inbox-Workflow|Gmail Support Inbox Workflow]], [[08-Runbooks/Support/Lead-Form-Follow-Up-Workflow|Lead Form Follow-Up Workflow]], [[08-Runbooks/Incidents/Incident-Response-Workflow|Incident Response Workflow]], [[08-Runbooks/System/Escalation-Matrix|Escalation Matrix]], [[08-Runbooks/System/n8n-Implementation-Pack-AI3-AI5-AI8-AI10-AI11|n8n Implementation Pack — AI 3 / AI 5 / AI 8 / AI 10 / AI 11]]

## Purpose

Define the first real automation MVP that can be assembled in `n8n` or Zapier without bypassing governance.

This is the practical starting set:

1. Email / Support Pipeline
2. Lead / Growth Pipeline
3. Incident / Alert Pipeline

## Preferred Orchestrator

Use `n8n` as the primary MVP orchestrator.

Why:

- built-in Gmail, webhook, and schedule triggers fit the first three pipelines cleanly
- `If` / switch routing is enough for the initial escalation logic
- credential management and external secrets fit the Owner-controls-reality rule
- self-hosted deployment keeps audit/security posture under team control

Zapier remains acceptable for lighter follow-up steps, but the canonical MVP should be designed `n8n`-first.

## AI Invocation Pattern

For MVP, prefer one shared LLM endpoint with role-specific system prompts:

- AI 9 -> support / lead prompt
- AI 4 -> emergency prompt
- AI 8 -> growth-insight prompt when needed

If the team later wants cleaner separation, move to an internal API gateway such as:

- `POST /ai/ai9-support`
- `POST /ai/ai4-emergency`
- `POST /ai/ai8-growth`

Do not block MVP on MCP-style tool routing.

For the first non-inbox automation wave in `n8n`, use [[08-Runbooks/System/n8n-Implementation-Pack-AI3-AI5-AI8-AI10-AI11|n8n Implementation Pack — AI 3 / AI 5 / AI 8 / AI 10 / AI 11]].

Current live execution artifacts:

- `automation/n8n/AI3_Planning_Intake.workflow.json`
- `automation/n8n/AI3_QA_Scan.workflow.json`
- `automation/n8n/Gmail_Support_Inbox.workflow.json`
- `automation/n8n/README.md`

These phase-1 AI 3 flows now start from real `n8n` webhook queue/status triggers rather than manual-only test triggers.
The support inbox lane now also has a live webhook-ready `n8n` artifact plus a consolidated backend AI 9 processing route.

## Architecture

### 1. Email / Support Pipeline

`Gmail -> Classifier -> Router -> AI 9 -> Send or Escalate`

Canonical implementation doc:

- [[08-Runbooks/Support/Gmail-Support-Inbox-Workflow|Gmail Support Inbox Workflow]]

### 2. Lead / Growth Pipeline

`Form -> AI 9 -> Follow-up -> Optional AI 8 insight -> CRM / log`

Canonical implementation doc:

- [[08-Runbooks/Support/Lead-Form-Follow-Up-Workflow|Lead Form Follow-Up Workflow]]

### 3. Incident / Alert Pipeline

`Monitoring / Stripe / Telnyx alert -> Severity classify -> AI 4 -> Stabilize -> AI 3 QA -> Log`

Canonical implementation doc:

- [[08-Runbooks/Incidents/Incident-Response-Workflow|Incident Response Workflow]]

## General Pattern

Every pipeline should follow this shape:

1. trigger
2. classify
3. route
4. AI execution
5. decision
6. send / escalate / apply
7. log

## Obsidian Writeback Rule

Each pipeline should create or update:

- task note when workflow becomes actionable work
- handoff note when ownership changes
- log note when the event leaves durable operational context

Use canonical templates from:

- [[11-Reference/Templates/Task-Workflow-Queue-Item-Template|Task / Workflow Queue Item Template]]
- [[11-Reference/Templates/Handoff-Template|Handoff Template]]

## Safe Boundaries

Never automate:

- Stripe refunds
- Telnyx portal changes
- pricing decisions
- App Store actions
- any Owner-only portal or credential action

Use [[08-Runbooks/Owner/Portal-Only-Actions|Owner Portal-Only Actions]] when a pipeline touches protected operations.

Additional guardrails:

- no auto-send for billing, compliance, dispute, or account-sensitive cases
- no portal mutation through `n8n` without an Owner gate
- every escalation must include a reason
- prefer built-in `n8n` nodes over unreviewed community nodes

## Secrets Rule

Keep workflow credentials inside the orchestrator's encrypted credential store or approved external secrets backend.

Recommended MVP posture:

- self-hosted `n8n`
- external secrets or vault-backed sensitive values
- Owner holds master access
- workflow payloads pass only the minimum context needed by each AI

## Recommended MVP Build Order

### Stage 1

- Gmail trigger
- AI 9 draft
- manual approval send

### Stage 2

- auto-send only for clearly safe support replies
- FAQ-candidate logging

### Stage 3

- lead form intake
- structured follow-up queue

### Stage 4

- incident webhook
- AI 4 emergency routing

### Stage 5

- Stripe / Telnyx awareness only
- no automatic financial or portal actions

Do not widen scope until these three flows are stable.

## Final Principle

Start with the smallest useful automation that removes real routine work without bypassing truth, escalation, or Owner control.
