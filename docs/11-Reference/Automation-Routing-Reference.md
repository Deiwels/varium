---
type: reference
status: active
doc_class: reference-only
created: 2026-04-15
updated: 2026-04-16
owner: AI 3
source_of_truth: false
---

# Automation Routing Reference

> Part of [[Home]] > Reference | See also: [[00-System/AI-Automation-Policy|AI Automation Policy]], [[00-System/Automation-Workflow-Layer|Automation Workflow Layer]], [[00-System/Real-Tools-Integration-Layer|Real Tools Integration Layer]], [[08-Runbooks/System/Operational-Pipelines-MVP|Operational Pipelines MVP]], [[08-Runbooks/System/n8n-Implementation-Pack-AI3-AI5-AI8-AI10-AI11|n8n Implementation Pack — AI 3 / AI 5 / AI 8 / AI 10 / AI 11]]

## Purpose

Define which triggers should activate which AI, under what automation mode, and what output each agent must produce.

This is the practical routing reference for the automation layer.

It does not define new safety policy; it applies the guardrails from the canonical governance docs and the automation reference docs.

For concrete `n8n` payload contracts, envelopes, validation rules, and per-agent workflow shapes, use [[08-Runbooks/System/n8n-Implementation-Pack-AI3-AI5-AI8-AI10-AI11|n8n Implementation Pack — AI 3 / AI 5 / AI 8 / AI 10 / AI 11]].

## Automation Modes

- **Manual** = only manually invoked
- **Queue** = auto-routed into queue, no execution until picked up
- **Draft** = auto-generates draft output, no final action
- **Safe Auto** = may auto-complete low-risk work
- **Scheduled** = runs on timer / schedule
- **Emergency** = auto-runs only for incidents

## Routing Table

| Trigger | AI | Automation Mode | Input | Output | Next Step |
|---|---|---|---|---|---|
| New non-trivial feature request | AI 3 | Queue + Draft | task request, source docs | plan skeleton / intake structure | AI 6 or AI 5 or full planning |
| Task moved to `Waiting for QA` | AI 3 | Safe Auto | plan, implementation notes, changed-files summary | QA scan | Owner / queue / follow-up |
| Weekly scheduled review | AI 3 | Scheduled | KPI docs, queue, incidents, blockers | weekly system review | Owner + improvements |
| KPI threshold breach | AI 3 | Draft | KPI signal, affected lane | improvement proposal | review gate |
| New campaign request | AI 8 | Draft | business goal, audience, current offer | growth brief | AI 10 / AI 11 / AI 9 |
| Drop in funnel KPI | AI 8 | Draft | funnel metrics, campaign notes | experiment proposal | Owner / AI 6 / AI 11 |
| Repeated lead objections | AI 8 | Draft | lead notes, support patterns | messaging update proposal | AI 9 / AI 11 |
| Approved creative request | AI 11 | Draft / Safe Auto internal | growth brief, brand rules, approved claims | creative variants / prompts | Owner review or campaign use |
| Landing page visual request | AI 11 | Draft | page goal, hook, CTA, audience | visual concepts | AI 8 / Owner |
| Experiment needs new ad image | AI 11 | Safe Auto internal | experiment brief | labeled creative variants | campaign testing |
| Approved video request | AI 10 | Draft | growth brief, product truth, CTA | script / scene breakdown / prompt pack | Owner review / production |
| Product demo content request | AI 10 | Draft | product brief, UI references | demo script | AI 2 refs / Owner |
| External dependency task opened | AI 5 | Queue + Draft | question list, task brief | research brief shell | research execution |
| Vendor/compliance unknown appears | AI 5 | Draft | unresolved question, doc links | source-backed facts brief | AI 7 / AI 3 |
| Task tagged external-dependent | AI 5 | Queue | task metadata | research task note | AI 5 execution |

## First-Wave Automation Pack

These five agents are the best first automation wave after support / lead inbox automation:

1. AI 3
2. AI 8
3. AI 11
4. AI 10
5. AI 5

## AI 3 — Planning Intake, QA, Weekly Review

### Best Modes

- `Queue + Draft` for planning intake
- `Safe Auto` for QA scan
- `Scheduled` for weekly review

### Best Triggers

- new non-trivial task
- workflow queue item with `new` / non-trivial state
- task moved to `Waiting for QA`
- implementation marked complete
- hotfix completed
- weekly schedule trigger
- KPI threshold breach

### Output Contract

- `Execution Plan Skeleton`
- `Needed Inputs`
- `Missing Truth`
- `Recommended Lane Sequence`
- `QA Scan`
- `Pass / Fail / Needs Follow-up`
- `Weekly System Review`
- `Top 3 Bottlenecks`
- `Improvement Proposals`

### Tool / System Connections

- `04-Tasks/Workflow-Queue.md`
- `04-Tasks/*-Plan.md`
- `04-Tasks/*QA-Scan*.md`
- `08-Runbooks/System/KPI-Metrics-Layer.md`
- `09-Incidents/`
- `10-Decisions/System-Changes/`
- schedule trigger
- task-status trigger
- incident logs

### Practical Flow

`New Task -> classify trivial / non-trivial -> if non-trivial -> AI 3 planning intake`

`Implementation complete -> AI 3 QA scan`

`Weekly timer -> AI 3 system review`

## AI 8 — Growth Briefs

### Best Modes

- `Draft`
- optionally `Safe Auto` for internal brief generation only

### Best Triggers

- campaign request
- low-conversion KPI
- repeated lead objections
- launch preparation
- onboarding drop-off pattern

### Output Contract

- `Growth Brief`
- `Campaign Angle`
- `Audience + CTA`
- `Asset Requests`

### Tool / System Connections

- campaign-request intake
- KPI / conversion data
- lead objections and support-pattern summaries
- onboarding-friction notes
- AI 6 product docs
- `06-Growth/Growth-Backlog.md`
- `06-Growth/Funnel-Audit.md`
- `06-Growth/Experiments/`
- `06-Growth/Landing-Pages/`
- approved claims / angles docs

### Practical Flow

`Campaign request / KPI drop / repeated objections -> AI 8 -> Growth Brief -> route to AI 11 / AI 10 / AI 9`

## AI 11 — Creative Variants

### Best Modes

- `Draft`
- `Safe Auto internal` for low-risk internal variants only

### Best Triggers

- approved growth brief
- creative request from AI 8
- landing-page visual request
- experiment needing new variants

### Output Contract

- `Creative Brief`
- `Prompt Pack`
- `Creative Variants`
- `Variant Labels`

### Tool / System Connections

- AI 8 growth brief
- brand guide
- audience
- CTA
- approved claims
- compliance constraints when needed
- image-generation tool
- asset storage
- experiment tracker
- `06-Growth/Creative/`
- `06-Growth/Creative/Ads/`
- `06-Growth/Creative/Landing-Pages/`
- `06-Growth/Experiments/Creative/`

### Practical Flow

`AI 8 brief approved -> AI 11 generates variants -> Owner / reviewer selects -> campaign uses approved assets`

## AI 10 — Video Briefs and Scripts

### Best Mode

- `Draft`

### Best Triggers

- approved campaign with video deliverable
- launch promo request
- product demo request
- onboarding explainer request

### Output Contract

- `Video Brief`
- `Script`
- `Scene Outline`
- `Prompt Pack`
- `Asset Dependency List`

### Tool / System Connections

- AI 8 growth brief
- AI 6 product truth
- approved claims
- audience
- CTA
- AI 11 asset references
- AI 2 UI / product references
- video-generation platform
- script-doc pipeline
- asset folder
- review queue
- `06-Growth/Video/`
- `06-Growth/Video/Scripts/`
- `06-Growth/Video/Promos/`
- `06-Growth/Experiments/Video/`

### Practical Flow

`AI 8 brief approved -> AI 10 creates script + scenes -> optional AI 11 visuals / AI 2 refs -> Owner review -> publish lane`

## AI 5 — Research Briefs

### Best Modes

- `Queue + Draft`

### Best Triggers

- task tagged `external_dependency`
- task tagged `vendor_unknown`
- task tagged `policy_risk`
- AI 6 flags dependency on external truth
- AI 7 requests source-backed facts

### Output Contract

- `Research Brief`
- `Facts`
- `Inferences`
- `Open Questions`
- `Sources`

### Tool / System Connections

- task intake
- vendor / policy tags
- question intake from AI 6 / AI 7 / AI 3
- external-dependency marker
- `07-Research/`
- `07-Research/AI5-Research-Brief-*.md`
- `05-Compliance/`
- `04-Tasks/`

### Practical Flow

`Task marked external-dependent -> AI 5 research brief shell -> collect questions -> fill facts -> handoff to AI 7 / AI 3`

## Combined Flow Pattern

`New Task / KPI / Campaign / Unknown Policy / QA-ready signal`

`-> Router decides lane`

- planning -> AI 3
- growth -> AI 8
- creative -> AI 11
- video -> AI 10
- research -> AI 5

`-> agent creates draft output`

`-> output logged to Obsidian`

`-> next owner notified`

`-> approval / follow-up / execution`

## First Priority Order

1. AI 3
   - planning intake
   - QA scan
   - weekly review
2. AI 8
   - growth brief generation
3. AI 11
   - creative variants
4. AI 10
   - video scripts / briefs
5. AI 5
   - research brief creation

## Most Important Rule

These five agents should create:

- briefs
- drafts
- structure
- variants
- verified research

They should not:

- change pricing
- publish risky content without review
- invent product truth
- bypass Owner

## Final Principle

Automate these five agents mainly as draft, structure, and routing lanes.

Use them to create momentum, clarity, and assets, not to silently make final business-risk decisions.
