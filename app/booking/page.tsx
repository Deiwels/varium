'use client'
import { useEffect, useRef, useState } from 'react'

const DEMO_SERVICES = [
  { id: '1', name: 'Classic Haircut', duration: 30, price: 35, color: 'rgba(130,150,220,.5)' },
  { id: '2', name: 'Haircut + Beard', duration: 45, price: 50, color: 'rgba(130,220,170,.5)' },
  { id: '3', name: 'Premium Styling', duration: 60, price: 75, color: 'rgba(220,170,100,.5)' },
  { id: '4', name: 'Kids Haircut', duration: 20, price: 25, color: 'rgba(220,130,160,.5)' },
  { id: '5', name: 'Beard Trim', duration: 15, price: 20, color: 'rgba(130,200,220,.5)' },
]

const DEMO_BARBERS = [
  { id: '1', name: 'Alex Rivera', level: 'Senior Barber', avatar: 'AR' },
  { id: '2', name: 'Jordan Lee', level: 'Master Barber', avatar: 'JL' },
  { id: '3', name: 'Sam Parker', level: 'Stylist', avatar: 'SP' },
]

function generateSlots() {
  const slots: string[] = []
  for (let h = 9; h <= 19; h++) {
    for (const m of [0, 30]) {
      if (h === 19 && m === 30) continue
      const t = `${h > 12 ? h - 12 : h}:${m === 0 ? '00' : '30'} ${h >= 12 ? 'PM' : 'AM'}`
      slots.push(t)
    }
  }
  // Randomly remove some slots to simulate busy schedule
  return slots.filter(() => Math.random() > 0.3)
}

export default function BookingPage() {
  const spaceRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState(0)
  const [selectedService, setSelectedService] = useState<typeof DEMO_SERVICES[0] | null>(null)
  const [selectedBarber, setSelectedBarber] = useState<typeof DEMO_BARBERS[0] | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [booked, setBooked] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let tx = 0, ty = 0, cx = 0, cy = 0, raf: number
    function onMouse(e: MouseEvent) {
      tx = (e.clientX / window.innerWidth - 0.5) * 2
      ty = (e.clientY / window.innerHeight - 0.5) * 2
    }
    function tick() {
      cx += (tx - cx) * 0.04; cy += (ty - cy) * 0.04
      const far = document.querySelector('.stars-far') as HTMLElement
      const mid = document.querySelector('.stars-mid') as HTMLElement
      const near = document.querySelector('.stars-near') as HTMLElement
      if (far) far.style.transform = `translate(${cx * 3}px, ${cy * 3}px)`
      if (mid) mid.style.transform = `translate(${cx * 7}px, ${cy * 7}px)`
      if (near) near.style.transform = `translate(${cx * 12}px, ${cy * 12}px)`
      raf = requestAnimationFrame(tick)
    }
    window.addEventListener('mousemove', onMouse, { passive: true })
    raf = requestAnimationFrame(tick)
    return () => { window.removeEventListener('mousemove', onMouse); cancelAnimationFrame(raf) }
  }, [])

  useEffect(() => {
    if (selectedDate) setSlots(generateSlots())
  }, [selectedDate])

  function handleBook() {
    setLoading(true)
    setTimeout(() => { setLoading(false); setBooked(true); setStep(4) }, 1200)
  }

  function resetBooking() {
    setStep(0); setSelectedService(null); setSelectedBarber(null)
    setSelectedDate(''); setSelectedSlot(''); setClientName(''); setClientPhone('')
    setBooked(false); setSlots([])
  }

  function getDateOptions() {
    const dates: { key: string; label: string; day: string }[] = []
    const now = new Date()
    for (let i = 0; i < 10; i++) {
      const d = new Date(now.getTime() + i * 86400000)
      const key = d.toISOString().slice(0, 10)
      const day = d.toLocaleDateString('en-US', { weekday: 'short' })
      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      dates.push({ key, label, day: i <= 1 ? '' : day })
    }
    return dates
  }

  const stepLabels = ['Service', 'Barber', 'Date & Time', 'Details', 'Done']

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)',
    background: 'rgba(255,255,255,.04)', color: '#fff', fontSize: 15, outline: 'none',
    fontFamily: 'inherit', transition: 'border-color .2s',
  }

  return (
    <>
      <div className="space-bg" ref={spaceRef}>
        <div className="stars-wrap stars-wrap-far"><div className="stars stars-far" /></div>
        <div className="stars-wrap stars-wrap-mid"><div className="stars stars-mid" /></div>
        <div className="stars-wrap stars-wrap-near"><div className="stars stars-near" /></div>
        <div className="shooting-star shooting-star-1" />
        <div className="shooting-star shooting-star-2" />
        <div className="nebula-layer" style={{ width: 800, height: 450, top: '6%', left: '-14%', background: 'rgba(30,45,110,.06)' }} />
        <div className="nebula-layer" style={{ width: 550, height: 300, top: '35%', right: '-10%', background: 'rgba(55,35,100,.04)', animationDelay: '.5s' }} />
      </div>
      <div className="noise-overlay" />

      <nav className="navbar">
        <a href="/" className="navbar-logo">
          <img src="/logo.jpg" alt="Vurium" />
          Vurium
        </a>
        <ul className="navbar-links">
          <li><a href="/vuriumbook">VuriumBook</a></li>
          <li><a href="/booking" style={{ color: 'rgba(255,255,255,.85)' }}>Live Demo</a></li>
          <li><a href="/#about">About</a></li>
        </ul>
      </nav>

      <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'clamp(100px, 12vh, 140px) 20px 60px', position: 'relative', zIndex: 2 }}>

        {/* Header */}
        <div className="fade-up" style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: 'rgba(130,220,170,.7)', display: 'inline-block' }} />
            <span className="label-glow" style={{ color: 'rgba(130,220,170,.8)' }}>Interactive Demo</span>
          </div>
          <h1 className="shimmer-text" style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 600, letterSpacing: '-.03em' }}>
            VuriumBook in Action
          </h1>
          <p className="fade-up fade-up-d1" style={{ fontSize: 'clamp(14px, 1.8vw, 16px)', fontWeight: 300, color: 'rgba(255,255,255,.35)', maxWidth: 520, margin: '16px auto 0', lineHeight: 1.6 }}>
            Experience the booking flow your clients will see. This is a live preview of the VuriumBook platform.
          </p>
        </div>

        {/* Demo badge */}
        <div className="fade-up fade-up-d2" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 999, background: 'rgba(130,150,220,.08)', border: '1px solid rgba(130,150,220,.15)', marginBottom: 40 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: 'rgba(130,220,170,.8)', animation: 'star-breathe 2s ease-in-out infinite alternate' }} />
          <span style={{ fontSize: 12, color: 'rgba(130,150,220,.7)', fontWeight: 500, letterSpacing: '.02em' }}>DEMO MODE — no real bookings are created</span>
        </div>

        {/* Progress Steps */}
        {!booked && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 36, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            {stepLabels.slice(0, 4).map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div onClick={() => { if (i < step) setStep(i) }} style={{
                  width: 32, height: 32, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 500, cursor: i < step ? 'pointer' : 'default',
                  background: i === step ? 'rgba(130,150,220,.2)' : i < step ? 'rgba(130,220,170,.12)' : 'rgba(255,255,255,.03)',
                  border: `1px solid ${i === step ? 'rgba(130,150,220,.3)' : i < step ? 'rgba(130,220,170,.2)' : 'rgba(255,255,255,.06)'}`,
                  color: i === step ? 'rgba(130,150,220,.9)' : i < step ? 'rgba(130,220,170,.7)' : 'rgba(255,255,255,.2)',
                  transition: 'all .3s',
                }}>
                  {i < step ? '\u2713' : i + 1}
                </div>
                {i < 3 && <div style={{ width: 24, height: 1, background: i < step ? 'rgba(130,220,170,.2)' : 'rgba(255,255,255,.06)' }} />}
              </div>
            ))}
          </div>
        )}

        {/* STEP 0: Services */}
        {step === 0 && (
          <div className="fade-up" style={{ maxWidth: 560, width: '100%' }}>
            <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 20, color: 'rgba(255,255,255,.7)' }}>Choose a service</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {DEMO_SERVICES.map(s => (
                <div key={s.id} onClick={() => { setSelectedService(s); setStep(1) }} className="glass-card" style={{
                  cursor: 'pointer', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  transition: 'all .25s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 3, height: 32, borderRadius: 2, background: s.color }} />
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: '#e8e8ed' }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginTop: 3 }}>{s.duration} min</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 600, color: 'rgba(255,255,255,.6)' }}>${s.price}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 1: Barbers */}
        {step === 1 && (
          <div className="fade-up" style={{ maxWidth: 560, width: '100%' }}>
            <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 20, color: 'rgba(255,255,255,.7)' }}>Choose your barber</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {DEMO_BARBERS.map(b => (
                <div key={b.id} onClick={() => { setSelectedBarber(b); setStep(2) }} className="glass-card" style={{
                  cursor: 'pointer', padding: '28px 16px', textAlign: 'center', transition: 'all .25s',
                }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 999, margin: '0 auto 14px',
                    background: 'linear-gradient(135deg, rgba(130,150,220,.25), rgba(130,220,170,.15))',
                    border: '2px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,.5)', letterSpacing: '.02em',
                  }}>{b.avatar}</div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: '#e8e8ed' }}>{b.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginTop: 4 }}>{b.level}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setStep(0)} style={{
              marginTop: 20, padding: '10px 20px', background: 'none', border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 10, color: 'rgba(255,255,255,.35)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
            }}>Back</button>
          </div>
        )}

        {/* STEP 2: Date & Time */}
        {step === 2 && (
          <div className="fade-up" style={{ maxWidth: 560, width: '100%' }}>
            <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 20, color: 'rgba(255,255,255,.7)' }}>Pick date & time</h2>

            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', marginBottom: 10 }}>Date</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {getDateOptions().map(d => (
                  <div key={d.key} onClick={() => { setSelectedDate(d.key); setSelectedSlot('') }} style={{
                    padding: '10px 14px', borderRadius: 12, cursor: 'pointer', textAlign: 'center', minWidth: 68,
                    background: selectedDate === d.key ? 'rgba(130,150,220,.15)' : 'rgba(255,255,255,.02)',
                    border: `1px solid ${selectedDate === d.key ? 'rgba(130,150,220,.25)' : 'rgba(255,255,255,.06)'}`,
                    transition: 'all .2s',
                  }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginBottom: 2 }}>{d.day}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: selectedDate === d.key ? 'rgba(130,150,220,.9)' : 'rgba(255,255,255,.5)' }}>{d.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {selectedDate && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', marginBottom: 10 }}>Available times</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
                  {slots.map(s => (
                    <div key={s} onClick={() => setSelectedSlot(s)} style={{
                      padding: '11px 6px', borderRadius: 10, cursor: 'pointer', fontSize: 13, textAlign: 'center', fontWeight: 400,
                      background: selectedSlot === s ? 'rgba(130,220,170,.12)' : 'rgba(255,255,255,.02)',
                      border: `1px solid ${selectedSlot === s ? 'rgba(130,220,170,.25)' : 'rgba(255,255,255,.06)'}`,
                      color: selectedSlot === s ? 'rgba(130,220,170,.9)' : 'rgba(255,255,255,.5)',
                      transition: 'all .2s',
                    }}>
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button onClick={() => setStep(1)} style={{
                padding: '12px 22px', background: 'none', border: '1px solid rgba(255,255,255,.08)',
                borderRadius: 12, color: 'rgba(255,255,255,.35)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
              }}>Back</button>
              {selectedSlot && (
                <button onClick={() => setStep(3)} className="btn-primary" style={{ fontSize: 14, fontFamily: 'inherit' }}>
                  Continue
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: Client Details */}
        {step === 3 && (
          <div className="fade-up" style={{ maxWidth: 480, width: '100%' }}>
            <div className="glass-card" style={{ padding: '32px 28px' }}>
              {/* Booking Summary */}
              <div style={{ marginBottom: 28, padding: '16px 20px', borderRadius: 14, background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: '#e8e8ed' }}>{selectedService?.name}</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', marginTop: 4 }}>with {selectedBarber?.name}</div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'rgba(130,220,170,.7)' }}>${selectedService?.price}</div>
                </div>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.05)', fontSize: 14, fontWeight: 500, color: 'rgba(130,150,220,.8)' }}>
                  {selectedDate && new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {selectedSlot}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: 6 }}>Full Name</label>
                  <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="John Doe" style={inputStyle}
                    onFocus={e => e.target.style.borderColor = 'rgba(130,150,220,.3)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.1)'} />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: 6 }}>Phone Number</label>
                  <input type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="(555) 123-4567" style={inputStyle}
                    onFocus={e => e.target.style.borderColor = 'rgba(130,150,220,.3)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.1)'} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
                <button onClick={() => setStep(2)} style={{
                  padding: '14px 22px', background: 'none', border: '1px solid rgba(255,255,255,.08)',
                  borderRadius: 12, color: 'rgba(255,255,255,.35)', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit',
                }}>Back</button>
                <button onClick={handleBook} disabled={!clientName || loading} className="btn-primary" style={{
                  flex: 1, fontSize: 15, fontFamily: 'inherit', opacity: !clientName || loading ? 0.5 : 1,
                }}>
                  {loading ? 'Confirming...' : 'Confirm Booking'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Confirmed */}
        {booked && step === 4 && (
          <div className="fade-up" style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
            <div className="glass-card" style={{ padding: '48px 32px' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 999, margin: '0 auto 24px',
                background: 'rgba(130,220,170,.12)', border: '2px solid rgba(130,220,170,.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: 'rgba(130,220,170,.8)',
              }}>&#10003;</div>
              <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: '#e8e8ed' }}>Booking Confirmed!</h2>
              <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 14, lineHeight: 1.7, marginBottom: 8 }}>
                {selectedService?.name} with {selectedBarber?.name}
              </p>
              <p style={{ color: 'rgba(130,150,220,.7)', fontSize: 16, fontWeight: 500, marginBottom: 32 }}>
                {selectedDate && new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {selectedSlot}
              </p>

              <div style={{ padding: '16px 20px', borderRadius: 12, background: 'rgba(130,150,220,.06)', border: '1px solid rgba(130,150,220,.12)', marginBottom: 32, fontSize: 13, color: 'rgba(130,150,220,.6)', lineHeight: 1.6 }}>
                This is a demo. In production, clients receive SMS confirmation, calendar invite, and reminders automatically via VuriumBook.
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button onClick={resetBooking} className="btn-secondary" style={{ fontSize: 14, fontFamily: 'inherit' }}>
                  Try Again
                </button>
                <a href="/vuriumbook#demo" className="btn-primary" style={{ fontSize: 14 }}>
                  Get VuriumBook
                </a>
              </div>
            </div>
          </div>
        )}

        {/* How it works section */}
        {step === 0 && (
          <section className="fade-up fade-up-d3" style={{ maxWidth: 800, width: '100%', marginTop: 80, textAlign: 'center' }}>
            <p className="label-glow" style={{ marginBottom: 12 }}>How it works</p>
            <h2 className="shimmer-text" style={{ fontSize: 'clamp(22px, 3.5vw, 36px)', fontWeight: 600, letterSpacing: '-.03em', marginBottom: 40 }}>
              Seamless booking in 4 steps
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
              {[
                { num: '01', title: 'Pick Service', desc: 'Client selects from your service menu with prices and duration', color: 'rgba(130,150,220,.5)' },
                { num: '02', title: 'Choose Staff', desc: 'Browse available team members with profiles and specialties', color: 'rgba(130,220,170,.5)' },
                { num: '03', title: 'Select Time', desc: 'Real-time availability — only open slots are shown', color: 'rgba(220,170,100,.5)' },
                { num: '04', title: 'Confirm', desc: 'Instant SMS confirmation and calendar sync for both parties', color: 'rgba(220,130,160,.5)' },
              ].map((s, i) => (
                <div key={i} className="glass-card" style={{ padding: '24px 18px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 200, color: s.color, marginBottom: 12, letterSpacing: '-.02em' }}>{s.num}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8ed', marginBottom: 8 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        {step === 0 && (
          <section className="fade-up fade-up-d4" style={{ marginTop: 80, textAlign: 'center' }}>
            <h2 className="shimmer-text" style={{ fontSize: 'clamp(22px, 3.5vw, 36px)', fontWeight: 600, letterSpacing: '-.03em', marginBottom: 16 }}>
              Ready for your business?
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.3)', maxWidth: 400, margin: '0 auto 32px', lineHeight: 1.6 }}>
              Set up VuriumBook in minutes. Your clients will love the experience.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="mailto:hello@vurium.com?subject=VuriumBook Demo" className="btn-primary">Request a Demo</a>
              <a href="/vuriumbook" className="btn-secondary">Learn More</a>
            </div>
          </section>
        )}

      </main>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,.05)', padding: '20px clamp(20px, 4vw, 48px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2, flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>&copy; 2026 Vurium. All rights reserved.</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.15)' }}>Powered by VuriumBook</span>
      </footer>
    </>
  )
}
