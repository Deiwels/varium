# Email System

> Part of [[Home]] > Features | See also: [[Developer Panel]], [[Booking System]], [[API Routes]]

## Overview
Two email systems: (1) transactional emails sent to workspace clients/staff, (2) Gmail integration for platform admin in Developer Panel.

## Transactional Emails (Workspace)

### When Emails Are Sent
- **Booking confirmation** — to client after booking
- **Booking cancellation** — to client
- **Reschedule confirmation** — to client with new date/time
- **Welcome email** — to new team members (barber/admin) with role, login email, sign-in link
- **Password reset** — magic link to reset password
- **Satisfaction ping** — post-visit "How was your visit?" with star rating + Google Review button
- **Ghost barber alert** — to affected clients with reschedule/rebook links
- **Waitlist auto-fill** — "A spot just opened up!" notification
- **Payroll audit warning** — to owner when audit finds issues

### Email Format
- Branded HTML templates
- Workspace-specific styling
- Includes workspace name, logo

## Gmail Integration (Developer Panel)

### OAuth Flow
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/vurium-dev/gmail/auth` | Start Gmail OAuth |
| GET | `/api/vurium-dev/gmail/callback` | OAuth callback |
| GET | `/api/vurium-dev/gmail/status` | Check connection status |

### Message Management
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/vurium-dev/gmail/messages` | List messages (paginated) |
| GET | `/api/vurium-dev/gmail/messages/:id` | Message details |
| POST | `/api/vurium-dev/gmail/send` | Send email |
| POST | `/api/vurium-dev/gmail/reply` | Reply to email |

### Inbound Email (Webhook)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/vurium-dev/email/inbound` | Receive inbound emails |
| GET | `/api/vurium-dev/emails` | List inbound emails |
| GET | `/api/vurium-dev/emails/:id` | Email details |
| PATCH | `/api/vurium-dev/emails/:id` | Mark read/archived |

### Frontend
- `/developer/email` — email management dashboard
- `/developer/email/[id]` — individual email view
- Full threaded conversation support

## Direct Email (Admin)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/vurium-dev/email/send` | Send email directly (admin only) |
