'use client'

const heading: React.CSSProperties = { fontSize: 20, fontWeight: 600, color: 'rgba(130,150,220,.8)', marginBottom: 12, marginTop: 48 }
const text: React.CSSProperties = { fontSize: 15, fontWeight: 300, color: 'rgba(255,255,255,.45)', lineHeight: 1.8, marginBottom: 16 }
const list: React.CSSProperties = { ...text, paddingLeft: 24 }
const highlight: React.CSSProperties = { background: 'rgba(130,150,220,.04)', border: '1px solid rgba(130,150,220,.08)', borderRadius: 14, padding: '24px 28px', marginBottom: 24, marginTop: 16 }

export default function CookiePolicyPage() {
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
        <p className="label-glow" style={{ marginBottom: 12 }}>Legal</p>
        <h1 className="shimmer-text" style={{ fontSize: 'clamp(28px, 4.5vw, 42px)', fontWeight: 600, letterSpacing: '-.03em', marginBottom: 8 }}>
          Cookie Policy
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.25)', marginBottom: 48 }}>
          Effective Date: April 3, 2026 &middot; Last Updated: April 3, 2026
        </p>

        <p style={text}>
          This Cookie Policy explains how Vurium Inc. (&quot;Vurium,&quot; &quot;we,&quot; &quot;us&quot;) uses cookies and similar technologies on our website and platform. This policy should be read alongside our <a href="/privacy" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Privacy Policy</a>.
        </p>

        {/* 1. What Are Cookies */}
        <h2 style={heading}>1. What Are Cookies</h2>
        <p style={text}>
          Cookies are small text files stored on your device when you visit a website. They help the website remember your preferences and recognize you on return visits. Cookies can be &quot;session&quot; cookies (deleted when you close your browser) or &quot;persistent&quot; cookies (remain until they expire or you delete them).
        </p>

        {/* 2. Cookies We Use */}
        <h2 style={heading}>2. Cookies We Use</h2>
        <p style={text}>We use only strictly necessary cookies required for the Service to function. We do not use advertising, analytics, or tracking cookies.</p>

        <div style={{ overflowX: 'auto', marginBottom: 24 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, color: 'rgba(255,255,255,.45)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.1)' }}>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: 'rgba(255,255,255,.55)', fontWeight: 600 }}>Cookie Name</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: 'rgba(255,255,255,.55)', fontWeight: 600 }}>Purpose</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: 'rgba(255,255,255,.55)', fontWeight: 600 }}>Type</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: 'rgba(255,255,255,.55)', fontWeight: 600 }}>Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 13 }}>VURIUMBOOK_TOKEN</td>
                <td style={{ padding: '12px 16px' }}>Authentication &mdash; keeps you signed in to your account</td>
                <td style={{ padding: '12px 16px' }}>Strictly Necessary</td>
                <td style={{ padding: '12px 16px' }}>7 days</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p style={text}>
          This cookie is essential for the Service to function and cannot be disabled. It is set with the <code style={{ color: 'rgba(130,150,220,.7)', fontSize: 13, background: 'rgba(255,255,255,.04)', padding: '2px 6px', borderRadius: 4 }}>Secure</code> and <code style={{ color: 'rgba(130,150,220,.7)', fontSize: 13, background: 'rgba(255,255,255,.04)', padding: '2px 6px', borderRadius: 4 }}>SameSite=Lax</code> flags for security.
        </p>

        {/* 3. Third-Party Cookies */}
        <h2 style={heading}>3. Third-Party Cookies</h2>
        <p style={text}>
          We do not set any third-party cookies. Our payment processor (Stripe) may set its own cookies during the payment process &mdash; these are governed by <a href="https://stripe.com/privacy" target="_blank" rel="noopener" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Stripe&apos;s Privacy Policy</a>.
        </p>

        {/* 4. Managing Cookies */}
        <h2 style={heading}>4. Managing Cookies</h2>
        <p style={text}>You can control and manage cookies through your browser settings. Most browsers allow you to:</p>
        <ul style={list}>
          <li>View what cookies are set on your device.</li>
          <li>Delete individual or all cookies.</li>
          <li>Block cookies from specific or all websites.</li>
          <li>Set preferences for first-party vs. third-party cookies.</li>
        </ul>
        <p style={text}>
          Please note that disabling strictly necessary cookies may prevent you from using certain features of the Service (e.g., staying signed in).
        </p>

        {/* 5. Do Not Track */}
        <h2 style={heading}>5. &quot;Do Not Track&quot; Signals</h2>
        <p style={text}>
          Our Service does not track users across third-party websites and therefore does not respond to Do Not Track (DNT) signals. We do not engage in cross-site tracking or behavioral advertising.
        </p>

        {/* 6. Updates */}
        <h2 style={heading}>6. Changes to This Policy</h2>
        <p style={text}>
          We may update this Cookie Policy from time to time. Changes will be posted on this page with an updated effective date.
        </p>

        {/* 7. Contact */}
        <h2 style={heading}>7. Contact Us</h2>
        <p style={text}>
          If you have questions about our use of cookies, contact us at:<br />
          <a href="mailto:support@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>support@vurium.com</a>
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
