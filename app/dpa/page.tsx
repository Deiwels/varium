'use client'

const heading: React.CSSProperties = { fontSize: 20, fontWeight: 600, color: 'rgba(130,150,220,.8)', marginBottom: 12, marginTop: 48 }
const text: React.CSSProperties = { fontSize: 15, fontWeight: 300, color: 'rgba(255,255,255,.45)', lineHeight: 1.8, marginBottom: 16 }
const list: React.CSSProperties = { ...text, paddingLeft: 24 }
const highlight: React.CSSProperties = { background: 'rgba(130,150,220,.04)', border: '1px solid rgba(130,150,220,.08)', borderRadius: 14, padding: '24px 28px', marginBottom: 24, marginTop: 16 }

export default function DpaPage() {
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
        <p className="label-glow" style={{ marginBottom: 12 }}>Legal</p>
        <h1 className="shimmer-text" style={{ fontSize: 'clamp(28px, 4.5vw, 42px)', fontWeight: 600, letterSpacing: '-.03em', marginBottom: 8 }}>
          Data Processing Agreement
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.25)', marginBottom: 48 }}>
          Effective Date: April 3, 2026 &middot; Last Updated: April 3, 2026
        </p>

        <p style={text}>
          This Data Processing Agreement (&quot;DPA&quot;) forms part of the agreement between Vurium Inc. (&quot;Processor&quot; or &quot;Vurium&quot;) and the business customer (&quot;Controller&quot; or &quot;Customer&quot;) who uses the VuriumBook platform. This DPA governs the processing of personal data by Vurium on behalf of the Customer in compliance with the EU General Data Protection Regulation (GDPR), UK GDPR, and other applicable data protection laws.
        </p>

        {/* 1. Definitions */}
        <h2 style={heading}>1. Definitions</h2>
        <ul style={list}>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>&quot;Personal Data&quot;</strong> means any information relating to an identified or identifiable natural person, as defined in GDPR Article 4(1).</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>&quot;Processing&quot;</strong> means any operation performed on Personal Data, including collection, storage, use, disclosure, and deletion.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>&quot;Data Subject&quot;</strong> means an identifiable person whose Personal Data is processed.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>&quot;Sub-processor&quot;</strong> means a third party engaged by Vurium to process Personal Data on behalf of the Customer.</li>
        </ul>

        {/* 2. Scope */}
        <h2 style={heading}>2. Scope and Purpose of Processing</h2>
        <div style={highlight}>
          <ul style={{ ...list, marginBottom: 0 }}>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Subject Matter:</strong> Provision of scheduling, booking management, client CRM, and appointment notifications.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Categories of Data Subjects:</strong> End-user clients of the Customer (people who book appointments).</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Types of Personal Data:</strong> Name, phone number, email address, booking details, payment references, SMS consent records.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Purpose:</strong> To provide the VuriumBook Service as described in the Terms of Service.</li>
            <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Duration:</strong> For the duration of the service agreement, plus any retention period required by law.</li>
          </ul>
        </div>

        {/* 3. Obligations of the Processor */}
        <h2 style={heading}>3. Processor Obligations</h2>
        <p style={text}>Vurium shall:</p>
        <ul style={list}>
          <li>Process Personal Data only on documented instructions from the Customer, unless required by law.</li>
          <li>Ensure that persons authorized to process Personal Data are bound by confidentiality obligations.</li>
          <li>Implement appropriate technical and organizational security measures, including encryption at rest and in transit, access controls, and regular security reviews.</li>
          <li>Not engage another processor (Sub-processor) without prior written authorization from the Customer. Vurium shall inform the Customer of any intended changes and provide the Customer with an opportunity to object.</li>
          <li>Assist the Customer in responding to Data Subject requests (access, rectification, erasure, portability, restriction, objection).</li>
          <li>Assist the Customer in ensuring compliance with data breach notification obligations (72-hour notification to supervisory authorities under GDPR).</li>
          <li>Delete or return all Personal Data upon termination of the service, at the Customer&apos;s choice, within 30 days.</li>
          <li>Make available all information necessary to demonstrate compliance with this DPA and allow for audits.</li>
        </ul>

        {/* 4. Sub-processors */}
        <h2 style={heading}>4. Sub-processors</h2>
        <p style={text}>Vurium currently uses the following Sub-processors:</p>
        <div style={{ overflowX: 'auto', marginBottom: 24 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, color: 'rgba(255,255,255,.45)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.1)' }}>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: 'rgba(255,255,255,.55)', fontWeight: 600 }}>Sub-processor</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: 'rgba(255,255,255,.55)', fontWeight: 600 }}>Purpose</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: 'rgba(255,255,255,.55)', fontWeight: 600 }}>Location</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                <td style={{ padding: '12px 16px' }}>Google Cloud Platform</td>
                <td style={{ padding: '12px 16px' }}>Cloud hosting, database (Firestore)</td>
                <td style={{ padding: '12px 16px' }}>United States</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                <td style={{ padding: '12px 16px' }}>Telnyx</td>
                <td style={{ padding: '12px 16px' }}>SMS delivery</td>
                <td style={{ padding: '12px 16px' }}>United States</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                <td style={{ padding: '12px 16px' }}>Stripe</td>
                <td style={{ padding: '12px 16px' }}>Payment processing</td>
                <td style={{ padding: '12px 16px' }}>United States</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p style={text}>
          Each Sub-processor is bound by data protection obligations no less protective than those in this DPA. The Customer will be notified of any changes to the Sub-processor list with at least 30 days&apos; advance notice.
        </p>

        {/* 5. International Transfers */}
        <h2 style={heading}>5. International Data Transfers</h2>
        <p style={text}>
          Personal Data may be transferred to and processed in the United States. For transfers from the EEA/UK, Vurium relies on the EU Standard Contractual Clauses (SCCs) as approved by the European Commission (Decision 2021/914). Where required, supplementary measures are implemented to ensure adequate protection.
        </p>

        {/* 6. Security Measures */}
        <h2 style={heading}>6. Security Measures</h2>
        <p style={text}>Vurium implements the following technical and organizational measures:</p>
        <ul style={list}>
          <li>Encryption of data in transit (TLS 1.2+) and at rest (AES-256 for phone numbers).</li>
          <li>Role-based access controls with least-privilege principles.</li>
          <li>Regular security reviews and vulnerability assessments.</li>
          <li>Secure development practices and code review processes.</li>
          <li>Incident response procedures with 72-hour breach notification capability.</li>
          <li>Automated backups with encryption.</li>
        </ul>

        {/* 7. Data Subject Rights */}
        <h2 style={heading}>7. Data Subject Rights</h2>
        <p style={text}>
          Vurium shall assist the Customer in fulfilling its obligations to respond to Data Subject requests under GDPR Articles 15&ndash;22, including rights of access, rectification, erasure, data portability, restriction of processing, and objection. Vurium will promptly notify the Customer if it receives a request directly from a Data Subject.
        </p>

        {/* 8. Data Breach */}
        <h2 style={heading}>8. Data Breach Notification</h2>
        <p style={text}>
          In the event of a Personal Data breach, Vurium shall notify the Customer without undue delay (and in any event within 48 hours) after becoming aware of the breach. The notification shall include: the nature of the breach, categories and approximate number of Data Subjects affected, likely consequences, and measures taken or proposed to address the breach.
        </p>

        {/* 9. Audit Rights */}
        <h2 style={heading}>9. Audit Rights</h2>
        <p style={text}>
          The Customer may audit Vurium&apos;s compliance with this DPA once per year, with at least 30 days&apos; written notice, during business hours, and subject to reasonable confidentiality obligations. Vurium shall cooperate and provide necessary access and information. Vurium may also provide relevant certifications or third-party audit reports as an alternative.
        </p>

        {/* 10. Term and Termination */}
        <h2 style={heading}>10. Term and Termination</h2>
        <p style={text}>
          This DPA shall remain in effect for the duration of the service agreement. Upon termination, Vurium shall, at the Customer&apos;s election, delete or return all Personal Data within 30 days and certify the deletion in writing, unless retention is required by applicable law.
        </p>

        {/* 11. Contact */}
        <h2 style={heading}>11. Contact</h2>
        <p style={text}>
          For DPA-related inquiries or to request a signed copy of this agreement, contact us at:<br />
          <a href="mailto:support@vurium.com" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>support@vurium.com</a>
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
