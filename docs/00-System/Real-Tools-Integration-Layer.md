---
type: reference
status: active
doc_class: reference-only
created: 2026-04-15
updated: 2026-04-16
owner: AI 3
source_of_truth: false
---

# Real Tools Integration Layer

> Part of [[Home]] > System | See also: [[00-System/Automation-Workflow-Layer|Automation Workflow Layer]], [[00-System/AI-Automation-Policy|AI Automation Policy]], [[08-Runbooks/System/Escalation-Matrix|Escalation Matrix]], [[08-Runbooks/System/Operational-Pipelines-MVP|Operational Pipelines MVP]], [[08-Runbooks/Owner/Portal-Only-Actions|Owner Portal-Only Actions]]

## Purpose

Define the reference boundary model for how the operating system connects to real tools and services without breaking governance.

The goal is practical operation:

- react to real incoming events
- support customer and lead communication
- support growth execution
- assist with Stripe / Telnyx / form / alert workflows
- preserve Owner control over secrets and risky actions

## Core Principle

Tools extend the system. Tools do not replace governance and do not override [[AI-Core-Manifesto]].

Tools may:

- provide input
- trigger workflows
- prepare drafts
- store structured context
- notify the correct AI or Owner

Tools must not:

- bypass ownership
- bypass approvals
- bypass compliance checks
- auto-send risky communication without explicit rules
- grant AI autonomous control of sensitive portals or production accounts

AI-specific automation levels are defined in [[00-System/AI-Automation-Policy|AI Automation Policy]].

## Integration Model

### Layer A — Trigger Layer

Examples:

- Gmail / support inbox
- website forms
- CRM lead intake
- Stripe webhooks
- Telnyx status events
- monitoring alerts
- manual Owner request

### Layer B — Routing Layer

Classify:

- workflow family
- first owner
- draft-safe or escalation-required
- approval-required or not

### Layer C — Context Layer

Load:

- canonical docs
- runbooks
- templates
- offers/pricing/product truth
- support truth
- compliance constraints

### Layer D — AI Execution Layer

The routed AI performs only its owned role.

### Layer E — Approval / Action Layer

If required:

- Owner approves
- safe draft is sent
- manual portal step is performed
- workflow advances

### Layer F — Knowledge Writeback Layer

Durable insights are written back into canonical notes.

## Recommended Tool Categories

- **Email / Communication** — Gmail, support inbox, CRM email lanes
- **Forms / Lead Capture** — website forms, contact forms, onboarding forms
- **Automation Orchestrator** — Zapier, Make, n8n, or server-side worker
- **Internal Queue / Task Intake** — markdown queue, handoff notes, canonical tasks
- **Monitoring / Alerts** — uptime, error, deploy, and health alerts
- **Payments / Billing** — Stripe events and billing-context awareness
- **Messaging / SMS Infrastructure** — Telnyx delivery, provisioning, and compliance-state awareness
- **Media / Asset Generation** — image/video/creative tools used by AI 10 and AI 11

## Preferred MVP Orchestrator

Use `n8n` as the primary orchestration layer for the first operational build-out.

Why:

- built-in Gmail, webhook, and schedule primitives cover the first real workflows
- conditional routing is strong enough for AI 9 / AI 4 / Owner escalation paths
- credential storage and external-secrets support align with Owner-controlled sensitive systems
- self-hosted deployment is easier to keep inside the team's audit and security posture

Zapier is still acceptable for lighter follow-up tasks, but canonical runbooks should assume `n8n` first unless a workflow is intentionally simpler.

## Owner-Only Systems

The following remain Owner-controlled:

- GitHub Secrets
- credential vault / 1Password
- Stripe dashboard
- Telnyx portal
- Google Cloud Console
- App Store Connect
- OAuth credential setup
- real billing actions
- final publishing where risk exists

## Safe Automation Boundaries

### Safe to automate

- inbox trigger detection
- form intake
- queue creation
- draft preparation
- FAQ suggestion
- creative/video brief creation
- routing and notifications

### Not safe without hard controls

- refunds
- billing exceptions
- sensitive legal wording
- portal mutations
- production credentials
- compliance-significant messaging sends
- final campaign publishing
- final product launch

Additional hard rules:

- no auto-send for billing, compliance, dispute, or account-sensitive communication
- no portal mutation without an explicit Owner gate
- every escalation must include a reason, not only a target
- prefer built-in orchestrator nodes over unreviewed community nodes

## Canonical Real-Tool Workflows

- support inbox -> AI 9 first response (see [[08-Runbooks/Support/Gmail-Support-Inbox-Workflow|Gmail Support Inbox Workflow]])
- lead form -> AI 9 follow-up plus AI 8 insight loop when needed (see [[08-Runbooks/Support/Lead-Form-Follow-Up-Workflow|Lead Form Follow-Up Workflow]])
- campaign request -> AI 8 brief -> AI 10 / AI 11 / AI 9 downstream execution
- Owner feature request -> AI 6 / AI 5 / AI 7 / AI 3 / AI 1-2 path
- incident alert -> AI 4 -> AI 3 post-hotfix -> AI 1 / AI 2 cleanup
- Stripe event -> support/ops/Owner routing based on risk
- Telnyx event -> AI 1 / AI 7 / Owner / AI 9 routing based on event type

## Required Operational Docs

- [[08-Runbooks/System/Escalation-Matrix|Escalation Matrix]]
- [[08-Runbooks/System/Operational-Pipelines-MVP|Operational Pipelines MVP]]
- [[08-Runbooks/Support/Email-Reply-Workflow|Email Reply Workflow]]
- [[08-Runbooks/Support/Gmail-Support-Inbox-Workflow|Gmail Support Inbox Workflow]]
- [[08-Runbooks/Support/Lead-Form-Follow-Up-Workflow|Lead Form Follow-Up Workflow]]
- [[08-Runbooks/Growth/Campaign-Workflow|Campaign Workflow]]
- [[08-Runbooks/Product/Feature-Flow|Feature Flow]]
- [[08-Runbooks/Incidents/Incident-Response-Workflow|Incident Response Workflow]]
- [[08-Runbooks/Billing/Stripe-Event-Handling|Stripe Event Handling]]
- [[08-Runbooks/Messaging/Telnyx-Event-Handling|Telnyx Event Handling]]
- [[08-Runbooks/Owner/Portal-Only-Actions|Owner Portal-Only Actions]]

## Final Principle

A strong AI company is not one where AI does everything alone. It is one where the right AI handles the right work, with the right context, under the right controls, and leaves the system more organized after every action.
