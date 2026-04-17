---
type: system-plan
status: active
priority: p0
owner: AI 3
created: 2026-04-17
updated: 2026-04-17
doc_class: canonical
---

# Workspace Brain and Multi-Chat Plan

> [[Home]] > [[00-System/Obsidian-Knowledge-System|Obsidian Knowledge System]] | Related: [[04-Tasks/Workflow-Queue|Workflow Queue]], [[AI-Profiles/AI-3-Verdent|AI-3 Verdent]], [[Tasks/SMS-Notifications-Brain|SMS Notifications Brain]]

## Purpose

Define the target architecture for the Vurium AI operating system so it behaves like:

- one central brain,
- one smart owner chat,
- multiple project chats,
- multiple AI providers in one place,
- full memory persistence in Obsidian,
- clean project separation,
- low GitHub noise.

This is the plan for how the system should work when it is "correct", not just the current transitional implementation.

## Core idea

The central brain is **not** the chat UI and **not** `n8n`.

The central brain is:

1. a **local Obsidian workspace brain** on the computer,
2. a **project brain** for each active project,
3. a **runtime memory layer** that summarizes active state fast,
4. a **repo export layer** for project-specific canonical docs that must live with code.

## Target operating model

### Layer 1 — Local master brain

This should live **outside the Git repo** on the computer.

Recommended location:

- `~/Obsidian/Vurium-Brain/`

This is the main memory system for:

- all projects,
- all chats,
- cross-project knowledge,
- operator history,
- reusable research,
- long-term decisions,
- global templates,
- AI memory.

This local master brain should **not** be fully committed to GitHub.

### Layer 2 — Per-project brain

Inside the local master brain, each project gets its own hub:

- `Projects/VuriumBook/`
- `Projects/<OtherProject>/`

Each project hub should contain:

- `Project-Brain.md`
- `Current-State.md`
- `Execution-Checklist.md`
- `Open-Questions.md`
- `Decisions.md`
- `Chats/`
- `Tasks/`
- `Research/`
- `Handoffs/`

The project brain is the single place the system should read first when the owner asks:

- what is the status,
- what is blocked,
- what plan are we following,
- what should we do next.

### Layer 3 — Repo-exported canonical docs

Only the subset that belongs with the codebase should stay in the repo:

- implementation plans,
- product truth,
- compliance requirements,
- feature briefs,
- runbooks,
- task records that matter to the codebase.

This means:

- local Obsidian brain = full memory
- repo `docs/` = exported project truth that should ship with the codebase

## What the chat system should become

### Default owner experience

The default UI should feel like a real GPT-style chat:

- one conversation surface,
- messages in the center,
- reply directly below,
- persistent memory,
- no need to think about templates or file paths every turn.

### Chat modes

There should be two top-level chat behaviors:

#### 1. Copilot chat

Default mode.

Used for:

- "what is going on right now?"
- "what are we blocked on?"
- "which plan should we follow?"
- "continue this work"
- "summarize existing docs"
- "prepare next step"

This mode should:

- read project brain first,
- read active chat memory,
- read relevant linked docs,
- answer conversationally,
- only create a task when the owner explicitly asks to start execution.

#### 2. Execution chat

Used when the owner explicitly says:

- start this,
- plan this now,
- create the task,
- run research,
- continue implementation,
- open AI-5,
- open Verdent planning.

This mode should:

- create or update linked task notes,
- create handoffs,
- launch the correct AI lane,
- write results back to Obsidian,
- keep the thread linked to the project brain.

## Multiple AI in one place

### Goal

All AIs should feel like they live in one system, not as scattered tools.

### Correct model

- `Claude` = strong reasoning / planning / coding / review
- `OpenAI` = strong product framing / UI / copy / design / synthesis
- `Verdent` = AI-3 role inside the system, not a separate provider
- `AI-5` = research lane
- `AI-7` = compliance translation lane

### How this should appear in UI

There should be:

1. **one default owner copilot chat**
2. optional direct tabs / threads like:
   - `VuriumBook / Copilot`
   - `VuriumBook / Claude`
   - `VuriumBook / OpenAI`
   - `VuriumBook / Verdent`
   - `VuriumBook / AI-5 Research`

But they must all share the same project brain and chat memory.

That means:

- separate chat threads are allowed,
- memory still rolls up into the same project brain,
- each thread can have its own focus,
- the system still knows they belong to the same project.

## Chat persistence rules

### Full transcript storage

Every owner chat should be saved to Obsidian.

But not into random task notes.

Use a dedicated structure:

- `Projects/VuriumBook/Chats/2026-04-17-owner-copilot-thread-01.md`
- `Projects/VuriumBook/Chats/2026-04-17-claude-thread-02.md`
- `Projects/VuriumBook/Chats/2026-04-17-openai-thread-03.md`

Each chat note should contain:

- thread id,
- project id,
- mode,
- provider / lane,
- created / updated timestamps,
- full transcript,
- linked tasks created from that chat,
- linked plans / research / handoffs.

### Thread memory note

Each chat thread should also have a lightweight memory summary:

- `Projects/VuriumBook/Chats/Thread-Memory/thread-01-summary.md`

This summary should contain:

- what this thread is about,
- current active issue,
- last decision,
- next expected step,
- linked notes.

This is what the system should read quickly before opening the full transcript.

### Project-level memory rollup

The project brain should not read the full raw transcript every time.

Instead, the system should update:

- `Project-Brain.md`
- `Current-State.md`
- `Execution-Checklist.md`

from the chat summaries.

This gives:

- fast startup,
- less token waste,
- better memory,
- less repetition.

## Obsidian information architecture

### Global local vault

Recommended top-level structure:

- `Projects/`
- `System/`
- `Chats/`
- `Research/`
- `People/`
- `Vendors/`
- `Templates/`
- `Archive/`

### VuriumBook project structure

Recommended project sub-structure:

- `Projects/VuriumBook/Project-Brain.md`
- `Projects/VuriumBook/Current-State.md`
- `Projects/VuriumBook/Execution-Checklist.md`
- `Projects/VuriumBook/Chats/`
- `Projects/VuriumBook/Tasks/`
- `Projects/VuriumBook/Research/`
- `Projects/VuriumBook/Handoffs/`
- `Projects/VuriumBook/Decisions/`
- `Projects/VuriumBook/Deliverables/`

### Repo docs export layer

Inside the repo, keep only the notes that should travel with the code:

- `docs/00-System/`
- `docs/04-Tasks/`
- `docs/07-Research/`
- `docs/08-Runbooks/`
- `docs/10-Decisions/`

The local vault should be the full source.

The repo should receive only selected exported notes.

## How files should connect

### Project-first graph

Every project should have one root node:

- `[[Projects/VuriumBook/Project-Brain|VuriumBook Project Brain]]`

Everything relevant should link back to it:

- current state
- tasks
- research
- chats
- decisions
- handoffs
- feature briefs

### Topic brains

For major workstreams, create topic brains:

- `SMS-Notifications-Brain`
- `Onboarding-Brain`
- `Billing-Brain`
- `Growth-Brain`

These topic brains should link:

- up to project brain
- sideways to related plans
- down to implementation tasks

This is the correct way to stop the graph from becoming random disconnected notes.

## Cleanup and migration rules

### Problem

Many older notes were created in a messy or repetitive way.

### Correct fix

Do not delete everything blindly.

Do this:

1. identify canonical notes,
2. identify duplicate / low-value notes,
3. create topic brain / consolidated note,
4. mark old notes as:
   - supporting
   - superseded
   - archive
5. keep backlinks so graph context is preserved.

### Migration order

1. Build `Project-Brain`
2. Build major `Topic-Brain` notes
3. Re-link old notes to those brain notes
4. Mark obviously bad / duplicate notes as superseded
5. Move noisy raw notes into archive if no longer needed

## Automation behavior

### What should happen on every owner message

1. identify project
2. identify thread
3. identify mode:
   - advisory
   - task
   - research
   - handoff
   - truth draft
4. load thread memory summary
5. load project brain
6. load topic brain if relevant
7. answer conversationally
8. if execution starts, write linked notes automatically
9. update:
   - thread transcript
   - thread summary
   - project current state
   - topic brain if relevant

## What "ideal" looks like

When this is working correctly:

- you open one chat,
- say "what is going on with SMS?",
- the system instantly reads:
  - VuriumBook project brain
  - SMS brain
  - current thread memory
  - latest linked notes
- and answers like a real informed operator.

Then when you say:

- "start this now"

it opens execution:

- creates or updates the right task,
- launches Verdent or AI-5,
- links everything back into Obsidian,
- saves the thread,
- remembers the result next turn.

## Implementation phases

### Phase 1 — Brain structure

- create local master vault outside repo
- create `Project-Brain` for VuriumBook
- create major topic brains
- define export rules into repo

### Phase 2 — Chat persistence

- save each chat thread into Obsidian
- create thread summaries
- link threads to project brain

### Phase 3 — Multi-chat UI

- support multiple chat threads per project
- support thread switching
- show thread/project context clearly

### Phase 4 — Multi-provider AI layer

- Claude and OpenAI both live in the same owner UI
- direct-model tabs optional
- shared project memory underneath

### Phase 5 — Migration cleanup

- clean old notes
- mark superseded notes
- connect disconnected notes to brains
- reduce Git noise by moving master memory outside repo

## Immediate next build order

1. Create the **local master Obsidian brain outside the repo**
2. Create **VuriumBook Project Brain**
3. Save the **Owner Copilot chat transcript + summary into Obsidian**
4. Add **multiple chat threads** in UI
5. Add **OpenAI provider** into the same chat system
6. Migrate old SMS notes into the new brain structure

## Verdent planning prompt

Use this to start the real planning pass:

```text
You are Verdent (AI-3) inside the Vurium AI Operating System.

Plan the target architecture for the Vurium workspace brain and multi-chat system.

Goals:
- Obsidian must become the central long-term brain
- the owner must have one GPT-like copilot chat
- multiple separate chat threads must exist per project
- Claude and OpenAI must both be integrated into the same system
- all chat threads must persist into Obsidian
- each project must have one Project Brain
- each major workstream must have its own Topic Brain
- old disconnected notes must be migrated into the new brain structure
- the main local brain should live outside the repo, with only selected project truth exported into GitHub

Deliver:
1. target architecture
2. storage model
3. chat persistence model
4. project / thread / topic memory model
5. Obsidian file structure
6. migration strategy for old notes
7. UI behavior for owner chat
8. phased implementation plan

Important rules:
- do not invent more roles
- keep Owner control
- keep AI-3 as planning / QA governor
- keep execution practical, not theoretical
- optimize for one central brain + multiple usable chats + low doc drift
```
