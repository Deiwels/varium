# AI Style

> Part of [[Home]] > Features | See also: [[Onboarding Wizard]], [[Tech Stack]], [[Booking System]]

## Overview
AI-powered branding/styling using Anthropic Claude API. Generates custom visual themes for booking pages.

## Endpoint
- `POST /api/ai/generate-style` — generates CSS/style based on business info

## Key Facts
- Available on ALL subscription plans (recent change)
- Targets ALL page elements including booking flow
- Uses Dark Cosmos as base style system
- Hero image support via `hero_media_url` setting
- When active: hides default cosmos background, applies clean canvas

## Frontend
- `/settings` — AI style configuration
- `/book/[id]` — booking page where style is applied
- Booking flow has dedicated class for AI style targeting

## Dark Cosmos Base Style System

Full style guide documented in Claude memory (`style_varium_dark_cosmos.md`). Key tokens:

### Colors
- Background: `#010101`, cards `rgba(255,255,255,.015)`, modals `rgba(10,10,20,.94)`
- Text: `#f0f0f5` (primary), `#e8e8ed` (secondary), `rgba(255,255,255,.40)` (muted)
- Accents: green `rgba(130,220,170,.5)`, blue `rgba(130,150,220,.5)`, gold `rgba(220,190,100,.5)`, red `#ff6b6b`
- Borders: `rgba(255,255,255,.04)` — `.20` (subtle → prominent)

### Typography
- Body: **Inter** (300-700), Display: **Julius Sans One** (400)
- Sizes via `clamp()`: H1 30-56px, H2 28-48px, body 14-16px, labels 10-12px

### Components
- Buttons: height 50px, radius 999px, 4 variants (primary/secondary/nav-cta/dark-glow)
- Glass card: radius 20px, border .05, bg .015, backdrop blur 12px, hover translateY(-2px)
- Inputs: height 42px, radius 12px, border .10, bg .06
- Dialogs: radius 20px, bg rgba(10,10,20,.94), backdrop saturate+blur
- Status chips: 9px uppercase, radius 999px, color-coded (green/white/gold/red)

### Animations
- `star-breathe`, `shimmer`, `glow-breathe`, `fadeUp`, `orb-pulse`, `orb-slow-rotate`
- Transitions: .15s-.4s, easing `cubic-bezier(.4,0,.2,1)`

### Cosmic Background
- Starfield: 3 layers (far 80 stars, mid 30, near 12) + glow stars
- Black hole orb: 300x300px, rotation 120s, hidden <480px
- Nebula layers, horizon grid, noise overlay

## Recent Fixes
- AI style full background control — hide cosmos, clean canvas
- AI style properly applied on booking page
- Hero image saving (hero_media_url added to allowed settings)
