# Analytics

> Part of [[Home]] > Features | See also: [[App Routes]], [[API Routes]], [[Firestore Collections]]

Traffic and source analytics for the public booking page. Tracks visitor activity and provides insights on where clients come from.

## Access
- URL: `/analytics` (in-app, requires auth)
- Roles: **Owner** and **Admin** only
- Dashboard widget: visible on both desktop and mobile home screen (owner/admin)

## Data Collection

### Public Tracker
- Endpoint: `POST /public/analytics/:workspace_id` (unauthenticated)
- Called from the public booking page (`/book/[id]`)
- Records: `source`, `referrer`, `date`, `created_at`
- Source detection: UTM params, referrer domain, or `direct`
- Storage: Firestore `workspaces/{wsId}/analytics`

### Sources Tracked
| Source | Detection |
|--------|-----------|
| Instagram | `utm_source=instagram` or referrer contains instagram.com |
| Google | `utm_source=google` or referrer contains google.com |
| Facebook | `utm_source=facebook` or referrer contains facebook.com |
| TikTok | `utm_source=tiktok` or referrer contains tiktok.com |
| Twitter/X | `utm_source=twitter` or referrer contains twitter.com/x.com |
| Email | `utm_source=email` |
| Yelp | `utm_source=yelp` or referrer contains yelp.com |
| Direct | No referrer or UTM |

## Analytics Page (`/analytics`)

### Period Selector
- 7 days / 14 days / 30 days / 90 days
- Data re-fetched on period change

### KPI Cards
- **Total Visits** — count with trend % vs previous period
- **Daily Average** — total / days
- **Peak Hour** — hour with most visits
- **Top Source** — highest traffic source

### Visualizations
- **Visits over time** — daily bar chart with hover tooltips, best day callout
- **Traffic sources** — horizontal bars with SVG icons, counts, percentages
- **Visits by hour** — 24-hour bar chart (local time)
- **Top referrers** — domain-level referrer list with bars
- **Day of week** — heatmap grid (Mon–Sun) with intensity shading

## Dashboard Widget
Compact version on the dashboard home screen:
- Shows total visit count (last 7 days)
- Top 5 sources with progress bars and SVG icons
- 7-day daily bar chart
- Clickable — navigates to `/analytics`
- Available on both desktop and mobile layouts

## API Endpoints

### `GET /api/analytics/summary` (auth required)
Returns last 7 days for the dashboard widget:
```json
{
  "total": 42,
  "by_source": { "instagram": 20, "direct": 15, "google": 7 },
  "by_day": [{ "day": "2026-04-07", "count": 5 }, ...]
}
```

### `GET /api/analytics/detailed?days=N` (auth required)
Extended analytics for the full page (N = 7–90):
```json
{
  "total": 243,
  "days": 30,
  "by_source": { ... },
  "by_day": [{ "day": "...", "count": N }, ...],
  "by_hour": [{ "hour": 0, "count": N }, ...],
  "by_referrer": { "instagram.com": 15, ... },
  "trend": { "previous": 100, "current": 143 }
}
```

## Architecture
- Frontend: `app/analytics/page.tsx` (Next.js, inline styles, dark cosmos theme)
- Backend: Express endpoints in `backend/index.js`
- Storage: Firestore subcollection `workspaces/{wsId}/analytics`
- No external analytics service — fully self-hosted, privacy-friendly
