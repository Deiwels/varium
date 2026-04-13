# Varium (VuriumBook)

> Multi-tenant booking & business management platform

## Quick Links

### Architecture
- [[Tech Stack]] — Next.js 15, Express, Firestore, Stripe
- [[Database Schema]] — Firestore collections & structure
- [[Auth Flow]] — JWT, Apple/Google Sign-In, MFA

### Features
- [[Booking System]] — Public booking, availability, group bookings
- [[Payments]] — Stripe Connect, Square, terminals
- [[Calendar & Scheduling]] — Calendar view, schedule overrides
- [[Client Management]] — Clients, history, phone verification
- [[Onboarding Wizard]] — 4-step setup wizard for new workspaces
- [[Business Templates]] — Pre-filled service templates per business type
- [[AI Style]] — AI-generated branding/styling
- [[Memberships]] — Membership plans
- [[Messaging]] — Team DMs
- [[Attendance & Payroll]] — Clock in/out, payroll rules, tips
- [[Analytics]] — Summary & detailed analytics
- [[Reviews]] — Review management & import

### Backend
- [[API Routes]] — 193 endpoints across 15+ domains
- [[Firestore Collections]] — 23 collections

### Frontend
- [[App Routes]] — 43 pages (App Router)
- [[Components]] — 10 core components
- [[Lib Utilities]] — API client, auth, PIN, terminology

### Dev
- [[DevLog/index|Dev Log]] — Daily notes
- [[Tasks/Backlog|Backlog]] — Feature ideas & bugs
- [[Tasks/In Progress|In Progress]] — Current work

---

## Tech Overview

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15, React 19, TypeScript |
| Backend | Express.js, Node.js |
| Database | Google Cloud Firestore |
| Payments | Stripe Connect, Square |
| Auth | JWT, Apple/Google OAuth, MFA |
| SMS | Telnyx |
| AI | Anthropic Claude API |
| Hosting | Vercel (frontend), Cloud Run (backend) |
