'use client'

const POSTS = [
  {
    slug: 'getting-started-with-vuriumbook',
    title: 'Getting Started with VuriumBook: A Complete Setup Guide',
    excerpt: 'Everything you need to know to set up your barbershop or salon on VuriumBook — from creating your workspace to accepting your first online booking.',
    date: 'March 28, 2026',
    readTime: '6 min read',
    category: 'Guide',
  },
  {
    slug: 'scaling-your-barbershop',
    title: 'How to Scale Your Barbershop from 1 Chair to 10',
    excerpt: 'Practical strategies for barbershop owners looking to grow — from hiring your first barber to managing a multi-chair operation with the right tools.',
    date: 'March 15, 2026',
    readTime: '8 min read',
    category: 'Business',
  },
  {
    slug: 'online-booking-trends-2026',
    title: 'Online Booking Trends in 2026: What Service Businesses Need to Know',
    excerpt: 'The booking landscape is shifting fast. We break down the key trends — from mobile-first booking to AI-assisted scheduling — and what they mean for your business.',
    date: 'March 3, 2026',
    readTime: '5 min read',
    category: 'Industry',
  },
]

export default function BlogPage() {
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
          <p className="label-glow fade-up" style={{ marginBottom: 12 }}>Blog</p>
          <h1 className="shimmer-text fade-up fade-up-d1" style={{ fontSize: 'clamp(28px, 4.5vw, 48px)', fontWeight: 600, letterSpacing: '-.03em', marginBottom: 16 }}>
            Insights & updates.
          </h1>
          <p className="fade-up fade-up-d2" style={{ fontSize: 'clamp(14px, 1.8vw, 17px)', fontWeight: 300, color: 'rgba(255,255,255,.4)', maxWidth: 480, margin: '0 auto', lineHeight: 1.65 }}>
            Tips, guides, and industry insights to help you grow your service business.
          </p>
        </div>

        {/* Posts Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {POSTS.map((post, i) => (
            <a
              key={i}
              href={`/blog/${post.slug}`}
              className="glass-card fade-up"
              style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', padding: 'clamp(24px, 3vw, 32px)', animationDelay: `${i * 0.1}s`, transition: 'border-color .2s' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(130,150,220,.6)', background: 'rgba(130,150,220,.06)', padding: '3px 10px', borderRadius: 6 }}>{post.category}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>{post.readTime}</span>
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-.02em', color: '#e8e8ed', marginBottom: 10, lineHeight: 1.35 }}>{post.title}</h2>
              <p style={{ fontSize: 13, fontWeight: 300, color: 'rgba(255,255,255,.35)', lineHeight: 1.6, marginBottom: 16, flex: 1 }}>{post.excerpt}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,.2)' }}>{post.date}</span>
                <span style={{ fontSize: 13, color: 'rgba(130,150,220,.7)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  Read more <span>&rarr;</span>
                </span>
              </div>
            </a>
          ))}
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
