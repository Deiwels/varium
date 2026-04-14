# Public Website & Legal

> Part of [[Home]] > Features | See also: [[App Routes]], [[Booking System]], [[Components]]

## Overview
Marketing site, legal pages, and public-facing features at vurium.com.

## Marketing Pages

| Route | Purpose |
|-------|---------|
| `/` | Main landing page — parallax hero, feature showcase |
| `/pricing` | Plan comparison (Individual / Salon / Custom) |
| `/about` | Company info, team bios, values |
| `/support` | FAQ and support documentation |
| `/faq` | Detailed Q&A about pricing, security, features |
| `/contact` | Contact form for inquiries |
| `/blog` | Content hub with articles |
| `/blog/[slug]` | Individual blog posts |
| `/careers` | Job application form |
| `/portfolio` | Photo editor and work gallery |
| `/vuriumbook` | VuriumBook landing page |

## Legal Pages

| Route | Purpose |
|-------|---------|
| `/terms` | Terms of Service |
| `/privacy` | Privacy Policy — SMS sender identity, consent, data handling |
| `/dpa` | Data Processing Agreement |
| `/cookies` | Cookie Policy |
| `/accessibility` | WCAG Accessibility Statement |

### Privacy Policy — Key SMS/10DLC Compliance
- Sender identity: "VuriumBook (operated by Vurium Inc.)"
- Program A: Appointment Notifications — no-sharing clause, separate consent
- Program B: 2FA — consent-not-condition, separate consent, customer care
- SMS opt-in data exclusion clause (Section 5)

## Public Booking Pages

| Route | Purpose |
|-------|---------|
| `/book/[id]` | Public booking page (services → barber → time → payment) |
| `/manage-booking` | Client self-service (reschedule, cancel) |

## Auth Pages

| Route | Purpose |
|-------|---------|
| `/signin` | Login with PIN, password recovery, Apple/Google |
| `/signup` | Registration — business name, type, timezone, email/password |
| `/reset-password` | Password reset with token |

## Contact Form
- `POST /contact` — public form submission (no auth required)
- For sales/support inquiries

## Components

### CosmosParallax
- Animated parallax starfield effect on marketing pages
- 3-layer starfield + black hole orb + nebula

### CookieBanner
- Privacy-first cookie consent banner
- Decline by default

### ErrorBoundary
- Error handling wrapper for graceful failures
