# Element Barbershop — 10DLC Resubmission Checklist

> [[Home]] > Tasks | Owner: Verdent (verification doc)
> Related: [[Tasks/SMS-Strategy-Review|SMS Strategy Review]], [[Tasks/Platform-Sender-Pivot-Decision|Platform Sender Pivot]], [[Tasks/Telnyx-Integration-Plan|Telnyx Integration Plan]], [[Tasks/US-A2P-CTA-Brand-Verification-Notes|US A2P CTA & Brand Verification Notes]], [[Tasks/Temporary-Reminder-Delivery-Options|Temporary Reminder Delivery Options]]
> Created: 2026-04-15
> Context: Campaign CICHCOJ failed MNO review with two reasons:
> 1. "Brand website lacking sufficient information about the company and its products"
> 2. "Call-to-action does not contain registered/DBA brand name"

---

## 🔴 Live verification — 2026-04-15 (BLOCKER found)

Перевірено owner'ом в incognito на публічній booking сторінці Element:

| Перевірка | Результат |
|---|---|
| Consent текст | ✅ Є і правильний — містить `Element Barbershop`, STOP, HELP, Terms/Privacy |
| Адреса, телефон, email | ❌ **Не видно** — відсутні на сторінці |
| Business details секція | ❌ **Не рендериться** або поля порожні |
| Consent видимий без вводу | 🟡 **AI 2 patch shipped in `b74c79b`; re-check live after deploy** |

### Що треба виправити перед resubmission

**Blocker 1 — live re-check after latest frontend patches:**
- Business details must be visible on initial page load whenever Element has saved `shop_address`, `shop_phone`, `shop_email`
- Consent text must be visible on initial page load together with the form, without waiting for phone entry
- The page does **not** need to move those details into the header specifically; it just needs them to be clearly visible to a reviewer without extra interaction

**Blocker 2 — Owner:**
- Перевірити чи `shop_address`, `shop_phone`, `shop_email` збережені в Element Settings (натиснути Save після заповнення)
- Якщо поля порожні в Firestore — business details не покажуться навіть після frontend fix

### Статус resubmission

🔴 **НЕ resubmit поки обидва blocker'и не закриті.** Telnyx reviewer бачить порожню сторінку без контактів.

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
