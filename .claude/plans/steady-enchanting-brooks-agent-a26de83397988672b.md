# Vurium SaaS Website Build-Out — Implementation Plan

## Architecture Summary

**Current state**: Next.js 15 + App Router, React 19, TypeScript. Minimal dependencies (only Stripe + core Next/React). All public pages are `'use client'` components with inline styles + globals.css classes. No shared layout components — each page renders its own navbar and footer inline. Dark cosmic theme with parallax starfield from `layout.tsx`.

**Key conventions discovered**:
- Pages that need their own starfield (home, vuriumbook) hide the global cosmos via `document.getElementById('vurium-cosmos').style.display = 'none'` and render `.space-bg` locally
- Simple content pages (privacy, support, terms) rely on the global `#vurium-cosmos` starfield from `layout.tsx` — no local `.space-bg`
- Every page starts with `'use client'`
- Navbar is inline per-page (not a shared component)
- Footer is inline per-page
- Style objects defined as `const` at module scope for reuse within a page
- CSS classes: `.navbar`, `.navbar-logo`, `.navbar-links`, `.glass-card`, `.shimmer-text`, `.label-glow`, `.btn-primary`, `.btn-secondary`, `.fade-up`, `.fade-up-d1` through `.fade-up-d4`
- Color palette: accent blue `rgba(130,150,220,*)`, green `rgba(130,220,170,*)`, amber `rgba(220,170,100,*)`, text hierarchy `#f0f0f5` / `rgba(255,255,255,.6)` / `.45` / `.4` / `.35` / `.25` / `.2`
- Container: `maxWidth: 1080` (or 800 for text-heavy), `margin: '0 auto'`, `padding: 'clamp(...) 24px'`
- Font sizing: `clamp()` responsive, e.g. `clamp(28px, 4.5vw, 48px)` for h2

---

## Phase 1: Infrastructure & Shared Patterns (do first)

### 1.1 MDX Blog Infrastructure

**Goal**: Set up `@next/mdx` for static blog posts stored in the repo.

**Steps**:
1. Install `@next/mdx` and `@mdx-js/react` (only 2 lightweight deps)
   ```
   npm install @next/mdx @mdx-js/react
   ```
2. Update `/next.config.mjs` to enable MDX:
   ```js
   import createMDX from '@next/mdx'
   const withMDX = createMDX({ extension: /\.mdx?$/ })
   export default withMDX({ ...nextConfig, pageExtensions: ['ts', 'tsx', 'md', 'mdx'] })
   ```
3. Create `/app/blog/` directory structure:
   ```
   app/blog/
     page.tsx              — Blog listing page
     [slug]/
       page.tsx            — Dynamic article page (reads MDX)
     _posts/               — MDX content directory
       getting-started-with-vuriumbook.mdx
       online-booking-barbershops-2026.mdx
       managing-salon-team-schedules.mdx
   ```
4. Create `/app/blog/_components/mdx-components.tsx` — custom MDX component map that styles headings, paragraphs, code blocks, links using the cosmic theme inline styles
5. Create `/app/blog/_lib/posts.ts` — utility to read MDX frontmatter (title, date, excerpt, slug, author, tags) using `fs` and `gray-matter` (add `gray-matter` as dependency) or manual frontmatter parsing to avoid the dep

**Alternative (simpler, no extra deps)**: Instead of dynamic MDX loading, use the App Router convention where each blog post is its own route:
   ```
   app/blog/
     page.tsx
     getting-started-with-vuriumbook/page.tsx
     online-booking-barbershops-2026/page.tsx
     managing-salon-team-schedules/page.tsx
   ```
   Each post page is a regular TSX file with the article content inline. This matches the existing pattern (no new dependencies), keeps things simple, and the blog listing page just has a hardcoded array of posts. **This is the recommended approach** given the constraint of minimal dependencies.

### 1.2 Establish Reusable Style Constants

Since the project does not use shared components for navbar/footer (each page inlines them), maintain this pattern but define a shared style constants file for new pages.

Create `/app/_styles/shared.ts`:
```ts
// Common inline style objects reused across new public pages
export const heading: React.CSSProperties = { ... }
export const text: React.CSSProperties = { ... }
export const sectionPadding = 'clamp(60px, 10vh, 100px) 24px'
export const containerNarrow = { maxWidth: 800, margin: '0 auto' }
export const containerWide = { maxWidth: 1080, margin: '0 auto' }
```

This is optional — the existing pages (privacy, support) define these at the top of each file. The new pages can follow the same pattern. But if we want consistency without a shared component, a shared style constants file helps.

**Decision**: Follow existing pattern — define style constants at the top of each page file. No shared file needed. This keeps each page self-contained.

---

## Phase 2: New Pages

### 2.1 About Page — `/app/about/page.tsx`

**Structure**:
```
'use client'

Navbar (inline, same pattern as privacy/support pages):
  Logo: "Vurium"
  Links: Home, VuriumBook, Blog, Contact

Hero section:
  .label-glow badge: "About Us"
  .shimmer-text h1: "We build software that works."
  Subtitle: Company mission statement

Mission & Values section (maxWidth 1080):
  .label-glow: "Our Mission"
  .shimmer-text h2: "Software should just work."
  Paragraph explaining Vurium's mission — reliable, modern tools for service businesses
  3-column grid of value cards (.glass-card):
    - "Reliability" (green accent bar)
    - "Simplicity" (blue accent bar)  
    - "Craftsmanship" (amber accent bar)

Team section (maxWidth 1080):
  .label-glow: "Team"
  .shimmer-text h2: "The people behind Vurium."
  Grid of team member cards (.glass-card):
    - Placeholder avatar (CSS circle with initials)
    - Name, role, short bio
    - 2-3 team members (can be placeholder/generic)

Certifications/Trust section:
  Row of trust badges/certifications (GDPR compliant, SSL secured, Stripe certified, etc.)
  Simple horizontal layout with icons (use Unicode or simple CSS shapes, no image deps)

Contact CTA section:
  .shimmer-text h2: "Want to work with us?"
  .btn-primary: "Get in Touch" -> /contact
  .btn-secondary: "View Careers" -> /careers

Footer (inline, standard pattern)
```

**Content notes**:
- Mission: Vurium builds reliable, modern software for service businesses
- Values: Reliability, simplicity, craftsmanship
- Team: Use placeholder team members (founder, lead engineer, designer) — to be replaced with real data later
- Badges: GDPR, SOC 2 (planned), Stripe partner, 99.9% uptime

### 2.2 Blog Listing Page — `/app/blog/page.tsx`

**Structure**:
```
'use client'

Navbar (inline):
  Logo: "Vurium"
  Links: Home, VuriumBook, About, Contact

Hero section:
  .label-glow: "Blog"
  .shimmer-text h1: "Insights & Updates"
  Subtitle: "Tips, guides, and news from the Vurium team."

Posts grid (maxWidth 1080):
  Array of post objects (hardcoded): { slug, title, excerpt, date, author, tag }
  Map to .glass-card grid (1-2 columns):
    Each card:
      - Tag badge (small, uppercase, colored)
      - Title (h3, linked)
      - Excerpt (2-3 lines, muted text)
      - Date + author (bottom, smallest text)
      - "Read more →" link in accent blue

Footer (inline)
```

### 2.3 Blog Article Pages

Create 3 article pages as individual route files (no MDX infrastructure needed):

**`/app/blog/getting-started-with-vuriumbook/page.tsx`**
- Title: "Getting Started with VuriumBook: A Complete Guide"
- Content: Setup walkthrough, key features overview, first booking setup
- ~800 words of content

**`/app/blog/online-booking-for-barbershops/page.tsx`**
- Title: "Why Every Barbershop Needs Online Booking in 2026"
- Content: Industry trends, client expectations, ROI of online booking
- ~600 words

**`/app/blog/managing-salon-team-schedules/page.tsx`**
- Title: "How to Manage Salon Team Schedules Without the Chaos"
- Content: Team management challenges, how VuriumBook solves them
- ~600 words

**Article page template** (same for all 3):
```
'use client'

Navbar (inline)

Article layout (maxWidth: 800, same as privacy/terms pattern):
  .label-glow: tag (e.g., "Guide")
  .shimmer-text h1: article title
  Meta: date · author · reading time
  
  Article body:
    Style constants matching privacy page: heading, text, list, highlight
    Sections with h2 headings (styled like privacy page headings)
    Paragraphs in muted text
    Occasional .glass-card or highlight boxes for callouts
    
  Bottom CTA:
    "Ready to try VuriumBook?"
    .btn-primary → /signup
    
  Back to blog link

Footer (inline)
```

### 2.4 Contact Page — `/app/contact/page.tsx`

**Structure**:
```
'use client' with useState for form state

Navbar (inline)

Hero section:
  .label-glow: "Contact"
  .shimmer-text h1: "Get in touch."
  Subtitle: "Questions, partnerships, or just want to say hello."

Two-column layout (maxWidth 1080):
  Left column — Contact form (.glass-card):
    Fields (styled like signin page inputs):
      - Name (text input)
      - Email (email input)
      - Subject (select: General, Sales, Support, Partnership)
      - Message (textarea)
    Submit button (.btn-primary)
    Form posts to mailto: or shows success message (no backend needed initially)
    
  Right column — Contact info:
    .glass-card blocks:
      - Email: support@vurium.com
      - Sales: sales@vurium.com
      - Address: (placeholder business address)
      - Hours: Mon-Fri, 9am-6pm EST
      - Social links (placeholder)

  On mobile: stacks to single column

Footer (inline)
```

**Form behavior**: Client-side only for now. On submit, show a success message. Can be wired to an API endpoint later. Use `useState` for form fields and submission state.

### 2.5 FAQ Page — `/app/faq/page.tsx`

**Structure**:
```
'use client' with useState for accordion state

Navbar (inline)

Hero section:
  .label-glow: "FAQ"
  .shimmer-text h1: "Frequently Asked Questions"
  Subtitle: "Everything you need to know about VuriumBook."

FAQ sections (maxWidth: 800):
  Organized by category with .label-glow category headers:
  
  "Getting Started" category:
    - What is VuriumBook?
    - How do I sign up?
    - Is there a free trial?
    - What happens after the trial ends?
  
  "Pricing & Billing" category:
    - How much does VuriumBook cost?
    - Can I change plans?
    - How do I cancel?
    - Do you offer refunds?
  
  "Features" category:
    - Can my clients book online?
    - Does it work on mobile?
    - Can I manage multiple team members?
    - Do you support payments?
  
  "Data & Privacy" category:
    - Is my data secure?
    - Are you GDPR compliant?
    - Can I export my data?

  Each FAQ item:
    - Clickable question row (h3 styled, with +/- indicator)
    - Collapsible answer (muted text, hidden by default)
    - Toggle via useState per item or a Set of open indices
    - Smooth height transition via CSS (max-height + overflow hidden)

CTA section:
  "Still have questions?"
  .btn-primary: "Contact Support" → /contact

Footer (inline)
```

### 2.6 Careers Page — `/app/careers/page.tsx`

**Structure**:
```
'use client'

Navbar (inline)

Hero section:
  .label-glow: "Careers"
  .shimmer-text h1: "Build the future with us."
  Subtitle: "We're a small team with big ambitions. Join us."

Culture section (maxWidth 1080):
  .label-glow: "Culture"
  .shimmer-text h2: "Why Vurium?"
  3-column grid of benefit cards (.glass-card):
    - "Remote First" — Work from anywhere, async communication
    - "Ownership" — Small team, big impact, real ownership
    - "Growth" — Learn, build, ship, repeat

Benefits section:
  .label-glow: "Benefits"
  2-column grid or list:
    - Competitive salary
    - Remote work
    - Flexible hours
    - Health & wellness stipend
    - Equipment budget
    - Learning budget

Open Positions section (maxWidth 1080):
  .label-glow: "Open Positions"
  .shimmer-text h2: "Current openings"
  
  Job listing cards (.glass-card):
    Each card:
      - Job title (h3)
      - Department tag + Location tag (remote)
      - Short description
      - "Apply" button (.btn-secondary) → mailto:careers@vurium.com or expands application form
      
    Sample positions:
      - Full-Stack Engineer (Engineering, Remote)
      - Product Designer (Design, Remote)
      - Customer Success Manager (Support, Remote)
  
  Or: "No open positions right now" message with "Send us your resume anyway" CTA

Footer (inline)
```

---

## Phase 3: Enhanced Existing Pages

### 3.1 Home Page Enhancements — `/app/page.tsx`

Add the following sections between the existing "About / Features" section and the "Contact" section:

**Testimonials section**:
```
.label-glow: "Testimonials"
.shimmer-text h2: "Trusted by businesses."
3-column grid of testimonial cards (.glass-card):
  Each card:
    - Quote text (italic, muted)
    - Author name + business name (smaller, slightly brighter)
    - Star rating (Unicode ★ in accent color)
  3 placeholder testimonials from barbershop/salon owners
```

**Metrics/Stats section**:
```
3-4 stat blocks in a row:
  - "500+" — Active businesses
  - "50,000+" — Bookings processed
  - "99.9%" — Uptime
  - "4.9★" — Average rating
Styled: large number in #e8e8ed, label in muted text, simple layout
```

**Client logos section** (optional, can be placeholder):
```
.label-glow: "Trusted By"
Row of placeholder logo spots (grey rectangles or "Partner" text)
OR skip this until real logos are available
```

**Updated navbar links**:
```html
<li><a href="/vuriumbook">VuriumBook</a></li>
<li><a href="/about">About</a></li>
<li><a href="/blog">Blog</a></li>
<li><a href="/contact">Contact</a></li>
```

### 3.2 VuriumBook Page Enhancements — `/app/vuriumbook/page.tsx`

Add between hero and features:

**Problem → Solution section**:
```
.label-glow: "The Problem"
.shimmer-text h2: "Scheduling shouldn't be this hard."
Two-column layout:
  Left: Pain points list (missed calls, double bookings, spreadsheet chaos, no-shows)
  Right: Solution summary — VuriumBook handles it all
Transition to "The Solution" with brief product overview
```

Add after features, before pricing:

**Demo video placeholder**:
```
.glass-card with 16:9 aspect ratio
  Centered play button icon (CSS triangle)
  "Product Demo — Coming Soon" text
  Dark overlay on the glass card
```

**Testimonials section** (same pattern as home but VuriumBook-specific):
```
2-3 testimonials from users about specific features
```

**Integrations section**:
```
.label-glow: "Integrations"
.shimmer-text h2: "Works with your tools."
Row of integration badges:
  - Stripe (payments)
  - Apple Pay
  - Google Calendar (coming soon)
  - SMS/Telnyx
Simple icon + name layout
```

Add after pricing:

**FAQ section** (mini version):
```
5-6 pricing-specific questions with expandable answers
Link to full /faq page
```

**Plan comparison table**:
```
.glass-card wrapping a responsive table
Rows: each feature
Columns: Individual / Salon / Custom
Checkmarks (✓) or dashes (—) for feature availability
On mobile: horizontal scroll or stacked cards
```

### 3.3 Navigation Updates

**Updated public navbar** (apply to all new + existing public pages):
```html
<nav class="navbar">
  <a href="/" class="navbar-logo">
    <img src="/logo.jpg" alt="Vurium" />
    Vurium
  </a>
  <ul class="navbar-links">
    <li><a href="/vuriumbook">VuriumBook</a></li>
    <li><a href="/about">About</a></li>
    <li><a href="/blog">Blog</a></li>
    <li><a href="/contact">Contact</a></li>
    <li><a href="/signin" class="btn-nav-cta">Sign In</a></li>
  </ul>
</nav>
```

Note: `.btn-nav-cta` already exists in globals.css (lines 518-537) — white pill button.

**Pages to update navbar on**:
- `/app/page.tsx` — add About, Blog, Contact links + Sign In CTA
- `/app/vuriumbook/page.tsx` — update links to match
- `/app/privacy/page.tsx` — update links
- `/app/terms/page.tsx` — update links
- `/app/support/page.tsx` — update links
- `/app/cookies/page.tsx` — update links
- `/app/accessibility/page.tsx` — update links
- `/app/dpa/page.tsx` — update links

### 3.4 Footer Updates

**Updated footer** (apply to all public pages):
```html
<footer style="...">
  <div style="maxWidth: 1080, margin: '0 auto', display: grid, 4-column layout">
    <!-- Column 1: Brand -->
    <div>
      Vurium logo + name
      Brief tagline
      © 2026 Vurium™
    </div>
    
    <!-- Column 2: Product -->
    <div>
      "Product" heading
      - VuriumBook
      - Pricing
      - Features
    </div>
    
    <!-- Column 3: Company -->
    <div>
      "Company" heading
      - About
      - Blog
      - Careers
      - Contact
    </div>
    
    <!-- Column 4: Legal -->
    <div>
      "Legal" heading
      - Privacy Policy
      - Terms of Service
      - Cookie Policy
      - DPA
      - Accessibility
      - Support
    </div>
  </div>
  
  <div style="border-top, flex row">
    © 2026 Vurium™. All rights reserved.
    Email: support@vurium.com
  </div>
</footer>
```

On mobile: 2-column or stacked layout.

---

## Phase 4: CSS Additions to globals.css

Add minimal new CSS classes:

```css
/* FAQ accordion */
.faq-item { border-bottom: 1px solid rgba(255,255,255,.05); }
.faq-question {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20px 0; cursor: pointer;
  font-size: 15px; font-weight: 500; color: rgba(255,255,255,.7);
  transition: color .3s;
}
.faq-question:hover { color: rgba(255,255,255,.9); }
.faq-answer {
  max-height: 0; overflow: hidden;
  transition: max-height .3s ease-out;
  color: rgba(255,255,255,.4); font-size: 14px; line-height: 1.7;
}
.faq-answer.open { max-height: 500px; }

/* Contact form inputs (reuse signin pattern) */
.form-input {
  width: 100%; height: 48px; padding: 0 16px;
  border-radius: 12px; border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.03); color: #f0f0f5;
  font-family: inherit; font-size: 14px;
  transition: border-color .3s;
}
.form-input:focus {
  outline: none; border-color: rgba(130,150,220,.3);
}
.form-textarea {
  /* same as .form-input but with height/resize */
  min-height: 120px; padding: 14px 16px; resize: vertical;
}

/* Stats counter */
.stat-number {
  font-size: clamp(28px, 4vw, 42px); font-weight: 600;
  color: #e8e8ed; letter-spacing: -.02em;
}
.stat-label {
  font-size: 12px; color: rgba(255,255,255,.3);
  text-transform: uppercase; letter-spacing: .08em;
}
```

---

## Phase 5: SEO Metadata

Each new page should export `metadata` for SEO. Since all pages are `'use client'`, metadata must be handled via a separate `layout.tsx` or by using `<head>` tags within the client component. 

**Recommended approach**: Create a `layout.tsx` for each new route that exports metadata:

- `/app/about/layout.tsx` — `title: 'About — Vurium'`
- `/app/blog/layout.tsx` — `title: 'Blog — Vurium'`
- `/app/blog/[slug]/layout.tsx` — dynamic titles per post (or hardcoded per post route)
- `/app/contact/layout.tsx` — `title: 'Contact — Vurium'`
- `/app/faq/layout.tsx` — `title: 'FAQ — Vurium'`
- `/app/careers/layout.tsx` — `title: 'Careers — Vurium'`

Each layout is a simple passthrough:
```tsx
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'About — Vurium', description: '...' }
export default function Layout({ children }: { children: React.ReactNode }) { return children }
```

---

## Implementation Order

1. **Phase 1**: No MDX infrastructure needed — use plain TSX blog posts. Create shared style reference (optional).

2. **Phase 2** (new pages, in dependency order):
   a. `/app/contact/page.tsx` — standalone, no deps
   b. `/app/faq/page.tsx` — standalone, accordion logic
   c. `/app/about/page.tsx` — standalone
   d. `/app/careers/page.tsx` — standalone
   e. `/app/blog/page.tsx` — listing page (needs post data array)
   f. Blog article pages (3 articles)

3. **Phase 3** (enhancements):
   a. Add new CSS classes to `globals.css`
   b. Update `/app/page.tsx` — add testimonials, stats, updated nav/footer
   c. Update `/app/vuriumbook/page.tsx` — add problem/solution, demo, testimonials, FAQ, comparison table, updated nav/footer
   d. Update navbars on all existing legal/support pages
   e. Update footers on all pages to comprehensive version

4. **Phase 4** (metadata):
   a. Create layout.tsx files for each new route

5. **Phase 5** (polish):
   a. Test all pages at mobile (375px) and desktop
   b. Verify fade-up animations work on all new sections
   c. Check that global starfield displays correctly on all new pages
   d. Verify all internal links work

---

## File Inventory (all files to create or modify)

### New Files (15 files):
1. `/app/about/page.tsx`
2. `/app/about/layout.tsx`
3. `/app/blog/page.tsx`
4. `/app/blog/layout.tsx`
5. `/app/blog/getting-started-with-vuriumbook/page.tsx`
6. `/app/blog/online-booking-for-barbershops/page.tsx`
7. `/app/blog/managing-salon-team-schedules/page.tsx`
8. `/app/contact/page.tsx`
9. `/app/contact/layout.tsx`
10. `/app/faq/page.tsx`
11. `/app/faq/layout.tsx`
12. `/app/careers/page.tsx`
13. `/app/careers/layout.tsx`

### Modified Files (10+ files):
14. `/app/globals.css` — add FAQ, form input, stat classes
15. `/app/page.tsx` — add testimonials, stats, update nav/footer
16. `/app/vuriumbook/page.tsx` — add problem/solution, demo, testimonials, integrations, FAQ, comparison table, update nav/footer
17. `/app/privacy/page.tsx` — update navbar links
18. `/app/terms/page.tsx` — update navbar links
19. `/app/support/page.tsx` — update navbar links
20. `/app/cookies/page.tsx` — update navbar links
21. `/app/accessibility/page.tsx` — update navbar links
22. `/app/dpa/page.tsx` — update navbar links
23. `/app/signin/page.tsx` — update navbar links (optional)
24. `/app/signup/page.tsx` — update navbar links (optional)

### No new dependencies needed
The entire build-out uses only existing Next.js + React. No MDX library, no form library, no animation library. Everything is inline styles + globals.css, matching the existing codebase pattern exactly.

---

## Risks & Mitigations

1. **Navbar repetition across 20+ pages**: Each page has its own inline navbar. Changing nav links requires editing every page. Mitigation: Do nav updates as a batch operation at the end. Consider extracting a shared `<PublicNav />` component in the future (not in this phase to maintain existing patterns).

2. **Footer repetition**: Same issue. The new comprehensive footer will be longer. Copy-paste across all pages. Future consideration: extract a `<PublicFooter />` component.

3. **Blog scalability**: Hardcoded blog post arrays in the listing page work for 3-10 posts. Beyond that, consider a content directory with filesystem-based listing. Not needed for initial launch.

4. **Contact form**: No backend endpoint. Initial version shows a success message client-side only. Wire to an API endpoint (Resend, or the existing backend) in a follow-up.

5. **Performance**: New pages are content-only with no heavy dependencies. The existing parallax/starfield is the heaviest part and is already optimized. New pages that use the global starfield (not their own `.space-bg`) are lightweight.
