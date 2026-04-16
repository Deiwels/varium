---
type: reference
status: active
created: 2026-04-15
updated: 2026-04-15
owner: AI 3
source_of_truth: true
---

# Task Workflow Queue Item Template

> Part of [[Home]] > Reference | See also: [[11-Reference/Templates/README|Templates Library]], [[04-Tasks/Workflow-Queue|Workflow Queue]]

## Purpose

Use for queue items, task intake notes, and structured workflow items.

## Template

```md
---
type: task
status: new
priority: medium
owner: unassigned
created: {{date}}
updated: {{date}}
trigger:
---

# Task: {{title}}

## Description
{{what is needed}}

## Trigger
- Source: (owner / email / lead / system / incident)

## Classification
- Type: (product / support / growth / compliance / bug / infra)
- Complexity: (trivial / non-trivial)
- External dependency: (yes/no)

## Context
- Relevant docs:
  - [[link]]
- Constraints:
  -

## Assigned To
{{AI-X}}

## Status
- Current: new / in-progress / blocked / done

## Next Step
{{who does what next}}

## Notes
{{optional}}
```
