'use client'

const heading: React.CSSProperties = { fontSize: 20, fontWeight: 600, color: 'rgba(130,150,220,.8)', marginBottom: 12, marginTop: 48 }
const text: React.CSSProperties = { fontSize: 15, fontWeight: 300, color: 'rgba(255,255,255,.45)', lineHeight: 1.8, marginBottom: 16 }
const list: React.CSSProperties = { ...text, paddingLeft: 24 }
const highlight: React.CSSProperties = { background: 'rgba(130,150,220,.04)', border: '1px solid rgba(130,150,220,.08)', borderRadius: 14, padding: '24px 28px', marginBottom: 24, marginTop: 16 }

export default function PrivacyPage() {
  return (
    <>
      <nav className="navbar">
        <a href="/" className="navbar-logo">
          <img src="/logo.jpg" alt="Vurium" />
          Vurium
        </a>
        <ul className="navbar-links">
          <li><a href="/">Home</a></li>
          <li><a href="/terms">Terms</a></li>
        </ul>
      </nav>

      <main style={{ minHeight: '100vh', maxWidth: 800, margin: '0 auto', padding: 'clamp(100px, 12vh, 140px) 24px 80px', position: 'relative', zIndex: 2 }}>
        <p className="label-glow" style={{ marginBottom: 12 }}>Legal</p>
        <h1 className="shimmer-text" style={{ fontSize: 'clamp(28px, 4.5vw, 42px)', fontWeight: 600, letterSpacing: '-.03em', marginBottom: 8 }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.25)', marginBottom: 48 }}>
          Effective Date: April 1, 2026 &middot; Last Updated: April 1, 2026
        </p>

        {/* Introduction */}
        <p style={text}>
          Vurium Inc. (&quot;Vurium,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the VuriumBook platform &mdash; a scheduling and business management service for barbershops, salons, and service businesses. This Privacy Policy describes how we collect, use, store, and protect your personal information when you use our website and services.
        </p>

        {/* 1. Information We Collect */}
        <h2 style={heading}>1. Information We Collect</h2>
        <p style={text}>We may collect the following types of information:</p>
        <ul style={list}>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Personal Information:</strong> Name, mobile phone number, and email address (when provided during booking or account creation).</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Booking Data:</strong> Requested services, appointment date/time, barber or provider preference, and any notes you provide.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Technical Data:</strong> IP address, browser user agent, and device information &mdash; collected for consent record-keeping, security, and analytics.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Payment Data:</strong> Processed securely by our third-party payment provider (Stripe). We do not store credit card numbers on our servers.</li>
        </ul>

        {/* 2. How We Use Your Information */}
        <h2 style={heading}>2. How We Use Your Information</h2>
        <ul style={list}>
          <li>To provide and manage appointment booking services.</li>
          <li>To send transactional SMS/text messages related to your appointments (confirmations, reminders, schedule changes, and cancellations).</li>
          <li>To communicate about your account or respond to inquiries.</li>
          <li>To improve our services through aggregated, anonymized analytics.</li>
        </ul>

        {/* 3. SMS / Text Messaging Disclosure */}
        <h2 style={heading}>3. SMS / Text Messaging Disclosure</h2>
        <div style={highlight}>
          <p style={{ ...text, marginBottom: 14 }}>
            By providing your phone number and checking the SMS consent box during the booking process, you consent to receive text messages from VuriumBook and the business you are booking with, related to your appointments.
          </p>
          <ul style={{ ...list, marginBottom: 0 }}>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Message Types:</strong> Appointment confirmations, reminders (24 hours and 2 hours before your visit), schedule changes, and cancellation notices.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Message Frequency:</strong> Up to 5 messages per booking, depending on appointment activity.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Message and data rates may apply.</strong> Contact your wireless carrier for details about your plan.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Opt-Out:</strong> Reply <strong style={{ color: 'rgba(130,220,170,.7)' }}>STOP</strong> to any message to stop receiving text messages. You may also email hello@vurium.com.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Help:</strong> Reply <strong style={{ color: 'rgba(130,220,170,.7)' }}>HELP</strong> to any message for assistance, or email hello@vurium.com.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>No Sharing:</strong> We will not sell, rent, or share your mobile phone number or SMS opt-in data with third parties for their marketing purposes.</li>
            <li>Consent to receive SMS is <strong style={{ color: 'rgba(255,255,255,.55)' }}>not a condition</strong> of purchasing any service or making a booking.</li>
          </ul>
        </div>

        {/* 4. How We Share Your Information */}
        <h2 style={heading}>4. How We Share Your Information</h2>
        <p style={text}>We do not sell your personal data. We may share information with:</p>
        <ul style={list}>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Service Providers:</strong> Twilio (SMS delivery), Google Cloud (hosting and infrastructure), Stripe (payment processing) &mdash; only as necessary to provide our services.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Business Partners:</strong> The specific barbershop, salon, or service provider you book an appointment with receives your booking information to fulfill your appointment.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Legal Compliance:</strong> When required by law, subpoena, or legal process.</li>
        </ul>

        {/* 5. Data Retention */}
        <h2 style={heading}>5. Data Retention</h2>
        <ul style={list}>
          <li>Booking data is retained for up to 2 years for service continuity and business records.</li>
          <li>Phone numbers are retained while your relationship with the business is active.</li>
          <li>SMS consent records and messaging logs are retained for up to 5 years for compliance and audit purposes.</li>
          <li>You may request deletion at any time (see Your Rights below).</li>
        </ul>

        {/* 6. Your Rights */}
        <h2 style={heading}>6. Your Rights</h2>
        <p style={text}>
          You have the right to access, correct, or request deletion of your personal data. To exercise these rights, contact us at <a href="mailto:hello@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>hello@vurium.com</a>. We will respond within 30 days.
        </p>

        {/* 7. Security */}
        <h2 style={heading}>7. Security</h2>
        <p style={text}>
          We implement industry-standard security measures to protect your information, including encrypted data transmission (TLS/HTTPS), encrypted storage for phone numbers at rest, and access controls for our systems. However, no method of transmission or storage is 100% secure.
        </p>

        {/* 8. Changes */}
        <h2 style={heading}>8. Changes to This Policy</h2>
        <p style={text}>
          We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on this page with a new effective date. Continued use of our services after changes constitutes acceptance of the updated policy.
        </p>

        {/* 9. Contact */}
        <h2 style={heading}>9. Contact Us</h2>
        <p style={text}>
          If you have questions about this Privacy Policy or our data practices, contact us at:<br />
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
