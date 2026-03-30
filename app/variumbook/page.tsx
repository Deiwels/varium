'use client'
import { useEffect } from 'react'

export default function VariumBook() {
  useEffect(() => {
    function onScroll() {
      const y = window.scrollY
      const layers = document.querySelectorAll('.stars-layer') as NodeListOf<HTMLElement>
      if (layers[0]) layers[0].style.transform = `translateY(${y * 0.1}px)`
      if (layers[1]) layers[1].style.transform = `translateY(${y * 0.25}px)`
      if (layers[2]) layers[2].style.transform = `translateY(${y * 0.45}px)`
      const container = document.querySelector('.stars-container') as HTMLElement
      if (container) {
        const scale = 1 + y * 0.0001
        container.style.transform = `scale(${Math.min(scale, 1.15)})`
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      {/* ── Stars ── */}
      <div className="stars-container">
        <div className="stars-layer layer-1" />
        <div className="stars-layer layer-2" />
        <div className="stars-layer layer-3" />
        <div className="black-hole" />
        <div className="galaxy" />
        <div className="shooting-star shooting-star-1" />
        <div className="shooting-star shooting-star-2" />
        <div className="shooting-star shooting-star-3" />
      </div>

      <div className="nebula" style={{ width: 700, height: 350, top: '130vh', left: '-5%', background: 'rgba(60,100,220,.35)' }} />
      <div className="nebula" style={{ width: 500, height: 250, top: '280vh', right: '-8%', background: 'rgba(150,60,180,.25)' }} />

      {/* ── Navbar ── */}
      <nav className="navbar">
        <a href="/" className="navbar-logo" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.jpg" alt="Varium" style={{ height: 36, width: 36, borderRadius: 8, objectFit: 'cover' }} />
          Varium
        </a>
        <ul className="navbar-links">
          <li><a href="/variumbook" style={{ color: '#fff' }}>VariumBook</a></li>
          <li><a href="/#products">Products</a></li>
          <li><a href="/#features">Features</a></li>
          <li><a href="/#contact">Contact</a></li>
        </ul>
      </nav>

      {/* ── Hero ── */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '120px 24px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: '#8b9aff', display: 'inline-block' }} />
          <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '.12em', textTransform: 'uppercase', color: '#8b9aff' }}>Booking Platform</span>
        </div>
        <h1 style={{ fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 500, letterSpacing: '-.03em', lineHeight: 1.1, maxWidth: 800, background: 'linear-gradient(180deg, #fff 30%, rgba(255,255,255,.5))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          VariumBook
        </h1>
        <p style={{ fontSize: 'clamp(16px, 2.5vw, 20px)', fontWeight: 300, color: 'rgba(255,255,255,.55)', maxWidth: 600, marginTop: 20, lineHeight: 1.5 }}>
          The all-in-one booking system for barbershops, salons, and service businesses. Manage appointments, team schedules, payments, and clients — beautifully.
        </p>
        <div style={{ marginTop: 40, display: 'flex', gap: 16 }}>
          <a href="#demo" style={{ height: 48, padding: '0 32px', borderRadius: 999, background: '#fff', color: '#000', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            Request Demo
          </a>
          <a href="#features" style={{ height: 48, padding: '0 32px', borderRadius: 999, border: '1px solid rgba(255,255,255,.2)', background: 'transparent', color: '#fff', fontSize: 15, fontWeight: 500, display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            See Features
          </a>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section id="features" style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <p style={{ fontSize: 13, fontWeight: 500, letterSpacing: '.15em', textTransform: 'uppercase', color: 'rgba(140,160,255,.6)', textAlign: 'center', marginBottom: 12 }}>
          Everything you need
        </p>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 500, letterSpacing: '-.02em', textAlign: 'center', marginBottom: 60, background: 'linear-gradient(180deg, #fff 30%, rgba(255,255,255,.5))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          One platform, zero headaches.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {[
            { title: 'Online Booking', desc: 'Your clients book appointments 24/7 from your website or a custom booking page. No phone calls needed.', accent: '#8b9aff' },
            { title: 'Team Calendar', desc: 'Visual calendar for your entire team. Drag to create blocks, reschedule with a tap, and see everyone at a glance.', accent: '#8ff0b1' },
            { title: 'Smart Payments', desc: 'Accept card payments, Apple Pay, cash, and tips. Automatic receipts and end-of-day reports.', accent: '#ffb86b' },
            { title: 'Client CRM', desc: 'Track visit history, preferences, notes, and contact info. Know your clients before they sit down.', accent: '#ff8ba7' },
            { title: 'Waitlist & Queue', desc: 'Walk-in management with real-time queue. Clients can join remotely and get notified when it\'s their turn.', accent: '#8bdaff' },
            { title: 'Analytics & Payroll', desc: 'Revenue reports, barber performance, tip tracking, and automated payroll calculations.', accent: '#d4a5ff' },
          ].map((f, i) => (
            <div key={i} style={{ padding: '28px 24px', borderRadius: 20, border: '1px solid rgba(255,255,255,.06)', background: 'linear-gradient(180deg, rgba(255,255,255,.03), transparent)', overflow: 'hidden' }}>
              <div style={{ width: 36, height: 3, borderRadius: 2, background: f.accent, marginBottom: 18, opacity: .7 }} />
              <h3 style={{ fontSize: 17, fontWeight: 500, letterSpacing: '-.01em', marginBottom: 10 }}>{f.title}</h3>
              <p style={{ fontSize: 14, fontWeight: 300, color: 'rgba(255,255,255,.4)', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section style={{ padding: '80px 24px', maxWidth: 900, margin: '0 auto' }}>
        <p style={{ fontSize: 13, fontWeight: 500, letterSpacing: '.15em', textTransform: 'uppercase', color: 'rgba(140,160,255,.6)', textAlign: 'center', marginBottom: 12 }}>
          Pricing
        </p>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 500, letterSpacing: '-.02em', textAlign: 'center', marginBottom: 60, background: 'linear-gradient(180deg, #fff 30%, rgba(255,255,255,.5))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Simple, transparent pricing.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {[
            { name: 'Starter', price: '$29', period: '/mo', desc: 'For solo barbers and small shops', features: ['Up to 2 team members', 'Online booking page', 'Basic calendar', 'Client management'] },
            { name: 'Pro', price: '$79', period: '/mo', desc: 'For growing barbershops and salons', features: ['Unlimited team members', 'Custom booking page', 'Payments & tips', 'Analytics & payroll', 'Priority support'], featured: true },
            { name: 'Enterprise', price: 'Custom', period: '', desc: 'For multi-location businesses', features: ['Everything in Pro', 'Multiple locations', 'API access', 'Dedicated support', 'Custom integrations'] },
          ].map((p, i) => (
            <div key={i} style={{ padding: '32px 28px', borderRadius: 20, border: `1px solid ${(p as any).featured ? 'rgba(139,154,255,.3)' : 'rgba(255,255,255,.06)'}`, background: (p as any).featured ? 'linear-gradient(180deg, rgba(139,154,255,.08), rgba(139,154,255,.02))' : 'linear-gradient(180deg, rgba(255,255,255,.03), transparent)', position: 'relative' }}>
              {(p as any).featured && <div style={{ position: 'absolute', top: 16, right: 20, fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#8b9aff', background: 'rgba(139,154,255,.12)', padding: '4px 10px', borderRadius: 999 }}>Popular</div>}
              <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,.5)', marginBottom: 8 }}>{p.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                <span style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-.02em' }}>{p.price}</span>
                {p.period && <span style={{ fontSize: 14, color: 'rgba(255,255,255,.35)' }}>{p.period}</span>}
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', marginBottom: 20 }}>{p.desc}</p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                {p.features.map((f, j) => (
                  <li key={j} style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#8ff0b1', fontSize: 14 }}>&#10003;</span> {f}
                  </li>
                ))}
              </ul>
              <a href="#demo" style={{ display: 'block', textAlign: 'center', height: 40, lineHeight: '40px', borderRadius: 999, background: (p as any).featured ? '#fff' : 'rgba(255,255,255,.06)', color: (p as any).featured ? '#000' : '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', border: (p as any).featured ? 'none' : '1px solid rgba(255,255,255,.1)' }}>
                Get Started
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* ── Demo / Contact ── */}
      <section id="demo" style={{ padding: '80px 24px 120px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 500, letterSpacing: '-.02em', marginBottom: 20, background: 'linear-gradient(180deg, #fff 30%, rgba(255,255,255,.5))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Ready to get started?
        </h2>
        <p style={{ fontSize: 16, fontWeight: 300, color: 'rgba(255,255,255,.45)', maxWidth: 480, margin: '0 auto 40px', lineHeight: 1.5 }}>
          Request a demo or sign up today. We&apos;ll have you up and running in minutes.
        </p>
        <a href="mailto:hello@varium.com?subject=VariumBook Demo Request" style={{ display: 'inline-flex', alignItems: 'center', height: 52, padding: '0 36px', borderRadius: 999, background: '#fff', color: '#000', fontSize: 16, fontWeight: 600, textDecoration: 'none' }}>
          Request a Demo
        </a>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,.06)', padding: '24px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>&copy; 2026 Varium. All rights reserved.</span>
        <div style={{ display: 'flex', gap: 24 }}>
          <a href="#" style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', textDecoration: 'none' }}>Privacy</a>
          <a href="#" style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', textDecoration: 'none' }}>Terms</a>
        </div>
      </footer>
    </>
  )
}
