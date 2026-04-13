# Booking System

> Part of [[Home]] > Features | See also: [[Payments]], [[Client Management]], [[API Routes]], [[Database Schema]]

## Overview
Core feature — public-facing booking page for clients + admin management.

## Public Booking Flow
1. Client opens `/book/{slug}` (resolved via `GET /public/resolve/:slugOrId`)
2. Loads workspace config, services, barbers
3. Selects service → barber → time slot
4. Availability calculated via `POST /public/availability/:workspace_id`
5. Booking created via `POST /public/bookings/:workspace_id`
6. Group bookings: `POST /public/bookings-group/:workspace_id`

## Booking Management (Public)
- `GET /public/manage-booking` — view booking details
- `POST /public/manage-booking/cancel` — cancel
- `POST /public/manage-booking/reschedule` — reschedule

## Admin Endpoints
- `GET /api/bookings` — list all bookings
- `POST /api/bookings` — create booking (admin)
- `PATCH /api/bookings/:id` — update
- `DELETE /api/bookings/:id` — delete
- `GET /api/bookings/:id/photo` — booking photo

## Availability
- `POST /api/availability` — internal availability check
- Considers barber schedules, existing bookings, schedule overrides

## Related Pages
- `/book/[id]` — public booking page (App Router)
- `/calendar` — admin calendar view
- `/history` — booking history
- `/manage-booking` — client self-service

## Custom Code Template Engine (Custom plan)
- Users write custom HTML/CSS in Settings > Site Builder > Custom Code
- Template variables: `{{#each barbers}}`, `{{#each reviews}}`, `{{shop_name}}`, `{{barber_count}}`
- Inside barber loop: `{{name}}`, `{{photo_url}}`, `{{level}}`, `{{id}}`, `{{initials}}`
- Inside review loop: `{{reviewer_name}}`, `{{rating}}`, `{{stars}}`, `{{review_text}}`
- Interactive: `data-action="book"` + `data-barber-id="{{id}}"` triggers React booking flow
- "Custom" design template hides all default sections, shows only custom code
- All values HTML-escaped; scripts stripped by backend sanitizer

## Reference Photo Upload
- Client can attach a reference photo (style they want) during booking
- Compressed to JPEG (max 1200px, ~500KB) on frontend
- Stored as `reference_photo` + `reference_photo_url` on booking document
- Visible in calendar view (photo icon on event)

## SMS Consent & Compliance
- Checkbox: unchecked by default, optional (not required to book)
- Text includes: message types, frequency, rates, STOP/HELP, Privacy/Terms links
- Public booking: SMS only sent if `sms_consent === true`
- Admin booking: SMS sent unless client opted out via STOP
- Backend checks `sms_opt_out` before every SMS send
- All outgoing SMS include: brand ID, STOP/HELP, "Msg & data rates may apply"
- STOP/HELP webhook handles: STOP, UNSUBSCRIBE, CANCEL, END, QUIT, HELP, INFO
- Consent stored with: timestamp, IP, user agent, booking ID
- Footer disclosure visible on all booking pages without navigating flow

## Design Templates
- `modern` (default), `classic`, `bold`, `dark-luxury`, `colorful`, `custom`
- Individual plan: forced to `modern`
- Salon/Custom plans: selectable in Settings > Site Builder
- `custom` template: hides default sections, full custom HTML/CSS control

## Smart Booking Audit (`runBookingAudit()`)
Background job running every 4 hours scanning all workspaces for anomalies.

**Health Checks:** double bookings, ghost barbers, stale statuses (auto-fixed to noshow), missing client data, orphaned bookings on expired plans, schedule violations, cancellation spikes, repeat no-show patterns.

**Auto-fix:** past bookings still in `booked` status automatically changed to `noshow` (adds `auto_noshow: true` flag).

**Ghost barber alerts:** SMS + email to client with reschedule/rebook links. Dedup via `ghost_barber_notified` flag.

**Notifications:** critical issues → `support@vurium.com` digest. Owner gets push + email. In-app badge via `settings/booking_audit`.

- `GET /api/booking-audit/status` — returns last audit results
- `GET /api/admin/debug-booking/:id` — debug specific booking

## Smart Recommendations
When a public booking fails, the API returns a `recommendation` object with:
- `alternative_slots` — next 3 available slots for the same barber
- `alternative_barbers` — up to 3 other barbers with their nearest open slot

Applies to: `409 Conflict`, `400 Outside Schedule`, `404 Barber Not Found` on both booking creation and reschedule endpoints.

## Client Satisfaction Ping
After booking status → `done`/`completed`:
- **Email immediately** — "How was your visit?" with star icons + "Leave a Google Review" button
- **SMS 2 hours later** — review link (via `sms_reminders` with `type: 'satisfaction'`)
- Requires `google_review_url` in workspace settings
- Toggle: `satisfaction_sms_enabled` setting

## Waitlist Auto-Fill
When a booking is cancelled (any path):
1. Checks if slot is future and actually free
2. Queries `waitlist` for matching barber + date + time preference
3. Notifies first matching client via SMS + email ("A spot just opened up!")
4. Marks waitlist entry as `notified: true, auto_fill: true`

## Booking Rate Limiter
- Max 3 bookings per phone/email per hour per workspace
- In-memory sliding window, returns `429`
- Applied to single + group booking endpoints
- Auto-cleanup every 10 minutes
