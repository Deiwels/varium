'use client'
import { useState } from 'react'

const SECTIONS = [
  {
    title: 'General',
    items: [
      { q: 'What is VuriumBook?', a: 'VuriumBook is an all-in-one appointment scheduling and business management platform built for barbershops, salons, and service businesses. It includes online booking, team calendars, payments, client CRM, waitlist management, and more.' },
      { q: 'Who is VuriumBook for?', a: 'VuriumBook is designed for barbershops, hair salons, beauty studios, spas, and any service-based business that takes appointments. Whether you\'re a solo practitioner or managing a multi-location franchise, VuriumBook scales to fit your needs.' },
      { q: 'Do I need any technical skills to use it?', a: 'Not at all. VuriumBook is designed to be intuitive and easy to set up. Most businesses are fully operational within 15 minutes of signing up. No coding or technical knowledge required.' },
      { q: 'Is there a mobile app?', a: 'VuriumBook is a fully responsive web application that works beautifully on any device — phone, tablet, or desktop. You can access it directly from your browser without downloading anything.' },
    ],
  },
  {
    title: 'Billing & Pricing',
    items: [
      { q: 'How much does VuriumBook cost?', a: 'We offer three plans: Individual at $29/month for solo practitioners, Salon at $79/month for teams up to 10, and Custom at $99/month for larger businesses. All plans include a 14-day free trial.' },
      { q: 'Is there a free trial?', a: 'Yes! Every plan includes a 14-day free trial with full access to all features. No credit card required to start. You can upgrade, downgrade, or cancel at any time.' },
      { q: 'Can I change my plan later?', a: 'Absolutely. You can upgrade or downgrade your plan at any time from your billing settings. Changes take effect immediately, and we prorate charges accordingly.' },
      { q: 'What payment methods do you accept?', a: 'We accept all major credit and debit cards (Visa, Mastercard, American Express) through our secure payment partner, Stripe. Annual billing is also available at a discounted rate.' },
    ],
  },
  {
    title: 'Security & Data',
    items: [
      { q: 'Is my data secure?', a: 'Yes. All data is encrypted in transit (TLS 1.3) and at rest. We host on Google Cloud Platform with enterprise-grade infrastructure. We never sell or share your data with third parties.' },
      { q: 'Are you GDPR compliant?', a: 'Yes. Vurium is fully GDPR compliant. We provide data processing agreements, support data portability requests, and give you full control over your customer data. See our Privacy Policy and DPA for details.' },
      { q: 'Can I export my data?', a: 'Yes. You can export all of your data — clients, bookings, payment history — at any time from your settings. Your data belongs to you, always.' },
      { q: 'What happens to my data if I cancel?', a: 'If you cancel your subscription, your data is retained for 30 days in case you change your mind. After that, it is permanently and securely deleted from our servers.' },
    ],
  },
  {
    title: 'Getting Started',
    items: [
      { q: 'How do I sign up?', a: 'Visit vurium.com/signup to create your account. You\'ll be asked for basic information like your business name and email. The whole process takes under 2 minutes.' },
      { q: 'How do my clients book appointments?', a: 'Each business gets a unique booking page (e.g., vurium.com/book/your-shop). Share this link on your website, social media, or Google Business profile. Clients can browse available times and book instantly.' },
      { q: 'Can I migrate from another booking system?', a: 'Yes. Our support team can help you import client lists and historical data from most popular booking platforms. Contact us at support@vurium.com for migration assistance.' },
      { q: 'Do you offer onboarding support?', a: 'Absolutely. All paid plans include onboarding support via email. Salon and Custom plans include priority support and optional live walkthroughs to help you get set up.' },
    ],
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
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

export default function FaqPage() {
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

      <main style={{ minHeight: '100vh', maxWidth: 760, margin: '0 auto', padding: 'clamp(100px, 12vh, 140px) 24px 80px', position: 'relative', zIndex: 2 }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <p className="label-glow fade-up" style={{ marginBottom: 12 }}>FAQ</p>
          <h1 className="shimmer-text fade-up fade-up-d1" style={{ fontSize: 'clamp(28px, 4.5vw, 48px)', fontWeight: 600, letterSpacing: '-.03em', marginBottom: 16 }}>
            Frequently asked questions.
          </h1>
          <p className="fade-up fade-up-d2" style={{ fontSize: 'clamp(14px, 1.8vw, 17px)', fontWeight: 300, color: 'rgba(255,255,255,.4)', maxWidth: 480, margin: '0 auto', lineHeight: 1.65 }}>
            Everything you need to know about VuriumBook. Can&apos;t find what you&apos;re looking for? <a href="/contact" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Contact us</a>.
          </p>
        </div>

        {/* Sections */}
        {SECTIONS.map((section, si) => (
          <section key={si} style={{ marginBottom: 48 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'rgba(130,150,220,.7)', marginBottom: 8 }}>{section.title}</h2>
            <div>
              {section.items.map((item, ii) => (
                <FaqItem key={ii} q={item.q} a={item.a} />
              ))}
            </div>
          </section>
        ))}

        {/* CTA */}
        <section style={{ textAlign: 'center', padding: 'clamp(40px, 8vh, 80px) 0' }}>
          <div className="glass-card" style={{ padding: 'clamp(32px, 5vw, 48px)', maxWidth: 520, margin: '0 auto' }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: '#e8e8ed', marginBottom: 12 }}>Still have questions?</h2>
            <p style={{ fontSize: 14, fontWeight: 300, color: 'rgba(255,255,255,.35)', lineHeight: 1.6, marginBottom: 24 }}>
              Our team is here to help. Reach out and we&apos;ll get back to you within 24 hours.
            </p>
            <a href="/contact" className="btn-primary">Contact Us</a>
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
