---
type: reference
status: active
created: 2026-04-15
updated: 2026-04-15
owner: AI 3
source_of_truth: true
---

# AI Profiles

> [[Home]] | Related: [[AI-Core-Manifesto]], [[AI-Rule-Updates]], [[AI-Behavior-Protocol]], [[AI-Session-Start-Protocol]], [[AI-Work-Split]], [[AI-Session-Acceptance-Log]], [[Tasks/3-AI-Remaining-Work-Split|11-AI Work Split]]
> Purpose: one canonical profile per role in the `Owner + 11 AI` system.

Before starting a session:

1. read [[AI-Rule-Updates]]
2. read [[AI-Core-Manifesto]]
3. read [[AI-Behavior-Protocol]]
4. read [[AI-Session-Start-Protocol]]
5. read your own profile
6. if the session touches docs, read [[Vault Rules]]
7. read [[08-Runbooks/System/Escalation-Matrix|Escalation Matrix]] before making routing, blocked-state, risk, or uncertainty decisions
8. if the session creates or updates a structured note or artifact, also read [[11-Reference/Templates/README|Templates Library]]
9. if the session touches note structure, note status, source-of-truth, archive handling, or vault organization, also read [[00-System/Obsidian-Knowledge-System|Obsidian Knowledge System]]
10. if the session touches workflow routing, queue state, trigger labels, or handoff behavior, also read [[00-System/Automation-Workflow-Layer|Automation Workflow Layer]]
11. if the session touches system performance, weekly review, or role effectiveness, also read [[08-Runbooks/System/KPI-Metrics-Layer|KPI & Metrics Layer]]
12. if the session proposes or reviews system changes, also read [[00-System/Self-Improvement-Layer|Self-Improvement Layer]]
13. if the session touches real tools, inboxes, forms, Stripe, Telnyx, alerts, or safe integration boundaries, also read [[00-System/Real-Tools-Integration-Layer|Real Tools Integration Layer]]
14. add a fresh entry to [[AI-Session-Acceptance-Log]]

If a profile is outdated, update the profile before treating it as trustworthy.

---

## Index

| # | Profile | Canonical role | Primary lane |
|---|---|---|---|
| **Owner** | [[Owner-Nazarii]] | Human final authority | secrets, portals, real-world execution, launch decisions |
| **AI 1** | [[AI-1-Claude]] | Backend + Docs + Infra Owner | `backend/index.js`, `.github/workflows/**`, technical docs, 5 assigned pages |
| **AI 2** | [[AI-2-Codex]] | Frontend + UI Owner | `app/**`, `components/**`, `lib/**`, `app/globals.css` except AI 1 page exceptions |
| **AI 3** | [[AI-3-Verdent]] | Planner + Verifier + QA Gatekeeper | plans, QA scans, runbooks, decision log |
| **AI 4** | [[AI-4-Phone-AI]] | Emergency Quick-Fixer + Emergency Reviewer | incident response, rollback thinking, unblockers |
| **AI 5** | [[AI-5-GPT-Chat-Deep-Research]] | External Facts Research Lane | vendor/policy/compliance/source-backed research |
| **AI 6** | [[AI-6-Product-Strategist]] | Product Strategy Owner | product briefs, roadmap, priorities, user-flow framing |
| **AI 7** | [[AI-7-Compliance-Executor]] | Compliance-to-Implementation Translator | requirements, control matrix, implementation constraints |
| **AI 8** | [[AI-8-Growth-Marketing-Operator]] | Growth Engine Owner | funnel, onboarding, positioning, conversion and launch messaging |
| **AI 9** | [[AI-9-Support-Email-Agent]] | Customer Communication Agent | support replies, follow-ups, FAQ growth, customer communication docs |
| **AI 10** | [[AI-10-Video-Agent]] | Video Content Generator | promo videos, demo scripts, video briefs, motion content execution |
| **AI 11** | [[AI-11-Creative-Ad-Image-Agent]] | Visual Marketing Generator | ad creatives, social visuals, landing-page imagery, creative variants |

---

## Standard Profile Template

Every profile follows the same section order:

1. Identity
2. Primary responsibilities
3. Ownership boundaries
4. Activation triggers
5. Inputs
6. Outputs
7. Collaboration rules
8. Non-goals
9. Escalation rules
10. Success criteria

This is intentional. The goal is that any AI can open any profile and orient instantly.

---

## How to Use These Profiles

1. **Read your own profile before working**
   - verify your scope, constraints, and escalation rules

2. **Read another AI's profile before handing work over**
   - do not dump ambiguous requests into another lane

3. **Profiles do not replace the manifesto**
   - global governance lives in [[AI-Core-Manifesto]]
   - file ownership lives in [[AI-Work-Split]]

4. **For big external/compliance tasks**
   - AI 6 frames the product problem
   - AI 5 researches external truth
   - AI 7 translates requirements
   - AI 3 plans execution

5. **For business / ops / content execution work**
   - AI 8 defines growth direction
   - AI 8 stays the strategy owner for growth
   - AI 9 executes support/email communication
   - AI 10 executes video production work
   - AI 11 executes static creative work
   - all three stay inside approved product/compliance truth

6. **For docs work**
   - start from [[Home]]
   - obey [[Vault Rules]]
   - use [[00-System/Obsidian-Knowledge-System|Obsidian Knowledge System]] for note type / status / source-of-truth questions
   - write only in the canonical file path

---

## Related Sources of Truth

- **Global rules** → [[AI-Core-Manifesto]]
- **What changed recently** → [[AI-Rule-Updates]]
- **Behavior / training layer** → [[AI-Behavior-Protocol]]
- **Session startup prompt layer** → [[AI-Session-Start-Protocol]]
- **Canonical escalation routing** → [[08-Runbooks/System/Escalation-Matrix|Escalation Matrix]]
- **Canonical templates** → [[11-Reference/Templates/README|Templates Library]]
- **System performance / weekly review layer** → [[08-Runbooks/System/KPI-Metrics-Layer|KPI & Metrics Layer]]
- **System self-improvement / controlled evolution layer** → [[00-System/Self-Improvement-Layer|Self-Improvement Layer]]
- **Knowledge-system semantics** → [[00-System/Obsidian-Knowledge-System|Obsidian Knowledge System]]
- **Workflow routing / queue / handoff logic** → [[00-System/Automation-Workflow-Layer|Automation Workflow Layer]]
- **Real tools / trigger / integration boundaries** → [[00-System/Real-Tools-Integration-Layer|Real Tools Integration Layer]]
- **File ownership** → [[AI-Work-Split]]
- **Current active work** → [[Tasks/In Progress|In Progress]]
- **Current sprint split** → [[Tasks/3-AI-Remaining-Work-Split|11-AI Work Split]]
- **Session acceptance log** → [[AI-Session-Acceptance-Log]]
