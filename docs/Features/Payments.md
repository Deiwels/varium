# Payments

## Stripe Connect
Primary payment processor with Connect for marketplace model.

### Endpoints
- `POST /api/stripe-connect/create-payment-intent` — create payment
- `POST /public/stripe-connect/create-payment-intent/:wsId` — public payment
- `GET /api/stripe-connect/oauth/url` — OAuth connect URL
- `GET /api/stripe-connect/status` — connection status
- `GET /api/stripe-connect/onboarding-url` — Stripe onboarding
- `POST /api/stripe-connect/disconnect` — disconnect account

### Webhooks
- `POST /api/stripe/webhook` — Stripe events
- `POST /api/webhooks/stripe-connect` — Connect events

## Square Integration
Alternative POS integration.

### Endpoints
- `GET /api/square/oauth/url` — OAuth URL
- `GET /api/square/oauth/callback` — callback
- `GET /api/square/oauth/status` — status
- `POST /api/square/oauth/disconnect` — disconnect
- `POST /api/square/customers/sync` — sync customers
- `GET /api/square/locations` — locations
- `POST /api/webhooks/square` — Square webhook

## Payment Management
- `GET /api/payments` — list payments
- `POST /api/payments/reconcile` — reconcile
- `POST /api/payments/refund/:paymentId` — refund
- `POST /api/payments/refund-by-booking/:bookingId` — refund by booking

## Terminal Payments
- `GET /api/payments/terminal/devices` — list terminals
- `POST /api/payments/terminal` — create terminal payment
- `GET /api/payments/terminal/status/:checkoutId` — check status
- `POST /api/payments/terminal/cancel/:checkoutId` — cancel

## Billing (Subscriptions)
- `POST /api/billing/checkout` — checkout
- `POST /api/billing/create-subscription` — create sub
- `GET /api/billing/status` — subscription status
- `POST /api/billing/cancel` — cancel subscription
- `POST /api/billing/portal` — customer portal
- `POST /api/billing/apple-verify` — Apple IAP verify

## Frontend
- `/payments` — payment history page
- `/billing` — subscription management
- `PlanProvider.tsx` — subscription state context
- `FeatureGate.tsx` / `UpgradeGate.tsx` — plan-based feature gating
