---
type: runbook
status: active
doc_class: reference-only
created: 2026-04-15
updated: 2026-04-16
owner: AI 3
source_of_truth: false
---

# n8n Implementation Pack — AI 3 / AI 5 / AI 8 / AI 10 / AI 11

> Part of [[Home]] > Runbooks | See also: [[00-System/AI-Automation-Policy|AI Automation Policy]], [[11-Reference/Automation-Routing-Reference|Automation Routing Reference]], [[00-System/Automation-Workflow-Layer|Automation Workflow Layer]], [[00-System/Real-Tools-Integration-Layer|Real Tools Integration Layer]], [[08-Runbooks/System/Operational-Pipelines-MVP|Operational Pipelines MVP]]

## Purpose

Define practical automation contracts for:

- AI 3 — Planner / QA / Weekly Review
- AI 5 — Research Briefs
- AI 8 — Growth Briefs
- AI 10 — Video Briefs / Scripts
- AI 11 — Creative Variants / Image Assets

For each agent this pack defines:

- trigger
- input payload
- execution mode
- output schema
- safe mode rules
- escalation rules
- writeback targets

This file is intended for `n8n` implementation.

It is an implementation reference. It does not define governance, policy, or authority on its own.

## Global Rules

### Rule A

All outputs must be structured JSON.

### Rule B

All workflows must write logs or notes into the knowledge system if durable value is created.

### Rule C

No workflow may silently mutate canonical truth.

### Rule D

All risky or ambiguous outputs must escalate instead of guessing.

### Rule E

These agents generate:

- plans
- briefs
- drafts
- variants
- research

They do not:

- approve pricing
- publish risky assets
- operate sensitive portals
- override Owner

## Shared Status Values

Use these values across all flows:

- `done`
- `partial`
- `blocked`
- `needs_review`
- `queued`

## Shared Escalation Targets

Use these values across all flows:

- `none`
- `AI-1`
- `AI-2`
- `AI-3`
- `AI-5`
- `AI-6`
- `AI-7`
- `AI-8`
- `AI-9`
- `AI-10`
- `AI-11`
- `Owner`

## AI 3 — Planning Intake

### Workflow Name

`AI3_Planning_Intake`

### Purpose

Convert a new non-trivial task into a structured planning intake.

### Trigger

- new task created with `complexity = non-trivial`
- queue item moved to `Waiting for Planning`
- Owner feature request tagged `needs-plan`

### Execution Mode

- `Queue + Draft`

### Recommended n8n Trigger Nodes

- Webhook
- Notion / Airtable / DB trigger
- file watcher or queue item update
- manual trigger for MVP

### Input Payload

```json
{
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

### AI Prompt Goal

Generate planning intake structure only.

### Expected Output Schema

```json
{
  "agent": "AI-3",
  "workflow": "planning_intake",
  "task_id": "TASK-123",
  "status": "done",
  "requires_ai5": true,
  "requires_ai6": false,
  "requires_ai7": true,
  "recommended_sequence": [
    "AI-5",
    "AI-7",
    "AI-3"
  ],
  "plan_skeleton": {
    "objective": "Implement SMS consent flow improvement safely",
    "workstreams": [
      "research",
      "compliance requirements",
      "frontend changes",
      "backend enforcement",
      "QA verification"
    ],
    "missing_inputs": [
      "official consent wording requirements"
    ],
    "acceptance_criteria_seed": [
      "Consent copy is explicit",
      "Flow remains low-friction",
      "Backend stores consent state"
    ]
  },
  "escalate_to": "AI-5",
  "reason": "External policy truth required before planning"
}
```

### Safe Mode Rules

- may classify and prepare structure
- may not finalize a large execution plan if critical inputs are missing
- must not invent compliance truth
- must not assign final product meaning outside known docs

### Escalation Rules

- product ambiguity -> **AI 6**
- external truth needed -> **AI 5**
- compliance-sensitive implementation -> **AI 7**
- unresolved business priority conflict -> **Owner**

### Writeback Targets

- `04-Tasks/Workflow-Queue.md`
- `04-Tasks/Handoffs/`
- `04-Tasks/*-Plan.md` draft shell

## AI 3 — QA Scan

### Workflow Name

`AI3_QA_Scan`

### Purpose

Run structured QA review after implementation or hotfix.

### Trigger

- task moved to `Ready for QA`
- implementation marked complete
- incident hotfix marked complete

### Execution Mode

- `Safe Auto`

### Input Payload

```json
{
  "task_id": "TASK-123",
  "plan_link": "[[TASK-123-Plan]]",
  "acceptance_criteria": [
    "Consent copy is explicit",
    "Backend stores consent state",
    "No regression in booking flow"
  ],
  "implementation_summary": [
    "frontend consent checkbox added",
    "backend consent flag stored",
    "copy updated"
  ],
  "changed_areas": [
    "app/signup/",
    "backend/index.js"
  ],
  "hotfix": false
}
```

### Expected Output Schema

```json
{
  "agent": "AI-3",
  "workflow": "qa_scan",
  "task_id": "TASK-123",
  "status": "done",
  "result": "needs_review",
  "findings": [
    "Frontend acceptance criterion appears satisfied",
    "Backend storage path mentioned but not verified against failure cases"
  ],
  "follow_up_items": [
    "Verify consent persistence on retry flow",
    "Check mobile layout on small screens"
  ],
  "escalate_to": "AI-2",
  "reason": "Responsive verification still needed"
}
```

### Safe Mode Rules

- may generate QA scan
- may flag issues automatically
- may not approve launch
- may not rewrite implementation truth

### Writeback Targets

- `04-Tasks/*QA-Scan*.md`
- queue item status
- follow-up task note if needed

## AI 3 — Weekly Review

### Workflow Name

`AI3_Weekly_System_Review`

### Purpose

Run scheduled system-health review.

### Trigger

- weekly schedule, for example every Monday at 9:00 AM

### Execution Mode

- `Scheduled`

### Input Payload

```json
{
  "week_range": "2026-04-13 to 2026-04-19",
  "kpi_summary_link": "[[KPI Weekly Snapshot]]",
  "blocked_tasks": 4,
  "incidents_count": 1,
  "top_escalations": [
    "product ambiguity",
    "support wording risk"
  ],
  "queue_summary_link": "[[Workflow Queue]]"
}
```

### Expected Output Schema

```json
{
  "agent": "AI-3",
  "workflow": "weekly_review",
  "status": "done",
  "top_problems": [
    "Too many tasks require product clarification",
    "Support escalation to Owner is higher than target",
    "Creative requests lack consistent approved claims"
  ],
  "recommended_improvements": [
    "Strengthen AI-6 intake brief quality",
    "Expand FAQ and support macros",
    "Create Approved Claims canonical doc for growth lane"
  ],
  "escalate_to": "Owner",
  "reason": "System-level prioritization review recommended"
}
```

### Writeback Targets

- `10-Decisions/System-Changes/`
- weekly review note
- improvement queue

## AI 8 — Growth Briefs

### Workflow Name

`AI8_Growth_Brief`

### Purpose

Generate a structured growth brief from a campaign request or KPI signal.

### Trigger

- campaign request created
- conversion KPI drop
- launch prep request
- repeated objection pattern detected

### Execution Mode

- `Draft`

### Input Payload

```json
{
  "request_id": "GROWTH-022",
  "goal": "Increase barbershop trial signups",
  "audience": "US barbershop owners with small teams",
  "channel": "landing page + email follow-up + social ads",
  "current_offer_link": "[[Current Offer]]",
  "product_truth_links": [
    "[[Booking Flow MVP Product Brief]]"
  ],
  "known_objections": [
    "setup takes too long",
    "SMS may be complicated"
  ]
}
```

### Expected Output Schema

```json
{
  "agent": "AI-8",
  "workflow": "growth_brief",
  "request_id": "GROWTH-022",
  "status": "done",
  "growth_brief": {
    "goal": "Increase trial signups",
    "audience": "US barbershop owners with small teams",
    "hook": "Get booking + reminders live fast without setup chaos",
    "cta": "Start free trial",
    "channels": [
      "landing page",
      "email follow-up",
      "social ads"
    ],
    "asset_requests": [
      "AI-11 static creatives",
      "AI-10 short promo script",
      "AI-9 lead follow-up email"
    ],
    "risk_notes": [
      "Do not imply unsupported instant SMS compliance outcomes"
    ]
  },
  "escalate_to": "AI-11",
  "reason": "Static creative generation required"
}
```

### Safe Mode Rules

- may propose hooks, CTA, and channel mix
- must not invent unsupported product claims
- must align with current product truth
- major strategy shifts should notify Owner

### Escalation Rules

- unclear product capability -> **AI 6**
- risky claim or compliance angle -> **AI 7**
- high-level business priority conflict -> **Owner**

### Writeback Targets

- `06-Growth/Growth-Backlog.md`
- `06-Growth/Experiments/`
- growth brief note

## AI 11 — Creative Variants / Images

### Workflow Name

`AI11_Creative_Variants`

### Purpose

Generate static creative concepts and prompt packs from an approved growth brief.

### Trigger

- approved growth brief with static asset request
- experiment requests new image variants
- landing page creative request

### Execution Mode

- `Draft / Safe Auto internal`

### Input Payload

```json
{
  "creative_request_id": "CR-101",
  "growth_brief_link": "[[Spring Signup Growth Brief]]",
  "goal": "Increase free trial CTR",
  "audience": "Salon and barbershop owners",
  "hook": "Booking and reminders without setup chaos",
  "cta": "Start free trial",
  "brand_direction": [
    "clean",
    "modern",
    "trustworthy"
  ],
  "approved_claims_link": "[[Approved Claims and Angles]]",
  "formats": [
    "1080x1350",
    "1200x628"
  ]
}
```

### Expected Output Schema

```json
{
  "agent": "AI-11",
  "workflow": "creative_variants",
  "creative_request_id": "CR-101",
  "status": "done",
  "variants": [
    {
      "variant_id": "CR-101-V1",
      "angle": "fast setup",
      "prompt": "Create a modern ad image for barbershop software emphasizing fast setup...",
      "format": "1080x1350"
    },
    {
      "variant_id": "CR-101-V2",
      "angle": "reduce admin chaos",
      "prompt": "Create a clean ad creative showing simplified booking operations...",
      "format": "1200x628"
    }
  ],
  "needs_review": true,
  "escalate_to": "Owner",
  "reason": "Final creative selection recommended"
}
```

### Safe Mode Rules

- may generate variants and prompt packs
- may label hooks and angles
- must not imply fake features visually
- must not publish final asset automatically
- must stay within approved claims

### Escalation Rules

- unclear product representation -> **AI 6**
- compliance-sensitive angle -> **AI 7**
- brand-sensitive final decision -> **Owner**

### Writeback Targets

- `06-Growth/Creative/`
- `06-Growth/Experiments/Creative/`
- asset request log

## AI 10 — Video Briefs / Scripts

### Workflow Name

`AI10_Video_Brief`

### Purpose

Generate video brief, script, and scene structure from an approved growth brief.

### Trigger

- approved campaign with video deliverable
- launch promo request
- product demo content request
- onboarding explainer request

### Execution Mode

- `Draft`

### Input Payload

```json
{
  "video_request_id": "VID-044",
  "growth_brief_link": "[[Spring Signup Growth Brief]]",
  "goal": "Create a 20-second promo video for trial signup",
  "audience": "US barbershop owners",
  "hook": "Start taking bookings and reminders fast",
  "cta": "Start free trial",
  "product_truth_links": [
    "[[Booking Flow MVP Product Brief]]"
  ],
  "approved_claims_link": "[[Approved Claims and Angles]]",
  "asset_dependencies": [
    "AI-11 visuals",
    "AI-2 UI screenshots if needed"
  ]
}
```

### Expected Output Schema

```json
{
  "agent": "AI-10",
  "workflow": "video_brief",
  "video_request_id": "VID-044",
  "status": "done",
  "video_brief": {
    "goal": "20-second signup promo",
    "format": "short promo",
    "hook": "Start taking bookings and reminders fast",
    "cta": "Start free trial"
  },
  "script": [
    {
      "scene": 1,
      "duration_sec": 5,
      "text": "Still losing bookings to messy scheduling?"
    },
    {
      "scene": 2,
      "duration_sec": 7,
      "text": "VuriumBook helps shops get booking and reminders running fast."
    },
    {
      "scene": 3,
      "duration_sec": 8,
      "text": "Start free trial and simplify your daily flow."
    }
  ],
  "dependencies_needed": [
    "AI-11 visual set",
    "Optional UI footage from AI-2"
  ],
  "escalate_to": "Owner",
  "reason": "Final publish/review required"
}
```

### Safe Mode Rules

- may generate brief / script / scene pack
- may not publish final asset automatically
- must not invent unsupported capabilities
- demos must reflect actual product truth

### Escalation Rules

- unclear product behavior -> **AI 6**
- risky messaging claim -> **AI 7**
- need UI capture or product visuals -> **AI 2**
- final approval or publishing -> **Owner**

### Writeback Targets

- `06-Growth/Video/`
- `06-Growth/Video/Scripts/`
- campaign asset notes

## AI 5 — Research Briefs

### Workflow Name

`AI5_Research_Brief`

### Purpose

Create and fill a source-backed research brief for external dependency tasks.

### Trigger

- task tagged `external_dependency`
- task tagged `vendor_unknown`
- policy / compliance unknown detected
- AI 6 or AI 7 requests external truth
- AI 3 planning intake says `requires_ai5=true`

### Execution Mode

- `Queue + Draft`

### Input Payload

```json
{
  "research_id": "R-203",
  "task_id": "TASK-123",
  "topic": "SMS consent wording requirements for booking reminders",
  "questions": [
    "What kind of consent language is required?",
    "Are reminder messages treated differently from marketing?",
    "What opt-out wording is required?"
  ],
  "target_sources": [
    "official vendor docs",
    "official policy docs"
  ],
  "related_links": [
    "[[Booking Flow MVP Product Brief]]"
  ]
}
```

### Expected Output Schema

```json
{
  "agent": "AI-5",
  "workflow": "research_brief",
  "research_id": "R-203",
  "task_id": "TASK-123",
  "status": "done",
  "facts": [
    "Reminder messaging still requires clear user consent in documented flows",
    "Opt-out language requirements depend on the message category and provider policy"
  ],
  "inferences": [
    "Current signup copy may be too vague if it does not clearly describe reminder consent"
  ],
  "open_questions": [
    "Whether current wording satisfies provider-specific examples"
  ],
  "source_summary": [
    {
      "source_type": "official_policy",
      "topic": "consent requirements"
    }
  ],
  "escalate_to": "AI-7",
  "reason": "Implementation constraints must now be translated"
}
```

### Safe Mode Rules

- only source-backed research
- facts must be separate from inferences
- no code
- no product decisions
- no unsupported legal certainty

### Escalation Rules

- hidden business tradeoff -> **Owner**
- implementation translation needed -> **AI 7**
- planning continuation -> **AI 3**

### Writeback Targets

- `07-Research/`
- `07-Research/AI5-Research-Brief-*.md`
- handoff note to AI 7 / AI 3

## Common n8n Wrapper Schema

Use this envelope for all five AI workflows.

### Standard Input Envelope

```json
{
  "meta": {
    "workflow_name": "AI8_Growth_Brief",
    "timestamp": "2026-04-15T10:00:00Z",
    "trigger_source": "campaign_request",
    "risk_level": "low"
  },
  "context": {
    "canonical_links": [
      "[[Current Offer]]",
      "[[Approved Claims and Angles]]"
    ],
    "constraints": [
      "No unsupported claims"
    ]
  },
  "payload": {}
}
```

### Standard Output Envelope

```json
{
  "agent": "AI-8",
  "workflow": "AI8_Growth_Brief",
  "status": "done",
  "result": {},
  "escalate_to": "none",
  "reason": "",
  "writeback_targets": [],
  "next_step": ""
}
```

## n8n Node Pattern

For each workflow, use roughly this node shape:

1. Trigger
2. Normalize / Set Fields
3. Build Context
4. LLM / AI Node
5. JSON Parse / Validate
6. If escalation is needed
7. Writeback note / queue update
8. Notify next owner if needed

## Validation Rules

Before accepting AI output in `n8n`:

- verify required keys exist
- verify `status` is valid
- verify `escalate_to` is in the approved list
- verify JSON parses cleanly
- reject malformed output into a fallback error lane

### Fallback Lane

If malformed:

- set `status = blocked`
- create system error note
- notify AI 3 or Owner depending on severity

## Rollout Order

### Phase 1

- AI 3 Planning Intake
- AI 3 QA Scan
- AI 8 Growth Brief

### Phase 2

- AI 11 Creative Variants
- AI 10 Video Brief

### Phase 3

- AI 5 Research Brief

This order gives:

- structure first
- growth next
- assets next
- external research after the base workflow is stable

## Final Principle

These workflows should make the system:

- faster
- more structured
- more reusable
- less dependent on Owner for routine orchestration

But they must not:

- replace approvals
- mutate truth silently
- act outside role boundaries
