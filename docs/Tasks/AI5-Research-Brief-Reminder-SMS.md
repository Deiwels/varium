# AI5 Research Brief — Reminder SMS Launch

> [[Home]] > Tasks | Related: [[Tasks/Reminder-SMS-Launch-Completion]], [[Features/SMS & 10DLC]], [[Tasks/Telnyx-Integration-Plan]]
> Created: 2026-04-15

## Why this research exists

We need to finish appointment reminder SMS so the team can say with confidence that reminder sending is truly launch-ready, not only code-complete.

## Decision(s) blocked on external facts

- Whether the current per-workspace Telnyx toll-free path is already truly delivery-ready for US appointment reminders
- Whether each reminder sender requires TFV or another carrier-side verification step
- Whether our backend status `sms_registration_status: active` matches real Telnyx reminder readiness

## Questions from AI 1

- For Telnyx US reminder traffic on a dedicated toll-free number per workspace, is buying the number + attaching a messaging profile enough for deliverability, or is TFV still required before real reminder sends should be considered live?
- If TFV is required, can it be submitted through API or only through the portal / manual ops?
- Is there any official Telnyx guidance on whether autoresponse setup + messaging profile attachment still leaves the number in a blocked or filtered state until TFV is approved?

## Questions from AI 2

- Is our current product wording safe if the backend marks a sender `active` immediately after provisioning, or does official Telnyx guidance imply we should expose a softer state until TFV / live-delivery proof exists?
- For a per-workspace customer-care reminder model, what exact official wording or constraints does Telnyx expect us to follow for toll-free reminder traffic?

## Questions from AI 3

- What exact evidence should count as “research complete” before I turn this into a final implementation / verification plan?
- Which official source should the team treat as the final authority if Telnyx docs, support articles, and portal behavior differ?

## Questions from AI 4

- If reminder SMS is partially configured but not truly deliverable, what is the correct emergency-safe fallback posture: hold at email-only, or allow limited SMS sends?

## Owner context / constraints

- Element Barbershop remains on the grandfathered manual 10DLC path and must not be auto-migrated.
- OTP / verification sender has already been separated from reminder sender using `TELNYX_VERIFY_FROM`.
- The team wants the smallest correct path to live reminder SMS, not a speculative architecture rewrite.

## Executive summary

- **Fact:** Telnyx Help Center says: before the first outbound message from a toll-free number, you must first **verify** the number. The same guide says the positive state is `Verified`, and only then "you can begin sending outbound text messages from the toll free number."
- **Fact:** Buying a toll-free number and attaching it to a messaging profile is **necessary configuration**, but Telnyx treats toll-free verification as a separate compliance / carrier-approval step. Configuration alone is not the same thing as delivery readiness.
- **Fact:** TFV is **not portal-only**. Telnyx documents portal submission, API submission, API retrieval/listing, API update/resubmission, status-history retrieval, and webhook monitoring for TFV.
- **Fact:** Appointment-style traffic is officially supported as a toll-free use case. Telnyx sources explicitly list `Appointments`, `Booking Confirmations`, and `Customer Care`.
- **Fact:** Even after verification, Telnyx says some carriers may still filter newly verified toll-free traffic and recommends ramping volume gradually over 1-2 weeks.
- **Inference:** In Vurium's per-workspace dedicated-number model, each workspace sender should be treated as needing explicit TFV coverage for that workspace's business identity and use case. "Purchased + attached to profile + backend marked active" is not enough to call reminder SMS launch-ready.
- **Inference:** Current repo semantics around `sms_registration_status: active` are too optimistic if that field is meant to mean "real customer-delivery ready." At most it currently proves "configured," not "carrier-approved + live-tested."

## AI 5 findings

### 1. Is "buy number + attach messaging profile" enough for Telnyx US appointment reminders on dedicated toll-free numbers?

- **Fact:** No official Telnyx source says that purchase + profile attachment alone makes a toll-free sender launch-ready for outbound US reminder traffic.
- **Fact:** Telnyx Help Center says: "Before you can send your first outbound message from a Toll-Free phone number you must first 'Verify' the number."
- **Fact:** The same guide says: `Verified` means Telnyx and carriers have approved the request and then "you can begin sending outbound text messages from the toll free number."
- **Fact:** Telnyx developer docs for phone-number messaging configuration separate:
  - messaging profile assignment,
  - messaging enablement,
  - regulatory compliance.
  For toll-free numbers, the regulatory requirement called out is **toll-free verification**.
- **Fact:** Telnyx Help Center also states that use of non-verified toll-free numbers may result in spam blocks, and separately notes that unverified toll-free numbers attempting to send are blocked under current policy, with a narrow legacy exception for some older pending-verification states.
- **Fact:** Telnyx API schema ties TFV requests to specific `phoneNumbers`, and list APIs support filtering by `phone_number`, which reinforces that verification is associated with the numbers on the request.
- **Inference:** For Vurium's reminder path, the minimum safe reading is:
  - buy number,
  - attach messaging profile,
  - ensure messaging is enabled,
  - submit TFV for that sender,
  - wait until TFV reaches a positive approved state before calling the sender truly live.
- **Inference:** In a one-dedicated-number-per-workspace model, each dedicated workspace number should be treated as needing TFV coverage that matches that workspace/business identity and reminder use case.
- **Inference:** One TFV request can cover multiple phone numbers only when the same business identity, CTA, samples, and use-case description genuinely apply to all numbers in that request.
- **Unknown:** Official sources here do not clearly say whether multi-number TFV requests can be partially approved per-number. That remains unknown.

### 2. If TFV is required, can it be automated via API or is it portal/manual-only?

- **Fact:** Telnyx Help Center says TFV can be submitted in two ways:
  - Telnyx Portal
  - Telnyx API
- **Fact:** Telnyx API reference exposes TFV endpoints to:
  - submit a verification request,
  - list verification requests,
  - retrieve a verification request,
  - update/resubmit a verification request after issues are fixed.
- **Fact:** Telnyx API reference also exposes status-history retrieval for verification requests.
- **Fact:** Telnyx documents TFV webhook events that include verification status, affected phone numbers, and reasons.
- **Fact:** Telnyx docs explicitly say there is **no limit on resubmissions** after fixing issues.
- **Fact:** Troubleshooting docs show patch/update flows for correcting existing requests.
- **Conclusion (fact-backed):** TFV is **API-capable**, not portal-only.
- **Unknown:** The docs do not prove that every possible rejection can always be resolved without any human support interaction. But official submit/status/update/resubmit capabilities exist in API.

### 3. Does "number attached to messaging profile" mean the sender is delivery-ready?

- **Fact:** Telnyx Messaging Profiles docs describe a messaging profile as a **configuration object** for webhook URLs, number pooling, sticky sender / geomatch behavior, spend limits, and related messaging settings.
- **Fact:** Telnyx docs say a number used for messaging must be assigned to a messaging profile and have messaging enabled.
- **Fact:** Telnyx separately requires **regulatory compliance** for toll-free numbers, and specifically calls out toll-free verification.
- **Fact:** Telnyx error docs separate configuration failures from compliance failures:
  - `40305` = sending number not associated with a messaging profile
  - `40329` = toll-free not verified
  - `40330` = toll-free not provisioned
- **Inference:** "Attached to messaging profile" proves only that the number is configured to participate in Telnyx messaging. It does **not** prove carrier-approved outbound readiness.
- **Unknown:** Some official pages still describe limited/unverified/pending throughput states, so transitional behavior exists in docs. But those pages do not prove a reliable launch-ready posture without TFV approval.

### 4. What is Telnyx's official position on customer-care / appointment reminder traffic over US toll-free numbers?

- **Fact:** Telnyx Help Center "Toll-Free Messaging" lists `Customer Care` among valid toll-free use cases.
- **Fact:** Telnyx TFV Guide and API enums list use-case options including:
  - `Appointments`
  - `Booking Confirmations`
  - `App Notifications`
  - `Waitlist Alerts`
  - `Webinar Reminders`
  - `Mixed`
- **Fact:** Telnyx sender-type guidance describes toll-free as "ideal for US/CA transactional messaging."
- **Fact:** Telnyx best-practice guidance requires a clear CTA / opt-in that tells the user:
  - the product/program description,
  - the originating number(s) or shortcode(s),
  - the identity of the organization represented,
  - opt-in language and charges,
  - opt-out instructions,
  - customer-care contact information,
  - privacy policy / terms.
- **Fact:** Telnyx's TFV / CTA guidance expects:
  - brand-consistent opt-in,
  - STOP and HELP disclosures,
  - message frequency disclosure,
  - rates disclosure,
  - privacy-policy and terms links,
  - optional unchecked SMS consent,
  - SMS consent separated from email / other consents,
  - matching business identity between site, CTA, and verification request.
- **Fact:** Telnyx guidance also notes privacy-policy wording expectations around not sharing or selling mobile information for promotional or marketing purposes.
- **Inference:** Telnyx officially allows appointment-reminder / customer-care traffic on toll-free, but only as a verified, consent-backed, brand-consistent use case. The issue is not whether the category is allowed; it is whether each workspace sender has completed the required verification and compliance path.
- **Unknown:** Official sources do not publish one single "appointment reminder policy" page covering every allowed reminder variant. Reminder content still has to fit the general permitted-use + compliant-opt-in framework.

### 5. What exact signals should count as "launch-ready" for reminder SMS?

#### Portal / verification state

- **Fact:** The only clearly positive TFV state across official sources is `Verified`.
- **Fact:** Official non-ready / not-yet-approved states shown across Telnyx sources include:
  - `Waiting For Telnyx`
  - `Waiting For Customer`
  - `Waiting For Vendor`
  - `Rejected`
  - `In Progress`
  - simpler troubleshooting labels like `draft` / `pending`
- **Fact:** Telnyx warns that submitting a new verification request for an already approved toll-free number can overwrite the previous approved state and temporarily make the number unverified again until the new request is approved.
- **Inference:** Because Telnyx wording varies by surface, the team should treat **only `Verified`** as clearly launch-ready. Anything else should be treated as not ready.

#### Configuration state

- **Fact:** Number must be assigned to a messaging profile and have messaging enabled.
- **Fact:** Messaging profiles can also block sending if they are misconfigured, for example:
  - missing destination whitelist (`40331`)
  - disabled profile (`40312`)
  - spend limit reached (`40333`)

#### Sending restrictions / blocking caveats

- **Fact:** Unverified toll-free traffic may be blocked; `40329` explicitly means "Toll-free not verified."
- **Fact:** `40330` means toll-free not fully provisioned for messaging.
- **Fact:** `40305` means the sender is not associated with the required messaging profile.
- **Fact:** Telnyx warns that even after verification, some carriers may still filter toll-free traffic, especially:
  - new verifications,
  - spam-like content,
  - high complaint rates.
- **Fact:** Telnyx troubleshooting guidance says to start lower and ramp up gradually over 1-2 weeks for newly verified toll-free traffic.
- **Fact:** Telnyx Help Center also says senders should avoid sending more than **10 messages to a recipient in any 24-hour period** unless the recipient is in two-way communication or has explicitly opted in to higher-frequency messaging.

#### Throughput

- **Fact:** Telnyx documents rate limits / queueing behavior and rate-limit errors such as `40011` and queue expiry `40014`.
- **Fact:** Telnyx publishes conflicting throughput language across surfaces:
  - generic rate-limiting guidance uses around `20 MPS` per toll-free number,
  - troubleshooting pages describe lower reliability / filtering for unverified and pending states,
  - some support pages describe higher account-level toll-free send-rate capabilities once account verification tiers are unlocked.
- **Inference:** For Vurium reminder traffic, raw throughput is probably not the blocker. Verification state, deliverability, and compliance are the gating issues.
- **Inference:** For launch gating, the safer read is not "we can do high throughput," but "we must first reach `Verified` and then ramp carefully."

#### STOP / HELP expectations

- **Fact:** Telnyx toll-free STOP handling has carrier-level behavior. Telnyx says:
  - the toll-free carrier/network sends its own `NETWORK MSG` response for `STOP`,
  - the carrier block applies independently,
  - the carrier `UNSTOP`/`START` response also exists,
  - these network responses cannot be prevented.
- **Fact:** Telnyx general opt-out system applies block rules at the **messaging profile** level by default, so opt-out scope depends on how numbers are grouped into profiles.
- **Fact:** Telnyx docs support `help` autoresponses on messaging profiles, and TFV request fields include `helpMessageResponse`.
- **Inference:** For launch-ready sign-off, STOP must be verified by live test on a real toll-free sender, and HELP must also be live-tested rather than assumed from profile attachment.
- **Important product implication (inference):** If multiple workspace numbers ever share one messaging profile, STOP scope may bleed across the profile. A dedicated profile per workspace is operationally safer for opt-out isolation.
- **Unknown:** Official Telnyx materials are not perfectly consistent on toll-free keyword behavior beyond `STOP` / `START` / `UNSTOP`. One toll-free-specific article emphasizes carrier-level `STOP`, while broader opt-out docs list additional Telnyx-level keywords. The exact combined behavior for `UNSUBSCRIBE`, `CANCEL`, `END`, etc. on toll-free remains insufficiently specified in one authoritative source.

#### Sample compliance wording expectations

- **Fact:** Telnyx TFV Guide gives the required disclaimer structure before the first message:
  - brand name,
  - use case,
  - `Reply STOP to opt out`,
  - `Reply HELP for help`,
  - message/data rates disclosure,
  - message frequency may vary,
  - Terms link,
  - Privacy Policy link.
- **Fact:** Telnyx says:
  - the opt-in form must be branded with the same brand being registered,
  - SMS checkbox must be optional and unchecked by default,
  - SMS consent must be separate from email/other consents,
  - if marketing is also selected, it must have a separate compliant marketing checkbox.
- **Fact:** Sample messages and use-case summary must match the opt-in flow and actual traffic.
- **Inference:** For appointment reminders, a compliant transactional checkbox and reminder wording should explicitly name the business/workspace, mention appointment-related SMS, and include STOP/HELP/rates/frequency/terms/privacy disclosures somewhere before first message.

### 6. If Telnyx docs, support articles, and portal wording differ, what should be treated as final source of truth?

- **Fact:** Telnyx's own materials are not perfectly uniform:
  - support / TFV guides use `Waiting For Telnyx`, `Waiting For Vendor`, etc.
  - API schema also includes `In Progress`
  - troubleshooting docs sometimes collapse states into `draft` / `pending` / `verified` / `rejected`
  - throughput language differs across pages
  - some example endpoint paths in troubleshooting pages differ from canonical API-reference pages
- **Inference:** The team should use this hierarchy:
  1. **Live TFV object state in Telnyx Portal or TFV API for the exact number** = operational source of truth
  2. **API reference + messaging error docs** = enforceable runtime / contract truth
  3. **Help Center TFV / toll-free compliance guides** = policy / review-truth for CTA, opt-in, and submission expectations
  4. **Generic comparison or marketing-style docs** = background only
- **Inference:** When official sources conflict, the safer launch interpretation is the stricter one:
  - if one source says unverified numbers may be filtered and another says unverified numbers may be blocked,
  - treat unverified as **not launch-ready**.
- **Inference:** For go-live, the final gate should be "actual TFV request for this number is approved / `Verified` and real sends succeed without TFV/provisioning/compliance errors," not "backend field says active."

### Source notes and conflicts

#### A. Can toll-free send before verification?

- **Fact:** Help Center guidance says toll-free must be verified before first outbound sending, and separately says unverified toll-free attempts are blocked under current policy.
- **Fact:** Other official pages still describe lower-throughput or filtered states for `unverified` or `pending` toll-free traffic.
- **Inference:** For launch-readiness, the safest conclusion is still: treat toll-free verification as required and treat anything short of `Verified` as non-ready.

#### B. Business registration fields timing mismatch

- **Fact:** Different official Telnyx pages describe slightly different effective dates for when BRN fields became mandatory for TFV submissions.
- **Inference:** As of `2026-04-15`, both versions imply those fields are mandatory now, so this date mismatch should not change planning.

#### C. STOP keyword scope mismatch

- **Fact:** One toll-free-specific Help Center article emphasizes carrier-level `STOP` / `UNSTOP` handling and fixed network messages.
- **Fact:** Broader Telnyx opt-out docs list more default keywords and also describe profile-level Telnyx block rules.
- **Inference:** The most defensible reading is:
  - carrier-level toll-free STOP behavior definitely exists and cannot be suppressed,
  - Telnyx profile-level opt-out behavior also exists,
  - the exact combined keyword matrix for toll-free beyond `STOP` / `START` / `UNSTOP` is still not perfectly specified in one place.

#### D. Endpoint naming mismatch

- **Fact:** Canonical API-reference pages use `/messaging_tollfree/verification/requests`.
- **Fact:** Some troubleshooting pages show alternate endpoint spellings in examples.
- **Inference:** Use the API-reference pages as canonical when building or reviewing implementation.

## Sources

- Telnyx Help Center — Toll Free Verification Request Guide  
  https://support.telnyx.com/en/articles/10729979-toll-free-verification-request-guide
- Telnyx Help Center — Toll-Free Messaging  
  https://support.telnyx.com/en/articles/5353868-toll-free-messaging
- Telnyx Help Center — How to Pick a Toll Free Use Case  
  https://support.telnyx.com/en/articles/12650709-how-to-pick-a-toll-free-use-case
- Telnyx Help Center — Toll Free Opt in Workflow Description  
  https://support.telnyx.com/en/articles/11898569-toll-free-opt-in-workflow-description
- Telnyx Help Center — Setting Up a Messaging Profile  
  https://support.telnyx.com/en/articles/3562059-setting-up-a-messaging-profile
- Telnyx Help Center — Toll-Free Opt-Out Words  
  https://support.telnyx.com/en/articles/6989758-toll-free-opt-out-words
- Telnyx Help Center — Throughput Limit for Outbound Long Code SMS  
  https://support.telnyx.com/en/articles/96934-throughput-limit-for-outbound-long-code-sms
- Telnyx Developer Docs — Phone Number Messaging Configuration  
  https://developers.telnyx.com/docs/messaging/messages/phone-number-configuration
- Telnyx Developer Docs — Messaging Profiles Overview  
  https://developers.telnyx.com/docs/messaging/messages/messaging-profiles-overview
- Telnyx Developer Docs — Choosing Your Sender Type  
  https://developers.telnyx.com/docs/messaging/getting-started/choosing-your-sender-type
- Telnyx Developer Docs — Advanced Opt-In/Out Management  
  https://developers.telnyx.com/docs/messaging/messages/advanced-opt-in-out
- Telnyx Developer Docs — Messaging Error Code Reference  
  https://developers.telnyx.com/docs/messaging/messages/error-codes
- Telnyx API Reference — Submit Verification Request  
  https://developers.telnyx.com/api-reference/verification-requests/submit-verification-request
- Telnyx API Reference — Get Verification Request  
  https://developers.telnyx.com/api-reference/verification-requests/get-verification-request
- Telnyx Developer Docs — Toll-Free Verification with Business Registration Fields  
  https://developers.telnyx.com/docs/messaging/toll-free-verification
- Telnyx Developer Docs — Toll-Free Verification Troubleshooting  
  https://developers.telnyx.com/docs/messaging/toll-free-verification/troubleshooting/index

## Hand-off to AI 3 planner

### What is now proven

- Telnyx official materials do **not** support the idea that "number purchased + attached to messaging profile" alone means a toll-free sender is truly live for outbound reminders.
- Telnyx official materials do support that toll-free reminder/customer-care traffic is an allowed category, including appointments and booking confirmations.
- TFV can be done through API; it is not portal-only.
- `Verified` is the only clearly positive TFV state across sources. Anything else should be treated as non-ready.
- Runtime failures already have exact official indicators:
  - `40329` = not verified
  - `40330` = not provisioned
  - `40305` = not associated with profile
  - `40331` = whitelist missing
  - `40333` = spend limit reached
- Official Telnyx sources also confirm:
  - toll-free STOP includes a carrier/network-controlled response path,
  - HELP can be configured in Telnyx/profile/TFV artifacts,
  - newly verified traffic may still need gradual ramp-up.

### What still needs manual verification in Telnyx Portal

- Whether each fresh workspace toll-free sender currently has an actual TFV request at all
- For each sender, what the real TFV status is in Portal/API
- Whether the current Mission Control portal shows any pending / waiting / rejected compliance state contradicting backend `active`
- Whether messaging profiles are isolated per workspace or shared in a way that could widen STOP scope
- Whether destination whitelist / spend limit / webhook settings introduce any hidden delivery blockers
- Whether the CTA / consent artifacts used for each workspace actually match what that workspace would need in TFV review

### Smallest correct next step for the team

- AI 1 / Owner should inspect **one fresh workspace toll-free number** in Telnyx Portal or via TFV API and answer one binary question first:
  - does this exact number already have a TFV request, and is it `Verified`?
- If the answer is **no**, the safest next planning assumption is:
  - reminder SMS is **not yet launch-ready as SMS-first**,
  - current posture should remain **email-only fallback** until TFV + live send proof exist.
