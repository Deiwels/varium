# Background Jobs

> Part of [[Home]] > Architecture | See also: [[Booking System]], [[Memberships]], [[Attendance & Payroll]], [[Security & Audit]]

## Overview
6 background jobs run automatically every 3 minutes via `setInterval` in `backend/index.js`. Each job has internal throttling to avoid running too frequently.

## Jobs

### 1. `runAutoReminders()`
- **Frequency**: Every run (3 min)
- **What**: Sends scheduled SMS reminders from `sms_reminders` collection
- **Types**: 24-hour reminder, 2-hour reminder, satisfaction ping
- **Logic**: Queries unsent reminders where `send_at <= now`, sends via Telnyx, marks `sent: true`
- **Respects**: SMS opt-out (`sms_opt_out` flag on client)
- **Limit**: 100 workspaces per run (known scalability issue — see [[Tasks/QA-Scan-2026-04-13|QA Scan]])

### 2. `runAutoMemberships()`
- **Frequency**: Every 5 min (internal throttle)
- **What**: Auto-books recurring membership appointments
- **Logic**: Scans active memberships → creates bookings up to 8 weeks ahead → max 20 per membership per run
- **Respects**: Barber availability (transactional conflict check)
- **Tags**: Bookings with `source: 'membership'`, `membership_id`

### 3. `runBookingAudit()`
- **Frequency**: Every 4 hours
- **What**: Scans all workspaces for booking anomalies
- **Checks**: Double bookings, ghost barbers, stale statuses, missing data, orphaned bookings, schedule violations, cancellation spikes, no-show patterns
- **Auto-fix**: Past bookings in `booked` status → changed to `noshow` (adds `auto_noshow: true`)
- **Alerts**: SMS + email to affected clients for ghost barbers
- **Notifications**: Critical issues → `support@vurium.com` digest

### 4. `runPayrollAudit()`
- **Frequency**: Daily (internal throttle)
- **What**: Detects payroll inconsistencies
- **Checks**: Unpaid bookings, cash reconciliation mismatches, card payment mismatches
- **Notifications**: Email to owner with warnings

### 5. `runRetentionCleanup()`
- **Frequency**: Daily (internal throttle)
- **What**: Deletes bookings older than 2 years
- **Purpose**: Data retention compliance + performance

### 6. `resetSecurityCounters()`
- **Frequency**: Every 3 min
- **What**: Clears brute force login attempt counters
- **Purpose**: Prevent counter overflow, allow legitimate users to retry

## Health Checks

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Service health (version, uptime, memory) |
| GET | `/health/db` | Firestore connectivity check |

## AI Diagnostics (Developer Panel)
- Claude Sonnet 4 analyzes platform health metrics
- Auto-runs every 30 minutes + manual trigger
- Endpoints: `GET/POST /api/vurium-dev/ai/scan`, `GET /api/vurium-dev/ai/scans`
- Keeps last 50 scans, detects stuck scans (>5 min)
