---
type: runbook
status: active
created: 2026-04-15
updated: 2026-04-15
owner: AI 9
source_of_truth: true
---

# Escalation Matrix

> Part of [[Home]] > Runbooks | See also: [[08-Runbooks/Support/Email-Reply-Workflow|Email Reply Workflow]], [[00-System/Real-Tools-Integration-Layer|Real Tools Integration Layer]]

## Purpose

Define who handles what when a workflow cannot safely stay inside its first lane.

## Support / Lead / Email Escalations

- technical ambiguity -> **AI 1** or **AI 2**
- product ambiguity -> **AI 6**
- compliance-sensitive wording -> **AI 7**
- pricing exception / refund / legal / account-risk -> **Owner**

## Growth / Campaign Escalations

- unclear campaign direction -> **AI 8**
- unclear product claim -> **AI 6**
- risky wording / regulated claim -> **AI 7**
- brand-sensitive final choice -> **Owner**

## Product / Build Escalations

- external truth gap -> **AI 5**
- compliance/system translation gap -> **AI 7**
- planning gap -> **AI 3**
- real portal / approval step -> **Owner**

## Incident Escalations

- immediate stabilization -> **AI 4**
- post-hotfix scan -> **AI 3**
- permanent backend cleanup -> **AI 1**
- permanent frontend cleanup -> **AI 2**
- real-world operational decision -> **Owner**
