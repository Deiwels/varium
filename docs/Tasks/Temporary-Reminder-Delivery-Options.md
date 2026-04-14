# Temporary Reminder Delivery Options

> [[Home]] > Tasks | Related: [[Features/SMS & 10DLC|SMS & 10DLC]], [[Tasks/Telnyx-Integration-Plan|Telnyx Integration Plan]], [[Tasks/Element-10DLC-Resubmission-Checklist|Element 10DLC Resubmission Checklist]], [[Tasks/US-A2P-CTA-Brand-Verification-Notes|US A2P CTA & Brand Verification Notes]]
> Created: 2026-04-14
> Context: temporary and alternative reminder delivery options while a tenant is blocked on A2P 10DLC CTA / brand verification

## TL;DR

For Vurium's current product and codebase, the practical temporary order is:

1. **Transactional email fallback now**
2. **Per-business verified toll-free SMS next**
3. **Resubmit 10DLC with better public proof in parallel**

Do **not** spend time right now on:

- shared short codes
- platform-wide shared sender
- RCS / WhatsApp / voice as a launch unblocker

Those are either not viable for our compliance posture, not implemented in our stack, or slower than simply fixing the per-business CTA / website artifacts.

---

## What we already have in the codebase

### 1. Transactional email is already live

Current backend already sends client email for:

- booking confirmations
- waitlist notifications
- satisfaction / review flows

This makes **email the only zero-new-provider temporary reminder channel** we can rely on immediately while SMS is blocked.

### 2. Client SMS is already dual-path

Current SMS architecture:

- new workspaces -> per-workspace dedicated toll-free
- legacy / grandfathered -> manual 10DLC
- Element Barbershop -> protected manual 10DLC remediation case

This means the best temporary SMS path is **still per-business sender isolation**, not a platform-wide originator.

### 3. Push exists, but not as a client reminder fallback

The current APNs implementation is for **staff / CRM app users**, not for public booking customers.

So push notifications are not a useful emergency substitute for appointment reminders to customers unless we build a separate customer-app or web-push flow.

---

## What is realistic right now

## Option A — Transactional email fallback

**Use now**

This is the fastest safe fallback whenever SMS is blocked for a workspace or campaign.

Why it fits Vurium right now:

- already implemented
- no new carrier approval cycle
- no Telnyx 10DLC / TFV dependency
- preserves reminders and waitlist communication while we repair SMS

Limits:

- lower immediacy than SMS
- inbox placement varies
- not as strong for same-day reminders

Practical recommendation:

- keep **email-first fallback** whenever workspace SMS sender is not active
- for Element specifically, continue using email while 10DLC artifacts are being remediated

## Option B — Verified toll-free SMS per business

**Best short-term SMS workaround**

If we need SMS before 10DLC is repaired, the most realistic alternative is a **verified toll-free number per business**, not a shared sender.

Why it fits our architecture:

- it preserves per-business sender isolation
- it is already the default path for new workspaces
- it avoids the exact platform-as-sender 710 failure we already hit

What to keep in mind:

- toll-free still needs verification / approval
- it is not instant, but it is typically measured in business days, not multi-week short-code timelines
- for our current system this is a **business-by-business** route, not a platform-global shortcut

Practical recommendation:

- keep this as the preferred SMS fallback route for new workspaces
- do **not** auto-migrate Element mid-review; Element stays on the manual remediation path unless we explicitly choose to abandon and replace that path

## Option C — Hosted screenshots as resubmission evidence

**Useful immediately**

If reviewers still cannot understand the opt-in flow from the live page, hosted screenshots are a practical support artifact for resubmission.

Use screenshots that clearly show:

- `Element Barbershop` name
- the booking / waitlist form
- the unchecked SMS consent checkbox
- the full compliance copy
- public `Privacy Policy` and `Terms`

This is especially useful if custom HTML or hydration timing makes the live path harder for a reviewer to interpret at first glance.

---

## What is not worth pursuing right now

## Dedicated short code

This is a medium-term deliverability play, not a fast unblocker.

Reasons:

- higher fixed cost
- multi-week lead time
- unnecessary for our current reminder volume

## Shared short code

Treat as **not viable** for current US A2P compliance strategy.

Reasons:

- does not fit the per-business sender story we need
- overlaps with the same "aggregator appearance" risk we are already trying to avoid

## WhatsApp / RCS

Potentially valuable later, but not a short-term unblocker for Vurium right now.

Reasons:

- new onboarding / approval paths
- new consent handling
- not already wired into our reminder stack
- adds product and operational work instead of reducing it

## Voice / IVR

Possible as an emergency channel, but not a good first temporary move for us.

Reasons:

- new flow to build
- spam-label / trust issues
- worse UX for a booking product than email fallback + repaired SMS

---

## Recommended temporary plan for Vurium

### Track 1 — Keep reminders flowing now

- Use transactional email whenever SMS is unavailable
- Keep content strictly transactional / appointment-related
- Avoid introducing any new platform-wide SMS sender model during this period

### Track 2 — Repair the business-specific proof

- strengthen the public Element page
- keep the exact DBA visible
- keep services / address / phone / email visible without login
- ensure both booking and waitlist opt-in paths are documented in `messageFlow` if both are live
- use hosted screenshots if the reviewer still needs clearer evidence

### Track 3 — Maintain the long-term safe architecture

- new workspaces stay on per-workspace toll-free
- legacy manual 10DLC stays isolated
- Element remains protected until its resubmission is resolved

---

## Decision for the team

This research reinforces the direction already chosen in `docs`:

- **yes** to email fallback
- **yes** to per-business toll-free as the best short-term SMS path
- **yes** to stronger per-business CTA / website proof
- **no** to a rushed shared-sender workaround
- **no** to short-code or omnichannel expansion as a launch unblocker

The immediate goal is not "invent a new channel strategy." The immediate goal is:

1. keep reminders alive with email fallback
2. finish Element public proof / resubmission artifacts
3. keep the toll-free-first architecture for everyone else
