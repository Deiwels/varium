# Calendar & Scheduling

> Part of [[Home]] > Features | See also: [[Booking System]], [[Attendance & Payroll]], [[API Routes]]

## Overview
Interactive calendar for managing bookings, barber schedules, and time blocks. Main daily tool for salon owners and staff.

## Frontend
- `/calendar` page — full-width grid calendar with barber columns
- Drag-and-drop to reschedule bookings or reassign barbers
- Block time management (time off, training)
- Settings modal for team schedules and services
- Waitlist auto-fill integration
- Mobile responsive with pinch-zoom
- Student view with mentor approval workflow
- Long-press context menus

### Booking Modal (`booking-modal.tsx`)
- Create/edit bookings from calendar
- Price calculation with taxes and fees
- SMS consent collection
- Payment method selection
- Primary + addon service selection

## Schedule Data Model

### Barber Schedule
```
schedule: {
  startMin: 480,        // 8:00 AM (minutes from midnight)
  endMin: 1200,         // 8:00 PM
  days: [1,2,3,4,5],   // Mon-Fri
  perDay: [             // per-day overrides (Sun=0 ... Sat=6)
    { enabled: false },
    { enabled: true, startMin: 540, endMin: 1080 },
    ...
  ]
}
```

### Schedule Overrides
```
schedule_overrides: {
  "2026-04-15": { enabled: false },              // day off
  "2026-04-20": { enabled: true, startMin: 600, endMin: 900 }  // short day
}
```
- Date-specific working hours changes
- Auto-cleanup after 30 days
- `PATCH /api/barbers/:id/schedule-override`

## Availability Logic
1. Check `schedule_overrides` for the specific date
2. Fall back to `perDay[]` schedule for that weekday
3. Fall back to global `startMin`/`endMin` + `days[]`
4. Generate time slots (30-min step default)
5. Filter out slots conflicting with existing bookings
6. Timezone-aware (workspace timezone from settings)

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/availability` | Authenticated availability check |
| POST | `/public/availability/:wsId` | Public availability for booking page |
| PATCH | `/api/barbers/:id/schedule-override` | Create/modify/remove overrides |
| GET | `/api/barbers` | List barbers with schedules |
| PATCH | `/api/barbers/:id` | Update barber schedule |

## Settings
- `timezone` — workspace timezone (default: America/Chicago)
- `booking_buffer_minutes` — buffer between bookings
- `default_duration_minutes` — default appointment length
- `online_booking_enabled` — public booking toggle
- `dash_calendar` — dashboard calendar widget

## Key Backend Functions
- `normalizeSchedule()` — standardize schedule format
- `getScheduleForDate()` — resolve schedule for a date (overrides > perDay > global)
- `buildSlotsForDay()` — generate available time slots
- `buildSmartSlotsForDay()` — slots with adjacency recommendations
- `filterSlotsAgainstBusy()` — remove conflicting slots
- `getBusyIntervalsForBarber()` — fetch all non-cancelled bookings
- `ensureWithinSchedule()` — validate booking time (throws OUTSIDE_SCHEDULE)

## SMS Reminders
- `scheduleReminders()` — creates 24h and 2h SMS reminders before appointment
- Stored in `sms_reminders` collection with type `24h` or `2h`
