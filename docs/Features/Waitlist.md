# Waitlist

> Part of [[Home]] > Features | See also: [[Booking System]], [[Client Management]], [[API Routes]], [[Database Schema]]

## Overview
Waitlist allows clients to queue for appointments when preferred time slots are unavailable. Available on **Salon** and **Custom** plans. Clients join via the public booking page; staff manages entries from the admin waitlist page and calendar.

## Public Waitlist Flow
1. Client opens `/book/{slug}`, selects barber → services → date
2. If no slots available: **"Join waitlist — get notified when a slot opens"**
3. If slots exist but client wants different time: **"Need a different time? Join the waitlist"**
4. Client fills form (same fields as regular booking):
   - Name (required)
   - Email (required)
   - Phone (required) + SMS consent
   - Notes (optional)
   - Reference photo (optional, compressed JPEG ≤500KB)
   - Preferred time range (7:00 AM – 9:00 PM, 30-min steps)
5. Submitted via `POST /public/waitlist/:workspace_id`
6. Confirmation email sent (styled per workspace template)
7. Deduplication: same email + barber + date → returns existing entry

## Email Notifications (Styled per Template)
All emails use `vuriumEmailTemplate()` with workspace template (modern, classic, bold, dark-luxury, colorful).

### Confirmation Email
- Sent immediately when client joins waitlist
- Subject: `You're on the waitlist – {Shop Name}`
- Shows: date, preferred time range, service, duration
- From: `{Shop Name} <noreply@vurium.com>`

### Slot Available Email
- Sent when "Check & Notify" finds matching open slot
- Subject: `A spot opened up – {Shop Name}`
- Shows: date, time, barber, service + **"Book Now"** button
- Also sends SMS if phone provided (respects opt-out)

## Admin Waitlist Page (`/waitlist`)
- Feature-gated: `requirePlanFeature('waitlist')` — Salon/Custom only
- Add to waitlist form: phone search → existing client or new entry
- Barber filter pills (owner/admin sees all, barber sees own)
- Each entry shows: client name, barber, date, duration, preferred time range, phone, services
- Actions: Confirm (book) / Remove (✕)
- "Check & notify" button: scans for open slots matching waitlisted clients
- Auto-refresh every 30 seconds

## Calendar Integration
- **Ghost pulse blocks** (`wl-ghost-pulse` CSS animation) appear on calendar when a waitlisted client has a matching free slot within their preferred time range
- Finds first free slot in `preferred_start_min` – `preferred_end_min` window
- Shows: client name, slot time, duration, preferred range
- Click to open confirm modal → creates booking + removes from waitlist
- Phone + call button in confirm modal (permission-gated)

## Role Permissions (`waitlist` category)

| Permission | Owner | Admin | Barber | Guest | Student |
|---|---|---|---|---|---|
| `view_ghost` — see waitlist ghost blocks on calendar | always | ✓ | ✓ | ✗ | ✗ |
| `confirm` — confirm/book/remove from waitlist | always | ✓ | ✗ | ✗ | ✗ |
| `view_phone` — see waitlist client phone | always | ✓ | ✗ | ✗ | ✗ |
| `call_client` — call waitlist client | always | ✓ | ✗ | ✗ | ✗ |

Configurable in Settings → Permissions → Waitlist.

## API Endpoints

### Authenticated (require `waitlist` plan feature)
- `GET /api/waitlist` — list non-notified entries (query: `date`, `barber_id`)
- `POST /api/waitlist` — add entry (staff)
- `PATCH /api/waitlist/:id` — confirm or remove (`action: 'confirm'` | `'remove'`)
- `GET /api/admin/waitlist/check` — scan for open slots, notify clients (owner/admin)

### Public (no auth)
- `POST /public/waitlist/:workspace_id` — client self-join

## Firestore Schema (`workspaces/{id}/waitlist/{entryId}`)
```
email: string | null
phone_norm: string | null
phone_raw: string | null
client_name: string | null
barber_id: string
barber_name: string
date: 'YYYY-MM-DD'
service_ids: string[]
service_names: string[]
duration_minutes: number
preferred_start_min: number (minutes from midnight, 0–1440)
preferred_end_min: number (minutes from midnight, 0–1440)
customer_note: string | null
sms_consent: boolean
reference_photo: { data_url: string, file_name: string } | null
notified: boolean
confirmed: boolean (optional)
removed: boolean (optional)
notified_at: ISO string (optional)
notified_slot: ISO string (optional)
created_at: ISO string
```

## Plan Gating
- `waitlist` feature included in: `salon`, `custom` plans
- NOT available on `individual` plan
- During trial (`billing_status: 'trialing'`): full access (custom plan)
- Public resolve endpoint returns `waitlist_enabled: true/false` based on effective plan

## Related Files
- `app/book/[id]/page.tsx` — public booking page with waitlist form
- `app/waitlist/page.tsx` — admin waitlist management
- `app/calendar/page.tsx` — calendar ghost blocks + confirm modal
- `app/settings/page.tsx` — permissions tab (waitlist category)
- `components/PermissionsProvider.tsx` — waitlist permission defaults
- `backend/index.js` — all API endpoints + email sending
