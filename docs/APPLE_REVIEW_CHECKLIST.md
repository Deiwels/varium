# Apple App Store Review Checklist — VuriumBook

> [[Home]] > Plans & Process | See also: [[Tech Stack]], [[Auth Flow]]

## App Store Connect Configuration

### Subscriptions (App Store Connect → Subscriptions)
- [x] Subscription Group: "VuriumBook Plans" (ID: 22011025)
- [x] Subscription Group Localization: English (U.S.) — "VuriumBook Plans"
- [x] Individual Monthly: product ID `individual_monthly`, $29.99/mo, 1 month
- [x] Salon Monthly: product ID `salon_monthly`, $79.99/mo, 1 month
- [x] Custom Monthly: product ID `custom_monthly`, $99.99/mo, 1 month
- [x] All subscriptions: Review Screenshot uploaded
- [x] All subscriptions: Localization (Display Name + Description)
- [x] All subscriptions: Pricing set for all 175 countries
- [x] All subscriptions: Status "Ready to Submit"
- [x] Subscriptions added to iOS App Version for submission

### App Information
- [x] Privacy Policy URL: https://vurium.com/privacy
- [x] License Agreement: Apple's Standard
- [x] Bundle ID: com.vurium.VuriumBook
- [x] Category: Business

### Server Notifications
- [x] Production URL: https://vuriumbook-api-431945333485.us-central1.run.app/api/webhooks/apple
- [x] Sandbox URL: same
- [x] Version: V2
- [x] App-Specific Shared Secret: generated and deployed

### Agreements
- [x] Paid Apps Agreement: Active
- [x] Free Apps Agreement: Active
- [x] Bank Account: Active (Z FIVE, USD)

### App Privacy
- [x] PrivacyInfo.xcprivacy in Xcode project
- [x] App Privacy Details filled in App Store Connect

## iOS App Requirements

### Authentication
- [x] Sign in with Apple (native ASAuthorizationController)
- [x] Email/password login
- [x] Biometric login (Face ID / Touch ID)
- [x] Sign in with Apple capability in Xcode
- [x] Sign in with Apple enabled on App ID (developer.apple.com)

### In-App Purchase
- [x] In-App Purchase capability in Xcode
- [x] StoreKit 2 implementation (StoreManager.swift)
- [x] Product IDs match App Store Connect
- [x] Purchase flow works (sandbox tested)
- [x] Restore Purchases button on Billing page
- [x] Transaction listener for renewals (Transaction.updates)

### Compliance Text (visible in app)
- [x] Auto-renewal disclaimer on billing page
- [x] Auto-renewal disclaimer on signup page
- [x] Privacy Policy link on billing page
- [x] Terms of Service link on billing page
- [x] "No charge for 14 days · Cancel anytime" text

### App Description (App Store Connect)
- [x] Subscription plan names and prices
- [x] Subscription duration (monthly)
- [x] Auto-renewal terms
- [x] Terms of Use link: https://vurium.com/terms
- [x] Privacy Policy link: https://vurium.com/privacy

### Account Management
- [x] Delete Account (Settings page)
- [x] Cancel subscription (redirects to iOS Settings for Apple)

### Demo Account for Review
- Email: applereview@vurium.com
- Password: ReviewTest2026!

## Backend Endpoints

### Apple IAP
- `POST /api/billing/apple-verify` — Verify Apple IAP transaction
- `POST /api/billing/cancel` — Cancel subscription (Apple redirects to Settings)
- `POST /api/webhooks/apple` — App Store Server Notifications V2

### Authentication
- `POST /auth/apple-signin` — Apple Sign In with JWKS verification
- `POST /auth/google-signin` — Google Sign In with JWKS verification
- `POST /auth/login-email` — Email/password login
- `POST /auth/signup` — Registration

## Web Pages (must be accessible)
- https://vurium.com/privacy — Privacy Policy
- https://vurium.com/terms — Terms of Service
- https://vurium.com/support — Support
- https://vurium.com/signin — Sign In
- https://vurium.com/signup — Sign Up
- https://vurium.com/billing — Billing (subscription management)
