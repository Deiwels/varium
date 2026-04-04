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
          <li><a href="/support">Support</a></li>
        </ul>
      </nav>

      <main style={{ minHeight: '100vh', maxWidth: 800, margin: '0 auto', padding: 'clamp(100px, 12vh, 140px) 24px 80px', position: 'relative', zIndex: 2 }}>
        <p className="label-glow" style={{ marginBottom: 12 }}>Legal</p>
        <h1 className="shimmer-text" style={{ fontSize: 'clamp(28px, 4.5vw, 42px)', fontWeight: 600, letterSpacing: '-.03em', marginBottom: 8 }}>
          Terms of Service
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.25)', marginBottom: 48 }}>
          Effective Date: April 1, 2026 &middot; Last Updated: April 3, 2026
        </p>

        {/* 1. Acceptance */}
        <h2 style={heading}>1. Acceptance of Terms</h2>
        <p style={text}>
          By accessing or using VuriumBook (the &quot;Service&quot;), operated by Vurium Inc. (&quot;Vurium,&quot; &quot;we,&quot; &quot;us&quot;), you agree to be bound by these Terms of Service and our <a href="/privacy" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Privacy Policy</a>. If you do not agree, do not use the Service.
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
          <li>You must be at least 16 years old (or 13 in the US) to use the Service.</li>
          <li>You are responsible for maintaining the security of your account credentials.</li>
          <li>You must provide accurate and complete information during registration.</li>
          <li>You are responsible for all activity that occurs under your account.</li>
          <li>You must notify us immediately of any unauthorized use of your account.</li>
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
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Opt-Out:</strong> Reply <strong style={{ color: 'rgba(130,220,170,.7)' }}>STOP</strong> to any message to opt out. No further messages will be sent. Your booking will remain active.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Help:</strong> Reply <strong style={{ color: 'rgba(130,220,170,.7)' }}>HELP</strong> for assistance, or email support@vurium.com.</li>
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
          <li>Upload malicious code, viruses, or harmful content.</li>
          <li>Impersonate another person or entity.</li>
        </ul>

        {/* 6. Payments */}
        <h2 style={heading}>6. Subscription &amp; Payment Terms</h2>
        <ul style={list}>
          <li>Business subscriptions are billed monthly according to your selected plan.</li>
          <li>Payments are processed securely through Stripe. Vurium does not store credit card information.</li>
          <li>All fees are stated in US Dollars unless otherwise indicated.</li>
          <li>You may cancel your subscription at any time. Cancellation takes effect at the end of the current billing period.</li>
          <li>Refunds are not provided for partial billing periods unless required by applicable law.</li>
          <li>We reserve the right to change pricing with 30 days&apos; advance notice.</li>
        </ul>

        {/* 7. Service Level */}
        <h2 style={heading}>7. Service Availability</h2>
        <p style={text}>
          We strive to maintain high availability of the Service. While we target 99.9% uptime, the Service is provided on an &quot;as available&quot; basis and we do not guarantee uninterrupted access. Scheduled maintenance will be communicated in advance when possible. Current service status is available at <a href="https://status.vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>status.vurium.com</a>.
        </p>

        {/* 8. Intellectual Property */}
        <h2 style={heading}>8. Intellectual Property</h2>
        <p style={text}>
          The VuriumBook platform, including its design, code, trademarks, and branding, is owned by Vurium Inc. and protected by intellectual property laws. You retain ownership of all data you enter into the Service. By using the Service, you grant us a limited, non-exclusive license to process your data solely as necessary to provide the Service.
        </p>

        {/* 9. Limitation of Liability */}
        <h2 style={heading}>9. Limitation of Liability</h2>
        <p style={text}>
          To the fullest extent permitted by applicable law, Vurium shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, revenue, data, or business opportunities, arising out of or related to your use of the Service. Our total aggregate liability for any claims arising under these Terms shall not exceed the amount you paid to Vurium in the 12 months preceding the claim. Nothing in these Terms excludes or limits liability that cannot be excluded under applicable law (including liability for death, personal injury, or fraud).
        </p>

        {/* 10. Indemnification */}
        <h2 style={heading}>10. Indemnification</h2>
        <p style={text}>
          You agree to indemnify, defend, and hold harmless Vurium Inc., its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or related to: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any third-party rights; or (d) any content or data you submit through the Service. This indemnification obligation will survive termination of these Terms and your use of the Service.
        </p>

        {/* 11. Dispute Resolution */}
        <h2 style={heading}>11. Dispute Resolution</h2>
        <p style={text}>
          <strong style={{ color: 'rgba(255,255,255,.55)' }}>Informal Resolution:</strong> Before filing any formal proceeding, you agree to contact us at <a href="mailto:support@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>support@vurium.com</a> and attempt to resolve the dispute informally for at least 30 days.
        </p>
        <p style={text}>
          <strong style={{ color: 'rgba(255,255,255,.55)' }}>Arbitration:</strong> If informal resolution fails, any dispute arising from these Terms or your use of the Service shall be resolved through binding arbitration administered by the American Arbitration Association (AAA) under its Commercial Arbitration Rules. The arbitration shall take place in Chicago, Illinois. The arbitrator&apos;s award shall be final and binding.
        </p>
        <p style={text}>
          <strong style={{ color: 'rgba(255,255,255,.55)' }}>Class Action Waiver:</strong> You agree that any dispute resolution proceedings will be conducted only on an individual basis and not in a class, consolidated, or representative action.
        </p>
        <p style={text}>
          <strong style={{ color: 'rgba(255,255,255,.55)' }}>Exceptions:</strong> Either party may seek injunctive relief in any court of competent jurisdiction. EU/EEA residents retain the right to bring claims before their local courts and are not bound by the arbitration clause.
        </p>

        {/* 12. Service Modifications */}
        <h2 style={heading}>12. Service Modifications</h2>
        <p style={text}>
          We reserve the right to modify, suspend, or discontinue any part of the Service at any time. We will provide at least 30 days&apos; notice for material changes that significantly affect your use of the Service.
        </p>

        {/* 13. Termination */}
        <h2 style={heading}>13. Termination</h2>
        <ul style={list}>
          <li>Either party may terminate the agreement at any time with written notice.</li>
          <li>Upon termination, your data will be available for export for 30 days, after which it may be deleted.</li>
          <li>We may terminate or suspend your account immediately for material violations of these Terms.</li>
          <li>Sections that by their nature should survive termination (Limitation of Liability, Indemnification, Dispute Resolution) will survive.</li>
        </ul>

        {/* 14. Governing Law */}
        <h2 style={heading}>14. Governing Law</h2>
        <p style={text}>
          These Terms shall be governed by and construed in accordance with the laws of the State of Illinois, United States, without regard to conflict of law principles. For EEA/UK residents, mandatory consumer protection laws of your country of residence shall also apply where required.
        </p>

        {/* 15. Severability */}
        <h2 style={heading}>15. Severability</h2>
        <p style={text}>
          If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect. The invalid provision shall be modified to the minimum extent necessary to make it valid and enforceable.
        </p>

        {/* 16. Entire Agreement */}
        <h2 style={heading}>16. Entire Agreement</h2>
        <p style={text}>
          These Terms, together with the <a href="/privacy" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Privacy Policy</a>, <a href="/cookies" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Cookie Policy</a>, and <a href="/dpa" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Data Processing Agreement</a> (where applicable), constitute the entire agreement between you and Vurium regarding the use of the Service.
        </p>

        {/* 17. Changes */}
        <h2 style={heading}>17. Changes to These Terms</h2>
        <p style={text}>
          We may update these Terms from time to time. We will notify you of material changes by posting the updated Terms on this page and, where required, by email with at least 30 days&apos; notice. Continued use of the Service after changes constitutes acceptance.
        </p>

        {/* 18. Contact */}
        <h2 style={heading}>18. Contact Us</h2>
        <p style={text}>
          Questions about these Terms? Contact us at:<br />
          <a href="mailto:support@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>support@vurium.com</a> &middot; <a href="/support" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>vurium.com/support</a>
        </p>
      </main>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,.05)', padding: '20px clamp(20px, 4vw, 48px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2, flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>&copy; 2026 Vurium. All rights reserved.</span>
        <div style={{ display: 'flex', gap: 20 }}>
          <a href="/privacy" style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>Privacy</a>
          <a href="/terms" style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>Terms</a>
          <a href="/cookies" style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>Cookies</a>
          <a href="/dpa" style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>DPA</a>
        </div>
      </footer>
    </>
  )
}
