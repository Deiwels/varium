# Messages & Chat

> [[Home]] > Features | Status: **Live** | Plan: Salon+

## Overview
Real-time team messaging system with direct messages, group channels, and file sharing. iOS push notifications via APNs.

## Chat Types

| chatType | Audience | Push Target |
|---|---|---|
| `team` / `general` | All staff (owner, admin, barber) | All roles (excl. sender) |
| `barbers` | Barbers only | barber role |
| `admins` | Owner + Admin | owner, admin roles |
| `students` | Students only | student role |
| `dm_{uid1}_{uid2}` | Two specific users (sorted) | Other user only |

### DM chatType Format
```
dmChatType(a, b) = 'dm_' + [a, b].sort().join('_')
```
Both users generate the same key regardless of who opens the conversation.

## Message Schema (Firestore: `messages` subcollection)
```
{
  content: string,        // sanitized text
  chatType: string,       // see table above
  sender_id: string,      // user doc ID from users collection
  sender_name: string,
  sender_role: string,
  senderPhoto?: string,
  imageUrl?: string,      // base64 or URL
  audioUrl?: string,      // voice recording
  fileUrl?: string,       // file attachment
  fileName?: string,
  createdAt: ISO string,
  reactions?: { emoji: uid[] }
}
```

## API Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/messages` | GET | `messages` feature | Fetch messages by chatType (limit 100) |
| `/api/messages` | POST | `messages` feature | Send message |
| `/api/messages/dm-previews` | GET | `messages` feature | Last message per DM for chat list |
| `/api/messages/:id/reactions` | PATCH | `messages` feature | Toggle emoji reaction |
| `/api/staff` | GET | Any authenticated | Staff list with user IDs for DM routing |
| `/api/messages/fix-dm` | POST | Owner | Migration: fix broken dm__ chatTypes |

## Features

### Text, Images, Voice, Files
- Text messages with sanitization
- Image paste from clipboard or attach via + menu
- Voice recording with waveform animation
- File attachments (max 10MB)

### Reactions
- Long-press or right-click on message bubble
- 6 emoji reactions: thumbs up, heart, laugh, fire, clap, sad
- Shows reaction counts with user list

### DM Preview
- Chat list shows last message + relative time for each DM contact
- "You: ..." prefix for own messages
- "No messages yet" for empty conversations

### Polling
- Messages refresh every 15 seconds (visibility-aware — pauses when tab hidden)

## Push Notifications (iOS APNs)

### Flow
1. iOS app registers device token via `POST /api/push/register`
2. Token stored in Firestore `crm_push_tokens` with user_id, role, barber_id
3. On message send, backend dispatches APNs push:
   - DM → push to other user only
   - Group → push to matching roles, **excluding sender**

### Push Payload
```json
{
  "aps": { "alert": { "title": "...", "body": "..." }, "sound": "default", "mutable-content": 1 },
  "type": "message",
  "chatType": "..."
}
```

### Configuration
Env vars: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_KEY_PATH`, `APNS_ENV` (sandbox/production)

## iOS Mobile Optimizations

- `visualViewport` handler with `requestAnimationFrame` + `translateY` for smooth keyboard handling
- `position: fixed` on html/body prevents Safari bounce
- `touchmove` blocked on container (except message list) during keyboard open
- Input `fontSize: 16px` prevents iOS auto-zoom
- `will-change: height, transform` for GPU acceleration
- `env(safe-area-inset-bottom)` padding on input bar

## Frontend Architecture

### State
- `user` — from localStorage `VURIUMBOOK_USER`
- `uid` — `user.uid || user.id` (fallback for login variants)
- `staffList` — from `/api/staff` (user collection IDs)
- `dmPreviews` — from `/api/messages/dm-previews`
- `messages` — current conversation messages
- `chatTarget` — `{ chatType, label, photo }`
- `chatView` — `'list' | 'conversation'`

### Tabs
- **Chat** — Team Chat + Direct Messages list → Conversation view
- **Requests** — Schedule/photo/profile change requests (barbers submit, owner/admin review)

### Key Files
- Frontend: `app/messages/page.tsx`
- Backend: `backend/index.js` (search: `// MESSAGES`)
- Shell (bottom nav): `components/Shell.tsx`

## Known Issues / History
- **2026-04-04**: DMs broken — `uid` was empty in localStorage causing `dm__recipientId` chatType. Fixed 2026-04-13 with uid fallback + migration.
- **2026-04-13**: Applications tab removed from Messages (moved to separate flow if needed).
