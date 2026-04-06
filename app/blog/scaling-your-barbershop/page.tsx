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
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(130,150,220,.6)', background: 'rgba(130,150,220,.06)', padding: '3px 10px', borderRadius: 6 }}>Business</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>8 min read</span>
        </div>

        <h1 className="shimmer-text" style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 600, letterSpacing: '-.03em', marginBottom: 8, lineHeight: 1.2 }}>
          How to Scale Your Barbershop from 1 Chair to 10
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.25)', marginBottom: 48 }}>March 15, 2026</p>

        <p style={text}>
          Growing a barbershop is one of the most rewarding — and challenging — journeys in the service industry. You started behind a single chair, built a loyal client base, and now you&apos;re wondering: how do I scale this without losing what makes my shop special? Here&apos;s a practical roadmap.
        </p>

        <h2 style={heading}>Know When You&apos;re Ready</h2>
        <p style={text}>
          The signals are clear: your calendar is booked solid 2+ weeks out, you&apos;re turning away walk-ins daily, and you have a waitlist of people who want to see you. If this sounds familiar, you&apos;re ready to grow.
        </p>
        <p style={text}>
          But scaling isn&apos;t just about adding chairs. It&apos;s about building systems that let your business run smoothly without you doing everything yourself.
        </p>

        <h2 style={heading}>Hire for Culture, Train for Skill</h2>
        <p style={text}>
          Your first hire is the most important one. Look for someone who shares your work ethic and values — cutting technique can be taught, but attitude can&apos;t. Many successful shop owners hire their first barber as a &quot;chair renter&quot; to test the fit before committing to a full partnership.
        </p>
        <ul style={list}>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Start with one:</strong> Don&apos;t jump from 1 to 5. Add one barber, get the operations right, then scale.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Define the role clearly:</strong> Commission split, schedule expectations, client ownership — put it in writing.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Invest in onboarding:</strong> Show them your standards, introduce them to your clients, and give them time to build their own book.</li>
        </ul>

        <h2 style={heading}>Systematize Everything</h2>
        <p style={text}>
          What works with one chair and one brain won&apos;t work with five. You need systems for:
        </p>
        <ul style={list}>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Scheduling:</strong> Use a booking platform (like VuriumBook) that handles multiple barbers, services, and availability automatically.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Payments:</strong> Track revenue per barber, commissions, tips, and daily cash. No more mental math.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Client communication:</strong> Automated reminders reduce no-shows by 40% on average. Set them and forget them.</li>
          <li><strong style={{ color: 'rgba(255,255,255,.55)' }}>Attendance:</strong> Know who clocked in, how many hours they worked, and what they earned — all in one place.</li>
        </ul>

        <h2 style={heading}>Protect Your Client Experience</h2>
        <p style={text}>
          Growth means more hands touching your brand. Set standards early: how should clients be greeted? What&apos;s the follow-up after a first visit? How do you handle complaints? Write it down so it&apos;s consistent across every chair.
        </p>
        <p style={text}>
          Track client satisfaction through your CRM. If you notice a drop in repeat bookings for a particular barber, address it before it becomes a trend.
        </p>

        <h2 style={heading}>Watch the Numbers</h2>
        <p style={text}>
          As you scale, gut feeling is no longer enough. Track these metrics weekly:
        </p>
        <ul style={list}>
          <li>Revenue per barber</li>
          <li>Booking utilization rate (booked hours vs. available hours)</li>
          <li>No-show rate</li>
          <li>New vs. returning client ratio</li>
          <li>Average ticket size</li>
        </ul>
        <p style={text}>
          These numbers tell you where to invest, who needs coaching, and when you&apos;re ready for the next chair.
        </p>

        <h2 style={heading}>The Bottom Line</h2>
        <p style={text}>
          Scaling a barbershop is about building a machine — a system of people, processes, and tools that delivers a great experience consistently. Start with the right technology, hire deliberately, and never lose sight of the craft that got you here.
        </p>

        <div style={{ marginTop: 48, padding: '28px 32px', borderRadius: 16, background: 'rgba(130,150,220,.03)', border: '1px solid rgba(130,150,220,.08)' }}>
          <p style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,.6)', marginBottom: 12 }}>Ready to scale your shop?</p>
          <a href="/vuriumbook" className="btn-primary" style={{ fontSize: 14 }}>Explore VuriumBook</a>
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
