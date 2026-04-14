# Billing & Subscriptions

> Part of [[Home]] > Features | See also: [[Payments]], [[iOS App]], [[API Routes]]

## Overview
Multi-provider billing: Stripe Checkout (web), Apple IAP (iOS), with trial management and plan gating.

## Plans

| Plan | Team Limit | Staff Limit | Key Features |
|------|-----------|-------------|-------------|
| `individual` | 1 | 1 | Basic booking, payments |
| `salon` | 10 | 10 | Memberships, analytics, team management |
| `custom` | Unlimited | Unlimited | Expenses, payroll, custom code, all features |

- **Trial**: 14 days with full custom plan access
- **Expired**: Restricted features, booking page stays active

## Frontend
- `/billing` page — plan selection, subscription management
- Apple IAP: uses native StoreKit 2 via JS bridge (see [[iOS App]])
- Stripe: checkout session redirect
- Plan badge visible in settings/dashboard

## Stripe Billing

### Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/billing/checkout` | Create Stripe checkout session |
| POST | `/api/billing/create-subscription` | Create subscription with incomplete payment |
| GET | `/api/billing/status` | Subscription status (trial/active/past_due/canceled) |
| POST | `/api/billing/cancel` | Cancel (routes to Stripe or Apple) |
| POST | `/api/billing/portal` | Stripe customer portal link |

### Webhook (`POST /api/stripe/webhook`)
Handles: `invoice.payment_succeeded`, `customer.subscription.deleted`, `customer.subscription.updated`
- Updates workspace `billing_status` and `plan_type`

## Apple IAP

### Product IDs
- `individual_monthly`, `salon_monthly`, `custom_monthly`

### Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/billing/apple-verify` | Verify Apple transaction |
| POST | `/api/billing/apple-validate-receipt` | Validate Apple receipt |
| POST | `/api/webhooks/apple` | Apple IAP server notification |

### Flow
1. Web calls `purchase` JS bridge handler (see [[iOS App]])
2. StoreKit 2 purchase dialog
3. Receipt → `/api/billing/apple-verify`
4. Backend validates → activates subscription → updates `plan_type`

## Plan Gating

### Backend
- `requirePlanFeature(feature)` middleware
- `getEffectivePlan()` — determines current plan from billing_status + subscription

### Frontend
- `PlanProvider.tsx` — plan context
- `FeatureGate.tsx` — conditionally renders based on plan
- `UpgradeGate.tsx` — shows upgrade prompt

### Feature Matrix
| Feature | Individual | Salon | Custom |
|---------|-----------|-------|--------|
| Booking | yes | yes | yes |
| Payments | yes | yes | yes |
| Memberships | no | yes | yes |
| Analytics | basic | full | full |
| Payroll | no | no | yes |
| Expenses | no | no | yes |
| Custom code | no | no | yes |
| Team size | 1 | 10 | unlimited |
