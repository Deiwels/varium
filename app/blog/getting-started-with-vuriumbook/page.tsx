'use client'

const heading: React.CSSProperties = { fontSize: 20, fontWeight: 600, color: 'rgba(130,150,220,.8)', marginBottom: 12, marginTop: 48 }
const text: React.CSSProperties = { fontSize: 15, fontWeight: 300, color: 'rgba(255,255,255,.45)', lineHeight: 1.8, marginBottom: 16 }
const list: React.CSSProperties = { ...text, paddingLeft: 24 }

export default function BlogPost() {
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

      <main style={{ minHeight: '100vh', maxWidth: 720, margin: '0 auto', padding: 'clamp(100px, 12vh, 140px) 24px 80px', position: 'relative', zIndex: 2 }}>
        <a href="/blog" style={{ fontSize: 13, color: 'rgba(130,150,220,.6)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 32 }}>
          <span>&larr;</span> Back to Blog
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(130,150,220,.6)', background: 'rgba(130,150,220,.06)', padding: '3px 10px', borderRadius: 6 }}>Guide</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>6 min read</span>
        </div>

        <h1 className="shimmer-text" style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 600, letterSpacing: '-.03em', marginBottom: 8, lineHeight: 1.2 }}>
          Getting Started with VuriumBook: A Complete Setup Guide
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.25)', marginBottom: 48 }}>March 28, 2026</p>

        <p style={text}>
          Setting up your barbershop or salon on VuriumBook takes less than 15 minutes. This guide walks you through everything — from creating your workspace to accepting your first online booking. By the end, you&apos;ll have a fully operational booking system that your clients can use immediately.
        </p>

        <h2 style={heading}>1. Create Your Account</h2>
        <p style={text}>
          Head to vurium.com/signup and enter your business name, email address, and a password. That&apos;s it — no credit card required. You&apos;ll get instant access to a 14-day free trial with all features unlocked.
        </p>
        <p style={text}>
          Once you&apos;re in, you&apos;ll land on your Dashboard — the central hub for everything happening at your shop.
        </p>

        <h2 style={heading}>2. Set Up Your Workspace</h2>
        <p style={text}>
          Your workspace is your digital storefront. Go to Settings and configure the basics:
        </p>
        <ul style={list}>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Business hours:</strong> Set your opening and closing times for each day of the week.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Services:</strong> Add the services you offer (haircut, beard trim, fade, etc.) with duration and pricing.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Team members:</strong> Invite barbers or stylists to join your workspace. Each gets their own calendar and login.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Booking page:</strong> Customize your public booking URL (vurium.com/book/your-shop) with your logo and colors.</li>
        </ul>

        <h2 style={heading}>3. Configure Payments</h2>
        <p style={text}>
          VuriumBook integrates with Stripe for secure payment processing. Connect your Stripe account in the Payments settings to start accepting credit cards, Apple Pay, and Google Pay — both online and at the chair.
        </p>
        <p style={text}>
          You can also track cash payments, tips, and commissions directly in VuriumBook. No more spreadsheets.
        </p>

        <h2 style={heading}>4. Share Your Booking Link</h2>
        <p style={text}>
          Once your workspace is configured, share your booking link everywhere your clients are:
        </p>
        <ul style={list}>
          <li>Add it to your Instagram bio and Facebook page.</li>
          <li>Include it in your Google Business profile.</li>
          <li>Send it directly to regulars via text or WhatsApp.</li>
          <li>Add a &quot;Book Now&quot; button to your website.</li>
        </ul>
        <p style={text}>
          Clients can browse available time slots, pick their preferred barber, and book instantly — 24/7, no phone calls needed.
        </p>

        <h2 style={heading}>5. Manage Your Day</h2>
        <p style={text}>
          As bookings come in, your Calendar fills up automatically. You&apos;ll see each appointment with the client name, service, and assigned barber. VuriumBook sends automatic SMS reminders to reduce no-shows — a feature that pays for itself.
        </p>
        <p style={text}>
          At the end of the day, check your Dashboard for a quick snapshot: total bookings, revenue, and any upcoming appointments that need attention.
        </p>

        <h2 style={heading}>What&apos;s Next?</h2>
        <p style={text}>
          That&apos;s the basics covered. As you grow, explore features like client CRM (track visit history and preferences), team attendance tracking, membership programs, and detailed analytics. VuriumBook grows with your business.
        </p>

        <div style={{ marginTop: 48, padding: '28px 32px', borderRadius: 16, background: 'rgba(130,150,220,.03)', border: '1px solid rgba(130,150,220,.08)' }}>
          <p style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,.6)', marginBottom: 12 }}>Ready to get started?</p>
          <a href="/signup" className="btn-primary" style={{ fontSize: 14 }}>Start Your Free Trial</a>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,.05)', position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 24px 20px' }}>
          <div style={{ borderTop: '1px solid rgba(255,255,255,.04)', paddingTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>&copy; 2026 Vurium&trade;. All rights reserved.</span>
            <div style={{ display: 'flex', gap: 20 }}>
              <a href="/privacy" style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>Privacy</a>
              <a href="/terms" style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>Terms</a>
              <a href="/support" style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>Support</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}
