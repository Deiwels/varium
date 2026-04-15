# Authentication Flow

> Part of [[Home]] > Architecture | See also: [[Tech Stack]], [[API Routes]], [[App Routes]], **⚠️ [[Web-Native-Auth-Contract]]** (load-bearing web ↔ iOS cookie contract — read before touching middleware / auth-cookie / Shell)

## Methods
1. **Email/Password** — `/auth/signup`, `/auth/login-email`
2. **Apple Sign-In** — `/auth/apple-signin` + OAuth callback
3. **Google Sign-In** — `/auth/google-signin` + OAuth callback

## Token Management
- Canonical web role cookie: `VURIUMBOOK_TOKEN` (`role:uid`) for route gating in `middleware.ts`
- Web bearer token is also mirrored in `localStorage.VURIUMBOOK_TOKEN` because the shipped iOS `WKWebView` wrapper still restores sessions through localStorage/bootstrap code
- Native iOS persists auth in `UserDefaults.vurium_auth_token` and `UserDefaults.vurium_user_json`
- Legacy/native cookie aliases still accepted for backward compatibility:
  - `vuriumbook_auth`
  - `vuriumbook_token`
- 7-day expiration
- Secure + HttpOnly flags

**Important:** do not treat production auth as cookie-only yet. The current system is hybrid until the native wrapper is aligned. See [[Web-Native-Auth-Contract]].

## MFA (Multi-Factor Authentication)
- Setup: `POST /api/auth/mfa/setup`
- Verify: `POST /api/auth/mfa/verify`
- Disable: `POST /api/auth/mfa/disable`
- Status: `GET /api/auth/mfa/status`

## PIN Security
- Local PIN authentication for quick access
- SHA-256 hashing + AES encryption (`lib/pin.ts`)
- Credentials stored locally (encrypted)

## Password Reset
1. `POST /auth/forgot-password` — sends reset email
2. `POST /auth/reset-password` — completes reset
3. Frontend: `/reset-password` page

## Role-Based Access
- **Roles:** admin, manager, staff
- Managed via `PermissionsProvider.tsx`
- API: `GET/POST /api/settings/permissions`

## Flow Diagram

```
User → Sign In Page → Email/Apple/Google
                         │
                    JWT Cookie Set
                         │
                    Dashboard (Shell.tsx)
                         │
                    PIN Check (if enabled)
                         │
                    PermissionsProvider
                         │
                    Role-based UI
```
