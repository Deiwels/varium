# 2026-04-13 — Dashboard Widget System Overhaul

> [[Home]] > DevLog | Related: [[App Routes]], [[Components]]

## Done

### Toggleable Team Member Widgets
- Barber cards (Dan, Lili, Naz, Vio, Yana) were hardcoded on the dashboard
- Integrated into `dashWidgets` add/remove system with `team-{barberId}` IDs
- Edit mode: red "-" button to remove, dashed "+" placeholder to re-add
- Auto-added on first load for new users, then persisted to API via `POST /api/settings`
- **Later removed entirely** — team schedule widgets (days of week + hours) deemed unnecessary on dashboard

### Widget Removal Persistence Fix
- Bug: removing a widget didn't persist — re-appeared on reload
- Root cause: `loadAll()` polling re-added team widgets every cycle when `hasAnyTeam` was false
- Fix: use `widgetSettingsLoaded` ref to only auto-add widgets for first-time users (no saved `dash_widgets` in API)

### Shortcut Removal Persistence Fix
- Bug: removing a shortcut (e.g. Portfolio) didn't persist — still visible after exiting edit mode
- Root cause: all shortcuts always rendered regardless of `dashShortcuts` state; the state was only used for styling in edit mode
- Fix: filter `visibleActions` — outside edit mode, only show `core` shortcuts + those in `dashShortcuts`
- Core shortcuts (Calendar, History, Clients, Payments) always visible; extras (Portfolio, Cash, Waitlist, Membership) toggleable

### My Earnings — Converted to Widget
- Removed the large fixed "MY EARNINGS" card from top of barber dashboard
- Created compact `my-earnings` widget in the standard grid (glassmorphism style)
- Shows Services / Tips / Total in three columns
- Day/Week/Month period switcher with left/right navigation
- Auto-injected for barber role on first load via `myEarningsInjected` ref

### Staff On Clock — Converted to Widget
- Removed the fixed top "STAFF ON CLOCK" section for owners/admins
- Now a regular `team-on-duty` widget in the grid
- Shows each staff member with green dot, name, clock-in time, and elapsed minutes
- Auto-widens (350px) when >2 staff clocked in; standard 190px otherwise
- Added to default `dashWidgets` list so it shows for all users by default

### Clock-In Widget — Unlocked
- Removed `locked: true` from `w_clockin` — now a regular removable/movable widget
- Removed all `lockedIds` injection logic
- Same 2-column size as Clock widget, no longer pinned to top of grid

### Drag-to-Reorder (Mobile Home Screen)
- iPhone-style drag-and-drop in jiggle/edit mode
- Long press (600ms) activates jiggle mode
- Drag any widget or icon to a new position
- Floating clone follows finger with scale(1.08) + drop shadow
- Drop target highlights with scale(1.05)
- Uses `document.elementFromPoint()` + `data-layout-idx` attributes
- Reordered layout persists to localStorage immediately
- Page swipe disabled during drag to prevent interference

### Drag UX Fixes
- `preventDefault` on touchStart in jiggle mode — stops browser link drag behavior
- `user-select: none` on container + edit items — prevents text selection
- `pointer-events: none` on links inside edit-glow items — blocks accidental link taps
- `-webkit-touch-callout: none` — prevents iOS long-press context menu

### Keyboard Hides Bottom Nav
- Bottom pill nav bar now hides when virtual keyboard opens
- Uses `visualViewport` API — detects when viewport shrinks >120px vs window height
- Applies `keyboard-open` CSS class: `opacity: 0`, `pointer-events: none`, `translateY(20px)`
- CSS class already existed but was never applied; added JS detection + state binding

## Files Changed
- `app/dashboard/page.tsx` — all widget system changes, drag-to-reorder, keyboard detection
- `components/Shell.tsx` — keyboard open detection + pill-bar hide

## Commits
- `b4d8bd1` — toggleable team member widgets
- `4180182` — fix team widget removal persistence
- `5aff453` — fix shortcut removal persistence
- `f3f984f` — convert My Earnings to widget
- `3a24249` — unlock Clock-In + drag-to-reorder
- `625b5da` — prevent link drag / text selection in jiggle mode
- `1c033ff` — hide bottom nav when keyboard open
- `e698733` — convert Staff On Clock to widget
- `ee317f1` — remove barber schedule widgets
