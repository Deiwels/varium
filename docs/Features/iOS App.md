# iOS App

> Part of [[Home]] > Features | See also: [[Push Notifications]], [[Billing & Subscriptions]], [[Auth Flow]]

## Overview
Native iOS hybrid app wrapping the Next.js frontend in WKWebView. Adds push notifications, Apple IAP, biometric login, and performance optimizations.

- **Bundle ID**: `com.vurium.VuriumBook`
- **App Name**: VuriumBook
- **Framework**: SwiftUI + WKWebView
- **Source**: `~/Desktop/untitled folder/VuriumBook/`

## File Structure
```
VuriumBook/
├── VuriumBookApp.swift        — SwiftUI @main entry + AppDelegate
├── VuriumWebView.swift        — WKWebView wrapper (835 lines), JS bridge, navigation
├── LoginView.swift            — Native login UI (email/password, Apple Sign In, biometrics)
├── StoreManager.swift         — StoreKit 2 IAP integration
├── VuriumBook.entitlements    — APS, Apple Sign In
├── PrivacyInfo.xcprivacy      — Privacy manifest (no tracking)
└── Attendance/
    └── LocationPushService.swift  — Background location push extension
```

## Architecture
```
VuriumBookApp (@main)
├── VuriumAppDelegate
│   ├── Push notification handling
│   ├── Remote notification registration
│   └── Deep link routing
├── AuthManager
│   ├── Login / Signup / Apple Sign In
│   ├── JWT token + Keychain storage
│   ├── Biometric auth (Face ID / Touch ID)
│   └── Push token registration
└── VuriumWebView (SwiftUI)
    └── WebViewWrapper (UIViewRepresentable)
        └── WebCoordinator (WKWebView delegates)
```

## WKWebView Configuration
- **Cache**: 512MB disk, 128MB memory
- **Background**: Pure black (#010101)
- **Zooming**: Disabled (scale locked at 1.0)
- **Gestures**: Back/forward swipe disabled
- **Caching policy**: `returnCacheDataElseLoad` (aggressive offline support)

### Injected JavaScript Globals
```javascript
window.__VURIUM_IS_NATIVE = true
window.__VURIUM_PUSH_TOKEN = "<device_token>"
window.__VURIUM_SAFE_TOP = 59      // safe area top px
window.__VURIUM_SAFE_BOTTOM = 34   // safe area bottom px
```

### CSS Injection (Performance)
- Disables CSS animations on `.space-bg`, `.stars-wrap-*`, `.star-glow`, `.shooting-star-*`
- Removes `backdrop-filter` blur (GPU intensive)
- Disables shimmer/glow animations
- Injects safe area variables (`--sat`, `--sab`)
- Fixed pill-bar positioning with MutationObserver

### Page Prefetching
Cached on load: `/calendar`, `/messages`, `/clients`, `/settings`, `/attendance`, `/payments`
API prefetch: `/api/bookings/today`, `/api/dashboard/stats`

## JavaScript Bridge (Message Handlers)

| Handler | Trigger | What it does |
|---------|---------|-------------|
| `purchase` | `window.webkit.messageHandlers.purchase.postMessage({plan})` | Initiates Apple IAP |
| `restore` | `window.webkit.messageHandlers.restore.postMessage({})` | Restores previous purchases |
| `logout` | `window.webkit.messageHandlers.logout.postMessage({})` | Clears native auth data |

### Events dispatched back to web
- `vuriumPurchaseSuccess` / `vuriumPurchaseError`
- `vuriumRestoreSuccess` / `vuriumRestoreError`

## Authentication

### Login Flow
1. Email/password → `/auth/login` → JWT token
2. Token stored in UserDefaults (`vurium_auth_token`)
3. User data stored as JSON (`vurium_user_json`)
4. Credentials saved to Keychain for biometric login

### Apple Sign In
- ASAuthorizationController → identity token → `/auth/apple-signin`
- New users redirected to `/billing` for subscription selection

### Biometric Login
- Face ID / Touch ID via LocalAuthentication framework
- Retrieves credentials from Keychain (`com.vurium.vuriumbook`)

### Token Sync (Web <-> Native)
- Native: UserDefaults `vurium_auth_token`
- Web: localStorage `VURIUMBOOK_TOKEN`
- Bidirectional sync on every page load
- Cookie: `vuriumbook_token` + `vuriumbook_auth` (secure, 7-day, domain: vurium.com)

## In-App Purchases (StoreKit 2)

| Product ID | Plan |
|-----------|------|
| `individual_monthly` | individual |
| `salon_monthly` | salon |
| `custom_monthly` | custom |

### Purchase Flow
1. Web calls `purchase` message handler with plan name
2. Maps to Apple product ID
3. Syncs auth token from web localStorage
4. StoreKit 2 purchase dialog
5. Receipt sent to `/api/billing/apple-verify`
6. Backend validates and activates subscription
7. Success/error event dispatched to web

## Push Notifications

### Registration
1. App requests permission → OS returns APNs token
2. Token stored in UserDefaults (`vurium_push_token`)
3. Sent to backend via `POST /api/push/register`
4. Payload: `{ device_token, platform: "ios", app: "vuriumbook", user_id, user_name, role }`

### Notification Types & Deep Links
| Type | In-App Behavior | Deep Link |
|------|----------------|-----------|
| `message` | Banner + sound | `/messages?tab={chatType}` |
| `booking_confirmed` | Silent (suppress) | `/calendar` |
| `booking_cancelled` | Silent (suppress) | `/calendar` |
| `request` | Banner | `/messages?tab=requests` |
| `attendance` | Banner | `/attendance` |
| Default | Banner, no sound | `/dashboard` |

## Native UI

### Loading Screen
- Logo with pulsing animation, rotating ring spinner, progress bar (0-100%)

### Error/Offline Screen
- Procedural starfield background
- User greeting ("HEY, JOHN")
- "Try Again" button with retry

### Login Screen (SwiftUI)
- Dark theme, logo + branding
- Email/password fields
- Face ID / Touch ID option
- "Sign in with Apple" button

## URL Handling
- Google OAuth → opens in external Safari
- Other non-vurium links → external Safari on user click
- Internal vurium.com URLs → WKWebView
- `target="_blank"` → same webview

## Entitlements & Privacy
- APS Environment: `development`
- Apple Sign In: enabled
- Location: "Verify your location when clocking in for attendance"
- Privacy: Email, Name, Phone, User ID collected (linked to account)
- No tracking (`NSPrivacyTracking = false`)

## Location Push Extension
- Target: `com.apple.location.push.service`
- For background location updates via push
- Currently stubbed (completion called immediately)
