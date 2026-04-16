---
type: reference
status: active
created: 2026-04-15
owner: AI 3
---

# AI Rule Updates

> [[Home]] | Related: [[AI-Core-Manifesto]], [[AI-Profiles/README|AI Profiles]], [[AI-Session-Acceptance-Log]], [[Tasks/In Progress|In Progress]], [[Tasks/3-AI-Remaining-Work-Split|8-AI Work Split]]
> Purpose: short changelog for cross-AI behavior changes that every role must see before starting work.

> ⚠️ **If this file changed after your last acceptance entry, your old acceptance is stale.**
> ⛔ **Read this file first, then re-read [[AI-Core-Manifesto]], then append a fresh line to [[AI-Session-Acceptance-Log]].**

---

## Current active updates

### 2026-04-15 — Operating system expanded to Owner + 8 AI roles

- We are no longer modeling the team as only 5 AI + Owner.
- New canonical roles are added:
  - **AI 6 — Product Strategist**
  - **AI 7 — Compliance Executor**
  - **AI 8 — Growth / Marketing Operator**
- Standard non-trivial task flow is now:
  - Owner → AI 6 product framing → AI 5 research if external truth is needed → AI 7 requirements translation → AI 3 execution plan → 4-AI review gate → AI 1 / AI 2 implementation → AI 3 QA → Owner final live verification
- **AI 3 does not replace AI 6**
- **AI 5 does not replace AI 7**
- **AI 4 remains emergency-only**
- Canonical supporting lanes now exist in:
  - `docs/Product/**`
  - `docs/Compliance/**`
  - `docs/Growth/**`
- All AI profile files now follow one standard template structure.

### 2026-04-15 — Correct documentation recording is a hard rule

- [[Vault Rules]] is mandatory for any markdown creation/editing work.
- Docs navigation is **Home-first**.
- Information must be written in the correct canonical file, not merely “some nearby file”.
- New docs must be linked properly and added to [[Home]].
- Chat-only knowledge does not count as team knowledge.

### 2026-04-15 — AI 5 is the mandatory external-facts lane for large vendor/compliance work

- Before major work that depends on exact external facts, the team must use **AI 5** or explicitly document why AI 5 is unnecessary.
- AI 5 is not the planner and not an implementation approver.
- AI 5 feeds source-backed facts into the planning lane.

### 2026-04-15 — One shared AI 5 research brief per large external task

- One task = one shared `docs/Tasks/AI5-Research-Brief-<slug>.md`
- AI 1 / AI 2 / AI 3 / AI 4 put their fact questions in that file first
- AI 5 answers in that same file
- Then AI 7 translates requirements and AI 3 plans

### 2026-04-15 — Rule 6 remains active: AI 3 is the only planner for complex work

- Complex work still requires `@AI3 [PLAN REQUEST]` in [[Tasks/In Progress|In Progress]].
- No large implementation starts before AI 3 publishes a plan.

### 2026-04-15 — 4-AI Plan Review Gate remains mandatory

- Required gate:
  - AI 1 reviews backend / infra / data / integration risk
  - AI 2 reviews frontend / browser / mobile / UX risk
  - AI 3 incorporates feedback and republishes the final plan
  - AI 4 reviews emergency / rollback / incident risk
  - Owner approves
- Optional reviewers when relevant:
  - AI 6 product sanity
  - AI 7 compliance sanity

### 2026-04-15 — AI 4 GitHub-side docs reviews must be synced locally

- AI 4 review does not count until the real review doc exists locally in its final `docs/Tasks/*.md` path.
- Do not create duplicate mirror docs.
- GitHub-only review = gate still blocked.

### 2026-04-15 — AI 4 old docs branch is archive-only

- `claude/read-docs-P7wBt` is reference-only, not an active merge target.
- New AI 4 process ideas must re-enter through the current planning flow.

### 2026-04-15 — Rule updates must be mirrored, not hidden

Every new process rule must be updated in the same session across:

1. [[AI-Rule-Updates]]
2. [[AI-Core-Manifesto]]
3. affected files under [[AI-Profiles/README|AI Profiles]]
4. [[Home]]
5. current-day DevLog

If it is only in chat, it does not count.
