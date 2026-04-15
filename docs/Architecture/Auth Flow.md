# Authentication Flow

> Part of [[Home]] > Architecture | See also: [[Tech Stack]], [[API Routes]], [[App Routes]], **⚠️ [[Web-Native-Auth-Contract]]** (load-bearing web ↔ iOS cookie contract — read before touching middleware / auth-cookie / Shell)

## Methods
1. **Email/Password** — `/auth/signup`, `/auth/login-email`
2. **Apple Sign-In** — `/auth/apple-signin` + OAuth callback
3. **Google Sign-In** — `/auth/google-signin` + OAuth callback

## Token Management
- JWT tokens stored in HTTP-only cookies
- Cookie format: `role:uid` (see `lib/auth-cookie.ts`)
- 7-day expiration
- Secure + HttpOnly flags

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
