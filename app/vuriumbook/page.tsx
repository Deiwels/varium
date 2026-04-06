'use client'
import { useEffect, useRef, useState } from 'react'

function PricingFaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="faq-item">
      <button className="faq-question" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{q}</span>
        <svg className="faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div className={`faq-answer${open ? ' open' : ''}`}>
        <div className="faq-answer-inner">{a}</div>
      </div>
    </div>
  )
}

export default function VuriumBook() {
  const spaceRef = useRef<HTMLDivElement>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Hide global starfield — this page has its own .space-bg
    const cosmos = document.getElementById('vurium-cosmos')
    if (cosmos) cosmos.style.display = 'none'

    const mobile = window.matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window
    setIsMobile(mobile)

    let tx = 0, ty = 0, cx = 0, cy = 0
    let raf = 0
    let running = false
    let idleTimer: ReturnType<typeof setTimeout> | null = null

    const far  = document.querySelector('.stars-far')    as HTMLElement
    const mid  = document.querySelector('.stars-mid')    as HTMLElement
    const near = document.querySelector('.stars-near')   as HTMLElement
    const orb  = document.querySelector('.orb-parallax') as HTMLElement

    function tick() {
      if (!running) return
      cx += (tx - cx) * 0.02
      cy += (ty - cy) * 0.02
      if (Math.abs(tx - cx) < 0.001 && Math.abs(ty - cy) < 0.001) { running = false; return }
      if (far)  far.style.transform  = `translate(${cx * 8}px, ${cy * 8}px)`
      if (mid)  mid.style.transform  = `translate(${cx * 20}px, ${cy * 20}px)`
      if (near) near.style.transform = `translate(${cx * 35}px, ${cy * 35}px)`
      if (orb)  orb.style.transform  = `translate(${cx * -8}px, ${cy * -8}px)`
      raf = requestAnimationFrame(tick)
    }

    function startLoop() { if (!running) { running = true; raf = requestAnimationFrame(tick) } }
    function onVisibility() { if (document.hidden) { running = false; cancelAnimationFrame(raf) } }
    document.addEventListener('visibilitychange', onVisibility)

    if (mobile) {
      function onOrientation(e: DeviceOrientationEvent) {
        const gamma = Math.max(-15, Math.min(15, e.gamma || 0))
        const beta  = Math.max(-15, Math.min(15, (e.beta || 0) - 45))
        tx = gamma / 15 * 4; ty = beta / 15 * 4
        startLoop()
      }
      const doe = DeviceOrientationEvent as any
      if (typeof doe.requestPermission === 'function') {
        const req = () => { doe.requestPermission().then((s: string) => { if (s === 'granted') window.addEventListener('deviceorientation', onOrientation, { passive: true }) }).catch(() => {}); document.removeEventListener('click', req) }
        document.addEventListener('click', req, { once: true })
      } else { window.addEventListener('deviceorientation', onOrientation, { passive: true }) }
      return () => { window.removeEventListener('deviceorientation', onOrientation); document.removeEventListener('visibilitychange', onVisibility); cancelAnimationFrame(raf); if (cosmos) cosmos.style.display = '' }
    }

    function onMouse(e: MouseEvent) {
      tx = (e.clientX / window.innerWidth - 0.5) * 2
      ty = (e.clientY / window.innerHeight - 0.5) * 2
      startLoop()
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => { running = false }, 2000)
    }
    function onScroll() {
      const y = window.scrollY
      const scale = 1 + y * 0.00008
      if (spaceRef.current) spaceRef.current.style.transform = `scale(${Math.min(scale, 1.05)})`
    }

    window.addEventListener('mousemove', onMouse, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMouse)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibility)
      cancelAnimationFrame(raf)
      if (idleTimer) clearTimeout(idleTimer)
      if (cosmos) cosmos.style.display = ''
    }
  }, [])

  return (
    <>
      {/* ── Background ── */}
      <div className="space-bg" ref={spaceRef}>
        <div className="stars stars-far" />
        <div className="stars stars-mid" />
        <div className="stars stars-near" />
        <div className="orb-parallax">
          <div className="orb-container">
            <div className="orb-halo" />
            <div className="orb-ring-2" />
            <div className="orb-ring" />
            <div className="orb-ring-3" />
            <div className="orb-core" />
          </div>
        </div>
        <div className="shooting-star shooting-star-1" />
        <div className="shooting-star shooting-star-2" />
        <div className="nebula-layer" style={{ width: 800, height: 450, top: '6%', left: '-14%', background: 'rgba(30,45,110,.06)' }} />
        <div className="nebula-layer" style={{ width: 550, height: 300, top: '35%', right: '-10%', background: 'rgba(55,35,100,.04)', animationDelay: '.5s' }} />
      </div>
      <div className="horizon-grid" />
      <div className="noise-overlay" />

      {/* ── Navbar ── */}
      <nav className="navbar">
        <a href="/" className="navbar-logo">
          <img src="/logo.jpg" alt="VuriumBook" />
          VuriumBook
        </a>
        <ul className="navbar-links">
          <li><a href="/vuriumbook">VuriumBook</a></li>
          <li><a href="/about">About</a></li>
          <li><a href="/blog">Blog</a></li>
          <li><a href="/contact">Contact</a></li>
          <li><a href="/signin">Sign In</a></li>
        </ul>
      </nav>

      {/* ── Hero ── */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'clamp(100px, 15vh, 140px) 24px 80px' }}>
        <div className="fade-up" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: 'rgba(130,150,220,.7)', display: 'inline-block' }} />
          <span className="label-glow">Booking Platform</span>
        </div>
        <h1 className="shimmer-text fade-up fade-up-d1" style={{ fontSize: 'clamp(36px, 7vw, 68px)', fontWeight: 600, letterSpacing: '-.04em', lineHeight: 1.08, maxWidth: 780 }}>
          VuriumBook
        </h1>
        <p className="fade-up fade-up-d2" style={{ fontSize: 'clamp(15px, 2vw, 18px)', fontWeight: 300, color: 'rgba(255,255,255,.4)', maxWidth: 580, marginTop: 24, lineHeight: 1.6 }}>
          Managing appointments shouldn&apos;t mean missed calls, double bookings, and spreadsheet chaos. VuriumBook replaces it all with one beautiful platform — scheduling, payments, team management, and client CRM.
        </p>
        <div className="fade-up fade-up-d3" style={{ marginTop: 40, display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          <a href="/signup?plan=salon" className="btn-primary">Start 14-Day Free Trial</a>
          <a href="#features" className="btn-secondary">See Features</a>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ padding: 'clamp(60px, 10vh, 100px) 24px', maxWidth: 1080, margin: '0 auto' }}>
        <p className="label-glow" style={{ textAlign: 'center', marginBottom: 12 }}>Everything you need</p>
        <h2 className="shimmer-text" style={{ fontSize: 'clamp(28px, 4.5vw, 48px)', fontWeight: 600, letterSpacing: '-.03em', textAlign: 'center', marginBottom: 56 }}>
          One platform, zero headaches.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {[
            { title: 'Online Booking', desc: 'Clients book 24/7 from your personal booking page. Auto-confirmations via SMS.', color: 'rgba(255,255,255,.3)' },
            { title: 'Smart Calendar', desc: 'Visual schedule for you or your entire team. Drag to reschedule, tap to create.', color: 'rgba(255,255,255,.25)' },
            { title: 'Payments & Tips', desc: 'Accept cards, Apple Pay, cash. Track tips, generate receipts automatically.', color: 'rgba(255,255,255,.25)' },
            { title: 'Client Management', desc: 'Full CRM: visit history, preferences, notes, contact info, classifications.', color: 'rgba(255,255,255,.25)' },
            { title: 'Team & Roles', desc: 'Add team members with roles. Each gets their own calendar and client base. Salon plan.', color: 'rgba(255,255,255,.2)' },
            { title: 'Waitlist & Membership', desc: 'Queue management, recurring subscriptions, automated SMS reminders. Salon plan.', color: 'rgba(255,255,255,.2)' },
          ].map((f, i) => (
            <div key={i} className="glass-card">
              <div style={{ width: 32, height: 2, borderRadius: 1, background: f.color, marginBottom: 18 }} />
              <h3 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.01em', marginBottom: 10, color: '#e8e8ed' }}>{f.title}</h3>
              <p style={{ fontSize: 13, fontWeight: 300, color: 'rgba(255,255,255,.35)', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" style={{ padding: 'clamp(60px, 10vh, 100px) 24px', maxWidth: 960, margin: '0 auto' }}>
        <p className="label-glow" style={{ textAlign: 'center', marginBottom: 12 }}>Pricing</p>
        <h2 className="shimmer-text" style={{ fontSize: 'clamp(28px, 4.5vw, 48px)', fontWeight: 600, letterSpacing: '-.03em', textAlign: 'center', marginBottom: 56 }}>
          Simple, transparent pricing.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
          {[
            { name: 'Individual', price: '$29', period: '/mo', desc: 'For solo specialists and freelancers', features: ['1 user — your own calendar', 'Online booking page', 'Client management', 'Payments & tips', 'Basic analytics'], featured: false, plan: 'individual' },
            { name: 'Salon', price: '$79', period: '/mo', desc: 'For teams, salons, and studios', features: ['Everything in Individual', 'Up to 10 team members', 'Team management & roles', 'Waitlist & Messages', 'Portfolio', 'Cash register', 'Membership', 'Attendance tracking', 'Advanced analytics'], featured: true, plan: 'salon' },
            { name: 'Custom', price: '$99', period: '/mo', desc: 'For growing businesses', features: ['Everything in Salon', 'Unlimited team members', 'Expenses & Payroll', 'Multi-location support', 'API access', 'Dedicated support'], featured: false, plan: 'custom' },
          ].map((p, i) => (
            <div key={i} className="glass-card" style={{ borderColor: p.featured ? 'rgba(130,150,220,.2)' : undefined, background: p.featured ? 'rgba(130,150,220,.03)' : undefined }}>
              {p.featured && <div style={{ position: 'absolute', top: 14, right: 18, fontSize: 9, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(130,150,220,.7)', background: 'rgba(130,150,220,.1)', padding: '3px 10px', borderRadius: 999 }}>Popular</div>}
              <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,.4)', marginBottom: 8 }}>{p.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 6 }}>
                <span style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-.02em', color: '#e8e8ed' }}>{p.price}</span>
                {p.period && <span style={{ fontSize: 13, color: 'rgba(255,255,255,.25)' }}>{p.period}</span>}
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,.25)', marginBottom: 18 }}>{p.desc}</p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 22 }}>
                {p.features.map((f, j) => (
                  <li key={j} style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ color: 'rgba(130,220,170,.6)', fontSize: 13 }}>&#10003;</span> {f}
                  </li>
                ))}
              </ul>
              <a href={`/signup?plan=${p.plan}`} className={p.featured ? 'btn-primary' : 'btn-secondary'} style={{ width: '100%', justifyContent: 'center', height: 42, fontSize: 13 }}>
                Get Started
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom info ── */}
      <section style={{ padding: 'clamp(60px, 10vh, 100px) 24px clamp(80px, 12vh, 120px)', maxWidth: 700, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,.6)', marginBottom: 8 }}>Individual Plan</div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', lineHeight: 1.6 }}>For solo specialists. Your own calendar, booking page, client base, and payments. Everything you need to run independently.</p>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,.6)', marginBottom: 8 }}>Salon Plan</div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', lineHeight: 1.6 }}>For teams. Add up to 10 members, manage schedules, track performance, handle waitlists and memberships.</p>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,.6)', marginBottom: 8 }}>14-Day Free Trial</div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', lineHeight: 1.6 }}>Every account starts with full access to all features for 14 days. Card required at signup, cancel anytime before trial ends.</p>
          </div>
        </div>
      </section>

      {/* ── Integrations ── */}
      <section style={{ padding: 'clamp(40px, 8vh, 80px) 24px', maxWidth: 800, margin: '0 auto' }}>
        <p className="label-glow" style={{ textAlign: 'center', marginBottom: 12 }}>Integrations</p>
        <h2 className="shimmer-text" style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 600, letterSpacing: '-.03em', textAlign: 'center', marginBottom: 16 }}>
          Works with your stack.
        </h2>
        <p style={{ fontSize: 14, fontWeight: 300, color: 'rgba(255,255,255,.35)', textAlign: 'center', maxWidth: 480, margin: '0 auto 40px', lineHeight: 1.6 }}>
          VuriumBook connects with the tools you already use, so you can focus on what matters — your clients.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { name: 'Stripe', desc: 'Secure payments' },
            { name: 'Google Calendar', desc: 'Sync schedules' },
            { name: 'Square', desc: 'POS & terminals' },
            { name: 'Telnyx', desc: 'SMS reminders' },
          ].map((integ, i) => (
            <div key={i} className="glass-card" style={{ textAlign: 'center', padding: '20px 16px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 16, color: 'rgba(130,150,220,.5)' }}>{integ.name[0]}</span>
              </div>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: '#e8e8ed', marginBottom: 4 }}>{integ.name}</h3>
              <p style={{ fontSize: 11, fontWeight: 300, color: 'rgba(255,255,255,.25)' }}>{integ.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section style={{ padding: 'clamp(60px, 10vh, 100px) 24px', maxWidth: 800, margin: '0 auto' }}>
        <p className="label-glow" style={{ textAlign: 'center', marginBottom: 12 }}>What customers say</p>
        <h2 className="shimmer-text" style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 600, letterSpacing: '-.03em', textAlign: 'center', marginBottom: 48 }}>
          Real results, real businesses.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          {[
            { quote: 'We switched from a pen-and-paper system to VuriumBook. Within a week, our no-shows dropped and clients started booking online at 2am.', name: 'Alex Rivera', title: 'Owner, Precision Barbershop' },
            { quote: 'The team management features are exactly what we needed. I can see every barber\'s schedule, earnings, and client feedback in one dashboard.', name: 'Priya Sharma', title: 'Manager, The Style Collective' },
          ].map((t, i) => (
            <div key={i} className="glass-card">
              <div style={{ width: 32, height: 2, borderRadius: 1, background: 'rgba(130,150,220,.4)', marginBottom: 20 }} />
              <p style={{ fontSize: 14, fontWeight: 300, color: 'rgba(255,255,255,.45)', lineHeight: 1.65, marginBottom: 20 }}>
                &ldquo;{t.quote}&rdquo;
              </p>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#e8e8ed', marginBottom: 2 }}>{t.name}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,.25)' }}>{t.title}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing FAQ ── */}
      <section id="pricing-faq" style={{ padding: 'clamp(40px, 8vh, 80px) 24px', maxWidth: 700, margin: '0 auto' }}>
        <p className="label-glow" style={{ textAlign: 'center', marginBottom: 12 }}>FAQ</p>
        <h2 className="shimmer-text" style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 600, letterSpacing: '-.03em', textAlign: 'center', marginBottom: 40 }}>
          Common questions.
        </h2>
        {[
          { q: 'Is there a free trial?', a: 'Yes — every plan includes a 14-day free trial with all features. No credit card required to start.' },
          { q: 'Can I switch plans later?', a: 'Absolutely. Upgrade, downgrade, or cancel anytime from your billing settings. Changes are prorated.' },
          { q: 'What happens after the trial?', a: 'Your account converts to the plan you selected. All your data, clients, and settings are preserved.' },
          { q: 'Do you offer annual billing?', a: 'Yes. Annual plans save you ~20% compared to monthly billing. Contact us for details.' },
          { q: 'What payment methods do you accept?', a: 'Visa, Mastercard, American Express, and more — processed securely through Stripe.' },
        ].map((item, i) => (
          <PricingFaqItem key={i} q={item.q} a={item.a} />
        ))}
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <a href="/faq" style={{ fontSize: 14, color: 'rgba(130,150,220,.7)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            View all FAQs <span>&rarr;</span>
          </a>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: 'clamp(60px, 10vh, 100px) 24px clamp(80px, 12vh, 120px)', textAlign: 'center' }}>
        <h2 className="shimmer-text" style={{ fontSize: 'clamp(28px, 4.5vw, 42px)', fontWeight: 600, letterSpacing: '-.03em', marginBottom: 16 }}>
          Ready to grow your business?
        </h2>
        <p style={{ fontSize: 'clamp(14px, 1.8vw, 16px)', fontWeight: 300, color: 'rgba(255,255,255,.35)', maxWidth: 440, margin: '0 auto 36px', lineHeight: 1.6 }}>
          Join 1,000+ businesses already using VuriumBook to manage their day.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/signup?plan=salon" className="btn-primary">Start Free Trial</a>
          <a href="/contact" className="btn-secondary">Contact Sales</a>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,.05)', position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 24px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 32, marginBottom: 32 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.25)', marginBottom: 12 }}>Company</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <a href="/about" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>About</a>
                <a href="/careers" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>Careers</a>
                <a href="/contact" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>Contact</a>
              </div>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.25)', marginBottom: 12 }}>Product</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <a href="/vuriumbook" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>VuriumBook</a>
                <a href="/vuriumbook#pricing" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>Pricing</a>
                <a href="/faq" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>FAQ</a>
              </div>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.25)', marginBottom: 12 }}>Resources</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <a href="/blog" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>Blog</a>
                <a href="/support" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>Support</a>
              </div>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.25)', marginBottom: 12 }}>Legal</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <a href="/privacy" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>Privacy</a>
                <a href="/terms" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>Terms</a>
                <a href="/cookies" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>Cookies</a>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,.04)', paddingTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>&copy; 2026 Vurium&trade;. All rights reserved.</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.15)' }}>support@vurium.com</span>
          </div>
        </div>
      </footer>
    </>
  )
}
