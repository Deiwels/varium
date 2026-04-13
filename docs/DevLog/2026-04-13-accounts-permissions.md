# 2026-04-13 — Accounts, Permissions & Billing

> [[Home]] > DevLog | Related: [[Developer Panel]], [[Payments]], [[Client Management]]

## Done

### Team member accounts — link to master profile
- Added barber profile dropdown when creating team members (Settings > Accounts)
- `barber_id` sent to backend on user creation — barber logs in and is automatically associated
- Inline master selector on existing team members in user list
- Labels changed from "barber" to "master"
- Fixed API response format: `GET /api/users` returns array, not `{users: [...]}`

### Plan & billing system overhaul
- **Trial gives full `custom` access** — users can try everything for 14 days
- **Expired state**: `getEffectivePlan()` returns `'expired'` when no active subscription
- **All access blocked when expired**: Shell shows subscribe screen, public bookings return 403
- **No free tier**: Individual plan costs $29/mo, not free
- Public endpoints (barbers, services, bookings) block expired workspaces
- PlanProvider default state is `'expired'` to prevent content flash

### Pricing pages synced
- `/vuriumbook` landing page: complete feature lists for all 3 plans
- `/billing` page: matching feature lists
- Trial info fixed: 14 days (was 30), card required (was "no card required")
- Features per plan now match actual `PLAN_FEATURES` in backend

### Guest role
- New `guest` role: calendar + clients only access
- Backend: permissions, Zod schemas, PLAN_FEATURES updated
- Middleware: route blocking for guest
- Settings: "Guest — calendar & clients only" option in role dropdown
- Shell: nav filtering for guest

### Granular permissions system
- **New PermissionsProvider** context with `usePermissions()` hook
- **New Settings > Permissions tab** (owner only)
- 3 configurable roles: Admin, Team Member, Guest
- 7 permission categories with toggle grid:

#### Pages & Navigation
Dashboard, Calendar, History, Clients, Messages, Waitlist, Portfolio, Payments, Attendance, Cash Register, Membership, Analytics

#### Bookings
Create, Edit, Delete/cancel, Block time slots, View all barbers

#### Calendar Settings
Open settings panel, Add/edit team members, Add/edit services, Edit barber schedules, Edit own profile

#### Clients
View, Add, Edit, View phone number, Delete, View all clients

#### Schedule & Approvals
Change own schedule, Change others' schedule, Needs owner approval

#### Settings Access
General settings, Booking settings, Site Builder, Fees & Tax, Integrations, Change own password, Quick PIN setup

#### Financial
Mark as paid, Checkout/charge client, Issue refund, Access payment terminal, Accept cash/Zelle/other payments, View own/all earnings

### Permissions enforcement
- **Shell.tsx**: nav filtering uses `hasPerm('pages', id)`
- **Calendar**: settings gear, delete, block time, view all — all check permissions
- **Booking modal**: PaymentPanel, terminal, refund, payment methods — check financial permissions
- **Clients page**: phone visibility, delete button — check client permissions
- **Settings tabs**: filtered by `settings_access` permissions
- **Settings gear**: shows if any `settings_access` permission is enabled
- Auto-migration: saves merged defaults when new categories added to DB

### Terminal access for non-owner roles
- `GET /api/square/oauth/status` and `GET /api/stripe-connect/status` — removed `requireRole('owner', 'admin')`
- Any role with `access_terminal` permission can now see terminal option
- `GET /api/settings` opened to all authenticated roles (was owner/admin only)
- `/settings` removed from middleware blocked routes for barber/guest

### Settings tabs visibility per role
- Non-owner roles see only Settings tabs they have permission for
- Accounts, Permissions, Billing, Payroll — always owner only
- If barber has any `settings_access` permission — settings gear shows in nav

### PIN login fix
- **Bug**: PIN re-login used `/api/auth/login` which requires `workspace_id`
- PIN credentials only store username + password, no workspace_id
- **Fix**: switched to `/auth/login-email` which searches by email across all workspaces
- Added periodic session check every 5 minutes — shows PIN overlay if token expired

### PIN overlay redesign — Vurium Dark Cosmos
- Replaced "Element" branding with VuriumBook logo
- Cosmic background with stars and nebula glow
- PIN dots with glow effect on filled state
- Refined number pad with hover effects

### Password reset — audit logging
- Added `console.log` and `writeAuditLog` for successful password resets
- Error logging for failed resets

### USPTO Trademark Registration
- Filed VURIUM trademark (Standard character, Class 042: Computer software development, Software design and development)
- Filed VURIUMBOOK trademark (Standard character, Class 042: Writing of computer software for online appointment booking and scheduling)
- Owner: Nazarii Mykhailiuk, Individual, Ukraine
- Filing basis: Section 1(a) — Use in commerce, first use 03/14/2026
- Specimen: website screenshots converted from PNG to JPEG

## Files changed
- `app/settings/page.tsx` — Accounts (barber linking), Permissions tab, Settings Access, role dropdown
- `components/PermissionsProvider.tsx` — NEW: permissions context, defaults, merge logic
- `components/Shell.tsx` — permissions nav filtering, PIN overlay redesign, session check
- `app/layout.tsx` — PermissionsProvider wrapper
- `app/calendar/page.tsx` — permissions integration (terminal, delete, block, view_all, settings gear)
- `app/calendar/booking-modal.tsx` — financial permissions (checkout, terminal, refund, payment methods)
- `app/clients/page.tsx` — client permissions (phone, delete)
- `app/vuriumbook/page.tsx` — pricing features synced, trial info fixed
- `app/billing/page.tsx` — pricing features synced
- `backend/index.js` — guest role, expired plan, permissions API, terminal access, password reset logging
- `middleware.ts` — guest role, settings access for non-owners
- `lib/pin.ts` — unchanged but documented
- `lib/terminology.ts` — added to git (was missing)
- `.npmrc` — legacy-peer-deps for Stripe build fix
