# SMS & 10DLC

> Part of [[Home]] > Features | See also: [[Booking System]], [[Onboarding Wizard]]

## Overview

VuriumBook uses Telnyx for US A2P SMS messaging via 10DLC (10-digit long code) registration. Two SMS programs operate under the **Vurium Inc.** brand (TCR ID: BCFAC3G, Verified):

- **Program A — Appointment Notifications** (CUSTOMER_CARE campaign)
- **Program B — Account Verification** (2FA campaign)

## Architecture

### Platform-as-sender model

VuriumBook operates as a **platform-as-sender** — similar to how Booksy, Vagaro, and Square Appointments handle SMS. The platform (VuriumBook) is the registered Brand and perceived Message Sender, not individual businesses.

- **Brand on Telnyx/TCR**: companyName = `Vurium Inc.`, displayName = `VuriumBook`
- **Messages always start with**: `VuriumBook:`
- **Business name is contextual**: "Your appointment **with** [Business Name]"
- **Not**: "**From** [Business Name]" — this would trigger reseller/KYC rejection (code 710)

### Why platform-as-sender

- Instant SMS activation for new businesses (no per-business carrier registration)
- Pre-approved campaign + number pool = messages work from day one
- Telnyx documents this as "Pattern 2: Shared campaign across customers"
- TCR defines Brand as "the company or entity the End Customer believes to be sending the message"

### Limitations

- **T-Mobile**: max 49 numbers per campaign (need special approval for more)
- **Shared blast radius**: one business's violations can affect all tenants
- **Throughput shared** across all numbers on the campaign
- **STOP is profile-level**: if consumer opts out from one number, opted out from all numbers on that messaging profile

## Campaigns

### Campaign 1 — 2FA (VuriumBook Account Verification)

| Field | Value |
|---|---|
| Use case | 2FA |
| TCR Campaign ID | *(pending)* |
| Status | Submitted, pending review |
| Sender in messages | `VuriumBook:` |
| Recipients | Business owners (signup, login, password reset) |

**Sample messages:**
```
VuriumBook: Your verification code is 482193. Expires in 10 minutes. If you didn't request this, ignore this message. Reply STOP to opt out.

VuriumBook: Your login code is 937104. Don't share this code with anyone. Reply STOP to opt out.

VuriumBook: Security code 615029. Enter this code to reset your password. Expires in 5 minutes. Reply STOP to opt out.
```

### Campaign 2 — CUSTOMER_CARE (VuriumBook Appointment Notifications)

| Field | Value |
|---|---|
| Use case | Customer Care |
| TCR Campaign ID | CKAOXOW |
| Status | **Failed MNO Review — code 710** |
| Failure reason | "Reseller / Non-compliant KYC. Register the brand info, not the agency behind the brand." |
| Sender in messages | `VuriumBook:` |
| Recipients | Consumers who book with businesses on VuriumBook |

**Sample messages:**
```
VuriumBook: Your appointment with Element Barbershop is confirmed for Apr 12 at 2:00 PM. Location: 1142 W Lake Cook Rd. Reply STOP to opt out.

VuriumBook: Reminder - your appointment with North Shore Salon is tomorrow at 11:00 AM. Reply STOP to opt out.

VuriumBook: Reminder - your appointment with Fade District Barbers is in 2 hours at 4:30 PM. Reply STOP to opt out.

VuriumBook: Your appointment with Element Barbershop on Apr 12 at 2:00 PM has been canceled. To manage your booking, visit vurium.com. Reply STOP to opt out.

VuriumBook: Your appointment with North Shore Salon has been rescheduled to Apr 14 at 1:30 PM. Reply STOP to opt out.
```

**710 rejection analysis**: Carrier saw different business names in samples and concluded VuriumBook is an agency/reseller, not the real sender. Awaiting guidance from Telnyx support (Jonathan) on whether to resubmit with adjusted wording or switch to per-business brands.

## Compliance Requirements

### Privacy Policy (vurium.com/privacy#sms)

Must contain for each SMS program:
- Program Name + Message Sender identity
- Message types (no marketing)
- Frequency disclosure
- "Msg & data rates may apply"
- STOP opt-out instructions
- HELP instructions + customer care contact
- "Consent is not a condition of purchase"
- "SMS consent is separate from email"
- **Strong no-sharing clause**: "All categories of data sharing exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties except service providers solely to deliver messaging."

The no-sharing clause must also appear in the **general Sharing section** (Section 5) — not just inside SMS subsections.

### Terms of Service (vurium.com/terms#sms)

Must contain:
- Program name
- Product description
- Frequency disclosure
- Customer care contact
- Opt-out instructions
- "Msg & data rates may apply"
- Message types

**Critical**: Never use "on behalf of [Business]" — use "about your appointment with [Business]" instead. "On behalf of" triggers 710 rejection.

### Booking Page CTA (vurium.com/book/[workspace])

Checkbox (unchecked by default, optional):
```
☐ I agree to receive VuriumBook Appointment Notifications via SMS 
about my booking (confirmations, reminders, reschedules, and 
cancellations). Message frequency may vary (up to 5 messages per 
booking). Standard message and data rates may apply. Reply STOP to 
opt out. Reply HELP for help. Consent is not a condition of purchase. 
Messages may be sent from different VuriumBook local phone numbers. 
Terms: https://vurium.com/terms  Privacy: https://vurium.com/privacy
```

Requirements:
- Phone number field can be required for booking, but SMS checkbox must be **optional**
- Checkbox **unchecked** by default
- SMS consent **separate** from email consent
- Terms/Privacy as **links** (not popups)

### Consent Records (per opt-in)

Store for each consumer SMS opt-in:
- `phone_number`
- `workspace_id`
- `booking_id`
- `consent_text_version`
- `checkbox_checked` (boolean)
- `timestamp` (ISO 8601)
- `ip_address`
- `user_agent`
- `booking_page_url`
- `campaign_id`
- `consent_method` (web_checkbox, keyword, verbal)
- `opt_out_status` + `opt_out_timestamp`

### Keywords & Auto-responses

| Type | Keywords | Response |
|---|---|---|
| Opt-in | START, YES | `VuriumBook: You're subscribed to [program]. Msg frequency varies. Msg & data rates may apply. Reply HELP for help. Reply STOP to opt out.` |
| Opt-out | STOP, CANCEL, UNSUBSCRIBE, END, QUIT | `VuriumBook: You are unsubscribed and will receive no further messages.` |
| Help | HELP, INFO | `VuriumBook: [Program description]. For help, contact support@vurium.com or call (847) 630-1884. Reply STOP to opt out.` |

## Carrier Rejection Codes Reference

| Code | Reason | How to avoid |
|---|---|---|
| 710 | Reseller / Non-compliant KYC | VuriumBook must be sender everywhere, never "on behalf of" |
| 803 | Opt-in language required | Every phone field needs opt-in language + optional checkbox |
| 804 | Unable to verify website/CTA | Terms/Privacy must be public, booking page accessible |
| 805 | Privacy policy non-compliant | Must include no-sharing clause for SMS opt-in data |
| 806 | CTA incomplete | Must have: brand, frequency, rates, STOP, HELP, Terms/Privacy links |
| 611 | Opt-in message requirements | Opt-in confirmation must include program name, frequency, HELP, STOP |

## Telnyx Account

| Item | Value |
|---|---|
| Brand name | Vurium |
| Brand ID | 4b20019d-7837-173f-8055-44b9fffbc815 |
| TCR ID | BCFAC3G |
| Status | Verified |
| Entity type | PRIVATE_PROFIT |
| EIN | 99-3664614 |
| Legal entity | Vurium Inc. |
| displayName | VuriumBook (needs confirmation) |
| Support contact | Jonathan (Telnyx) |
| Support email | 10dlcquestions@telnyx.com |

## Fees

| Item | Cost |
|---|---|
| Brand registration | $4.50 (one-time) |
| Campaign review | $15 per submission/resubmission |
| Monthly campaign (standard) | $10/month per campaign |
| Monthly campaign (low volume mixed) | $1.50/month |
| Per-message carrier fees | $0.003-$0.01 depending on carrier |

## Future: Per-business upgrade path

When a business wants dedicated sender identity:
1. Register Sole Proprietor brand (name, DOB, address, mobile OTP)
2. Create CUSTOMER_CARE campaign under their brand
3. Buy/assign dedicated local number
4. Migrate workspace from shared to dedicated
5. **Re-collect consent** — CTIA says opt-in is not transferable across Message Senders

## Key Documents (docs/Telnyx/)

- `CP_575_A.pdf` — IRS EIN assignment notice
- `CorpArt.pdf` / `Corporation Articles of Incorporation.pdf` — Illinois incorporation
- `Platform-level CUSTOMER_CARE 10DLC on Telnyx for a Multi-tenant Booking SaaS.pdf` — GPT research on platform-as-sender model
- `Carrier-review readiness audit...pdf` — Policy compliance audit
