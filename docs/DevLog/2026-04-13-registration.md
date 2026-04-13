# 2026-04-13 — Registration & Terminology

> [[Home]] > DevLog | Related: [[Onboarding Wizard]], [[Booking System]], [[App Routes]]

## Done

### Required timezone selector on signup
- Previously: timezone was optional during registration, silently defaulted to `America/Chicago`
- Now: required `<select>` dropdown in "Your Business" section of signup form
- Auto-detects user's browser timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Full IANA timezone list (~400 entries) via `Intl.supportedValuesOf('timeZone')`
- Formatted as `(UTC-05:00) America/New_York`, sorted by UTC offset
- Backend SignupSchema: `timezone` changed from `.optional()` to required
- Shared utility: `lib/timezones.ts` — used by both signup and settings pages
- Settings page: expanded from 5 hardcoded US timezones to full IANA list

### Email required for team member accounts + welcome email
- Frontend `POST /api/users` now sends `email` as a separate field (was only sent as `username`)
- Backend `UserCreateSchema`: `email` changed from `.optional()` to required
- Email uniqueness check: backend now checks for duplicate email within workspace before creating user
- Welcome email sent on account creation (fire-and-forget via Resend):
  - Uses workspace email template (shopName, logo, theme)
  - Shows role (Admin / Team Member), login email, sign-in link
  - Includes "Forgot password" hint for self-service recovery
  - Uses `vuriumEmailTemplate()` + `getWorkspaceEmailConfig()` from existing email infra

### Plan-based feature gating for Payroll & Expenses nav
- Bug: Payroll and Expenses nav items visible to all owners regardless of plan
- Root cause: `Shell.tsx` nav items missing `feature` property — plan check only ran on page via `FeatureGate`
- Fix: added `feature: 'payroll'` and `feature: 'expenses'` to nav items in `Shell.tsx`
- Now hidden from navigation for individual and salon plans (only custom plan)

### Business type → dynamic terminology system
- Problem: all user-facing labels said "Barber" regardless of business type (salon, spa, nail studio, etc.)
- `businessType` was collected at signup UI but never sent to backend or stored

#### Terminology mapping
| Business Type | Staff label (singular/plural) |
|---|---|
| Barbershop | Barber / Barbers |
| Hair Salon | Stylist / Stylists |
| Nail Studio | Master / Masters |
| Beauty Salon | Master / Masters |
| Spa & Wellness | Specialist / Specialists |
| Tattoo Studio | Artist / Artists |
| Lash & Brow Bar | Master / Masters |
| Other / fallback | Specialist / Specialists |

#### Implementation
- New shared utility: `lib/terminology.ts` — `getStaffLabel(businessType, plural?)` + `getStaffLabels()`
- Signup: now sends `business_type` + `shop_name` (= business name) to backend
- Backend signup: stores `business_type` in workspace doc + `settings/config` doc, stores `shop_name` in settings
- Backend `ALLOWED_SETTINGS`: `business_type` added — changeable from settings page
- Backend settings POST: syncs `business_type` to workspace doc when changed
- `/api/account/limits` response: includes `business_type`
- `/public/resolve` response: includes `business_type`
- `PlanProvider`: exposes `business_type` via `usePlan()` hook
- Settings page: new "Business Type" selector in General section with all 8 options
- Public booking page (`/book/[id]`): "Our Team" → "Our {Barbers|Stylists|etc}", "Choose your specialist" → "Choose your {barber|stylist|etc}"
- Permission labels: "View all barbers" → "View all team members", "Edit barber schedules" → "Edit team schedules"
- SMS/email fallbacks: all `'your barber'` → `'your specialist'` (universal)
- Receipt line: `'Barber: {name}'` → `'Specialist: {name}'`

## Files created
- `lib/timezones.ts` — shared timezone list + browser detection utility
- `lib/terminology.ts` — business type → staff terminology mapping

## Files modified
- `app/signup/page.tsx` — timezone selector, business_type + shop_name in API body
- `app/settings/page.tsx` — expanded timezone list, business_type selector, dynamic permission labels, email in user creation
- `app/book/[id]/page.tsx` — dynamic terminology on public booking page
- `backend/index.js` — timezone required, email required + uniqueness, business_type storage/sync/expose, welcome email, SMS fallback fixes
- `components/PlanProvider.tsx` — added `business_type` to plan context
- `components/Shell.tsx` — `feature: 'payroll'` and `feature: 'expenses'` on nav items
