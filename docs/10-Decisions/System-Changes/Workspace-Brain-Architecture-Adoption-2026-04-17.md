---
type: decision
status: approved
created: 2026-04-17
updated: 2026-04-17
owner: AI 3
doc_class: canonical
---

# Workspace Brain Architecture Adoption — 2026-04-17

> Part of [[10-Decisions/Decisions-Index|Decisions Index]] | See also: [[00-System/Workspace-Brain-and-Multi-Chat-Plan|Workspace Brain and Multi-Chat Plan]]

## Decision

Adopt the Workspace Brain architecture for the Vurium AI operating system.

## Approved structure

- local master brain at `~/Obsidian/Vurium-Brain/`
- one `Project-Brain` per project
- one `Topic Brain` per major workstream
- repo `docs/` becomes the exported canonical subset, not the full memory system
- chat persistence goes into Obsidian files, not a standalone database

## Why

The old repo-only memory model created too much drift, too much repeated context, and too much Git noise.

The system needs:

- one central brain,
- persistent multi-chat memory,
- cross-project knowledge outside one code repo,
- clean export of only the docs that should live with code.

## Immediate implementation order

1. create the local master vault
2. create `VuriumBook Project Brain`
3. create `Current State`
4. migrate `SMS-Notifications-Brain`
5. create `Onboarding` and `Billing` topic brain stubs
6. add repo templates
7. wire Owner Copilot to read local brain first

## Constraint

Do not mass-move repo docs during active launch work.

Use:

- manual inventory for canonical vs superseded
- scripted export sync for ongoing copy into repo
