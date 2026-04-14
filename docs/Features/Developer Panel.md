# Developer Panel

> Part of [[Home]] > Features | See also: [[App Routes]], [[Auth Flow]], [[API Routes]], [[SMS & 10DLC]]

Private platform admin dashboard at `/developer` for managing `vurium.com`. Access is limited to the platform owner through a separate magic-link auth flow.

## Access
- URL: `vurium.com/developer`
- Auth: magic link sent to `ADMIN_EMAIL`
- Session: 24h HttpOnly cookie plus mirrored local token for the developer SPA
- Security: rate-limited magic-link requests, one-time-use link tokens, login IP logging

## Pages

### Overview (`/developer`)
- Platform-wide workspace counts, plan mix, signup trend
- Full workspace table with search, sorting, CSV export
- Per-workspace counts for bookings, clients, staff, and current SMS state

### Analytics (`/developer/analytics`)
- Privacy-friendly first-party analytics (`public/va.js` → `POST /t`)
- Pageviews, unique visitors, sessions, top pages, referrers, device/browser mix
- Funnel summary and country breakdown when backend fields exist

### Email (`/developer/email`)
- Gmail integration for inbox triage
- Branded outbound email composer
- Sent history, reply flow, CC/BCC support

### SMS (`/developer/sms`)
- Developer operations view for the current launch SMS architecture
- New workspaces: **toll-free-first**
- Grandfathered / pending businesses: **manual 10DLC path stays intact**
- Shows:
  - verify-profile readiness
  - workspaces that still need toll-free provisioning
  - pending / in-progress manual review states
  - already-configured workspace senders
- Allows superadmin provisioning via `POST /api/vurium-dev/sms/provision`
- Explicitly protects `Element Barbershop` as the live legacy/manual review case

### AI Diagnostics (`/developer/ai`)
- Scan history and issue breakdown
- Severity filtering
- Current issue cards and health snapshots

## Architecture
- Frontend: Next.js App Router pages under `app/developer/`
- Backend: Express routes under `/api/vurium-dev/*` guarded by `requireSuperadmin`
- Auth: separate developer JWT (`ADMIN_JWT_SECRET`), not tied to workspace users
- Analytics: Firestore collection `vurium_analytics`
- Email: Firestore collection `vurium_emails`
- SMS admin view:
  - workspace rollup comes from `GET /api/vurium-dev/platform`
  - rollout metadata comes from `GET /api/vurium-dev/sms/status`
  - toll-free provisioning goes through `POST /api/vurium-dev/sms/provision`

## Current SMS Model Reflected in Developer Panel
- Default launch path: toll-free-first for new workspaces
- Legacy path: manual / grandfathered 10DLC for existing or in-review businesses
- Protected regression case: `Element Barbershop`
- OTP remains on the public Telnyx Verify routes and is tracked operationally here only as readiness, not as a per-workspace sender

## Env Vars

| Variable | Where | Purpose |
|----------|-------|---------|
| `ADMIN_EMAIL` | Cloud Run | Who receives developer magic links |
| `ADMIN_NOTIFY_EMAIL` | Cloud Run | Where inbound email notifications are forwarded |
| `ADMIN_JWT_SECRET` | Cloud Run | JWT secret for developer sessions |
| `FRONTEND_URL` | Cloud Run | Used in magic-link URLs |
| `TELNYX_VERIFY_PROFILE_ID` | Cloud Run | Enables the real Telnyx Verify path for OTP |
