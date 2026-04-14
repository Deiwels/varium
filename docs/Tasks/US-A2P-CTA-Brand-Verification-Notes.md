# US A2P CTA & Brand Verification Notes

> [[Home]] > Tasks | Owner: AI shared reference
> Related: [[Features/SMS & 10DLC|SMS & 10DLC]], [[Tasks/Element-10DLC-Resubmission-Checklist|Element 10DLC Resubmission Checklist]], [[Tasks/Telnyx-Integration-Plan|Telnyx Integration Plan]]
> Added: 2026-04-14

---

## Why this note exists

This is the distilled, actionable reference from the latest US A2P 10DLC CTA / brand-verification research for SaaS platforms sending SMS on behalf of local businesses.

The main takeaway is simple:

**Most 10DLC failures are not telecom plumbing failures. They are coherence failures.**

Reviewers are checking:
- who the sender is
- whether the public CTA really belongs to that sender
- whether the consent evidence is visible, branded, and complete

For Vurium, this means we should optimize for **per-business fidelity**, not generic platform artifacts.

---

## Core rule: per-business fidelity

For each local business campaign, the following must line up exactly:

- registered legal identity
- DBA / customer-facing brand name
- website branding
- CTA / opt-in flow
- privacy policy / terms pages
- message flow description
- sample messages
- help / opt-out messaging

If one of those points to a generic Vurium page or uses a slightly different brand name, reviewers can interpret the campaign as aggregator / reseller / shared-consent traffic.

---

## Exact-match rules we should treat as non-negotiable

### Legal identity

- Legal company name must exactly match the business tax record
- Legal address should be treated as a canonical string, not prettified formatting
- Small differences can matter:
  - punctuation
  - suffixes
  - abbreviations
  - `Street` vs `St.`

### DBA / storefront name

- If the shop uses a DBA or storefront name, that exact DBA must appear consistently in:
  - campaign submission
  - public booking page
  - consent text
  - sample messages

For Element, that means the reviewer should keep seeing:
- `Element Barbershop`

and not drift to:
- generic `VuriumBook`
- a different legal-entity string
- placeholder wording

---

## Public proof requirements for local-business campaigns

The submitted website / CTA URL should be:

- public
- no-login
- stable
- business-specific
- rich enough to verify the business

At minimum, the public page should visibly show:

- business name
- address
- phone
- email
- services / what the business offers
- booking CTA
- privacy policy link
- terms link

The page should not look like:

- only a bare form
- a platform-generic landing page
- a login-gated dashboard

For Vurium this means:

- good: `https://vurium.com/book/elementbarbershop`
- risky: `https://vurium.com/book/`

---

## CTA / opt-in requirements

The CTA should make the reviewer immediately understand:

- which business is sending
- what messages the customer will receive
- that consent is optional
- how to opt out
- where to find privacy / terms

Required disclosures should be visible on the CTA path:

- brand / program name
- message purpose
- frequency disclosure
- `Msg & data rates may apply`
- `Reply STOP to opt out`
- `Reply HELP for help`
- `Consent is not a condition of purchase`
- privacy policy link
- terms link

For Vurium, the consent language should be visible on first render of the form, not hidden behind extra interaction.

---

## Multi-opt-in rule

If a campaign has more than one opt-in method, the submission should list them all.

Examples:

- booking form checkbox
- waitlist checkbox
- keyword opt-in
- in-person paper / POS opt-in

If we only describe one path but actually use more than one, the submission can look incomplete.

For the current booking product, this means we should explicitly think about:

- booking flow opt-in
- waitlist opt-in

when writing `messageFlow` and campaign notes.

---

## Policy pages should be first-class artifacts

Even when not strictly required by the current provider flow, we should treat per-business privacy / terms pages as first-class submission artifacts.

What matters:

- policy URLs are public
- they belong to the business being registered
- they are easy for a reviewer to inspect
- they are linked from the booking / CTA page

Forward-looking note:

- Twilio has already announced stricter policy-URL requirements for new A2P campaign API submissions effective **June 30, 2026**
- even though Vurium is on Telnyx today, the operational lesson still applies: policy pages should not be an afterthought

---

## What this changes for Vurium right now

### For Element Barbershop

Use this note as a stricter interpretation of the existing remediation checklist:

- exact booking URL in submission
- exact brand / DBA match everywhere
- public business proof on the booking page
- visible consent copy before form submission
- public privacy / terms links
- no generic platform-only artifacts in sample messages or message flow

### For the broader SMS strategy

This research reinforces the current decision:

- do **not** go back to a generic platform-sender model for launch
- keep the per-business fidelity path
- treat generic platform roots and shared branding as high-risk compliance signals

---

## Short checklist

Before resubmitting any local-business campaign, ask:

1. Does the submission point to the exact business URL?
2. Does that page clearly prove the business is real?
3. Does the consent text name the same sender brand as the campaign?
4. Are privacy / terms links public and visible?
5. Are all real opt-in paths documented?
6. Do sample messages look exactly like production traffic?

If any answer is “no”, expect review risk.
