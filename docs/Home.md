# Varium (VuriumBook)

> Multi-tenant booking & business management SaaS for salons, barbershops, and service businesses.
> Corporation: **Vurium Inc.** (Illinois, File #75519095)

---

## Status

| | |
|---|---|
| **Stage** | Pre-launch — finishing production readiness |
| **Goal** | Sell-ready: new business can sign up, onboard, book, and pay without manual rescue |
| **Current focus** | P0 tasks in [[Tasks/Launch Readiness Plan\|Launch Readiness Plan]] |
| **Active work** | [[Tasks/In Progress\|In Progress]] |
| **Who's working** | 2 AI agents — see [[AI-Work-Split]] for ownership |

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15, React 19, TypeScript |
| Backend | Express.js, Node.js |
| Database | Google Cloud Firestore |
| Payments | Stripe Connect, Square |
| Auth | JWT, Apple/Google OAuth, MFA |
| SMS | Telnyx (10DLC, brand: BCFAC3G) |
| AI | Anthropic Claude API |
| Hosting | Vercel (frontend), Cloud Run (backend) |
| iOS | WKWebView wrapper + native push notifications |

> Deep dive: [[Tech Stack]] · [[ARCHITECTURE]]

---

## Architecture

- [[Tech Stack]] — Full stack details, integrations, security
- [[Database Schema]] — Firestore multi-tenant model (23 collections)
- [[Auth Flow]] — JWT cookies, Apple/Google OAuth, MFA, PIN, roles
- [[API Routes]] — 193 endpoints across 15+ domains
- [[Firestore Collections]] — Collection reference
- [[App Routes]] — 43 pages (Next.js App Router)
- [[Components]] — 10 core reusable components

---

## Features

| Feature | Description | Doc |
|---------|-------------|-----|
| Booking | Public booking, smart audit, auto-fix, satisfaction ping, waitlist auto-fill, rate limiter | [[Booking System]] |
| Payments | Stripe Connect, Square, terminals, Apple IAP | [[Payments]] |
| Calendar | Calendar view, schedule overrides, mobile layout | Calendar & Scheduling |
| Clients | CRM, booking history, phone verification | [[Client Management]] |
| Onboarding | 4-step wizard for new workspaces | [[Onboarding Wizard]] |
| Templates | Pre-filled services per business type | [[Business Templates]] |
| AI Style | AI-generated branding/themes for booking pages | [[AI Style]] |
| Payroll | Clock in/out, commissions, tips, owner profit | [[Attendance & Payroll]] |
| SMS & 10DLC | Telnyx 10DLC, platform-as-sender, 2FA + appointment SMS | [[SMS & 10DLC]] |
| Messaging | Team DMs between staff | Messaging |
| Memberships | Subscription plans for clients | Memberships |
| Analytics | Summary & detailed business analytics | Analytics |
| Reviews | Review management & import | Reviews |
| Dev Panel | Platform admin: magic link auth, analytics, email logs | [[Developer Panel]] |

---

## Tasks & Plans

- [[Tasks/In Progress\|In Progress]] — Current sprint (P0 items + active tasks)
- [[Tasks/Backlog\|Backlog]] — Feature ideas & bugs
- [[Tasks/Launch Readiness Plan\|Launch Readiness Plan]] — Unified P0/P1/P2 plan (both AIs agreed)
- [[Production-Plan-AI1]] — AI 1 detailed scan (backend & finance)
- [[Production-Plan-AI2]] — AI 2 detailed scan (frontend & UX)
- [[AI-Work-Split]] — File ownership rules to prevent merge conflicts

---

## Dev Log

Latest first:
- [[DevLog/2026-04-15|2026-04-15]] — Smart booking audit, auto-fix, satisfaction ping, waitlist auto-fill, rate limiter
- [[DevLog/2026-04-14|2026-04-14]] — Corporation approved, 10DLC brand, Developer Panel
- [[DevLog/2026-04-13|2026-04-13]] — Payroll profit fix, tips, booking validation
- [[DevLog/2026-04-13-ios|2026-04-13 (iOS)]] — Calendar/dashboard iOS fixes, push notifications
- [[DevLog/2026-04-12|2026-04-12]] — Payroll restyling, onboarding wizard, AI style
- [[DevLog/2026-04-10|2026-04-10]] — Messages staff sync, payroll date range

---

## Reference

- [[CHANGELOG]] — Version history
- [[APPLE_REVIEW_CHECKLIST]] — App Store submission checklist
- [[Lib Utilities]] — API client, auth, PIN, terminology helpers
