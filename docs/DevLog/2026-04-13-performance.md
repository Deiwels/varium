# 2026-04-13 — Performance Optimization

> [[Home]] > DevLog | Related: [[ARCHITECTURE]], [[Tech Stack]]

## Problem
Site was very slow in Chrome — heavy jank on scroll, high CPU usage, laggy interactions especially on calendar and landing pages.

## Root Causes Found
1. **Multiple rAF loops running 60fps nonstop** — even when tab hidden or mouse idle
2. **Duplicate starfields** — layout.tsx cosmos + page-level .space-bg rendered simultaneously
3. **20+ box-shadow CSS animations** — triggers repaint every frame (not GPU-compositable)
4. **filter: blur(140px) on 6 large nebula elements** (up to 900x500px) — most expensive CSS operation
5. **backdrop-filter: blur()** on always-visible elements (navbar, cards, sidebar, calendar header)
6. **Cache-Control: max-age=0** — browser re-downloaded all static assets every time
7. **Google Fonts CDN** — external blocking request on every page load
8. **setInterval polling on 6+ pages** — continued in background tabs (4-6 API calls every 20s)
9. **localStorage polling every 1.5s** on calendar page
10. **288 DOM divs per barber column** for calendar grid lines
11. **5 full-screen fixed layers** without GPU compositing
12. **scroll-behavior: smooth** compounding with heavy fixed layer repaints

## Fixes Applied

### Rendering (biggest impact)
- **Nebula layers**: replaced `filter: blur(140px)` with `radial-gradient()` — same visual glow, 0 blur computation
- **Box-shadow animations**: `starBreathe`, `star-breathe`, `glow-breathe` now animate only `opacity` + `transform` (GPU-composited). Static `box-shadow` for visual glow.
- **backdrop-filter removed** from navbar (→ `rgba(1,1,2,.92)`), glass-card (→ `rgba(8,8,14,.55)`), calendar sticky header, time column, off-hours overlay, orb core, developer sidebar + all dev cards. Kept only for modals (temporary).
- **Duplicate starfield**: pages with `.space-bg` now hide `#vurium-cosmos` via `display: none`, restore on unmount
- **Calendar grid lines**: replaced 288 individual `<div>` per column with single CSS `repeating-linear-gradient` (5 barbers = -1440 DOM elements)
- **GPU compositing**: added `will-change: transform` + `contain` to `#vurium-cosmos`, `.noise-overlay`, `.horizon-grid`
- **scroll-behavior: smooth** removed

### rAF Loops (7 files fixed)
All parallax rAF loops now:
- Stop when tab hidden (`visibilitychange`)
- Auto-stop after 2s of no mouse movement
- Cache DOM refs instead of querying every frame
- Pages fixed: `page.tsx`, `vuriumbook`, `book/[id]`, `signup`, `CosmosParallax`
- Pages where rAF removed entirely (was targeting non-existent elements): `signin`, `reset-password`

### Polling & Timers
- Created `useVisibilityPolling` hook — pauses `setInterval` when tab hidden, resumes with immediate call on return
- Applied to: `clients`, `attendance`, `waitlist`, `payments`, `dashboard`, `messages`
- Shell unread check: 20s → 45s + visibility-aware (was 4-6 API calls every 20s)
- Calendar booking poll: 15s → 20s + visibility-aware
- Calendar localStorage poll (1.5s!) → `storage` event + `visibilitychange`
- Dashboard ClockWidget: stops 1-second timer when tab hidden
- Messages: 10s → 15s + visibility-aware

### Fonts & Caching
- Switched from Google Fonts CDN to `next/font/google` (self-hosted, no external request)
- Removed `Cache-Control: max-age=0` — browser now caches static assets with content hash
- Removed `fonts.googleapis.com` from CSP

### Analytics Page
- Wrapped 8 derived computations in `useMemo`
- Extracted day-of-week heatmap IIFE into memoized `DowHeatmap` component

### Calendar
- Extracted `OFFHOURS_GLASS`, `OFFHOURS_TIME_PILL` to module-level constants
- Sticky header + time column: `backdrop-filter` → opaque background

## UI Change
- **Sign In** navbar link: removed white `btn-nav-cta` button style, now regular text link like other nav items (16 pages)

## Style Guide Updated
- `backdrop-filter`: only for modals/temporary overlays, never on always-visible elements
- Animations: only `opacity` + `transform` (GPU-composited), never `box-shadow`/`background`
- rAF: must stop on idle/hidden, cache DOM refs
- Pages with `.space-bg` must hide `#vurium-cosmos`
- Polling: use `useVisibilityPolling` hook

## New File
- `lib/useVisibilityPolling.ts` — hook that pauses polling when tab is hidden

### Developer Section
- AI diagnostics: `setInterval(3s)` → `useVisibilityPolling` (pauses when tab hidden)
- Toast: removed `backdrop-filter: blur(8px)`
- MiniChart: wrapped in `React.memo` + `useMemo` for max/points computation
- Overview page: memoized `signupChart`, `totalBookings`, `totalClients`, `totalStaff`
- Analytics page: memoized `chartData`
- All developer cards: removed `backdrop-filter: blur(12px)` from always-visible card styles
- Developer sidebar: `backdrop-filter: blur(20px)` → opaque `rgba(6,6,10,.88)`
- Login/Verify cards: removed `backdrop-filter: blur(16px)`

## Commits
- `5d70d82` perf: optimize site performance — fix rAF loop, visibility polling, self-hosted fonts
- `8fbd1ec` perf: fix major Chrome performance bottlenecks
- `6ec8b03` perf: fix landing page performance — rAF loop, reduce animations & blur
- `ffdf918` perf: eliminate box-shadow animations — major repaint source
- `5f2436e` perf: fix scroll jank — eliminate duplicate starfield, GPU-composite fixed layers
- `3d68529` perf: optimize all remaining pages with rAF loops
- `12ab4e8` perf: optimize booking & signup pages — rAF loops, duplicate starfields
- `22bc923` perf: remove always-visible backdrop-filter — biggest remaining bottleneck
- `d865abe` ui: change Sign In nav link from white button to regular text link
- `39d69a0` fix: hide duplicate cosmos on signin page
- `207a0ef` perf: optimize analytics page — memoize derived data, extract DowHeatmap
- `4695590` perf: optimize all developer pages — remove always-visible backdrop-filter
- `81949f0` perf: replace all filter:blur(140px) nebula with radial-gradient
- `d9178e5` docs: add performance optimization DevLog + CHANGELOG entry
- `c6f60df` perf: optimize developer section — polling, memoization, blur removal
