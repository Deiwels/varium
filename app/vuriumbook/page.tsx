'use client'
import { useEffect, useRef } from 'react'

export default function VuriumBook() {
  const spaceRef = useRef<HTMLDivElement>(null)
  const orbRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouse(e: MouseEvent) {
      const cx = (e.clientX / window.innerWidth - 0.5) * 2
      const cy = (e.clientY / window.innerHeight - 0.5) * 2
      const far = document.querySelector('.stars-far') as HTMLElement
      const mid = document.querySelector('.stars-mid') as HTMLElement
      const near = document.querySelector('.stars-near') as HTMLElement
      if (far) far.style.transform = `translate(${cx * 4}px, ${cy * 4}px)`
      if (mid) mid.style.transform = `translate(${cx * 8}px, ${cy * 8}px)`
      if (near) near.style.transform = `translate(${cx * 14}px, ${cy * 14}px)`
      if (orbRef.current) orbRef.current.style.transform = `translate(${cx * -10}px, ${cy * -10}px)`
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
    }
  }, [])

  return (
    <>
      {/* ── Background ── */}
      <div className="space-bg" ref={spaceRef}>
        <div className="stars stars-far" />
        <div className="stars stars-mid" />
        <div className="stars stars-near" />
        <div className="orb-container" ref={orbRef}>
          <div className="orb-halo" />
          <div className="orb-ring-2" />
          <div className="orb-ring" />
          <div className="orb-ring-3" />
          <div className="orb-core" />
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
          <img src="/logo.jpg" alt="Vurium" />
          Vurium
        </a>
        <ul className="navbar-links">
          <li><a href="/vuriumbook" style={{ color: 'rgba(255,255,255,.85)' }}>VuriumBook</a></li>
          <li><a href="/#products">Products</a></li>
          <li><a href="/#contact">Contact</a></li>
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
          <a href="#demo" className="btn-primary">Request Demo</a>
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
            { title: 'Online Booking', desc: 'Your clients book appointments 24/7 from your website or a custom booking page.', color: 'rgba(130,150,220,.5)' },
            { title: 'Team Calendar', desc: 'Visual calendar for your entire team. Drag to create blocks, reschedule with a tap.', color: 'rgba(130,220,170,.5)' },
            { title: 'Smart Payments', desc: 'Accept card payments, Apple Pay, cash, and tips. Automatic receipts and reports.', color: 'rgba(220,170,100,.5)' },
            { title: 'Client CRM', desc: 'Track visit history, preferences, notes, and contact info for every client.', color: 'rgba(220,130,160,.5)' },
            { title: 'Waitlist & Queue', desc: 'Walk-in management with real-time queue. Clients get notified when ready.', color: 'rgba(130,200,220,.5)' },
            { title: 'Analytics & Payroll', desc: 'Revenue reports, performance tracking, tip management, and automated payroll.', color: 'rgba(180,140,220,.5)' },
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
            { name: 'Starter', price: '$29', period: '/mo', desc: 'For solo barbers and small shops', features: ['Up to 2 team members', 'Online booking page', 'Basic calendar', 'Client management'], featured: false },
            { name: 'Pro', price: '$79', period: '/mo', desc: 'For growing barbershops and salons', features: ['Unlimited team members', 'Custom booking page', 'Payments & tips', 'Analytics & payroll', 'Priority support'], featured: true },
            { name: 'Enterprise', price: 'Custom', period: '', desc: 'For multi-location businesses', features: ['Everything in Pro', 'Multiple locations', 'API access', 'Dedicated support', 'Custom integrations'], featured: false },
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
              <a href="#demo" className={p.featured ? 'btn-primary' : 'btn-secondary'} style={{ width: '100%', justifyContent: 'center', height: 42, fontSize: 13 }}>
                Get Started
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* ── Demo CTA ── */}
      <section id="demo" style={{ padding: 'clamp(60px, 10vh, 100px) 24px clamp(80px, 12vh, 120px)', textAlign: 'center' }}>
        <h2 className="shimmer-text" style={{ fontSize: 'clamp(28px, 4.5vw, 48px)', fontWeight: 600, letterSpacing: '-.03em', marginBottom: 20 }}>
          Ready to get started?
        </h2>
        <p style={{ fontSize: 'clamp(14px, 1.8vw, 16px)', fontWeight: 300, color: 'rgba(255,255,255,.35)', maxWidth: 440, margin: '0 auto 36px', lineHeight: 1.6 }}>
          Request a demo or sign up today. We&apos;ll have you running in minutes.
        </p>
        <a href="mailto:hello@vurium.com?subject=VuriumBook Demo" className="btn-primary">Request a Demo</a>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,.05)', padding: '20px clamp(20px, 4vw, 48px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2, flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>&copy; 2026 Vurium. All rights reserved.</span>
        <div style={{ display: 'flex', gap: 20 }}>
          <a href="#" style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>Privacy</a>
          <a href="#" style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>Terms</a>
        </div>
      </footer>
    </>
  )
}
