# VuriumBook — Changelog

## April 6-12, 2026

### iOS App Fixes
- **Booking modal z-index fix** — Modal now renders via `createPortal` on `document.body` to appear above the header bar
- **Booking modal respects screen bounds** — z-index 10010 (above native pill-bar 9999), hides pill-bar when open, uses `100dvh` with safe-area
- **Bottom nav hides when keyboard opens** — Added `focusin/focusout` fallback for keyboard detection in WKWebView
- **Signup page safe area** — navbar and content respect `env(safe-area-inset-top)` in native iOS
- **Disable zoom** — `scrollView.minimumZoomScale = 1.0`, `touch-action: manipulation` CSS
- **Battery optimization** — Disabled all star/nebula animations, backdrop-filter blur, parallax/gyroscope, shimmer effects in native iOS app
- **No Connection screen** — Redesigned with Vurium Dark Cosmos style, starfield, SVG wifi icon, logo

### Apple App Store Compliance
- **Apple Webhook V2** — `POST /api/webhooks/apple` handles all notification types: DID_RENEW, EXPIRED, DID_CHANGE_RENEWAL_STATUS, REFUND, REVOKE, etc.
- **Apple IAP verify** — `POST /api/billing/apple-verify` verifies transactions from StoreKit 2
- **Apple cancel support** — `/api/billing/cancel` detects `billing_source: 'apple'` and redirects to iOS Settings (no premature status change)
- **Restore Purchases** — StoreManager.swift `restorePurchases()` via `AppStore.sync()`, web button on billing page (iOS only)
- **Auto-renewal disclaimer** — On billing and signup pages: "Subscription automatically renews unless cancelled at least 24 hours before the end of the current period"
- **Privacy Policy / Terms links** — Visible on billing and signup pages
- **Subscription products** — individual_monthly ($29.99), salon_monthly ($79.99), custom_monthly ($99.99)
- **App Store Server Notifications** — Webhook URLs configured (Production + Sandbox)
- **App-Specific Shared Secret** — Generated and deployed as `APPLE_SHARED_SECRET`
- **PrivacyInfo.xcprivacy** — Privacy manifest with collected data types declaration
- **In-App Purchase entitlement** — Added to Xcode project
- **Subscription Group Localization** — "VuriumBook Plans" (English U.S.) — this was the Missing Metadata fix
- **App Description updated** — Added subscription plans, prices, auto-renewal terms, Terms of Use and Privacy Policy links

### Authentication
- **Sign in with Apple (iOS)** — Native `ASAuthorizationController` on LoginView.swift
- **Sign in with Apple (Web)** — OAuth form_post flow via `/api/auth/apple-callback`
- **Sign in with Apple (Backend)** — `POST /auth/apple-signin` with Apple JWKS token verification, user creation/linking
- **Sign in with Apple capability** — Enabled on App ID in Apple Developer Portal, Services ID configured for web
- **Google Sign In (Web)** — OAuth redirect flow via `/api/auth/google-callback`
- **Google Sign In (Backend)** — `POST /auth/google-signin` with Google JWKS verification, code exchange
- **Google OAuth Client ID** — Created in Google Cloud Console (com.vurium.vuriumbook.web)
- **Google button hidden in iOS** — Only visible on web browser, not in WKWebView
- **Demo account for Apple Review** — applereview@vurium.com / ReviewTest2026!

### Billing & Subscriptions
- **Cancelling status keeps access** — `getEffectivePlan()` treats `cancelling` and `past_due` as active
- **Past due (grace period)** — Full access during Apple payment retry
- **Billing page accessible when expired** — Fixed case-sensitive check (`'Billing'` vs `'billing'`)
- **Custom plan Subscribe button** — Removed "Contact Sales", all plans now purchasable
- **New user redirect to plan selection** — Google/Apple Sign In new users go to `/signup?step=plan`
- **Token sync before purchase** — WebView syncs auth token to UserDefaults before IAP purchase
- **Apple cancel — no premature status change** — Status only changes when Apple webhook confirms

### UI/UX
- **Profile modal opacity** — Made more opaque: overlay .70, modal box rgba(10,10,14,.92)
- **14-Day Free Trial** — Changed from "30-Day" to "14-Day" on signup page
- **WKWebView Google/Apple OAuth** — Google OAuth opens in external Safari (blocked in WKWebView), Apple stays in WKWebView

### Backend
- **Deploy workflow** — Added GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APPLE_SHARED_SECRET env vars
- **Paid Apps Agreement** — Activated in App Store Connect
- **Banking/Tax** — Configured in App Store Connect Business section
- **DSA compliance** — Trader status configured for EU
