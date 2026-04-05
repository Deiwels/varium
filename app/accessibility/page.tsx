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
          <li><a href="/">Home</a></li>
          <li><a href="/privacy">Privacy</a></li>
          <li><a href="/terms">Terms</a></li>
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
          Vurium Inc. is committed to ensuring digital accessibility for people with disabilities. We are continually improving the user experience for everyone and applying the relevant accessibility standards.
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
          We welcome your feedback on the accessibility of VuriumBook. If you experience accessibility barriers or have suggestions for improvement, please contact us:
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
          VuriumBook is designed to be compatible with the following assistive technologies:
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

      <footer style={{ borderTop: '1px solid rgba(255,255,255,.05)', padding: '20px clamp(20px, 4vw, 48px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2, flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>&copy; 2026 Vurium&trade;. All rights reserved.</span>
        <div style={{ display: 'flex', gap: 20 }}>
          <a href="/privacy" style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>Privacy</a>
          <a href="/terms" style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>Terms</a>
          <a href="/support" style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>Support</a>
          <a href="/accessibility" style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>Accessibility</a>
        </div>
      </footer>
    </>
  )
}
