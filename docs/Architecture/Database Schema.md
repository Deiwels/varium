# Firestore Database Schema

## Top-Level Collections

| Collection | Purpose |
|-----------|---------|
| `workspaces` | Main business entities (multi-tenant root) |
| `slugs` | Human-readable booking URL mappings |
| `rate_limits` | API rate limiting tracking |
| `security_log` | Global security events |
| `global_security_log` | Global security log |
| `sms_logs` | SMS message logs |
| `vurium_analytics` | Platform-wide analytics |
| `vurium_config` | Configuration (OAuth tokens, etc.) |
| `vurium_emails` | Internal email records |
| `vurium_dev_logins` | Developer login tracking |
| `vurium_diagnostics` | AI diagnostic scans |

## Workspace Sub-Collections

Path: `workspaces/{wsId}/...`

| Sub-Collection | Purpose |
|---------------|---------|
| `users` | Workspace users with roles |
| `barbers` | Staff members (terminology varies by business type) |
| `services` | Service offerings with pricing |
| `bookings` | Appointment records |
| `clients` | Customer records |
| `settings` | Workspace configuration |
| `audit_logs` | Workspace audit trail |
| `device_tokens` | Push notification tokens |
| `crm_push_tokens` | CRM push tokens |
| `phone_verify` | Phone verification records |
| `applications` | Job applications |
| `analytics` | Workspace-specific analytics |
| `security_log` | Workspace-specific security log |

## Multi-Tenancy Model

```
workspaces/{wsId}
├── users/
├── barbers/
├── services/
├── bookings/
├── clients/
├── settings/
├── audit_logs/
├── device_tokens/
├── applications/
├── analytics/
└── security_log/
```

All workspace data is scoped under `workspaces/{wsId}/` for complete tenant isolation.
