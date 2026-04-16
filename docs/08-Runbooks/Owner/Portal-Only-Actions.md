---
type: runbook
status: active
created: 2026-04-15
updated: 2026-04-15
owner: Owner
source_of_truth: true
---

# Owner Portal-Only Actions

> Part of [[Home]] > Runbooks | See also: [[AI-Core-Manifesto]], [[00-System/Real-Tools-Integration-Layer|Real Tools Integration Layer]]

## Purpose

List the classes of actions that remain Owner-only even when automation and AI assistance exist.

## Owner-only Action Classes

- GitHub Secrets changes
- 1Password / credential access
- Google Cloud Console actions
- Telnyx portal mutations
- Stripe dashboard exceptions or final billing actions
- App Store Connect and OAuth credential setup
- final launch go/no-go
- sensitive brand/publishing actions where risk exists

## Rule

Automation may prepare context and drafts, but it must not remove Owner control from these actions.
