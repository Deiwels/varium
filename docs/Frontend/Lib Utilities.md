# Lib Utilities

> Part of [[Home]] > Frontend | See also: [[App Routes]], [[Components]], [[Auth Flow]]

## Overview
7 shared utility files in `/lib/` used across the frontend.

## api.ts — API Client
Central fetch wrapper for all backend communication.

**Exports:**
- `API` — base URL (env `NEXT_PUBLIC_API_BASE_URL` or production Cloud Run URL)
- `apiFetch(path, opts?)` — fetch with auto Bearer token from localStorage (`VURIUMBOOK_TOKEN`)
- `getPublicBarbers(wsId)`, `getPublicServices(wsId)`, `getPublicAvailability(wsId, body)`, `createPublicBooking(wsId, body)` — public booking API helpers

**Key behavior:**
- Auto-includes `credentials: 'include'` and `Authorization: Bearer <token>`
- On 401: dispatches `vuriumbook-auth-expired` event → triggers PIN re-auth or redirect to `/signin`

## auth-cookie.ts — Cookie Auth
Client-side cookie for role-based middleware routing.

**Exports:**
- `setAuthCookie(value)` — sets cookie with format `role:uid` (e.g. `owner:abc123`)
- `clearAuthCookie()` — removes cookie

**Note:** This is a non-httpOnly cookie used by `middleware.ts` for route access decisions. The real auth token is in the backend's secure HttpOnly cookie.

## pin.ts — PIN Security
Client-side PIN authentication with credential encryption.

**Exports:**
- `hasPinSetup()` — check if PIN configured
- `savePin(pin, username, password)` — store PIN hash + AES-256-GCM encrypted credentials
- `verifyPin(pin)` — verify against SHA-256 hash
- `getCredentials(pin)` — decrypt stored credentials with PIN
- `clearPin()` — remove PIN setup

**Crypto:**
- SHA-256 hash of `PIN:username` for verification
- PBKDF2 (100K iterations) → AES-256-GCM for credential encryption
- 12-byte random IV per encryption
- Stored in localStorage: `PIN_HASH_KEY`, `PIN_CREDS_KEY`, `PIN_USER_KEY`

## terminology.ts — Dynamic Labels
Maps business type to staff terminology used across UI.

**Exports:**
- `getStaffLabel(businessType, plural?)` — returns staff title
- `getStaffLabels(businessType)` — returns `{ singular, plural }`

| Business Type | Singular | Plural |
|--------------|----------|--------|
| Barbershop | Barber | Barbers |
| Hair Salon | Stylist | Stylists |
| Nail Studio | Master | Masters |
| Beauty Salon | Master | Masters |
| Spa & Wellness | Specialist | Specialists |
| Tattoo Studio | Artist | Artists |
| Lash & Brow Bar | Master | Masters |
| Default | Specialist | Specialists |

## timezones.ts — Timezone Utils
**Exports:**
- `getTimezoneList()` — array of `{ value, label }` with UTC offsets
- `detectUserTimezone()` — detects user's timezone via `Intl.DateTimeFormat`

Formats as `(UTC-05:00) America/New_York`. Fallback to 20 major zones if Intl unavailable.

## onboarding-templates.ts — Service Templates
Pre-configured service templates for onboarding wizard step 3.

**Exports:**
- `BUSINESS_TEMPLATES` — 7 business types, 5-6 services each
- `DEFAULT_TEMPLATES` — fallback templates

| Type | Example Services |
|------|-----------------|
| Barbershop | Haircut $25/30min, Beard Trim $15/20min |
| Hair Salon | Women's Haircut $50/45min, Color Full $120/90min |
| Nail Studio | Gel Manicure $40/45min, Polish Change $15/15min |
| Spa & Wellness | Swedish Massage $80/60min, Deep Tissue $100/60min |
| Tattoo Studio | Small Tattoo $100/60min, Medium $250/120min |

Each: `{ name, duration_minutes, price_cents, service_type: 'primary'|'addon' }`

## useVisibilityPolling.ts — Smart Polling Hook
React hook that pauses polling when tab is hidden.

**Export:** `useVisibilityPolling(callback, intervalMs, deps?)`

- Stops timer on `visibilitychange` (hidden)
- Fires immediately on mount and when tab becomes visible
- Used by Shell (unread messages), Dashboard, Calendar
