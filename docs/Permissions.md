# Role Permissions

> [[Home]] > Features | Related: [[Developer Panel]], [[Client Management]], [[Payments]]

## Overview

Granular role-based permissions system. Owner configures what each role can see and do via **Settings > Permissions**. Permissions are stored per-workspace in Firestore and enforced on both frontend (UI visibility) and backend (API access).

## Roles

| Role | Description | Default home |
|------|-------------|-------------|
| **Owner** | Full access to everything. Cannot be restricted. | Dashboard |
| **Admin** | Manager. Configurable access to all features. | Dashboard |
| **Team Member** (barber) | Staff/master. Limited by default, expandable. | Calendar |
| **Guest** | Temporary access for booking. Very limited. | Calendar |
| **Student** | Learning role. Calendar + messages only. | Calendar |

## Permission Categories

### 1. Pages & Navigation
Controls which pages/tabs appear in sidebar and bottom pill navigation.

| Permission key | Description |
|---------------|-------------|
| `dashboard` | Dashboard page with widgets |
| `calendar` | Calendar/booking grid |
| `history` | Booking history records |
| `clients` | Client management |
| `messages` | Team chat |
| `waitlist` | Queue & notify |
| `portfolio` | Work gallery |
| `payments` | Payment records |
| `attendance` | Clock-in/out |
| `cash` | Cash register |
| `membership` | Membership plans |
| `analytics` | Business analytics |

**Enforcement**: `Shell.tsx` filters NAV items and bottom pills via `hasPerm('pages', id)`. Middleware blocks routes for unauthorized roles.

### 2. Bookings
Controls booking actions in the calendar.

| Permission key | Description |
|---------------|-------------|
| `create` | Create new bookings |
| `edit` | Edit existing bookings |
| `delete` | Delete / cancel bookings |
| `block_time` | Block time slots on calendar |
| `view_all` | View all barbers' bookings (vs own only) |

**Enforcement**: `calendar/page.tsx` checks `hasPerm('bookings', key)` for delete buttons, block creation, and event filtering.

### 3. Calendar Settings
Controls the settings gear icon in calendar and what's available inside.

| Permission key | Description |
|---------------|-------------|
| `open_settings` | Show gear icon to open settings panel |
| `manage_team` | Add / edit team member profiles |
| `manage_services` | Add / edit services |
| `edit_schedule` | Edit barber work schedules |
| `edit_own_profile` | Edit own barber profile |

**Enforcement**: Gear button visibility in `calendar/page.tsx`. Settings modal tabs/sections conditionally rendered.

### 4. Clients
Controls client data access and actions.

| Permission key | Description |
|---------------|-------------|
| `view` | View client list and profiles |
| `add` | Add new clients |
| `edit` | Edit client information |
| `view_phone` | See full phone number (vs masked) |
| `delete` | Delete clients permanently |
| `view_all` | View all clients (vs own only) |

**Enforcement**: `clients/page.tsx` uses `canViewPhone`, `canDeleteClient`. Phone masking applied when `view_phone` is false. Also enforced in `booking-modal.tsx` ClientSearch component.

### 5. Schedule & Approvals
Controls schedule modification and approval workflows.

| Permission key | Description |
|---------------|-------------|
| `change_own` | Modify own work schedule |
| `change_others` | Modify other team members' schedules |
| `needs_approval` | Changes require owner/admin approval |

### 6. Settings Access
Controls which Settings tabs are visible to non-owner roles. If any setting is enabled, the Settings gear appears in navigation.

| Permission key | Description |
|---------------|-------------|
| `general` | General settings (name, timezone, etc.) |
| `booking` | Booking settings (buffer, duration, etc.) |
| `site_builder` | Site Builder tab |
| `fees_tax` | Fees & Tax settings |
| `integrations` | Integrations (Square, Stripe, etc.) |
| `change_password` | Change own password section |
| `view_pin` | Quick PIN setup section |

**Always owner-only**: Accounts, Permissions, Billing, Payroll tabs.

**Enforcement**: `settings/page.tsx` filters tabs via `hasPerm('settings_access', key)`. Shell shows settings gear if any settings_access permission is true.

### 7. Financial
Controls payment processing and financial visibility.

| Permission key | Description |
|---------------|-------------|
| `mark_paid` | Mark bookings as paid |
| `checkout_client` | Show PaymentPanel to process payments |
| `refund` | Issue refunds |
| `access_terminal` | Use payment terminal (Square/Stripe) |
| `pay_cash` | Accept cash payments |
| `pay_zelle` | Accept Zelle payments |
| `pay_other` | Accept other payment methods |
| `view_earnings` | View own earnings |
| `view_all_earnings` | View all team members' earnings |

**Enforcement**: `booking-modal.tsx` checks `hasPerm('financial', key)` for PaymentPanel visibility, terminal access, refund button, and payment method filtering. `calendar/page.tsx` fetches terminal status only if user has checkout/terminal permission.

## Storage

Stored in Firestore: `workspaces/{id}/settings/config.role_permissions`

```json
{
  "role_permissions": {
    "admin": {
      "pages": { "dashboard": true, "calendar": true, ... },
      "bookings": { "create": true, "edit": true, ... },
      "calendar_settings": { ... },
      "clients": { ... },
      "schedule": { ... },
      "settings_access": { ... },
      "financial": { ... }
    },
    "barber": { ... },
    "guest": { ... }
  }
}
```

## API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/settings/permissions` | Any auth | Returns `role_permissions` from settings |
| POST | `/api/settings/permissions` | Owner only | Saves `role_permissions` |

## Frontend Architecture

### PermissionsProvider (`components/PermissionsProvider.tsx`)
- React context wrapping entire app (in `layout.tsx`)
- Fetches permissions on mount from `/api/settings/permissions`
- Merges saved permissions with defaults (new categories get default values)
- Auto-migration: saves merged defaults to DB when new categories detected
- `usePermissions()` hook exposes `hasPerm(category, action)` method
- Owner always returns `true` for all permissions

### Settings UI (`app/settings/page.tsx` > PermissionsTab)
- 3-column toggle grid: Admin | Team Member | Guest
- Grouped by category with section headers
- Auto-save with 800ms debounce using ref for latest state
- "Reset to defaults" button
- Sticky column headers

## Defaults

### Admin
- All pages enabled
- All bookings enabled except delete
- All calendar settings enabled
- All client actions except delete
- Settings: general, booking, site builder, integrations
- Financial: mark paid, checkout, terminal, all payment methods, view all earnings
- No refund, no fees_tax settings

### Team Member (barber)
- Pages: calendar, history, messages, waitlist, portfolio
- Bookings: create, edit, block time (own only)
- Calendar: open settings, edit own profile
- Clients: view own, add
- Financial: view own earnings
- Change own schedule (needs approval)

### Guest
- Pages: calendar, clients
- Bookings: create, edit, view all
- No calendar settings, no financial, no settings access

## Files

| File | Role |
|------|------|
| `components/PermissionsProvider.tsx` | Context, defaults, merge logic, hook |
| `app/settings/page.tsx` | Permissions tab UI, toggle grid |
| `components/Shell.tsx` | Nav filtering, settings gear visibility |
| `app/calendar/page.tsx` | Booking actions, terminal, settings gear |
| `app/calendar/booking-modal.tsx` | PaymentPanel, phone masking, payment methods |
| `app/clients/page.tsx` | Phone visibility, delete button |
| `middleware.ts` | Route blocking per role |
| `backend/index.js` | Permissions API, role definitions |
