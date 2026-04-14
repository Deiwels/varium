# SMS Finalization Plan

> [[Home]] > Tasks | Related: [[SMS & 10DLC]], [[Tasks/SMS-Strategy-Review|SMS Strategy Review]], [[Tasks/In Progress|In Progress]]
> Updated: 2026-04-15

## Goal

Finish SMS to a launch-ready state without breaking the protected legacy path.

## 3-AI execution split

Before anyone changes SMS again, re-read:
- `docs/Tasks/Telnyx-Integration-Plan.md`
- `docs/Tasks/Platform-Sender-Pivot-Decision.md`
- `docs/Tasks/SMS Finalization Plan.md`
- `docs/AI-Work-Split.md`
- `docs/Tasks/In Progress.md`

Current ownership:
- `Claude / AI 1` owns backend SMS hardening and docs:
  - `backend/index.js`
  - `.github/workflows/deploy-backend.yml`
  - SMS backend / ops docs
- `Codex / AI 2` owns frontend SMS UX:
  - `app/settings/page.tsx`
  - `app/signup/page.tsx`
  - related frontend-facing SMS copy alignment
- `Verdent` acts as reviewer / verifier / research support:
  - sanity-checks code and docs
  - verifies the final shape matches the current launch decision
  - does not open a parallel backend implementation track unless ownership is reassigned first
- `Owner` handles external blockers:
  - add `TELNYX_WEBHOOK_PUBLIC_KEY` to GitHub Secrets
  - follow up with Jonathan / Telnyx
  - unblock `TELNYX_VERIFY_PROFILE_ID` / account-level Verify issues

Execution order:
1. `Claude / AI 1` finishes backend gaps and commits them cleanly.
2. `Codex / AI 2` ships the frontend SMS auto-activation UX as a separate clean package.
3. `Verdent` performs verification / docs sanity after both packages land.
4. Live SMS verification happens only after the backend + frontend packages are both visible in `main`.

Locked product rules:
- New workspaces use **toll-free-first** reminder setup
- Existing / pending 10DLC workspaces stay on the **grandfathered manual** path
- `Element Barbershop` stays on its current pending manual review path with **no migration**
- OTP stays on:
  - `POST /public/verify/send/:wsId`
  - `POST /public/verify/check/:wsId`

## AI 2 — Frontend / UX / legal alignment

### 1. Verify new-workspace SMS UX
- Open a fresh workspace in `Settings -> SMS Notifications`
- Confirm the default card is toll-free-first
- Confirm EIN / Sole Proprietor registration is not shown as the main path
- Confirm state copy is understandable:
  - `not enabled`
  - `provisioning`
  - `pending`
  - `configured` (mapped from backend `active`)
  - `failed`
- Confirm the SMS actions still work through the normal authenticated app session
  - `enable toll-free`
  - manual registration fallback
  - OTP verification
  - These now use the shared auth-aware API helpers instead of raw `fetch(window.__API...)`

### 2. Verify customer-facing consent text
- Open a live booking page
- Confirm booking consent uses:
  - `{shopName} Appointment Notifications`
- Repeat on the waitlist flow
- Confirm Terms and Privacy links are present and clickable

### 3. Verify email-only fallback messaging
- On a workspace where SMS is not active, confirm the UI clearly says email reminders still work
- Confirm the UI does not imply that appointment SMS is already live when it is not

### 4. Verify legal page alignment
- Re-read:
  - `app/privacy/page.tsx`
  - `app/terms/page.tsx`
- Confirm they still match the live consent copy and the dual-path sender model after deploy

## AI 1 — Backend / Telnyx / operations

### 1. Finish OTP provider setup
- Create the real Telnyx Verify Profile
- Capture the returned `TELNYX_VERIFY_PROFILE_ID`
- Save it as the GitHub secret `TELNYX_VERIFY_PROFILE_ID`

### 2. Verify OTP behavior
- Test `/public/verify/send/:wsId` and `/public/verify/check/:wsId` before the real secret is present
- Test again after the secret is present
- Confirm the fallback path and Telnyx Verify path both behave correctly

### 3. Verify reminder sender behavior
- Confirm new workspaces on toll-free do not silently fall back to the platform/global sender for appointment reminders
- Confirm reminder behavior is:
  - workspace sender when active
  - email-only when workspace SMS is not active
- Confirm the current `sms_registration_status: 'active'` written by `POST /api/sms/enable-tollfree` is operationally correct for the real Telnyx toll-free lifecycle
- If provisioning can succeed before reminder delivery is truly live, adjust backend status semantics before launch instead of letting the product overstate readiness

### 4. Protect legacy workspace behavior
- Confirm `Element Barbershop` still shows the manual / pending 10DLC path
- Confirm no migration, no sender rewrite, and no flow rewrite happened during the toll-free pivot

### 5. Finish launch gate
- Get written Telnyx confirmation, or an internal pilot sign-off, that Vurium-managed toll-free reminders are acceptable for end-business appointment messaging

## Joint sign-off

### Fresh workspace pass
- One new workspace successfully goes through toll-free-first setup
- Reminder UX is clear
- Consent text is correct

### Legacy workspace pass
- One grandfathered / pending manual workspace still shows the old path
- `Element Barbershop` remains untouched

### OTP pass
- OTP works end-to-end
- Provider behavior is confirmed and documented

### Legal pass
- Booking consent text
- Privacy
- Terms

All four must match the live product

## Done criteria

SMS can be considered launch-ready when all of the following are true:
- New workspaces get toll-free-first setup by default
- Legacy / pending 10DLC workspaces are preserved
- `Element Barbershop` is still intact on the manual review path
- OTP works with the real Telnyx Verify profile
- Appointment reminders do not use the wrong sender path
- Legal copy matches the actual product behavior
