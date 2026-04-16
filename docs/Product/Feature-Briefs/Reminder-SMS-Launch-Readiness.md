---
type: product-brief
status: active
created: 2026-04-15
updated: 2026-04-15
owner: AI 6
source_of_truth: true
---

# Reminder SMS Launch Readiness

> Part of [[Home]] > Product | See also: [[Product/Priorities|Product Priorities]], [[Product/Roadmap|Product Roadmap]], [[Features/SMS & 10DLC]], [[Tasks/Reminder-SMS-Launch-Completion|Reminder SMS Launch Completion]], [[Tasks/Reminder-SMS-TFV-Implementation-Plan-v2|Reminder SMS TFV Implementation Plan v2]]

## Problem

- A new paid workspace owner expects appointment reminders to work without manual rescue.
- Vurium currently auto-provisions a toll-free sender, but product semantics are too optimistic because `sms_registration_status: active` can exist before real TFV approval.
- That creates a trust gap: the product can imply "SMS is ready" while the safe operational posture is still email-only fallback.

## Primary User

- Primary user: new workspace owner who relies on reminders to reduce no-shows and wants setup to feel automatic.
- Secondary user: Vurium operations/support, who need truthful status and a small recovery path instead of ambiguous "configured but maybe not deliverable" states.

## Desired Outcome

- After paid activation and onboarding completion, the owner sees a truthful reminder-SMS state.
- Reminder SMS becomes launch-ready only when the workspace sender is actually TFV-approved and live-tested.
- Until then, reminders still go out through email fallback so the business is not left silent.

## MVP Scope

- Keep the current **per-workspace toll-free** reminder architecture.
- Make sender status truthful: `configured` means number/profile ready, `tfv_pending` means waiting on carrier review, `active` means verified and deliverable.
- Trigger TFV only after required workspace business data exists.
- Keep **email fallback** as the user-safe default while SMS is not yet verified.
- Prove one fresh-workspace end-to-end pilot:
  - booking confirmation SMS received
  - scheduled reminder SMS received
  - `STOP` works
  - `HELP` works
- Protect grandfathered manual 10DLC workspaces, especially Element, from auto-migration during this launch item.

## Scope Boundary

- This brief does **not** reopen the shared platform-sender / "like Booksy" architecture for launch.
- This brief does **not** redesign onboarding beyond the minimum copy/state changes needed to keep SMS status truthful.
- This brief does **not** migrate legacy/manual 10DLC workspaces.
- This brief does **not** pull in public-site, theme, or signup-polish work that can wait until after reminder SMS is truly live.

## Must-Have Now

- Truthful SMS readiness states in product and docs.
- Per-workspace TFV submission path.
- Email fallback while sender is not verified.
- One live pilot that proves the reminder flow works in reality, not only in code.

## Later

- Platform-sender pivot if Telnyx explicitly confirms a compliant path.
- Broader onboarding simplification after reminder SMS is truly live.
- Additional UI polish once launch-critical reminder trust is solved.

## Dependencies

- Existing AI 5 research in [[Tasks/AI5-Research-Brief-Reminder-SMS]].
- Existing live-state inspection in [[Tasks/TFV-Inspection-Result-2026-04-15]].
- Current execution plan in [[Tasks/Reminder-SMS-TFV-Implementation-Plan-v2]].
- Owner approval of the per-workspace Sole Proprietor path assumed by the current plan.

## AI 5 Requirement Before Planning

- **No new AI 5 research is required before planning this item.** The external-facts gate is already satisfied by [[Tasks/AI5-Research-Brief-Reminder-SMS]].
- **AI 5 becomes required again** only if the team reopens the post-launch shared-sender / platform-sender pivot described in [[Tasks/Platform-Sender-Pivot-Decision|Platform Sender Pivot — Decision Note]].

## Product Acceptance Outcome

- Vurium can truthfully say reminder SMS is launch-ready only when a fresh workspace reaches verified sender status and passes one live end-to-end reminder proof.
- Until that happens, the correct product posture remains: automated provisioning attempt + visible pending state + email fallback.

## Handoff

- AI 7 only if TFV/compliance findings need translation into new consent/copy/legal requirements beyond the current narrow launch scope.
- AI 3 once this framing is accepted and the team is moving through the existing implementation plan and review gate.
