'use client'

const heading: React.CSSProperties = { fontSize: 20, fontWeight: 600, color: 'rgba(130,150,220,.8)', marginBottom: 12, marginTop: 48 }
const text: React.CSSProperties = { fontSize: 15, fontWeight: 300, color: 'rgba(255,255,255,.45)', lineHeight: 1.8, marginBottom: 16 }
const list: React.CSSProperties = { ...text, paddingLeft: 24 }

export default function AccessibilityPage() {
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
          <li><a href="/signin">Sign In</a></li>
        </ul>
      </nav>

      <main style={{ minHeight: '100vh', maxWidth: 800, margin: '0 auto', padding: 'clamp(100px, 12vh, 140px) 24px 80px', position: 'relative', zIndex: 2 }}>
        <p className="label-glow" style={{ marginBottom: 12 }}>Commitment</p>
        <h1 className="shimmer-text" style={{ fontSize: 'clamp(28px, 4.5vw, 42px)', fontWeight: 600, letterSpacing: '-.03em', marginBottom: 8 }}>
          Accessibility Statement
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.25)', marginBottom: 48 }}>
          Last Updated: April 3, 2026
        </p>

        <p style={text}>
          Element Barbershop Co (doing business as &quot;VuriumBook&quot;) is committed to ensuring digital accessibility for people with disabilities. We are continually improving the user experience for everyone and applying the relevant accessibility standards.
        </p>

        <h2 style={heading}>Conformance Status</h2>
        <p style={text}>
          We strive to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA. These guidelines define how to make web content more accessible to people with disabilities, including those with visual, auditory, physical, speech, cognitive, and neurological impairments.
        </p>

        <h2 style={heading}>Measures We Take</h2>
        <ul style={list}>
          <li>Semantic HTML elements for proper document structure and screen reader compatibility.</li>
          <li>Keyboard navigation support throughout the platform.</li>
          <li>Sufficient color contrast ratios for text and interactive elements.</li>
          <li>Form labels and ARIA attributes for assistive technologies.</li>
          <li>Alt text for images and meaningful link text.</li>
          <li>Responsive design that works across devices and screen sizes.</li>
          <li>Focus indicators for keyboard navigation.</li>
        </ul>

        <h2 style={heading}>Known Limitations</h2>
        <p style={text}>
          While we strive for comprehensive accessibility, some areas of the platform may not yet fully meet all WCAG 2.1 AA criteria. We are actively working to identify and address these gaps. If you encounter any accessibility barriers, please let us know.
        </p>

        <h2 style={heading}>Feedback</h2>
        <p style={text}>
          We welcome your feedback on the accessibility of VuriumBook&trade;. If you experience accessibility barriers or have suggestions for improvement, please contact us:
        </p>
        <ul style={list}>
          <li>Email: <a href="mailto:support@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>support@vurium.com</a></li>
          <li>Phone: <a href="tel:+18476301884" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>(847) 630-1884</a></li>
        </ul>
        <p style={text}>
          We aim to respond to accessibility feedback within 5 business days.
        </p>

        <h2 style={heading}>Compatibility</h2>
        <p style={text}>
          VuriumBook&trade; is designed to be compatible with the following assistive technologies:
        </p>
        <ul style={list}>
          <li>Screen readers (VoiceOver, NVDA, JAWS).</li>
          <li>Screen magnification software.</li>
          <li>Speech recognition software.</li>
          <li>Keyboard-only navigation.</li>
        </ul>

        <h2 style={heading}>Enforcement</h2>
        <p style={text}>
          This statement was prepared in accordance with the requirements of the Americans with Disabilities Act (ADA) and the European Accessibility Act (EAA). If you are not satisfied with our response to your accessibility concern, you may file a complaint with the relevant authorities in your jurisdiction.
        </p>
      </main>

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
