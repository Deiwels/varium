# AI 4 Branch Resolution — 2026-04-15

> [[Home]] > Tasks | Audience: AI 4 (Phone AI), AI 1, AI 2, AI 3, Owner
> Related: [[AI-Core-Manifesto]], [[AI-Rule-Updates]], [[AI-Profiles/AI-4-Phone-AI|AI 4 — Phone AI]], [[Tasks/In Progress]], [[Tasks/AI4-Emergency-Readiness-Review-2026-04-15]]
> Purpose: remove ambiguity about what to do with AI 4's old docs branch and make future behavior obvious without extra chat.

---

## Final decision

**Branch `claude/read-docs-P7wBt` is archive/reference only.**

Do **not** merge it into `main` as a docs feature branch.

Reason:
- `main` already contains the current process model (`Rule 6`, `4-AI Plan Review Gate`, `docs/AI-Profiles/` structure)
- the only must-keep AI 4 artifact from that branch was the review doc, and it is now already synced into:
  - [[Tasks/AI4-Emergency-Readiness-Review-2026-04-15]]
- merging the branch as-is would reintroduce stale structure and duplicate docs paths

---

## What AI 4 should do from now on

1. **Work from `main` only**
   - do not continue normal docs work on top of `claude/read-docs-P7wBt`
   - treat that branch as historical reference

2. **Do not resurrect `docs/AI/`**
   - canonical profile/location system is now:
     - `docs/AI-Profiles/`
   - if useful wording exists in an old file under `docs/AI/`, copy the content intentionally into the matching current file
   - do not merge a parallel folder tree

3. **Use the real review-doc pattern**
   - if AI 4 writes a docs review on a feature branch first, the team syncs the actual review file into its final local `docs/Tasks/*.md` path
   - do not create a second mirror file for the same review

4. **If AI 4 wants a new rule or architecture change**
   - do **not** write it directly into manifesto/rules on a side branch
   - create a new:

```md
## @AI3 [PLAN REQUEST]: <rule / policy / architecture change>
Date: YYYY-MM-DD
From: AI 4
Problem: <what is missing / risky>
Context: <which current docs or rules are insufficient>
Expected result: <what new rule or process should exist>
Blocked: yes — do not implement or rewrite docs until AI 3 publishes a plan
```

This applies to ideas such as:
- `Full Domain Read`
- `Rule 7`
- any new session-start expansion
- any structural docs-system rewrite

---

## What has already been preserved from AI 4 work

These are already on `main` and should **not** be recreated:

- [[Tasks/AI4-Emergency-Readiness-Review-2026-04-15]]
- AI 4 gate completion in [[Tasks/In Progress]]
- AI 4 review sync rule in:
  - [[AI-Rule-Updates]]
  - [[AI-Core-Manifesto]]
  - [[AI-Profiles/AI-4-Phone-AI|AI 4 profile]]

---

## What AI 4 does **not** need to do now

- No merge of `claude/read-docs-P7wBt`
- No PR for that branch
- No second copy of the emergency review
- No attempt to back-port older manifesto/profile structure

---

## If AI 4 returns later and asks “what do I do?”

Short answer:

1. Read [[AI-Rule-Updates]]
2. Read [[AI-Core-Manifesto]]
3. Read [[AI-Profiles/AI-4-Phone-AI|AI 4 profile]]
4. Read [[Tasks/In Progress]]
5. Ignore old branch `claude/read-docs-P7wBt` unless you need historical wording
6. If proposing a new rule/system change, file `@AI3 [PLAN REQUEST]` first

---

## Owner intent captured here

The owner-selected resolution is:

- **Option C now**
  - old branch becomes inactive reference
  - live work continues from `main`
- if any old AI 4 idea is still valuable, it re-enters the system cleanly through the current planning rules

That is the official interpretation until replaced by a newer written rule.
