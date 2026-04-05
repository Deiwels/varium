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
          <li><a href="/support">Support</a></li>
        </ul>
      </nav>

      <main style={{ minHeight: '100vh', maxWidth: 800, margin: '0 auto', padding: 'clamp(100px, 12vh, 140px) 24px 80px', position: 'relative', zIndex: 2 }}>
        <p className="label-glow" style={{ marginBottom: 12 }}>Legal</p>
        <h1 className="shimmer-text" style={{ fontSize: 'clamp(28px, 4.5vw, 42px)', fontWeight: 600, letterSpacing: '-.03em', marginBottom: 8 }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.25)', marginBottom: 48 }}>
          Effective Date: April 1, 2026 &middot; Last Updated: April 3, 2026
        </p>

        {/* Introduction */}
        <p style={text}>
          Vurium Inc. (&quot;Vurium,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the VuriumBook&trade; platform &mdash; a scheduling and business management service for barbershops, salons, and service businesses. This Privacy Policy describes how we collect, use, store, and protect your personal information when you use our website and services. This policy applies to all users worldwide, including residents of the European Economic Area (EEA), United Kingdom, and California.
        </p>

        {/* 1. Information We Collect */}
        <h2 style={heading}>1. Information We Collect</h2>
        <p style={text}>We may collect the following types of information:</p>
        <ul style={list}>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Personal Information:</strong> Name, mobile phone number, and email address (when provided during booking or account creation).</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Booking Data:</strong> Requested services, appointment date/time, barber or provider preference, and any notes you provide.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Technical Data:</strong> IP address, browser user agent, and device information &mdash; collected for consent record-keeping, security, and analytics.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Payment Data:</strong> Processed securely by our third-party payment provider (Stripe). We do not store credit card numbers on our servers.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Cookies:</strong> We use a strictly necessary authentication cookie to keep you signed in. See our <a href="/cookies" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Cookie Policy</a> for details.</li>
        </ul>

        {/* 2. Lawful Basis for Processing (GDPR) */}
        <h2 style={heading}>2. Lawful Basis for Processing (GDPR)</h2>
        <p style={text}>Under the EU General Data Protection Regulation (GDPR), we process your personal data on the following legal bases:</p>
        <ul style={list}>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Contract Performance:</strong> Processing your booking data and account information is necessary to provide the scheduling service you requested.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Consent:</strong> SMS notifications are sent only with your explicit opt-in consent, which you may withdraw at any time by replying STOP.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Legitimate Interest:</strong> We process technical data (IP address, device info) for security, fraud prevention, and service improvement, balanced against your privacy rights.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Legal Obligation:</strong> We retain certain records (e.g., SMS consent logs) to comply with regulatory requirements.</li>
        </ul>

        {/* 3. How We Use Your Information */}
        <h2 style={heading}>3. How We Use Your Information</h2>
        <ul style={list}>
          <li>To provide and manage appointment booking services.</li>
          <li>To send transactional SMS/text messages related to your appointments (confirmations, reminders, schedule changes, and cancellations).</li>
          <li>To communicate about your account or respond to inquiries.</li>
          <li>To improve our services through aggregated, anonymized analytics.</li>
          <li>To detect, prevent, and address fraud, abuse, and security issues.</li>
        </ul>

        {/* 4. SMS / Text Messaging Disclosure */}
        <h2 style={heading}>4. SMS / Text Messaging Disclosure</h2>
        <div style={highlight}>
          <p style={{ ...text, marginBottom: 14 }}>
            By providing your phone number and checking the SMS consent box at https://vurium.com/book/[workspace] during the online booking process, you consent to receive text messages from Vurium and the business you are booking with, related to your appointments.
          </p>
          <ul style={{ ...list, marginBottom: 0 }}>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Message Types:</strong> Appointment confirmations, reminders (24 hours and 2 hours before your visit), schedule changes, and cancellation notices.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Message Frequency:</strong> Up to 5 messages per booking, depending on appointment activity.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Message and data rates may apply.</strong> Contact your wireless carrier for details about your plan.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Opt-Out:</strong> Reply <strong style={{ color: 'rgba(130,220,170,.7)' }}>STOP</strong> to any message to opt out. No further messages will be sent. You may also email support@vurium.com to unsubscribe.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Help:</strong> Reply <strong style={{ color: 'rgba(130,220,170,.7)' }}>HELP</strong> to any message for assistance, or email support@vurium.com.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>No Sharing:</strong> We will not sell, rent, or share your mobile phone number or SMS opt-in data with third parties for their marketing purposes.</li>
            <li>Consent to receive SMS is <strong style={{ color: 'rgba(255,255,255,.55)' }}>not a condition</strong> of purchasing any service or making a booking.</li>
          </ul>
        </div>

        {/* 5. How We Share Your Information */}
        <h2 style={heading}>5. How We Share Your Information</h2>
        <p style={text}>We do not sell your personal data. We may share information with:</p>
        <ul style={list}>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Service Providers (Data Processors):</strong> Telnyx (SMS delivery, US), Google Cloud (hosting and infrastructure, US), Stripe (payment processing, US) &mdash; only as necessary to provide our services. Each provider is bound by a Data Processing Agreement.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Business Partners:</strong> The specific barbershop, salon, or service provider you book an appointment with receives your booking information to fulfill your appointment. These businesses act as independent data controllers for the data they receive.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Legal Compliance:</strong> When required by law, subpoena, or legal process.</li>
        </ul>

        {/* 6. International Data Transfers */}
        <h2 style={heading}>6. International Data Transfers</h2>
        <p style={text}>
          Vurium is based in the United States. If you are located outside the US (including in the EEA or UK), your personal data will be transferred to and processed in the United States. We rely on Standard Contractual Clauses (SCCs) approved by the European Commission and other appropriate safeguards to ensure your data is protected in accordance with GDPR requirements. By using our service, you acknowledge this transfer.
        </p>

        {/* 7. Data Retention */}
        <h2 style={heading}>7. Data Retention</h2>
        <ul style={list}>
          <li>Booking data is retained for up to 2 years for service continuity and business records.</li>
          <li>Phone numbers are retained while your relationship with the business is active.</li>
          <li>SMS consent records and messaging logs are retained for up to 5 years for compliance and audit purposes.</li>
          <li>Account data is retained until you request deletion or close your account.</li>
          <li>You may request deletion at any time (see Your Rights below).</li>
        </ul>

        {/* 8. Your Rights */}
        <h2 style={heading}>8. Your Rights</h2>
        <p style={text}>Depending on your location, you may have the following rights regarding your personal data:</p>

        <h3 style={{ ...heading, fontSize: 16, marginTop: 24 }}>For All Users</h3>
        <ul style={list}>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Access:</strong> Request a copy of the personal data we hold about you.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Correction:</strong> Request correction of inaccurate or incomplete data.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Deletion:</strong> Request deletion of your personal data.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Data Portability:</strong> Request an export of your data in a portable format.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Withdraw Consent:</strong> Withdraw consent for SMS messaging at any time by replying STOP.</li>
        </ul>

        <h3 style={{ ...heading, fontSize: 16, marginTop: 24 }}>Additional Rights for EEA/UK Residents (GDPR)</h3>
        <ul style={list}>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Restriction:</strong> Request restriction of processing of your personal data.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Objection:</strong> Object to processing based on legitimate interest.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Supervisory Authority:</strong> You have the right to lodge a complaint with your local data protection authority. For example: the Information Commissioner&apos;s Office (ICO) in the UK, the CNIL in France, the BfDI in Germany, or the relevant DPA in your EU/EEA member state. A full list is available at <a href="https://edpb.europa.eu/about-edpb/about-edpb/members_en" target="_blank" rel="noopener" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>edpb.europa.eu</a>.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Data Processing Agreement:</strong> Business customers can request a <a href="/dpa" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Data Processing Agreement (DPA)</a>.</li>
        </ul>

        <h3 style={{ ...heading, fontSize: 16, marginTop: 24 }}>Additional Rights for California Residents (CCPA/CPRA)</h3>
        <ul style={list}>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Right to Know:</strong> You may request the categories and specific pieces of personal information we have collected about you in the past 12 months.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Right to Delete:</strong> You may request deletion of your personal information, subject to certain exceptions.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Right to Opt-Out of Sale:</strong> We do not sell your personal information. We do not share your personal information for cross-context behavioral advertising.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising your privacy rights.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Authorized Agents:</strong> You may designate an authorized agent to submit requests on your behalf.</li>
        </ul>

        <p style={text}>
          To exercise any of these rights, contact us at <a href="mailto:support@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>support@vurium.com</a>. We will verify your identity and respond within 30 days (or 45 days for complex requests, with notice).
        </p>

        {/* 9. Do Not Sell My Personal Information */}
        <h2 style={heading}>9. Do Not Sell or Share My Personal Information</h2>
        <p style={text}>
          Vurium does <strong style={{ color: 'rgba(255,255,255,.55)' }}>not sell</strong> your personal information to third parties. We do <strong style={{ color: 'rgba(255,255,255,.55)' }}>not share</strong> your personal information for cross-context behavioral advertising. If you have questions or concerns, contact us at <a href="mailto:support@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>support@vurium.com</a>.
        </p>

        {/* 10. Children's Privacy */}
        <h2 style={heading}>10. Children&apos;s Privacy</h2>
        <p style={text}>
          Our Service is not directed to children under 16 years of age (or under 13 in the United States under COPPA). We do not knowingly collect personal information from children. If we learn that we have collected personal data from a child without parental consent, we will delete that information promptly. If you believe a child has provided us with personal data, please contact us at <a href="mailto:support@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>support@vurium.com</a>.
        </p>

        {/* 11. Security */}
        <h2 style={heading}>11. Security</h2>
        <p style={text}>
          We implement industry-standard security measures to protect your information, including encrypted data transmission (TLS/HTTPS), encrypted storage for phone numbers at rest, and access controls for our systems. However, no method of transmission or storage is 100% secure.
        </p>

        {/* 12. Data Breach Notification */}
        <h2 style={heading}>12. Data Breach Notification</h2>
        <p style={text}>
          In the event of a personal data breach that is likely to result in a risk to your rights and freedoms, we will notify the relevant supervisory authority within 72 hours of becoming aware of the breach, as required by GDPR. If the breach is likely to result in a high risk to you, we will also notify you directly without undue delay. For US-based users, we will comply with applicable state breach notification laws.
        </p>

        {/* 13. Changes */}
        <h2 style={heading}>13. Changes to This Policy</h2>
        <p style={text}>
          We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on this page with a new effective date. For material changes affecting your rights, we will provide at least 30 days&apos; notice. Continued use of our services after changes constitutes acceptance of the updated policy.
        </p>

        {/* 14. Contact */}
        <h2 style={heading}>14. Contact Us</h2>
        <p style={text}>
          If you have questions about this Privacy Policy, our data practices, or wish to exercise your privacy rights, contact us at:
        </p>
        <div style={highlight}>
          <p style={{ ...text, marginBottom: 0 }}>
            Vurium Inc.<br />
            1142 W Lake Cook Rd, 60089<br />
            Buffalo Grove, IL, United States<br />
            Email: <a href="mailto:support@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>support@vurium.com</a><br />
            Phone: <a href="tel:+18476301884" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>(847) 630-1884</a><br />
            Privacy inquiries: <a href="mailto:support@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>support@vurium.com</a><br />
            Support: <a href="/support" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>vurium.com/support</a>
          </p>
        </div>
        <p style={text}>
          Vurium has not appointed a formal Data Protection Officer (DPO) as the nature and scale of our processing does not require one under GDPR Article 37. For all privacy-related inquiries, please contact us using the details above.
        </p>
      </main>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,.05)', padding: '20px clamp(20px, 4vw, 48px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2, flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>&copy; 2026 Vurium&trade;. All rights reserved.</span>
        <div style={{ display: 'flex', gap: 20 }}>
          <a href="/privacy" style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>Privacy</a>
          <a href="/terms" style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>Terms</a>
          <a href="/cookies" style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>Cookies</a>
          <a href="/dpa" style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>DPA</a>
          <a href="/support" style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>Support</a>
        </div>
      </footer>
    </>
  )
}
