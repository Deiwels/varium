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
          Support Center
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.25)', marginBottom: 48 }}>
          We&apos;re here to help. Reach out anytime.
        </p>

        {/* 1. Contact Channels */}
        <h2 style={heading}>1. Contact Us</h2>
        <p style={text}>Choose the channel that fits your needs:</p>
        <div style={highlight}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            <div>
              <strong style={{ color: 'rgba(130,220,170,.7)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.05em' }}>General Support</strong>
              <p style={{ ...text, marginBottom: 0, marginTop: 6 }}>
                <a href="mailto:support@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>support@vurium.com</a>
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,.25)', margin: 0 }}>Technical issues, account help, general questions</p>
            </div>
            <div>
              <strong style={{ color: 'rgba(130,220,170,.7)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.05em' }}>Billing</strong>
              <p style={{ ...text, marginBottom: 0, marginTop: 6 }}>
                <a href="mailto:billing@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>billing@vurium.com</a>
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,.25)', margin: 0 }}>Invoices, subscription changes, payment issues</p>
            </div>
            <div>
              <strong style={{ color: 'rgba(130,220,170,.7)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.05em' }}>Sales</strong>
              <p style={{ ...text, marginBottom: 0, marginTop: 6 }}>
                <a href="mailto:sales@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>sales@vurium.com</a>
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,.25)', margin: 0 }}>Demos, pricing, enterprise plans</p>
            </div>
            <div>
              <strong style={{ color: 'rgba(130,220,170,.7)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.05em' }}>Security &amp; Legal</strong>
              <p style={{ ...text, marginBottom: 0, marginTop: 6 }}>
                <a href="mailto:security@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>security@vurium.com</a>
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,.25)', margin: 0 }}>Vulnerability reports, legal inquiries, GDPR/CCPA requests</p>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', marginTop: 20, paddingTop: 16, display: 'flex', flexWrap: 'wrap', gap: 20 }}>
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

        {/* 2. Response Times & SLA */}
        <h2 style={heading}>2. Response Times &amp; SLA</h2>
        <p style={text}>We prioritize issues by severity to ensure the fastest resolution:</p>
        <div style={{ overflowX: 'auto', marginBottom: 24 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, color: 'rgba(255,255,255,.45)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.1)' }}>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'rgba(255,255,255,.55)', fontWeight: 600 }}>Priority</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'rgba(255,255,255,.55)', fontWeight: 600 }}>Issue Type</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'rgba(255,255,255,.55)', fontWeight: 600 }}>Response</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'rgba(255,255,255,.55)', fontWeight: 600 }}>Resolution Target</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', color: 'rgba(255,255,255,.55)', fontWeight: 600 }}>Escalation</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                <td style={{ padding: '12px 14px' }}><strong style={{ color: 'rgba(255,80,80,.8)' }}>P1</strong></td>
                <td style={{ padding: '12px 14px' }}>Service outage, security incident, data breach</td>
                <td style={{ padding: '12px 14px' }}>&lt; 1 hour</td>
                <td style={{ padding: '12px 14px' }}>4 hours</td>
                <td style={{ padding: '12px 14px' }}>Immediate &rarr; Engineering + CISO</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                <td style={{ padding: '12px 14px' }}><strong style={{ color: 'rgba(255,180,80,.8)' }}>P2</strong></td>
                <td style={{ padding: '12px 14px' }}>Major feature broken, payment errors</td>
                <td style={{ padding: '12px 14px' }}>&lt; 4 hours</td>
                <td style={{ padding: '12px 14px' }}>24 hours</td>
                <td style={{ padding: '12px 14px' }}>Team Lead if unresolved in 12h</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                <td style={{ padding: '12px 14px' }}><strong style={{ color: 'rgba(255,220,80,.8)' }}>P3</strong></td>
                <td style={{ padding: '12px 14px' }}>Minor bug, UI issue, feature request</td>
                <td style={{ padding: '12px 14px' }}>&lt; 24 hours</td>
                <td style={{ padding: '12px 14px' }}>3 business days</td>
                <td style={{ padding: '12px 14px' }}>Added to development backlog</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                <td style={{ padding: '12px 14px' }}><strong style={{ color: 'rgba(130,220,170,.7)' }}>P4</strong></td>
                <td style={{ padding: '12px 14px' }}>General question, how-to, feedback</td>
                <td style={{ padding: '12px 14px' }}>&lt; 48 hours</td>
                <td style={{ padding: '12px 14px' }}>5 business days</td>
                <td style={{ padding: '12px 14px' }}>FAQ / documentation update</td>
              </tr>
            </tbody>
          </table>
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

        {/* 4. Incident Notification */}
        <h2 style={heading}>4. Incident Notification</h2>
        <p style={text}>In the event of a service disruption or security incident:</p>
        <div style={card}>
          <ul style={{ ...list, marginBottom: 0 }}>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Status page:</strong> We post real-time updates at <a href="https://status.vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>status.vurium.com</a>.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Email notification:</strong> Affected users are notified by email with details of the issue, estimated resolution time, and any actions required.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Data breach:</strong> In the event of a personal data breach, we notify the relevant supervisory authority within 72 hours (GDPR Art. 33) and affected users without undue delay if the breach poses a high risk to their rights.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Post-incident report:</strong> After resolution, we publish a root cause analysis and steps taken to prevent recurrence.</li>
          </ul>
        </div>

        {/* 5. SMS / Text Message Support */}
        <h2 style={heading}>5. SMS / Text Message Support</h2>
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

        {/* 6. For Business Owners */}
        <h2 style={heading}>6. For Business Owners</h2>
        <p style={text}>If you are a business using Vurium, here is how we can help:</p>
        <div style={card}>
          <ul style={{ ...list, marginBottom: 0 }}>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Onboarding &amp; Setup:</strong> Need help setting up your booking page, team, services, or schedule? Email <a href="mailto:support@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>support@vurium.com</a> and we&apos;ll walk you through it.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Billing &amp; Subscription:</strong> Questions about your plan, invoices, or payment methods? Contact <a href="mailto:billing@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>billing@vurium.com</a>.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Feature Requests:</strong> Have an idea that would improve Vurium for your business? We&apos;d love to hear it &mdash; email us anytime.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Bug Reports:</strong> If something isn&apos;t working as expected, please email us with a description of the issue, the device/browser you&apos;re using, and any screenshots if possible.</li>
          </ul>
        </div>

        {/* 7. Data & Privacy Requests */}
        <h2 style={heading}>7. Data &amp; Privacy Requests</h2>
        <p style={text}>
          We respect your rights under applicable privacy laws including GDPR, CCPA, and Ukrainian data protection law. You can request the following at any time:
        </p>
        <div style={card}>
          <ul style={{ ...list, marginBottom: 0 }}>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Access:</strong> Request a copy of the personal data we hold about you.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Correction:</strong> Request correction of inaccurate or incomplete data.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Deletion:</strong> Request deletion of your personal data. We will process your request within 30 days.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Data Export:</strong> Request an export of your data in a portable format (JSON).</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Opt-Out of SMS:</strong> Reply STOP to any message, or email us to be removed from all messaging lists.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>CCPA Opt-Out:</strong> California residents may request opt-out of sale/sharing of personal information. We do not sell your data.</li>
          </ul>
        </div>
        <p style={text}>
          To submit a request, email <a href="mailto:support@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>support@vurium.com</a> or <a href="mailto:security@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>security@vurium.com</a>. We will verify your identity and respond within 30 days (or 45 days for complex requests, with notice), in accordance with GDPR and CCPA requirements.
        </p>
        <div style={{ ...card, background: 'rgba(130,150,220,.03)', border: '1px solid rgba(130,150,220,.08)' }}>
          <p style={{ ...text, marginBottom: 0, fontSize: 13 }}>
            <strong style={{ color: 'rgba(255,255,255,.45)' }}>Privacy notice:</strong> When you contact support, we process your name, email, and inquiry details to resolve your issue. This data is handled per our <a href="/privacy" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Privacy Policy</a>, stored securely, and retained only as long as necessary. Support interactions are processed under GDPR Article 6(1)(b) (contract performance) or 6(1)(f) (legitimate interest in providing customer service).
          </p>
        </div>

        {/* 8. Security */}
        <h2 style={heading}>8. Security</h2>
        <p style={text}>
          We take security seriously. If you discover a vulnerability or security issue, please report it responsibly:
        </p>
        <div style={card}>
          <ul style={{ ...list, marginBottom: 0 }}>
            <li>Email: <a href="mailto:security@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>security@vurium.com</a></li>
            <li>Please include a description of the issue, steps to reproduce, and any relevant screenshots or logs.</li>
            <li>Do not publicly disclose the vulnerability until we have addressed it.</li>
            <li>We aim to acknowledge reports within 24 hours and provide a resolution timeline within 72 hours.</li>
          </ul>
        </div>
        <p style={text}>
          We encrypt all sensitive data at rest (AES-256-GCM) and in transit (TLS 1.2+). Phone numbers, client names, and emails are encrypted. Payments are processed securely through Stripe &mdash; we never store credit card numbers on our servers.
        </p>

        {/* 9. Whistleblowing */}
        <h2 style={heading}>9. Whistleblowing &amp; Misconduct Reporting</h2>
        <p style={text}>
          In accordance with the EU Whistleblower Directive (2019/1937), you may report suspected misconduct, fraud, or legal violations anonymously or confidentially:
        </p>
        <div style={card}>
          <ul style={{ ...list, marginBottom: 0 }}>
            <li>Email: <a href="mailto:security@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>security@vurium.com</a></li>
            <li>All reports are treated confidentially. We do not retaliate against whistleblowers.</li>
            <li>Reports are reviewed by management within 7 days and you will receive a response within 3 months.</li>
          </ul>
        </div>

        {/* 10. FAQ */}
        <h2 style={heading}>10. Frequently Asked Questions</h2>

        <div style={card}>
          <strong style={{ color: 'rgba(255,255,255,.55)', fontSize: 15 }}>How do I contact support?</strong>
          <p style={{ ...text, marginBottom: 0, marginTop: 8 }}>
            Email <a href="mailto:support@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>support@vurium.com</a> for general help, <a href="mailto:billing@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>billing@vurium.com</a> for billing, or call (847) 630-1884 during business hours. For security issues, email <a href="mailto:security@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>security@vurium.com</a>.
          </p>
        </div>

        <div style={card}>
          <strong style={{ color: 'rgba(255,255,255,.55)', fontSize: 15 }}>What is your response time?</strong>
          <p style={{ ...text, marginBottom: 0, marginTop: 8 }}>
            Critical issues (P1): under 1 hour. Major issues (P2): under 4 hours. General questions: within 24-48 hours. See the SLA table above for full details.
          </p>
        </div>

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
          <strong style={{ color: 'rgba(255,255,255,.55)', fontSize: 15 }}>How do I delete my account or data?</strong>
          <p style={{ ...text, marginBottom: 0, marginTop: 8 }}>
            Email <a href="mailto:support@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>support@vurium.com</a> with the subject &quot;Account Deletion Request.&quot; We will verify your identity and process the deletion within 30 days. You may also request a data export before deletion.
          </p>
        </div>

        <div style={card}>
          <strong style={{ color: 'rgba(255,255,255,.55)', fontSize: 15 }}>Is my personal information safe?</strong>
          <p style={{ ...text, marginBottom: 0, marginTop: 8 }}>
            Yes. We encrypt personal data at rest (AES-256-GCM) and in transit (TLS). We never sell or share your data with third parties for marketing purposes. Payments are processed securely through Stripe. See our <a href="/privacy" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Privacy Policy</a> for full details.
          </p>
        </div>

        <div style={card}>
          <strong style={{ color: 'rgba(255,255,255,.55)', fontSize: 15 }}>I&apos;m a business owner. How do I get started with Vurium?</strong>
          <p style={{ ...text, marginBottom: 0, marginTop: 8 }}>
            Visit <a href="/" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>vurium.com</a> to create your account and set up your booking page. For demos or enterprise plans, email <a href="mailto:sales@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>sales@vurium.com</a>. For setup help, email <a href="mailto:support@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>support@vurium.com</a>.
          </p>
        </div>

        <div style={card}>
          <strong style={{ color: 'rgba(255,255,255,.55)', fontSize: 15 }}>What payment methods do you accept?</strong>
          <p style={{ ...text, marginBottom: 0, marginTop: 8 }}>
            Payments are processed through Stripe. We accept all major credit and debit cards. Business owners can connect their Stripe account to receive payments directly from clients.
          </p>
        </div>

        {/* 11. Legal & Compliance */}
        <h2 style={heading}>11. Legal &amp; Compliance</h2>
        <p style={text}>
          <a href="/privacy" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Privacy Policy</a>
          {' '}&middot;{' '}
          <a href="/terms" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Terms of Service</a>
          {' '}&middot;{' '}
          <a href="/cookies" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Cookie Policy</a>
          {' '}&middot;{' '}
          <a href="/dpa" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Data Processing Agreement</a>
          {' '}&middot;{' '}
          <a href="/accessibility" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Accessibility Statement</a>
        </p>

        <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', marginTop: 48, paddingTop: 24 }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.2)', lineHeight: 1.6 }}>
            Vurium Inc. &middot; 1603 Orchard Rd, Aurora, IL 60506, United States &middot; support@vurium.com &middot; (847) 630-1884
          </p>
        </div>
      </main>
    </>
  )
}
