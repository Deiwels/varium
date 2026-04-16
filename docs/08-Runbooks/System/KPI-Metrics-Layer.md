---
type: runbook
status: active
created: 2026-04-15
updated: 2026-04-15
owner: AI 3
source_of_truth: true
---

# KPI & Metrics Layer

> Part of [[Home]] > Runbooks | See also: [[08-Runbooks/System/Escalation-Matrix|Escalation Matrix]], [[00-System/Automation-Workflow-Layer|Automation Workflow Layer]], [[AI-Profiles/AI-3-Verdent|AI 3 — Verdent]], [[04-Tasks/Workflow-Queue|Workflow Queue]]

## Purpose

Define how performance of each AI role and the system overall is measured.

Goals:

- understand what works and what breaks
- identify weak AI roles
- optimize workflows
- improve speed and quality
- reduce Owner overload
- ensure the system scales

## Core Principle

What is not measured cannot be improved.

Metrics must be:

- simple
- actionable
- tied to roles
- based on real outcomes, not vanity numbers

## Measurement Types

### Speed Metrics

How fast work is done.

### Quality Metrics

How correct and stable output is.

### Efficiency Metrics

How much rework is needed.

### Business Metrics

Real-world results like growth, users, or revenue movement.

## Global System KPIs

### Delivery Speed

- average time: task -> completion
- average time: idea -> launch

### Planning Quality

- percent of tasks requiring re-plan
- percent of tasks blocked due to unclear scope

### Rework Rate

- percent of tasks redone after QA
- percent of tasks fixed after release

### Incident Rate

- number of production incidents per week
- mean time to recovery (MTTR)

### Documentation Health

- percent of tasks with proper docs
- percent of outdated docs detected

## Role-Based KPIs

### AI 1 — Backend

Metrics:

- bug rate after deploy
- API failure rate
- incident contribution percentage
- deploy success rate

Target:

- low bugs
- stable backend
- predictable deployments

### AI 2 — Frontend

Metrics:

- UI bug rate
- responsiveness issues
- visual mismatch rate
- device compatibility errors

Target:

- clean UI
- consistent UX
- minimal regressions

### AI 3 — Planner / QA

Metrics:

- percent of tasks with complete plan
- percent of tasks needing re-plan
- percent of issues caught before release
- QA coverage rate

Target:

- no chaotic tasks
- high pre-release detection

### AI 4 — Emergency

Metrics:

- response time to incident
- MTTR
- rollback success rate

Target:

- fast stabilization
- minimal damage

### AI 5 — Research

Metrics:

- percent of tasks needing re-research
- percent of incorrect assumptions caught later
- clarity of briefs

Target:

- high factual accuracy
- zero hallucinated facts

### AI 6 — Product

Metrics:

- percent of features actually used by users
- percent of scope changes after start
- clarity score from planning feedback

Target:

- build correct features
- minimal scope confusion

### AI 7 — Compliance

Metrics:

- percent of compliance issues discovered late
- percent of tasks blocked due to unclear rules
- policy violation incidents

Target:

- zero compliance bugs
- clear requirements upfront

### AI 8 — Growth

Metrics:

- conversion rate
- signup -> activation percentage
- campaign success rate
- experiment success percentage

Target:

- measurable growth
- optimized funnel

### AI 9 — Support

Metrics:

- response time
- resolution rate
- escalation rate
- FAQ growth rate

Target:

- fast replies
- correct answers
- reduced Owner involvement

### AI 10 — Video

Metrics:

- video production speed
- campaign usage rate
- engagement, if tracked

Target:

- fast content output
- usable assets

### AI 11 — Creative

Metrics:

- creative production speed
- number of variations per experiment
- ad usage rate

Target:

- fast iteration
- high volume of ideas

## Cross-System Metrics

### Handoff Efficiency

- number of failed handoffs
- number of unclear handoffs

### Knowledge Usage

- percent of tasks using the correct source of truth
- number of duplicated notes created

### Escalation Health

- percent of tasks escalated correctly
- percent of tasks where escalation was skipped when it should not have been

## Weekly Review System

Weekly review owner:

- **AI 3** prepares the review
- **Owner** decides which system changes actually get prioritized

### Step 1

Collect metrics.

### Step 2

Identify:

- slowest AI lane
- highest-error lane
- most escalations
- most blocked workflows

### Step 3

Fix:

- unclear roles
- missing docs
- broken workflow
- weak templates
- bad escalation paths

## Red Flags (Critical)

Immediate action is required if:

- incident rate climbs
- the same bug repeats
- AI guess instead of escalating
- Owner is overloaded
- tasks pile up in queue
- conflicting outputs appear between lanes

## Improvement Loop

For every problem:

1. detect issue through metrics
2. find root cause
3. fix the role, doc, workflow, template, or escalation path
4. update the system
5. measure again

## AI 3 Usage Rule

AI 3 should use this layer to:

- run the weekly review process
- detect systemic bottlenecks
- open follow-up tasks when metrics show drift
- propose workflow, template, or documentation improvements before chaos spreads

This does not let AI 3 override lane truth or Owner priorities. It gives AI 3 a canonical improvement loop.

## Final Principle

Measure -> understand -> fix -> repeat.

That is how the AI system evolves into a real company.
