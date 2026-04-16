---
type: workflow-queue
status: active
created: 2026-04-15
updated: 2026-04-15
owner: AI 3
source_of_truth: true
---

# Workflow Queue

> Part of [[Home]] > Tasks | See also: [[00-System/Automation-Workflow-Layer|Automation Workflow Layer]], [[04-Tasks/Workflow-Trigger-Labels|Workflow Trigger Labels]], [[04-Tasks/Handoffs/README|Handoffs]], [[Tasks/In Progress|In Progress]]

## Purpose

Provide one lightweight, canonical queue model for routing work across the operating system without creating hidden state.

## Queue Sections

- New Intake
- Waiting for Product Framing
- Waiting for Research
- Waiting for Compliance Translation
- Ready for Planning
- Ready for Implementation
- Waiting for Support Reply
- Waiting for Creative
- Waiting for Video
- Waiting for QA
- Waiting for Owner
- Blocked
- Complete

## Required Item Fields

Every queue item should declare:

- trigger label
- current stage
- current owner
- canonical docs
- blocker if any
- next owner
- recommended next action

## Queue Rules

- one trigger should produce one clearly-owned first step
- every escalation must say why it happened
- queue state points to canonical docs; it does not replace them
- blocked items must name the blocker explicitly
