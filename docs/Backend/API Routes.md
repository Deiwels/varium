# API Routes

> Part of [[Home]] > Backend | See also: [[Firestore Collections]], [[Auth Flow]], [[Database Schema]]

> 193 endpoints in `backend/index.js`

## Auth (16 routes)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/signup` | Registration |
| POST | `/auth/login-email` | Email login |
| POST | `/auth/login` | Standard login |
| POST | `/auth/apple-signin` | Apple OAuth |
| POST | `/auth/google-signin` | Google OAuth |
| POST | `/auth/setup-owner` | Owner setup |
| POST | `/auth/forgot-password` | Password reset request |
| POST | `/auth/reset-password` | Password reset |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/logout` | Logout |
| POST | `/api/auth/change-password` | Change password |
| POST | `/api/auth/mfa/setup` | MFA setup |
| POST | `/api/auth/mfa/verify` | MFA verify |
| POST | `/api/auth/mfa/disable` | MFA disable |
| GET | `/api/auth/mfa/status` | MFA status |
| DELETE | `/api/auth/delete-account` | Delete account |

## Barbers / Services / Clients
| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/barbers` | List / Create |
| GET/PATCH/DELETE | `/api/barbers/:id` | Get / Update / Delete |
| PATCH | `/api/barbers/:id/schedule-override` | Override schedule |
| GET/POST | `/api/services` | List / Create |
| PATCH/DELETE | `/api/services/:id` | Update / Delete |
| GET/POST | `/api/clients` | List / Create |
| GET/PATCH/DELETE | `/api/clients/:id` | CRUD |
| GET | `/api/clients/:id/history` | Booking history |

## Bookings & Availability
| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/bookings` | List / Create |
| PATCH/DELETE | `/api/bookings/:id` | Update / Delete |
| POST | `/api/availability` | Check availability |
| POST | `/public/availability/:wsId` | Public availability |
| POST | `/public/bookings/:wsId` | Public booking |
| POST | `/public/bookings-group/:wsId` | Group booking |
| GET | `/public/manage-booking` | Manage booking |
| POST | `/public/manage-booking/cancel` | Cancel |
| POST | `/public/manage-booking/reschedule` | Reschedule |
| GET | `/api/booking-audit/status` | Smart booking audit results |

## Payments & Billing
See [[Payments]] for full breakdown.

## Users & Permissions
| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/users` | List / Create |
| GET | `/api/users/students` | Student users |
| PATCH/DELETE | `/api/users/:id` | Update / Delete |
| GET | `/api/staff` | List staff |
| GET/POST | `/api/settings/permissions` | Permissions |

## Attendance & Payroll
See [[Attendance & Payroll]] for full breakdown.

## Public Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/public/resolve/:slugOrId` | Resolve workspace |
| GET | `/public/services/:wsId` | Public services |
| GET | `/public/barbers/:wsId` | Public barbers |
| GET | `/public/config/:wsId` | Workspace config |
| GET | `/public/reviews/:wsId` | Public reviews |
| POST | `/public/verify/send/:wsId` | Send verification |
| POST | `/public/verify/check/:wsId` | Check verification |

## Webhooks
| Method | Path | Source |
|--------|------|--------|
| POST | `/api/stripe/webhook` | Stripe |
| POST | `/api/webhooks/stripe-connect` | Stripe Connect |
| POST | `/api/webhooks/square` | Square |
| POST | `/api/webhooks/telnyx` | Telnyx SMS |
| POST | `/api/webhooks/apple` | Apple |

## Health
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check |
| GET | `/health/db` | DB health |
