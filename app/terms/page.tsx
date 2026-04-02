'use client'

const heading: React.CSSProperties = { fontSize: 20, fontWeight: 600, color: 'rgba(130,150,220,.8)', marginBottom: 12, marginTop: 48 }
const text: React.CSSProperties = { fontSize: 15, fontWeight: 300, color: 'rgba(255,255,255,.45)', lineHeight: 1.8, marginBottom: 16 }
const list: React.CSSProperties = { ...text, paddingLeft: 24 }
const highlight: React.CSSProperties = { background: 'rgba(130,150,220,.04)', border: '1px solid rgba(130,150,220,.08)', borderRadius: 14, padding: '24px 28px', marginBottom: 24, marginTop: 16 }

export default function TermsPage() {
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
        </ul>
      </nav>

      <main style={{ minHeight: '100vh', maxWidth: 800, margin: '0 auto', padding: 'clamp(100px, 12vh, 140px) 24px 80px', position: 'relative', zIndex: 2 }}>
        <p className="label-glow" style={{ marginBottom: 12 }}>Legal</p>
        <h1 className="shimmer-text" style={{ fontSize: 'clamp(28px, 4.5vw, 42px)', fontWeight: 600, letterSpacing: '-.03em', marginBottom: 8 }}>
          Terms of Service
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.25)', marginBottom: 48 }}>
          Effective Date: April 1, 2026 &middot; Last Updated: April 1, 2026
        </p>

        {/* 1. Acceptance */}
        <h2 style={heading}>1. Acceptance of Terms</h2>
        <p style={text}>
          By accessing or using VuriumBook (the &quot;Service&quot;), operated by Vurium Inc. (&quot;Vurium,&quot; &quot;we,&quot; &quot;us&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.
        </p>

        {/* 2. Service Description */}
        <h2 style={heading}>2. Service Description</h2>
        <p style={text}>
          VuriumBook is a software-as-a-service (SaaS) platform for barbershops, salons, and service businesses. The platform provides online appointment booking, team and calendar management, client CRM, payment processing, and SMS notifications for appointments.
        </p>

        {/* 3. Accounts */}
        <h2 style={heading}>3. Account Terms</h2>
        <ul style={list}>
          <li>Business owners and administrators create accounts to manage their operations.</li>
          <li>You are responsible for maintaining the security of your account credentials.</li>
          <li>You must provide accurate and complete information during registration.</li>
          <li>You are responsible for all activity that occurs under your account.</li>
        </ul>

        {/* 4. SMS Program Terms */}
        <h2 style={heading}>4. SMS / Text Messaging Program Terms</h2>
        <div style={highlight}>
          <p style={{ ...text, marginBottom: 14 }}>
            VuriumBook provides appointment-related text messaging as part of the booking experience. By opting in to SMS at the time of booking, you agree to the following:
          </p>
          <ul style={{ ...list, marginBottom: 0 }}>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Program Description:</strong> Transactional text messages related to your appointments with businesses using VuriumBook.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Message Types:</strong> Booking confirmations, appointment reminders (24-hour and 2-hour), schedule changes, and cancellation notices.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Message Frequency:</strong> Up to 5 messages per booking.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Opt-Out:</strong> Reply <strong style={{ color: 'rgba(130,220,170,.7)' }}>STOP</strong> to any message to unsubscribe. Your booking will remain active, but you will not receive SMS notifications.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Help:</strong> Reply <strong style={{ color: 'rgba(130,220,170,.7)' }}>HELP</strong> for assistance, or email hello@vurium.com.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Message and data rates may apply.</strong> Check with your wireless carrier.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Supported Carriers:</strong> Major US carriers are supported. Carriers are not liable for delayed or undelivered messages.</li>
            <li>Consent to receive SMS is <strong style={{ color: 'rgba(255,255,255,.55)' }}>not required</strong> to use the booking service or make a purchase.</li>
          </ul>
        </div>

        {/* 5. Acceptable Use */}
        <h2 style={heading}>5. Acceptable Use</h2>
        <p style={text}>You agree not to:</p>
        <ul style={list}>
          <li>Use the Service for any unlawful purpose or in violation of any applicable laws.</li>
          <li>Attempt to gain unauthorized access to the Service or its systems.</li>
          <li>Interfere with or disrupt the Service or servers.</li>
          <li>Scrape, harvest, or collect data from the Service without authorization.</li>
          <li>Send spam, unsolicited messages, or abuse the messaging features.</li>
        </ul>

        {/* 6. Payments */}
        <h2 style={heading}>6. Subscription & Payment Terms</h2>
        <ul style={list}>
          <li>Business subscriptions are billed monthly according to your selected plan (Individual, Salon, or Custom).</li>
          <li>Payments are processed securely through Stripe. Vurium does not store credit card information.</li>
          <li>You may cancel your subscription at any time. Cancellation takes effect at the end of the current billing period.</li>
          <li>Refunds are not provided for partial billing periods.</li>
        </ul>

        {/* 7. Intellectual Property */}
        <h2 style={heading}>7. Intellectual Property</h2>
        <p style={text}>
          The VuriumBook platform, including its design, code, and branding, is owned by Vurium Inc. You retain ownership of all data you enter into the Service. By using the Service, you grant us a limited license to process your data as necessary to provide the Service.
        </p>

        {/* 8. Limitation of Liability */}
        <h2 style={heading}>8. Limitation of Liability</h2>
        <p style={text}>
          The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, either express or implied. To the fullest extent permitted by law, Vurium shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, arising out of or related to your use of the Service.
        </p>

        {/* 9. Service Modifications */}
        <h2 style={heading}>9. Service Modifications</h2>
        <p style={text}>
          We reserve the right to modify, suspend, or discontinue any part of the Service at any time with reasonable notice. We will make reasonable efforts to notify you of material changes.
        </p>

        {/* 10. Termination */}
        <h2 style={heading}>10. Termination</h2>
        <p style={text}>
          Either party may terminate the agreement at any time. Upon termination, your data will be available for export for 30 days, after which it may be deleted. We may terminate or suspend your account immediately for violations of these Terms.
        </p>

        {/* 11. Governing Law */}
        <h2 style={heading}>11. Governing Law</h2>
        <p style={text}>
          These Terms shall be governed by and construed in accordance with the laws of the State of Illinois, United States, without regard to conflict of law principles.
        </p>

        {/* 12. Changes */}
        <h2 style={heading}>12. Changes to These Terms</h2>
        <p style={text}>
          We may update these Terms from time to time. We will notify you of material changes by posting the updated Terms on this page. Continued use of the Service after changes constitutes acceptance.
        </p>

        {/* 13. Contact */}
        <h2 style={heading}>13. Contact Us</h2>
        <p style={text}>
          Questions about these Terms? Contact us at:<br />
          <a href="mailto:hello@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>hello@vurium.com</a>
        </p>
      </main>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,.05)', padding: '20px clamp(20px, 4vw, 48px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2, flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>&copy; 2026 Vurium. All rights reserved.</span>
        <div style={{ display: 'flex', gap: 20 }}>
          <a href="/privacy" style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>Privacy</a>
          <a href="/terms" style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>Terms</a>
        </div>
      </footer>
    </>
  )
}
