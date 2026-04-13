# Onboarding Wizard

## Overview
4-step setup wizard that replaces the dashboard for new workspaces with no barbers and no services. Solves the activation crisis where 94% of trial workspaces stay empty.

## Detection
```
needsOnboarding = !loading && isOwnerOrAdmin && barbers.length === 0 && services.length === 0 && !localStorage('VB_ONBOARDING_DISMISSED')
```
- Only shown to owner/admin roles
- Disappears naturally once any barber or service is created
- Can be skipped (localStorage flag)

## Steps

### Step 1: Business Info
- Shop name, business type (pill selector), address
- **Auto-skips** if `shop_name` and `business_type` already filled from signup
- Saves via `POST /api/settings`

### Step 2: Add First Staff Member
- Name + working days (toggle buttons) + working hours (start/end select)
- Label adapts to business type via `lib/terminology.ts`:
  - Barbershop → "Barber"
  - Hair Salon → "Stylist"
  - Tattoo Studio → "Artist"
  - etc.
- Saves via `POST /api/barbers`
- Stores `createdBarberId` for Step 3

### Step 3: Add Services
- Pre-filled from business type templates (`lib/onboarding-templates.ts`)
- Checkbox cards with inline-editable name, duration, price
- "+ Add custom service" button
- All selected services created via `POST /api/services` (parallel)
- Services auto-assigned to barber from Step 2

### Step 4: Enable Online Booking
- Toggle switch for `online_booking_enabled`
- iframe preview of booking page (`/book/{slug}`)
- Browser-style frame with traffic light dots + URL bar
- "Launch" button saves setting and triggers dashboard reload

## Files
- `components/OnboardingWizard.tsx` — wizard component
- `lib/onboarding-templates.ts` — 7 business type templates
- `app/dashboard/page.tsx` — integration (detection + conditional render)
- `backend/index.js` — `online_booking_enabled` in ALLOWED_SETTINGS

## Business Templates
7 types with 5-6 services each (see [[Business Templates]])

## Style
Dark Cosmos — glass card with blur, purple accents, matching StyledDialog patterns.

## Related
- [[Booking System]] — what gets enabled in Step 4
- [[Client Management]] — clients created through booking flow after setup
