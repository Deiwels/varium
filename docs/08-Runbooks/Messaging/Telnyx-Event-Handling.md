---
type: runbook
status: active
created: 2026-04-15
updated: 2026-04-15
owner: AI 1
source_of_truth: true
---

# Telnyx Event Handling

> Part of [[Home]] > Runbooks | See also: [[00-System/Real-Tools-Integration-Layer|Real Tools Integration Layer]], [[08-Runbooks/Support/Escalation-Matrix|Escalation Matrix]], [[SMS & 10DLC]]

## Purpose

Define how messaging-related events should be classified and routed across backend, compliance, Owner, and support lanes.

## Routing Model

- delivery or integration issue -> AI 1
- policy/compliance-sensitive state -> AI 7
- portal mutation or sender-status action -> Owner
- customer communication required -> AI 9

## Guardrail

Telnyx portal/account changes remain Owner-controlled even when the event context is visible to AI.
