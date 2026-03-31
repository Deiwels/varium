'use client'
import { useEffect, useRef } from 'react'

export default function Home() {
  const spaceRef = useRef<HTMLDivElement>(null)
  const orbRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Mouse parallax
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

    // Scroll zoom + parallax
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
        <div className="nebula-layer" style={{ width: 900, height: 500, top: '5%', left: '-18%', background: 'rgba(30,40,100,.07)', animationDelay: '.2s' }} />
        <div className="nebula-layer" style={{ width: 700, height: 400, top: '20%', right: '-12%', background: 'rgba(60,40,110,.05)', animationDelay: '.6s' }} />
        <div className="nebula-layer" style={{ width: 500, height: 300, bottom: '15%', left: '25%', background: 'rgba(25,50,90,.05)', animationDelay: '1s' }} />
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
          <li><a href="/vuriumbook">VuriumBook</a></li>
          <li><a href="#products">Products</a></li>
          <li><a href="#about">About</a></li>
        </ul>
      </nav>

      {/* ── Hero ── */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'clamp(100px, 15vh, 140px) 24px 80px' }}>
        <p className="label-glow fade-up">Software Company</p>
        <h1 className="shimmer-text fade-up fade-up-d1" style={{ fontSize: 'clamp(30px, 5vw, 56px)', fontWeight: 600, letterSpacing: '-.04em', lineHeight: 1.08, maxWidth: 820, marginTop: 16 }}>
          We build software<br />that works.
        </h1>
        <p className="fade-up fade-up-d2" style={{ fontSize: 'clamp(15px, 2vw, 18px)', fontWeight: 300, color: 'rgba(255,255,255,.4)', maxWidth: 520, marginTop: 24, lineHeight: 1.6 }}>
          Modern tools for modern businesses. Elegant, reliable, and built to scale.
        </p>
        <div className="fade-up fade-up-d3" style={{ marginTop: 40, display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          <a href="#products" className="btn-dark-glow">Explore Products</a>
          <a href="#contact" className="btn-secondary">Get in Touch</a>
        </div>
      </section>

      {/* ── Products ── */}
      <section id="products" style={{ padding: 'clamp(60px, 10vh, 100px) 24px', maxWidth: 1080, margin: '0 auto' }}>
        <p className="label-glow" style={{ textAlign: 'center', marginBottom: 12 }}>Products</p>
        <h2 className="shimmer-text" style={{ fontSize: 'clamp(28px, 4.5vw, 48px)', fontWeight: 600, letterSpacing: '-.03em', textAlign: 'center', marginBottom: 56 }}>
          What we&apos;re building
        </h2>

        <div className="glass-card" style={{ maxWidth: 800, margin: '0 auto', padding: 'clamp(28px, 4vw, 48px) clamp(24px, 4vw, 44px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: 'rgba(130,150,220,.7)', display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(130,150,220,.7)' }}>Available Now</span>
          </div>
          <h3 style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 600, letterSpacing: '-.02em', marginBottom: 14, color: '#f0f0f5' }}>
            VuriumBook
          </h3>
          <p style={{ fontSize: 'clamp(14px, 1.8vw, 16px)', fontWeight: 300, color: 'rgba(255,255,255,.4)', maxWidth: 520, lineHeight: 1.65, marginBottom: 28 }}>
            A complete appointment scheduling platform for barbershops, salons, and service businesses. Online booking, team management, payments, and client CRM.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 28 }}>
            {[
              { label: 'Online Booking', desc: 'Clients book 24/7' },
              { label: 'Team Calendar', desc: 'Manage all schedules' },
              { label: 'Payments', desc: 'Card, Apple Pay, cash' },
              { label: 'Client CRM', desc: 'Track everything' },
            ].map((f, i) => (
              <div key={i} style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,.05)', background: 'rgba(255,255,255,.015)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 4 }}>{f.label}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.25)', lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            ))}
          </div>
          <a href="/vuriumbook" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500, color: 'rgba(130,150,220,.8)', textDecoration: 'none', transition: 'color .2s' }}>
            Learn more <span style={{ fontSize: 16 }}>&rarr;</span>
          </a>
        </div>
      </section>

      {/* ── About / Features ── */}
      <section id="about" style={{ padding: 'clamp(60px, 10vh, 100px) 24px', maxWidth: 1080, margin: '0 auto' }}>
        <p className="label-glow" style={{ textAlign: 'center', marginBottom: 12 }}>Why Vurium</p>
        <h2 className="shimmer-text" style={{ fontSize: 'clamp(28px, 4.5vw, 48px)', fontWeight: 600, letterSpacing: '-.03em', textAlign: 'center', marginBottom: 56 }}>
          Built different.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {[
            { title: 'Reliability First', desc: 'Built to work — no crashes, no downtime. Your business depends on it.', color: 'rgba(130,220,170,.5)' },
            { title: 'Beautiful by Default', desc: 'Every interface is crafted with attention to detail. Modern and intuitive.', color: 'rgba(130,150,220,.5)' },
            { title: 'Built to Scale', desc: 'From a single chair to a franchise. Grows with your business.', color: 'rgba(220,170,100,.5)' },
          ].map((f, i) => (
            <div key={i} className="glass-card">
              <div style={{ width: 32, height: 2, borderRadius: 1, background: f.color, marginBottom: 20 }} />
              <h3 style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-.01em', marginBottom: 10, color: '#e8e8ed' }}>{f.title}</h3>
              <p style={{ fontSize: 14, fontWeight: 300, color: 'rgba(255,255,255,.35)', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Contact ── */}
      <section id="contact" style={{ padding: 'clamp(60px, 10vh, 100px) 24px clamp(80px, 12vh, 120px)', textAlign: 'center' }}>
        <p className="label-glow" style={{ marginBottom: 12 }}>Contact</p>
        <h2 className="shimmer-text" style={{ fontSize: 'clamp(28px, 4.5vw, 48px)', fontWeight: 600, letterSpacing: '-.03em', marginBottom: 20 }}>
          Let&apos;s talk.
        </h2>
        <p style={{ fontSize: 'clamp(14px, 1.8vw, 16px)', fontWeight: 300, color: 'rgba(255,255,255,.35)', maxWidth: 440, margin: '0 auto 36px', lineHeight: 1.6 }}>
          Interested in our products? We&apos;d love to hear from you.
        </p>
        <a href="mailto:hello@vurium.com" className="btn-primary">hello@vurium.com</a>
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
