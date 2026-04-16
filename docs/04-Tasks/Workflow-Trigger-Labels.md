---
type: reference
status: active
created: 2026-04-15
updated: 2026-04-15
owner: AI 3
source_of_truth: true
---

# Workflow Trigger Labels

> Part of [[Home]] > Tasks | See also: [[00-System/Automation-Workflow-Layer|Automation Workflow Layer]], [[04-Tasks/Workflow-Queue|Workflow Queue]]

## Purpose

Standardize intake classification so work routes consistently to the right AI lane.

## Canonical Trigger Labels

- `trigger:new-feature`
- `trigger:bugfix`
- `trigger:vendor-question`
- `trigger:compliance-task`
- `trigger:support-email`
- `trigger:lead-reply`
- `trigger:campaign-request`
- `trigger:faq-gap`
- `trigger:onboarding-confusion`
- `trigger:incident`
- `trigger:owner-approval`

## Usage Rule

Use the smallest accurate trigger label set needed to classify the work. Do not invent one-off labels unless the current list clearly fails.
