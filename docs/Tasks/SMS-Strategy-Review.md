# SMS Launch Decision Memo

> [[Home]] > Tasks | Priority: HIGH
> Updated: 2026-04-15 | Related: [[SMS & 10DLC]], [[Tasks/Launch Readiness Plan|Launch Readiness Plan]], [[Production-Plan-AI1]], [[Production-Plan-AI2]]

## Decision

**Launch with the current SMS architecture.**

- OTP, signup, and booking verification use **Telnyx Verify**
- Appointment reminders and business texting use **per-business SMS registration**
- `Settings -> SMS Notifications` remains the owner-facing setup flow for launch

**Do not pivot before launch** to:
- full toll-free auto-provisioning as the default path
- a single ISV/platform-sender architecture
- a hybrid auto-provision + upgrade model

These remain post-launch strategy options, not launch blockers.

## Why this is the launch decision

- It matches the code that already exists in `backend/index.js` and the current Settings/booking UI
- It avoids a late architecture change right before selling
- It keeps the remaining work operational: live verification, Telnyx/account setup, and trustable docs
- It reduces launch risk by verifying what we already built instead of reopening the messaging architecture

## Current launch architecture

### OTP / login / booking verification

- Stable public interface:
  - `POST /public/verify/send/:wsId`
  - `POST /public/verify/check/:wsId`
- When `TELNYX_VERIFY_PROFILE_ID` is present, these routes use **Telnyx Verify**
- When the env var is missing, the backend safely falls back to the legacy local-code path

### Appointment reminders / business SMS

- Business messaging stays on the current per-business registration flow
- Owners complete setup in `Settings -> SMS Notifications`
- Sole proprietor registration, OTP verification, and activation are already implemented

### Launch UX position

- The Settings SMS wizard is the default launch path for business messaging
- `/api/sms/enable-tollfree` is **not** the documented default customer-facing launch path
- Public OTP route contracts stay stable; launch planning should not rename or move them

## What remains before SMS is launch-ready

### Operational prerequisites

- Create one Telnyx Verify Profile and obtain the real `verify_profile_id`
- Save it as the GitHub secret `TELNYX_VERIFY_PROFILE_ID`
- Confirm Cloud Run picks up that secret on deploy
- Finish Vurium Inc. Telnyx brand verification for business messaging

### Live verification

- Verify public OTP without the secret still falls back safely
- Verify public OTP with the secret uses Telnyx Verify successfully
- Verify the Settings SMS wizard is understandable on mobile
- Verify booking and waitlist flows save `sms_consent_text` and `sms_consent_text_version`
- Verify business-first consent copy is shown on the public booking flow

## Deferred post-launch experiments

These are valid strategy tracks, but they are **not part of launch execution**:

### Toll-free auto-provisioning

- Revisit as a post-launch onboarding simplification path
- Evaluate cost, trust, deliverability, and whether it materially reduces owner setup burden

### ISV / platform-sender retry

- Revisit only through Telnyx partnership/support guidance
- Treat as a research/business-development track, not a launch dependency

### Hybrid instant-on SMS

- Revisit only if support burden from per-business setup proves too high after launch
- Any hybrid model must preserve the current stable OTP routes and avoid a breaking migration for existing workspaces

## Implementation boundaries

- Keep the public OTP interface stable
- Keep the current Settings SMS wizard as the launch UX
- Do not document toll-free enablement as the default launch path
- Treat `TELNYX_VERIFY_PROFILE_ID` as an operational dependency, not a code blocker
