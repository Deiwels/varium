# Memberships

> Part of [[Home]] > Features | See also: [[Booking System]], [[Calendar & Scheduling]], [[Payments]]

## Overview
Recurring membership plans for clients. Automatically generates bookings based on frequency. Available on Salon+ plans.

## Plan Gating
- `individual` plan: NO membership feature
- `salon` plan: membership feature included
- `custom` plan: membership feature included
- Trial: full access (custom plan equivalent)
- Backend: `requirePlanFeature('membership')` middleware
- Frontend: `FeatureGate` component with `hasFeature('membership')`

## Frontend
- `/membership` page — manage all memberships
- Status tabs: active, paused, cancelled
- Modal form: create/edit membership
- Client search by phone number
- Multi-select service picker (filtered by barber)
- Frequency: Weekly, Biweekly, Monthly
- Preferred day-of-week and time selection
- Discount picker: 0%, 5%, 10%, 15%, 20%
- Real-time price calculation (services total minus discount)
- Actions: edit, pause/resume, cancel, delete

### Dashboard Integration
- Membership widget on dashboard (configurable via `dash_membership` setting)
- Calendar shows "Member" chip on membership-sourced bookings

## Data Model

```
{
  client_name, client_id, client_phone,
  barber_id, barber_name,
  service_id (string | string[]),   // supports multiple services
  service_name,
  frequency: 'weekly' | 'biweekly' | 'monthly',
  preferred_day: 0-6,               // Sunday-Saturday
  preferred_time_min: number,        // minutes from midnight
  duration_minutes,
  amount_cents,                      // total minus discount
  discount_pct: 0-100,
  status: 'active' | 'paused' | 'cancelled',
  next_booking_at,
  last_booking_at,
  charge_count,                      // bookings created
  created_at, updated_at
}
```

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/memberships` | List all memberships |
| POST | `/api/memberships` | Create membership (owner/admin) |
| PATCH | `/api/memberships/:id` | Update membership (owner/admin) |
| DELETE | `/api/memberships/:id` | Cancel + remove future bookings |

## Automated Booking Generation (`runAutoMemberships`)
- Background job runs every 5 minutes (throttled)
- Scans all workspaces for active memberships
- Creates bookings up to 8 weeks in advance
- Up to 20 bookings per membership per run
- Respects barber availability (transactional conflict checking)
- Bookings tagged with `source: 'membership'` and `membership_id`
- Bookings start as `paid: false`

## Firestore
- Collection: `workspaces/{wsId}/memberships`
- Settings: `membership_enabled`, `dash_membership`
- Related bookings have `source: 'membership'`
