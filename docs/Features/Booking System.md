# Booking System

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

## Audit
- `GET /api/booking-audit/status` — booking audit status
- `GET /api/admin/debug-booking/:id` — debug specific booking
