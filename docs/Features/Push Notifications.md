# Push Notifications

> Part of [[Home]] > Features | See also: [[iOS App]], [[API Routes]], [[Booking System]]

## Overview
APNs push notifications for booking updates, messages, attendance, and staff requests. Works on iOS native app.

## Device Token Registration

### Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/push/register` | Register device token |
| POST | `/api/push/unregister` | Unregister device |
| GET | `/api/push/status` | Push service status |

### Registration Payload
```json
{
  "device_token": "<apns_token>",
  "platform": "ios",
  "app": "vuriumbook",
  "user_id": "<uid>",
  "user_name": "<name>",
  "role": "<admin|barber|staff>"
}
```

### Firestore
- Collection: `workspaces/{wsId}/device_tokens`
- Also: `workspaces/{wsId}/crm_push_tokens` (CRM push tokens)
- Dedup across workspaces by token (removes from other workspaces)

## Notification Types

| Type | Trigger | Sound | Deep Link |
|------|---------|-------|-----------|
| `message` | New DM/chat message | yes | `/messages?tab={chatType}` |
| `booking_confirmed` | Booking confirmed | silent | `/calendar` |
| `booking_cancelled` | Booking cancelled | silent | `/calendar` |
| `request` | Staff request submitted | yes | `/messages?tab=requests` |
| `attendance` | Clock in/out event | yes | `/attendance` |
| Default | Other notifications | no | `/dashboard` |

## Push Settings (per workspace)
- `push_remind_24h` — 24-hour booking reminder
- `push_remind_2h` — 2-hour booking reminder
- `push_reschedule` — reschedule notification
- `push_cancel` — cancellation notification
- `push_waitlist` — waitlist notification

## When Push is Sent
- New booking created → owner/barber notified
- Booking cancelled → barber notified
- New message in chat → recipient notified
- Staff request submitted → owner notified
- Request approved/rejected → staff notified
- Waitlist auto-fill → client notified (if has token)
- Ghost barber detected → affected clients notified
