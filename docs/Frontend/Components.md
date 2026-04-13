# Components

> Part of [[Home]] > Frontend | See also: [[App Routes]], [[Tech Stack]]

> Core reusable components in `/components/`

| Component | Purpose |
|-----------|---------|
| **Shell.tsx** | Main app shell — navigation, auth, PIN setup, visibility polling |
| **PlanProvider.tsx** | Context for subscription plan data, billing status, feature availability |
| **PermissionsProvider.tsx** | Role-based permissions context (admin/manager/staff) |
| **FeatureGate.tsx** | Restricts features by plan tier, works with UpgradeGate |
| **UpgradeGate.tsx** | UI prompt to upgrade subscription for premium features |
| **ErrorBoundary.tsx** | Catches rendering errors, shows fallback UI |
| **StyledDialog.tsx** | Reusable modal (info/warning/error/confirm types) |
| **ImageCropper.tsx** | Image cropping tool (circular + square shapes) |
| **CosmosParallax.tsx** | Parallax cosmos background (disabled on native for battery) |
| **CookieBanner.tsx** | Cookie consent banner (hidden on native iOS) |

## Lib Utilities

| File | Purpose |
|------|---------|
| **api.ts** | API client with Bearer token auth |
| **auth-cookie.ts** | Cookie management (role:uid format, 7-day expiry) |
| **pin.ts** | PIN auth (SHA-256 + AES) |
| **terminology.ts** | Business-type labels ("Barber" vs "Stylist" vs "Trainer") |
| **timezones.ts** | Timezone utilities |
| **useVisibilityPolling.ts** | Hook for polling only when tab is visible |
