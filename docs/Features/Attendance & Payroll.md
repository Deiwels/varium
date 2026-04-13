# Attendance & Payroll

## Attendance
- `GET /api/attendance` — list records (filterable by from/to)
- `GET /api/attendance/status` — current clock-in status
- `POST /api/attendance/clock-in` — clock in (optional geofence validation)
- `POST /api/attendance/clock-out` — clock out
- `POST /api/attendance/admin-clock-out` — admin force clock out another user
- Clock-in widget on Dashboard (admin/barber, when enabled in Settings)
- Settings: shop address, geocode, geofence radius

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
