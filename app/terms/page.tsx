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
          Terms of Service
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.25)', marginBottom: 48 }}>
          Effective Date: April 1, 2026 &middot; Last Updated: April 3, 2026
        </p>

        {/* 1. Acceptance */}
        <h2 style={heading}>1. Acceptance of Terms</h2>
        <p style={text}>
          By accessing or using VuriumBook&trade; (the &quot;Service&quot;), operated by Vurium Inc. (&quot;Vurium,&quot; &quot;we,&quot; &quot;us&quot;), you agree to be bound by these Terms of Service and our <a href="/privacy" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Privacy Policy</a>. If you do not agree, do not use the Service.
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
        <h2 id="sms" style={heading}>4. SMS / Text Messaging Program Terms</h2>
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

        <h3 style={{ ...heading, fontSize: 16, marginTop: 24 }}>4.2 Account Verification &amp; Security Codes (2FA)</h3>
        <div style={highlight}>
          <p style={{ ...text, marginBottom: 14 }}>
            VuriumBook&trade; may send one-time SMS messages to help verify and secure business-owner accounts (for example, verification codes during signup, login codes, and password reset codes). These messages are transactional and security-related.
          </p>
          <ul style={{ ...list, marginBottom: 0 }}>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Message Frequency:</strong> Varies based on your requests, typically 1&ndash;2 messages per verification attempt.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Message and data rates may apply.</strong></li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Opt-Out:</strong> Reply <strong style={{ color: 'rgba(130,220,170,.7)' }}>STOP</strong> to opt out of SMS security codes. If you opt out, you may need to use an alternative verification method or contact support.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Help:</strong> Reply <strong style={{ color: 'rgba(130,220,170,.7)' }}>HELP</strong> for assistance, or contact support@vurium.com.</li>
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
          The VuriumBook&trade; platform, including its design, code, trademarks, and branding, is owned by Vurium&trade; Inc. and protected by intellectual property laws. You retain ownership of all data you enter into the Service. By using the Service, you grant us a limited, non-exclusive license to process your data solely as necessary to provide the Service.
        </p>

        {/* 9. Right of Withdrawal (EU/UK Consumers) */}
        <h2 style={heading}>9. Right of Withdrawal (EU/UK Consumers)</h2>
        <div style={highlight}>
          <p style={{ ...text, marginBottom: 14 }}>
            If you are a consumer in the European Economic Area (EEA) or the United Kingdom, you have the right to withdraw from a distance contract within <strong style={{ color: 'rgba(255,255,255,.55)' }}>14 days</strong> without giving any reason, in accordance with the Consumer Rights Directive (2011/83/EU).
          </p>
          <ul style={{ ...list, marginBottom: 0 }}>
            <li>The withdrawal period expires 14 days after the day the contract is concluded (i.e., when you complete a booking or subscription).</li>
            <li>To exercise the right of withdrawal, you must inform us by a clear statement (e.g., email to <a href="mailto:support@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>support@vurium.com</a>) of your decision to withdraw.</li>
            <li>If you request that the service begins during the withdrawal period (e.g., an appointment is performed), you acknowledge that you will lose the right of withdrawal once the service has been fully performed.</li>
            <li>For subscriptions, you may withdraw within 14 days of the initial purchase. After the withdrawal period, you may cancel at any time as described in Section 6.</li>
            <li>Refunds will be issued within 14 days of receiving your withdrawal notice, using the same payment method as the original transaction.</li>
          </ul>
        </div>

        {/* 10. Limitation of Liability */}
        <h2 style={heading}>10. Limitation of Liability</h2>
        <p style={text}>
          To the fullest extent permitted by applicable law, Vurium shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, revenue, data, or business opportunities, arising out of or related to your use of the Service. Our total aggregate liability for any claims arising under these Terms shall not exceed the amount you paid to Vurium in the 12 months preceding the claim. Nothing in these Terms excludes or limits liability that cannot be excluded under applicable law (including liability for death, personal injury, or fraud).
        </p>

        {/* 11. Indemnification */}
        <h2 style={heading}>11. Indemnification</h2>
        <p style={text}>
          You agree to indemnify, defend, and hold harmless Vurium Inc., its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or related to: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any third-party rights; or (d) any content or data you submit through the Service. This indemnification obligation will survive termination of these Terms and your use of the Service.
        </p>

        {/* 12. Dispute Resolution */}
        <h2 style={heading}>12. Dispute Resolution</h2>
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

        {/* 13. Service Modifications */}
        <h2 style={heading}>13. Service Modifications</h2>
        <p style={text}>
          We reserve the right to modify, suspend, or discontinue any part of the Service at any time. We will provide at least 30 days&apos; notice for material changes that significantly affect your use of the Service.
        </p>

        {/* 14. Termination */}
        <h2 style={heading}>14. Termination</h2>
        <ul style={list}>
          <li>Either party may terminate the agreement at any time with written notice.</li>
          <li>Upon termination, your data will be available for export for 30 days, after which it may be deleted.</li>
          <li>We may terminate or suspend your account immediately for material violations of these Terms.</li>
          <li>Sections that by their nature should survive termination (Limitation of Liability, Indemnification, Dispute Resolution) will survive.</li>
        </ul>

        {/* 15. Force Majeure */}
        <h2 style={heading}>15. Force Majeure</h2>
        <p style={text}>
          Neither party shall be liable for any failure or delay in performing its obligations under these Terms where such failure or delay arises from causes beyond the reasonable control of the affected party, including but not limited to: natural disasters, pandemics, war, terrorism, government action, power or telecommunications failure, cyberattacks, or acts of third-party service providers. The affected party must notify the other party within 5 business days and use commercially reasonable efforts to resume performance as soon as practicable.
        </p>

        {/* 16. Product Safety (EU Directive 2024/2853) */}
        <h2 style={heading}>16. Product Safety (EU)</h2>
        <p style={text}>
          For customers in the European Union: pursuant to Directive (EU) 2024/2853 (Product Liability Directive), which extends strict liability to digital products effective December 9, 2026, Vurium acknowledges that the VuriumBook software constitutes a &quot;product&quot; within the meaning of the Directive. Vurium maintains a product safety process to identify, assess, and remediate software defects that could cause harm. If you believe you have experienced harm caused by a defect in the Service, please contact us at <a href="mailto:support@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>support@vurium.com</a>. Nothing in these Terms limits or excludes liability that cannot be excluded under EU product liability law.
        </p>

        {/* 17. Digital Content Conformity (EU Directive 2019/770) */}
        <h2 style={heading}>17. Digital Content Conformity (EU)</h2>
        <p style={text}>
          For consumers in the European Union: under Directive (EU) 2019/770 (Digital Content Directive), Vurium guarantees that the Service shall:
        </p>
        <ul style={list}>
          <li>Conform to the description, quantity, and quality specified in these Terms and our documentation.</li>
          <li>Be fit for the purposes for which digital content of the same type would normally be used.</li>
          <li>Be supplied with all accessories, instructions, and updates as reasonably expected.</li>
          <li>Be updated as necessary to maintain conformity during the subscription period, including security updates.</li>
        </ul>
        <p style={text}>
          If the Service does not conform, you are entitled to have the non-conformity remedied free of charge within a reasonable time. If the non-conformity cannot be remedied, you may be entitled to a proportionate price reduction or termination of the contract. These rights apply for a minimum of 2 years from initial supply of the Service and do not affect any other statutory rights you may have.
        </p>

        {/* 18. Governing Law */}
        <h2 style={heading}>18. Governing Law</h2>
        <p style={text}>
          These Terms shall be governed by and construed in accordance with the laws of the State of Illinois, United States, without regard to conflict of law principles. For EEA/UK residents, mandatory consumer protection laws of your country of residence shall also apply where required.
        </p>

        {/* 19. Severability */}
        <h2 style={heading}>19. Severability</h2>
        <p style={text}>
          If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect. The invalid provision shall be modified to the minimum extent necessary to make it valid and enforceable.
        </p>

        {/* 20. Entire Agreement */}
        <h2 style={heading}>20. Entire Agreement</h2>
        <p style={text}>
          These Terms, together with the <a href="/privacy" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Privacy Policy</a>, <a href="/cookies" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Cookie Policy</a>, and <a href="/dpa" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Data Processing Agreement</a> (where applicable), constitute the entire agreement between you and Vurium regarding the use of the Service.
        </p>

        {/* 21. Changes */}
        <h2 style={heading}>21. Changes to These Terms</h2>
        <p style={text}>
          We may update these Terms from time to time. We will notify you of material changes by posting the updated Terms on this page and, where required, by email with at least 30 days&apos; notice. Continued use of the Service after changes constitutes acceptance.
        </p>

        {/* 22. Contact */}
        <h2 style={heading}>22. Contact Us</h2>
        <p style={text}>
          Questions about these Terms? Contact us at:<br />
          <a href="mailto:support@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>support@vurium.com</a> &middot; <a href="/support" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>vurium.com/support</a>
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
