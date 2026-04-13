# SMS & 10DLC

> Part of [[Home]] > Features | See also: [[Booking System]], [[Onboarding Wizard]]

## Overview

VuriumBook uses Telnyx for US A2P SMS messaging. Two messaging systems:

- **Appointment Reminders** → Per-business 10DLC (Sole Proprietor or Standard brand per business)
- **Account Verification (2FA)** → Telnyx Verify API (bypasses 10DLC entirely)

## Architecture Decision (April 2026)

### Platform-as-sender was rejected ❌

We initially tried a platform-as-sender model (one VuriumBook brand + one CUSTOMER_CARE campaign for all businesses). **Rejected with code 710** ("Reseller / Non-compliant KYC").

**Why it failed**: Carrier saw different business names in sample messages and concluded VuriumBook is an agency/reseller, not the real sender. Telnyx ISV guidance confirms: "unless your business is a franchise, [single brand across end-users] is unlikely to be approved" and can lead to fines/blocking.

**Lesson**: For independent businesses (not franchise), each business must be registered as its own Brand.

### Current architecture: Per-business 10DLC + Telnyx Verify ✅

```
┌─────────────────────────────────────────────────┐
│  2FA / Login Codes                              │
│  → Telnyx Verify API ($0.03/verification)       │
│  → No 10DLC registration needed                 │
│  → Works immediately                            │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Appointment Reminders (per business)           │
│  → Sole Proprietor brand (no EIN needed)        │
│  → SP campaign auto-approves after OTP          │
│  → 1 dedicated local number per business        │
│  → 1 messaging profile per business             │
│  → Messages say: "[Business]: Your appt..."     │
│  → ~2-10 min from signup to SMS live            │
└─────────────────────────────────────────────────┘
```

### What competitors use

| Platform | Sender type | Evidence |
|---|---|---|
| Vagaro | Short code (89885) | Support docs say to unblock 89885 |
| Square | Toll-free | Help center: "sent from a toll free number" |
| Booksy | Long code (10DLC) | Support: text START to 618-228-1860 |

### Cost per business (Sole Proprietor path)

| Item | Cost |
|---|---|
| Brand registration | $4.50 one-time |
| Campaign review | $15 one-time (first submission) |
| SP campaign monthly | $2/month |
| Local number + SMS | $1.10/month |
| **Total per business** | **$3.10/month** + $19.50 one-time |
| **50 businesses** | **$155/month** + $975 one-time |

## Telnyx Verify API (2FA / Login Codes)

**Replaces the 10DLC 2FA campaign** — no brand/campaign registration needed.

### Endpoints
```
POST /v2/verify_profiles                              → Create verify profile
POST /v2/verifications/sms                            → Send OTP code
POST /v2/verifications/by_phone_number/{phone}/actions/verify → Verify code
```

### Pricing
- $0.03 per successful verification + underlying SMS cost (~$0.004)
- No monthly fees, no registration fees

### Features
- Alphanumeric sender ID (one-way, no STOP needed for OTP)
- Fallback: SMS → Voice → Flashcall
- No 10DLC brand/campaign needed

### Status
- **Not yet implemented** — next priority
- Will replace the pending 10DLC 2FA campaign

## 10DLC Campaigns

### Platform-level 2FA campaign (deprecated)

| Field | Value |
|---|---|
| Use case | 2FA |
| Status | Submitted, pending review — **will be abandoned** in favor of Telnyx Verify |
| Sender in messages | `VuriumBook:` |

### Platform-level CUSTOMER_CARE campaign (rejected)

| Field | Value |
|---|---|
| Campaign ID | 4b30019d-82b4-a6c9-5103-391ec94f27aa |
| TCR Campaign ID | CKAOXOW |
| Status | **Failed MNO Review — code 710** |
| Failure reason | "Reseller / Non-compliant KYC" |

**Will not be resubmitted.** Switched to per-business brand architecture.

### Per-business campaign: Element Barbershop (first customer)

| Field | Value |
|---|---|
| Campaign ID | 4b30019d-826e-61b2-0eb0-915fdcaf1749 |
| TCR Campaign ID | CICHCOJ |
| Brand | Element Barbershop |
| Use case | Low Volume Mixed |
| Status | **Pending MNO Review** (submitted Apr 12, 2026) |
| Sender in messages | `Element Barbershop:` |
| Booking page | https://vurium.com/book/elementbarbershop |

This is the correct per-business architecture — each business gets its own brand + campaign. No 710 risk because the sender matches the registered brand.

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

**710 rejection deep analysis** (from GPT research with extended search):

**Why rejected**: Carrier saw different business names (Element Barbershop, North Shore Salon, Fade District Barbers) in samples and concluded VuriumBook is an "agency" sending on behalf of separate brands. Code 710 means: "The brand sending the messages must be the one registered, not the agency behind it." This is the "software company vs doctor's office" pattern — the carrier wants the actual business registered as the brand, not the SaaS platform.

**Three resolution paths:**

**Path A — Resubmit single-brand with adjusted wording**
- Remove real business names from samples → use placeholders like `[SERVICE_PROVIDER]`
- Rewrite description to position VuriumBook as the primary sender, business name as "contextual info"
- Strengthen opt-in flow to say "messages from VuriumBook" explicitly
- Risk: may still be rejected if carrier fundamentally interprets this as multi-brand traffic
- Cost: $15 resubmission fee

**Path B — Per-business brand registration (carrier-preferred)**
- Register each barbershop/salon as its own Brand on TCR
- Create CUSTOMER_CARE campaign per business
- Standard brand: needs EIN + legal name matching IRS records
- Sole Proprietor brand: for businesses without EIN (name, DOB, address, mobile OTP)
- SP campaigns auto-approve after OTP verification
- This is what Telnyx ISV guidance explicitly recommends
- Eliminates 710 risk entirely

**Path C — Hybrid (Telnyx "recommended for growth")**
- Platform-level campaign for instant activation (if resubmission succeeds)
- Per-business brands as upgrade path for larger customers
- CTIA says opt-in is NOT transferable across Message Senders — re-consent needed on migration

**Decision (April 13, 2026)**: Do NOT resubmit. Switch to per-business brand registration (Path B). Use Telnyx Verify for 2FA codes.

**Key insight from research**: Telnyx ISV docs say "unless your business is a franchise, [single brand for multiple end-users] is unlikely to be approved." Resubmission with placeholders risks $15 and may fail again — or if approved, production content mismatch could trigger blocking later.

**2FA decision**: Switch to Telnyx Verify API — bypasses 10DLC entirely, works immediately, $0.03/verification. No brand/campaign registration needed for OTP traffic.

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
| 710 | Reseller / Non-compliant KYC | Each business must be its own Brand — platform can't register as sender for multiple independent businesses |
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

## Per-business brand registration (if Path B chosen)

### Standard brand (business has EIN)
1. Collect: legal company name, EIN (XX-XXXXXXX format), address, phone, email, website
2. `POST /v2/10dlc/brand` with entityType=PRIVATE_PROFIT
3. Wait for verification (1-7 business days, EIN must match IRS records)
4. Create CUSTOMER_CARE campaign under that brand
5. Buy/assign local number → link to campaign
6. Messages say: "[Business Name]: Your appointment is confirmed..."

### Sole Proprietor brand (no EIN)
1. Collect: legal first/last name, DOB, residential address, mobile phone (US/CA)
2. `POST /v2/10dlc/brand` with entityType=SOLE_PROPRIETOR
3. Trigger OTP: `POST /v2/10dlc/brand/{brand_id}/smsOtp`
4. Verify OTP: `POST /v2/10dlc/brand/{brand_id}/smsOtp/verify`
5. Create campaign: `POST /v2/10dlc/campaignBuilder` with usecase=SOLE_PROPRIETOR
6. SP campaigns **auto-approve immediately** after OTP
7. Assign number: `POST /v2/10dlc/phone_number_campaigns`
8. **Timeline: signup → SMS in ~2-10 minutes** (happy path)

### SP limitations
- 1 campaign per brand
- 1 phone number per campaign
- Max 3 SP brands per mobile phone number (for OTP verification)
- T-Mobile: 1,000 daily SMS cap
- AT&T: 15 TPM SMS / 50 TPM MMS
- Cannot reuse same phone/email/address across multiple SP brands
- Each business needs its own messaging profile (opt-out isolation)

### SP campaign approval timeline
- SP campaigns "typically auto-approved and becomes ACTIVE immediately"
- Standard campaigns: T-Mobile instant-24hr, AT&T 1-3 days, Verizon 1-3 days, US Cellular 3-5 days

### Number costs
- Local number: $1/month + $0.10/month SMS add-on = $1.10/month
- Toll-free: $1/month + $0.10/month SMS add-on = $1.10/month
- Short code: $1,000/month (vanity: $2,000/month)
- Per-message: ~$0.004 (10DLC), ~$0.0055 (toll-free)

### Number recycling on churn
- Remove number from campaign → hold period (only you can re-buy) → aging → released
- Opt-outs persist at messaging profile level — inherited by new tenant if reused
- Best practice: quarantine period, don't recycle immediately

### Per-business onboarding data to collect
For signup (minimal):
- Business display name, owner name, email, mobile, address, timezone

For SMS upgrade (in Settings):
- Legal first/last name, DOB, residential address
- Mobile for OTP, business DBA, website/booking URL
- EIN (if available) — determines Standard vs SP path

### Migration from shared to dedicated
1. Register business brand + campaign
2. Buy/assign new dedicated number
3. **Re-collect consumer consent** — CTIA says opt-in is NOT transferable
4. Update workspace SMS mode: `shared_10dlc` → `dedicated_sp_10dlc` or `dedicated_standard_10dlc`
5. Reassign workspace to new number
6. Old shared number returns to pool

## Implementation Plan — AI 1 + AI 2 parallel

### Implementation status (April 13, 2026)

| Component | Status | Location |
|---|---|---|
| `sendSms()` with Telnyx API v2 | ✅ Working | `backend/index.js:433-471` |
| Auto-provision TFN on signup | ❌ **Removed** — SMS via Settings now | `backend/index.js:3274` (comment only) |
| Telnyx Verify API (2FA OTP) | ✅ **NEW** — bypasses 10DLC | `backend/index.js` POST `/public/verify/send/:wsId` + `/public/verify/check/:wsId` |
| SP brand registration | ✅ Working | POST `/api/sms/register` (entityType=SOLE_PROPRIETOR) |
| SP OTP verification | ✅ Working | POST `/api/sms/verify-otp` → auto-creates campaign + buys number |
| Toll-free enable (Individual plan) | ✅ Working | POST `/api/sms/enable-tollfree` |
| SMS status check | ✅ Working | GET `/api/sms/status` |
| Per-workspace SMS config fields | ✅ Working | `sms_from_number`, `sms_messaging_profile_id`, `sms_registration_status` |
| 10DLC webhook handler | ✅ Working | `backend/index.js:1627-1665` |
| Inbound STOP/HELP handler | ✅ Working | `backend/index.js:1562-1622` |
| SMS consent checkbox on booking page | ✅ Working (AI 2: update CTA text) | `app/book/[id]/page.tsx:1584-1597` |
| SMS registration UI in Settings | ✅ Working (AI 2: update for SP wizard) | `app/settings/page.tsx:115-200` |
| Phone verification OTP for bookings | ✅ Working | `backend/index.js:8603-8669` |
| Reminder scheduling (24h + 2h) | ✅ Compliant format | `backend/index.js:636-659` — business name prefix + STOP |
| SMS logging to `sms_logs` | ✅ Working | `backend/index.js:444-452` |

### `TELNYX_VERIFY_PROFILE_ID` status

- Backend support: `DONE`
- Public OTP routes: `DONE` at `POST /public/verify/send/:wsId` + `POST /public/verify/check/:wsId`
- Cloud Run deploy wiring: `DONE` via `.github/workflows/deploy-backend.yml`
- Still needed: create one Telnyx Verify Profile and save the returned ID as the GitHub secret `TELNYX_VERIFY_PROFILE_ID`

Without that secret, the backend safely falls back to the legacy local-code verification flow.

### HOW TO CREATE TELNYX VERIFY PROFILE (for deploying AI)

Telnyx Verify Profile cannot be created from portal UI — only via API.

**Option A — Create via backend startup code (recommended):**
Add a one-time init that creates the profile using the existing `telnyxApi()` helper:
```javascript
const result = await telnyxApi('POST', '/v2/verify_profiles', {
  name: 'VuriumBook OTP',
  sms_enabled: true,
  default_timeout_secs: 300,
});
const verifyProfileId = result?.data?.id;
// Save to vurium_config collection or log it to set as env var
```
This works because `telnyxApi()` uses `TELNYX_API_KEY` from env which is already set on Cloud Run.

**Option B — Ask Telnyx support (Jonathan):**
"Can you create a Verify Profile named 'VuriumBook OTP' on my account and send me the profile ID?"

**After getting the ID:** Add to Cloud Run env vars + GitHub secrets:
```
TELNYX_VERIFY_PROFILE_ID=<the-id-from-response>
```

---

### AI 1 — Backend (`backend/index.js` + `docs/`) — RESTORED

#### Task 1.1: Telnyx Verify API for login/signup OTP — ✅ RESTORED

**New env var:** `TELNYX_VERIFY_PROFILE_ID`

**Public signup/booking verify routes now stay stable while the provider can switch underneath them:**
```javascript
const TELNYX_VERIFY_PROFILE_ID = process.env.TELNYX_VERIFY_PROFILE_ID || '';

// POST /public/verify/send/:workspace_id — Send OTP via Telnyx Verify API
// - Accept { phone }, rate limit 3 per phone per 10 min via rate_limits collection
// - Call telnyxApi('POST', '/v2/verifications/sms', { phone_number, verify_profile_id, type: 'sms' })
// - If TELNYX_VERIFY_PROFILE_ID is not set yet, fall back to the legacy local-code flow

// POST /public/verify/check/:workspace_id — Verify OTP code
// - Accept { phone, code }
// - Call telnyxApi('POST', `/v2/verifications/by_phone_number/${phone}/actions/verify`, { code, verify_profile_id })
// - Return { ok: true, verified: true/false }
// - Invalid/expired Telnyx codes return 400; provider failures return 502
```

#### Task 1.2: Fix SP brand registration — ✅ DONE

Existing endpoints at `/api/sms/register` and `/api/sms/verify-otp` need these fixes:
- `messageFlow`: change from `'WEBFORM'` to descriptive opt-in narrative string
- `optoutKeywords`: add `CANCEL,END,QUIT` (was only `STOP,UNSUBSCRIBE`)
- `optinMessage`: add "Consent is not a condition of purchase"
- In `/api/sms/verify-otp`: change `sms_registration_status: 'pending_approval'` → `'active'` (SP auto-approves)

#### Task 1.3: Disable auto-TFN on signup — ✅ DONE

In `/auth/signup` (around line 3274-3332), replace the auto-TFN provisioning block with:
```javascript
// SMS activation moved to Settings → SP 10DLC registration (per-business brand/campaign).
// Auto-TFN removed: carriers require per-business 10DLC registration for appointment SMS.
```

#### Task 1.4: Message formats — ✅ ALREADY COMPLIANT (no changes needed)

Already uses `{shopName}: ` prefix + STOP/HELP language in all SMS.

---

### AI 2 — Frontend (`app/settings/`, `app/book/`, `components/`) — PENDING

#### Task 2.1: Settings — SP Registration wizard

Update `app/settings/page.tsx` SMS section.

**UI states:**

| `sms_registration_status` | What to show |
|---|---|
| `not_registered` | "Enable SMS Reminders" button → opens form |
| `pending_otp` | OTP input + verify button |
| `otp_sent` | OTP input + verify button + "Code sent to your mobile" |
| `brand_verified` | "Setting up campaign..." (auto, call create-campaign + assign-number) |
| `campaign_active` | "Assigning number..." (auto) |
| `active` | ✅ "SMS Active" + assigned number + test button + logs |
| `rejected` | Error message + retry button |

**Registration form fields:**
- Legal first name, legal last name
- Business display name (pre-fill from shop_name)
- Email (pre-fill from owner email)
- Mobile phone (for OTP)
- Business address (pre-fill from shop_address)
- Vertical dropdown (e.g., "Professional Services")

**API calls sequence:** register-sp → trigger-otp → [user enters code] → verify-otp → create-campaign → assign-number

**Reuse:** Existing `SmsRegistrationForm` component (lines 115-200). Existing `apiFetch()`. Existing `inp`/`lbl` form styles.

#### Task 2.2: Booking page — Update CTA text

Update `app/book/[id]/page.tsx` SMS consent label (lines 1584-1597).

**New consent text** (use `shopName` from config, not "VuriumBook"):
```
I agree to receive {shopName} Appointment Notifications via SMS 
(confirmations, reminders, reschedules, and cancellations). Message 
frequency may vary (up to 5 per booking). Standard message and data 
rates may apply. Reply STOP to opt out. Reply HELP for help. Consent 
is not a condition of purchase.
Terms: https://vurium.com/terms  Privacy: https://vurium.com/privacy
```

Make Terms/Privacy clickable `<a>` links (not just text).

#### Task 2.3: Booking page — Consent metadata

Ensure booking submission sends:
- `sms_consent_text_version` — hash/version of consent text shown
- `sms_consent_ip` — (already sent)
- `sms_consent_ua` — (already sent)
- `sms_consent_at` — (already sent)

---

### Execution status

```
AI 1 (backend/index.js)           AI 2 (frontend)
─────────────────────────         ──────────────────────
✅ 1.1 Telnyx Verify API          ⏳ 2.1 Settings SP wizard
✅ 1.2 SP endpoints fixed         ⏳ 2.2 Booking page CTA text
✅ 1.3 Auto-TFN removed           ⏳ 2.3 Consent metadata
✅ 1.4 Message formats OK        
✅ 1.5 Docs updated               
```

### Verification checklist

- [ ] Telnyx Verify: `/public/verify/send/:wsId` → receive OTP → `/public/verify/check/:wsId` → success
- [ ] SP Registration: Settings → fill form → OTP → verify → campaign active → number assigned
- [ ] Booking SMS: create booking with consent → SMS delivered with `{shopName}: ...` + STOP
- [ ] Reminders: scheduled 24h/2h reminders have correct format + STOP language
- [ ] STOP: reply STOP → opt-out recorded → no further messages
- [ ] Booking CTA: consent text shows business name + all compliance elements + clickable links
- [ ] New signup: no auto-TFN provisioning, `sms_registration_status: 'not_registered'`

## Key Documents (docs/Telnyx/)

- `CP_575_A.pdf` — IRS EIN assignment notice
- `CorpArt.pdf` / `Corporation Articles of Incorporation.pdf` — Illinois incorporation
- `Platform-level CUSTOMER_CARE 10DLC on Telnyx for a Multi-tenant Booking SaaS.pdf` — GPT research on platform-as-sender model
- `Carrier-review readiness audit...pdf` — Policy compliance audit
- `VuriumBook SMS Compliance Architecture Decision...pdf` — Final architecture decision (per-business SP + Verify)
