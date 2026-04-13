# 2026-04-13 — Custom Code Engine + SMS Compliance + Booking Fixes

> [[Home]] > DevLog | Related: [[Booking System]], [[Developer Panel]]

## Custom Code Template Engine

### Template Variables for Custom HTML
- New `processCustomHTML()` function in booking page
- Supports Handlebars-like syntax: `{{#each barbers}}...{{/each}}`, `{{#each reviews}}...{{/each}}`
- Simple variables: `{{shop_name}}`, `{{barber_count}}`
- Barber loop variables: `{{name}}`, `{{photo_url}}`, `{{level}}`, `{{id}}`, `{{initials}}`
- Review loop variables: `{{reviewer_name}}`, `{{rating}}`, `{{stars}}`, `{{review_text}}`
- All values HTML-escaped for XSS prevention

### Interactive Data Attributes
- `data-action="book"` on any element inside custom HTML triggers React booking flow
- `data-barber-id="{{id}}"` pre-selects specific barber
- Event delegation via `handleCustomBlockClick()` — no JS injection needed

### "Custom" Design Template
- New template option in Settings > Site Builder > Design Template
- When selected: hides ALL default sections (hero, about, team, reviews, Book Now)
- Shows ONLY custom HTML/CSS — full creative control
- `maxWidth` increased to 1200px (vs 700px for other templates)
- Dark theme: `bg: #000`, `text: #e9e9e9`, `accent: #0a84ff`

### Settings Page Updated
- Custom HTML placeholder shows `{{#each barbers}}` example
- Template Variables documentation section with all available vars
- CSS placeholder updated with glassmorphic example

### Files Changed
- `app/book/[id]/page.tsx` — template engine, click handler, custom template
- `app/settings/page.tsx` — Custom template option, variable docs
- Backend sanitization verified: `data-*` attributes and `{{}}` syntax pass through

---

## SMS Compliance (Telnyx MNO Review)

### Problem
Telnyx MNO review failed with code 806: "Unable to verify CTA" — reviewer couldn't confirm opt-in flow on booking page.

### Root Causes Found & Fixed

#### Frontend (app/book/[id]/page.tsx)
1. **Consent checkbox always visible** — removed `{clientPhone && (...)}` wrapper
2. **Consent NOT required to book** — removed `!smsConsent` from button disabled condition AND from `handleBook()`/`handlePayOnlineFlow()` validation (was blocking booking without consent — TCPA violation: consent cannot be condition of purchase)
3. **Checkbox text updated** to A2P standard:
   - "I agree to receive SMS messages from Vurium, including appointment confirmations, reminders, and booking updates."
   - "Message frequency varies. Message and data rates may apply."
   - "Reply STOP to unsubscribe or HELP for help."
   - Links: "SMS Privacy Policy" and "SMS Terms"
   - OTP removed from consent (transactional, doesn't need marketing consent)
4. **Disclosure under phone field**: "You will only receive SMS messages if you explicitly opt in by checking the consent box below."
5. **Warning when unchecked**: "SMS notifications are optional and used for appointment confirmations and reminders."
6. **Footer SMS disclosure** (visible on all pages without navigating booking flow):
   - "Msg & data rates may apply. Msg frequency: up to 5 per booking. Reply STOP to unsubscribe, HELP for help."
   - "Privacy Policy & Terms" on separate line, underlined, clickable

#### Backend (backend/index.js)
1. **Receipt SMS** — added opt-out check before sending + STOP/HELP footer (was missing both)
2. **Verification SMS** — added opt-out check + rate limit (max 3 per 10 minutes per phone)
3. **HELP auto-response** — added STOP instruction + "Msg & data rates may apply"
4. **"Msg & data rates may apply"** added to ALL SMS types:
   - Reminders (24h + 2h)
   - Cancellation notifications
   - Waitlist notifications
   - OTP/verification codes
   - Receipt SMS
5. All SMS paths now check `sms_opt_out` before sending

#### Privacy Policy (app/privacy/page.tsx)
- Added `id="sms"` anchor for direct linking
- Added opening line: "We collect and use phone numbers to send appointment-related SMS messages"
- Already had: non-sharing statement, frequency, rates, STOP/HELP

#### Terms (app/terms/page.tsx)
- Added `id="sms"` anchor for direct linking
- Already had: program description, STOP/HELP, frequency, rates, consent not required

### Telnyx Campaign Updates Needed (manual)
- Update Message flow text with new consent wording
- Update Compliance links: `https://vurium.com/privacy#sms` and `https://vurium.com/terms#sms`
- Set Embedded Link = Yes, embedded link = `https://vurium.com/privacy`
- Provide screenshots of booking flow for MNO reviewer

---

## Reference Photo Upload

### Frontend
- New state: `referencePhoto: { dataUrl: string; name: string }`
- File input after Notes field with compression (max 1200px width, JPEG quality 0.75, max 500KB)
- Preview with delete button
- Photo name appended to customer_note
- Sent as `reference_photo: { data_url, file_name }` in booking payload

### Backend
- Validates: must be `data:image/*`, max 800KB
- Stores `reference_photo` object + `reference_photo_url` (top-level field for calendar display)
- Calendar page already reads `reference_photo_url` — photo icon shows on booking events

---

## Availability Slot Fix
- Bug: slots outside barber working hours were shown (e.g., 7:30 AM when barber starts at 9:00)
- Fix: added explicit `workStart`/`workEnd` UTC check on each generated slot in availability endpoint
- Also skip days where `sch.works === false`
- Frontend: if booking returns "outside working hours", clears slot and returns to time picker with friendly message

## Hero Image Fix
- Bug: hero image not saving — `hero_media_url` was not in `ALLOWED_SETTINGS` (only `hero_url` was)
- Fix: added `hero_media_url` to allowed settings
- Booking page: fallback to `siteConfig.hero_image` if `config.hero_media_url` is empty
