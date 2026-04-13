# SMS Strategy Review — Need Joint AI 1 + AI 2 Plan

> [[Home]] > Tasks | Priority: HIGH
> Created: 2026-04-14

## Problem

Current SMS architecture requires each business owner to:
1. Enter business details (name, address, phone)
2. Complete OTP verification
3. Wait for SP brand + campaign approval (1-7 days)
4. Get a dedicated number assigned

**This is too complex for end users.** Competitors (Booksy, Square, Vagaro) don't ask business owners for any of this — SMS just works.

## How competitors do it

| Platform | Method | User effort | Cost model |
|----------|--------|-------------|------------|
| **Booksy** | ISV 10DLC — Booksy registers as platform sender | Zero | Booksy pays, passes cost to subscription |
| **Square** | Toll-free number per business | Zero | Square auto-provisions TFN |
| **Vagaro** | Shared short code (89885) | Zero | Vagaro pays for short code |
| **Us now** | Per-business SP 10DLC | High — form + OTP + wait | Per-business registration |

## Options to evaluate

### Option A: Toll-free numbers (TFN) — like Square
- Auto-buy TFN per business on signup (we had this code, removed it)
- TFN can send immediately while verification pending
- No brand/campaign registration needed
- Cost: ~$2/month per number + per-message
- Risk: TFN verification can take 1-2 weeks but messages send during pending
- **UX: Zero effort for business owner**

### Option B: ISV platform sender — like Booksy  
- Register VuriumBook as ISV with Telnyx
- One platform brand + CUSTOMER_CARE campaign for all businesses
- Messages say "VuriumBook on behalf of {Business Name}:"
- Risk: 710 rejection (we already got this) — needs ISV approval from Telnyx
- **UX: Zero effort for business owner**

### Option C: Hybrid — TFN for instant + 10DLC as upgrade
- Auto-provision TFN on signup (instant SMS)
- Offer optional 10DLC upgrade in Settings for higher throughput
- Best of both: works immediately + compliant long-term
- **UX: Zero effort initially, optional upgrade later**

### Option D: Keep current per-business SP flow
- Simplify the wizard UI (AI 2)
- Pre-fill as much as possible from signup data
- Make it feel like 2 clicks, not a registration form
- **UX: Still requires owner action but minimal**

## Questions to answer

1. Can we use TFN (toll-free) for appointment reminders without 10DLC? (Check Telnyx docs)
2. Did our 710 rejection block ISV model permanently, or can we retry with proper ISV application?
3. What's the per-message cost difference between TFN vs 10DLC?
4. What does Telnyx ISV support (Jonathan) recommend for our use case?

## Who does what

- **AI 1**: Research Telnyx TFN API, verify if we can auto-provision without 10DLC, check costs
- **AI 2**: Design simplified SMS setup UX for whichever option we choose
- **Owner**: Ask Jonathan (Telnyx call next week) which option he recommends

## Decision needed before launch

This affects whether SMS works out-of-box or requires owner setup. Must decide before selling to new customers.
