# Production Readiness Plan — AI 2 (Frontend, UX, Client Experience)

> [[Home]] > Plans & Process | See also: [[Production-Plan-AI1]], [[AI-Work-Split]], [[Tasks/Launch Readiness Plan|Launch Readiness Plan]]

> Scan date: 2026-04-13
> Based on: frontend audit, docs audit, primary customer-flow review

---

## Phase 1 — CRITICAL (Must fix before selling)

### 1.1 Finish mobile Settings navigation
- `app/settings/page.tsx`
- Current problem: on phone, category selection still feels like hidden content on a long page instead of true drill-down navigation
- Fix: dedicated category screen on mobile, reliable back navigation, no hidden content below the fold
- **Risk**: Owners do not understand where settings opened or how to get back

### 1.2 Verify Settings save/load consistency
- `app/settings/page.tsx`, related settings-backed screens
- Every important settings category must reflect real backend state after refresh:
  business info, booking, display, billing, permissions, integrations
- Fix false-confidence UI where a toggle appears saved but real behavior does not match
- **Risk**: Owners lose trust immediately if settings look saved but product behaves differently

### 1.3 Audit the full first-time owner journey
- `app/signin/page.tsx`
- `app/signup/page.tsx`
- `components/OnboardingWizard.tsx`
- `app/dashboard/page.tsx`
- Must feel coherent from account creation to first live booking page
- **Risk**: You cannot sell confidently if a new client needs manual help in the first 10 minutes

### 1.4 Fix critical public booking UX confusion
- `app/book/[id]/page.tsx`
- `app/manage-booking/page.tsx`
- Verify service selection, staff selection, slot selection, required fields, pricing visibility, notes, waitlist, cancel, reschedule
- Make sure user always understands what is happening next
- **Risk**: Lost bookings from avoidable confusion even if backend logic is technically correct

### 1.5 Replace rough browser-native interactions in key flows
- High-value routes still use `alert()` and `confirm()`
- Replace the most visible ones in:
  `app/settings/page.tsx`, `app/billing/page.tsx`, `components/Shell.tsx`, and other core account flows
- **Risk**: Product feels unfinished and internal instead of premium and sellable

### 1.6 Validate mobile usability on revenue-critical routes
- Core pages:
  `/settings`, `/dashboard`, `/book/[id]`, `/manage-booking`, `/billing`, `/signin`, `/signup`
- Check viewport behavior, keyboard overlap, spacing, bottom safe-area, CTA visibility, scroll traps
- **Risk**: Most real users will judge the product from mobile first

---

## Phase 2 — HIGH (Fix within first week)

### 2.1 Improve dashboard clarity for new owners
- `app/dashboard/page.tsx`
- Make the dashboard clearly answer:
  what needs setup, what is working, and what to do next
- Reduce “internal tool” feeling

### 2.2 Tighten onboarding-to-live-site continuity
- `components/OnboardingWizard.tsx`
- `app/dashboard/page.tsx`
- `app/book/[id]/page.tsx`
- Ensure onboarding choices immediately make sense in the live booking page and settings

### 2.3 Clarify billing and subscription messaging
- `app/billing/page.tsx`
- `app/settings/page.tsx`
- Make Apple vs Stripe subscription states, restore/cancel/manage actions, and plan gating understandable
- Billing must feel trustworthy and low-friction

### 2.4 Review trust and sales-support pages
- `/`
- `/pricing`
- `/support`
- `/faq`
- `/privacy`
- `/terms`
- Ensure the product is presentable to a buyer, not only usable by an internal tester

### 2.5 Improve empty, loading, and error states
- Owners and clients should never feel the app is broken when data is simply loading or missing
- Focus on settings, dashboard, booking, billing

---

## Phase 3 — MEDIUM (Fix within two weeks)

### 3.1 Normalize interaction patterns across the app
- Save states, toasts, confirmations, back behavior, and destructive actions should feel consistent
- Reduce UI surprises across settings, dashboard, booking, and account flows

### 3.2 Create a frontend QA checklist and demo checklist
- One checklist for internal verification
- One checklist for showing the product to prospects
- Prevent “works in code, awkward in demo” situations

### 3.3 Add basic frontend quality gates
- Root `package.json` currently has no lint/test workflow
- Add at least a minimal repeatable frontend verification path before pushing launch-critical changes
- This may be shared work if another AI needs to coordinate

---

## Phase 4 — POLISH

### 4.1 Secondary admin-screen cleanup
- Refine lower-priority pages once primary booking/sales flows are solid

### 4.2 Visual consistency pass
- Smooth out typography, spacing, CTA hierarchy, and helper text where the product still feels uneven

### 4.3 Post-launch UX cleanup backlog
- Capture remaining rough edges without blocking launch

---

## What I think about the overall project

**Strengths:**
- The product already has real depth: booking, payments, payroll, onboarding, client management, and mobile/iOS awareness
- Public booking and owner tooling are much more advanced than a simple booking MVP
- The architecture is flexible enough to sell to different business types

**Biggest risks for paying customers:**
1. Settings confidence gap — if owners change something and the result is unclear, they will not trust the product
2. First-time user confusion — signup, onboarding, dashboard, and booking must feel obvious without explanation
3. Premium-feel gap — native `alert()` / `confirm()`, inconsistent states, and mobile roughness make the product feel less ready than it really is

**Production readiness estimate:** Fix Phase 1 + high-priority items in Phase 2 = ready to sell and demo confidently. Finish Phase 3 + 4 = much stronger retention and lower support burden.
