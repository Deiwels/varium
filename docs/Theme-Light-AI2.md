# Vurium Light Theme — AI 2 (Components, Toggle UI & Visual Polish)

> [[Home]] > Plans & Process | See also: [[Theme-Light-AI1]]
> Feature: Dark ↔ Light theme switching
> Scope: ThemeToggle, Navbar integration, per-element light-mode overrides

> **Залежність:** AI 1 має завершити Phase 1 (CSS змінні + ThemeProvider + anti-FOUC) перед початком цього плану.

---

## Phase 1 — ThemeToggle компонент

### 1.1 Створити `components/ThemeToggle.tsx`

```tsx
'use client'
import { useTheme } from '@/components/ThemeProvider'

// SVG sun icon
function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )
}

// SVG moon icon
function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      style={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--text-muted)',
        borderRadius: 8,
        transition: 'opacity .2s, color .2s',
        flexShrink: 0,
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '.7')}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
```

### 1.2 Інтегрувати `<ThemeToggle />` у Navbar

У `app/layout.tsx` (або у компоненті що рендерить `.navbar`):

- Імпортувати: `import ThemeToggle from '@/components/ThemeToggle'`
- Додати між навігаційними посиланнями та CTA кнопкою:

```tsx
<nav className="navbar">
  <a className="navbar-logo" href="/">...</a>
  <ul className="navbar-links">
    {/* існуючі посилання */}
  </ul>
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <ThemeToggle />
    <a className="btn-nav-cta" href="/signup">Get Started</a>
  </div>
</nav>
```

---

## Phase 2 — Light-theme CSS overrides

Додати в `app/globals.css` після секції `/* ── Light theme: hide cosmic background ── */`:

### 2.1 `.shimmer-text` у light-темі

```css
[data-theme="light"] .shimmer-text {
  background: linear-gradient(
    92deg,
    #0a0a14 0%,
    rgba(70,90,200,.75) 45%,
    #0a0a14 55%,
    rgba(70,90,200,.75) 100%
  );
  background-size: 250% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

### 2.2 `.btn-primary` у light-темі

```css
[data-theme="light"] .btn-primary {
  background: #f5f6ff;
  border-color: rgba(90,110,200,.2);
  color: rgba(10,10,60,.85);
  box-shadow: 0 0 10px 3px rgba(90,110,200,.15), 0 0 24px 6px rgba(70,90,180,.07);
}
[data-theme="light"] .btn-primary:hover {
  color: rgba(10,10,60,1);
  background: #eef0ff;
}
```

### 2.3 `.btn-secondary` у light-темі

```css
[data-theme="light"] .btn-secondary {
  border-color: rgba(10,10,30,.12);
  background: rgba(10,10,30,.03);
  color: rgba(10,10,20,.6);
}
[data-theme="light"] .btn-secondary:hover {
  border-color: rgba(10,10,30,.2);
  background: rgba(10,10,30,.06);
}
```

### 2.4 `.glass-card` у light-темі

```css
[data-theme="light"] .glass-card {
  background: rgba(255,255,255,.9);
  border-color: rgba(10,10,30,.07);
  box-shadow: 0 2px 20px rgba(10,10,40,.06);
}
[data-theme="light"] .glass-card::before {
  background: linear-gradient(90deg, transparent, rgba(90,110,200,.05), transparent);
}
[data-theme="light"] .glass-card:hover {
  border-color: rgba(10,10,30,.12);
  box-shadow: 0 8px 40px rgba(10,10,40,.1);
}
```

### 2.5 Navbar у light-темі

```css
[data-theme="light"] .navbar {
  background: rgba(255,255,255,.92);
  border-bottom-color: rgba(10,10,30,.07);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
[data-theme="light"] .navbar-logo {
  color: #0a0a14;
}
[data-theme="light"] .navbar-links a {
  color: rgba(10,10,20,.5);
}
[data-theme="light"] .navbar-links a:hover {
  color: rgba(10,10,20,.9);
}
[data-theme="light"] .btn-nav-cta {
  background: #0a0a14;
  color: rgba(255,255,255,.92);
}
[data-theme="light"] .btn-nav-cta:hover {
  background: #1a1a2e;
  box-shadow: 0 0 18px rgba(10,10,40,.15);
}
```

### 2.6 Form inputs у light-темі

```css
[data-theme="light"] .form-input,
[data-theme="light"] .form-textarea {
  background: rgba(10,10,30,.03);
  border-color: rgba(10,10,30,.1);
  color: #0a0a14;
}
[data-theme="light"] .form-input::placeholder,
[data-theme="light"] .form-textarea::placeholder {
  color: rgba(10,10,20,.3);
}
[data-theme="light"] .form-input:focus,
[data-theme="light"] .form-textarea:focus {
  border-color: rgba(90,110,200,.35);
  background: rgba(10,10,30,.05);
}
```

### 2.7 FAQ у light-темі

```css
[data-theme="light"] .faq-item {
  border-bottom-color: rgba(10,10,30,.07);
}
[data-theme="light"] .faq-question {
  color: rgba(10,10,20,.7);
}
[data-theme="light"] .faq-question:hover {
  color: rgba(10,10,20,.9);
}
[data-theme="light"] .faq-question .faq-chevron {
  color: rgba(90,110,200,.6);
}
[data-theme="light"] .faq-answer-inner {
  color: rgba(10,10,20,.45);
}
```

### 2.8 Stat number та label у light-темі

```css
[data-theme="light"] .stat-number {
  background: linear-gradient(135deg, rgba(90,110,200,.9), rgba(60,180,120,.8));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
[data-theme="light"] .label-glow {
  color: rgba(70,90,190,.75);
  text-shadow: 0 0 24px rgba(70,90,190,.12);
}
```

---

## Phase 3 — Верифікація UI

- [ ] ThemeToggle відображається у navbar, доступний на всіх сторінках
- [ ] Іконка змінюється: сонце у dark, місяць у light
- [ ] Усі картки (`.glass-card`) читабельні у light-темі
- [ ] `.shimmer-text` видимий і анімований у light-темі (темний градієнт, не невидимий)
- [ ] Navbar logo та посилання мають достатній контраст у light-темі
- [ ] Кнопки `.btn-primary` та `.btn-secondary` стилізовані у light-темі
- [ ] Форми та inputs мають видимий placeholder і border у light-темі
- [ ] Мобільна адаптація: ThemeToggle компактний, не ламає navbar layout
- [ ] Перемикання dark ↔ light без перезавантаження — миттєве, без флікера
- [ ] Hover-стани працюють у обох темах

---

## Трасування

| Крок | Файл(и) | Ознака готовності |
|---|---|---|
| 1.1 ThemeToggle | `components/ThemeToggle.tsx` | Компонент рендериться, toggle викликається |
| 1.2 Navbar | `app/layout.tsx` | Кнопка видима між nav і CTA |
| 2.1–2.8 overrides | `app/globals.css` | DevTools: `[data-theme="light"]` правила активні |
