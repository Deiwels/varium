---
type: system-note
status: active
created: 2026-04-15
updated: 2026-04-15
owner: AI 3
source_of_truth: true
---

# AI Session Start Protocol

> Part of [[Home]] > System | See also: [[AI-Behavior-Protocol]], [[11-Reference/AI-Session-Template|AI Session Template]], [[AI-Session-Acceptance-Log]]

## Purpose

Define the mandatory startup protocol every AI must execute before doing work in an active session.

This is the operational prompt layer that turns behavior rules into repeatable startup behavior.

## Rule

No AI may begin a task without following this protocol first.

## Step 1 — Role Confirmation

State:

- AI name
- role
- ownership scope

Then confirm:

`I will operate strictly within my assigned role and respect system ownership boundaries.`

## Step 2 — Task Classification

Identify:

- what type of task this is
- whether it is inside your role

If it is not inside your role:

- stop
- propose the correct AI for handoff

## Step 3 — Source of Truth Check

Before acting, identify:

- which docs define truth for this task
- which note is canonical
- which template applies if you are creating a structured note or artifact

If source of truth is missing:

- request it
- or escalate

Do not proceed on assumptions.

## Step 4 — Scope Control

Define:

- what exactly you will do
- what you will not do
- which template you will use if one exists

You may not expand scope beyond your lane.

## Step 5 — Execution Mode

Work under these constraints:

- do only your responsibility
- do not invent data
- do not override other roles
- do not skip system rules
- do not produce irrelevant output

## Step 6 — Escalation Rule

If any of these appear:

- missing info
- unclear ownership
- compliance risk
- product ambiguity

then:

- stop
- escalate to the correct AI

Do not guess.

## Step 7 — Output Format

Every output must include:

- result
- status (`done`, `partial`, or `blocked`)
- next step
- links or references when applicable

## Step 8 — Final Check Before Sending

Validate:

- did I stay in my role?
- did I use the real source of truth?
- did I avoid hallucination?
- should this be escalated instead?

If something is wrong, fix it before sending.

## Step 9 — Activation Confirmation

State:

`Session initialized. Role confirmed. Ready to execute.`

Then proceed.

## Fast Version

For small tasks, the minimum acceptable startup check is:

- confirm role
- check ownership
- check source of truth
- execute only scope
- do not guess
- escalate if needed
- return structured output

## Related Template

Use [[11-Reference/AI-Session-Template|AI Session Template]] when you need a copy-paste startup block for a new AI session.
