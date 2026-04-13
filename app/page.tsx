'use client'
import { useEffect, useRef, useState } from 'react'

// Breathing glow stars — fewer, subtler
// Reduced from 12 to 6 — layout.tsx already has 12 global breathing stars
const GLOW_STARS = [
  { x: '8%',  y: '9%',   s: 2.5, dur: 4.2, del: 0    },
  { x: '62%', y: '7%',   s: 2,   dur: 3.8, del: 0.6  },
  { x: '18%', y: '40%',  s: 2.5, dur: 4.8, del: 0.3  },
  { x: '78%', y: '45%',  s: 2,   dur: 5.2, del: 0.9  },
  { x: '38%', y: '70%',  s: 2,   dur: 3.6, del: 0.4  },
  { x: '90%', y: '75%',  s: 2,   dur: 5.0, del: 1.7  },
]

export default function Home() {
  const spaceRef = useRef<HTMLDivElement>(null)
  // On mobile, skip rendering page-level stars entirely — layout.tsx has global starfield
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Hide global starfield — this page has its own .space-bg starfield
    const cosmos = document.getElementById('vurium-cosmos')
    if (cosmos) cosmos.style.display = 'none'

    const mobile = window.matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window
    setIsMobile(mobile)

    let tx = 0, ty = 0, cx = 0, cy = 0
    let raf = 0
    let running = false
    let idleTimer: ReturnType<typeof setTimeout> | null = null

    // Cache DOM refs once instead of querying every frame
    const far  = document.querySelector('.stars-far')   as HTMLElement
    const mid  = document.querySelector('.stars-mid')   as HTMLElement
    const near = document.querySelector('.stars-near')  as HTMLElement
    const orb  = document.querySelector('.orb-parallax') as HTMLElement
    const neb1 = document.querySelector('.neb-1')        as HTMLElement
    const neb2 = document.querySelector('.neb-2')        as HTMLElement

    function tick() {
      if (!running) return
      cx += (tx - cx) * 0.02
      cy += (ty - cy) * 0.02

      if (Math.abs(tx - cx) < 0.001 && Math.abs(ty - cy) < 0.001) { running = false; return }

      if (far)  far.style.transform  = `translate(${cx * 3}px, ${cy * 3}px)`
      if (mid)  mid.style.transform  = `translate(${cx * 7}px, ${cy * 7}px)`
      if (near) near.style.transform = `translate(${cx * 12}px, ${cy * 12}px)`
      if (orb)  orb.style.transform  = `translate(${cx * -8}px, ${cy * -8}px)`
      if (neb1) neb1.style.transform = `translate(${cx * 2}px, ${cy * 2}px)`
      if (neb2) neb2.style.transform = `translate(${cx * -3}px, ${cy * -3}px)`

      raf = requestAnimationFrame(tick)
    }

    function startLoop() {
      if (!running) { running = true; raf = requestAnimationFrame(tick) }
    }

    function onVisibility() {
      if (document.hidden) { running = false; cancelAnimationFrame(raf) }
    }
    document.addEventListener('visibilitychange', onVisibility)

    if (mobile) {
      function onOrientation(e: DeviceOrientationEvent) {
        const gamma = Math.max(-15, Math.min(15, e.gamma || 0))
        const beta  = Math.max(-15, Math.min(15, (e.beta || 0) - 45))
        tx = gamma / 15 * 4
        ty = beta  / 15 * 4
        startLoop()
      }
      const doe = DeviceOrientationEvent as any
      if (typeof doe.requestPermission === 'function') {
        function reqGyro() {
          doe.requestPermission().then((s: string) => {
            if (s === 'granted') window.addEventListener('deviceorientation', onOrientation, { passive: true })
          }).catch(() => {})
          document.removeEventListener('click', reqGyro)
        }
        document.addEventListener('click', reqGyro, { once: true })
      } else {
        window.addEventListener('deviceorientation', onOrientation, { passive: true })
      }
      return () => { window.removeEventListener('deviceorientation', onOrientation); document.removeEventListener('visibilitychange', onVisibility); cancelAnimationFrame(raf) }
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
      // Restore global starfield when leaving landing page
      if (cosmos) cosmos.style.display = ''
    }
  }, [])

  return (
    <>
      {/* ── Background ── */}
      <div className="space-bg" ref={spaceRef}>
        <div className="stars-wrap stars-wrap-far"><div className="stars stars-far" /></div>
        <div className="stars-wrap stars-wrap-mid"><div className="stars stars-mid" /></div>
        <div className="stars-wrap stars-wrap-near"><div className="stars stars-near" /></div>

        {GLOW_STARS.map((star, i) => (
          <div
            key={i}
            className="star-glow"
            style={{
              left: star.x,
              top: star.y,
              width: star.s,
              height: star.s,
              '--dur': `${star.dur}s`,
              '--delay': `${star.del}s`,
            } as React.CSSProperties}
          />
        ))}

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
        <div className="nebula-layer neb-1" style={{ width: 900, height: 500, top: '5%', left: '-18%', background: 'radial-gradient(ellipse at center, rgba(15,20,50,.12) 0%, transparent 70%)', animationDelay: '.2s' }} />
        <div className="nebula-layer neb-2" style={{ width: 700, height: 400, top: '20%', right: '-12%', background: 'radial-gradient(ellipse at center, rgba(30,20,55,.08) 0%, transparent 70%)', animationDelay: '.6s' }} />
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
          <li><a href="/about">About</a></li>
          <li><a href="/blog">Blog</a></li>
        </ul>
      </nav>

      {/* ── Hero ── */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'clamp(100px, 15vh, 160px) 24px 60px' }}>
        <p className="label-glow fade-up" style={{ marginBottom: 16 }}>Vurium</p>
        <h1 className="shimmer-text fade-up fade-up-d1" style={{ fontSize: 'clamp(36px, 6vw, 72px)', fontWeight: 600, letterSpacing: '-.05em', lineHeight: 1.04, maxWidth: 900, marginTop: 0 }}>
          Software that just works.
        </h1>
        <p className="fade-up fade-up-d2" style={{ fontSize: 'clamp(16px, 2.2vw, 20px)', fontWeight: 300, color: 'rgba(255,255,255,.35)', maxWidth: 520, marginTop: 28, lineHeight: 1.6 }}>
          We build tools for businesses that value simplicity, reliability, and beautiful design.
        </p>
      </section>

      {/* ── Product Intro: VuriumBook ── */}
      <section id="products" style={{ padding: 'clamp(80px, 12vh, 140px) 24px', textAlign: 'center' }}>
        <p className="label-glow fade-up" style={{ marginBottom: 12 }}>Introducing</p>
        <h2 className="shimmer-text fade-up fade-up-d1" style={{ fontSize: 'clamp(32px, 5.5vw, 64px)', fontWeight: 600, letterSpacing: '-.04em', lineHeight: 1.06, marginBottom: 20 }}>
          VuriumBook
        </h2>
        <p className="fade-up fade-up-d2" style={{ fontSize: 'clamp(15px, 2vw, 18px)', fontWeight: 300, color: 'rgba(255,255,255,.35)', maxWidth: 540, margin: '0 auto 16px', lineHeight: 1.65 }}>
          The all-in-one platform for barbershops, salons, and service businesses. Scheduling, payments, team management, and client CRM — in one place.
        </p>
        <div className="fade-up fade-up-d3" style={{ marginBottom: 0 }}>
          <a href="/vuriumbook" style={{ fontSize: 14, fontWeight: 500, color: 'rgba(130,150,220,.8)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Learn more <span>&rarr;</span>
          </a>
        </div>
      </section>

      {/* ── Feature: Dashboard ── */}
      <section style={{ padding: 'clamp(40px, 8vh, 80px) 24px clamp(80px, 12vh, 140px)', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <img src="/screenshots/dashboard.jpg" alt="VuriumBook Dashboard — Your business. Your control." style={{ width: '100%', height: 'auto', display: 'block' }} />
      </section>

      {/* ── Feature: Calendar ── */}
      <section style={{ padding: 'clamp(40px, 8vh, 80px) 24px clamp(80px, 12vh, 140px)', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <img src="/screenshots/calendar.jpg" alt="VuriumBook Calendar — Control your schedule." style={{ width: '100%', height: 'auto', display: 'block' }} />
      </section>

      {/* ── Feature: Analytics ── */}
      <section style={{ padding: 'clamp(40px, 8vh, 80px) 24px clamp(80px, 12vh, 140px)', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <img src="/screenshots/analytics.jpg" alt="VuriumBook Analytics — Simple, clear insights to grow your business." style={{ width: '100%', height: 'auto', display: 'block' }} />
      </section>

      {/* ── Capabilities Strip ── */}
      <section style={{ padding: 'clamp(60px, 10vh, 100px) 24px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1, borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(255,255,255,.05)' }}>
          {[
            { label: 'Client CRM', desc: 'Visit history, preferences, notes, and contact info for every client.' },
            { label: 'Team Management', desc: 'Roles, schedules, attendance, and performance — all in one place.' },
            { label: 'Waitlist & Membership', desc: 'Queue management, recurring subscriptions, and automated reminders.' },
            { label: 'Analytics', desc: 'Revenue, bookings, sources, and trends — know your numbers.' },
            { label: 'Cash Register', desc: 'Track daily cash, expenses, and generate end-of-day reports.' },
            { label: 'Portfolio', desc: 'Showcase your team\'s work to attract new clients.' },
          ].map((f, i) => (
            <div key={i} style={{ padding: 'clamp(20px, 3vw, 28px)', background: 'rgba(255,255,255,.015)', borderRight: '1px solid rgba(255,255,255,.04)', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.6)', marginBottom: 6, letterSpacing: '-.01em' }}>{f.label}</div>
              <p style={{ fontSize: 12, fontWeight: 300, color: 'rgba(255,255,255,.25)', lineHeight: 1.55, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: 'clamp(80px, 14vh, 160px) 24px', textAlign: 'center' }}>
        <h2 className="shimmer-text" style={{ fontSize: 'clamp(28px, 5vw, 52px)', fontWeight: 600, letterSpacing: '-.04em', lineHeight: 1.08, marginBottom: 24 }}>
          Try VuriumBook free<br />for 14 days.
        </h2>
        <p style={{ fontSize: 'clamp(15px, 2vw, 18px)', fontWeight: 300, color: 'rgba(255,255,255,.3)', maxWidth: 440, margin: '0 auto 40px', lineHeight: 1.6 }}>
          Start with a 14-day trial and get your booking page, services, and schedule set up at your own pace.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/signup?plan=salon" className="btn-primary">Start Free Trial</a>
          <a href="/vuriumbook" className="btn-secondary">Learn More</a>
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
