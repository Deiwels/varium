# Components

> Part of [[Home]] > Frontend | See also: [[App Routes]], [[Lib Utilities]], [[Tech Stack]]

> 11 reusable components in `/components/`

## Layout & Shell

### Shell.tsx (55 KB)
Main app wrapper — renders on every authenticated page.
- Top navbar with user profile, PIN unlock, menu toggle
- Left sidebar with 15 nav items (Dashboard, Calendar, History, Messages, Waitlist, Portfolio, Clients, Payments, Attendance, Cash, Membership, Analytics, Expenses, Payroll, Billing, Settings)
- ProfileModal sub-component for profile editing + photo upload
- PIN unlock overlay for quick re-auth
- Real-time unread chat indicator (visibility-aware polling, 45s interval)
- Responsive: hamburger menu on mobile, virtual keyboard detection
- Integrates: PlanProvider, PermissionsProvider, nav filtering by role + plan

### ErrorBoundary.tsx (1.4 KB)
Class component catching render errors. Shows dark error screen with "!" icon + reload button.

## Auth & Permissions

### PlanProvider.tsx (2.6 KB)
React Context for subscription/plan management.
- Fetches from `/api/account/limits`
- Provides: `plan_type`, `billing_status`, `effective_plan`, `features[]`, `member_limit`, `staff_limit`, `trial_active`, `trial_days_left`, `hasFeature()`, `refresh()`
- Default: individual/expired with no features

### PermissionsProvider.tsx (7.7 KB)
React Context for role-based access control.
- Fetches from `/api/settings/permissions`
- 4 roles: admin (full), barber (calendar/history/messages/waitlist/portfolio), guest (calendar/clients read-only), student (calendar/messages only)
- Owner always has full access (hardcoded)
- Provides: `perms`, `hasPerm(category, action)`, `loading`, `refresh`

### FeatureGate.tsx (549 B)
Wrapper that shows children if user has feature access, or UpgradeGate if not.
- Props: `feature`, `label`, `requiredPlan` (default: 'salon')

### UpgradeGate.tsx (1.9 KB)
Upgrade prompt with lock icon, feature name, plan comparison, "Upgrade Plan →" link to `/billing`.

## UI Components

### StyledDialog.tsx (7.7 KB)
Context-based dialog system. Overrides global `window.alert()` and `window.confirm()`.
- `useDialog()` hook: `showAlert(msg)`, `showError(msg)`, `showConfirm(msg)`
- Each returns Promise
- Color-coded: blue info, yellow warning, red error, orange confirm
- Modal backdrop with blur, ESC key support, animations

### ImageCropper.tsx (24 KB)
Full-screen image editor with 3 tabs:
- **Crop**: zoom, pan, rotate (0/90/180/270°), circle or square shape
- **Filter**: 10 presets (B&W, Sepia, Vivid, Warm, Cool, Fade, Noir, Chrome, Drama)
- **Adjust**: brightness, contrast, saturation, warmth, vignette, sharpen
- Touch support (pinch-zoom on mobile)
- Auto JPEG compression (keeps <900KB)
- Rule-of-thirds grid overlay

### OnboardingWizard.tsx (19 KB)
4-step modal wizard for new workspaces:
1. Business info (name, type, address) — auto-skipped if already saved
2. Staff member setup (name, schedule grid per day)
3. Service templates (select/customize per business type)
4. Enable online booking (toggle + booking page preview iframe)
- Progress bar, responsive, calls `/api/settings`, `/api/barbers`, `/api/services`

### CookieBanner.tsx (1.5 KB)
Fixed bottom cookie consent banner. Checks `cookie_notice_seen` localStorage flag. Hidden on iOS native app (`__VURIUM_IS_NATIVE`). Glassmorphic design.

### CosmosParallax.tsx (4 KB)
Attaches parallax to starfield layers (`#v-stars-far`, `#v-stars-mid`, `#v-stars-near`).
- Desktop: mouse movement parallax (easing, auto-stops after 2s idle)
- Mobile: device orientation (gyroscope) with iOS 13+ permission request
- Scroll parallax on both
- Pauses when tab hidden, disabled on iOS native app
- 3-layer depths: 8x, 20x, 35x multipliers

## See Also
- [[Lib Utilities]] — Shared utility functions (API client, PIN, terminology, timezones)
