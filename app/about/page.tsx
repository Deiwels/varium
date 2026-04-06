'use client'

const heading: React.CSSProperties = { fontSize: 20, fontWeight: 600, color: 'rgba(130,150,220,.8)', marginBottom: 12, marginTop: 48 }
const text: React.CSSProperties = { fontSize: 15, fontWeight: 300, color: 'rgba(255,255,255,.45)', lineHeight: 1.8, marginBottom: 16 }

const TEAM = [
  { name: 'Nazarii Demediuk', role: 'Founder & CEO', bio: 'Full-stack engineer with a passion for building products that simplify business operations. Previously led engineering teams at enterprise SaaS companies.' },
]

const VALUES = [
  { title: 'Customer First', desc: 'Every decision starts with the question: does this make our customers\u2019 lives easier? We obsess over the details that matter to the people who use our software daily.', color: 'rgba(130,220,170,.5)' },
  { title: 'Relentless Innovation', desc: 'We ship fast, iterate faster, and never settle. Our product evolves weekly because standing still means falling behind.', color: 'rgba(130,150,220,.5)' },
  { title: 'Uncompromising Reliability', desc: 'Your business runs on our software. We engineer for 99.9% uptime, zero data loss, and performance that never gets in the way.', color: 'rgba(220,170,100,.5)' },
]

const BADGES = [
  { label: 'GDPR Compliant', desc: 'Full compliance with EU data protection regulations' },
  { label: 'SOC 2 Type II', desc: 'Enterprise-grade security controls and auditing' },
  { label: 'SSL Encrypted', desc: 'All data encrypted in transit and at rest' },
  { label: '99.9% Uptime', desc: 'Reliable infrastructure hosted on Google Cloud' },
]

export default function AboutPage() {
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
          <p className="label-glow fade-up" style={{ marginBottom: 12 }}>About Us</p>
          <h1 className="shimmer-text fade-up fade-up-d1" style={{ fontSize: 'clamp(28px, 4.5vw, 48px)', fontWeight: 600, letterSpacing: '-.03em', marginBottom: 20 }}>
            Building software that<br />businesses depend on.
          </h1>
          <p className="fade-up fade-up-d2" style={{ fontSize: 'clamp(14px, 1.8vw, 17px)', fontWeight: 300, color: 'rgba(255,255,255,.4)', maxWidth: 560, margin: '0 auto', lineHeight: 1.65 }}>
            Vurium is a software company focused on creating modern, reliable tools for service businesses. Our mission is to make business automation simple and accessible for everyone.
          </p>
        </div>

        {/* Mission */}
        <section style={{ marginBottom: 80 }}>
          <p className="label-glow" style={{ marginBottom: 12 }}>Our Mission</p>
          <h2 style={heading}>Why We Exist</h2>
          <p style={text}>
            Service businesses — barbershops, salons, spas, studios — deserve the same caliber of software that billion-dollar companies use. But most tools on the market are clunky, overpriced, or built for a different era. We started Vurium to change that.
          </p>
          <p style={text}>
            We believe that scheduling an appointment, managing a team, and getting paid should be effortless. Not something that requires a manual. Our products are designed to work the way you think — intuitive, fast, and beautiful.
          </p>
        </section>

        {/* Values */}
        <section style={{ marginBottom: 80 }}>
          <p className="label-glow" style={{ textAlign: 'center', marginBottom: 12 }}>Our Values</p>
          <h2 className="shimmer-text" style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 600, letterSpacing: '-.03em', textAlign: 'center', marginBottom: 48 }}>
            What drives us.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            {VALUES.map((v, i) => (
              <div key={i} className="glass-card fade-up" style={{ animationDelay: `${i * 0.1}s` }}>
                <div style={{ width: 32, height: 2, borderRadius: 1, background: v.color, marginBottom: 20 }} />
                <h3 style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-.01em', marginBottom: 10, color: '#e8e8ed' }}>{v.title}</h3>
                <p style={{ fontSize: 14, fontWeight: 300, color: 'rgba(255,255,255,.35)', lineHeight: 1.6 }}>{v.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Team */}
        <section style={{ marginBottom: 80 }}>
          <p className="label-glow" style={{ textAlign: 'center', marginBottom: 12 }}>Our Team</p>
          <h2 className="shimmer-text" style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 600, letterSpacing: '-.03em', textAlign: 'center', marginBottom: 48 }}>
            The people behind Vurium.
          </h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
            {TEAM.map((t, i) => (
              <div key={i} className="glass-card" style={{ textAlign: 'center', maxWidth: 320, padding: '40px 32px' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(130,150,220,.1)', border: '1px solid rgba(130,150,220,.15)', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 28, color: 'rgba(130,150,220,.5)' }}>{t.name[0]}</span>
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 600, color: '#e8e8ed', marginBottom: 4 }}>{t.name}</h3>
                <p style={{ fontSize: 13, color: 'rgba(130,150,220,.6)', marginBottom: 14, fontWeight: 500 }}>{t.role}</p>
                <p style={{ fontSize: 13, fontWeight: 300, color: 'rgba(255,255,255,.35)', lineHeight: 1.6 }}>{t.bio}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Trust & Security */}
        <section style={{ marginBottom: 80 }}>
          <p className="label-glow" style={{ textAlign: 'center', marginBottom: 12 }}>Trust & Security</p>
          <h2 className="shimmer-text" style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 600, letterSpacing: '-.03em', textAlign: 'center', marginBottom: 48 }}>
            Enterprise-grade protection.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {BADGES.map((b, i) => (
              <div key={i} className="glass-card" style={{ textAlign: 'center', padding: '28px 20px' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(130,150,220,.06)', border: '1px solid rgba(130,150,220,.1)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(130,150,220,.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e8e8ed', marginBottom: 6 }}>{b.label}</h3>
                <p style={{ fontSize: 12, fontWeight: 300, color: 'rgba(255,255,255,.3)', lineHeight: 1.5 }}>{b.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ textAlign: 'center', padding: 'clamp(40px, 8vh, 80px) 0' }}>
          <h2 className="shimmer-text" style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 600, letterSpacing: '-.03em', marginBottom: 16 }}>
            Want to learn more?
          </h2>
          <p style={{ fontSize: 15, fontWeight: 300, color: 'rgba(255,255,255,.35)', maxWidth: 400, margin: '0 auto 32px', lineHeight: 1.6 }}>
            We&apos;d love to tell you more about what we&apos;re building.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/contact" className="btn-primary">Get in Touch</a>
            <a href="/vuriumbook" className="btn-secondary">Explore VuriumBook</a>
          </div>
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
