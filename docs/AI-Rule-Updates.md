# AI Rule Updates

> [[Home]] | Related: [[AI-Core-Manifesto]], [[AI-Session-Acceptance-Log]], [[Tasks/In Progress|In Progress]], [[Tasks/3-AI-Remaining-Work-Split|4-AI Work Split]]
> Purpose: one short file that announces every new cross-AI rule so no AI can miss it during startup.

> ⚠️ **If this file has an update newer than your last acceptance entry, your old acceptance is stale.**
> ⛔ **Read this file before every session. Then re-read [[AI-Core-Manifesto]] and add a fresh entry to [[AI-Session-Acceptance-Log]].**

---

## Current active updates

### 2026-04-15 — AI 4 GitHub-side docs reviews must be synced into their final local doc path

- AI 4 may write a review in GitHub first by committing a markdown doc on a feature branch.
- That review does **not** count as visible team knowledge until the actual review doc is present locally in its final `docs/Tasks/*.md` path on this machine.
- Do **not** create a second “mirror” doc for the same review. A duplicate copy becomes stale immediately.
- If any AI or the Owner notices a new AI 4 review in GitHub, the first follow-up action is to sync that real doc into the local repo and link it from [[Tasks/In Progress|In Progress]].
- If the review exists only on GitHub and is not yet present locally at its final path, the gate stays blocked.

### 2026-04-15 — AI 4 old docs branch is archive-only

- Branch `claude/read-docs-P7wBt` is now reference-only, not an active merge target.
- The only required artifact from that branch was the AI 4 emergency review, and it already lives in [[Tasks/AI4-Emergency-Readiness-Review-2026-04-15]].
- Do not merge old parallel docs structure like `docs/AI/` back into `main`.
- If AI 4 still wants to introduce a new rule/process idea from that old branch, it must re-enter through `@AI3 [PLAN REQUEST]` under the current Rule 6 workflow.

### 2026-04-15 — Rule 6: One Brain Rule / PLAN REQUEST

- AI 3 (Verdent) is the only planning owner for complex work.
- If a task needs planning, AI 1 / AI 2 / AI 4 do **not** start implementation.
- They must add `@AI3 [PLAN REQUEST]` to [[Tasks/In Progress|In Progress]] with context, expected result, and `Blocked: yes`.
- Owner can then tell AI 3 that there is an update for him, but the real source of truth is still the written request in `docs`.

### 2026-04-15 — New mandatory 4-AI Plan Review Gate

- After AI 3 publishes a plan, implementation is still **blocked** until all 4 AI review it.
- Required gate:
  - AI 1 reviews backend / data / infra / integration risk
  - AI 2 reviews frontend / browser / mobile / UX risk
  - AI 3 incorporates feedback and republishes the final plan
  - AI 4 reviews emergency / rollback / incident risk
  - Owner approves the final plan
- Until that gate is fully green, nobody proceeds with implementation.

### 2026-04-15 — Rule updates must be mirrored, not hidden

Every new process rule must be written in all of these places in the same session:

1. [[AI-Rule-Updates]]
2. [[AI-Core-Manifesto]]
3. Any affected profile under [[AI-Profiles/README|AI Profiles]]
4. [[Home]]
5. [[DevLog/2026-04-15|today's DevLog]] or the current day's DevLog

If it is only mentioned in chat, it does not count.

---

## Required plan-review checklist

Any complex plan should include this block before implementation begins:

```md
## 4-AI Plan Review Gate
- [ ] AI 1 reviewed backend / infra / data / integration risk
- [ ] AI 2 reviewed frontend / browser / mobile / UX risk
- [ ] AI 3 incorporated all feedback and published final plan
- [ ] AI 4 reviewed emergency / rollback / incident risk
- [ ] Owner approved the final plan

Blocked: yes — implementation does not start until all 5 items are green.
```

---

## Why this file exists

- New rules were appearing in chat and were too easy to miss.
- This file is now the "what changed?" page every AI must see before doing work.
- If a future rule is important enough to change behavior, it belongs here first.
