'use client'
import { useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://vuriumbook-api-431945333485.us-central1.run.app'

export default function ContactPage() {
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSending(true)
    try {
      const res = await fetch(`${API}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setSent(true)
    } catch (err: any) {
      setError(err.message || 'Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

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
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <p className="label-glow fade-up" style={{ marginBottom: 12 }}>Contact</p>
          <h1 className="shimmer-text fade-up fade-up-d1" style={{ fontSize: 'clamp(28px, 4.5vw, 48px)', fontWeight: 600, letterSpacing: '-.03em', marginBottom: 16 }}>
            Get in touch.
          </h1>
          <p className="fade-up fade-up-d2" style={{ fontSize: 'clamp(14px, 1.8vw, 17px)', fontWeight: 300, color: 'rgba(255,255,255,.4)', maxWidth: 480, margin: '0 auto', lineHeight: 1.65 }}>
            Have a question about our products? Want to schedule a demo? We&apos;d love to hear from you.
          </p>
        </div>

        {/* Content */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32, alignItems: 'start' }}>

          {/* Form */}
          <div className="glass-card" style={{ padding: 'clamp(28px, 4vw, 40px)' }}>
            {sent ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(130,220,170,.08)', border: '1px solid rgba(130,220,170,.15)', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(130,220,170,.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: '#e8e8ed', marginBottom: 8 }}>Message sent!</h3>
                <p style={{ fontSize: 14, fontWeight: 300, color: 'rgba(255,255,255,.35)', lineHeight: 1.6 }}>
                  Thank you for reaching out. We&apos;ll get back to you within 24 hours.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.3)', marginBottom: 6, display: 'block' }}>Name</label>
                  <input className="form-input" placeholder="Your name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.3)', marginBottom: 6, display: 'block' }}>Email</label>
                  <input className="form-input" type="email" placeholder="you@company.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.3)', marginBottom: 6, display: 'block' }}>Company</label>
                  <input className="form-input" placeholder="Your company (optional)" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.3)', marginBottom: 6, display: 'block' }}>Message</label>
                  <textarea className="form-textarea" placeholder="How can we help?" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} required />
                </div>
                {error && <p style={{ fontSize: 13, color: 'rgba(220,130,130,.8)', margin: 0 }}>{error}</p>}
                <button type="submit" className="btn-primary" disabled={sending} style={{ marginTop: 8, border: 'none', cursor: sending ? 'wait' : 'pointer', fontSize: 14, fontFamily: 'inherit', opacity: sending ? 0.6 : 1 }}>
                  {sending ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            )}
          </div>

          {/* Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="glass-card" style={{ padding: '24px 28px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e8e8ed', marginBottom: 12 }}>Email</h3>
              <a href="mailto:support@vurium.com" style={{ fontSize: 14, color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>support@vurium.com</a>
            </div>
            <div className="glass-card" style={{ padding: '24px 28px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e8e8ed', marginBottom: 12 }}>Support Center</h3>
              <p style={{ fontSize: 13, fontWeight: 300, color: 'rgba(255,255,255,.35)', lineHeight: 1.6, marginBottom: 12 }}>
                Already a customer? Visit our support center for documentation, FAQs, and direct assistance.
              </p>
              <a href="/support" style={{ fontSize: 13, color: 'rgba(130,150,220,.7)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Go to Support <span>&rarr;</span>
              </a>
            </div>
            <div className="glass-card" style={{ padding: '24px 28px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e8e8ed', marginBottom: 12 }}>Schedule a Demo</h3>
              <p style={{ fontSize: 13, fontWeight: 300, color: 'rgba(255,255,255,.35)', lineHeight: 1.6, marginBottom: 12 }}>
                Want to see VuriumBook in action? Book a personalized walkthrough with our team.
              </p>
              <a href="/vuriumbook" style={{ fontSize: 13, color: 'rgba(130,150,220,.7)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Explore VuriumBook <span>&rarr;</span>
              </a>
            </div>
          </div>
        </div>
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
