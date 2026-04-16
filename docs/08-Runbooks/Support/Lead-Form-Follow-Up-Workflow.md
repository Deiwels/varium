---
type: runbook
status: active
created: 2026-04-15
updated: 2026-04-15
owner: AI 9
source_of_truth: true
---

# Lead Form Follow-Up Workflow

> Part of [[Home]] > Runbooks | See also: [[08-Runbooks/System/Operational-Pipelines-MVP|Operational Pipelines MVP]], [[08-Runbooks/System/Escalation-Matrix|Escalation Matrix]], [[00-System/Real-Tools-Integration-Layer|Real Tools Integration Layer]], [[Growth/Customer-Communication/Support-Tone-Guide|Support Tone Guide]]

## Purpose

Define the MVP lead-intake workflow that can be built in `n8n`, Zapier, or another safe automation tool.

This is the canonical node-by-node path for:

- website form intake
- AI 9 lead reply drafting
- optional AI 8 lead-temperature insight
- CRM/log writeback

Implementation preference:

- `n8n` is the primary orchestrator
- Zapier is acceptable for lighter follow-up steps
- keep the workflow version-tolerant and avoid unnecessary community nodes

## Flow Logic

`Form Webhook -> Normalize Lead -> AI 9 Lead Reply -> Send Reply -> Store Lead -> Optional AI 8 Insight -> Log`

## Node-by-Node Schema

### Node 1 — Form Trigger

- **Type:** Webhook / Form Submit
- **Name:** Lead Form Submit
- **Purpose:** catch new website/contact-form lead submissions

Expected fields:

- `submissionId`
- `source`
- `campaign`
- `name`
- `email`
- `business_name`
- `message`
- `receivedAt`

### Node 2 — Normalize Lead

- **Type:** Set or Code
- **Name:** Normalize Lead
- **Purpose:** convert form payload into one stable shape

Output JSON:

```json
{
  "submission_id": "{{submissionId}}",
  "source": "{{source}}",
  "campaign": "{{campaign}}",
  "lead_name": "{{name}}",
  "lead_email": "{{email}}",
  "business_name": "{{business_name}}",
  "message": "{{message}}",
  "received_at": "{{receivedAt}}"
}
```

### Node 3 — AI 9 Lead Reply

- **Type:** AI / LLM call
- **Name:** AI 9 Lead Reply

Prompt requirements:

- friendly
- short
- clear CTA
- do not promise unsupported product behavior
- do not invent pricing, timelines, or exceptions
- escalate if the message becomes risky or non-routine

Required output fields:

- `reply_draft`
- `safe_to_send`
- `escalate_to`
- `next_cta`
- `reason`

Helpful optional fields:

- `lead_temperature`
- `objection_tag`

Allowed `escalate_to` values:

- `none`
- `AI-6`
- `AI-7`
- `AI-8`
- `Owner`

Expected output:

```json
{
  "reply_draft": "Hi Sarah,\n\nThanks for reaching out. I'd love to help you get set up. The fastest next step is to ...",
  "safe_to_send": true,
  "escalate_to": "none",
  "next_cta": "Reply with your preferred setup time.",
  "lead_temperature": "warm",
  "reason": "Routine new lead reply."
}
```

### Node 4 — Safe Send Check

- **Type:** If
- **Name:** Safe To Send?

Allow auto-send only when:

- `safe_to_send == true`
- `escalate_to == "none"`

If yes -> send reply
If no -> create escalation note

### Node 5 — Send Lead Reply

- **Type:** Gmail / email send
- **Name:** Send Lead Reply

Fields:

- `To: {{lead_email}}`
- `Subject: Re: {{campaign or source}}`
- `Body: {{reply_draft}}`

### Node 6 — Store Lead

- **Type:** Airtable / Notion / DB / internal store
- **Name:** Store Lead

Store at minimum:

- normalized lead payload
- reply status
- escalation target if any
- campaign/source

### Node 7 — Optional AI 8 Insight

- **Type:** AI / LLM call
- **Name:** AI 8 Lead Temperature

Goal:

- label lead as `hot`, `warm`, or `cold`
- identify obvious messaging pattern when helpful

This node is optional in MVP. Do not block the lead reply on it.

Suggested follow-up behavior:

- `hot` -> notify Owner
- `warm` -> create scheduled follow-up
- `cold` -> place in nurture queue

### Node 8 — Escalation Note

- **Type:** Markdown / DB / webhook to Obsidian pipeline
- **Name:** Create Lead Escalation Note

Use when `safe_to_send == false` or `escalate_to != none`.

Suggested structure:

```md
# Escalation

## Source
- Workflow: Lead Form Follow-Up
- Submission ID: {{submission_id}}
- Campaign: {{campaign}}

## Issue
{{reason}}

## Lead
- Name: {{lead_name}}
- Email: {{lead_email}}

## Suggested Target
{{escalate_to}}

## Draft
{{reply_draft}}

## Raw Message
{{message}}
```

### Node 9 — Workflow Log

- **Type:** file write / DB / webhook
- **Name:** Workflow Log

Log fields:

- `workflow`
- `submission_id`
- `source`
- `campaign`
- `action`
- `safe_to_send`
- `escalate_to`
- `timestamp`

## Escalation Rules

- unclear product promise -> **AI 6**
- risky compliance / claim wording -> **AI 7**
- campaign alignment / messaging angle -> **AI 8**
- pricing exception / sensitive commercial case -> **Owner**

## Obsidian Writeback Targets

- customer communication note when durable context matters
- handoff note if lane changes
- queue item if the lead becomes a follow-up task

## Final Principle

Reply fast, but never promise more than the canonical product and compliance docs can support.
