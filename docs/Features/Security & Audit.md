# Security & Audit

> Part of [[Home]] > Features | See also: [[Auth Flow]], [[API Routes]], [[Role Permissions]]

## Rate Limiting

### API Rate Limits
- Global auth middleware on all `/api/` routes
- Firestore-based rate limits (persistent across restarts)
- In-memory rate limits for booking endpoints
- `resetSecurityCounters()` clears brute force counters every 3 minutes

### Booking Rate Limiter
- Max 3 bookings per phone/email per hour per workspace
- In-memory sliding window, returns `429`
- Auto-cleanup every 10 minutes

### Auth Rate Limits
- Password reset: 3 per 15 min per IP
- Login attempts: tracked per email

### Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| DELETE | `/api/admin/cleanup-rate-limits` | Clear rate limit counters |

## Security Logging

### Firestore Collections
- `security_log` — global security events
- `global_security_log` — platform-wide log
- `workspaces/{wsId}/security_log` — per-workspace events

### What's Logged
- Login failures (email, IP, timestamp)
- Mass operations (bulk deletes, imports)
- Webhook events (Stripe, Square, Telnyx, Apple)
- Rate limit violations
- Admin actions (user creation, role changes)

### Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/security-log` | Platform security log (200 latest) |

## Audit Logging

### Firestore
- Collection: `workspaces/{wsId}/audit_logs`

### What's Audited
- Resource creation, update, deletion
- Settings changes
- Permission changes
- Billing events

### Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/audit-logs` | Workspace audit logs (200 latest) |

## Data Export (GDPR)

### Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/data-export` | Export user data (authenticated) |
| GET | `/public/data-export/:token` | Download via token (public) |

### What's Exported
- User profile data
- All bookings (by user or phone)
- Client records matching user's phone
- Generated as CSV/JSON

## Debug Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/debug-booking/:id` | Debug booking state (owner/admin) |

## Auth Security
- JWT tokens in HTTP-only cookies (7-day, secure)
- PIN-based local auth (SHA-256 + AES)
- MFA support (TOTP)
- Role-based permissions (admin/manager/staff)
- See [[Auth Flow]] for full details
