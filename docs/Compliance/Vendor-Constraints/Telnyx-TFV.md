---
type: reference
status: active
owner: AI 7
created: 2026-04-15
updated: 2026-04-15
source_of_truth: true
vendor: Telnyx
domain: Toll-Free Verification (TFV)
sources:
  - "[[Tasks/AI5-Research-Brief-Reminder-SMS]]"
  - "[[Tasks/TFV-Inspection-Result-2026-04-15]]"
---

# Vendor Constraints — Telnyx Toll-Free Verification (TFV)

> [[Home]] > [[Compliance/Vendor-Constraints/README|Vendor Constraints]] | Source: [[Tasks/AI5-Research-Brief-Reminder-SMS|AI 5 Brief]], [[Tasks/TFV-Inspection-Result-2026-04-15|TFV Inspection]]
> Translated by: AI 7 | 2026-04-15

---

## What Telnyx requires for toll-free reminder SMS

### Verification

- Toll-free numbers **must** be verified (TFV) before first outbound message.
- Only `Verified` status means the number can send. All other states (`Waiting For Telnyx`, `Waiting For Customer`, `Waiting For Vendor`, `Rejected`, `In Progress`, `draft`, `pending`) are non-ready.
- Unverified toll-free numbers attempting to send are blocked (`40329`).
- Submitting a new TFV for an already-approved number can overwrite the approved state temporarily.

### TFV Submission

- TFV is API-capable (submit, list, retrieve, update/resubmit, status-history).
- TFV is also available via Telnyx Portal.
- No limit on resubmissions after fixing issues.
- Canonical API endpoint: `/v2/messaging_tollfree/verification/requests`.
- TFV webhook events include verification status, affected phone numbers, and reasons.

### Business Registration Fields

- As of 2026-04-15, BRN fields (`businessRegistrationNumber`, `businessRegistrationType`, `businessRegistrationIssuingCountry`) are mandatory for standard TFV.
- **Exception**: Sole Proprietor path does not require BRN fields (Pattern B in our plan).
- If BRN fields are included, all three must be present — missing `IssuingCountry` alone triggers `Business Registration Number Is Missing or Invalid`.

### Allowed use cases for toll-free

- `Appointments`
- `Booking Confirmations`
- `App Notifications`
- `Waitlist Alerts`
- `Webinar Reminders`
- `Customer Care`
- `Mixed`

Telnyx describes toll-free as "ideal for US/CA transactional messaging."

### Opt-in / CTA requirements

| Requirement | Detail |
|---|---|
| Brand-consistent opt-in | Opt-in form must be branded with the same brand being registered |
| SMS checkbox optional | Must be unchecked by default |
| SMS consent separate | Must not be bundled with email or other consents |
| Marketing separate | If marketing SMS is also used, it needs a separate compliant checkbox |
| Matching identity | Business identity between site, CTA, and TFV request must match |
| Product/program description | Tell user what they are opting into |
| Originating number(s) | Disclose the sending number(s) |
| Organization identity | Name the organization |
| Opt-in language + charges | Describe rates, frequency |
| Opt-out instructions | STOP disclosure |
| Customer-care contact | HELP, support contact |
| Privacy policy + terms | Links required |

### First-message disclaimer

Before the first outbound message, include:
- Brand name
- Use case
- `Reply STOP to opt out`
- `Reply HELP for help`
- Message/data rates may apply
- Message frequency may vary
- Terms link
- Privacy Policy link

### STOP / HELP behavior on toll-free

- Carrier-level STOP: the toll-free carrier/network sends its own `NETWORK MSG` response for STOP. This cannot be suppressed.
- Carrier UNSTOP/START also exists at carrier level.
- Telnyx profile-level opt-out system applies block rules at the messaging profile level by default.
- HELP autoresponses can be configured on messaging profiles and in TFV `helpMessageResponse` field.
- **Implication**: STOP scope is per-messaging-profile. Dedicated profile per workspace isolates opt-out scope.

### Throughput and ramp-up

- ~20 MPS per toll-free number (general guidance).
- Newly verified traffic may be filtered by some carriers — ramp up gradually over 1-2 weeks.
- Do not send more than 10 messages to a single recipient in any 24-hour period (unless active two-way or explicit higher-frequency opt-in).
- Rate-limit errors: `40011` (rate limited), `40014` (queue expiry).

### ISV / Reseller constraints

- ISV Reseller flag on TFV triggers higher compliance scrutiny.
- "On behalf of businesses" language in use case summary triggers reseller classification.
- Empirically rejected: campaign `CKAOXOW` code 710 ("Reseller / Non-compliant KYC") and TFV request `e23146a2` (same class).
- Per-workspace TFV (each business registers under own identity) avoids this.

### Error codes reference

| Code | Meaning |
|---|---|
| `40305` | Sending number not associated with a messaging profile |
| `40312` | Disabled messaging profile |
| `40329` | Toll-free not verified |
| `40330` | Toll-free not provisioned |
| `40331` | Destination whitelist missing |
| `40333` | Spend limit reached |
| `40011` | Rate limited |
| `40014` | Queue expiry |

---

## What Telnyx does NOT guarantee

- Multi-number TFV requests may or may not be partially approved per-number (unknown).
- Exact combined keyword matrix for toll-free beyond STOP/START/UNSTOP is not perfectly specified.
- Not every rejection can necessarily be resolved without human Telnyx support interaction.
- Transitional behavior for unverified/pending states exists in docs but does not prove reliable launch-ready posture without TFV approval.

---

## Source hierarchy (when Telnyx docs conflict)

1. Live TFV object state in Portal or API = operational truth
2. API reference + error docs = runtime/contract truth
3. Help Center guides = policy/review truth
4. Marketing/comparison docs = background only

Stricter interpretation wins.
