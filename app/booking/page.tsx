'use client'
import { useEffect, useRef, useState } from 'react'
import { getPublicBarbers, getPublicServices, getPublicAvailability, createPublicBooking } from '../../lib/api'

const WORKSPACE_ID = process.env.NEXT_PUBLIC_WORKSPACE_ID || ''

interface Barber { id: string; name: string; photo_url?: string; level?: string }
interface Service { id: string; name: string; duration_minutes: number; price_cents: number }

export default function BookingPage() {
  const spaceRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState(0) // 0=service, 1=barber, 2=date/time, 3=info, 4=confirm
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientNote, setClientNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [booked, setBooked] = useState(false)
  const [slotsLoading, setSlotsLoading] = useState(false)

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
    if (!WORKSPACE_ID) return
    getPublicServices(WORKSPACE_ID).then(d => setServices(d.services || [])).catch(() => {})
    getPublicBarbers(WORKSPACE_ID).then(d => setBarbers(d.barbers || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedBarber || !selectedDate || !WORKSPACE_ID) return
    setSlotsLoading(true)
    setSlots([])
    const start = new Date(selectedDate + 'T00:00:00')
    const end = new Date(start.getTime() + 86400000)
    getPublicAvailability(WORKSPACE_ID, {
      barber_id: selectedBarber.id,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      duration_minutes: selectedService?.duration_minutes || 30,
    }).then(d => {
      setSlots(d.slots || [])
    }).catch(() => setError('Failed to load available times'))
      .finally(() => setSlotsLoading(false))
  }, [selectedBarber, selectedDate, selectedService])

  async function handleBook() {
    if (!WORKSPACE_ID || !selectedBarber || !selectedSlot || !clientName) return
    setLoading(true); setError('')
    try {
      await createPublicBooking(WORKSPACE_ID, {
        barber_id: selectedBarber.id,
        barber_name: selectedBarber.name,
        start_at: selectedSlot,
        client_name: clientName,
        client_phone: clientPhone || undefined,
        service_id: selectedService?.id,
        service_name: selectedService?.name,
        duration_minutes: selectedService?.duration_minutes || 30,
        customer_note: clientNote || undefined,
      })
      setBooked(true); setStep(4)
    } catch (e: any) {
      setError(e.message || 'Booking failed')
    } finally { setLoading(false) }
  }

  function getDateOptions() {
    const dates: string[] = []
    const now = new Date()
    for (let i = 0; i < 14; i++) {
      const d = new Date(now.getTime() + i * 86400000)
      dates.push(d.toISOString().slice(0, 10))
    }
    return dates
  }

  function formatDate(iso: string) {
    const d = new Date(iso + 'T12:00:00')
    const today = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    if (iso === today) return 'Today'
    if (iso === tomorrow) return 'Tomorrow'
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  function formatPrice(cents: number) {
    return '$' + (cents / 100).toFixed(0)
  }

  const stepTitles = ['Select Service', 'Choose Barber', 'Pick Date & Time', 'Your Info', 'Confirmed!']

  return (
    <>
      <div className="space-bg" ref={spaceRef}>
        <div className="stars-wrap stars-wrap-far"><div className="stars stars-far" /></div>
        <div className="stars-wrap stars-wrap-mid"><div className="stars stars-mid" /></div>
        <div className="stars-wrap stars-wrap-near"><div className="stars stars-near" /></div>
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
          <li><a href="/booking" style={{ color: 'rgba(255,255,255,.85)' }}>Book Now</a></li>
          <li><a href="/#about">About</a></li>
        </ul>
      </nav>

      <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'clamp(100px, 12vh, 140px) 20px 60px', position: 'relative', zIndex: 2 }}>

        {/* Header */}
        <div className="fade-up" style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: 'rgba(130,220,170,.7)', display: 'inline-block' }} />
            <span className="label-glow" style={{ color: 'rgba(130,220,170,.8)' }}>Online Booking</span>
          </div>
          <h1 className="shimmer-text" style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 600, letterSpacing: '-.03em' }}>
            Book Your Appointment
          </h1>
        </div>

        {/* Progress */}
        {!booked && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 40, flexWrap: 'wrap', justifyContent: 'center' }}>
            {stepTitles.slice(0, 4).map((t, i) => (
              <div key={i} onClick={() => { if (i < step) setStep(i) }} style={{
                padding: '8px 18px', borderRadius: 999, fontSize: 13, fontWeight: 400, cursor: i < step ? 'pointer' : 'default',
                background: i === step ? 'rgba(255,255,255,.08)' : 'transparent',
                border: `1px solid ${i === step ? 'rgba(255,255,255,.15)' : i < step ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.04)'}`,
                color: i === step ? '#fff' : i < step ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.2)',
                transition: 'all .2s',
              }}>
                {i + 1}. {t}
              </div>
            ))}
          </div>
        )}

        {error && (
          <div style={{ padding: '12px 24px', borderRadius: 12, background: 'rgba(220,80,80,.12)', border: '1px solid rgba(220,80,80,.2)', color: 'rgba(255,160,160,.9)', marginBottom: 24, fontSize: 14 }}>
            {error}
          </div>
        )}

        {!WORKSPACE_ID && (
          <div className="glass-card" style={{ maxWidth: 500, width: '100%', textAlign: 'center' }}>
            <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 15 }}>
              Booking is not configured yet. Set <code style={{ background: 'rgba(255,255,255,.06)', padding: '2px 8px', borderRadius: 6 }}>NEXT_PUBLIC_WORKSPACE_ID</code> in your environment.
            </p>
          </div>
        )}

        {/* Step 0: Services */}
        {WORKSPACE_ID && step === 0 && (
          <div className="fade-up" style={{ maxWidth: 600, width: '100%' }}>
            {services.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,.35)', padding: 40 }}>Loading services...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {services.map(s => (
                  <div key={s.id} onClick={() => { setSelectedService(s); setStep(1) }} className="glass-card" style={{
                    cursor: 'pointer', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    border: selectedService?.id === s.id ? '1px solid rgba(130,220,170,.3)' : undefined,
                    transition: 'all .2s',
                  }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 500 }}>{s.name}</div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', marginTop: 4 }}>{s.duration_minutes} min</div>
                    </div>
                    {s.price_cents > 0 && (
                      <div style={{ fontSize: 18, fontWeight: 600, color: 'rgba(130,220,170,.8)' }}>{formatPrice(s.price_cents)}</div>
                    )}
                  </div>
                ))}
                <button onClick={() => { setSelectedService(null); setStep(1) }} style={{
                  padding: '16px 24px', borderRadius: 16, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)',
                  color: 'rgba(255,255,255,.4)', cursor: 'pointer', fontSize: 14, textAlign: 'center',
                }}>
                  Skip — choose service later
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Barbers */}
        {WORKSPACE_ID && step === 1 && (
          <div className="fade-up" style={{ maxWidth: 600, width: '100%' }}>
            {barbers.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,.35)', padding: 40 }}>Loading barbers...</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
                {barbers.map(b => (
                  <div key={b.id} onClick={() => { setSelectedBarber(b); setStep(2) }} className="glass-card" style={{
                    cursor: 'pointer', padding: '24px 16px', textAlign: 'center',
                    border: selectedBarber?.id === b.id ? '1px solid rgba(130,150,220,.3)' : undefined,
                    transition: 'all .2s',
                  }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: 999, margin: '0 auto 14px',
                      background: b.photo_url ? `url(${b.photo_url}) center/cover` : 'linear-gradient(135deg, rgba(130,150,220,.3), rgba(130,220,170,.2))',
                      border: '2px solid rgba(255,255,255,.08)',
                    }} />
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{b.name}</div>
                    {b.level && <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginTop: 4 }}>{b.level}</div>}
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setStep(0)} style={{
              marginTop: 20, padding: '10px 20px', background: 'none', border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 10, color: 'rgba(255,255,255,.4)', cursor: 'pointer', fontSize: 13,
            }}>Back</button>
          </div>
        )}

        {/* Step 2: Date & Time */}
        {WORKSPACE_ID && step === 2 && (
          <div className="fade-up" style={{ maxWidth: 600, width: '100%' }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,.4)', marginBottom: 12 }}>Select Date</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {getDateOptions().map(d => (
                  <div key={d} onClick={() => { setSelectedDate(d); setSelectedSlot('') }} style={{
                    padding: '10px 16px', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 400,
                    background: selectedDate === d ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.02)',
                    border: `1px solid ${selectedDate === d ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.06)'}`,
                    color: selectedDate === d ? '#fff' : 'rgba(255,255,255,.5)',
                    transition: 'all .2s',
                  }}>
                    {formatDate(d)}
                  </div>
                ))}
              </div>
            </div>

            {selectedDate && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,.4)', marginBottom: 12 }}>Available Times</div>
                {slotsLoading ? (
                  <div style={{ color: 'rgba(255,255,255,.3)', padding: 20, textAlign: 'center' }}>Loading...</div>
                ) : slots.length === 0 ? (
                  <div style={{ color: 'rgba(255,255,255,.3)', padding: 20, textAlign: 'center' }}>No available times for this date</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                    {slots.map(s => (
                      <div key={s} onClick={() => setSelectedSlot(s)} style={{
                        padding: '12px 8px', borderRadius: 10, cursor: 'pointer', fontSize: 14, textAlign: 'center',
                        background: selectedSlot === s ? 'rgba(130,220,170,.15)' : 'rgba(255,255,255,.02)',
                        border: `1px solid ${selectedSlot === s ? 'rgba(130,220,170,.3)' : 'rgba(255,255,255,.06)'}`,
                        color: selectedSlot === s ? 'rgba(130,220,170,.9)' : 'rgba(255,255,255,.6)',
                        transition: 'all .2s',
                      }}>
                        {formatTime(s)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setStep(1)} style={{
                padding: '10px 20px', background: 'none', border: '1px solid rgba(255,255,255,.08)',
                borderRadius: 10, color: 'rgba(255,255,255,.4)', cursor: 'pointer', fontSize: 13,
              }}>Back</button>
              {selectedSlot && (
                <button onClick={() => setStep(3)} className="btn-primary" style={{ fontSize: 14 }}>
                  Continue
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Client info */}
        {WORKSPACE_ID && step === 3 && (
          <div className="fade-up" style={{ maxWidth: 480, width: '100%' }}>
            <div className="glass-card" style={{ padding: '32px 28px' }}>
              {/* Summary */}
              <div style={{ marginBottom: 28, padding: '16px 20px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
                {selectedService && <div style={{ fontSize: 14, color: 'rgba(255,255,255,.5)' }}>{selectedService.name} — {selectedService.duration_minutes} min</div>}
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,.5)', marginTop: 4 }}>with {selectedBarber?.name}</div>
                <div style={{ fontSize: 15, fontWeight: 500, marginTop: 8, color: 'rgba(130,220,170,.8)' }}>
                  {formatDate(selectedDate)} at {formatTime(selectedSlot)}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', display: 'block', marginBottom: 6 }}>Your Name *</label>
                  <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="John Doe" style={{
                    width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)',
                    background: 'rgba(255,255,255,.04)', color: '#fff', fontSize: 15, outline: 'none',
                  }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', display: 'block', marginBottom: 6 }}>Phone Number</label>
                  <input type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="(555) 123-4567" style={{
                    width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)',
                    background: 'rgba(255,255,255,.04)', color: '#fff', fontSize: 15, outline: 'none',
                  }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', display: 'block', marginBottom: 6 }}>Notes (optional)</label>
                  <textarea value={clientNote} onChange={e => setClientNote(e.target.value)} placeholder="Any special requests..." rows={3} style={{
                    width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)',
                    background: 'rgba(255,255,255,.04)', color: '#fff', fontSize: 15, outline: 'none', resize: 'vertical',
                  }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
                <button onClick={() => setStep(2)} style={{
                  padding: '14px 24px', background: 'none', border: '1px solid rgba(255,255,255,.08)',
                  borderRadius: 12, color: 'rgba(255,255,255,.4)', cursor: 'pointer', fontSize: 14,
                }}>Back</button>
                <button onClick={handleBook} disabled={!clientName || loading} className="btn-primary" style={{
                  flex: 1, fontSize: 15, opacity: !clientName || loading ? 0.5 : 1,
                }}>
                  {loading ? 'Booking...' : 'Confirm Booking'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Confirmed */}
        {booked && step === 4 && (
          <div className="fade-up" style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
            <div className="glass-card" style={{ padding: '48px 32px' }}>
              <div style={{ width: 64, height: 64, borderRadius: 999, background: 'rgba(130,220,170,.15)', border: '2px solid rgba(130,220,170,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 28 }}>
                &#10003;
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Booking Confirmed!</h2>
              <p style={{ color: 'rgba(255,255,255,.45)', fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
                Your appointment with {selectedBarber?.name} is set for<br />
                <span style={{ color: 'rgba(130,220,170,.8)', fontWeight: 500 }}>
                  {formatDate(selectedDate)} at {formatTime(selectedSlot)}
                </span>
              </p>
              {selectedService && (
                <p style={{ color: 'rgba(255,255,255,.35)', fontSize: 14 }}>
                  {selectedService.name} — {selectedService.duration_minutes} min
                </p>
              )}
              <div style={{ marginTop: 36, display: 'flex', gap: 12, justifyContent: 'center' }}>
                <a href="/" className="btn-secondary" style={{ fontSize: 14 }}>Back to Home</a>
                <button onClick={() => { setBooked(false); setStep(0); setSelectedSlot(''); setSelectedDate(''); setClientName(''); setClientPhone(''); setClientNote(''); setError('') }} className="btn-primary" style={{ fontSize: 14 }}>
                  Book Another
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      <footer style={{ textAlign: 'center', padding: '40px 24px', color: 'rgba(255,255,255,.2)', fontSize: 13, position: 'relative', zIndex: 2 }}>
        Powered by VuriumBook
      </footer>
    </>
  )
}
