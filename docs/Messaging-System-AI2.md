# Messaging System — AI 2 (Frontend & UX)

> [[Home]] > Frontend | See also: [[Messaging-System-AI1]], [[AI-Work-Split]], [[Production-Plan-AI2]]
>
> Owner: **AI 2 — Codex (Claude Web/Desktop)**
> Files: `lib/api.ts`, `lib/useVisibilityPolling.ts`
> Note: `app/messages/page.tsx` is owned by AI 1 — coordinate before editing
> Last updated: 2026-04-14

---

## Overview

AI 2 does **not** own the messages page (`app/messages/page.tsx` belongs to AI 1) but owns the shared utilities that power all API communication and polling. This document describes how the frontend messaging system works so AI 2 can safely work on connected components (Shell, notifications, DM previews in dashboard, etc.).

---

## How the frontend communicates with the backend

### `apiFetch()` — `lib/api.ts`

All API calls in the app go through `apiFetch()`.

```typescript
// Adds auth header automatically
apiFetch('/api/messages', {
  method: 'POST',
  body: JSON.stringify({ chatType, text, imageUrl })
})
```

**What apiFetch does:**
1. Reads JWT from `localStorage.VURIUMBOOK_TOKEN`
2. Adds `Authorization: Bearer <token>` header
3. On **401** response: auto-redirects to `/signin` or shows PIN prompt
4. Returns parsed JSON or throws

**Known security issue (see Production-Plan-AI2 §5.1):**
Token is in `localStorage` — vulnerable to XSS.
Backend already sets `vuriumbook_token` as httpOnly cookie.
Plan: remove localStorage read, use `credentials: 'include'` only.
**Do not change this without coordinating with AI 1** — backend must accept cookies too.

### API base URL
`https://vuriumbook-api-431945333485.us-central1.run.app`
Set as constant in `lib/api.ts`. Do not hardcode elsewhere.

---

## How polling works — `lib/useVisibilityPolling.ts`

The messaging system uses **polling, not WebSockets**.

```typescript
useVisibilityPolling(pollMessages, 15_000)
// Runs pollMessages() every 15 seconds
// Automatically pauses when browser tab is hidden (visibilitychange event)
// Resumes immediately when tab becomes visible again
```

Used in `app/messages/page.tsx` for fetching new messages.

**If you need polling in another component** (e.g., notification badge in Shell), use this same hook — do not create a new polling mechanism.

---

## Message data flow — what the frontend does

### Sending a message

1. User types text / attaches media
2. **Image compression** (client-side):
   - Canvas scaled to max 800px
   - `canvas.toDataURL('image/jpeg', quality)` — quality reduced until file ≤ 500KB
3. **Voice recording:**
   - `MediaRecorder` API → Blob → `FileReader.readAsDataURL()` → base64
4. **File attachment:**
   - `FileReader.readAsDataURL()` → base64, max 10MB enforced client-side
5. `apiFetch('POST /api/messages', { chatType, text, imageUrl, audioUrl, fileUrl, fileName, senderPhoto })`
6. Backend saves to Firestore + fires iOS push

### Receiving messages

```
pollMessages() → apiFetch('GET /api/messages?chatType=...&limit=100')
```

Response mapping (backend field → frontend field):
| Backend | Frontend |
|---|---|
| `content` | `text` |
| `sender_id` | `senderId` |
| `sender_role` | `senderRole` |

Messages are rendered as `MessageBubble` components.
Consecutive messages from the same sender: no avatar or name shown (grouped).

---

## Chat channel types

| chatType value | Who sees it |
|---|---|
| `team` | All staff |
| `barbers` | Barbers only |
| `admins` | Owner + Admin |
| `students` | Students only |
| `dm_{uid1}_{uid2}` | Two specific users |

### DM key formula — important
```typescript
// Always sort UIDs so both participants get the same key
function dmChatType(uid_a: string, uid_b: string): string {
  return 'dm_' + [uid_a, uid_b].sort().join('_');
}
```
**Critical:** use user doc IDs — not barber IDs.
(Bug fixed 2026-04-13: staff list was returning barber IDs → DM channels were broken.)

---

## Staff list and DM previews

On messages page mount, two calls are made:

**`GET /api/staff`**
Returns: `{ id, name, role, photo_url }[]`
The `id` field is the user doc ID. Use this for DM channel keys.

**`GET /api/messages/dm-previews`**
Returns: `{ chatType, text, senderName, senderId, time }[]`
One entry per DM channel the current user participates in.
Used to render the DM sidebar list with last-message previews.

---

## Reactions UI

The frontend implements a long-press (500ms) / right-click emoji picker overlay with 6 emojis:
`👍 ❤️ 😂 🔥 👏 😢`

When a reaction is selected:
```typescript
apiFetch(`/api/messages/${msgId}/reactions`, {
  method: 'PATCH',
  body: JSON.stringify({ emoji })
})
```

**Backend for this endpoint does not exist yet — it will 404.**
Do not build more UI on top of reactions until AI 1 implements the backend handler.
Track this in Backlog.md.

---

## Notification badge in Shell

If you need to show an unread message count badge in `components/Shell.tsx`:

1. Use `useVisibilityPolling` from `lib/useVisibilityPolling.ts`
2. Call `GET /api/messages/dm-previews` + compare `time` to last-seen timestamp stored in `localStorage`
3. Do **not** add a new `/api/` endpoint for this without coordinating with AI 1

Coordinate with AI 1 before touching `app/messages/page.tsx` for badge-related state lifts.

---

## Plan feature gate

The entire messages feature is gated behind the `salon` plan.
Enforced server-side. On the frontend, the gate is:

```tsx
<FeatureGate feature="messages">
  {/* messages UI */}
</FeatureGate>
```

If the workspace is not on the `salon` plan, the backend returns 403 and the FeatureGate hides the UI.

---

## Files relevant to AI 2

### Owned by AI 2
| File | Role |
|---|---|
| `lib/api.ts` | `apiFetch()` — all API communication |
| `lib/useVisibilityPolling.ts` | Polling hook used by messages and potentially Shell |

### Owned by AI 1 — coordinate before editing
| File | Note |
|---|---|
| `app/messages/page.tsx` | Main messages page — AI 1 owns this |
| `backend/index.js` | All backend message endpoints |

### Shared — coordinate before editing
| File | Note |
|---|---|
| `components/Shell.tsx` | If adding notification badge or unread count |

---

## Known issues relevant to AI 2

### Auth: localStorage token (Production-Plan-AI2 §5.1)
`apiFetch()` reads JWT from `localStorage` — XSS-vulnerable.
Plan is to move to httpOnly cookie only (`credentials: 'include'`).
**Do not start this change without AI 1 confirming backend accepts cookies.**

### Reactions endpoint returns 404
`PATCH /api/messages/:id/reactions` — backend not implemented.
Do not add more reactions UI until AI 1 ships the endpoint.

### No real-time updates
Messages page uses polling (15s interval). There is no WebSocket or Firestore real-time listener.
If the product ever moves to real-time, both AI 1 (backend) and AI 2 (useVisibilityPolling) need to change.

---

## How to test messaging locally

1. Start backend: `node backend/index.js` on Cloud Run or locally with env vars
2. In browser: log in as two different users in two tabs
3. Open `/messages` in both tabs
4. Send a message — should appear in the other tab within 15 seconds (next poll)
5. Check browser Network tab: `POST /api/messages` should return 201
6. Check iOS push: if device token registered, push should arrive on device within a few seconds of message send
