# Attendance & Payroll

> Part of [[Home]] > Features | See also: [[API Routes]], [[Database Schema]]

## Attendance

### Feature toggle
- Owner enables in Settings > General > "Attendance & Clock-In"
- Saves `clock_in_enabled` to workspace settings
- When disabled, `/attendance` page shows disabled message
- `GET /api/settings/timezone` returns `clock_in_enabled` (accessible to all users)

### Geofence / Location
- Owner enters shop address in Settings > General
- "Set location from address" button geocodes via Nominatim (OpenStreetMap)
- Saves `geofence_lat`, `geofence_lng`, `geofence_radius_m` (default 500m)
- Clock-in rejected if user is outside radius: "You are too far (XXXm away, max XXXm)"
- If geofence not configured, clock-in allowed but `at_shop: false`

### Endpoints
- `GET /api/attendance` — list records, returns `{ attendance: [...] }`, filterable by `from`/`to`
- `GET /api/attendance/status` — current clock-in status, returns `clocked_in`, `today_minutes`, sums all today's records
- `POST /api/attendance/clock-in` — clock in with GPS, stores `at_shop`, `distance_meters`, prevents double clock-in (409)
- `POST /api/attendance/clock-out` — finds open record, calculates `duration_minutes`
- `POST /api/attendance/admin-clock-out` — admin force clock out, calculates `duration_minutes`
- All endpoints use workspace timezone for "today" (not UTC)

### Attendance record fields
```
user_id, user_name, barber_id, role, date,
clock_in, clock_out, duration_minutes,
lat, lng, at_shop, distance_meters,
auto_closed, admin_clock_out, admin_id
```

### Dashboard — Clock-In widget (`w_clockin`)
- Standard 2-col widget in iPhone-style home screen grid
- Visible only for admin/barber when `clock_in_enabled` is true
- Non-removable (locked — no minus button in edit mode)
- Tap to clock in (requests GPS), tap again to clock out
- States: "Clock In / Off / tap to start" → "On Shift / 2h 15m / Clock Out"
- Touch: `onTouchStart` cancels jiggle timer for reliable mobile taps

### State persistence (localStorage)
- `VB_CLOCK_STATE`: `{ clockedIn, clockInTime, todayMinutes, date }` — instant restore on app reopen
- `VB_CLOCK_IN_ENABLED`: feature toggle — widget shows immediately before API fetch
- `loadAll` syncs localStorage with server state every 30s

### On Duty widget (`team-on-duty`)
- Shows staff currently clocked in (owner/admin dashboard)
- Deduplicated by `user_id` — shows only latest clock-in per person
- Displays name, clock-in time, elapsed minutes

### Payroll integration
- Payroll page fetches attendance records and sums `duration_minutes` per barber
- Admin hourly pay: `base_pay = hourly_rate * hours_worked`
- Late minutes calculated from clock-in time vs barber schedule (2-min grace)

## Payroll

### Endpoints
- `GET /api/payroll` — payroll data grouped by barber (includes all active barbers)
- `GET /api/payroll/audit` — smart audit with 7 cross-reference checks
- `GET /api/payroll/audit/status` — last audit result for badge
- `GET /api/payroll/rules` — commission & admin payroll rules
- `POST /api/payroll/rules/:id` — update rules for barber or admin
- `POST /api/payroll/backfill-tips` — backfill tip data
- `POST /api/payroll/sync-tips-from-square` — sync tips from Square POS

### Barber pay formula
```
barber_service_share = net_service_amount * effective_rate%
barber_tips = tips * tips_pct%
barber_total = barber_service_share + barber_tips
```
- `net_service_amount` = base price without tax/fees (stored as `service_amount`)
- `effective_rate` = base_pct or highest matching tier threshold
- Default: 60% services, 100% tips
- Configurable: base_pct, tips_pct, bonus tiers, custom bonuses, late penalty

### Admin pay formula
```
base_pay = hourly_rate * hours_worked
profit_share = owner_share * profit_pct * (days_worked / period_days)
fee_share = terminal_services * fee_pct (if worked any days)
admin_total = base_pay + profit_share + fee_share
```
- Profit share proportional to days actually worked
- Fee share only on days with attendance
- Admin schedule editable in Commission Rules modal
- Default: $0/hr, 2% profit, 3% fee

### Owner net profit
```
owner_share = gross_services - team_total
owner_net = owner_share - admin_pay - expenses
```

### Smart Audit (7 checks)
1. **Unpaid bookings** — completed services not paid (skips blocks, pending, $0)
2. **Booking-Payment match** — paid bookings vs payment_requests records
3. **Cash reconciliation** — expected cash vs counted (cash reports)
4. **Admin attendance** — hours logged, warns if rate set but 0 hours
5. **Period totals** — services, tips, count, expenses summary
6. **Missing amounts** — paid bookings without service_amount
7. **Square verification** — compares linked card payments with Square API

### Automatic audit
- Background job every 6 hours (throttle persisted in Firestore)
- Anti-spam: only notifies when warnings change (hash comparison)
- Push notification to owner only
- Email to owner only (Resend, dark-cosmos template)
- Red badge on Payroll icon in Dashboard

## Cash Reports
- `GET /api/cash-reports` — list cash reports
- `POST /api/cash-reports` — create cash report
- `/cash` — cash register page with day-by-day breakdown
- KPI cards: Cash, Zelle, Counted, Diff
- Day rows show compact inline amounts

## Expenses
- `GET /api/expenses` — list (filterable by from/to)
- `GET /api/expenses/total` — total + by_category breakdown
- `GET /api/expenses/categories` — category list
- `POST /api/expenses` — create expense
- `PATCH /api/expenses/:id` — update
- `DELETE /api/expenses/:id` — delete
- Integrated with payroll: deducted from owner net profit

## Frontend
- `/attendance` — attendance tracking, clock in/out
- `/payroll` — KPI strip, team table, audit panel, commission rules modal
- `/cash` — daily cash register
- `/expenses` — expense management with category breakdown
