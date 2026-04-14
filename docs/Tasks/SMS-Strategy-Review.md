# SMS Strategy Review — Dual-Path Launch Memo

> [[Home]] > Tasks | Priority: HIGH
> Updated: 2026-04-15 | Related: [[SMS & 10DLC]], [[Tasks/Launch Readiness Plan|Launch Readiness Plan]], [[Tasks/In Progress|In Progress]]

## Decision

VuriumBook is pivoting to a **dual-path SMS strategy**:

- **Default for new workspaces**: dedicated **toll-free** sender per workspace
- **Grandfathered path**: existing / pending **manual 10DLC** registration stays alive
- **OTP / signup / booking verification**: stays on **Telnyx Verify** through the existing public routes

This means we are no longer treating owner-facing EIN / Sole Proprietor registration as the normal reminder setup flow for new customers.

## Why we are changing direction

- The current manual 10DLC flow creates too much friction for solo operators and first-time customers
- We already have a working toll-free provisioning path in `POST /api/sms/enable-tollfree`
- We need a launch UX closer to Square-style onboarding, where the platform hides most compliance complexity from the owner
- Element and any other already-pending 10DLC businesses should not be interrupted or migrated mid-review

## Evidence and competitive framing

### Square

Square explicitly documents that appointment communication texts are sent from a **toll-free number**.

Source:
- [Square Support — appointment communications](https://squareup.com/help/us/en/article/8447-troubleshoot-customer-appointment-communications)

### Booksy

Booksy officially documents that:
- appointment reminders are centrally sent by Booksy
- verification codes and other texts are centrally handled by Booksy

But I did **not** find an official Booksy source that proves whether the sender rail is toll-free or 10DLC.

Sources:
- [Booksy reminders](https://support.booksy.com/hc/en-gb/articles/16463854228114-Does-Booksy-send-clients-reminders-of-their-upcoming-appointments)
- [Booksy verification/text troubleshooting](https://support.booksy.com/hc/en-us/articles/18791260716690-Why-aren-t-my-clients-receiving-verification-codes-or-other-text-messages-from-Booksy)

Important note:
- older internal repo notes mention a Booksy long-code observation
- treat that as **prior research / inference**, not official proof

## Launch position

### New workspaces

- Show **toll-free-first** SMS setup in `Settings -> SMS Notifications`
- Provision the dedicated toll-free number **when the owner enables SMS reminders**
- If SMS is not live yet, the product stays on **email-only fallback**
- Do not require EIN or company formation for the default reminder path

### Existing / pending 10DLC workspaces

- Keep the current manual path untouched
- Do not auto-migrate or auto-rewrite their sender strategy
- Keep support and docs clear that this is the **grandfathered / manual** path
- Element remains the reference example for this path

#### Protected case: Element Barbershop

- `Element Barbershop` is a **protected grandfathered workspace**
- Its current pending manual / 10DLC approval flow must remain intact until Telnyx review is finished
- Do not switch Element to the toll-free-first path during this review window
- Do not rewrite its sender identity, registration state, or owner-facing SMS flow unless there is an explicit business decision after approval

### OTP interfaces

Keep these public contracts stable:
- `POST /public/verify/send/:wsId`
- `POST /public/verify/check/:wsId`

These stay separate from the reminder-sender strategy.

## Operational gate

The broad toll-free default is the product direction, but it should be treated as fully launch-safe only after one of these is true:

- we receive written Telnyx confirmation that Vurium’s verified toll-free setup can carry platform-managed appointment reminders for end businesses
- or our internal pilot proves this path works cleanly for Vurium-owned test workspaces

Until then:
- keep the legacy manual path alive
- keep new workspace UX toll-free-first
- use **email-only fallback** instead of forcing EIN friction
- keep `Element Barbershop` on its existing pending manual review path with no migration

## Backend / frontend role split

### Backend

- `POST /api/sms/enable-tollfree` is now the default reminder provisioning path for new workspaces
- `POST /api/sms/register` and `POST /api/sms/verify-otp` remain the manual grandfathered path
- Appointment reminder flows should not fall back to the platform global sender when workspace SMS is not active

### Frontend

- New workspaces see a toll-free-first card with simple states:
  - `Not enabled`
  - `Provisioning`
  - `Pending`
  - `Active`
  - `Failed`
- The old SP / EIN-heavy flow is hidden behind manual / advanced fallback copy
- Grandfathered workspaces still see the manual business-registration UI

## Deferred items

These are no longer launch blockers:

- forcing all legacy workspaces to migrate to toll-free
- retrying single-brand ISV / platform-sender 10DLC before launch
- deciding the final long-term Booksy-equivalent architecture before our first toll-free pilot completes
