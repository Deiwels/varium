'use client'
import { useEffect } from 'react'

export default function Home() {
  // Multi-layer parallax + zoom on scroll
  useEffect(() => {
    function onScroll() {
      const y = window.scrollY
      const layers = document.querySelectorAll('.stars-layer') as NodeListOf<HTMLElement>
      // Each layer moves at different speed — depth illusion
      if (layers[0]) layers[0].style.transform = `translateY(${y * 0.1}px)` // far stars — slow
      if (layers[1]) layers[1].style.transform = `translateY(${y * 0.25}px)` // mid stars
      if (layers[2]) layers[2].style.transform = `translateY(${y * 0.45}px)` // close stars — fast
      // Slight zoom — flying forward feel
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
        <div className="comet comet-1" />
        <div className="comet comet-2" />
        <div className="comet comet-3" />
        <div className="glow-orb" style={{ width: 600, height: 600, top: '10%', left: '-10%', background: 'radial-gradient(circle, rgba(100,80,255,.25), transparent 70%)' }} />
        <div className="glow-orb" style={{ width: 500, height: 500, top: '60%', right: '-5%', background: 'radial-gradient(circle, rgba(60,120,255,.15), transparent 70%)' }} />
      </div>

      {/* ── Nebula clouds — change color as you scroll deeper ── */}
      <div className="nebula" style={{ width: 800, height: 400, top: '120vh', left: '-10%', background: 'rgba(100,60,200,.4)' }} />
      <div className="nebula" style={{ width: 600, height: 300, top: '250vh', right: '-5%', background: 'rgba(60,150,200,.3)' }} />
      <div className="nebula" style={{ width: 700, height: 350, top: '380vh', left: '20%', background: 'rgba(200,80,120,.25)' }} />

      {/* ── Navbar ── */}
      <nav className="navbar">
        <a href="/" className="navbar-logo" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.jpg" alt="Vurium" style={{ height: 36, width: 36, borderRadius: 8, objectFit: 'cover' }} />
          Vurium
        </a>
        <ul className="navbar-links">
          <li><a href="/vuriumbook">VuriumBook</a></li>
          <li><a href="#products">Products</a></li>
          <li><a href="#features">Features</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
      </nav>

      {/* ── Hero ── */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '120px 24px 80px' }}>
        <p style={{ fontSize: 14, fontWeight: 500, letterSpacing: '.15em', textTransform: 'uppercase', color: 'rgba(140,160,255,.7)', marginBottom: 20 }}>
          Software Company
        </p>
        <h1 style={{ fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 500, letterSpacing: '-.03em', lineHeight: 1.1, maxWidth: 800, background: 'linear-gradient(180deg, #fff 30%, rgba(255,255,255,.5))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          We build software<br />that works.
        </h1>
        <p style={{ fontSize: 'clamp(16px, 2.5vw, 21px)', fontWeight: 300, color: 'rgba(255,255,255,.55)', maxWidth: 580, marginTop: 24, lineHeight: 1.5 }}>
          Modern tools for modern businesses. Elegant, reliable, and built to scale.
        </p>
        <div style={{ marginTop: 40, display: 'flex', gap: 16 }}>
          <a href="#products" style={{ height: 48, padding: '0 32px', borderRadius: 999, background: '#fff', color: '#000', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', textDecoration: 'none', transition: 'opacity .2s' }}>
            Explore Products
          </a>
          <a href="#contact" style={{ height: 48, padding: '0 32px', borderRadius: 999, border: '1px solid rgba(255,255,255,.2)', background: 'transparent', color: '#fff', fontSize: 15, fontWeight: 500, display: 'flex', alignItems: 'center', textDecoration: 'none', transition: 'all .2s' }}>
            Get in Touch
          </a>
        </div>
      </section>

      {/* ── Products ── */}
      <section id="products" style={{ padding: '100px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <p style={{ fontSize: 13, fontWeight: 500, letterSpacing: '.15em', textTransform: 'uppercase', color: 'rgba(140,160,255,.6)', textAlign: 'center', marginBottom: 12 }}>
          Products
        </p>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 500, letterSpacing: '-.02em', textAlign: 'center', marginBottom: 60, background: 'linear-gradient(180deg, #fff 30%, rgba(255,255,255,.5))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          What we&apos;re building
        </h2>

        {/* Booking System Card */}
        <div style={{ borderRadius: 24, border: '1px solid rgba(255,255,255,.08)', background: 'linear-gradient(180deg, rgba(255,255,255,.04) 0%, rgba(255,255,255,.01) 100%)', overflow: 'hidden', padding: '48px 40px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(100,120,255,.15), transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: '#8b9aff', display: 'inline-block' }} />
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#8b9aff' }}>Coming Soon</span>
          </div>
          <h3 style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 500, letterSpacing: '-.02em', marginBottom: 16 }}>
            Booking System
          </h3>
          <p style={{ fontSize: 17, fontWeight: 300, color: 'rgba(255,255,255,.55)', maxWidth: 560, lineHeight: 1.6, marginBottom: 32 }}>
            A complete appointment scheduling platform for barbershops, salons, and service businesses. Online booking, team management, payments, and client CRM — all in one place.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
            {[
              { icon: '{}', label: 'Online Booking', desc: 'Clients book 24/7 from your website' },
              { icon: '{}', label: 'Team Calendar', desc: 'Manage schedules for your entire team' },
              { icon: '$', label: 'Payments', desc: 'Accept card, Apple Pay, and cash' },
              { icon: '{}', label: 'Client CRM', desc: 'Track visits, preferences, and notes' },
            ].map((f, i) => (
              <div key={i} style={{ padding: '16px 18px', borderRadius: 14, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.02)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 6 }}>{f.label}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            ))}
          </div>
          <a href="#contact" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 500, color: '#8b9aff', textDecoration: 'none' }}>
            Request Early Access
            <span style={{ fontSize: 18 }}>&rarr;</span>
          </a>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ padding: '100px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <p style={{ fontSize: 13, fontWeight: 500, letterSpacing: '.15em', textTransform: 'uppercase', color: 'rgba(140,160,255,.6)', textAlign: 'center', marginBottom: 12 }}>
          Why Vurium
        </p>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 500, letterSpacing: '-.02em', textAlign: 'center', marginBottom: 60, background: 'linear-gradient(180deg, #fff 30%, rgba(255,255,255,.5))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Built different.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {[
            { title: 'Reliability First', desc: 'Our software is built to work — no crashes, no downtime. Your business depends on it, and we take that seriously.', accent: '#8ff0b1' },
            { title: 'Beautiful by Default', desc: 'Every interface is crafted with attention to detail. Dark, modern, and intuitive — your team will love using it.', accent: '#8b9aff' },
            { title: 'Built to Scale', desc: 'From a single chair to a franchise. Our architecture grows with your business without compromises.', accent: '#ffb86b' },
          ].map((f, i) => (
            <div key={i} style={{ padding: '32px 28px', borderRadius: 20, border: '1px solid rgba(255,255,255,.06)', background: 'linear-gradient(180deg, rgba(255,255,255,.03), transparent)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ width: 40, height: 3, borderRadius: 2, background: f.accent, marginBottom: 20, opacity: .7 }} />
              <h3 style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-.01em', marginBottom: 12 }}>{f.title}</h3>
              <p style={{ fontSize: 15, fontWeight: 300, color: 'rgba(255,255,255,.45)', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" style={{ padding: '100px 24px 120px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, fontWeight: 500, letterSpacing: '.15em', textTransform: 'uppercase', color: 'rgba(140,160,255,.6)', marginBottom: 12 }}>
          Contact
        </p>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 500, letterSpacing: '-.02em', marginBottom: 20, background: 'linear-gradient(180deg, #fff 30%, rgba(255,255,255,.5))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Let&apos;s talk.
        </h2>
        <p style={{ fontSize: 17, fontWeight: 300, color: 'rgba(255,255,255,.45)', maxWidth: 480, margin: '0 auto 40px', lineHeight: 1.5 }}>
          Interested in our products or want to work together? We&apos;d love to hear from you.
        </p>
        <a href="mailto:hello@vurium.com" style={{ display: 'inline-flex', alignItems: 'center', height: 52, padding: '0 36px', borderRadius: 999, background: '#fff', color: '#000', fontSize: 16, fontWeight: 600, textDecoration: 'none' }}>
          hello@vurium.com
        </a>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,.06)', padding: '24px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>&copy; 2026 Vurium. All rights reserved.</span>
        <div style={{ display: 'flex', gap: 24 }}>
          <a href="#" style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', textDecoration: 'none' }}>Privacy</a>
          <a href="#" style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', textDecoration: 'none' }}>Terms</a>
        </div>
      </footer>
    </>
  )
}
