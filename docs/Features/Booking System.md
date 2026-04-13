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

## Audit
- `GET /api/booking-audit/status` — booking audit status
- `GET /api/admin/debug-booking/:id` — debug specific booking
