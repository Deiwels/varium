# 2026-04-13 — Analytics Page

> [[Home]] > DevLog | Related: [[App Routes]], [[API Routes]], [[Firestore Collections]]

## Analytics — Full Page (`/analytics`)

The dashboard **Site Visits** widget previously only showed a compact 7-day summary. Now it's clickable and opens a full-featured analytics page with extended data and visualizations.

### What Changed

**New page: `/analytics`**
- Period selector: 7d / 14d / 30d / 90d
- KPI cards: Total Visits (with trend %), Daily Average, Peak Hour, Top Source
- Visits over time bar chart (interactive, hover tooltips)
- Traffic sources breakdown with horizontal bars, percentages, and SVG icons
- Visits by hour of day chart
- Top referrer domains list
- Day of week heatmap (Mon–Sun)
- Empty state when no data recorded
- Access restricted to **owner** and **admin** roles

**New backend endpoint: `GET /api/analytics/detailed?days=N`**
- Supports 7–90 day range
- Returns: `total`, `by_source`, `by_day`, `by_hour`, `by_referrer`, `trend` (period-over-period comparison)
- Hourly breakdown extracted from `created_at` timestamps
- Referrer domains parsed from full referrer URLs
- Trend: splits data at midpoint, compares first half vs second half

**Dashboard widget updates (desktop + mobile)**
- Site Visits widget now navigates to `/analytics` on click (arrow indicator shown)
- Click disabled during edit/jiggle mode
- Widget and widget picker hidden for barbers/students (owner/admin only)
- Emoji icons (📸🔍📘🎵🔗🌐) replaced with stylized SVG icons across both desktop and mobile

**Navigation**
- Added `Analytics` to Shell sidebar nav with bar-chart icon
- Position: between Membership and Expenses
- `ownerAdmin: true` — hidden for barber/student roles

### Files Created
- `app/analytics/page.tsx` — full analytics page with charts, KPI cards, period selector

### Files Modified
- `backend/index.js` — added `GET /api/analytics/detailed` endpoint
- `components/Shell.tsx` — added analytics nav item + SVG icon
- `app/dashboard/page.tsx` — made widget clickable, replaced emojis with SVGs, role-gated widget visibility

### Access Control
- Page: reads user role from localStorage, shows "Access restricted" for non-owner/admin
- Navigation: `ownerAdmin: true` flag in Shell NAV config hides link
- Desktop widget: renders only when `isOwnerOrAdmin`
- Mobile widget: included in `ALL_ITEMS` only when `isOwnerOrAdmin`
- Widget picker: `site-analytics` option spread-gated by `isOwnerOrAdmin`
