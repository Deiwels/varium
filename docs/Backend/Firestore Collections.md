# Firestore Collections

> Part of [[Home]] > Backend | See also: [[Database Schema]], [[API Routes]], [[Tech Stack]]

## Top-Level (11)

| Collection | Purpose |
|-----------|---------|
| `workspaces` | Multi-tenant root — each business is a workspace |
| `slugs` | URL slug → workspace ID mapping |
| `rate_limits` | API rate limiting |
| `security_log` | Global security events |
| `global_security_log` | Global security log |
| `sms_logs` | SMS delivery logs |
| `vurium_analytics` | Platform analytics |
| `vurium_config` | OAuth tokens, platform config |
| `vurium_emails` | Internal emails |
| `vurium_dev_logins` | Developer auth sessions |
| `vurium_diagnostics` | AI diagnostic scan results |

## Workspace Sub-Collections (13)

Path: `workspaces/{workspaceId}/...`

| Sub-Collection | Purpose |
|---------------|---------|
| `users` | Users with roles (admin/manager/staff) |
| `barbers` | Staff members |
| `services` | Service catalog |
| `bookings` | Appointments |
| `clients` | Customer records |
| `settings` | Workspace settings (single doc) |
| `audit_logs` | Action audit trail |
| `device_tokens` | Push notification tokens |
| `crm_push_tokens` | CRM-specific push tokens |
| `phone_verify` | Phone verification codes |
| `applications` | Job applications |
| `analytics` | Business analytics events |
| `security_log` | Workspace security events |

## Data Model

```
workspaces/{wsId}
├── users/{userId}          — { name, email, role, phone }
├── barbers/{barberId}      — { name, schedule, services[] }
├── services/{serviceId}    — { name, price, duration }
├── bookings/{bookingId}    — { client, barber, service, date, status }
├── clients/{clientId}      — { name, phone, email, notes }
├── settings/main           — { timezone, theme, features }
└── ...
```
