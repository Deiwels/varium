'use client'

const PERKS = [
  { title: 'Remote First', desc: 'Work from anywhere in the world. We\'re a distributed team that values output over hours in a seat.', color: 'rgba(130,220,170,.5)', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4' },
  { title: 'Competitive Pay', desc: 'We offer salaries that compete with top tech companies, plus equity for early team members.', color: 'rgba(130,150,220,.5)', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { title: 'Growth & Learning', desc: 'Annual learning budget, conference attendance, and mentorship programs to accelerate your career.', color: 'rgba(220,170,100,.5)', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { title: 'Great Benefits', desc: 'Health insurance, flexible PTO, home office stipend, and the latest hardware to do your best work.', color: 'rgba(200,130,220,.5)', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
]

const POSITIONS = [
  { title: 'Senior Full-Stack Engineer', dept: 'Engineering', location: 'Remote', type: 'Full-time', desc: 'Build and ship features across our Next.js frontend and Node.js backend. You\'ll work on everything from real-time booking to payment integrations.' },
  { title: 'Product Designer', dept: 'Design', location: 'Remote', type: 'Full-time', desc: 'Design beautiful, intuitive interfaces for our scheduling platform. Own the design system and work closely with engineering.' },
  { title: 'Customer Success Manager', dept: 'Growth', location: 'Remote', type: 'Full-time', desc: 'Help our customers succeed with VuriumBook. Onboard new businesses, drive adoption, and be the voice of the customer internally.' },
  { title: 'Marketing Lead', dept: 'Growth', location: 'Remote', type: 'Full-time', desc: 'Own our go-to-market strategy. Drive organic growth through content, SEO, and community building for the barbershop and salon industry.' },
]

export default function CareersPage() {
  return (
    <>
      <nav className="navbar">
        <a href="/" className="navbar-logo">
          <img src="/logo.jpg" alt="Vurium" />
          Vurium
        </a>
        <ul className="navbar-links">
          <li><a href="/vuriumbook">VuriumBook</a></li>
          <li><a href="/about">About</a></li>
          <li><a href="/blog">Blog</a></li>
          <li><a href="/contact">Contact</a></li>
          <li><a href="/signin" className="btn-nav-cta">Sign In</a></li>
        </ul>
      </nav>

      <main style={{ minHeight: '100vh', maxWidth: 1080, margin: '0 auto', padding: 'clamp(100px, 12vh, 140px) 24px 80px', position: 'relative', zIndex: 2 }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 80 }}>
          <p className="label-glow fade-up" style={{ marginBottom: 12 }}>Careers</p>
          <h1 className="shimmer-text fade-up fade-up-d1" style={{ fontSize: 'clamp(28px, 4.5vw, 48px)', fontWeight: 600, letterSpacing: '-.03em', marginBottom: 16 }}>
            Join our team.
          </h1>
          <p className="fade-up fade-up-d2" style={{ fontSize: 'clamp(14px, 1.8vw, 17px)', fontWeight: 300, color: 'rgba(255,255,255,.4)', maxWidth: 520, margin: '0 auto', lineHeight: 1.65 }}>
            We&apos;re building the future of business management software. Come help us make great tools that thousands of businesses rely on every day.
          </p>
        </div>

        {/* Perks */}
        <section style={{ marginBottom: 80 }}>
          <p className="label-glow" style={{ textAlign: 'center', marginBottom: 12 }}>Why Vurium</p>
          <h2 className="shimmer-text" style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 600, letterSpacing: '-.03em', textAlign: 'center', marginBottom: 48 }}>
            Built for people who care.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {PERKS.map((p, i) => (
              <div key={i} className="glass-card fade-up" style={{ animationDelay: `${i * 0.08}s` }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${p.color.replace('.5)', '.06)')}`, border: `1px solid ${p.color.replace('.5)', '.12)')}`, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={p.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d={p.icon} />
                  </svg>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.01em', marginBottom: 8, color: '#e8e8ed' }}>{p.title}</h3>
                <p style={{ fontSize: 13, fontWeight: 300, color: 'rgba(255,255,255,.35)', lineHeight: 1.6 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Open Positions */}
        <section style={{ marginBottom: 80 }}>
          <p className="label-glow" style={{ textAlign: 'center', marginBottom: 12 }}>Open Positions</p>
          <h2 className="shimmer-text" style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 600, letterSpacing: '-.03em', textAlign: 'center', marginBottom: 48 }}>
            Find your role.
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {POSITIONS.map((p, i) => (
              <div key={i} className="glass-card" style={{ padding: '24px 28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: '#e8e8ed', marginBottom: 6 }}>{p.title}</h3>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(130,150,220,.6)', background: 'rgba(130,150,220,.06)', padding: '3px 10px', borderRadius: 6 }}>{p.dept}</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.3)', background: 'rgba(255,255,255,.03)', padding: '3px 10px', borderRadius: 6 }}>{p.location}</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.3)', background: 'rgba(255,255,255,.03)', padding: '3px 10px', borderRadius: 6 }}>{p.type}</span>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 300, color: 'rgba(255,255,255,.35)', lineHeight: 1.6 }}>{p.desc}</p>
                </div>
                <a href={`mailto:careers@vurium.com?subject=Application: ${p.title}`} className="btn-secondary" style={{ fontSize: 13, padding: '10px 24px', height: 'auto', flexShrink: 0, whiteSpace: 'nowrap' }}>
                  Apply Now
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ textAlign: 'center', padding: 'clamp(40px, 8vh, 80px) 0' }}>
          <h2 className="shimmer-text" style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 600, letterSpacing: '-.03em', marginBottom: 16 }}>
            Don&apos;t see your role?
          </h2>
          <p style={{ fontSize: 15, fontWeight: 300, color: 'rgba(255,255,255,.35)', maxWidth: 440, margin: '0 auto 32px', lineHeight: 1.6 }}>
            We&apos;re always looking for talented people. Send us your resume and tell us how you&apos;d contribute.
          </p>
          <a href="mailto:careers@vurium.com" className="btn-primary">careers@vurium.com</a>
        </section>
      </main>

      {/* Footer */}
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
