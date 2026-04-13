# Payments

> Part of [[Home]] > Features | See also: [[Booking System]], [[Tech Stack]], [[API Routes]], [[Attendance & Payroll]]

## Stripe Connect
Primary payment processor with Connect for marketplace model.
- 2% platform fee on transactions
- Express Connect accounts
- Supports card, Apple Pay, Google Pay

### Endpoints
- `POST /api/stripe-connect/create-payment-intent` — create payment
- `POST /public/stripe-connect/create-payment-intent/:wsId` — public payment
- `GET /api/stripe-connect/oauth/url` — OAuth connect URL
- `GET /api/stripe-connect/status` — connection status
- `GET /api/stripe-connect/onboarding-url` — Stripe onboarding
- `POST /api/stripe-connect/disconnect` — disconnect account

### Webhooks
- `POST /api/stripe/webhook` — Stripe events
- `POST /api/webhooks/stripe-connect` — Connect events (`payment_intent.succeeded`)

## Square Integration
POS terminal integration for in-person card payments.

### OAuth
- Scopes: `PAYMENTS_READ PAYMENTS_WRITE ORDERS_READ MERCHANT_PROFILE_READ DEVICES_READ CUSTOMERS_READ CUSTOMERS_WRITE`
- Callback redirects to `/settings?tab=square&square=connected`
- Tokens in `settings/square_oauth`, auto-refresh when expiring

### Endpoints
- `GET /api/square/oauth/url` — OAuth URL (owner only)
- `GET /api/square/oauth/callback` — callback (no auth)
- `GET /api/square/oauth/status` — connection status
- `POST /api/square/oauth/disconnect` — disconnect
- `POST /api/square/customers/sync` — find-or-create customer in Square
- `GET /api/square/locations` — list locations

### Webhooks
- `POST /api/webhooks/square` — handles `terminal.checkout.updated`, `payment.completed`, `payment.updated`

### Customer Sync
- Auto-syncs client to Square on terminal payment (by phone)
- Client search fallback: searches Square when local search finds nothing
- Links `square_customer_id` to local client

## Terminal Payments
Square Terminal for in-person card payments with tipping.

### Configuration (Settings > Integrations)
- **Location** — select Square location (required for device auth)
- **Device** — select terminal (serial number from `device:SERIAL` format)
- Stored in `settings/config` → `square.terminal_device_id`, `square.location_id`

### Payment Flow
1. Frontend sends amount (dollars), booking_id, service_amount, tax, fees
2. Backend converts to cents, resolves device + location, syncs client to Square
3. Creates checkout with note: `VuriumBook - Client - Service - w/ Barber - Booking ID`
4. Frontend polls status every 3s (max 3 min)
5. On COMPLETED: fetches tip from `/v2/payments/{id}` (not checkout — `tip_money` null when `allow_tipping=true`)
6. Marks booking paid with tip, amount (service only, not total), payment_id

### Tip Settings
- `allow_tipping: true`, `custom_tip_field: true`
- `tip_percentages: [15, 20, 25]` — configurable
- Terminal button only visible when Square/Stripe connected

### Endpoints
- `GET /api/payments/terminal/devices` — list terminals
- `POST /api/payments/terminal` — create checkout
- `GET /api/payments/terminal/status/:checkoutId` — poll status
- `POST /api/payments/terminal/cancel/:checkoutId` — cancel

## Auto-Reconciliation
Automatically matches Square payments to unpaid bookings.

### Background (every bookings load, throttled 2 min)
- Checks Square for today's completed payments
- Matches by: booking_id from note → date + amount (+-$2)
- Creates `payment_requests` record, marks booking paid

### Manual
- `POST /api/payments/reconcile` — reconcile for date range
- `POST /api/payroll/sync-tips-from-square` — fetch tips from Square Payment API

## Receipts
- `POST /api/receipts/send` — SMS receipt (shop, date, barber, service, amount, tip, total)
- "Send Receipt" button in booking modal after payment

## Fees & Tax
Per payment method in Settings > Fees & Tax.
- **Tax**: label, rate %, included_in_price, `applies_to` (All/Terminal/Cash/Zelle/Other)
- **Fees**: multiple, each with label, type (%/fixed), value, `applies_to`
- `calcTotal()` filters by selected payment method
- Payroll uses `service_amount` — fees/tax NOT in barber commission

## Payment Management
- `GET /api/payments` — list (merges local + Square API)
- `POST /api/payments/reconcile` — auto-reconcile
- `POST /api/payments/refund/:paymentId` — refund
- `POST /api/payments/refund-by-booking/:bookingId` — refund by booking

## Billing (Subscriptions)
- `POST /api/billing/checkout` — checkout
- `POST /api/billing/create-subscription` — create sub
- `GET /api/billing/status` — status
- `POST /api/billing/cancel` — cancel
- `POST /api/billing/portal` — customer portal
- `POST /api/billing/apple-verify` — Apple IAP verify

## Frontend
- `/payments` — history, Reconcile & Sync Tips, CSV export
- `/billing` — subscription management
- `/cash` — cash register & daily reports

## Key Booking Payment Fields
| Field | Description |
|---|---|
| `paid` | Payment completed (boolean) |
| `payment_method` | `terminal` / `cash` / `zelle` / `other` |
| `payment_id` | Square payment ID |
| `amount` | Service amount in $ (without tip) |
| `service_amount` | Service price (for payroll) |
| `tip` / `tip_amount` | Tip in $ |
| `tax_amount` / `fee_amount` | Tax/fees applied |
