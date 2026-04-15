# Varium (VuriumBook)

> ⚠️ **ВСІМ AI: Читати [[AI-Core-Manifesto]] перед початком будь-якої роботи. Обов'язково.**
> ⛔ **Поки немає нового запису в [[AI-Session-Acceptance-Log]], AI не має права продовжувати далі.**

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
| **Who's working** | 4 AI + Owner — see [[Tasks/3-AI-Remaining-Work-Split\|4-AI Work Split]] + [[AI-Session-Acceptance-Log]] |
| **AI profiles** | [[AI-Profiles/README\|AI Profiles]] |

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15, React 19, TypeScript |
| Backend | Express.js, Node.js |
| Database | Google Cloud Firestore |
| Payments | Stripe Connect, Square |
| Auth | JWT, Apple/Google OAuth, MFA |
| SMS | Telnyx (toll-free default + grandfathered 10DLC + Verify) |
| AI | Anthropic Claude API |
| Hosting | Vercel (frontend), Cloud Run (backend) |
| iOS | WKWebView wrapper + native push notifications |

> Deep dive: [[Tech Stack]] · [[ARCHITECTURE]]

---

## Architecture

- [[Tech Stack]] — Full stack details, integrations, security
- [[Database Schema]] — Firestore multi-tenant model (23 collections)
- [[Auth Flow]] — JWT cookies, Apple/Google OAuth, MFA, PIN, roles
- [[Web-Native-Auth-Contract]] — ⚠️ **LOAD-BEARING** web ↔ iOS cookie contract (reference before touching `middleware.ts` / `lib/auth-cookie.ts` / `lib/api.ts` / `components/Shell.tsx`)
- [[API Routes]] — 193 endpoints across 15+ domains
- [[Firestore Collections]] — Collection reference
- [[App Routes]] — 43 pages (Next.js App Router)
- [[Components]] — 11 reusable components (Shell, OnboardingWizard, ImageCropper, dialogs, gates)
- [[Lib Utilities]] — 7 shared utils (API client, PIN crypto, terminology, timezones)
- [[Infrastructure]] — CI/CD (GitHub Actions → Cloud Run), env vars, security headers, Docker
- [[Background Jobs]] — 6 auto jobs (reminders, memberships, audits, cleanup)
- [[Security & Audit]] — Rate limiting, audit logs, GDPR export

---

## Features

| Feature | Description | Doc |
|---------|-------------|-----|
| Booking | Public booking, smart audit, auto-fix, satisfaction ping, rate limiter | [[Booking System]] |
| Calendar | Interactive grid, drag-and-drop, schedule overrides, mobile | [[Calendar & Scheduling]] |
| Waitlist | Public self-join, preferred time range, email/SMS notifications, calendar ghost blocks | [[Waitlist]] |
| Payments | Stripe Connect, Square, terminals, Apple IAP | [[Payments]] |
| Clients | CRM, booking history, phone verification | [[Client Management]] |
| Memberships | Recurring plans, auto-generated bookings, discounts | [[Memberships]] |
| Reviews | Moderation, Google import, satisfaction ping, public display | [[Reviews]] |
| Onboarding | 4-step wizard for new workspaces | [[Onboarding Wizard]] |
| Templates | Pre-filled services per business type | [[Business Templates]] |
| AI Style | AI-generated branding/themes for booking pages | [[AI Style]] |
| Payroll | Clock in/out, commissions, tips, owner profit | [[Attendance & Payroll]] |
| Expenses | Business expenses with categories, cash register | [[Expenses & Cash Register]] |
| Billing | Stripe + Apple IAP subscriptions, trial, plan gating | [[Billing & Subscriptions]] |
| SMS & 10DLC | Telnyx toll-free default, grandfathered manual 10DLC, Telnyx Verify for OTP | [[SMS & 10DLC]] |
| Push | APNs notifications, deep links, booking/message alerts | [[Push Notifications]] |
| Email | Transactional emails, Gmail integration for admin | [[Email System]] |
| Messaging | In-app staff chat plus shared SMS / email / push delivery notes | [[Messages & Chat]] · [[Messaging-System-AI1]] · [[Messaging-System-AI2]] |
| Analytics | Booking page traffic, sources, hourly breakdown | [[Analytics]] |
| Permissions | Role-based access: admin, manager, staff | [[Role Permissions]] |
| Staff Requests | Schedule/profile change requests, job applications | [[Staff Requests & Applications]] |
| iOS App | WKWebView hybrid, StoreKit IAP, biometrics, push | [[iOS App]] |
| Public Site | Marketing pages, blog, careers, legal pages | [[Public Website]] |
| Dev Panel | Platform admin: magic link auth, analytics, email, SMS ops | [[Developer Panel]] |

---

## Tasks & Plans

- [[Tasks/In Progress\|In Progress]] — Current sprint (P0 items + active tasks)
- [[Tasks/3-AI-Remaining-Work-Split|3-AI Remaining Work Split]] — **current sprint plan** — every open item categorized by AI (Claude / Codex / Verdent / Owner) with priorities and effort
- [[Tasks/Backlog\|Backlog]] — Feature ideas & bugs
- [[Tasks/Launch Readiness Plan\|Launch Readiness Plan]] — Unified P0/P1/P2 plan (both AIs agreed)
- [[Tasks/Telnyx-Integration-Plan|Telnyx Integration Plan]] — Hardening + P0 fixes (Verify profile, webhook sig, auto-provision on plan activation)
- [[Tasks/Element-10DLC-Resubmission-Checklist|Element 10DLC Resubmission Checklist]] — Pre-resubmission checklist for campaign CICHCOJ (MNO failure 2026-04-15)
- [[Tasks/Live-SMS-Verification-Checklist|Live SMS Verification Checklist]] — One-shot deep runbook for Gap 2–5 after deploy (AI 1, BE.3)
- [[Tasks/Launch-Verification-Runbook|Launch Verification Runbook]] — Generic post-deploy flow verification (Verdent, VR.4)
- [[Tasks/Deploy-Smoke-Test|Deploy Smoke Test]] — 5-minute post-push sanity check (Verdent, VR.5)
- [[Tasks/Platform-Sender-Pivot-Decision|Platform Sender Pivot Decision]] — Decision note: чому НЕ переходимо на shared Vurium TFN зараз, draft листа Jonathan
- [[Tasks/SMS Delivery Options Research\|SMS Delivery Options Research]] — Broader SMS provider, country, sender-ID, and architecture research
- [[Tasks/SMS Finalization Plan\|SMS Finalization Plan]] — SMS launch steps
- [[Tasks/SMS-Strategy-Review\|SMS Strategy Review]] — Dual-path launch memo
- [[Tasks/Edge Case Bugs\|Edge Case Bugs]] — Deep scan edge cases
- [[Tasks/Pre-Deploy Safety Audit\|Pre-Deploy Safety Audit]] — Pre-deploy checks
- [[Production-Plan-AI1]] — AI 1 detailed scan (backend & finance)
- [[Production-Plan-AI2]] — AI 2 detailed scan (frontend & UX)
- [[AI-Work-Split]] — File ownership rules to prevent merge conflicts

### Improvement Plans
- [[Registration-Improvement-AI1]] — Signup page UX plan (AI 1)
- [[Registration-Improvement-AI2]] — Signup page UX plan (AI 2)
- [[PublicSite-AI1]] — Public mini-site backend plan (AI 1)
- [[PublicSite-AI2]] — Public mini-site frontend plan (AI 2)
- [[Developer Panel — Improvement Plan]] — Dev panel upgrade log
- [[Theme-Light-AI1]] — Light theme: CSS architecture (AI 1)
- [[Theme-Light-AI2]] — Light theme: components & toggle (AI 2)

---

## Dev Log

Latest first:
- [[DevLog/2026-04-15|2026-04-15]] — Smart booking audit, auto-fix, satisfaction ping, waitlist auto-fill, rate limiter
- [[DevLog/2026-04-14-website|2026-04-14 (Website)]] — Marketing pages, pricing, support
- [[DevLog/2026-04-14|2026-04-14]] — Corporation approved, 10DLC brand, Developer Panel
- [[DevLog/2026-04-13|2026-04-13]] — Payroll, tips, booking, settings mobile drill-down, SMS/10DLC
  - [[DevLog/2026-04-13-history|History page]]
  - [[DevLog/2026-04-13-analytics|Analytics page]]
  - [[DevLog/2026-04-13-registration|Registration & onboarding]]
  - [[DevLog/2026-04-13-performance|Performance optimization]]
  - [[DevLog/2026-04-13-custom-code-sms|Custom code & SMS]]
  - [[DevLog/2026-04-13-dashboard-widgets|Dashboard widgets]]
  - [[DevLog/2026-04-13-accounts-permissions|Accounts & permissions]]
  - [[DevLog/2026-04-13-messages|Messages]]
  - [[DevLog/2026-04-13-waitlist|Waitlist]]
  - [[DevLog/2026-04-13-square|Square integration]]
  - [[DevLog/2026-04-13-attendance|Attendance]]
  - [[DevLog/2026-04-13-session2|Session 2]]
  - [[DevLog/2026-04-13-session3|Session 3 — Email, QA, Security, App Store]]
- [[DevLog/2026-04-13-ios|2026-04-13 (iOS)]] — Calendar/dashboard iOS fixes, push notifications
- [[DevLog/2026-04-12|2026-04-12]] — Payroll restyling, onboarding wizard, AI style
- [[DevLog/2026-04-10|2026-04-10]] — Messages staff sync, payroll date range

---

## QA & Quality

- [[QA-Scanner-Guide]] — How to run QA/bug-hunting sessions
- [[Tasks/QA-Scan-2026-04-15|QA Scan 2026-04-15]] — Sprint 1 post-commit status (Verdent VR.6)
- [[Tasks/QA-Scan-2026-04-14|QA Scan 2026-04-14]] — AI 1 review of unstaged changes
- [[Tasks/QA-Scan-2026-04-13|QA Scan 2026-04-13]] — Claude Opus QA session
- [[Tasks/Launch-Verification-Runbook|Launch Verification Runbook]] — Full pre-launch checklist (VR.4)
- [[Tasks/Deploy-Smoke-Test|Deploy Smoke Test]] — 5-min post-deploy sanity check (VR.5)
- [[Permissions]] — Role permission matrix reference

---

## Reference

- [[CHANGELOG]] — Version history
- [[APPLE_REVIEW_CHECKLIST]] — App Store submission checklist
- [[Element CRM App]] — Separate iOS app for Element Barbershop (not VuriumBook)

### Telnyx & Legal Documents (`docs/Telnyx/`)
- `CP_575_A.pdf` — IRS CP-575A letter for brand verification
- `CorpArt.pdf` / `Corporation Articles of Incorporation.pdf` — Vurium Inc. articles
- `IRS Apply for an EIN online.pdf` — EIN application reference
- `Carrier-review readiness audit...pdf` — Telnyx 10DLC carrier review audit
- `Platform-level CUSTOMER_CARE 10DLC...pdf` — 10DLC platform architecture docs
- `VURIUM_Subscription_Account_Structure.pdf` — Subscription/account structure (root)
