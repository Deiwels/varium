# Messaging System — AI 1 (Backend & Infrastructure)

> [[Home]] > Backend | See also: [[Messaging-System-AI2]], [[AI-Work-Split]], [[Production-Plan-AI1]]
>
> Owner: **AI 1 — Claude Code CLI**
> Files: `backend/index.js`, `app/messages/page.tsx`
> Last updated: 2026-04-14

---

## Overview

The messaging system has **four independent layers**. AI 1 owns all backend logic for every layer.

| Layer | Technology | Direction |
|---|---|---|
| In-app staff chat | Firestore + polling | Internal (staff only) |
| SMS to clients | Telnyx | Outbound to clients |
| Transactional email | Resend | Outbound to clients/staff |
| iOS push | APNs (HTTP/2) | Outbound to staff iOS app |

---

## Layer 1 — In-App Staff Chat

### Backend file location
`backend/index.js` — search comment `// MESSAGES` (~line 5617)

### Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/messages` | Fetch messages by chatType, limit 100, ordered by `createdAt desc` |
| `POST` | `/api/messages` | Save new message, trigger push |
| `GET` | `/api/messages/dm-previews` | Latest message per DM channel for sidebar |
| `PATCH` | `/api/messages/:id/reactions` | **NOT IMPLEMENTED — returns 404** |

### POST /api/messages — full flow

```
1. Auth middleware → JWT validate → resolve wsId
2. requirePlanFeature('messages') → must be 'salon' plan
3. sanitizeHtml(safeStr(text))
4. Assemble document (see Firestore schema below)
5. db.collection('workspaces/{wsId}/messages').add(doc)
6. Push dispatch:
   - DM channel  → sendCrmPush(wsCol, otherUid, title, body, {type:'message', chatType})
   - Group channel → sendCrmPushToRoles(wsCol, roles, title, body, data, senderUid)
7. Return 201 + saved document
```

### GET /api/messages — notes
- `chatType=team` also queries `chatType=general` for backward compatibility
- Ordered by `createdAt` descending, limit 100

### GET /api/messages/dm-previews — notes
- Queries all messages where chatType starts with `dm_` and contains current userId
- Groups by chatType, keeps only the latest per channel
- Returns: `{chatType, text, senderName, senderId, time}`

### DM channel key formula
```javascript
// Both participants must produce identical key
function dmChatType(uid_a, uid_b) {
  return 'dm_' + [uid_a, uid_b].sort().join('_');
}
```
Historical bug (fixed 2026-04-13): staff list was using barber IDs instead of user doc IDs. The user doc ID is the correct key component.

### Chat channels and push targets

| chatType | Target audience | Push roles sent to |
|---|---|---|
| `team` / `general` | All staff | All roles except sender |
| `barbers` | Barbers only | `barber` |
| `admins` | Owner + Admin | `owner`, `admin` |
| `students` | Students only | `student` |
| `dm_{uid1}_{uid2}` | Two users | The other user only |

### Firestore schema — `workspaces/{wsId}/messages`

```
content:      string          // sanitized text
chatType:     string          // "team", "dm_abc_xyz", etc.
sender_id:    string          // user doc ID
sender_name:  string
sender_role:  string
senderPhoto?: string
imageUrl?:    string          // base64 data URL, ≤500KB
audioUrl?:    string          // base64 voice recording
fileUrl?:     string          // base64 file, ≤10MB
fileName?:    string
createdAt:    ISO string
reactions?:   { [emoji]: uid[] }   // emoji → array of user IDs
```

### Known bug — reactions endpoint missing
Frontend sends `PATCH /api/messages/:id/reactions` with `{emoji}`.
No backend handler exists. This will 404 in production.
Toggle logic needed: if uid already in `reactions[emoji]` → remove, else → add.
Firestore update: `FieldValue.arrayUnion` / `FieldValue.arrayRemove`.

---

## Layer 2 — SMS to Clients (Telnyx)

### Core function — `sendSms(to, body, fromOverride, wsId)` (~line 439)

```
1. telnyxCredentials() → TELNYX_API_KEY + TELNYX_FROM from env
2. getWorkspaceSmsConfig(wsId) → reads sms_from_number, sms_registration_status
3. if canSend === false → skip silently
4. formatPhone() / normPhone() on recipient number
5. Write compliance log → top-level 'sms_logs' collection
6. POST api.telnyx.com/v2/messages with Bearer token
```

### Workspace SMS config (Firestore path)
`workspaces/{wsId}/settings/config`

| Field | Type | Description |
|---|---|---|
| `sms_from_number` | string | E.164 format, e.g. `+18005551234` |
| `sms_messaging_profile_id` | string | Telnyx messaging profile ID |
| `sms_registration_status` | string | `active` = can send |

`canSend: true` only when `sms_registration_status === 'active'` and `sms_from_number` is set.

### Two provisioning paths

**Toll-free (new workspaces):**
`POST /api/sms/enable-tollfree` → calls Telnyx API to provision TFN → stores config → status immediately `active`

**10DLC (legacy):**
`POST /api/sms/register` → brand → `POST /api/sms/verify-otp` → campaign + number purchase → status via webhook

### SMS triggers and when they fire

| Trigger | Function | Delay |
|---|---|---|
| Booking created | `scheduleReminders()` | Writes to sms_reminders; job sends at right time |
| 24h before appointment | `runAutoReminders()` job | At `appointmentTime - 24h` |
| 2h before appointment | `runAutoReminders()` job | At `appointmentTime - 2h` |
| Appointment marked complete | `scheduleSatisfactionPing()` | +2h delay |
| Cancellation → waitlist | `tryWaitlistAutoFill()` | Immediate |
| Phone verification / OTP | `POST /public/verify/send/:wsId` | Immediate |

### Background job — `runAutoReminders()` (~line 8960)

```
Runs every: 3 minutes (setInterval)
Per cycle:
  1. Query all workspaces (limit 100)  ← scalability risk at >100 workspaces
  2. Per workspace: query sms_reminders where sent==false, limit 50
  3. For each due reminder (send_at <= now):
     a. Check client sms_opt_out flag
     b. sendSms()
     c. Mark reminder sent:true
```

**Scalability risk:** At >100 workspaces, reminders for workspace 101+ are skipped each cycle.
Fix needed: paginate workspaces query or use Cloud Scheduler.

### OTP / Phone verification (~line 8604)

**Route:** `POST /public/verify/send/:wsId`

```
Rate limit: 3 attempts per phone per 10 min (rate_limits collection)

If TELNYX_VERIFY_PROFILE_ID env var set:
  → POST api.telnyx.com/v2/verifications/sms  ($0.03/verification, no 10DLC needed)
Else (current state — env var NOT set):
  → Generate 6-digit code
  → Store in workspaces/{wsId}/phone_verify
  → Send via sendSms()
```

**Verify code:** `POST /public/verify/check/:wsId`
- If profile ID set: `GET api.telnyx.com/v2/verifications/by_phone_number/{phone}/actions/verify`
- Else: check code from Firestore `phone_verify` doc

**Action needed:** Create Telnyx Verify Profile and set `TELNYX_VERIFY_PROFILE_ID` env var on Cloud Run.

### Compliance — inbound SMS webhook (~line 1595)

**Route:** `POST /api/webhooks/telnyx`

```
1. Match 'to' number against all workspace sms_from_number configs
2. STOP / UNSUBSCRIBE / CANCEL / END / QUIT:
   → Set sms_opt_out: true on client record in all workspaces
   → Cancel all pending sms_reminders for that phone
   → Reply with opt-out confirmation
3. HELP / INFO:
   → Reply with support message
```

### 10DLC status webhook (~line 1660)

**Route:** `POST /api/webhooks/telnyx-10dlc`
Updates `sms_registration_status` in workspace settings when Telnyx sends brand/campaign status events.

### Telnyx API helper — `telnyxApi(method, path, body)` (~line 482)
Generic REST helper for all non-SMS Telnyx calls (brand registration, number purchase, messaging profile). Used by `/api/sms/register`, `/api/sms/enable-tollfree`, `/api/sms/verify-otp`.

---

## Layer 3 — Transactional Email (Resend)

### Core function — `sendEmail(to, subject, html, fromName, retries=2)` (~line 546)

```
From: noreply@vurium.com
API:  api.resend.com/emails
Retry: 2 times with 2s/4s backoff on failure
Template: vuriumEmailTemplate() — branded HTML
Theme: read from site_config.template on workspace doc
```

### Available themes
`modern` | `classic` | `bold` | `dark-luxury` | `colorful`

### When emails are sent

| Event | Trigger location |
|---|---|
| Booking confirmed (client) | `POST /api/bookings` |
| Booking cancelled (client) | `PATCH /api/bookings/:id` |
| Booking rescheduled | Reschedule logic |
| Satisfaction ping | `scheduleSatisfactionPing()` — immediate, before SMS |
| Waitlist spot opened | `tryWaitlistAutoFill()` |
| New staff welcome | User creation flow |
| Password reset | `POST /auth/forgot-password` |
| Payroll audit warning | `runPayrollAudit()` → owner email |
| Ghost barber alert | `runBookingAudit()` → affected clients |
| Contact form | `POST /api/contact` → support@vurium.com |

---

## Layer 4 — iOS Push Notifications (APNs)

### Token registration

**Route:** `POST /api/push/register` (~line 7697)
```
Body: { device_token, platform: 'ios', app, user_id, role, barber_id }
Stores to: workspaces/{wsId}/crm_push_tokens/{deviceToken}
Also: removes this token from all other workspaces (prevents cross-workspace push)
```

**Route:** `POST /api/push/unregister` — deletes token document on logout

### Push dispatch functions

| Function | When used |
|---|---|
| `sendCrmPush(wsCol, userId, title, body, data)` | DM messages, booking events for one user |
| `sendCrmPushToRoles(wsCol, roles, title, body, data, excludeUid)` | Group chat (excludes sender), role broadcasts |
| `sendCrmPushToBarber(wsCol, barberId, title, body, data)` | Booking events targeting a barber |
| `sendCrmPushToStaff(wsCol, barberId, ...)` | Thin wrapper over barber variant |

All dispatch functions:
1. Check workspace push prefs (`getWorkspacePushPrefs()` — cached 30s)
2. Fetch tokens from `crm_push_tokens` filtered by `user_id` or `role`
3. Call `sendApnsPush()` per token

### `sendApnsPush(token, payload)` (~line 852)

```
JWT: ES256 from APNS_KEY_P8 / APNS_KEY_ID / APNS_TEAM_ID env vars
JWT cache: 50 minutes (_apnsJwt)
Endpoint: api.push.apple.com/3/device/{token}  (or sandbox)
Bundle: com.vurium.VuriumBook
Payload: { aps: { alert: {title, body}, sound: 'default', 'mutable-content': 1 }, type, chatType }
```

### Push types and preference keys

| Event | Push type field | Pref key in settings |
|---|---|---|
| New booking | `booking_confirmed` | `push_booking_confirm` |
| Booking cancelled | `booking_cancelled` | `push_cancel` |
| In-app message | `message` | `push_chat_messages` |
| Staff request | `request` | — |
| Attendance | `attendance` | — |

---

## Known Issues — Priority Order

### P0 — Reactions endpoint missing
`PATCH /api/messages/:id/reactions` → 404 in production.
Need to implement toggle handler using Firestore `arrayUnion` / `arrayRemove`.

### P1 — TELNYX_VERIFY_PROFILE_ID not set
OTP verification falls back to local Firestore code instead of Telnyx Verify API.
Action: create Verify Profile in Telnyx console, set env var on Cloud Run.

### P2 — runAutoReminders workspace cap
Only processes first 100 workspaces per 3-minute cycle.
Fix: paginate workspace query or move jobs to Cloud Scheduler.

### P3 — reactions field schema exists without backend logic
`reactions: { [emoji]: uid[] }` is in the Firestore doc schema and returned in GET responses,
but no toggle logic exists on the backend. Frontend UI for reactions also exists (long-press).

---

## Infrastructure

| Component | Value |
|---|---|
| API base URL | `https://vuriumbook-api-431945333485.us-central1.run.app` |
| Runtime | Google Cloud Run |
| Database | Firestore (multi-tenant: all data under `workspaces/{wsId}/`) |
| Auth | JWT in `Authorization: Bearer` header |
| SMS | Telnyx (`api.telnyx.com/v2/messages`) |
| Email | Resend (`api.resend.com/emails`) |
| Push | APNs HTTP/2 (`api.push.apple.com`) |

---

## Files AI 1 owns in this feature

| File | Role |
|---|---|
| `backend/index.js` | All backend logic (messages, SMS, email, push) |
| `app/messages/page.tsx` | Frontend — AI 1 owns this per AI-Work-Split |

Do not edit `lib/api.ts`, `lib/useVisibilityPolling.ts`, or any other frontend utility without coordinating with AI 2.
