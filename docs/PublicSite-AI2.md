# Public Mini-Site — AI-2 (Frontend)

> Part of [[Home]] > Plans & Process | See also: [[PublicSite-AI1]], [[AI-Work-Split]], [[Features/Public Website]], [[Features/AI Style]]
> Created: 2026-04-13

---

## Objective

Transform `/book/[id]` from a pure booking widget into a full public mini-site with 4 tabs: **Home · Services · Portfolio · Book Now**.

**Critical constraint:** The existing booking flow (steps 1–4, Stripe, group booking, custom code template) must remain **100% unchanged**. Only add above/around it.

---

## Architecture Overview

```
/book/[id]
├── PublicSiteNav          ← NEW: sticky nav with tabs
├── HomeTab                ← NEW: hero, about, team, hours, reviews, CTA
├── ServicesTab            ← NEW: service grid (uses existing services[] state)
├── PortfolioTab           ← NEW: photo grid + lightbox
└── BookTab                ← WRAP: existing booking flow, zero internal changes
    ├── Step 1: Services
    ├── Step 2: Date/Time
    ├── Step 3: Client info + payment
    └── Step 4: Confirmed
Footer (always visible, not in a tab)
```

**Custom code mode:** When `designTemplate === 'custom'` → hide `PublicSiteNav`, render custom HTML as before. No changes to custom template logic.

---

## URL / Tab Routing

Use `useSearchParams()` to read `?tab=` on mount. Sync on tab change via `router.replace`:

```
/book/[id]              → default: 'home'
/book/[id]?tab=services → ServicesTab
/book/[id]?tab=portfolio→ PortfolioTab
/book/[id]?tab=book     → BookTab (existing flow)
```

---

## Крок 1 — Розширити `Config` interface

Додати нові optional поля (не видаляти жодне існуюче):

```ts
interface Config {
  // --- existing fields (DO NOT TOUCH) ---
  shop_name?: string
  hero_media_url?: string
  bannerText?: string
  bannerEnabled?: boolean
  timezone?: string
  online_booking_enabled?: boolean
  waitlist_enabled?: boolean
  booking?: { cancellation_hours?: number }
  display?: { show_prices?: boolean; require_phone?: boolean; allow_notes?: boolean }

  // --- NEW fields ---
  about_text?: string
  address?: string
  phone_display?: string
  website_url?: string
  instagram_url?: string
  google_review_url?: string
  portfolio_enabled?: boolean
  tab_config?: {
    show_home?: boolean
    show_services?: boolean
    show_portfolio?: boolean
  }
}
```

---

## Крок 2 — Новий state в `PublicBookingPage`

```ts
const [activeTab, setActiveTab] = useState<'home'|'services'|'portfolio'|'book'>('home')
const [profile, setProfile] = useState<any>(null)
const [portfolioPhotos, setPortfolioPhotos] = useState<any[]>([])
const [portfolioLoaded, setPortfolioLoaded] = useState(false)
const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null)
const [preselectedServiceId, setPreselectedServiceId] = useState<string | null>(null)
```

---

## Крок 3 — Fetch профілю

Після resolve workspace (після `setResolvedWsId`), паралельно з існуючими fetches:

```ts
api(`/public/profile/${resolvedWsId}`).then(setProfile).catch(() => {})
```

Portfolio fetch — **lazy**, тільки при першому відкритті вкладки `portfolio`:

```ts
if (activeTab === 'portfolio' && !portfolioLoaded) {
  api(`/public/portfolio/${resolvedWsId}`)
    .then(data => { setPortfolioPhotos(Array.isArray(data) ? data : []); setPortfolioLoaded(true) })
    .catch(() => setPortfolioLoaded(true))
}
```

---

## Крок 4 — `PublicSiteNav` component

Inline function у тому ж файлі:

```tsx
function PublicSiteNav({ shopName, logoUrl, activeTab, onChange, isLight, t, tabs }: {
  shopName: string
  logoUrl?: string
  activeTab: string
  onChange: (tab: string) => void
  isLight: boolean
  t: ThemeTokens
  tabs: { id: string; label: string }[]
}) { ... }
```

UI-деталі:
- Sticky top (position: sticky, top: 0, zIndex: 100)
- Ліворуч: лого (якщо є) + назва бізнесу
- Праворуч: вкладки горизонтально
- "Book Now" — accent color: `rgba(130,220,170,.9)` border + text
- Mobile: вкладки горизонтальний scroll (`overflow-x: auto`, no scrollbar)
- Background: `t.bg` з backdrop blur 12px, border-bottom: `1px solid ${t.border}`
- Активна вкладка: `border-bottom: 2px solid currentColor`
- Підтримує AI Style автоматично (використовує t.* tokens)

**Ховати якщо:** `designTemplate === 'custom'`

---

## Крок 5 — `HomeTab` component

Секції рендеряться тільки якщо є дані (guard: `if (!about_text) skip`):

### 5.1 Hero
- Background image: `hero_media_url` (full width, overlay gradient)
- Або cosmic background якщо немає фото
- `shop_name` — велика типографіка (Julius Sans One)
- `bannerText` якщо є

### 5.2 About
- `about_text` — текст опису бізнесу
- `address`, `phone_display`, `website_url`, `instagram_url` — іконки + посилання
- Map embed: якщо є address → Google Maps `<iframe>` embed (optional)

### 5.3 Team
- Використовує існуючий `barbers[]` state (не новий fetch!)
- CSS grid картки: фото (коло), ім'я, level
- Масштаб: якщо нема фото → initials avatar (як у booking flow)

### 5.4 Business Hours
- `profile?.business_hours` → таблиця пн–нд
- Поточний день підсвічений

### 5.5 Reviews
- Використовує існуючий `reviews[]` state (не новий fetch!)
- Горизонтальний scroll cards: ім'я, зірки, текст

### 5.6 CTA
- Кнопка "Book an Appointment" → `onChange('book')`

---

## Крок 6 — `ServicesTab` component

- **Джерело даних:** існуючий `services[]` state (вже завантажений, нульовий extra fetch)
- Групування: по `service_type` якщо є → секція з заголовком; якщо ні → flat
- Картка сервісу:
  - Назва (bold)
  - Тривалість: `${duration_minutes} min`
  - Ціна: тільки якщо `config?.display?.show_prices !== false` → `$${(price_cents/100).toFixed(2)}`
  - Кнопка "Book" → `setPreselectedServiceId(id); onChange('book')`
- CSS grid: 2 колонки desktop, 1 mobile

---

## Крок 7 — `PortfolioTab` component

- Lazy fetch (Крок 3)
- CSS grid: `grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))`
- Hover overlay: caption якщо є
- Click → Lightbox:
  ```
  .ps-lightbox { position: fixed; inset: 0; z-index: 999; background: rgba(0,0,0,.92); display: flex; align-items: center; justify-content: center }
  ```
  - ESC key → close
  - Click outside image → close
  - Prev/Next навігація стрілками
- Якщо `portfolio_enabled === false` або `tab_config?.show_portfolio === false` → вкладка не показується
- Fallback: "No photos yet" centered text

---

## Крок 8 — Wrap booking flow у `BookTab`

Обгорнути весь існуючий `<main>` з booking flow:

```tsx
{activeTab === 'book' && (
  <main className="bp-main" ...>
    {/* === EXISTING BOOKING FLOW — ZERO CHANGES INSIDE === */}
    {step === 1 && ...}
    {step === 2 && ...}
    {step === 3 && ...}
    {step === 4 && ...}
  </main>
)}
```

Footer (SMS compliance + "Powered by VuriumBook") — **поза** умовою, завжди видимий.

---

## Крок 9 — CSS (додати в `globals.css` або inline)

Секція `/* === Public Mini-Site === */`:

```css
.ps-nav { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 56px; backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,.06); }
.ps-tabs { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; }
.ps-tabs::-webkit-scrollbar { display: none; }
.ps-tab-btn { padding: 8px 16px; border-radius: 8px; border: none; background: transparent; cursor: pointer; font-size: 14px; font-family: inherit; white-space: nowrap; transition: background .15s; }
.ps-tab-btn.active { border-bottom: 2px solid currentColor; font-weight: 600; }
.ps-portfolio-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; padding: 24px; }
.ps-portfolio-item { aspect-ratio: 1; border-radius: 12px; overflow: hidden; cursor: pointer; position: relative; }
.ps-portfolio-item img { width: 100%; height: 100%; object-fit: cover; transition: transform .3s; }
.ps-portfolio-item:hover img { transform: scale(1.04); }
.ps-lightbox { position: fixed; inset: 0; z-index: 999; background: rgba(0,0,0,.92); display: flex; align-items: center; justify-content: center; }
.ps-service-card { padding: 16px; border-radius: 16px; border: 1px solid rgba(255,255,255,.06); background: rgba(255,255,255,.02); display: flex; flex-direction: column; gap: 8px; }
.ps-team-card { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 20px 16px; border-radius: 16px; border: 1px solid rgba(255,255,255,.06); background: rgba(255,255,255,.02); }
.ps-team-avatar { width: 72px; height: 72px; border-radius: 999px; object-fit: cover; }
@media (max-width: 640px) {
  .ps-portfolio-grid { grid-template-columns: repeat(2, 1fr); padding: 16px; }
  .ps-nav { padding: 0 16px; }
}
@media (max-width: 400px) {
  .ps-portfolio-grid { grid-template-columns: 1fr; }
}
```

---

## Settings UI — `app/settings/page.tsx`

В розділ "Site Builder" → нова секція **"Public Profile"**:

| Поле | Type | Label |
|---|---|---|
| `about_text` | textarea | About your business |
| `address` | text | Address |
| `phone_display` | text | Phone (displayed publicly) |
| `instagram_url` | text | Instagram URL |
| `portfolio_enabled` | toggle | Show Portfolio tab |
| `tab_config.show_home` | toggle | Show Home tab |
| `tab_config.show_services` | toggle | Show Services tab |
| `tab_config.show_portfolio` | toggle | Show Portfolio tab |

Зберігати через існуючий `PATCH /api/settings` handler.

---

## AI Style Compatibility

Всі нові компоненти мають використовувати ті ж `t.*` (theme tokens) що і booking flow:
```ts
const bg = isLightTheme ? '#f5f5f7' : '#010101'
const card = isLightTheme ? 'rgba(0,0,0,.03)' : 'rgba(255,255,255,.015)'
const border = isLightTheme ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.06)'
const textMain = isLightTheme ? '#1d1d1f' : '#f0f0f5'
```

Якщо workspace має custom AI style CSS → він застосовується через existing `<style>` injection. Нові компоненти автоматично підхоплять ці стилі якщо вони таргетять `body` або загальні класи.

---

## DoD Checklist — AI-2

- [ ] `designTemplate === 'custom'` → `PublicSiteNav` не рендериться, custom HTML без змін
- [ ] AI Style (custom CSS з settings) застосовується до нових секцій
- [ ] Booking flow (steps 1–4) — нульових змін всередині
- [ ] `?tab=book` → відразу відкривається booking flow
- [ ] `?tab=services` → ServicesTab, "Book" кнопка → переходить у book tab
- [ ] `?tab=portfolio` → PortfolioTab, lightbox працює
- [ ] Portfolio tab не показується якщо `portfolio_enabled: false`
- [ ] SMS compliance footer видимий на всіх вкладках
- [ ] Mobile: nav scrollable, portfolio 1-2 колонки
- [ ] `tsc --noEmit` → 0 errors
- [ ] ESLint → 0 warnings на нових компонентах
- [ ] Update `docs/DevLog/YYYY-MM-DD.md` після імплементації
