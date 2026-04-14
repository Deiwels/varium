# Element Barbershop — 10DLC Resubmission Checklist

> [[Home]] > Tasks | Owner: Verdent (verification doc)
> Related: [[Tasks/SMS-Strategy-Review|SMS Strategy Review]], [[Tasks/Platform-Sender-Pivot-Decision|Platform Sender Pivot]], [[Tasks/Telnyx-Integration-Plan|Telnyx Integration Plan]], [[Tasks/US-A2P-CTA-Brand-Verification-Notes|US A2P CTA & Brand Verification Notes]], [[Tasks/Temporary-Reminder-Delivery-Options|Temporary Reminder Delivery Options]]
> Created: 2026-04-15
> Context: Campaign CICHCOJ failed MNO review with two reasons:
> 1. "Brand website lacking sufficient information about the company and its products"
> 2. "Call-to-action does not contain registered/DBA brand name"

---

## 🟢 Live verification — 2026-04-15 — VERIFIED READY

> Status flipped from 🔴 BLOCKED to 🟢 READY after owner fixed both typos (`Bufalo Grove` → `Buffalo Grove, IL 60089`; `element-barbersho.com` → `element-barbershop.com`), Codex ran FE.Element-Verify.1–5 live and all 5 passed, and AI 1 re-verified backend state via `/public/config/` against production. All four pre-resubmit gates are green. Owner's remaining task is a one-second CTA-URL check in the Telnyx portal before clicking Resubmit.
>
> Full state + post-resubmit protocol is in [[Tasks/In Progress|In Progress]] → "ELEMENT 10DLC RESUBMIT — VERIFIED READY (2026-04-15)" section. The block below preserves the earlier state for history.

## 🕰️ Earlier state (2026-04-15 ~11:40 local) — 2 content typos found — HARD BLOCKERS

Owner asked if Element is ready for Resubmit after the full remediation chain (`e97efd9` backend + `dbc8dfa`/`b74c79b`/`bed4537`/`8f7bec3`/`c2d0a99` frontend). AI 1 (Claude) ran a live production verification against `/public/config/`, `/public/services/`, `/public/barbers/` and curled the booking / privacy / terms HTML shells.

### What IS live and correct ✅

| Field / surface | Live value (prod) |
|---|---|
| `shop_name` | `Element Barbershop` — exact DBA match |
| `shop_phone` | `+1 (224) 584-5072` |
| `business_type` | `Barbershop` |
| `sms_brand_name` | `Element Barbershop` |
| `online_booking_enabled` | true |
| Services (`/public/services/`) | **40 real services** with names and real prices ($24.99–$100) and durations |
| Team (`/public/barbers/`) | 6 barbers (Arsen, Dan, Lili, Naz, Vio) |
| `/book/elementbarbershop` HTTP | `200 OK` from Vercel |
| og:title on booking page | `Book with Element Barbershop` |
| Backend-side code for Business details, Services preview, consent-first, legal-link context | All committed and deployed |

### What is WRONG — 2 content typos ❌

**Blocker A — address typo + missing ZIP**

```
shop_address: "1142 W Lake Cook Rd, Bufalo Grove, IL"
```

- `Bufalo` → should be `Buffalo` (two f's)
- Missing ZIP code — should end with `60089`
- **Correct value:** `1142 W Lake Cook Rd, Buffalo Grove, IL 60089`

**Blocker B — email domain typo**

```
shop_email: "contacts@element-barbersho.com"
```

- Missing `p` before `.com` — domain does not resolve
- **Correct value:** `contacts@element-barbershop.com`

**Why these are hard blockers for MNO review.** The first MNO rejection reason was "brand website is lacking sufficient information about the company and its products." MNO reviewers routinely Google / WHOIS the visible address and email domain to confirm the business is real. With `Bufalo Grove` (no Google match) and `element-barbersho.com` (non-existent domain), both cross-checks fail and the reviewer lands on the same failure class we already hit. The product code is correct — the backend data is wrong on these two fields and needs to be fixed in Settings before any resubmit click.

### What could NOT be verified via curl

`/book/[id]`, `/privacy`, and `/terms` are `'use client'` Next.js routes. Curl only returns the Next.js shell + og metadata. The actual Business details block, Services preview grid, team grid, SMS consent early-render, and legal-page business-context highlight panels render after JS hydration in a real browser.

Confirmed from curl:
- pages return 200
- `og:title`, `og:description`, `og:image`, canonical URL — all business-branded
- next.js chunks loading correctly

NOT confirmed from curl:
- visible Business details block on the public landing
- visible Services preview cards
- visible team grid with 6 barbers
- SMS consent text rendering before phone entry
- `Legal · Element Barbershop` label and blue context panels on `/privacy?business=...&slug=...`
- Same panels on `/terms?...`

Only a real browser visit can confirm the hydrated output. This is a **Codex (AI 2) verification task** (FE.Element-Verify below).

### Status at that time: 🔴 NOT READY FOR RESUBMIT

Two hard blockers (backend content typos) + one verification gap (hydrated render not yet confirmed). Proceeding at that moment would very likely have produced a second MNO failure in the same failure class.

**This earlier state was resolved within a few hours.** Owner fixed both typos, Codex completed the FE.Element-Verify.1–5 live browser pass, AI 1 re-verified backend. See current state at the top of this file and in `In Progress.md` → "ELEMENT 10DLC RESUBMIT — VERIFIED READY".

---

## 🟢 Unblock plan — do in this order

### Step 1 — Owner fixes 2 typos in Element Settings

Log in as Element owner → `/settings` → General (or whichever tab holds Business Info) → update the following two fields and hit Save:

| Field | Current (wrong) | Correct |
|---|---|---|
| `shop_address` | `1142 W Lake Cook Rd, Bufalo Grove, IL` | `1142 W Lake Cook Rd, Buffalo Grove, IL 60089` |
| `shop_email` | `contacts@element-barbersho.com` | `contacts@element-barbershop.com` |

Verification (AI or owner):

```bash
curl -s https://vuriumbook-api-431945333485.us-central1.run.app/public/config/EZaC81SVGM0uuoYMxBCT \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('addr:', d.get('shop_address')); print('mail:', d.get('shop_email'))"
```

Expected:
```
addr: 1142 W Lake Cook Rd, Buffalo Grove, IL 60089
mail: contacts@element-barbershop.com
```

### Step 2 — FE.Element-Verify — Codex (AI 2) live browser verification

**This is Codex scope.** The public booking page and the legal pages are client-side rendered Next.js routes; only a real browser can confirm that the Business details block, Services preview grid, and legal context panels actually show up for a human visitor. Curl cannot see hydrated output.

Codex runs this on **incognito Chrome + iPhone Safari (375 px)**:

#### FE.Element-Verify.1 — Public booking page hydration
Open `https://vurium.com/book/elementbarbershop` (no auth).

- [ ] Page title reads "Book with Element Barbershop" (browser tab + `<title>`)
- [ ] Initial visible content (above the fold on 375 px) includes `Element Barbershop` as the header
- [ ] `Business details` section visible with Location / Phone / Email filled from the corrected Settings values — address string reads "1142 W Lake Cook Rd, Buffalo Grove, IL 60089", email is the corrected domain
- [ ] `Services` preview grid visible with at least 4–6 service cards, each showing a service name + price + duration
- [ ] Team preview visible with the 6 barbers (Arsen, Dan, Lili, Naz, Vio, +1)
- [ ] No scroll-jumping or empty white strips between sections
- [ ] No JS console errors referencing the Element workspace id, hydration mismatch, or `undefined business`
- [ ] Works on both desktop (Chrome 1280 px) and iPhone size (375 px). Business details grid re-flows properly on mobile

#### FE.Element-Verify.2 — Booking details step SMS consent copy
Click into the booking flow → select service → pick time → reach details step.

- [ ] SMS consent checkbox is rendered **immediately** when the details step paints, not waiting for phone number entry (the `b74c79b` fix)
- [ ] Consent label reads similar to: `"I agree to receive Element Barbershop Appointment Notifications via SMS..."` — the business name must appear in the consent string verbatim (matches DBA)
- [ ] Privacy Policy link is clickable and its `href` contains `business=Element%20Barbershop&slug=elementbarbershop` (check via inspect-element or hover preview)
- [ ] Terms of Service link same — must carry the same query string
- [ ] Consent text mentions STOP, HELP, msg+data rates, Consent not a condition of purchase

#### FE.Element-Verify.3 — Legal page business-context panels
Click `Privacy Policy` from the consent label.

- [ ] Page label near the top reads `Legal · Element Barbershop` (not just `Legal`)
- [ ] First highlight block is visible above the page body, reading approximately: *"Element Barbershop uses VuriumBook as its scheduling and messaging platform..."* — exact wording from `app/privacy/page.tsx`
- [ ] Highlight block ends with `Return to the public booking page: /book/elementbarbershop` and the link works
- [ ] Inside the SMS section (`#sms`), a second highlight panel appears: *"...the consumer-facing SMS program is presented as 'Element Barbershop Appointment Notifications'"*

Repeat on `Terms of Service`:

- [ ] Same label change (`Legal · Element Barbershop`)
- [ ] Same highlight panels appear at the top and inside the SMS program section

#### FE.Element-Verify.4 — Pill bar post-hotfix (71a20e2)
Only tangentially related, but since we're testing on mobile anyway:

- [ ] Mobile pill bar shows exactly 5 icons: Home · History · Calendar · Messages · Settings
- [ ] No horizontal scroll strip of 8 icons
- [ ] Hitting each pill navigates correctly
- [ ] Dashboard shortcuts grid (after clicking Home) still contains Payments / Clients / Waitlist / Portfolio / Membership / Analytics

#### FE.Element-Verify.5 — Custom page variants
If Element uses a `custom` design template:

- [ ] Custom HTML still renders
- [ ] Business identity proof (address / phone / email / services) is visible somewhere on the custom page, not hidden behind a click
- [ ] SMS consent text is visible on the custom page (the `8f7bec3` fix)

### Step 3 — Owner independent check

Even after Codex greenlights FE.Element-Verify.1–.5, owner repeats the visit personally on:

- A real iPhone in incognito Safari
- A desktop Chrome window

The owner check exists because reviewers are humans with no context — their experience matches whatever a cold incognito visit looks like on a non-developer laptop. If the owner's independent incognito visit matches the checklist, we have high confidence.

### Step 4 — Resubmit CICHCOJ in Telnyx portal

Only after Steps 1, 2, and 3 are all green:

1. Open Telnyx portal → 10DLC → campaigns → CICHCOJ
2. Confirm in the submission form:
   - **Brand website / CTA URL:** `https://vurium.com/book/elementbarbershop` (per-workspace URL, NOT `https://vurium.com/book/`)
   - **messageFlow:** already built from per-workspace URL via `getWorkspaceBookingUrl()` (backend `e97efd9`) — should not need manual edit if submission is happening through our backend; if owner is submitting directly in the Telnyx portal UI, confirm manually
   - **sample1 / sample2:** format `Element Barbershop: Your appointment is confirmed...` — DBA prefix required
3. Hit Resubmit
4. Expected timeline: T-Mobile instant-24h, AT&T 1–3 business days, Verizon 1–3 business days (per internal research)

### Step 5 — Post-resubmit monitoring

- Record submission timestamp in a new DevLog entry
- If MNO replies with approval: update `docs/Features/SMS & 10DLC.md` Element campaign table from `Failed MNO Review` to `Pending MNO Review` → then `Active` when Telnyx webhook arrives
- If MNO replies with second failure: capture the new failure reasons verbatim, open a new `QA-Scan-*.md` entry, treat as a separate analysis task (do not hot-patch without understanding the new failure)

---

## Before resubmitting — complete every item below

Run this checklist top-to-bottom. Every item must pass before hitting resubmit in Telnyx portal.

---

## Part 1 — Element public booking page (live visual check)

Open `https://vurium.com/book/elementbarbershop` in browser (incognito, not logged in).

### 1.1 Business identity
- [ ] Shop name displayed = **exactly** `Element Barbershop` (matches registered DBA)
- [ ] Physical address visible (street, city, state, ZIP)
- [ ] Phone number visible
- [ ] Email address visible
- [ ] None of these fields are empty / "N/A"
- [ ] Page is public and no-login; reviewer does not hit auth walls, redirects, or app-only screens
- [ ] Page does not read like only a generic Vurium form; the business itself is clearly identifiable

### 1.2 Services visible
- [ ] At least 3–5 real services listed with names and prices (or "price varies")
- [ ] Services match what is actually offered at the shop
- [ ] No placeholder / demo services (e.g. "Test Service", "Service 1")

### 1.3 CTA wording contains DBA name
- [ ] The booking button / CTA text references **Element Barbershop** by name — NOT just "Book Now" without brand context
- [ ] Page title / `<title>` tag includes "Element Barbershop" (check browser tab)
- [ ] OG/meta description (if visible) references Element Barbershop

### 1.4 Consent / opt-in language
- [ ] SMS consent checkbox is present and visible before form submission
- [ ] Consent language is visible on first render, not hidden until after phone entry
- [ ] Consent text explicitly says SMS messages will come **from Element Barbershop** (not "Vurium" or "VuriumBook")
- [ ] Example consent wording: *"By checking this box, you agree to receive SMS appointment reminders from Element Barbershop. Message & data rates may apply. Reply STOP to opt out."*
- [ ] Links to Privacy Policy and Terms of Service present and working

### 1.5 Legal pages
- [ ] Privacy Policy URL works and loads (not 404)
- [ ] Privacy Policy mentions SMS communications and opt-out rights
- [ ] Privacy Policy includes the mobile-data no-sharing language needed for messaging compliance
- [ ] Terms of Service URL works and loads
- [ ] Both pages mention **Element Barbershop** (or parent company) as the entity — not just "VuriumBook Platform"
- [ ] Policy pages are public and stable enough to be used as submission artifacts, not temporary or app-only pages

### 1.6 Screenshot backup artifacts
- [ ] If the live flow still feels visually ambiguous, capture and host stable screenshots of:
  - the initial booking page with `Element Barbershop` visible
  - the visible SMS consent copy
  - the public Privacy / Terms links
  - the visible business details / services block
- [ ] Keep screenshot URLs stable and public enough to share in a support / appeal thread if Telnyx requests additional opt-in evidence

---

## Part 2 — Settings (owner must fill before resubmission)

Log in to VuriumBook as Element owner → Settings.

### 2.1 Business info
- [ ] `Shop name` = `Element Barbershop` (exact DBA match)
- [ ] `Shop address` = full address (street + city + state + ZIP)
- [ ] `Shop phone` = real business phone number
- [ ] `Shop email` = real business email
- [ ] If legal entity differs from DBA, legal-name / DBA mapping is written down exactly as it will appear in the campaign submission
- [ ] Address string is copied canonically; avoid casual reformatting / abbreviation drift between settings and submission

### 2.2 Services
- [ ] At least 5 real services added (name + price + duration)
- [ ] Services are published / visible on public page

### 2.3 SMS settings
- [ ] `sms_from_number` populated (Element's dedicated 10DLC TFN or local number)
- [ ] `sms_registration_status` = `active` or `pending_manual` (not `failed`)
- [ ] `sms_brand_name` = `Element Barbershop`

---

## Part 3 — Telnyx submission fields (before clicking resubmit)

Log in to Telnyx portal → 10DLC → Campaign CICHCOJ → Edit.

### 3.1 Brand fields
- [ ] **Brand legal name** = legal entity name (e.g. `Element Barbershop LLC`)
- [ ] **Brand DBA** = `Element Barbershop`
- [ ] **Brand website** = exact URL of the booking/business page that shows all the info from Part 1 above
- [ ] Website URL is publicly accessible (not login-gated, not localhost)

### 3.2 Campaign / message flow
- [ ] **Message Flow** field describes opt-in accurately:
  ```
  Customers provide their phone number and check an SMS consent checkbox on
  the Element Barbershop public booking page at [URL]. They receive
  appointment confirmation and reminder texts from Element Barbershop.
  ```
- [ ] Message Flow URL points to the actual booking page (not `https://vurium.com/book/` generic — must be the Element-specific URL)
- [ ] If both booking and waitlist SMS opt-ins exist, the message flow lists both methods instead of only one
- [ ] **Sample messages** use `Element Barbershop` as sender name, e.g.:
  ```
  Element Barbershop: Your appointment with [Barber] is confirmed for [Date] at [Time]. Reply STOP to opt out.
  Element Barbershop: Reminder — your appointment is tomorrow at [Time]. Reply STOP to unsubscribe.
  ```
- [ ] Sample messages do NOT start with "VuriumBook:" or any platform name
- [ ] Sample messages include opt-out language (`Reply STOP`)
- [ ] Help / opt-out wording used in production is consistent with the booking page disclosures
- [ ] If a support / appeal path is used instead of direct resubmission, include screenshot links as supplemental evidence rather than relying only on the text description

### 3.3 Use case
- [ ] Campaign use case = `2FA / One-Time Passwords` if sending OTPs, OR `Appointment Reminder` / `Customer Care` for reminders
- [ ] Use case matches actual message content

---

## Part 4 — Post-resubmission monitoring

After clicking resubmit in Telnyx:

- [ ] Note submission timestamp in `docs/DevLog/YYYY-MM-DD.md`
- [ ] Monitor `POST /api/webhooks/telnyx-10dlc` webhook → `sms_registration_status` update in Firestore
- [ ] Telnyx MNO review typically takes 3–7 business days
- [ ] If rejected again → check exact failure reason code and compare with this checklist

---

## Temporary fallback while review is pending

- [ ] Appointment messaging for Element stays on **transactional email fallback** while SMS approval is blocked
- [ ] Do not switch Element to a rushed shared sender or platform-wide fallback during this review cycle

---

## Failure reason reference

| Code | Meaning | Fix |
|---|---|---|
| Website insufficient | Brand page doesn't show enough about the company/products | Fill Part 1 + Part 2 completely |
| CTA missing DBA name | Booking page CTA doesn't reference the registered brand name | Fix consent text + button wording (Part 1.3) |
| 710 Reseller/KYC | Platform acting as agency across multiple brands | This is the platform-level issue — see `Platform-Sender-Pivot-Decision.md` |
| Sample message mismatch | Sample messages don't match actual traffic | Update sample messages in Telnyx portal to match real SMS content |
| Opt-in not documented | Can't prove customers consented to SMS | Screenshot opt-in flow, add to message flow description |
