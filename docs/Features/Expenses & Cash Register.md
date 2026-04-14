# Expenses & Cash Register

> Part of [[Home]] > Features | See also: [[Attendance & Payroll]], [[API Routes]], [[Payments]]

## Plan Gating
- Expenses: `feature: 'expenses'` — custom plan only
- Cash register: part of payroll feature set

## Expenses

### Overview
Business expense tracking with categories, date filtering, and aggregation.

### Frontend
- `/expenses` page — expense list with category management and charts
- Plan-gated in Shell nav (`feature: 'expenses'`)

### Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/expenses` | List expenses (filterable by `from`/`to`) |
| POST | `/api/expenses` | Create expense |
| PATCH | `/api/expenses/:id` | Update expense |
| DELETE | `/api/expenses/:id` | Delete expense |
| GET | `/api/expenses/categories` | List expense categories |
| POST | `/api/expenses/categories` | Create category |
| GET | `/api/expenses/total` | Total by category and date range |

### Payroll Integration
- Expenses reduce owner net profit:
  ```
  owner_net = owner_share - admin_pay - expenses
  ```

## Cash Register

### Overview
Daily cash drawer reports and reconciliation.

### Frontend
- `/cash` page — daily cash reconciliation with date picker

### Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/cash-reports` | List cash reports (last 60 days) |
| POST | `/api/cash-reports` | Create report (date, amount, notes) |

### Payroll Audit Integration
- `runPayrollAudit()` checks cash reconciliation against booking payments
- Detects mismatches between cash reports and cash bookings
