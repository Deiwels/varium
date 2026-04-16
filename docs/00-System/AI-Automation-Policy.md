---
type: reference
status: active
created: 2026-04-15
updated: 2026-04-15
owner: AI 3
source_of_truth: true
---

# AI Automation Policy

> Part of [[Home]] > System | See also: [[00-System/Automation-Workflow-Layer|Automation Workflow Layer]], [[00-System/Real-Tools-Integration-Layer|Real Tools Integration Layer]], [[08-Runbooks/System/Escalation-Matrix|Escalation Matrix]], [[AI-Profiles/README|AI Profiles]], [[AI-Core-Manifesto]]

## Purpose

Define how each AI should be automated.

Not every AI should be automated the same way.

Some agents should run:

- automatically on trigger
- automatically with guardrails
- only through queue
- only through approval
- only manually

The goal is to:

- maximize speed
- preserve safety
- reduce Owner overload
- prevent role confusion
- avoid uncontrolled actions

## Core Principle

The best automation system is not the one where every AI runs automatically.

It is the one where:

- the correct AI is triggered
- at the correct moment
- with the correct context
- under the correct level of control
- and with the correct escalation path

## Automation Levels

### Level 0 — Manual Only

The AI never auto-runs. Owner or another approved flow must invoke it.

### Level 1 — Queue-Only

The AI may be routed automatically into queue, but does not act until explicitly picked up.

### Level 2 — Draft Automation

The AI may auto-generate drafts, prep packages, or structured outputs, but no final action happens automatically.

### Level 3 — Safe Auto-Execution

The AI may auto-run and complete low-risk repeatable work if strict rules are satisfied.

### Level 4 — Emergency Auto-Routing

The AI may be auto-triggered immediately under incident conditions, but still operates under strict emergency rules.

## Agent-by-Agent Policy

### Owner

- **Best automation level:** `Level 0`
- **Allowed automation:** notifications, approval packets, prepared drafts, queue items
- **Never automate:** approvals, secrets, portal actions, pricing exceptions, legal/risk decisions

### AI 1 — Backend / Infra / Docs

- **Best automation level:** `Level 1` for normal work, `Level 2` for prep support
- **Good automation:** queue routing, issue summaries, doc-update suggestions, implementation-ready handoff shells
- **Never auto-execute:** production infra changes, CI/CD changes, backend changes without plan, incident-risky changes

### AI 2 — Frontend / UI

- **Best automation level:** `Level 1` for normal work, `Level 2` for prep support
- **Good automation:** UI queue routing, verification checklists, UI summaries, screenshot/demo requests
- **Never auto-execute:** broad redesigns, pricing/payment-sensitive UI, large flow changes without plan

### AI 3 — Planner / QA / System Governor

- **Best automation level:** `Level 2` to `Level 3`
- **Good automation:** non-trivial task intake, planning skeletons, post-implementation QA scans, weekly system review, missing-doc/handoff checks, KPI-driven improvement proposals
- **Needs review for:** structural changes, changes to canonical truth, rule rewrites

### AI 4 — Emergency / Hotfix

- **Best automation level:** `Level 4`
- **Good automation:** critical-alert routing, incident context loading, Owner notification, rollback-runbook opening, hotfix-log shell creation
- **Never auto-use in normal work:** routine coding, feature work, non-emergency optimization, broad refactors

### AI 5 — External Research

- **Best automation level:** `Level 1` to `Level 2`
- **Good automation:** research-brief shells, external-dependency routing, question collection from AI 6 / AI 7 / AI 3
- **Never auto-use by default:** internal-only tasks, strategy, code generation, final decisions

### AI 6 — Product Strategist

- **Best automation level:** `Level 1` to `Level 2`
- **Good automation:** product-brief skeletons, Owner-intent summarization, scope-clarity flags, repeated product-confusion intake
- **Needs Owner awareness for:** major roadmap changes, reprioritization, strategic shifts

### AI 7 — Compliance Executor

- **Best automation level:** `Level 1` to `Level 2`
- **Good automation:** requirement drafts after AI 5, wording review intake, checklist shells
- **Never auto-use for:** legal signoff, high-risk policy interpretation without review, final approval of regulated actions

### AI 8 — Growth / Marketing Operator

- **Best automation level:** `Level 2` to `Level 3` for low-risk internal planning, `Level 1` for major campaign shifts
- **Good automation:** growth-brief drafts, funnel analysis, lead/source pattern tagging, experiment ideas, asset requests for AI 10 / AI 11
- **Never auto-execute:** major strategic pivots, risky publishing, unsupported claims, product-truth changes

### AI 9 — Support / Email Agent

- **Best automation level:** `Level 2` to `Level 3`
- **Good automation:** support inbox replies, onboarding replies, lead first replies, FAQ suggestions, safe template follow-ups, inquiry tagging
- **Never auto-execute:** refunds, pricing exceptions, disputes, legal/compliance-sensitive issues, billing commitments, angry escalations, unclear cases

### AI 10 — Video Agent

- **Best automation level:** `Level 1` to `Level 2`
- **Good automation:** video briefs, scripts, scene structure, prompt packs, asset requests
- **Never auto-execute:** autonomous publishing, unreviewed campaign claims, unclear-feature demos, brand-sensitive final videos

### AI 11 — Creative / Ad Image Agent

- **Best automation level:** `Level 2` to `Level 3` for safe internal variants, `Level 1` for brand-sensitive campaigns
- **Good automation:** image prompts, concept variants, experiment labels, landing-visual drafts, static support for AI 10
- **Never auto-execute:** misleading creatives, compliance-sensitive claims, final publication without review, visuals that imply unsupported behavior

## Best Automation by Workflow Type

### Safe High-Automation Workflows

- AI 3 QA scans
- AI 3 weekly review
- AI 9 routine support replies
- AI 9 lead first replies
- AI 8 growth brief drafts
- AI 10 script drafts
- AI 11 creative variants
- AI 5 research brief shells

### Medium-Automation Workflows

- AI 6 product brief drafts
- AI 7 compliance requirement drafts
- AI 1 doc-update suggestions
- AI 2 verification checklist prep

### Low-Automation / Human-Gated Workflows

- AI 1 backend production actions
- AI 2 major UI changes
- AI 8 major campaign shifts
- AI 10 final external video release
- AI 11 final ad publication

### Human-Only / Manual Approval Workflows

- pricing changes
- refunds
- credential use
- portal changes
- launch approval
- legal-sensitive commitments

## Best Trigger Design by AI

- **AI 1** -> backend-tagged queue item, post-plan assignment, incident-cleanup handoff, doc-drift detection
- **AI 2** -> frontend-tagged queue item, approved UI workstream, responsive bug intake, screenshot/demo request
- **AI 3** -> non-trivial intake, post-implementation, weekly schedule, KPI threshold breach, missing handoff/docs
- **AI 4** -> critical alert, high/critical incident, direct Owner emergency activation
- **AI 5** -> external-dependency tag, vendor/policy question, AI 6 or AI 7 request
- **AI 6** -> feature idea, repeated product confusion, unclear scope, priority conflict
- **AI 7** -> AI 5 completion, compliance-risk support/comms, ad/video claim review
- **AI 8** -> campaign request, KPI drop, funnel issue, launch need, repeated lead objections
- **AI 9** -> support email, lead form, onboarding question, follow-up reminder
- **AI 10** -> approved campaign with video deliverable, launch promo request, product demo request
- **AI 11** -> approved campaign with static creative deliverable, experiment-variant request, landing-page creative request

## Handoff Automation Rule

Automation must not just trigger work. It must hand off correctly.

Every automated handoff must include:

- what triggered the task
- what is already known
- source-of-truth links
- current risk level
- what the receiving AI must do
- whether the action is safe, draft-only, approval-required, or queue-only

Without this, automation creates confusion instead of leverage.

## Safe Automation Matrix

| AI | Best automation level | Best use |
|---|---|---|
| Owner | `L0` | approvals only |
| AI 1 | `L1-L2` | queue + prep |
| AI 2 | `L1-L2` | queue + prep |
| AI 3 | `L2-L3` | planning + QA + review |
| AI 4 | `L4` | emergency only |
| AI 5 | `L1-L2` | research briefs |
| AI 6 | `L1-L2` | product briefs |
| AI 7 | `L1-L2` | compliance drafts/reviews |
| AI 8 | `L2-L3` | growth planning |
| AI 9 | `L2-L3` | support + lead replies |
| AI 10 | `L1-L2` | video briefs/scripts |
| AI 11 | `L2-L3` | creative variants |

## Golden Automation Rules

1. Automate intake before automating decisions.
2. Automate drafts before automating execution.
3. Automate safe repeatable work first.
4. Keep risky actions human-gated.
5. If an agent can create business risk, use draft mode first.
6. Every automation must write back into the knowledge system when durable knowledge changes.
7. Never let automation bypass:
   - Owner
   - AI 6 on product truth
   - AI 7 on compliance-sensitive wording
   - AI 3 on non-trivial structure

## Best Practical Rollout Order

### Phase 1

- AI 9 support inbox
- AI 9 lead replies
- AI 3 weekly review
- AI 3 QA scan triggers

### Phase 2

- AI 8 growth brief generation
- AI 11 creative variants
- AI 10 script generation
- AI 5 research brief creation

### Phase 3

- AI 6 product brief intake
- AI 7 compliance draft flow
- AI 1 / AI 2 queue automation

### Phase 4

- AI 4 incident routing
- KPI-triggered improvement suggestions
- repeated confusion -> FAQ / product / growth loops

## Final Principle

Do not automate every AI equally.

Automate:

- support and lead communication first
- planning, QA, and review support next
- growth assets and research prep next
- development queueing only after the communication / routing layer is stable

That sequence creates leverage without turning the system into chaos.
