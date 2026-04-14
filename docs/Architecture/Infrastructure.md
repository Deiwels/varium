# Infrastructure & Deployment

> Part of [[Home]] > Architecture | See also: [[Tech Stack]], [[Background Jobs]], [[Security & Audit]]

## Hosting

| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Vercel | vurium.com |
| Backend | Google Cloud Run | vuriumbook-api-431945333485.us-central1.run.app |
| Database | Google Cloud Firestore | us-central1 |
| iOS App | App Store | com.vurium.VuriumBook |

## CI/CD

### Frontend (Vercel)
- Auto-deploys on `git push` to `main`
- No workflow file needed — Vercel watches repo
- Framework: Next.js (detected automatically)

### Backend (GitHub Actions → Cloud Run)
- File: `.github/workflows/deploy-backend.yml`
- Trigger: push to `main` with changes in `backend/**`
- Steps: Build Docker → Push to GCR → Deploy to Cloud Run
- Auth: Workload Identity Federation (no service account key)
- On failure: shows last 50 Cloud Run logs

### Cloud Run Config
```
Memory: 1Gi
CPU: 1
Timeout: 300s
Min instances: 0
Max instances: 10
Port: 8080
```

## Environment Variables

### Frontend (.env.local)
- `NEXT_PUBLIC_API_BASE_URL` — backend API URL
- `NEXT_PUBLIC_WORKSPACE_ID` — workspace identifier
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Stripe public key

### Backend (GitHub Secrets → Cloud Run env)

| Category | Variables |
|----------|-----------|
| GCP | `GCP_PROJECT_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT` |
| Auth | `JWT_SECRET`, `PHONE_ENCRYPTION_KEY` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_INDIVIDUAL`, `STRIPE_PRICE_SALON`, `STRIPE_PRICE_CUSTOM` |
| Square | `SQUARE_APP_ID`, `SQUARE_APP_SECRET` |
| SMS | `TELNYX_API_KEY`, `TELNYX_FROM` |
| Email | `RESEND_API_KEY` |
| Apple | `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_KEY_P8`, `APNS_BUNDLE_ID`, `APNS_ENVIRONMENT`, `APPLE_SHARED_SECRET` |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` |
| Admin | `ADMIN_EMAIL`, `ADMIN_NOTIFY_EMAIL`, `FRONTEND_URL` |
| AI | `ANTHROPIC_API_KEY` |

## Security Headers (next.config.mjs)

| Header | Value |
|--------|-------|
| X-Frame-Options | DENY |
| X-Content-Type-Options | nosniff |
| Referrer-Policy | strict-origin-when-cross-origin |
| HSTS | max-age=31536000; includeSubDomains; preload |
| X-XSS-Protection | 1; mode=block |
| Permissions-Policy | camera=(), microphone=(), geolocation=(), payment=() |

### Content Security Policy
- Scripts: self, unsafe-inline, unsafe-eval, js.stripe.com, facebook, googleapis
- Connect: self, stripe, googleapis, telnyx, resend, Cloud Run
- Frames: stripe only
- Images: self, data, blob, https, http
- Objects: none

## Analytics (va.js)
Lightweight privacy-friendly tracker at `/public/va.js`:
- Generates visitor ID (`_va_vid`) in localStorage
- Generates session ID (`_va_sid`) in sessionStorage
- Tracks: URL path, referrer, screen resolution
- Sends via `sendBeacon()` to `/t` endpoint
- Hooks: pageview, pushState, replaceState, popstate
- No cookies, no third-party tracking

## Middleware (middleware.ts)
Edge middleware for auth & routing. See [[Auth Flow]] for details.

### Public paths (no auth):
`/`, `/signin`, `/signup`, `/book`, `/privacy`, `/terms`, `/cookies`, `/dpa`, `/accessibility`, `/support`, `/manage-booking`, `/reset-password`, `/waitlist`, `/vuriumbook`

### Role-based route protection:
- **Owner/Admin**: full access
- **Barber**: calendar, history, messages, waitlist, portfolio, clients → redirects from admin routes
- **Student**: calendar, messages only
- **Guest**: calendar, clients (read-only)
- **Developer panel**: separate auth via `vurium_admin_token` cookie

## Docker

### Frontend (Dockerfile in root)
```dockerfile
FROM node:20-alpine
# Standard Next.js build + start
```

### Backend (backend/Dockerfile)
```dockerfile
FROM node:20-alpine
# npm install + npm start
```

## Firestore Indexes
File: `backend/firestore.indexes.json`
- Composite indexes for optimized queries
- Deployed via `gcloud firestore indexes create`

## Public Assets

| File | Purpose |
|------|---------|
| `logo.jpg`, `logo-white.jpg` | Brand logos |
| `favicon.ico`, `favicon-16/32.png` | Browser favicons |
| `icon-192.png`, `icon-512.png` | PWA icons |
| `apple-touch-icon.png` | iOS home screen |
| `screenshots/` | App screenshots (dashboard, calendar, analytics) |
| `sms-optin-screenshot.png` | SMS opt-in UX screenshot |
| `.well-known/apple-developer-merchantid-domain-association` | Apple Pay domain verification |
