---
type: reference
status: active
created: 2026-04-15
updated: 2026-04-15
owner: AI 3
source_of_truth: true
---

# Automation Workflow Layer

> Part of [[Home]] > System | See also: [[00-System/System-Index|System Index]], [[00-System/AI-Automation-Policy|AI Automation Policy]], [[11-Reference/Automation-Routing-Reference|Automation Routing Reference]], [[AI-Core-Manifesto]], [[AI-Work-Split]], [[00-System/Self-Improvement-Layer|Self-Improvement Layer]], [[08-Runbooks/System/Escalation-Matrix|Escalation Matrix]], [[08-Runbooks/System/KPI-Metrics-Layer|KPI & Metrics Layer]], [[04-Tasks/Workflow-Queue|Workflow Queue]], [[04-Tasks/Workflow-Trigger-Labels|Workflow Trigger Labels]], [[04-Tasks/Handoffs/README|Handoffs]]

## Purpose

Define how work is classified, routed, handed off, and written back across the `Owner + 11 AI` operating system.

This layer operationalizes governance. It does not replace governance.

## Core Principle

Automation may increase speed, but it must not reduce truth, control, or safety.

Automation may:

- detect triggers
- classify work
- assemble canonical context
- prepare drafts
- maintain queue visibility
- create handoff scaffolding

Automation must not:

- bypass ownership
- bypass AI 5 / AI 7 when external truth or compliance translation is required
- bypass AI 3 planning or review gates for non-trivial work
- bypass Owner approval where approval is required
- invent product, pricing, compliance, or technical truth

## Automation-Level Rule

Not every AI should be automated the same way.

Use [[00-System/AI-Automation-Policy|AI Automation Policy]] as the canonical source for:

- which AI may run only manually
- which AI should be queue-only
- which AI may draft automatically
- which AI may safely auto-execute low-risk work
- which AI may auto-route only under emergency conditions

Use [[11-Reference/Automation-Routing-Reference|Automation Routing Reference]] when you need the practical trigger table and first-wave automation pack.

## Standard Automation Pattern

1. **Trigger** — an event appears.
2. **Classification** — determine lane, risk, and whether external truth or approval is needed.
3. **Context Assembly** — load canonical docs, runbooks, templates, and constraints.
4. **AI Execution** — the routed AI performs only its lane-owned role.
5. **Structured Output** — result, status, next step, escalation, and writeback targets.
6. **Knowledge Writeback** — durable outputs go into the correct canonical note types.
7. **Handoff / Approval / Completion** — move to next owner, wait for approval, or close.

Blocked or risky branches must use [[08-Runbooks/System/Escalation-Matrix|Escalation Matrix]] instead of ad hoc routing.

## Routing Rules

Route to:

- **AI 1** for backend, API, infra, CI/CD, and backend-adjacent technical docs
- **AI 2** for frontend, UI, responsive, browser/device verification, and user-facing flow work
- **AI 3** for non-trivial planning, review-gate coordination, QA scans, queue ownership, and handoff structure
- **AI 4** for incidents, rollback, urgent hotfixes, or emergency-review lens
- **AI 5** for external truth, vendor behavior, policy, or compliance research
- **AI 6** for product framing, MVP boundary, scope, and prioritization clarity
- **AI 7** for compliance/system requirement translation and risky wording constraints
- **AI 8** for growth strategy, campaign direction, funnel optimization, and positioning
- **AI 9** for support replies, lead follow-up, onboarding answers, and FAQ growth
- **AI 10** for promo/demo/social video execution
- **AI 11** for ad visuals, social creative, landing visuals, and creative variants
- **Owner** for secrets, portals, exceptions, legal/commercial judgment, and final go/no-go

## Canonical Workflow Families

### Product / Build Workflow

Owner intent -> AI 6 framing -> AI 5 research if needed -> AI 7 translation if needed -> AI 3 planning -> review gate -> AI 1 / AI 2 implementation -> AI 3 QA -> Owner verification

### External Dependency Workflow

Use for Telnyx, Stripe, Apple, Google OAuth, compliance-sensitive implementation, and vendor-rule work.

### Support / Email Workflow

Route to AI 9 first, then escalate to AI 1 / AI 2 / AI 6 / AI 7 / Owner based on ambiguity and risk.

### Growth / Content Workflow

AI 8 defines direction; AI 9 / AI 10 / AI 11 execute support, video, and creative work downstream.

### Emergency Workflow

Route immediately to AI 4, then AI 3 post-hotfix scan, then permanent cleanup back to AI 1 / AI 2.

## Trivial Task Fast Path

Fast path is allowed only when the task is:

- low-risk
- clearly in one lane
- not externally dependent
- not compliance-sensitive
- not architecturally meaningful

Fast path still requires source-of-truth checks and correct writeback if durable knowledge changes.

## Required Handoff Standard

Every meaningful handoff must include:

- current status
- what was completed
- what remains
- canonical notes to read
- unresolved questions
- next owner
- blocking or non-blocking
- recommended next action

## Queue and Trigger Support Notes

Canonical notes for workflow operations:

- [[04-Tasks/Workflow-Queue|Workflow Queue]]
- [[04-Tasks/Workflow-Trigger-Labels|Workflow Trigger Labels]]
- [[04-Tasks/Handoffs/README|Handoffs]]

## Weekly Review Loop

AI 3 should use [[08-Runbooks/System/KPI-Metrics-Layer|KPI & Metrics Layer]] as the canonical weekly review and system-improvement loop.

When weekly review turns into an actual operating-model change, route it through [[00-System/Self-Improvement-Layer|Self-Improvement Layer]] and log the approved result in [[10-Decisions/System-Changes/README|System Changes Log]].

## Final Principle

Automation should move work to the right AI at the right time, with the right context, and leave behind the right knowledge, without bypassing truth, ownership, or approval.
