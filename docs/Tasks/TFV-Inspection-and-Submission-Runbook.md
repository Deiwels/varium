# TFV Inspection & Submission Runbook — one fresh workspace sender

> [[Home]] > Tasks | Related: [[AI5-Research-Brief-Reminder-SMS]], [[Reminder-SMS-Launch-Completion]], [[Telnyx-Integration-Plan]], [[Features/SMS & 10DLC]], [[Live-SMS-Verification-Checklist]]
> Owner: AI 1 (Claude) authored · 2026-04-15 · needs Owner or Codex to execute
> Scope: answer the one binary question AI 5 research pinned: **does a fresh Vurium workspace's toll-free sender already have a TFV request, and is it `Verified`?** If not, submit the smallest correct TFV request for that sender.

---

## Meta — why this is a runbook, not a live report

AI 1's slot in [[Tasks/In Progress]] → "Action queue after AI 5 research" → item 1 says:

> AI 1 / Claude — Check one fresh workspace sender in Telnyx Portal/API — Confirm whether a TFV request exists — Record the exact TFV status — If TFV has not been submitted, prepare the smallest correct submission path

I attempted the Chrome MCP path first. The Telnyx Customer Portal is gated by a login form (`https://portal.telnyx.com/#/login/sign-in`), and per my [[AI-Profiles/AI-1-Claude|AI 1 profile]] security rules I cannot type credentials into any portal, so I cannot complete the inspection from inside a fresh Chrome MCP session that lacks Owner's cookies. Codex's original ask anticipated this case — the alternate deliverable was "or prepare точний API flow". This file is that API flow, plus the submission payload, plus the decision tree, so whoever does have Telnyx access (Owner via Portal, or Owner/Codex via `TELNYX_API_KEY`) can run it in <10 minutes and paste the raw response back into [[AI5-Research-Brief-Reminder-SMS]] § "AI 1 inspection result".

The runbook follows [[AI5-Research-Brief-Reminder-SMS]] § 6 canonical-source hierarchy: portal/API state is the operational truth, API reference is enforceable runtime truth, Help Center is policy truth.

---

## Phase 0 — Prerequisites

Before running any command below, have these values ready:

| Variable | Where to get it | Notes |
|---|---|---|
| `TELNYX_API_KEY` | GitHub Secrets or Telnyx Portal → Account → API Keys | Owner-only. Do **not** paste it into chat or commit it to docs. Use `export TELNYX_API_KEY=...` locally. |
| `PHONE_NUMBER` | one fresh workspace toll-free sender (E.164, e.g. `+18445550123`) | Must be a Vurium-provisioned toll-free number, **not** Element's 10DLC number. See "Phase 0 — pick a target sender" below. |
| `BUSINESS_CONTEXT` | workspace `settings/config` + workspace doc for the chosen sender | Needed only if Phase 2 (submission) is reached. Business name, address, phone, email, use case, website. |

### Phase 0.a — Pick a target sender

Three ways to find a fresh workspace toll-free number:

1. **Cloud Run logs + backend audit**: run the existing `GET /api/vurium-dev/sms/status` endpoint (from [[Architecture/Superadmin-Endpoints]]) against a specific workspace, or query the workspace Firestore doc directly for `sms_from_number` + `sms_number_type === 'toll-free'`. Any workspace with both set is a candidate.
2. **Telnyx Portal UI**: `portal.telnyx.com` → Real-Time Communications → Numbers → My Numbers → filter by number type `toll-free` → pick a recent non-Element one.
3. **Telnyx API list**:
   ```bash
   curl -s https://api.telnyx.com/v2/phone_numbers \
     -H "Authorization: Bearer $TELNYX_API_KEY" \
     -H "Accept: application/json" \
     | jq '.data[] | select(.phone_number_type == "toll-free") | {phone_number, status, messaging_profile_id, created_at}'
   ```
   Pick a recent one that is **not** Element's number (Element uses 10DLC, not toll-free, so it won't appear in this filter anyway, but double-check by eye).

Record the chosen number as `PHONE_NUMBER` (E.164, leading `+` required) and the workspace slug for Phase 2.

### Phase 0.b — Sanity check: is the number even messaging-enabled?

```bash
curl -s "https://api.telnyx.com/v2/phone_numbers/$(python3 -c "import urllib.parse,os; print(urllib.parse.quote(os.environ['PHONE_NUMBER']))")" \
  -H "Authorization: Bearer $TELNYX_API_KEY" \
  -H "Accept: application/json" \
  | jq '.data | {phone_number, phone_number_type, messaging_profile_id, status}'
```

Expected good state:

- `phone_number_type`: `"toll-free"`
- `messaging_profile_id`: non-empty string
- `status`: `"active"`

If any of these is missing or different, stop and flag it in [[AI5-Research-Brief-Reminder-SMS]] — TFV inspection won't tell us anything useful until the number is basic-configured.

---

## Phase 1 — Inspection (read-only)

Goal: answer two binary questions for `PHONE_NUMBER`:

1. Does a TFV request exist on this number?
2. If yes, what is the current status — `Verified`, or one of the not-ready states?

Per AI 5 research [[AI5-Research-Brief-Reminder-SMS]] § 5 "Portal / verification state", only `Verified` is clearly launch-ready. All other states should be treated as not ready.

### Phase 1.a — List TFV requests

```bash
curl -s "https://api.telnyx.com/v2/messaging_tollfree/verification/requests?page[size]=250" \
  -H "Authorization: Bearer $TELNYX_API_KEY" \
  -H "Accept: application/json" \
  | jq '.data[] | {id, phone_numbers, business_name, use_case, status, created_at, updated_at}'
```

Look through the output for any object whose `phone_numbers` array contains your `PHONE_NUMBER`. If found → record the `id` and `status`. If the list is paginated and your number isn't in the first 250, iterate with the `meta.next_page_url` / `page[number]` params until found or the end of the list.

Field reference (per canonical Telnyx API reference page linked in AI 5 research § Sources):

- `id` — UUID of the verification request
- `phone_numbers` — array of E.164 numbers this request covers
- `business_name` — brand name as registered
- `use_case` — use case string (e.g. `Appointments`, `Booking Confirmations`, `Mixed`, `Customer Care`)
- `status` — verification state

### Phase 1.b — Retrieve a specific TFV request by id (if found)

```bash
VERIFICATION_REQUEST_ID="<uuid-from-phase-1a>"
curl -s "https://api.telnyx.com/v2/messaging_tollfree/verification/requests/$VERIFICATION_REQUEST_ID" \
  -H "Authorization: Bearer $TELNYX_API_KEY" \
  -H "Accept: application/json" \
  | jq '.data'
```

Capture the **full object** as the definitive state for this sender. Paste into [[AI5-Research-Brief-Reminder-SMS]] § "AI 1 inspection result" as the primary evidence.

### Phase 1.c — Alternative: Portal inspection (Owner path, no API key needed)

If running API commands is inconvenient, Owner can instead:

1. `portal.telnyx.com` → Real-Time Communications → Messaging → **Regulatory** → Toll-Free Verification
2. Find the row for `PHONE_NUMBER` (or filter by number)
3. Click into the row → read the `Status` field
4. Screenshot and paste into [[AI5-Research-Brief-Reminder-SMS]]

### Phase 1.d — Decode the status into a go/no-go

Per AI 5 research § 5, the status-name-to-decision matrix:

| Telnyx status | Launch-ready? | Next action |
|---|---|---|
| `Verified` | ✅ **YES** | Phase 1 complete. Sender is truly live. Owner can run one fresh-workspace live pilot per [[Tasks/Live-SMS-Verification-Checklist]]. Skip Phase 2, go to Phase 4 (post-verification hygiene). |
| `Waiting For Telnyx` | ❌ no | Phase 1 done. Telnyx is reviewing. Wait. Note the `updated_at` timestamp in the research brief. Do not resubmit — that resets the clock. |
| `Waiting For Vendor` | ❌ no | Phase 1 done. Vendor (carrier) reviewing. Wait. Do not resubmit. |
| `Waiting For Customer` | ❌ no | Telnyx has bounced the request back with something they need from us. **Read the `status_history` via API** (see Phase 1.e) — the reason is in the message. Fix the specific issue and use PATCH to update the existing request, do not submit a fresh one. |
| `In Progress` | ❌ no | Same as `Waiting For *` — request is mid-flight. Wait, do not resubmit. |
| `Rejected` / `rejected` | ❌ no | Phase 1 done, bad outcome. Read the rejection reason from `status_history`. Fix whatever is needed, then PATCH the request to resubmit. Per Telnyx docs there is **no limit on resubmissions**. |
| `draft` / `pending` | ⚠️ unclear | One of the troubleshooting surfaces uses these labels. Treat as "request exists but not finalized". If the number is really supposed to be live, this is a red flag — check status_history for what is missing. |
| no request at all | ❌ no | No TFV request exists for this number. Go to Phase 2 (submission). This is the most likely state for any fresh workspace sender since the backend provisioner does **not** currently auto-submit TFV — AI 1 verified by grep that `messaging_tollfree` / `verification_request` / `TFV` does not appear anywhere in `backend/index.js`. |

### Phase 1.e — Status history (optional but useful)

When the top-level status is `Waiting For Customer` or `Rejected`, the actionable detail is in the history:

```bash
curl -s "https://api.telnyx.com/v2/messaging_tollfree/verification/requests/$VERIFICATION_REQUEST_ID/status_history" \
  -H "Authorization: Bearer $TELNYX_API_KEY" \
  -H "Accept: application/json" \
  | jq '.data'
```

Each entry has a `status`, `timestamp`, and a `reason` / message field. The latest entry explains what Telnyx or the carrier objected to. Paste the full response into [[AI5-Research-Brief-Reminder-SMS]].

---

## Phase 2 — Submission (only if Phase 1 shows no TFV request)

If Phase 1.a finds no TFV request for `PHONE_NUMBER`, this phase submits a fresh one. **Stop and check** before running the POST — this is an action that Telnyx bills review time on, and the payload must be accurate. Do not run Phase 2 without Owner-explicit confirmation.

### Phase 2.a — Collect the business context for the workspace

Pull these values from the chosen workspace's Firestore `settings/config` doc or from the Developer Panel. The fields need to match what is actually shown on the live booking page at `/book/<slug>` — otherwise the reviewer will mark the request `Rejected` for the same "CTA / brand inconsistency" class of failure that Element's first submission hit (see [[Features/SMS & 10DLC]] § "Per-business campaign: Element Barbershop" lessons).

| Required field | Source in repo / portal | Example value |
|---|---|---|
| Business legal name | `settings/config.shop_name` (or `settings/config.sms_brand_name` if set) | `Element Barbershop` — but note Element uses 10DLC, so pick a non-Element workspace |
| DBA / brand name shown on CTA | `settings/config.sms_brand_name || shop_name` | must be identical to the `<strong>{smsProgramName}</strong>` rendering on `/book/<slug>` |
| Business address line 1 | `settings/config.shop_address` | `1142 W Lake Cook Rd` |
| City / State / ZIP / Country | split from `shop_address` manually | `Buffalo Grove / IL / 60089 / US` |
| Business contact email | `settings/config.shop_email` | must resolve — no typo domains (remember the `element-barbersho.com` typo from 2026-04-15 Element remediation) |
| Business contact phone | `settings/config.shop_phone` | E.164 |
| Business website | `getWorkspaceBookingUrl(workspace)` → `https://vurium.com/book/<slug>` | **This is the CTA URL that reviewers will visit.** Must serve the live booking page with full business info and consent checkbox. |
| Use case | one of Telnyx enum — for appointment reminders pick `Appointments` or `Booking Confirmations`, for mixed pick `Mixed` | Telnyx TFV Guide enum, per AI 5 research § 4 |
| Use case summary | free-form description | see template below |
| Sample messages (3) | actual production message templates from `backend/index.js` | must match what Telnyx will see in real traffic |
| Opt-in workflow description | description of how a user opts in | see template below |
| Opt-out instructions | brand-safe language | "Reply STOP to opt out" |
| HELP response | what the sender replies on HELP | must match backend `:1860` handler |
| Privacy policy URL | `https://vurium.com/privacy` | hardcoded on booking page `<a>` tags |
| Terms of service URL | `https://vurium.com/terms` | hardcoded on booking page `<a>` tags |

### Phase 2.b — Payload template (verify field names against canonical API reference before running)

> ⚠️ **Canonical field names** must be confirmed against https://developers.telnyx.com/api-reference/verification-requests/submit-verification-request before the POST. Telnyx has historically renamed TFV fields between schema versions. This template uses the field names that AI 5 research § 6D identifies as consistent across canonical API reference pages and the Telnyx TFV Guide, but **do not POST without re-reading the reference page first** — a rejected request because of a misnamed field wastes a cycle.

```json
{
  "phone_numbers": ["<PHONE_NUMBER_E164>"],
  "business_name": "<LEGAL_OR_DBA_BUSINESS_NAME>",
  "corporate_website": "https://vurium.com/book/<WORKSPACE_SLUG>",
  "business_addr1": "<STREET_1>",
  "business_addr2": "",
  "business_city": "<CITY>",
  "business_state_or_region": "<STATE_2_LETTER>",
  "business_zip": "<ZIP>",
  "business_country": "US",
  "business_contact_first_name": "<OWNER_FIRST>",
  "business_contact_last_name": "<OWNER_LAST>",
  "business_contact_email": "<SHOP_EMAIL>",
  "business_contact_phone": "<SHOP_PHONE_E164>",
  "use_case": "Appointments",
  "use_case_summary": "Transactional appointment SMS sent by <BUSINESS_NAME> to clients who opt in during online booking at https://vurium.com/book/<WORKSPACE_SLUG>. Messages are booking confirmations, 24-hour reminders, 2-hour reminders, reschedule notices, and cancellation notices. Triggered only by booking events. Frequency up to 5 messages per booking. No marketing.",
  "production_message_content": "<BUSINESS_NAME>: Your appointment is confirmed for Mon Apr 7 at 2:00 PM with John. Msg freq varies, up to 5 msgs/booking. Msg & data rates may apply. Reply STOP to opt out, HELP for help.\n<BUSINESS_NAME>: Reminder: Your appointment with John is tomorrow Mon Apr 7 at 2:00 PM. Reply STOP to opt out, HELP for help.\n<BUSINESS_NAME>: Your appointment with John on Mon Apr 7 at 2:00 PM has been cancelled. Reply STOP to opt out, HELP for help.",
  "opt_in_workflow_description": "Customers opt in via the public online booking page at https://vurium.com/book/<WORKSPACE_SLUG>. The page shows the business name, address, phone, email, team members, and services. The booking flow has 3 steps: (1) customer selects a barber and service, (2) customer selects date and time, (3) customer enters name, email, and phone, and sees an unchecked-by-default SMS consent checkbox. The checkbox states: \"I agree to receive <BUSINESS_NAME> Appointment Notifications via SMS (confirmations, reminders, reschedules, and cancellations). Message frequency may vary (up to 5 per booking). Standard message and data rates may apply. Reply STOP to opt out. Reply HELP for help. Consent is not a condition of purchase. View our Terms and Privacy Policy.\" The phone field is required for booking; the SMS checkbox is optional and unchecked by default. Consent is stored with timestamp, IP address, and user agent.",
  "help_message_response": "<BUSINESS_NAME>: For help, contact support@vurium.com. Visit https://vurium.com/privacy for our Privacy Policy. Reply STOP to opt out.",
  "opt_out_message_response": "<BUSINESS_NAME>: You have been unsubscribed and will receive no further messages. Reply HELP for help or START to re-subscribe.",
  "privacy_policy_url": "https://vurium.com/privacy",
  "terms_and_conditions_url": "https://vurium.com/terms",
  "message_volume": "10"
}
```

### Phase 2.c — POST

```bash
curl -s -X POST "https://api.telnyx.com/v2/messaging_tollfree/verification/requests" \
  -H "Authorization: Bearer $TELNYX_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  --data @tfv-request-payload.json \
  | jq '.'
```

Capture the response. Success path: HTTP `201` with a `data.id` UUID and initial status (likely `Waiting For Telnyx` or similar). Paste the response into [[AI5-Research-Brief-Reminder-SMS]] § "AI 1 inspection result — submission".

Failure path: HTTP `400` or `422` with an `errors[]` array. Read the error detail — most common reasons are missing required fields or wrong business info format. Fix the payload, re-POST.

### Phase 2.d — Post-submit: wire the webhook (if not already)

Webhook events for TFV state changes are delivered to the same `/api/webhooks/telnyx-10dlc` endpoint that handles 10DLC brand/campaign state in `backend/index.js:1873`. Confirm the endpoint is still registered in Telnyx messaging profile webhook settings. Each TFV state change will POST:

```json
{
  "event_type": "verification_request.status_updated",
  "payload": {
    "verification_request_id": "<uuid>",
    "phone_numbers": ["<PHONE_NUMBER>"],
    "status": "Verified",
    "previous_status": "Waiting For Vendor",
    "reason": "..."
  }
}
```

The current webhook handler maps TCR-campaign statuses (`TCR_PENDING`, `MNO_PROVISIONED`, etc.) to our internal `sms_registration_status` field, but it does **not** yet map TFV-specific statuses (`Verified`, `Waiting For *`, `Rejected`). This is a backend gap flagged for follow-up in the `Reminder-SMS-Launch-Completion` plan. It does not block Phase 1 or Phase 2 execution — the webhook will still arrive, we just won't auto-update the workspace status from it until AI 3's plan + AI 1 implementation add the mapping.

---

## Phase 3 — Post-submission monitoring

Once a TFV request exists with a non-terminal status, monitor it:

- **API poll**: re-run Phase 1.b every 24 hours until status is terminal (`Verified` or `Rejected`)
- **Webhook**: watch Cloud Run logs for `POST /api/webhooks/telnyx-10dlc` entries tagged with the request id
- **Expected timeline** per AI 5 research: hours to days for the initial state transitions, longer if a carrier review is involved

When status flips to `Verified`:

1. Owner runs one fresh-workspace live pilot per [[Tasks/Live-SMS-Verification-Checklist]]
2. After pilot confirms real send/STOP/HELP work end-to-end, AI 1 updates `backend/index.js:2172` `sms_registration_status: 'active'` semantics documentation in [[Features/SMS & 10DLC]] to clearly mean "TFV verified + live-tested" rather than just "number attached to profile"
3. AI 3 publishes the final completion plan for reminder SMS launch

When status flips to `Rejected`:

- **Stop.** Do not resubmit blindly. Per Telnyx docs `$15` review fees may apply on some resubmissions, but more importantly, repeated rejections increase friction with the carrier vendor lane.
- Read the rejection reason from `status_history` (Phase 1.e)
- Match the reason against the known failure classes from [[AI5-Research-Brief-Reminder-SMS]] § 4 — most common is "CTA / brand / samples inconsistency"
- Remediate the specific gap (code or form or website content)
- Only then PATCH the existing request via the `messaging_tollfree/verification/requests/{id}` PATCH endpoint — do **not** submit a fresh one, per Telnyx guidance "update/resubmit a verification request after issues are fixed"

---

## Phase 4 — Post-verification hygiene (after `Verified`)

Once the sender is genuinely `Verified`, per AI 5 research § 5 some carriers still filter newly verified toll-free traffic for 1–2 weeks and Telnyx recommends ramping volume gradually:

- **Day 1 post-verify**: send at most 10 messages from the sender (use a test workspace with a known-good recipient)
- **Days 2–3**: ramp to 50/day
- **Days 4–7**: ramp to 250/day
- **Week 2+**: unrestricted per workspace throughput limits

Also apply the per-recipient cap from AI 5 research § 5 "Sending restrictions": avoid sending more than **10 messages to a single recipient in any 24-hour period** unless that recipient is in two-way communication or has explicitly opted in to higher-frequency messaging. For appointment reminders this should be a non-issue — 5 messages per booking per Telnyx-registered sample content stays well under the cap.

---

## Phase 5 — What to hand back after running this runbook

After Phase 1 (or Phase 2, if submission was needed), paste back into [[AI5-Research-Brief-Reminder-SMS]] § "AI 1 inspection result" a block that looks like:

```
Target sender:      +1xxxyyyzzzz (workspace <slug>, workspace_id <wsId>)
Inspection time:    2026-04-15 <local time>
Pre-check:          phone_number_type=toll-free, messaging_profile_id=<uuid>, status=active  ✅
TFV request exists: yes | no
TFV request id:     <uuid or "N/A">
TFV status:         <Verified | Waiting For Telnyx | Waiting For Customer | Rejected | ...>
status_history:     <paste last 2 entries if not Verified>
Submission taken:   yes | no
Submission id:      <uuid or "N/A">
Blocker summary:    <one-sentence plain-language answer to "is reminder SMS launch-ready for this workspace?">
```

Then update [[Tasks/In Progress]] to tick the AI 1 item off the "Action queue after AI 5 research" list and hand over to AI 3 for the final reminder SMS completion plan.

---

## Appendix — why AI 1 wrote a runbook instead of running it

Two hard blockers kept me from executing this runbook inside this session:

1. **Telnyx portal credentials**: my AI 1 security profile does not allow typing credentials into authentication forms even with explicit Owner permission. The portal login at `https://portal.telnyx.com/#/login/sign-in` is a hard stop.
2. **API key**: `TELNYX_API_KEY` is a GitHub Secret that Cloud Run receives via the deploy workflow. The value is not exposed to any file I can read in the repo, and I have no terminal that can reach a service that already has it injected as an env var.

Codex's original ask explicitly accepted this alternative: "якщо TFV request ще нема, це треба або подати вручну зараз, або підготувати точний API flow". This file is the exact API flow, payload template, decision tree, rejection handling, post-verification hygiene plan, and hand-back format all in one. Owner or Codex can run Phase 1 in under 5 minutes against one fresh workspace sender and then come back with the terminal answer to the binary question AI 5's research pinned:

> Does this exact number already have a TFV request, and is it `Verified`?

If the answer is **no**, Phase 2 is the smallest correct submission path with the exact payload Telnyx expects.
