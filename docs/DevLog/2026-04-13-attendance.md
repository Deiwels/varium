# 2026-04-13 — Attendance & Clock-In System

> [[Home]] > DevLog | Related: [[Attendance & Payroll]], [[App Routes]], [[API Routes]]

## Done

### Settings — Attendance toggle + geofence config
- Added "Attendance & Clock-In" section to Settings > General (owner only)
- Toggle: `clock_in_enabled` — enables/disables clock-in for the workspace
- Shop address field with "Set location from address" button (geocodes via Nominatim)
- Geofence radius input (default 500m)
- Saves `geofence_lat`, `geofence_lng`, `geofence_radius_m` to settings

### Dashboard — Clock-In widget
- New `w_clockin` widget in iPhone-style home screen grid
- Standard 2-col small widget, same size/style as Earnings, No-shows
- Non-removable (no minus button in jiggle/edit mode)
- Shows only for admin/barber when `clock_in_enabled` is true, hidden for owner
- States: "Clock In" / "Off" / "tap to start" when not on shift
- States: "On Shift" / "2h 15m" / "Clock Out" (red) when clocked in
- Tap triggers clock-in (with GPS) or clock-out
- Touch events: `onTouchStart` stops propagation + cancels jiggle timer for reliable mobile taps

### Clock state persistence (localStorage)
- `VB_CLOCK_STATE`: persists `clockedIn`, `clockInTime`, `todayMinutes`
- `VB_CLOCK_IN_ENABLED`: persists the feature toggle
- On mount: restores immediately before API fetch — widget shows "On Shift" instantly
- On `loadAll`: syncs localStorage with server state
- On clock-out: clears localStorage

### Backend — `/api/settings/timezone` returns `clock_in_enabled`
- All users (including barbers) can see if clock-in is enabled
- Previously barbers couldn't access `/api/settings` (owner/admin only)

### Backend — Attendance endpoint fixes
- `GET /api/attendance`: returns `{ attendance: [...] }` (was flat array), added `from`/`to` date filtering
- `POST /api/attendance/clock-in`: stores `at_shop`, `distance_meters`, prevents double clock-in (409)
- `POST /api/attendance/clock-out`: calculates `duration_minutes`, finds the open record
- `POST /api/attendance/admin-clock-out`: calculates `duration_minutes`
- `GET /api/attendance/status`: sums all today's records, returns `today_minutes`
- All endpoints use workspace timezone (not UTC) for "today" calculation

### Attendance page — disabled state
- Shows message when `clock_in_enabled` is false
- Owner sees: "Go to Settings > General to enable"
- Staff sees: "Ask the salon owner to enable the attendance feature"

### On Duty widget — deduplication
- Staff on clock list deduplicated by `user_id` (was showing same person multiple times)
- Keeps latest `clock_in` per user

### Error handling
- Clock errors auto-clear after 6 seconds
- Geofence rejection shows distance: "You are too far (XXXm away, max XXXm)"

## Commits
- `05d1e8c` feat: show disabled state on attendance page when clock-in not enabled
- `35ce2d3` feat: clock-in widget on dashboard for staff/admin
- `2c9628a` fix: clock-in widget uses same size/style as other widgets
- `cc67500` fix: attendance backend — geofence, duration, date filtering
- `82d5835` fix: attendance — prevent duplicates, fix status/clock-out queries
- `7a42b2a` fix: clock-in widget shows clear Clock Out label when on shift
- `ee8dcec` fix: clock-in widget tap reliably on mobile
- `a8df1d3` fix: use workspace timezone for attendance date calculations
- `d1be490` fix: persist clock-in state to localStorage for instant restore
- `c88c330` fix: instant clock-in restore — persist clock_in_enabled + remove date check
