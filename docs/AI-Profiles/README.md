# AI Profiles

> [[Home]] | Related: [[AI-Rule-Updates]], [[AI-Core-Manifesto]], [[AI-Work-Split]], [[AI-Session-Acceptance-Log]], [[Tasks/3-AI-Remaining-Work-Split|5-AI Work Split]]
> Purpose: one page per AI + Owner with role, scope, strengths, known history, coordination rules.

Before starting a session, every AI reads **[[AI-Rule-Updates]] first**, then **its own profile**, and confirms that its behaviour matches. If a profile is out of date, the first action of the session is to update the profile — not code.

If the session touches `docs/`, the AI also follows the new **Home-first + Vault Rules** rule: start from `[[Home]]`, read `[[Vault Rules]]`, and write information only into the correct canonical file path.

## Index

| # | Profile | Platform | Primary scope |
|---|---|---|---|
| **AI 1** | [[AI-1-Claude]] | Claude Code CLI (Sonnet/Opus, 1M ctx) | `backend/index.js`, `.github/workflows/`, all `docs/**` |
| **AI 2** | [[AI-2-Codex]] | Codex CLI | `app/**`, `components/**`, `lib/**`, `globals.css`, frontend docs |
| **AI 3** | [[AI-3-Verdent]] | Verdent | Planner + verifier: `docs/Tasks/QA-Scan-*.md`, `docs/Tasks/*-Runbook.md`, planning docs |
| **AI 4** | [[AI-4-Phone-AI]] | Phone AI (mobile Claude) | Universal quick-fixer — any file, emergencies only |
| **AI 5** | [[AI-5-GPT-Chat-Deep-Research]] | GPT Chat Deep Research | Exact external research: vendor/policy/compliance/market facts before major work |
| **Owner** | [[Owner-Nazarii]] | Human | Final decisions, secrets, external services, legal |

## How to use these profiles

1. **Before your own session starts** — read your own profile. Verify: is your scope still what it says? Are your strengths still accurate? Are the "known exceptions" list still the full set?
2. **Before coordinating with another AI** — read their profile. Do not duplicate work, do not cross scope, do not re-argue decisions already in their "known positions" section.
3. **When something about you changes** — update your profile in the same commit that changes your behaviour. Profiles drift silently if nobody owns them.
4. **When a cross-AI rule changes** — update `AI-Core-Manifesto.md` first, then mirror into the affected profiles.
5. **When AI 4 reviews through GitHub first** — sync the actual review doc into its final local `docs/Tasks/*.md` path before treating it as visible team knowledge.
6. **When a task needs AI 5** — create one shared `docs/Tasks/AI5-Research-Brief-<slug>.md` file first, let all relevant AI add their questions there, and only then send the brief to AI 5.

## Related single source of truth

- **Rules all AIs follow** → [[AI-Core-Manifesto]]
- **File ownership table** → [[AI-Work-Split]]
- **Session acceptance log** → [[AI-Session-Acceptance-Log]]
- **Current sprint split** → [[Tasks/3-AI-Remaining-Work-Split]]
- **Architectural decisions** → [[Architecture/Decision-Log]]
