---
type: runbook
status: active
created: 2026-04-15
updated: 2026-04-15
owner: AI 3
source_of_truth: true
---

# Escalation Matrix

> Part of [[Home]] > Runbooks | See also: [[AI-Behavior-Protocol]], [[AI-Session-Start-Protocol]], [[00-System/Automation-Workflow-Layer|Automation Workflow Layer]], [[00-System/Real-Tools-Integration-Layer|Real Tools Integration Layer]], [[08-Runbooks/System/KPI-Metrics-Layer|KPI & Metrics Layer]], [[00-System/Self-Improvement-Layer|Self-Improvement Layer]]

## Purpose

Define **who to escalate to, when, and why** across the VuriumBook AI Operating System.

This exists to:

- eliminate confusion
- prevent guessing
- prevent wrong decisions
- reduce Owner overload
- keep workflows moving

## Core Rule

If you are unsure: **escalate, do not guess**.

Wrong action is worse than delayed action.

## Escalation Priority

When multiple escalations are possible, follow this order:

1. ownership-based escalation
2. risk-based escalation
3. source-of-truth escalation
4. Owner escalation last, unless the issue is already critical or Owner-only

## Product / Scope

Problem examples:

- unclear feature
- unclear behavior
- unclear scope
- mismatch between expectation and docs

Escalate to:

- **AI 6**

If still unclear:

- **Owner**

## Backend / Logic

Problem examples:

- API unclear
- data flow unclear
- backend bug
- server behavior unknown

Escalate to:

- **AI 1**

## Frontend / UI

Problem examples:

- UI unclear
- flow broken
- responsive issues
- visual inconsistency

Escalate to:

- **AI 2**

## Planning / Task Chaos

Problem examples:

- no plan
- messy scope
- unclear next step
- task too big

Escalate to:

- **AI 3**

## External / Unknown Facts

Problem examples:

- vendor behavior unknown
- API docs unclear
- policy unclear
- assumptions would be required

Escalate to:

- **AI 5**

## Compliance / Policy

Problem examples:

- SMS rules
- 10DLC / TFV
- billing policy
- wording risk
- legal-like constraints

Escalate to:

- **AI 7**

If high-risk:

- **Owner**

## Growth / Marketing

Problem examples:

- unclear campaign
- unclear messaging
- funnel issue
- positioning unclear

Escalate to:

- **AI 8**

## Support / Customer

Problem examples:

- email reply needed
- customer confused
- lead question
- onboarding issue

Handle first in:

- **AI 9**

Escalate from there if:

- product unclear -> **AI 6**
- technical -> **AI 1 / AI 2**
- compliance -> **AI 7**
- sensitive / financial / legal / account-risk -> **Owner**

## Video Content

Problem examples:

- promo or demo video needed
- unclear script
- motion-content execution needed

Escalate to:

- **AI 10**

## Creative / Ads

Problem examples:

- ad images needed
- landing or social visuals needed
- creative variants needed

Escalate to:

- **AI 11**

## Incident / Production

Problem examples:

- system down
- critical bug
- urgent fix needed

Escalate to:

- **AI 4**

Always notify:

- **Owner**

## Billing / Payments

Problem examples:

- refund
- charge issue
- billing error
- pricing exception

Escalate to:

- **Owner**

AI may assist, but may not decide.

## Secrets / Portals

Problem examples:

- credentials needed
- portal change required
- protected configuration change

Escalate to:

- **Owner only**

## Risky / Unknown

Problem examples:

- unsure answer
- high uncertainty
- could affect user or business

Rule:

- stop
- escalate

## Escalation Format (Mandatory)

Every escalation must include:

**Issue:**
`{{what is wrong}}`

**Why blocked:**
`{{what is missing}}`

**What I checked:**
`{{docs / context}}`

**Suggested target:**
`{{AI-X}}`

**Urgency:**
`low / medium / high / critical`

## Urgency Levels

### Low

- non-blocking
- improvement
- nice-to-have

### Medium

- affects workflow
- not blocking system

### High

- blocking progress
- affects user experience

### Critical

- production issue
- financial risk
- compliance risk

## Forbidden Behavior

Do not:

- guess
- invent answers
- skip escalation
- escalate randomly
- escalate without context
- escalate to the wrong role

## Golden Rule

Correct escalation keeps the system moving.

Wrong action breaks the system faster than a pause.

## Final Principle

Escalation is not failure.

It is correct system behavior.
