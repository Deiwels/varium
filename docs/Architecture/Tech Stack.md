# Tech Stack

> Part of [[Home]] > Architecture | See also: [[Database Schema]], [[Auth Flow]], [[ARCHITECTURE]]

## Frontend
- **Framework:** Next.js 15 (App Router)
- **UI:** React 19, TypeScript
- **Payments UI:** @stripe/react-stripe-js
- **Styling:** Custom CSS + AI-generated themes (Dark Cosmos style)

## Backend
- **Server:** Express.js on Node.js
- **Database:** Google Cloud Firestore (NoSQL)
- **Auth:** JWT tokens, 7-day cookies (`role:uid` format)
- **File Storage:** Google Cloud Storage

## Integrations
| Service | Purpose |
|---------|---------|
| Stripe Connect | Payment processing, subscriptions |
| Square | Alternative POS & payment |
| Telnyx | SMS notifications, OTP |
| Apple Sign-In | OAuth login |
| Google Sign-In | OAuth login |
| Anthropic Claude | AI style generation |

## Infrastructure
- **Frontend hosting:** Vercel
- **Backend hosting:** Google Cloud Run
- **CI/CD:** GitHub Actions (`.github/workflows/`)

## Security
- PIN-based local auth (SHA-256 + AES)
- MFA support (setup/verify/disable)
- Rate limiting (Firestore-based)
- Role-based permissions (admin/manager/staff)
- Security audit logging
