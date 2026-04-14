# Public Mini-Site — AI-1 (Backend)

> Part of [[Home]] > Plans & Process | See also: [[PublicSite-AI2]], [[AI-Work-Split]], [[Features/Public Website]]
> Created: 2026-04-13

---

## Objective

Add backend support so the public `/book/[id]` page can function as a full mini-site for a business (home, services, portfolio, booking). All new endpoints are **public** (no auth required).

---

## Крок 1 — `GET /public/profile/:workspace_id`

New endpoint. Returns public business profile. No auth.

### Response shape
```json
{
  "shop_name": "string",
  "about_text": "string",
  "address": "string",
  "phone_display": "string",
  "website_url": "string",
  "instagram_url": "string",
  "google_review_url": "string",
  "hero_media_url": "string",
  "portfolio_enabled": true,
  "portfolio_photos": [
    { "id": "string", "url": "string", "caption": "string", "created_at": "timestamp" }
  ],
  "business_hours": {
    "mon": { "open": "09:00", "close": "18:00", "closed": false },
    "tue": { "open": "09:00", "close": "18:00", "closed": false },
    "wed": { "open": "09:00", "close": "18:00", "closed": true },
    "thu": { "open": "09:00", "close": "18:00", "closed": false },
    "fri": { "open": "09:00", "close": "18:00", "closed": false },
    "sat": { "open": "10:00", "close": "16:00", "closed": false },
    "sun": { "open": "10:00", "close": "16:00", "closed": true }
  },
  "tab_config": {
    "show_home": true,
    "show_services": true,
    "show_portfolio": true
  }
}
```

### Implementation notes
- Read from `workspaces/{id}/settings` doc (fields already stored there, partially)
- `portfolio_photos` — read from existing portfolio collection (same as internal portfolio page uses)
- **Never expose:** email, Stripe keys, Square keys, SMS keys, sms_opt_outs, any internal config
- Response header: `Cache-Control: public, max-age=60`
- Return 404 if workspace not found or `online_booking_enabled === false`

### Curl test
```bash
curl https://vuriumbook-api-431945333485.us-central1.run.app/public/profile/WORKSPACE_ID
```

---

## Крок 2 — `GET /public/portfolio/:workspace_id`

If no existing public portfolio endpoint exists, create one.

### Response shape
```json
[
  { "id": "string", "url": "string", "caption": "string", "order": 0, "created_at": "timestamp" }
]
```

- Only return photos if `portfolio_enabled === true` in settings; otherwise return `[]`
- Limit to 50 photos, ordered by `order` asc then `created_at` desc
- No auth required

### Curl test
```bash
curl https://vuriumbook-api-431945333485.us-central1.run.app/public/portfolio/WORKSPACE_ID
```

---

## Крок 3 — Settings whitelist — нові поля

In `PATCH /api/settings` (auth required), add to the allowed fields whitelist:

```
about_text
address
phone_display
website_url
instagram_url
portfolio_enabled
tab_config          (object: show_home, show_services, show_portfolio)
```

Fields `google_review_url`, `hero_media_url`, `business_hours` — check if already whitelisted. If yes, skip.

---

## Трейсабельність

| Endpoint | File | Verify |
|---|---|---|
| `GET /public/profile/:id` | `backend/index.js` or `backend/routes/public.js` | `curl /public/profile/:id` → JSON no secrets |
| `GET /public/portfolio/:id` | same | `curl /public/portfolio/:id` → array |
| Settings whitelist | `backend/index.js` PATCH /api/settings | `PATCH {about_text: "test"}` → saved |

---

## DoD Checklist — AI-1

- [ ] `GET /public/profile/:id` returns full profile JSON, no sensitive fields
- [ ] `GET /public/portfolio/:id` returns photo array (empty if portfolio_enabled false)
- [ ] New settings fields save correctly via `PATCH /api/settings`
- [ ] None of the existing `/public/*` endpoints broken
- [ ] `GET /public/resolve/:slugOrId` still works
- [ ] `POST /public/bookings/:id` still works
- [ ] Update `docs/DevLog/YYYY-MM-DD.md` after implementation
