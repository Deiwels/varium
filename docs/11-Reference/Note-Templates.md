---
type: reference
status: active
created: 2026-04-15
updated: 2026-04-15
owner: AI 3
source_of_truth: true
---

# Note Templates

> Part of [[Home]] > Reference | See also: [[00-System/Obsidian-Knowledge-System|Obsidian Knowledge System]], [[Vault Rules]], [[11-Reference/Reference-Index|Reference Index]]

Use these templates as the default starting point for important notes. Adapt them to the lane, but do not invent a random structure when a template already exists.

## AI Profile Template

```md
---
type: profile
status: active
created: YYYY-MM-DD
owner: AI N
source_of_truth: true
---

# AI N — Name

> Part of [[Home]] > [[AI-Profiles/README|AI Profiles]] | See also: [[AI-Core-Manifesto]], [[AI-Work-Split]]

## 1. Identity
## 2. Primary Responsibilities
## 3. Ownership Boundaries
## 4. Activation Triggers
## 5. Inputs
## 6. Outputs
## 7. Collaboration Rules
## 8. Non-goals
## 9. Escalation Rules
## 10. Success Criteria
```

## Product Brief Template

```md
---
type: product-brief
status: draft
created: YYYY-MM-DD
updated: YYYY-MM-DD
owner: AI 6
source_of_truth: true
---

# <Feature> Product Brief

> Part of [[Home]] > Product | See also: [[Product/Priorities]], [[Product/Roadmap]]

## Problem
## Primary User
## Desired Outcome
## MVP Scope
## Out of Scope
## Dependencies
## AI 5 Requirement Before Planning
## Product Acceptance Outcome
## Handoff
```

## Research Brief Template

```md
---
type: research-brief
status: active
created: YYYY-MM-DD
owner: AI 5
source_of_truth: false
---

# AI5 Research Brief — <Task>

> Part of [[Home]] > Research | See also: [[Tasks/In Progress]]

## Why this research exists
## Decision blocked on external facts
## Questions from AI 1
## Questions from AI 2
## Questions from AI 3
## Questions from AI 4
## Owner context / constraints
## AI 5 findings
## Sources
## Fact vs inference
## Hand-off to AI 7 and AI 3
```

## Compliance Requirement Template

```md
---
type: compliance-requirement
status: active
created: YYYY-MM-DD
owner: AI 7
source_of_truth: true
---

# Compliance Requirements — <Topic>

> Part of [[Home]] > Compliance | See also: [[Compliance/Control-Matrix]], [[Compliance/Implementation-Checklist]]

## Purpose
## Binding Constraint
## System Requirements
## Backend Requirements
## UI Requirements
## Documentation Requirements
## Monitoring Requirements
## Owner Action Requirements
## Sources
```

## Execution Plan Template

```md
---
type: plan
status: review
created: YYYY-MM-DD
owner: AI 3
source_of_truth: false
---

# <Task> Execution Plan

> Part of [[Home]] > Tasks | See also: [[Tasks/In Progress]], [[Architecture/Decision-Log|Decision Log]]

## Goal
## Scope
## Workstreams
## Acceptance Criteria
## Rollback Notes
## Dependencies
## 4-AI Plan Review Gate
- [ ] AI 1 reviewed backend / infra / data / integration risk
- [ ] AI 2 reviewed frontend / browser / mobile / UX risk
- [ ] AI 3 incorporated all feedback and published final plan
- [ ] AI 4 reviewed emergency / rollback / incident risk
- [ ] Owner approved the final plan

Blocked: yes — implementation does not start until all 5 items are green.
```

## QA Scan Template

```md
---
type: qa-scan
status: active
created: YYYY-MM-DD
owner: AI 3
source_of_truth: false
---

# QA Scan — <Date or Scope>

> Part of [[Home]] > Tasks | See also: [[Tasks/In Progress]], [[Tasks/Launch-Verification-Runbook]]

## Scope
## Findings
## Risks
## Verification Performed
## Remaining Unknowns
## Next Actions
```

## Runbook Template

```md
---
type: runbook
status: active
created: YYYY-MM-DD
owner: AI 3
source_of_truth: true
---

# <Process> Runbook

> Part of [[Home]] > Runbooks | See also: [[Tasks/In Progress]], [[Architecture/Decision-Log|Decision Log]]

## Purpose
## Preconditions
## Step-by-step Procedure
## Expected Outcome
## Failure Cases
## Rollback / Recovery
## Related Notes
```

## Decision Note Template

```md
---
type: decision-log
status: active
created: YYYY-MM-DD
owner: AI 3
source_of_truth: true
---

# <Decision Name>

> Part of [[Home]] > Decisions | See also: [[Architecture/Decision-Log|Decision Log]]

## Context
## Decision
## Reason
## Alternatives Considered
## Consequences
## Linked Notes
```

## Incident Report Template

```md
---
type: incident-report
status: active
created: YYYY-MM-DD
owner: AI 4
source_of_truth: false
---

# <Date> — <Incident Name>

> Part of [[Home]] > Incidents | See also: [[DevLog/YYYY-MM-DD]], [[Architecture/Decision-Log|Decision Log]]

## Summary
## Impact
## Trigger
## Immediate Fix
## Root Cause
## Follow-up Work
## Runbook / Decision Updates
```

## Growth Brief Template

```md
---
type: growth-brief
status: draft
created: YYYY-MM-DD
owner: AI 8
source_of_truth: false
---

# <Growth Topic>

> Part of [[Home]] > Growth | See also: [[Growth/Growth-Backlog]], [[Growth/Funnel-Audit]]

## Problem
## Funnel Stage
## Hypothesis
## Type (copy / process / product / compliance)
## Suggested Route
## Evidence
## Next Actions
```

## Support Reply Template

```md
# Support Reply — <Topic>

## Purpose
## Incoming message summary
## Source-of-truth links
## Draft reply
## Escalation note (if needed)
```

## Lead Follow-Up Template

```md
# Lead Follow-Up — <Lead or Segment>

## Goal
## Lead context
## Approved messaging links
## Draft follow-up
## CTA
## Escalation note (if needed)
```

## FAQ Entry Template

```md
# FAQ — <Question>

## Question
## Short answer
## Source-of-truth links
## Escalation rule
```

## Video Brief Template

```md
# Video Brief — <Campaign or Topic>

## Purpose
## Target audience
## Source-of-truth links
## Approved claims only
## Format
## CTA
## Escalation note if uncertainty exists
```

## Video Script Template

```md
# Video Script — <Campaign or Topic>

## Hook
## Scene breakdown
## Voiceover / copy
## Visual notes
## Claim check links
## CTA
```

## Creative Brief Template

```md
# Creative Brief — <Campaign or Topic>

## Purpose
## Audience
## Source-of-truth links
## Approved claims only
## Visual direction
## CTA
## Escalation note if uncertainty exists
```

## Creative Asset Template

```md
# Creative Asset — <Variant Name>

## Format / surface
## Angle or hook
## Source-of-truth links
## Prompt or production notes
## CTA intent
## Compliance / escalation note
```

## Open Questions Note Template

```md
---
type: open-questions
status: active
created: YYYY-MM-DD
owner: AI N
source_of_truth: false
---

# Open Questions — <Topic>

> Part of [[Home]] > Reference | See also: [[Tasks/In Progress]]

## Question
## Why it matters
## Owner
## Blocking or non-blocking
## Next action
```
