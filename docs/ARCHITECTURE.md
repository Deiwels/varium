# VuriumBook — Architecture Overview

> [[Home]] > Plans & Process | See also: [[Tech Stack]], [[Database Schema]], [[Auth Flow]], [[API Routes]]

## Stack
- **Frontend**: Next.js 15.1, React 19, TypeScript, inline styles (no Tailwind)
- **Backend**: Express.js on Google Cloud Run
- **Database**: Google Firestore (multi-tenant: workspaces/{id}/users/{id})
- **iOS App**: Swift/SwiftUI + WKWebView wrapper
- **Payments**: Stripe (web) + Apple IAP (iOS)
- **SMS**: Telnyx
- **Email**: Resend
- **Push**: Apple Push Notifications (APNs)
- **Hosting**: Vercel (frontend), Cloud Run (backend)
- **CI/CD**: GitHub Actions → Cloud Run auto-deploy on push to main

## iOS App Architecture
- **VuriumBookApp.swift** — App entry, AuthManager (login state)
- **LoginView.swift** — Native login screen (email/password, Face ID, Sign in with Apple)
- **VuriumWebView.swift** — WKWebView wrapper that loads vurium.com/dashboard
- **StoreManager.swift** — StoreKit 2 IAP (purchase, restore, transaction listener)
- **PrivacyInfo.xcprivacy** — Privacy manifest

### WKWebView ↔ Native Communication
- `window.__VURIUM_IS_NATIVE` — flag injected at document start
- `webkit.messageHandlers.purchase` — triggers Apple IAP
- `webkit.messageHandlers.restore` — triggers Restore Purchases
- `webkit.messageHandlers.logout` — clears native auth data
- Token sync: WebView localStorage ↔ UserDefaults (bidirectional)
- Cookie injection: auth cookies set before WebView loads

## Authentication Flow
1. **Email/password** → POST /auth/login-email → JWT token
2. **Apple Sign In** → ASAuthorizationController → POST /auth/apple-signin → JWT
3. **Google Sign In** → Google OAuth redirect → POST /auth/google-signin → JWT
4. **Biometric** → Keychain credentials → same as email/password

## Billing Flow
1. **Web (Stripe)** → /api/billing/create-subscription → Stripe Elements
2. **iOS (Apple IAP)** → webkit.messageHandlers.purchase → StoreKit 2 → /api/billing/apple-verify
3. **Cancel (Stripe)** → /api/billing/cancel → cancel_at_period_end
4. **Cancel (Apple)** → redirect to iOS Settings → Apple webhook updates status

## Environment Variables (Cloud Run)
- JWT_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
- STRIPE_PRICE_INDIVIDUAL, STRIPE_PRICE_SALON, STRIPE_PRICE_CUSTOM
- TELNYX_API_KEY, TELNYX_FROM
- RESEND_API_KEY
- APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY_P8, APNS_BUNDLE_ID, APNS_ENVIRONMENT
- APPLE_SHARED_SECRET
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
- PHONE_ENCRYPTION_KEY
- SQUARE_APP_ID, SQUARE_APP_SECRET

## Key URLs
- Frontend: https://vurium.com
- API: https://vuriumbook-api-431945333485.us-central1.run.app
- Apple Webhook: /api/webhooks/apple
- Stripe Webhook: /api/stripe/webhook
