---
type: reference
status: active
created: 2026-04-15
updated: 2026-04-15
owner: AI 3
source_of_truth: true
---

# Obsidian Knowledge System

> Part of [[Home]] > System | See also: [[00-System/System-Index|System Index]], [[Vault Rules]], [[AI-Core-Manifesto]], [[11-Reference/Note-Templates|Note Templates]], [[11-Reference/Templates/README|Templates Library]]

## Purpose

Obsidian is the team's shared knowledge base and long-term working memory.

It is not just a notes app. It is the system that keeps the AI team aligned across:

- planning
- implementation
- compliance
- workflow routing
- product decisions
- growth work
- incident recovery
- runbooks
- queue state
- handoffs
- open questions
- historical context

The purpose of this knowledge system is to make sure:

- every AI can find the correct source of truth quickly
- there is one clear place for each kind of knowledge
- planning, implementation, and documentation do not drift apart
- the team does not repeatedly solve the same problem
- old notes do not silently override newer decisions
- knowledge survives across sessions

## Current Migration Note

This knowledge system is now canonical, but the vault is in a **staged migration**.

- The repo already has stable live canonical paths such as `docs/AI-Profiles/**`, `docs/Architecture/**`, `docs/Tasks/**`, `docs/Features/**`, and `docs/DevLog/**`.
- The numbered folders `00-System` through `12-Archive` are introduced first as **knowledge-layer indexes, templates, and governance anchors**.
- During active launch work, do **not** mass-move existing canonical files unless AI 3 opens a dedicated vault-migration plan.

That means:

- use the new numbered folders as navigation and standards lanes
- keep current canonical file paths stable unless a planned migration explicitly replaces them

## Core Rule

**Obsidian is shared memory, not a scratchpad.**

That means:

- not every thought belongs in the vault
- not every session note becomes permanent knowledge
- only structured, useful, retrievable knowledge should remain long-term
- temporary thinking should either be promoted into a proper note or discarded

## Main Principles

### Rule 1 — One fact, one home

A piece of important information should have one canonical home. If the same fact is repeated in many places, the team will drift.

### Rule 2 — Source of truth must be explicit

Every important note must clearly say whether it is:

- canonical / active source of truth
- supporting context
- historical / archived
- draft / work-in-progress

### Rule 3 — Decisions must outlive chats

If a meaningful product, architecture, compliance, or workflow decision was made, it must be written into Obsidian in a permanent note.

### Rule 4 — Research is not implementation

Vendor facts, product framing, execution plans, and final decisions must live in different note types.

### Rule 5 — Notes must be easy to scan

Long walls of text without structure create more confusion than clarity.

### Rule 6 — Every update should leave the system cleaner

No AI should leave behind messy, duplicated, or ambiguous notes if it can resolve them.

### Rule 7 — Recency alone is not truth

A newer note is not automatically correct. Canonical notes override random newer session notes unless explicitly replaced.

## What Obsidian Is Used For

Obsidian should store:

- team operating rules
- AI profiles
- ownership maps
- product briefs
- feature specs
- architecture decisions
- compliance requirements
- external research summaries
- execution plans
- runbooks
- QA scans
- incident logs
- growth experiments
- glossary / definitions
- open questions
- status dashboards
- historical changelogs where useful

Obsidian should **not** store:

- raw secrets
- passwords
- API keys
- full credential dumps
- random unstructured session chatter
- duplicated copies of code that already lives in the repo
- temporary brainstorming with no owner and no next step

## Knowledge Layers

### 00-System

Global rules of the AI operating system:

- manifesto
- rule updates
- workflows
- glossary
- how the Obsidian system itself works

### 01-Team

Team structure and role definitions:

- AI profiles
- Owner profile
- work split
- acceptance logs
- collaboration rules

### 02-Product

Product strategy and product truth:

- roadmap
- priorities
- feature briefs
- user flows
- open product questions
- launch scope notes

### 03-Architecture

Technical system design:

- architecture overview
- integration maps
- subsystem notes
- data flow docs
- decision-linked technical structure

### 04-Tasks

Execution-level task management:

- in-progress tasks
- workflow queue
- handoff notes
- trigger labels
- execution plans
- task breakdowns
- QA scans
- task runbooks

### 05-Compliance

Policy-to-implementation truth:

- compliance requirements
- control matrix
- implementation checklist
- vendor constraints
- operational rules

### 06-Growth

Growth and conversion work:

- funnel audit
- onboarding optimization
- landing page structure
- positioning notes
- experiment backlog
- customer communication
- support macros and FAQ
- video assets
- creative assets

### 07-Research

External fact research:

- AI 5 research briefs
- source-backed research summaries
- official policy research notes
- vendor truth notes

### 08-Runbooks

Operational step-by-step procedures:

- deployment runbooks
- release checklists
- incident recovery steps
- manual portal procedures
- Owner action runbooks

### 09-Incidents

Incident and hotfix history:

- incident reports
- postmortems
- hotfix logs
- rollback learnings

### 10-Decisions

Permanent decision history:

- product decisions
- architecture decisions
- compliance decisions
- process decisions
- tradeoff records

### 11-Reference

Stable reference material:

- glossary
- naming rules
- templates
- template library
- system diagrams
- key definitions
- canonical references that support many other notes

### 12-Archive

Inactive, replaced, or historical content:

- outdated plans
- replaced briefs
- old experiments
- resolved open questions
- deprecated system docs

## Mandatory Note Types

Every permanent note should belong to one of these note types:

- system
- profile
- task
- product-brief
- research-brief
- compliance-requirement
- plan
- workflow-queue
- handoff
- handoff-note
- qa-scan
- runbook
- faq
- decision-log
- decision
- incident-report
- incident
- growth-brief
- creative
- video
- experiment
- reference
- open-questions
- moc

Do not create vague notes like:

- `thoughts`
- `misc`
- `random notes`
- `ideas 2`
- `new plan final maybe`

## Naming Rules

Good examples:

- `AI-1-Claude.md`
- `AI-6-Product-Strategist.md`
- `Booking-Flow-MVP-Product-Brief.md`
- `Telnyx-10DLC-Implementation-Requirements.md`
- `Cloud-Run-Deploy-Runbook.md`
- `2026-04-15-Prod-Incident-Booking-Failure.md`

Naming rules:

- use clear nouns
- include date only when history matters
- include system/topic name
- avoid version chaos in filenames
- prefer replace/archive workflow over endless `v2/v3/v7`

## Source of Truth Hierarchy

When notes conflict, use this order:

### Priority 1 — Core governance

- [[AI-Core-Manifesto]]
- [[AI-Rule-Updates]]
- [[AI-Work-Split]]
- accepted system workflow docs

### Priority 2 — Canonical team and ownership docs

- AI profiles
- Owner profile
- work split tables
- accepted process notes

### Priority 3 — Canonical product / compliance / architecture docs

- active product briefs
- active compliance requirements
- active architecture notes
- active decision logs

### Priority 4 — Task execution docs

- plans
- QA scans
- runbooks
- active task notes

### Priority 5 — Research support docs

- AI 5 briefs
- vendor notes
- supporting references

### Priority 6 — Historical / archive docs

- superseded plans
- old notes
- outdated thinking

Important:

- archive never overrides active
- research does not override final decision
- plan does not override governance
- temporary notes do not override canonical profiles

## Required Linking Rules

Every important note should link:

- **upward** to the larger system it belongs to
- **downward** to execution, follow-up, or implementation artifacts
- **laterally** to sibling notes on the same topic

If a note is isolated and unlinked, it is likely to be forgotten or misused.

## Canonical Note Pattern

Each important note should contain these sections when relevant:

- Purpose
- Scope
- Current status
- Source of truth statement
- Key facts / decisions
- Constraints
- Dependencies
- Next actions
- Related notes
- Change history

## What Each AI Writes

### Owner

Writes or updates:

- final decisions
- business priorities
- approval notes
- launch notes
- real-world verification results

### AI 1

Writes or updates:

- technical docs
- infra notes
- backend implementation notes
- runbooks
- server-side decision context

### AI 2

Writes or updates:

- frontend implementation notes
- UI behavior notes
- interaction notes
- responsive verification notes
- frontend handoff notes when needed

### AI 3

Writes or updates:

- plans
- QA scans
- task orchestration docs
- decision-log entries
- process notes
- task state summaries

AI 3 also acts as the **Knowledge Hygiene Governor** for structure and consistency.
AI 3 also owns workflow queue structure, handoff-note standards, and trigger-label discipline so automation does not create hidden work.
AI 3 also enforces template discipline and may reject free-form notes when a matching template already exists.

### AI 4

Writes only when activated:

- hotfix log
- emergency note
- rollback note
- incident handoff summary

### AI 5

Writes or updates:

- research briefs
- source-backed external findings
- fact / inference splits
- unresolved external questions

### AI 6

Writes or updates:

- product briefs
- scope definitions
- MVP boundaries
- priorities
- user-flow notes
- product open questions

### AI 7

Writes or updates:

- compliance requirement docs
- control matrix
- implementation checklist
- requirement translation from policy to product behavior

### AI 8

Writes or updates:

- growth briefs
- funnel audit notes
- onboarding optimization notes
- experiment docs
- landing page structure notes
- messaging drafts

### AI 9

Writes or updates:

- support communication docs
- FAQ notes
- response templates
- follow-up playbooks
- support runbooks

### AI 10

Writes or updates:

- video briefs
- video scripts
- promo video notes
- demo scene structures
- video experiment docs

### AI 11

Writes or updates:

- creative briefs
- ad creative notes
- social creative notes
- landing-page visual notes
- creative experiment docs

## Knowledge Hygiene Governor

AI 3 is the **Knowledge Hygiene Governor** for vault structure and consistency.

This means AI 3 is responsible for:

- enforcing note templates
- identifying duplicates
- marking superseded notes
- ensuring plans link to briefs and QA scans
- keeping task-related docs consistent
- flagging when a note should move to archive
- preserving clean structure

Important limit:

AI 3 governs structure, but must not silently rewrite product truth, compliance truth, or technical truth owned by another lane.

## Vault Librarian Mode

A temporary **Vault Librarian** task may be assigned when:

- vault structure is messy
- duplicate notes exist
- new system folders need to be created
- notes need frontmatter, links, or cleanup
- archive sweep is required
- templates need standardization

Librarian mode may:

- move notes into correct folders
- standardize filenames
- add frontmatter
- add missing related links
- mark duplicate or superseded notes
- create indexes and map-of-content notes
- suggest merges

Librarian mode must not silently:

- delete important notes without an archive trail
- rewrite the meaning of canonical notes
- invent ownership changes
- change compliance or product decisions without explicit reason

## Map-of-Content Notes

Each major knowledge layer should have one index note:

- [[00-System/System-Index|System Index]]
- [[01-Team/Team-Index|Team Index]]
- [[02-Product/Product-Index|Product Index]]
- [[03-Architecture/Architecture-Index|Architecture Index]]
- [[04-Tasks/Tasks-Index|Tasks Index]]
- [[05-Compliance/Compliance-Index|Compliance Index]]
- [[06-Growth/Growth-Index|Growth Index]]
- [[07-Research/Research-Index|Research Index]]
- [[08-Runbooks/Runbooks-Index|Runbooks Index]]
- [[09-Incidents/Incidents-Index|Incidents Index]]
- [[10-Decisions/Decisions-Index|Decisions Index]]
- [[11-Reference/Reference-Index|Reference Index]]
- [[12-Archive/Archive-Index|Archive Index]]

Each index note should state:

- what belongs in this lane
- key canonical notes
- active notes
- archive link
- owner lane

## Draft vs Active vs Superseded vs Archived

Every note must clearly show lifecycle state:

- `draft`
- `review`
- `active`
- `superseded`
- `archived`

If a note becomes superseded, add:

> Status: Superseded
> Replaced by: [[New Canonical Note]]

If archived:

> Status: Archived
> Historical note only. Do not use as source of truth.

## No Duplicate Canonical Notes

At any given time there should not be:

- two active product briefs for the same feature
- two active compliance requirements for the same policy area
- two active AI profiles for the same role
- two active execution plans for the same exact scope unless one is explicitly child-scoped

If duplicates appear, AI 3 or librarian mode must:

1. identify them
2. choose the canonical note
3. mark the other note as superseded or merge it
4. add cross-links

## Required Templates

Templates live in [[11-Reference/Note-Templates|Note Templates]] and the canonical per-template files in [[11-Reference/Templates/README|Templates Library]].

Important note types should not be created in random style if a template already exists.

Rule:

- no template = no work
- if a matching template exists, use it
- AI 3 may block or send back notes that ignore an existing template

## Open Questions Rule

Do not bury unresolved questions in long prose.

Open-question sections should state:

- unknown
- why it matters
- owner
- blocking or non-blocking
- next action

## Decision Logging Rule

Any decision that changes:

- ownership
- architecture
- product scope
- compliance behavior
- emergency protocol
- growth direction

must get a decision-log entry or decision note.

Each decision should include:

- context
- decision
- reason
- alternatives considered
- consequences
- linked notes

## Research Handling Rule

AI 5 research notes must never be confused with final team decisions.

Research notes must separate:

- confirmed fact
- interpretation
- unresolved question
- non-binding suggestion

Research note is input, not execution truth.

## Plan Handling Rule

Execution plans explain **how to execute now**.

Canonical docs explain **what is true going forward**.

If a plan contains enduring truth, promote that truth into:

- product brief
- compliance requirement
- architecture note
- runbook
- decision note

## Runbook Rule

If a task creates a repeatable operational action, create or update a runbook.

Examples:

- release process
- SMS campaign setup checklist
- OAuth setup process
- rollback steps
- incident recovery steps
- App Store submission sequence

## Incident Documentation Rule

Every serious incident should create:

- incident note
- hotfix log if applicable
- runbook update if needed
- decision update if process changed because of the incident

## Daily / Task Workflow

### Before work

The responsible AI should:

1. open the canonical note(s)
2. confirm the latest active source of truth
3. check related decisions and dependencies
4. avoid working from random outdated notes

### During work

The responsible AI should:

1. update only the correct note types
2. add links when new artifacts are created
3. avoid duplicating the same context in many places

### After work

The responsible AI should:

1. update affected canonical docs
2. mark status clearly
3. add handoff notes if another lane is next
4. archive or supersede outdated working notes if needed

## Handoff Rule

When one AI hands work to another, the handoff should include:

- current status
- canonical note links
- what changed
- what is still unknown
- what the next AI is expected to do
- whether this is blocking or non-blocking

Bad handoff:

- “done, check notes”

Good handoff:

- “Product brief updated in [[Product/Feature-Briefs/Reminder-SMS-Launch-Readiness|Reminder SMS Launch Readiness]], compliance requirements in [[Compliance/Requirements/TFV-Reminder-SMS-Requirements|TFV Reminder SMS Requirements]], execution-ready unknown remains in [[Product/Open-Questions|Product Open Questions]]. AI 3 can now produce plan.”

## Final Operating Principle

If knowledge is important enough to affect future decisions, implementation, compliance, release safety, or team coordination, it must live in the right note type, with clear status, ownership, and links.

That is how the team stays aligned, fast, and correct.
