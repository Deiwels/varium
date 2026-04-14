# Vurium Light Theme — AI 1 (CSS Architecture & Theme Infrastructure)

> [[Home]] > Plans & Process | See also: [[Theme-Light-AI2]]
> Feature: Dark ↔ Light theme switching
> Scope: globals.css, ThemeProvider, layout.tsx anti-FOUC

---

## Phase 1 — CSS Variables & Token System

### 1.1 Рефакторинг `app/globals.css`

Додати на самий початок файлу (до `*, *::before, *::after`):

```css
/* ── Theme tokens — Dark (default) ── */
:root {
  --bg-base:       #010101;
  --bg-surface:    rgba(8,8,14,.55);
  --text-primary:  #f0f0f5;
  --text-muted:    rgba(255,255,255,.4);
  --text-faint:    rgba(255,255,255,.35);
  --border-subtle: rgba(255,255,255,.05);
  --border-mid:    rgba(255,255,255,.08);
  --navbar-bg:     rgba(1,1,2,.92);
  --accent:        rgba(130,150,220,.9);
  --accent-2:      rgba(130,220,170,.7);
  --input-bg:      rgba(255,255,255,.02);
  --input-border:  rgba(255,255,255,.06);
  --scrollbar:     rgba(255,255,255,.08);
}

/* ── Theme tokens — Light (Vurium White) ── */
[data-theme="light"] {
  --bg-base:       #ffffff;
  --bg-surface:    rgba(245,246,252,.92);
  --text-primary:  #0a0a14;
  --text-muted:    rgba(10,10,20,.5);
  --text-faint:    rgba(10,10,20,.38);
  --border-subtle: rgba(10,10,30,.07);
  --border-mid:    rgba(10,10,30,.12);
  --navbar-bg:     rgba(255,255,255,.92);
  --accent:        rgba(90,110,200,.9);
  --accent-2:      rgba(60,180,120,.85);
  --input-bg:      rgba(10,10,30,.03);
  --input-border:  rgba(10,10,30,.1);
  --scrollbar:     rgba(10,10,30,.12);
}
```

Замінити hardcoded значення на `var(--*)` у таких класах:

| Клас | Що замінити |
|---|---|
| `html` | `background: #010101` → `background: var(--bg-base)` |
| `body` | `color: #f0f0f5` → `color: var(--text-primary)` |
| `.navbar` | `background: rgba(1,1,2,.92)` → `var(--navbar-bg)`; `border-bottom` → `var(--border-subtle)` |
| `.navbar-logo` | `color: #f0f0f5` → `var(--text-primary)` |
| `.navbar-links a` | `color: rgba(255,255,255,.4)` → `var(--text-muted)` |
| `.glass-card` | `background: rgba(8,8,14,.55)` → `var(--bg-surface)`; `border-color` → `var(--border-subtle)` |
| `.form-input`, `.form-textarea` | `background` → `var(--input-bg)`; `border-color` → `var(--input-border)`; `color` → `var(--text-primary)` |
| `.form-input::placeholder` | `color: rgba(255,255,255,.2)` → `var(--text-faint)` |
| `.btn-secondary` | `border-color` → `var(--border-subtle)`; `color` → `var(--text-muted)` |
| `.faq-item` | `border-bottom` → `var(--border-subtle)` |
| `.faq-question` | `color: rgba(255,255,255,.7)` → `var(--text-muted)` |
| `.faq-answer-inner` | `color: rgba(255,255,255,.35)` → `var(--text-faint)` |
| `.label-glow` | `color: rgba(120,140,210,.55)` → `var(--accent)` |
| `.stat-number` | gradient start → `var(--accent)`; end → `var(--accent-2)` |
| `::-webkit-scrollbar-thumb` | `background: rgba(255,255,255,.08)` → `var(--scrollbar)` |

Додати в кінець файлу (після scrollbar):

```css
/* ── Light theme: hide cosmic background ── */
[data-theme="light"] #vurium-cosmos {
  opacity: 0;
  pointer-events: none;
  transition: opacity .4s ease;
}
[data-theme="light"] body {
  background: var(--bg-base);
}
html {
  background: var(--bg-base);
  transition: background .3s ease;
}
```

---

### 1.2 Створити `components/ThemeProvider.tsx`

```tsx
'use client'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggle: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    // Read saved preference or detect system preference
    const saved = localStorage.getItem('vurium-theme') as Theme | null
    const preferred: Theme = window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light' : 'dark'
    const initial = saved ?? preferred
    setTheme(initial)
    document.documentElement.setAttribute('data-theme', initial)
  }, [])

  const toggle = useCallback(() => {
    setTheme(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      document.documentElement.setAttribute('data-theme', next)
      localStorage.setItem('vurium-theme', next)
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}
```

---

### 1.3 Anti-FOUC у `app/layout.tsx`

Додати перший `<script>` у `<head>` (до будь-якого CSS, до `<style>`):

```tsx
<script dangerouslySetInnerHTML={{ __html: `
  (function(){
    try {
      var t = localStorage.getItem('vurium-theme') ||
        (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
      document.documentElement.setAttribute('data-theme', t);
    } catch(e) {}
  })();
` }} />
```

Обгорнути вміст `<body>` у `<ThemeProvider>`:

```tsx
import { ThemeProvider } from '@/components/ThemeProvider'

// у RootLayout:
<body>
  {/* anti-FOUC script вже у <head> */}
  <ThemeProvider>
    {/* весь існуючий вміст body без змін */}
    <div id="vurium-cosmos" ...>...</div>
    <CosmosParallax />
    <PlanProvider>
      <PermissionsProvider>
        <DialogWrapper>{children}</DialogWrapper>
      </PermissionsProvider>
    </PlanProvider>
    <CookieBanner />
  </ThemeProvider>
</body>
```

---

## Phase 2 — Верифікація

- [ ] `data-theme="light"` виставляється на `<html>` без флікера при першому завантаженні
- [ ] CSS-змінні `--bg-base`, `--text-primary` тощо коректно перекриваються у `[data-theme="light"]`
- [ ] Cosmic starfield (`#vurium-cosmos`) плавно зникає у light-темі
- [ ] `localStorage` зберігає і відновлює тему після hard refresh
- [ ] `prefers-reduced-motion` залишається робочим в обох темах
- [ ] TypeScript: `ThemeProvider` та `useTheme` без type errors
