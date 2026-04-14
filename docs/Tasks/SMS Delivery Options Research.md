# SMS Delivery Options Research

> [[Home]] > Tasks | Related: [[SMS & 10DLC]], [[Tasks/SMS-Strategy-Review|SMS Strategy Review]], [[Email System]], [[Infrastructure]]
> Updated: 2026-04-13

## Purpose

This note keeps broader SMS delivery research in one place so product and infrastructure decisions do not depend only on the current Telnyx implementation.

Use this document when we need to revisit:
- sender strategy by country
- provider selection
- Ukraine-specific constraints
- SMS vs OTT / RCS fallback
- delivery receipts, inbound messaging, and operational architecture

This is a reference memo, not the current launch decision. The active launch path is still documented in [[Tasks/SMS-Strategy-Review|SMS Strategy Review]] and [[SMS & 10DLC]].

## Executive summary

For booking systems, SMS is still the most universal channel for:
- booking confirmations
- appointment reminders
- schedule changes
- OTP / 2FA

But “SMS” is not one single thing. In practice we choose across multiple layers:
- integration interface: REST/HTTP, SMPP, SOAP/XML, SMTP/email-to-SMS
- sender identity: alphanumeric sender ID, long code / virtual number, short code, toll-free
- delivery model: CPaaS, local aggregator, direct operator connection
- fallback channel: SMS only, SMS + Viber, SMS + RCS, SMS + OTT

For Ukraine, one of the biggest takeaways is:
- do not assume numeric sender IDs or 2-way SMS will work the same way they do in the US
- branded alphanumeric sender IDs are often the safer default
- local operator rules and approval flows matter much more than generic global assumptions

## Core concepts we need for production

### DLR / delivery status

A successful provider API response usually means:
- accepted
- queued
- handed off

It does **not** always mean the message was delivered to the phone.

Production SMS needs:
- delivery receipt handling
- async status updates
- retry policy
- audit log of provider status transitions

### MO / inbound SMS

If we want users to reply by text, we need:
- an inbound-capable sender identity
- provider support for MO / 2-way messaging in that country
- webhook handling for inbound events

This matters for flows like:
- reply STOP
- reply HELP
- reply 1 to confirm / 0 to cancel
- SMS support loops

### Sender identity

The sender type changes what is even possible:

- **Alphanumeric sender ID**
  - great for branded transactional alerts
  - usually one-way
  - often preferred in Ukraine
- **Long code / virtual number**
  - useful for 2-way conversations
  - country rules vary heavily
- **Short code**
  - high throughput
  - expensive and approval-heavy
- **Toll-free**
  - often used as a platform-managed sender model in the US
  - relevant to our current Square-style direction

## Ukraine-specific notes

### Practical guidance

For Ukraine we should assume:
- alphanumeric sender IDs are often more realistic than numeric sender IDs
- generic sender IDs can be filtered or rejected
- 2-way SMS may not be supported, depending on provider and route
- sender approval can be operator-specific and take time

### Product implication for VuriumBook

If Ukraine becomes a serious launch or expansion market, we should not hardcode a US-style sender strategy into the product.

We need country-aware messaging logic for:
- sender type
- 2-way capability
- opt-in language
- STOP / HELP expectations
- provider routing

For example:
- US default may be toll-free for appointment reminders
- Ukraine may need branded alphanumeric sender IDs, local operator APIs, or local aggregators

## Delivery options relevant to booking systems

### 1. HTTP / REST API

Best for:
- small and medium products
- fast implementation
- transactional messaging
- OTP

Pros:
- fastest to integrate
- easy to observe
- good SDK/documentation support

Risks:
- easy to create duplicate sends without idempotency
- easy to misread `queued` as `delivered`
- webhook handling still required for real status tracking

### 2. SMPP

Best for:
- higher volume messaging
- enterprise scale
- direct telecom-style integrations

Pros:
- high throughput
- deeper control

Risks:
- much more complex than REST
- long-lived sessions, keepalive, error handling
- usually contract-heavy and slower to ship

### 3. SOAP / XML APIs

Best for:
- legacy integrations
- older ERP/CRM ecosystems

Pros:
- compatibility

Risks:
- worse developer experience
- more brittle and slower to maintain

### 4. SMTP / Email-to-SMS

Best for:
- emergency fallback
- legacy systems

Pros:
- very easy to bolt on in some environments

Risks:
- weak observability
- worse control over retries and delivery lifecycle
- usually not the best primary channel for booking confirmations

## Provider model options

### CPaaS providers

Examples:
- Twilio
- Vonage
- Plivo
- Infobip
- Sinch
- Bird / MessageBird

Best for:
- global reach
- quick start
- standard webhook + REST integrations

Pros:
- fast launch
- mature documentation
- multi-country support

Risks:
- provider lock-in
- country-specific restrictions can still surprise us
- pricing and delivery quality vary by route

### Local aggregators / local operator platforms

Relevant for Ukraine:
- Kyivstar Open API
- Vodafone Ukraine business messaging
- lifecell / Omnicell
- local aggregators such as AlphaSMS / SMS-Ukraine

Best for:
- country-specific optimization
- local routing
- local compliance and support

Pros:
- better local fit
- often better understanding of operator rules

Risks:
- more fragmented tooling
- weaker international portability
- may require separate integrations by market

### Direct operator connections

Best for:
- enterprise scale
- very large domestic volumes
- high control / lowest-level routing

Pros:
- potentially best cost and route quality at scale

Risks:
- slowest to launch
- highest legal and technical complexity
- usually only worth it after real scale

## Sender strategy options

### Toll-free default

Good fit when:
- we want a Square-like owner experience
- the platform hides compliance complexity
- the primary market is the US

Pros:
- low friction for the owner
- clean default UX

Risks:
- still needs provider/operator confirmation
- does not automatically solve all international markets

### Per-business sender / manual registration

Good fit when:
- each business must be the true sender
- local regulations or carrier rules demand that mapping

Pros:
- clearer compliance for business-specific traffic

Risks:
- bad default UX for solo users
- harder onboarding
- long tail of support

### Hybrid by market

Good fit when:
- we operate in multiple countries
- sender rules are different by market

Example direction:
- US: toll-free-first
- Ukraine: alpha sender ID through local operator / aggregator
- special cases: 2-way number only where the country/provider truly supports it

This is likely the long-term realistic architecture if VuriumBook expands outside a single country.

## 2-way, STOP/HELP, and compliance implications

Not every country / route behaves the same way for:
- inbound SMS
- STOP / HELP automation
- toll-free availability
- long-code usage

That means product copy and backend behavior may need to vary by market.

For production we should treat these as configurable capabilities, not universal assumptions:
- `supports_inbound_sms`
- `supports_stop_help_keywords`
- `preferred_sender_type`
- `supports_toll_free`
- `supports_alpha_sender`

## Recommended architecture by company stage

### Small product

Recommended:
- REST API + webhooks
- one strong primary provider
- clear sender strategy per target market
- idempotency + retry + DLR tracking from day one

### Medium product

Recommended:
- dedicated `Messaging Service`
- queue-based send pipeline
- template store
- consent store
- delivery event processing
- country-aware sender rules

### Enterprise

Recommended:
- multi-provider routing
- country compliance rules engine
- fallback across SMS / OTT / RCS
- SLA monitoring
- fast route failover

## Implications for VuriumBook right now

### Short term

Our current product direction still makes sense:
- Telnyx Verify for OTP
- toll-free-first reminders for new US workspaces
- grandfathered manual 10DLC for pending / existing cases like Element

### Medium term

If we launch in Ukraine or build for Ukrainian traffic seriously, we should likely evaluate:
- local operator APIs
- local aggregators
- alpha sender ID strategy
- whether 2-way SMS is actually needed there

### Long term

VuriumBook probably should not stay forever on a single global SMS assumption.

A safer future design is:
- country-aware messaging rules
- sender-type abstraction
- provider routing by market
- SMS + OTT fallback where it improves delivery

## Decision guardrails

This document is **not** a launch pivot by itself.

Use it as research support when deciding:
- whether to add Ukraine-specific routing later
- whether to add multi-provider support
- whether to adopt local operator APIs
- whether to build a proper messaging service layer

For live launch decisions, always defer to:
- [[Tasks/SMS-Strategy-Review|SMS Strategy Review]]
- [[Tasks/Launch Readiness Plan|Launch Readiness Plan]]
- [[Tasks/In Progress|In Progress]]
