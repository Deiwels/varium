# Developer Panel

> Part of [[Home]] > Features | See also: [[App Routes]], [[Auth Flow]], [[API Routes]]

Private admin dashboard at `/developer` for managing the vurium.com platform. Only accessible by the platform owner via magic link authentication.

## Access
- URL: `vurium.com/developer`
- Auth: Magic link sent to `ADMIN_EMAIL` env var
- Session: 24h HttpOnly cookie
- Security: rate-limited, one-time use tokens, IP logging

## Pages

### Overview (`/developer`)
Platform-wide business metrics:
- Workspace count (total, paid, trialing, conversion rate)
- Signup trends (7d/30d chart)
- Plan distribution (Individual/Salon/Custom)
- Total bookings, clients, staff
- Full workspace table with details

### Analytics (`/developer/analytics`)
Custom privacy-friendly site tracking (no Google Analytics):
- Pageviews, unique visitors, sessions
- Top pages, referrers, device/browser breakdown
- Conversion funnel (landing → signup → completed)
- SVG charts, 7d/30d/90d range filter

### Email (`/developer/email`)
- Quick links to Google Workspace mailboxes (support, billing, sales, security)
- Branded email compose via Resend (dark cosmos template)
- Sent history
- Gmail API integration (planned)

## Architecture
- Frontend: Next.js pages in `app/developer/`
- Backend: Express endpoints under `/api/vurium-dev/*` with `requireSuperadmin` middleware
- Auth: Separate JWT system (`ADMIN_JWT_SECRET`), not linked to VuriumBook accounts
- Analytics: `public/va.js` tracker → `POST /t` → Firestore `vurium_analytics`
- Emails: Firestore `vurium_emails`

## Env Vars
| Variable | Where | Purpose |
|----------|-------|---------|
| ADMIN_EMAIL | Cloud Run | Who receives magic link |
| ADMIN_NOTIFY_EMAIL | Cloud Run | Where to forward inbound email notifications |
| ADMIN_JWT_SECRET | Cloud Run | JWT signing (auto-generated from JWT_SECRET if not set) |
| FRONTEND_URL | Cloud Run | For magic link URL (https://vurium.com) |
