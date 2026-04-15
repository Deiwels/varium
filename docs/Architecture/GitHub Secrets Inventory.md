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

---

## Rotation Protocol per Secret (Emergency Procedures)

> Per AI4-REQ.5 — AI 4 needs clear rollback paths when secrets rotate unexpectedly.

### Critical Secrets (P0 — immediate impact if rotated)

| Secret | What breaks if rotated | Emergency rollback | Rotation procedure | Owner action required |
|---|---|---|---|---|
| `TELNYX_WEBHOOK_PUBLIC_KEY` | All Telnyx webhooks 401, STOP/HELP/10DLC updates stop | Comment out `verifyTelnyxWebhookSignature()` in backend — **security regression, Owner must approve** | 1. Get new key from Telnyx portal<br>2. Update GitHub Secret<br>3. Redeploy backend<br>4. Verify webhooks in logs | Yes — Telnyx portal access |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhooks 401, payments don't process | Revert to older endpoint version or temporary bypass — **payment-critical, Owner must approve** | 1. Stripe Dashboard → Developers → Webhooks → Reveal secret<br>2. Update GitHub Secret<br>3. Redeploy<br>4. Test payment flow | Yes — Stripe Dashboard |
| `JWT_SECRET` | All auth fails, no one can login | **No rollback possible** — must rotate immediately and force all users re-login | 1. Generate new secret<br>2. Update GitHub Secret<br>3. Redeploy<br>4. All sessions invalidated | Yes — force re-login for all users |

### High Priority Secrets (P1 — feature degradation)

| Secret | What breaks | Emergency workaround | Rotation procedure |
|---|---|---|---|
| `TELNYX_API_KEY` | SMS sending stops, OTP fails | OTP falls back to local code; reminders stop | Telnyx portal → API Keys → Regenerate |
| `ANTHROPIC_API_KEY` | AI features stop | Disable AI features temporarily | Anthropic console → API Keys |
| `RESEND_API_KEY` | Transactional emails stop | Queue emails for later retry | Resend dashboard → API Keys |
| `SQUARE_APP_SECRET` | Square terminal/payments fail | Fall back to Stripe-only | Square Developer Dashboard |

### Medium Priority Secrets (P2 — workaround exists)

| Secret | What breaks | Emergency workaround | Rotation procedure |
|---|---|---|---|
| `GOOGLE_CLIENT_SECRET` | Google OAuth login fails | Use email/password login | Google Cloud Console → Credentials |
| `APNS_KEY_P8` | iOS push notifications stop | No immediate workaround — queue for retry | Apple Developer Portal → Keys |
| `GMAIL_CLIENT_ID/SECRET` | Developer panel email stops | No immediate workaround | Google Cloud Console → OAuth |

### Rotation Checklist (Owner must follow)

When rotating ANY secret:

1. **Before rotation:**
   - [ ] Check this table for impact level
   - [ ] If P0 — notify AI 4 to standby
   - [ ] If P0 — prepare for possible emergency fix

2. **During rotation:**
   - [ ] Update GitHub Secret
   - [ ] Trigger redeploy (or wait for next push)
   - [ ] Monitor logs for errors

3. **After rotation:**
   - [ ] Verify critical flows (login, payment, SMS)
   - [ ] Update this file with new snapshot date
   - [ ] DevLog entry: `Secret rotated: <name>`

### Emergency: Secret rotated by accident / without preparation

**If you (Owner) didn't rotate it but things broke:**

1. Check GitHub Security logs → Audit log → Secrets
2. If unauthorized access suspected — **this is security incident**
3. Immediately rotate ALL secrets in that category
4. Activate AI 4: `@AI4 [EMERGENCY]: suspected secret leak`
5. AI 4 will: assess impact, apply temporary fixes, coordinate with AI 1/2/3

### Last-known-good secret values

**Important:** GitHub Secrets are encrypted. We cannot store "last known good" values in docs.

**Alternative:** Owner should maintain offline backup (1Password, secure vault) of:
- `JWT_SECRET` (if you need to restore old sessions)
- `TELNYX_WEBHOOK_PUBLIC_KEY` (previous version, in case new one fails)
- `STRIPE_WEBHOOK_SECRET` (previous endpoint version)

---

*Rotation protocol section added by AI 3 (Verdent) per AI4-REQ.5 · 2026-04-15*
