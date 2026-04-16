---
type: reference
status: active
doc_class: canonical
created: 2026-04-15
updated: 2026-04-16
owner: AI 3
source_of_truth: true
---

# AI Rule Updates

> [[Home]] | Related: [[AI-Core-Manifesto]], [[AI-Behavior-Protocol]], [[AI-Session-Start-Protocol]], [[AI-Profiles/README|AI Profiles]], [[AI-Session-Acceptance-Log]], [[Tasks/In Progress|In Progress]], [[Tasks/3-AI-Remaining-Work-Split|11-AI Work Split]]
> Purpose: short changelog for cross-AI behavior changes that every role must see before starting work.
> Authority note: current `canonical / reference-only / superseded / archived` status lives in [[Home]] and doc frontmatter. Older rollout entries below are historical and do not override current doc class.

> ⚠️ **If this file changed after your last acceptance entry, your old acceptance is stale.**
> ⛔ **Read [[Home]], then this file, then re-read [[AI-Core-Manifesto]], [[AI-Behavior-Protocol]], [[AI-Session-Start-Protocol]], and your own AI profile, then append a fresh line to [[AI-Session-Acceptance-Log]].**

---

## Current active updates

### 2026-04-16 — AI 5 research intake execution lane is now live

- The first execution-ready AI 5 lane now exists for source-backed external research intake.
- Live backend route now exists at:
  - `/api/vurium-dev/ai/research-brief`
- Import-adaptable `n8n` workflow artifact now lives in:
  - `automation/n8n/Research_Brief.workflow.json`
  - `automation/n8n/README.md`
- The live AI 5 lane is intentionally source-gated:
  - it only produces source-backed findings from explicit official `source_urls`
  - if no source URLs are provided, it returns a structured queued result
  - if all provided sources fail to fetch, it returns a blocked result instead of inventing research
- This does not bypass governance:
  - AI 5 still does not replace AI 7 for compliance translation
  - AI 5 still does not make product or legal decisions
  - unresolved research still routes back into escalation / queue flow

### 2026-04-16 — AI 8 -> AI 11 / AI 10 growth asset execution lane is now live

- The first execution-ready growth asset lane now exists for `AI 8 -> AI 11 / AI 10`.
- Live backend route now exists at:
  - `/api/vurium-dev/ai/growth-asset-flow`
- Import-adaptable `n8n` workflow artifact now lives in:
  - `automation/n8n/Growth_Asset_Flow.workflow.json`
  - `automation/n8n/README.md`
- The live execution artifact uses one consolidated backend route that internally runs:
  - `AI 8 growth brief`
  - `AI 11 creative variants` when static assets are requested
  - `AI 10 video brief` when video assets are requested
- This does not bypass governance:
  - unclear product capability still escalates to `AI-6`
  - risky claim/compliance angles still escalate to `AI-7`
  - final brand/publishing decisions still escalate to `Owner`

### 2026-04-16 — AI 9 support inbox execution artifacts are now live

- The first execution-ready support inbox lane now exists for `AI 9 support / email`.
- Live backend processing endpoint now exists at:
  - `/api/vurium-dev/ai/support-inbox-process`
  - `/api/vurium-dev/ai/support-inbox-execute`
- Import-adaptable `n8n` workflow artifact now lives in:
  - `automation/n8n/Gmail_Support_Inbox.workflow.json`
  - `automation/n8n/README.md`
- The live execution artifact uses one consolidated backend decision step so `n8n` does not duplicate classification, drafting, safe-send logic, and escalation logic across many nodes.
- The support lane now follows a clean `process -> execute` split:
  - `process` -> classify, draft, decide
  - `execute` -> send reply if safe, otherwise return escalation/manual-review payload
- This does not bypass governance:
  - technical issues still escalate to `AI-1` or `AI-2`
  - compliance-risk issues still escalate to `AI-7`
  - billing-sensitive issues still escalate to `Owner`
  - only routine low-risk replies can be marked `safe_to_send`

### 2026-04-16 — Phase 1 AI 3 execution artifacts are now live

- The first execution-first artifacts now exist for:
  - `AI 3 planning intake`
  - `AI 3 QA scan`
- Live backend endpoints now exist at:
  - `/api/vurium-dev/ai/planning-intake`
  - `/api/vurium-dev/ai/qa-scan`
- Import-adaptable `n8n` workflow skeletons now live in:
  - `automation/n8n/AI3_Planning_Intake.workflow.json`
  - `automation/n8n/AI3_QA_Scan.workflow.json`
  - `automation/n8n/README.md`
- Those `n8n` artifacts are now webhook-driven queue/status triggers, not manual-only test flows.
- Canonical queue-stage alignment for AI 3 is now:
  - `Ready for Planning` -> planning intake
  - `Waiting for QA` -> QA scan
- Legacy `Ready for QA` should be treated as compatibility-only input, not canonical naming.
- This is the approved shift from framework-only design to execution artifacts for phase 1.

### 2026-04-16 — Approved optimization pass is now active

- Universal startup reading is now reduced to:
  - [[Home]]
  - [[AI-Rule-Updates]]
  - [[AI-Core-Manifesto]]
  - [[AI-Behavior-Protocol]]
  - [[AI-Session-Start-Protocol]]
  - the AI's own profile
- All other system docs are now **task-triggered reading only**.
- Current authority classes are now:
  - **canonical:** Home, AI Rule Updates, AI Core Manifesto, AI Behavior Protocol, AI Session Start Protocol, AI Profiles, Obsidian Knowledge System, Escalation Matrix
  - **reference-only:** Automation Workflow Layer, AI Automation Policy, Real Tools Integration Layer, Self-Improvement Layer, KPI & Metrics Layer, Operational Pipelines MVP, n8n Implementation Pack, Automation Routing Reference, Templates Library, AI Session Template, System/Runbooks/Reference indexes, Vault Rules
  - **superseded:** legacy support-scoped escalation matrix and other explicitly replaced notes
  - **archived:** historical docs routed through [[12-Archive/Archive-Index|Archive Index]] or clearly marked historical in place
- Reference docs support execution, but they do **not** override canonical docs.
- Framework growth is now frozen unless a new doc is required to unblock live execution safely.

### 2026-04-15 — n8n Implementation Pack for AI 3 / 5 / 8 / 10 / 11 introduced

- [[08-Runbooks/System/n8n-Implementation-Pack-AI3-AI5-AI8-AI10-AI11|n8n Implementation Pack — AI 3 / AI 5 / AI 8 / AI 10 / AI 11]] introduced the implementation-contract pack for the first non-inbox automation wave.
- Use it for:
  - trigger definitions
  - input payload shape
  - output schema
  - safe mode rules
  - escalation rules
  - writeback targets
  - common `n8n` wrapper schema and validation rules
- Use [[11-Reference/Automation-Routing-Reference|Automation Routing Reference]] for trigger routing.
- Use this new runbook for concrete workflow-building contracts.

### 2026-04-15 — Automation Routing Reference introduced

- [[11-Reference/Automation-Routing-Reference|Automation Routing Reference]] introduced the practical routing table for automation triggers.
- Use it when you need `trigger -> AI -> automation mode -> input -> output -> next step`.
- It also now defines the first-wave automation pack for:
  - AI 3 planning intake / QA / weekly review
  - AI 8 growth briefs
  - AI 11 creative variants
  - AI 10 video briefs/scripts
  - AI 5 research briefs
- Use [[00-System/AI-Automation-Policy|AI Automation Policy]] for rules and levels.
- Use [[11-Reference/Automation-Routing-Reference|Automation Routing Reference]] for practical implementation routing.

### 2026-04-15 — AI Automation Policy introduced

- [[00-System/AI-Automation-Policy|AI Automation Policy]] introduced the per-agent automation-level reference.
- Not every AI should be automated the same way.
- The active model is now:
  - Level 0 -> manual only
  - Level 1 -> queue-only
  - Level 2 -> draft automation
  - Level 3 -> safe auto-execution
  - Level 4 -> emergency auto-routing
- High-automation priority is now explicitly biased toward:
  - AI 9 support/lead communication
  - AI 3 planning/QA/review support
  - AI 8 growth briefs
  - AI 10 script/video briefs
  - AI 11 creative variants
  - AI 5 research-brief prep
- AI 1 / AI 2 remain queue/prep-first, not direct auto-change lanes.
- Owner remains manual-only, and AI 4 remains emergency-only.

### 2026-04-15 — Operational Pipelines MVP introduced

- [[08-Runbooks/System/Operational-Pipelines-MVP|Operational Pipelines MVP]] introduced the starting set for real automation build-out.
- `n8n` is now the primary orchestrator recommendation for the first practical rollout; Zapier remains acceptable only for lighter follow-up steps.
- The first build order is:
  - Gmail support inbox
  - lead form follow-up
  - incident alert routing
- Recommended rollout staging is now:
  - Stage 1 -> Gmail trigger + AI 9 draft + manual approval send
  - Stage 2 -> safe routine support auto-send only
  - Stage 3 -> lead form intake + follow-up queue
  - Stage 4 -> incident webhook + AI 4 emergency routing
  - Stage 5 -> Stripe/Telnyx awareness only, no automatic financial or portal actions
- Lead-form intake now has its own active implementation doc in [[08-Runbooks/Support/Lead-Form-Follow-Up-Workflow|Lead Form Follow-Up Workflow]].
- Trigger taxonomy now explicitly includes `lead-form`, `monitoring-alert`, `stripe-event`, and `telnyx-event`.

### 2026-04-15 — Self-Improvement Layer introduced

- [[00-System/Self-Improvement-Layer|Self-Improvement Layer]] introduced the controlled-evolution loop for the operating system.
- AI 3 should use it with [[08-Runbooks/System/KPI-Metrics-Layer|KPI & Metrics Layer]] to turn recurring problems into structured, reviewable improvements.
- System improvements must not be silent; approved changes should be logged in [[10-Decisions/System-Changes/README|System Changes Log]].

### 2026-04-15 — KPI & Metrics Layer introduced

- [[08-Runbooks/System/KPI-Metrics-Layer|KPI & Metrics Layer]] introduced the system-performance and weekly-review reference.
- AI 3 should use it to run weekly review, detect bottlenecks, and propose system improvements.
- This layer measures role health, workflow health, escalation health, documentation health, and rework/incident trends.

### 2026-04-15 — Escalation Matrix is now canonical

- [[08-Runbooks/System/Escalation-Matrix|Escalation Matrix]] is now the canonical escalation-routing document for the whole operating system.
- Escalation routing is no longer support-scoped only.
- AI must use this document before making blocked-state, risk, or uncertainty escalation decisions.
- The legacy support-scoped matrix remains only as a superseded pointer for old backlinks.

### 2026-04-15 — Templates Library introduced

- [[11-Reference/Templates/README|Templates Library]] introduced the approved per-template library for structured work.
- `No template = no work` is now an active system rule.
- If a matching template exists, AI must use it instead of creating a free-form note.
- AI 3 is now the template-discipline enforcer and may reject chaotic notes when a matching template exists.
- This applies especially to:
  - queue items
  - handoffs
  - product briefs
  - growth briefs
  - creative briefs
  - video briefs
  - experiments
  - runbooks
  - incidents
  - decisions
  - FAQ entries
  - support-reply drafts

### 2026-04-15 — AI Session Start Protocol is now mandatory

- [[AI-Session-Start-Protocol]] is now a required startup file for every AI before beginning a task.
- It is the canonical operational prompt layer for:
  - role confirmation
  - task classification
  - source-of-truth check
  - scope control
  - escalation-before-guessing
  - final pre-output validation
- [[11-Reference/AI-Session-Template|AI Session Template]] is now the reusable copy-paste template for starting a session correctly.
- All AI must now read, follow, and acceptance-log against:
  - [[AI-Rule-Updates]]
  - [[AI-Core-Manifesto]]
  - [[AI-Behavior-Protocol]]
  - [[AI-Session-Start-Protocol]]
- No task should begin without this startup protocol.

### 2026-04-15 — AI Behavior Protocol is now mandatory

- [[AI-Behavior-Protocol]] is now a required startup file for every AI before every session.
- It is the canonical behavior/training layer for:
  - role discipline
  - anti-hallucination behavior
  - escalation-before-guessing
  - minimal correct output
  - structured handoffs
- All AI must now read, follow, and acceptance-log against:
  - [[AI-Rule-Updates]]
  - [[AI-Core-Manifesto]]
  - [[AI-Behavior-Protocol]]
- If this protocol changes after an AI's last acceptance entry, that acceptance is stale.

### 2026-04-15 — Automation / workflow layer introduced

- [[00-System/Automation-Workflow-Layer|Automation Workflow Layer]] introduced the routing and handoff reference for the system.
- [[00-System/Real-Tools-Integration-Layer|Real Tools Integration Layer]] introduced the tools/integration boundary reference for real events and safe tool usage.
- Automation may:
  - classify triggers
  - assemble context
  - prepare drafts
  - maintain queue visibility
  - route work to the correct AI
- Automation may **not**:
  - bypass ownership
  - bypass AI 5 / AI 7 on external/compliance truth
  - bypass AI 3 planning for non-trivial work
  - bypass Owner approval for sensitive or real-world actions
- Canonical workflow-support notes now exist in:
  - `docs/04-Tasks/Workflow-Queue.md`
  - `docs/04-Tasks/Workflow-Trigger-Labels.md`
  - `docs/04-Tasks/Handoffs/**`

### 2026-04-15 — Business / Ops / Content Execution layer added

- The system now includes three new downstream execution agents:
  - **AI 9 — Support / Email Agent**
  - **AI 10 — Video Agent**
  - **AI 11 — Creative / Ad Image Agent**
- These roles are **not** new strategy owners.
- AI 8 remains the growth brain; AI 9 / AI 10 / AI 11 are downstream support, video, and creative execution hands.
- They sit downstream of the existing truth/governance lanes:
  - AI 8 defines growth direction
  - AI 6 defines product truth and framing when relevant
  - AI 7 guards compliance-sensitive wording and claims when relevant
  - AI 9 / AI 10 / AI 11 execute support, video, and creative work inside those constraints
- These agents do **not** replace AI 8, Owner, or engineering ownership.
- Canonical support/video/creative docs now live under:
  - `docs/Growth/Customer-Communication/**`
  - `docs/Growth/Support-Responses/**`
  - `docs/Growth/FAQ/**`
  - `docs/Growth/Video/**`
  - `docs/Growth/Creative/**`
  - `docs/08-Runbooks/Support/**`
  - `docs/08-Runbooks/Growth/**`
- Guardrail: AI 9 / AI 10 / AI 11 may execute content work, but they must not invent product truth, compliance truth, pricing truth, or engineering behavior.

### 2026-04-15 — Obsidian Knowledge System is now canonical

- [[00-System/Obsidian-Knowledge-System|Obsidian Knowledge System]] is now the canonical rule for:
  - note types
  - `source_of_truth`
  - lifecycle status (`draft`, `review`, `superseded`, `archived`)
  - source-of-truth hierarchy
  - archive / superseded handling
- The numbered folders `00-System` through `12-Archive` now exist as **knowledge-layer indexes, templates, and governance anchors**.
- This is a **staged migration**, not a mass move:
  - existing live canonical paths such as `docs/Tasks/**`, `docs/Architecture/**`, `docs/AI-Profiles/**`, `docs/Features/**`, and `docs/DevLog/**` stay stable during launch work
  - no one mass-moves canonical docs unless AI 3 opens a dedicated migration plan
- **AI 3 is now the Knowledge Hygiene Governor** for note structure, template discipline, superseded/archive hygiene, and duplicate detection.
- `[[11-Reference/Note-Templates|Note Templates]]` is the canonical template source for important note types.
- Vault-librarian cleanup is allowed only as an explicit mode/task, not as a silent rewrite of other lanes' truth.

### 2026-04-15 — Operating system expanded to Owner + 11 AI roles

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
- [[00-System/Obsidian-Knowledge-System|Obsidian Knowledge System]] is mandatory when the session touches note type, note status, source-of-truth semantics, archive handling, or vault structure.
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
3. [[AI-Behavior-Protocol]]
4. [[AI-Session-Start-Protocol]]
5. affected files under [[AI-Profiles/README|AI Profiles]]
6. [[Home]]
7. current-day DevLog

If it is only in chat, it does not count.
