# Varium (VuriumBook)

> 📌 **ВСІМ AI: перед створенням/редагуванням будь-якого .md файлу — обов'язково прочитати [[Vault Rules]]** (де класти, як називати, як лінкувати, як додавати в Home).
> ⚠️ **ВСІМ AI: Читати [[AI-Rule-Updates]] і [[AI-Core-Manifesto]] перед початком будь-якої роботи. Обов'язково.**
> ⛔ **Поки немає нового запису в [[AI-Session-Acceptance-Log]], AI не має права продовжувати далі.**
> 🧠 **Якщо задача потребує планування — вона йде в `In Progress.md` як `@AI3 [PLAN REQUEST]`, а реалізація блокується до завершення 4-AI Plan Review Gate.**
> 📥 **Якщо AI 4 залишив review у GitHub — він не рахується видимим, поки сам review-doc не буде синхронізований локально в `docs/Tasks/`.**

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
| **Rule updates** | [[AI-Rule-Updates\|AI Rule Updates]] |

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
- [[GitHub Secrets Inventory]] — Owner-confirmed list of repo secrets
- [[Decision-Log]] — Architecture decision register (owner: AI 3 Verdent)
- [[Superadmin-Endpoints]] — Platform admin endpoints reference
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
- [[Tasks/AI4-Emergency-Readiness-Review-2026-04-15|AI 4 Emergency Readiness Review]] — current AI 4 sign-off and emergency-readiness asks
- [[Tasks/Backlog\|Backlog]] — Feature ideas & bugs
- [[Tasks/Launch Readiness Plan\|Launch Readiness Plan]] — Unified P0/P1/P2 plan (both AIs agreed)
- [[Tasks/Telnyx-Integration-Plan|Telnyx Integration Plan]] — Hardening + P0 fixes (Verify profile, webhook sig, auto-provision on plan activation)
- [[Tasks/Element-10DLC-Resubmission-Checklist|Element 10DLC Resubmission Checklist]] — Evidence + monitoring log for campaign CICHCOJ (now Pending MNO Review)
- [[Tasks/Element-CICHCOJ-Pre-MNO-DoubleCheck-2026-04-15|Element CICHCOJ Pre-MNO Double Check]] — AI 4 verification that production code matches campaign submission description (2026-04-15)
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

### BE.1 / BE.8 / BE.9 / FE.28 — Sprint Reviews & Plans
- [[Tasks/BE.1-Post-Commit-Review|BE.1 Post-Commit Review]]
- [[Tasks/job_locks-Emergency-Runbook|job_locks Emergency Runbook]]
- [[Tasks/BE.8-BE.9-AI1-Review|BE.8/BE.9 AI 1 Review]]
- [[Tasks/BE.8-BE.9-AI2-Review|BE.8/BE.9 AI 2 Review]]
- [[Tasks/BE.8-Legacy-SMS-Migration-Plan|BE.8 Legacy SMS Migration Plan]]
- [[Tasks/BE.8-Legacy-SMS-Migration-Plan-v2|BE.8 Legacy SMS Migration Plan v2]]
- [[Tasks/BE.9-DOMPurify-Custom-HTML-Plan|BE.9 DOMPurify Custom HTML Plan]]
- [[Tasks/BE.9-DOMPurify-Custom-HTML-Plan-v2|BE.9 DOMPurify Custom HTML Plan v2]]
- [[Tasks/FE.28-AI1-PostMerge-Review|FE.28 AI 1 Post-Merge Review]]

### AI 4 Coordination
- [[Tasks/AI4-Branch-Resolution-2026-04-15|AI 4 Branch Resolution]]
- [[Tasks/AI4-Standby-Status-Check-2026-04-15|AI 4 Standby Status Check]]

### Standalone Notes
- [[Tasks/Reminder-SMS-TFV-Implementation-Plan|Reminder SMS TFV Implementation Plan]] — **🆕 AI 3 plan** для інтеграції Toll-Free Verification у provisioning; чекає 4-AI Review Gate
- [[Tasks/Temporary-Reminder-Delivery-Options|Temporary Reminder Delivery Options]]
- [[Tasks/US-A2P-CTA-Brand-Verification-Notes|US A2P CTA Brand Verification Notes]]
- [[Tasks/Reminder-SMS-Launch-Completion|Reminder SMS Launch Completion]]
- [[Tasks/AI5-Research-Brief-Reminder-SMS|AI 5 Research Brief — Reminder SMS]]
- [[Tasks/AI5-Research-Brief-Template|AI 5 Research Brief — Template]]
- [[Tasks/TFV-Inspection-and-Submission-Runbook|TFV Inspection & Submission Runbook]]

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

## AI Profiles

- [[Owner-Nazarii]] — Owner profile, expectations, escalation rules
- [[AI-1-Claude]] — Claude Code CLI (backend, infra)
- [[AI-2-Codex]] — Codex / Claude Web (frontend, UX)
- [[AI-3-Verdent]] — Verdent (architecture decisions, QA)
- [[AI-4-Phone-AI]] — Phone AI profile
- [[AI-4-Activation-Protocol]] — AI 4 activation protocol
- [[AI-5-GPT-Chat-Deep-Research]] — GPT Chat Deep Research (external truth / research specialist)

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
