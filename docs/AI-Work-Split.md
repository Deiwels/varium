---
type: reference
status: active
created: 2026-04-15
updated: 2026-04-15
owner: AI 3
source_of_truth: true
---

# AI Work Split

> [[Home]] | Related: [[AI-Core-Manifesto]], [[AI-Profiles/README|AI Profiles]], [[Tasks/In Progress|In Progress]], [[Tasks/3-AI-Remaining-Work-Split|11-AI Work Split]]
> Purpose: canonical ownership map for the `Owner + 11 AI` operating system.

---

## 1. Ownership Summary

| Role | Primary lane | Owns | Must not own by default |
|---|---|---|---|
| **AI 1 — Claude** | Backend + infra + technical docs | `backend/index.js`, `.github/workflows/**`, backend-adjacent docs, technical docs, and 5 explicitly assigned pages | general frontend/UI |
| **AI 2 — Codex** | Frontend + UI | `app/**`, `components/**`, `lib/**`, `app/globals.css` except AI 1 exceptions | backend, workflows, infra |
| **AI 3 — Verdent** | Planning + QA + decision logging + knowledge hygiene | `docs/Tasks/*-Plan*.md`, `docs/Tasks/*QA-Scan*.md`, `docs/Tasks/*-Runbook*.md`, `docs/Architecture/Decision-Log.md`, `docs/00-System/**`, `docs/11-Reference/Note-Templates.md`, structure-level index notes | routine product code |
| **AI 4 — Phone AI** | Emergency response | any file only under emergency protocol | routine daily development |
| **AI 5 — GPT Chat Deep Research** | External facts research | `docs/Tasks/AI5-Research-Brief-*.md` | code, implementation plans |
| **AI 6 — Product Strategist** | Product framing | `docs/Product/**` | code, infra, raw research |
| **AI 7 — Compliance Executor** | Compliance translation | `docs/Compliance/**` | code, legal sign-off |
| **AI 8 — Growth / Marketing Operator** | Growth strategy | `docs/Growth/Growth-Backlog.md`, `docs/Growth/Funnel-Audit.md`, `docs/Growth/Onboarding-Optimization.md`, `docs/Growth/Landing-Pages/**`, `docs/Growth/Experiments/README.md`, `docs/Growth/Creative/Approved-Claims-and-Angles.md` | code, compliance policy interpretation, downstream execution lanes |
| **AI 9 — Support / Email Agent** | Customer communication | `docs/Growth/Customer-Communication/**`, `docs/Growth/Support-Responses/**`, `docs/Growth/FAQ/**`, `docs/08-Runbooks/Support/**` | product truth, pricing exceptions, legal/compliance interpretation, engineering |
| **AI 10 — Video Agent** | Video execution | `docs/Growth/Video/**`, `docs/Growth/Experiments/Video/**` | product strategy, compliance truth, publishing accounts, UI ownership |
| **AI 11 — Creative / Ad Image Agent** | Static creative execution | `docs/Growth/Creative/**`, `docs/Growth/Experiments/Creative/**` | product truth, compliance truth, product UI, engineering |
| **Owner** | Real-world authority | secrets, portals, live verification, final go/no-go | delegation of secrets to AI |

---

## 2. Code Ownership

### AI 1 — Backend + Infra + Technical Docs

Owns:

- `backend/index.js`
- `.github/workflows/**`
- `app/payroll/**`
- `app/cash/**`
- `app/expenses/**`
- `app/calendar/booking-modal.tsx`
- `app/messages/**`
- technical documentation under `docs/**` unless another lane owns the canonical file

Does not own by default:

- `app/**` outside the explicit exceptions above
- `components/**`
- `lib/**`
- `app/globals.css`

### AI 2 — Frontend + UI

Owns:

- `app/**` except the AI 1 page exceptions
- `components/**`
- `lib/**`
- `app/globals.css`

Does not own by default:

- `backend/index.js`
- `.github/workflows/**`
- backend infrastructure logic

---

## 3. Governance / Docs Ownership

### AI 3 — Planning + QA + Decision Logging

Owns:

- `docs/Tasks/*-Plan*.md`
- `docs/Tasks/*QA-Scan*.md`
- `docs/Tasks/*-Runbook*.md`
- `docs/04-Tasks/Workflow-Queue.md`
- `docs/04-Tasks/Workflow-Trigger-Labels.md`
- `docs/04-Tasks/Handoffs/**`
- `docs/Architecture/Decision-Log.md`
- `docs/00-System/**`
- `docs/11-Reference/Note-Templates.md`
- folder index / MOC notes when the work is vault structure and knowledge hygiene rather than lane-owned truth

### AI 5 — External Research Briefs

Owns:

- `docs/Tasks/AI5-Research-Brief-*.md`

### AI 6 — Product Strategy Docs

Owns:

- `docs/Product/**`

### AI 7 — Compliance Translation Docs

Owns:

- `docs/Compliance/**`

### AI 8 — Growth / Marketing Docs

Owns:

- `docs/Growth/Growth-Backlog.md`
- `docs/Growth/Funnel-Audit.md`
- `docs/Growth/Onboarding-Optimization.md`
- `docs/Growth/Landing-Pages/**`
- `docs/Growth/Experiments/README.md`
- `docs/Growth/Creative/Approved-Claims-and-Angles.md`

### AI 9 — Support / Email Docs

Owns:

- `docs/Growth/Customer-Communication/**`
- `docs/Growth/Support-Responses/**`
- `docs/Growth/FAQ/**`
- `docs/08-Runbooks/Support/**`

### AI 10 — Video Docs

Owns:

- `docs/Growth/Video/**`
- `docs/Growth/Experiments/Video/**`

### AI 11 — Creative Docs

Owns:

- `docs/Growth/Creative/**`
- `docs/Growth/Experiments/Creative/**`

### AI 1 Default Docs Stewardship

AI 1 remains the default steward for technical and implementation-adjacent docs, but does **not** override the canonical docs lanes above.

This means:

- AI 1 may update technical docs and DevLog freely
- AI 1 should not absorb `docs/Product/**`, `docs/Compliance/**`, `docs/Growth/**`, or AI 3 / AI 5 canonical docs unless there is an explicit handoff or emergency reason

---

## 4. Strategic and Business-Execution Lanes

### Product Strategy Lane

Owner: **AI 6**

Artifacts:

- `docs/Product/Roadmap.md`
- `docs/Product/Priorities.md`
- `docs/Product/Feature-Briefs/README.md`
- `docs/Product/User-Flows/README.md`
- `docs/Product/Open-Questions.md`

Purpose:

- define user problem
- define MVP vs later
- remove noise before planning starts

### Compliance Execution Lane

Owner: **AI 7**

Artifacts:

- `docs/Compliance/Requirements/README.md`
- `docs/Compliance/Control-Matrix.md`
- `docs/Compliance/Implementation-Checklist.md`
- `docs/Compliance/Vendor-Constraints/README.md`

Purpose:

- turn AI 5 research into system/UI/backend/Owner constraints
- prevent policy truth from getting lost between research and implementation

### Growth Lane

Owner: **AI 8**

Artifacts:

- `docs/Growth/Growth-Backlog.md`
- `docs/Growth/Funnel-Audit.md`
- `docs/Growth/Onboarding-Optimization.md`
- `docs/Growth/Experiments/README.md`
- `docs/Growth/Landing-Pages/README.md`

Purpose:

- own funnel thinking
- structure onboarding improvements
- keep launch messaging and conversion work from turning into random chat ideas

### Business / Ops / Content Execution Layer

Owners:

- **AI 9** — support/email execution
- **AI 10** — video execution
- **AI 11** — static creative execution

Artifacts:

- `docs/Growth/Customer-Communication/**`
- `docs/Growth/Support-Responses/**`
- `docs/Growth/FAQ/**`
- `docs/Growth/Video/**`
- `docs/Growth/Creative/**`
- `docs/08-Runbooks/Support/**`
- `docs/08-Runbooks/Growth/**`

Purpose:

- reduce Owner load on routine support communication
- create downstream execution capacity for growth assets
- keep support, video, and creative work inside approved product/compliance boundaries
- avoid polluting engineering lanes with business-execution work

---

## 5. Collaboration Rules

1. **No large implementation without AI 3 plan**
   - complex work routes through `@AI3 [PLAN REQUEST]`

2. **No vendor/compliance planning without AI 5 first**
   - if external truth matters, create one `AI5-Research-Brief-<slug>.md`

3. **No compliance-sensitive execution plan without AI 7 translation**
   - AI 5 gives facts; AI 7 converts them into requirements; AI 3 plans from that

4. **AI 4 remains emergency-only**
   - no routine feature drift into the emergency lane

5. **Docs are lane-owned**
   - if the canonical file lives in another lane, route there instead of writing nearby duplicates

6. **Home-first + Vault Rules apply to all docs work**
   - start from `[[Home]]`
   - read `[[Vault Rules]]`
   - read `[[00-System/Obsidian-Knowledge-System|Obsidian Knowledge System]]` for note type / source-of-truth / lifecycle questions
   - write in the canonical file

7. **AI 3 governs structure, not meaning**
   - AI 3 may standardize note hygiene, templates, links, superseded/archive status, and duplicate handling
   - AI 3 must not silently rewrite product truth, compliance truth, or technical truth owned by another lane

8. **AI 9 / AI 10 / AI 11 are downstream specialists**
   - they do not replace AI 8 strategy
   - they do not replace AI 6 product truth
   - they do not replace AI 7 compliance truth
   - they do not replace engineering ownership
   - AI 8 remains the growth brain, while AI 9 / AI 10 / AI 11 provide execution capacity

9. **AI 3 owns automation-routing structure**
   - queue discipline, trigger labels, and handoff standards belong to AI 3
   - routing structure does not give AI 3 ownership over another lane's truth

---

## 6. Shared / Sensitive Areas

These areas require extra coordination even if ownership is nominally clear:

- auth contract (`middleware.ts`, `lib/auth-cookie.ts`, `lib/api.ts`, `components/Shell.tsx`, native `WKWebView` dependencies)
- billing and payment flows
- SMS sender state and compliance state
- any task touching both backend and frontend behavior
- any task whose truth depends on portals, secrets, or live external systems

Default routing:

- product ambiguity → **AI 6**
- external fact uncertainty → **AI 5**
- compliance/system translation gap → **AI 7**
- execution structure gap → **AI 3**
- emergency / rollback risk → **AI 4**
- real portal or credential step → **Owner**

---

## 7. Emergency Override

AI 4 may touch any file only when:

- production is down
- a critical regression must be stopped immediately
- Owner explicitly activates the emergency lane
- another AI is blocked in an urgent incident

After that:

- AI 4 documents the intervention
- AI 3 performs post-hotfix verification
- permanent ownership returns to AI 1 or AI 2

---

## 8. Practical Rule

When in doubt:

- check [[AI-Profiles/README|AI Profiles]]
- check [[Tasks/In Progress|In Progress]]
- do **not** “just help” in someone else’s lane unless the docs explicitly route you there or Owner has approved the exception
