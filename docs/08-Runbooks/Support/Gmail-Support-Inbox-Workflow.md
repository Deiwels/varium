---
type: runbook
status: active
created: 2026-04-15
updated: 2026-04-15
owner: AI 9
source_of_truth: true
---

# Gmail Support Inbox Workflow

> Part of [[Home]] > Runbooks | See also: [[08-Runbooks/Support/Email-Reply-Workflow|Email Reply Workflow]], [[08-Runbooks/Support/Escalation-Matrix|Escalation Matrix]], [[00-System/Real-Tools-Integration-Layer|Real Tools Integration Layer]], [[Growth/Customer-Communication/Support-Tone-Guide|Support Tone Guide]]

## Purpose

Define the MVP Gmail support-inbox workflow that can be built in `n8n` without bypassing governance.

This is the canonical node-by-node schema for:

- Gmail intake
- email classification
- AI 9 draft replies
- safe auto-send checks
- escalation-note creation
- workflow logging

## Flow Logic

`Gmail Trigger -> Normalize Email -> Classify Email -> Route by Label`

Routing:

- `support / onboarding / lead` -> AI 9 Draft Reply -> Safe Send Check
- `technical` -> escalation note for AI 1 or AI 2
- `billing` -> escalation note for Owner
- `compliance_risk` -> escalation note for AI 7
- all branches -> log result

## Node-by-Node Schema

### Node 1 — Gmail Trigger

- **Type:** Gmail Trigger
- **Name:** Gmail New Email
- **Purpose:** catch new inbound support-inbox messages

Expected fields:

- `messageId`
- `threadId`
- `from`
- `subject`
- `bodyText`
- `bodyHtml`
- `receivedAt`

### Node 2 — Normalize Email

- **Type:** Set or Code
- **Name:** Normalize Email
- **Purpose:** normalize Gmail payload into one stable JSON shape

Output JSON:

```json
{
  "message_id": "{{messageId}}",
  "thread_id": "{{threadId}}",
  "from_email": "{{from}}",
  "subject": "{{subject}}",
  "body": "{{bodyText}}",
  "received_at": "{{receivedAt}}"
}
```

### Node 3 — Classify Email

- **Type:** AI / LLM call
- **Name:** Classify Email

Return exactly one label:

- `support`
- `lead`
- `onboarding`
- `technical`
- `billing`
- `compliance_risk`

Prompt shape:

```text
Classify this email into exactly one label:

- support
- lead
- onboarding
- technical
- billing
- compliance_risk

Rules:
- Return JSON only
- Do not explain
- Choose exactly one label

Email:
Subject: {{subject}}
From: {{from_email}}
Body: {{body}}
```

Expected output:

```json
{
  "label": "support"
}
```

### Node 4 — Route by Label

- **Type:** Switch / If
- **Name:** Route by Label

Branches:

- `support`
- `lead`
- `onboarding`
- `technical`
- `billing`
- `compliance_risk`

## Main Reply Lane

### Branch A — support / lead / onboarding

#### Node 5A — AI 9 Draft Reply

- **Type:** AI / LLM call
- **Name:** AI 9 Draft Reply

Required output fields:

- `reply_draft`
- `safe_to_send`
- `escalate_to`
- `faq_candidate`
- `reason`

Allowed `escalate_to` values:

- `none`
- `AI-1`
- `AI-2`
- `AI-6`
- `AI-7`
- `Owner`

Prompt requirements:

- write a helpful reply
- do not invent features
- do not invent pricing
- do not make promises
- escalate if risky
- keep reply short and clear

Escalation rules inside prompt:

- technical product/system issue -> `AI-1` or `AI-2`
- product ambiguity -> `AI-6`
- compliance/policy wording -> `AI-7`
- billing / refund / special commitment -> `Owner`
- routine and safe -> `safe_to_send=true`

Expected output:

```json
{
  "reply_draft": "Hi John,\n\nThanks for reaching out. ...",
  "safe_to_send": true,
  "escalate_to": "none",
  "faq_candidate": false,
  "reason": "Routine onboarding clarification."
}
```

#### Node 6A — Safe Send Check

- **Type:** If
- **Name:** Safe To Send?

Allow auto-send only when:

- `safe_to_send == true`
- `escalate_to == "none"`

If yes -> send reply
If no -> create escalation note

#### Node 7A — Send Gmail Reply

- **Type:** Gmail Send
- **Name:** Send Reply

Fields:

- `To: {{from_email}}`
- `Subject: Re: {{subject}}`
- `Body: {{reply_draft}}`
- `Thread: {{thread_id}}`

#### Node 8A — Create Escalation Note

- **Type:** Markdown / DB / webhook to Obsidian pipeline
- **Name:** Create Escalation Note

Suggested structure:

```md
# Escalation

## Source
- Workflow: Gmail Support Inbox
- Label: {{label}}
- Message ID: {{message_id}}
- Thread ID: {{thread_id}}

## Issue
{{reason}}

## Email
- From: {{from_email}}
- Subject: {{subject}}

## Suggested Target
{{escalate_to}}

## Draft
{{reply_draft}}

## Raw Body
{{body}}
```

## Technical Branch

### Branch B — technical

#### Node 5B — Technical Router

- **Type:** If or AI mini-router
- **Name:** AI1 or AI2?

Routing rule:

- backend / API / server / data -> `AI-1`
- UI / frontend / rendering / booking-page flow -> `AI-2`

Expected output:

```json
{
  "escalate_to": "AI-1",
  "reason": "Backend/API issue suspected."
}
```

#### Node 6B — Create Escalation Note

Use the same escalation-note structure as Branch A.

## Billing Branch

### Branch C — billing

#### Node 5C — Create Owner Escalation

- **Type:** Markdown / DB / notify
- **Name:** Billing Escalation
- **Escalate to:** `Owner`

Typical reasons:

- refund request
- payment failure complaint
- pricing exception
- billing confusion with financial-commitment risk

## Compliance-Risk Branch

### Branch D — compliance_risk

#### Node 5D — Create AI 7 Escalation

- **Type:** Markdown / DB / notify
- **Name:** Compliance Escalation
- **Escalate to:** `AI-7`

Typical reasons:

- SMS consent wording
- legal/policy wording
- regulated claim
- privacy/compliance-sensitive promise

## Logging Lane

### Node 9 — Log Result

- **Type:** file write / DB / Notion / webhook
- **Name:** Workflow Log

Successful auto-send example:

```json
{
  "workflow": "gmail-support-inbox",
  "message_id": "{{message_id}}",
  "thread_id": "{{thread_id}}",
  "label": "{{label}}",
  "action": "sent_reply",
  "safe_to_send": true,
  "escalate_to": "none",
  "timestamp": "{{received_at}}"
}
```

Escalation example:

```json
{
  "workflow": "gmail-support-inbox",
  "message_id": "{{message_id}}",
  "thread_id": "{{thread_id}}",
  "label": "{{label}}",
  "action": "escalated",
  "escalate_to": "{{escalate_to}}",
  "reason": "{{reason}}",
  "timestamp": "{{received_at}}"
}
```

## Conditions

Canonical labels:

- `support`
- `lead`
- `onboarding`
- `technical`
- `billing`
- `compliance_risk`

Auto-send is allowed only for:

- `support`
- `lead`
- `onboarding`

Never auto-send when:

- `label == billing`
- `label == compliance_risk`
- `escalate_to != none`
- `safe_to_send == false`

## Minimal Shared Data Schema

```json
{
  "message_id": "gmail_message_id",
  "thread_id": "gmail_thread_id",
  "from_email": "user@example.com",
  "subject": "Need help with booking page",
  "body": "Hello, I cannot find...",
  "label": "support",
  "reply_draft": "Hi, thanks for reaching out...",
  "safe_to_send": true,
  "escalate_to": "none",
  "faq_candidate": false,
  "reason": "Routine support request"
}
```

## Guardrails

Add these directly into prompts or node comments:

- do not invent features
- do not promise launch dates
- do not offer refunds
- do not negotiate pricing
- do not make legal/compliance claims
- do not claim something is fixed unless confirmed

## Implementation Brief for Dev / AI

Build this exact Gmail Support Inbox MVP workflow in `n8n`.

Requirements:

1. Gmail Trigger
2. Normalize Email
3. Classify Email into the six canonical labels
4. Route:
   - `support/lead/onboarding` -> AI 9 draft
   - `technical` -> AI 1 / AI 2 escalation
   - `billing` -> Owner escalation
   - `compliance_risk` -> AI 7 escalation
5. Auto-send only when:
   - `safe_to_send=true`
   - `escalate_to=none`
   - not `billing/compliance_risk`
6. Create escalation note for all blocked/risky cases
7. Log all outcomes
8. Keep workflow easy to maintain
9. No refunds, pricing exceptions, or sensitive promises via automation
