'use client'
import { useEffect, useRef, useState } from 'react'

export default function VuriumBook() {
  const spaceRef = useRef<HTMLDivElement>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window
    setIsMobile(mobile)

    let tx = 0, ty = 0, cx = 0, cy = 0
    let raf: number

    function tick() {
      cx += (tx - cx) * 0.02
      cy += (ty - cy) * 0.02
      const far  = document.querySelector('.stars-far')    as HTMLElement
      const mid  = document.querySelector('.stars-mid')    as HTMLElement
      const near = document.querySelector('.stars-near')   as HTMLElement
      const orb  = document.querySelector('.orb-parallax') as HTMLElement
      if (far)  far.style.transform  = `translate(${cx * 8}px, ${cy * 8}px)`
      if (mid)  mid.style.transform  = `translate(${cx * 20}px, ${cy * 20}px)`
      if (near) near.style.transform = `translate(${cx * 35}px, ${cy * 35}px)`
      if (orb)  orb.style.transform  = `translate(${cx * -8}px, ${cy * -8}px)`
      raf = requestAnimationFrame(tick)
    }

    if (mobile) {
      function onOrientation(e: DeviceOrientationEvent) {
        const gamma = Math.max(-15, Math.min(15, e.gamma || 0))
        const beta  = Math.max(-15, Math.min(15, (e.beta || 0) - 45))
        tx = gamma / 15 * 4; ty = beta / 15 * 4
      }
      const doe = DeviceOrientationEvent as any
      if (typeof doe.requestPermission === 'function') {
        const req = () => { doe.requestPermission().then((s: string) => { if (s === 'granted') window.addEventListener('deviceorientation', onOrientation, { passive: true }) }).catch(() => {}); document.removeEventListener('click', req) }
        document.addEventListener('click', req, { once: true })
      } else { window.addEventListener('deviceorientation', onOrientation, { passive: true }) }
      raf = requestAnimationFrame(tick)
      return () => { window.removeEventListener('deviceorientation', onOrientation); cancelAnimationFrame(raf) }
    }

    function onMouse(e: MouseEvent) {
      tx = (e.clientX / window.innerWidth - 0.5) * 2
      ty = (e.clientY / window.innerHeight - 0.5) * 2
    }
    function onScroll() {
      const y = window.scrollY
      const scale = 1 + y * 0.00008
      if (spaceRef.current) spaceRef.current.style.transform = `scale(${Math.min(scale, 1.05)})`
    }

    window.addEventListener('mousemove', onMouse, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    raf = requestAnimationFrame(tick)
    return () => { window.removeEventListener('mousemove', onMouse); window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
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
          <li><a href="/#products">Products</a></li>
          <li><a href="/#about">About</a></li>
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
        <p className="fade-up fade-up-d2" style={{ fontSize: 'clamp(15px, 2vw, 18px)', fontWeight: 300, color: 'rgba(255,255,255,.4)', maxWidth: 560, marginTop: 24, lineHeight: 1.6 }}>
          The all-in-one booking system for barbershops, salons, and service businesses. Manage appointments, team schedules, payments, and clients.
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
      <section style={{ padding: 'clamp(60px, 10vh, 100px) 24px', maxWidth: 960, margin: '0 auto' }}>
        <p className="label-glow" style={{ textAlign: 'center', marginBottom: 12 }}>Pricing</p>
        <h2 className="shimmer-text" style={{ fontSize: 'clamp(28px, 4.5vw, 48px)', fontWeight: 600, letterSpacing: '-.03em', textAlign: 'center', marginBottom: 56 }}>
          Simple, transparent pricing.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
          {[
            { name: 'Individual', price: '$29', period: '/mo', desc: 'For solo specialists and freelancers', features: ['1 user — your own calendar', 'Online booking page', 'Client management', 'Payments', 'Basic analytics'], featured: false, plan: 'individual' },
            { name: 'Salon', price: '$79', period: '/mo', desc: 'For teams, salons, and studios', features: ['Up to 10 team members', 'Team management & roles', 'Waitlist & Messages', 'Portfolio & Membership', 'Advanced analytics'], featured: true, plan: 'salon' },
            { name: 'Custom', price: '$99', period: '/mo', desc: 'Full customizable site', features: ['Custom booking site', '5 design templates', 'Unlimited team members', 'Expenses & Payroll', 'Dedicated support'], featured: false, plan: 'custom' },
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
            <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,.6)', marginBottom: 8 }}>30-Day Trial</div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', lineHeight: 1.6 }}>Every account starts with full Salon access for 30 days. No credit card required. Explore everything before you choose.</p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,.05)', padding: '20px clamp(20px, 4vw, 48px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2, flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>&copy; 2026 Vurium. All rights reserved.</span>
        <div style={{ display: 'flex', gap: 20 }}>
          <a href="/privacy" style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>Privacy</a>
          <a href="/terms" style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>Terms</a>
          <a href="/support" style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>Support</a>
        </div>
      </footer>
    </>
  )
}
