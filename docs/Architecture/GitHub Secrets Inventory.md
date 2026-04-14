# GitHub Secrets Inventory

> Part of [[Home]] > Architecture | See also: [[Infrastructure]], [[Tasks/Telnyx-Integration-Plan|Telnyx Integration Plan]]
> Snapshot source: owner-provided GitHub repository secrets list
> Snapshot date: 2026-04-14

This note records which repository secret names were explicitly confirmed in the GitHub UI.
It stores **names only**. No secret values belong in docs.

## Confirmed present in repository secrets

### Admin / platform
- `ADMIN_EMAIL`
- `ADMIN_NOTIFY_EMAIL`
- `FRONTEND_URL`

### AI
- `ANTHROPIC_API_KEY`

### APNs / Apple / iOS
- `APNS_BUNDLE_ID`
- `APNS_ENVIRONMENT`
- `APNS_KEY_ID`
- `APNS_KEY_P8`
- `APNS_TEAM_ID`
- `APPLE_SHARED_SECRET`

### GCP / deploy
- `GCP_PROJECT_ID`
- `GCP_SERVICE_ACCOUNT`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`

### Auth
- `JWT_SECRET`

### Google
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### Email
- `RESEND_API_KEY`

### Square
- `SQUARE_APP_ID`
- `SQUARE_APP_SECRET`

### Stripe
- `STRIPE_PRICE_CUSTOM`
- `STRIPE_PRICE_INDIVIDUAL`
- `STRIPE_PRICE_SALON`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

### Telnyx
- `TELNYX_API_KEY`
- `TELNYX_FROM`
- `TELNYX_WEBHOOK_PUBLIC_KEY`

## Not seen in the 2026-04-14 owner snapshot

These names were **not visible** in the owner-provided GitHub repository-secrets list and should be treated as unconfirmed / missing until checked again:

- `TELNYX_VERIFY_PROFILE_ID`
- `PHONE_ENCRYPTION_KEY`
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`

## Why this matters

- `TELNYX_WEBHOOK_PUBLIC_KEY` being present means the webhook-signature secret prerequisite is no longer theoretical; the remaining step is confirming a deployed backend revision has picked it up.
- `TELNYX_VERIFY_PROFILE_ID` not appearing in the snapshot strongly suggests OTP is still on the fallback path unless the secret was added later and this snapshot is stale.
- Older docs should not assume a secret exists just because the backend references it.

## Usage rule

When docs mention GitHub secrets, prefer this file as the owner-confirmed inventory snapshot until a newer GitHub UI check replaces it.
