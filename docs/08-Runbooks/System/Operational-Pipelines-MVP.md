---
type: runbook
status: active
created: 2026-04-15
updated: 2026-04-15
owner: AI 3
source_of_truth: true
---

# Operational Pipelines MVP

> Part of [[Home]] > Runbooks | See also: [[00-System/Real-Tools-Integration-Layer|Real Tools Integration Layer]], [[08-Runbooks/Support/Gmail-Support-Inbox-Workflow|Gmail Support Inbox Workflow]], [[08-Runbooks/Support/Lead-Form-Follow-Up-Workflow|Lead Form Follow-Up Workflow]], [[08-Runbooks/Incidents/Incident-Response-Workflow|Incident Response Workflow]], [[08-Runbooks/System/Escalation-Matrix|Escalation Matrix]]

## Purpose

Define the first real automation MVP that can be assembled in `n8n` or Zapier without bypassing governance.

This is the practical starting set:

1. Email / Support Pipeline
2. Lead / Growth Pipeline
3. Incident / Alert Pipeline

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

## Recommended MVP Build Order

### Step 1

Build Gmail support inbox.

### Step 2

Build lead form follow-up.

### Step 3

Build incident alert routing.

Do not widen scope until these three flows are stable.

## Final Principle

Start with the smallest useful automation that removes real routine work without bypassing truth, escalation, or Owner control.
