'use client'

const heading: React.CSSProperties = { fontSize: 20, fontWeight: 600, color: 'rgba(130,150,220,.8)', marginBottom: 12, marginTop: 48 }
const text: React.CSSProperties = { fontSize: 15, fontWeight: 300, color: 'rgba(255,255,255,.45)', lineHeight: 1.8, marginBottom: 16 }
const list: React.CSSProperties = { ...text, paddingLeft: 24 }
const highlight: React.CSSProperties = { background: 'rgba(130,150,220,.04)', border: '1px solid rgba(130,150,220,.08)', borderRadius: 14, padding: '24px 28px', marginBottom: 24, marginTop: 16 }
const card: React.CSSProperties = { background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, padding: '24px 28px', marginBottom: 16 }

export default function SupportPage() {
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
        <p className="label-glow" style={{ marginBottom: 12 }}>Help</p>
        <h1 className="shimmer-text" style={{ fontSize: 'clamp(28px, 4.5vw, 42px)', fontWeight: 600, letterSpacing: '-.03em', marginBottom: 8 }}>
          Support
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.25)', marginBottom: 48 }}>
          We&apos;re here to help. Reach out anytime.
        </p>

        {/* 1. Contact Information */}
        <h2 style={heading}>1. Contact Us</h2>
        <div style={highlight}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <strong style={{ color: 'rgba(255,255,255,.55)', fontSize: 14 }}>Email</strong>
              <p style={{ ...text, marginBottom: 0, marginTop: 4 }}>
                <a href="mailto:support@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>support@vurium.com</a>
              </p>
            </div>
            <div>
              <strong style={{ color: 'rgba(255,255,255,.55)', fontSize: 14 }}>Phone</strong>
              <p style={{ ...text, marginBottom: 0, marginTop: 4 }}>
                <a href="tel:+18476301884" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>(847) 630-1884</a>
              </p>
            </div>
            <div>
              <strong style={{ color: 'rgba(255,255,255,.55)', fontSize: 14 }}>Hours</strong>
              <p style={{ ...text, marginBottom: 0, marginTop: 4 }}>Monday &ndash; Friday, 9:00 AM &ndash; 6:00 PM CT</p>
            </div>
          </div>
        </div>

        {/* 2. Response Times */}
        <h2 style={heading}>2. Response Times</h2>
        <p style={text}>We aim to respond to all inquiries as quickly as possible:</p>
        <div style={card}>
          <ul style={{ ...list, marginBottom: 0 }}>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Email:</strong> Within 24 hours on business days.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Phone:</strong> During business hours (Mon&ndash;Fri, 9 AM&ndash;6 PM CT).</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Critical issues</strong> (service outage, payment errors): Prioritized and addressed within 4 hours during business hours.</li>
          </ul>
        </div>

        {/* 3. Service Status */}
        <h2 style={heading}>3. Service Status</h2>
        <p style={text}>
          Check the current status of Vurium services and view past incidents on our status page. If you are experiencing issues, please check here first before contacting support.
        </p>
        <div style={card}>
          <p style={{ ...text, marginBottom: 0 }}>
            <a href="https://status.vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>status.vurium.com</a> &mdash; Real-time platform status and incident history.
          </p>
        </div>

        {/* 4. SMS / Text Message Support */}
        <h2 style={heading}>4. SMS / Text Message Support</h2>
        <p style={text}>
          If you receive appointment-related text messages from a business using Vurium, you can manage your SMS preferences directly from your phone:
        </p>
        <div style={card}>
          <ul style={{ ...list, marginBottom: 0 }}>
            <li><strong style={{ color: 'rgba(130,220,170,.7)' }}>STOP</strong> &mdash; Reply STOP to any message to opt out. You will receive no further messages.</li>
            <li><strong style={{ color: 'rgba(130,220,170,.7)' }}>HELP</strong> &mdash; Reply HELP to any message for assistance and contact information.</li>
            <li><strong style={{ color: 'rgba(130,220,170,.7)' }}>START</strong> &mdash; Reply START to re-subscribe to appointment notifications.</li>
          </ul>
        </div>
        <p style={text}>
          Message and data rates may apply. Message frequency varies, up to 5 messages per booking. Consent to receive SMS is not a condition of making a booking or purchase. For more details, see our <a href="/privacy" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Privacy Policy</a>.
        </p>

        {/* 5. For Business Owners */}
        <h2 style={heading}>5. For Business Owners</h2>
        <p style={text}>If you are a business using Vurium, here is how we can help:</p>
        <div style={card}>
          <ul style={{ ...list, marginBottom: 0 }}>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Onboarding &amp; Setup:</strong> Need help setting up your booking page, team, services, or schedule? Email us and we&apos;ll walk you through it.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Billing &amp; Subscription:</strong> Questions about your plan, invoices, or payment methods? Contact us at <a href="mailto:support@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>support@vurium.com</a>.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Feature Requests:</strong> Have an idea that would improve Vurium for your business? We&apos;d love to hear it &mdash; email us anytime.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Bug Reports:</strong> If something isn&apos;t working as expected, please email us with a description of the issue, the device/browser you&apos;re using, and any screenshots if possible.</li>
          </ul>
        </div>

        {/* 6. Data & Privacy Requests */}
        <h2 style={heading}>6. Data &amp; Privacy Requests</h2>
        <p style={text}>
          We respect your rights under applicable privacy laws including CCPA and GDPR. You can request the following at any time by emailing <a href="mailto:support@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>support@vurium.com</a>:
        </p>
        <div style={card}>
          <ul style={{ ...list, marginBottom: 0 }}>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Access:</strong> Request a copy of the personal data we hold about you.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Correction:</strong> Request correction of inaccurate or incomplete data.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Deletion:</strong> Request deletion of your personal data. We will process your request within 30 days.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Data Export:</strong> Request an export of your data in a portable format.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Opt-Out of SMS:</strong> Reply STOP to any message, or email us to be removed from all messaging lists.</li>
          </ul>
        </div>
        <p style={text}>
          We will verify your identity before processing any request. Requests are fulfilled within 30 days in accordance with applicable law.
        </p>

        {/* 7. Security */}
        <h2 style={heading}>7. Security</h2>
        <p style={text}>
          We take security seriously. If you discover a vulnerability or security issue, please report it responsibly:
        </p>
        <div style={card}>
          <ul style={{ ...list, marginBottom: 0 }}>
            <li>Email: <a href="mailto:security@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>security@vurium.com</a></li>
            <li>Please include a description of the issue, steps to reproduce, and any relevant screenshots or logs.</li>
            <li>Do not publicly disclose the vulnerability until we have addressed it.</li>
          </ul>
        </div>
        <p style={text}>
          We encrypt all sensitive data at rest and in transit. Phone numbers are stored encrypted. Payments are processed securely through Stripe &mdash; we never store credit card numbers on our servers.
        </p>

        {/* 8. FAQ */}
        <h2 style={heading}>8. Frequently Asked Questions</h2>

        <div style={card}>
          <strong style={{ color: 'rgba(255,255,255,.55)', fontSize: 15 }}>How do I cancel or reschedule my appointment?</strong>
          <p style={{ ...text, marginBottom: 0, marginTop: 8 }}>
            Check your booking confirmation email or SMS for a link to manage your appointment. You can also contact the business directly.
          </p>
        </div>

        <div style={card}>
          <strong style={{ color: 'rgba(255,255,255,.55)', fontSize: 15 }}>How do I stop receiving text messages?</strong>
          <p style={{ ...text, marginBottom: 0, marginTop: 8 }}>
            Reply <strong style={{ color: 'rgba(130,220,170,.7)' }}>STOP</strong> to any SMS you receive from us. You will be unsubscribed immediately and will receive no further messages. You can also email <a href="mailto:support@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>support@vurium.com</a> to request removal.
          </p>
        </div>

        <div style={card}>
          <strong style={{ color: 'rgba(255,255,255,.55)', fontSize: 15 }}>Is my personal information safe?</strong>
          <p style={{ ...text, marginBottom: 0, marginTop: 8 }}>
            Yes. We encrypt phone numbers at rest and never sell or share your data with third parties for marketing purposes. Payments are processed securely through Stripe. See our <a href="/privacy" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Privacy Policy</a> for full details.
          </p>
        </div>

        <div style={card}>
          <strong style={{ color: 'rgba(255,255,255,.55)', fontSize: 15 }}>How do I delete my account or data?</strong>
          <p style={{ ...text, marginBottom: 0, marginTop: 8 }}>
            Email <a href="mailto:support@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>support@vurium.com</a> with the subject &quot;Account Deletion Request.&quot; We will verify your identity and process the deletion within 30 days.
          </p>
        </div>

        <div style={card}>
          <strong style={{ color: 'rgba(255,255,255,.55)', fontSize: 15 }}>I&apos;m a business owner. How do I get started with Vurium?</strong>
          <p style={{ ...text, marginBottom: 0, marginTop: 8 }}>
            Visit <a href="/" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>vurium.com</a> to create your account and set up your booking page. If you need help with onboarding, email us at <a href="mailto:support@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>support@vurium.com</a>.
          </p>
        </div>

        <div style={card}>
          <strong style={{ color: 'rgba(255,255,255,.55)', fontSize: 15 }}>What payment methods do you accept?</strong>
          <p style={{ ...text, marginBottom: 0, marginTop: 8 }}>
            Payments are processed through Stripe. We accept all major credit and debit cards. Business owners can connect their Stripe account to receive payments directly from clients.
          </p>
        </div>

        {/* Legal links */}
        <h2 style={heading}>Legal</h2>
        <p style={text}>
          <a href="/privacy" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Privacy Policy</a>
          {' '}&middot;{' '}
          <a href="/terms" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Terms of Service</a>
        </p>

        <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', marginTop: 48, paddingTop: 24 }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.2)', lineHeight: 1.6 }}>
            Vurium Inc. &middot; Chicago, IL &middot; support@vurium.com &middot; (847) 630-1884
          </p>
        </div>
      </main>
    </>
  )
}
