---
type: runbook
status: active
created: 2026-04-15
updated: 2026-04-15
owner: AI 4
source_of_truth: true
---

# Incident Response Workflow

> Part of [[Home]] > Runbooks | See also: [[08-Runbooks/Support/Escalation-Matrix|Escalation Matrix]], [[00-System/Real-Tools-Integration-Layer|Real Tools Integration Layer]]

## Purpose

Define the emergency path from alert to stabilization, post-hotfix scan, and permanent cleanup.

## Step-by-step Procedure

1. Classify severity.
2. Notify Owner.
3. Route to AI 4 with incident context and rollback notes if available.
4. AI 4 applies the smallest safe fix.
5. AI 4 logs `[HOTFIX] [AI 4]`.
6. AI 3 performs post-hotfix scan.
7. AI 1 or AI 2 performs permanent cleanup in owned scope.
8. Update incident/runbook/decision docs if operating behavior changed.
