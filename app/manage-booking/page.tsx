'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://vuriumbook-api-431945333485.us-central1.run.app'

type Booking = {
  id: string
  workspace_id: string
  shop_name?: string
  logo_url?: string
  status: string
  client_name: string | null
  service_name: string | null
  barber_name: string | null
  barber_id: string
  start_at: string
  end_at: string
  duration_minutes: number
}

type Slot = { start_at: string }


const btn = (variant: 'primary' | 'danger' | 'ghost'): React.CSSProperties => ({
  padding: '13px 24px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
  fontFamily: 'inherit', transition: 'opacity .15s',
  ...(variant === 'primary' && { background: '#fff', color: '#000' }),
  ...(variant === 'danger' && { background: 'rgba(220,60,60,.15)', color: 'rgba(255,130,130,.9)', border: '1px solid rgba(220,60,60,.25)' }),
  ...(variant === 'ghost' && { background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.1)' }),
})

function formatDate(iso: string, tz?: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz })
}
function formatTime(iso: string, tz?: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz })
}
function formatDay(iso: string, tz?: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz })
}

function ManageBookingContent() {
  const params = useSearchParams()
  const token = params.get('token')
  const ws = params.get('ws')
  const bid = params.get('bid')
  const initialAction = params.get('action')

  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState<'main' | 'cancel-confirm' | 'reschedule' | 'done-cancel' | 'done-reschedule'>('main')

  // Reschedule state
  const [selectedDate, setSelectedDate] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')

  const fetchBooking = useCallback(async () => {
    if (!token || !ws || !bid) { setError('Invalid link — missing parameters.'); setLoading(false); return }
    try {
      const res = await fetch(`${API}/public/manage-booking?ws=${ws}&bid=${bid}&token=${token}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Booking not found.'); setLoading(false); return }
      setBooking(data)
      if (initialAction === 'cancel') setView('cancel-confirm')
    } catch {
      setError('Failed to load booking.')
    } finally {
      setLoading(false)
    }
  }, [token, ws, bid, initialAction])

  useEffect(() => { fetchBooking() }, [fetchBooking])

  // Load slots when date is selected
  useEffect(() => {
    if (!selectedDate || !booking) return
    setSlotsLoading(true)
    setSlots([])
    setSelectedSlot('')
    fetch(`${API}/public/availability/${booking.workspace_id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barber_id: booking.barber_id,
        date: selectedDate,
        duration_minutes: booking.duration_minutes,
      }),
    })
      .then(r => r.json())
      .then(d => setSlots(d.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false))
  }, [selectedDate, booking])

  async function handleCancel() {
    if (!token || !ws || !bid) return
    setSubmitting(true); setActionError('')
    try {
      const res = await fetch(`${API}/public/manage-booking/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ws, bid, token }),
      })
      const data = await res.json()
      if (!res.ok) { setActionError(data.error || 'Failed to cancel.'); return }
      setView('done-cancel')
    } catch { setActionError('Network error. Please try again.') }
    finally { setSubmitting(false) }
  }

  async function handleReschedule() {
    if (!token || !ws || !bid || !selectedSlot) return
    setSubmitting(true); setActionError('')
    try {
      const res = await fetch(`${API}/public/manage-booking/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ws, bid, token, start_at: selectedSlot }),
      })
      const data = await res.json()
      if (!res.ok) { setActionError(data.error || 'Failed to reschedule.'); return }
      setView('done-reschedule')
      setBooking(prev => prev ? { ...prev, start_at: data.start_at, end_at: data.end_at } : prev)
    } catch { setActionError('Network error. Please try again.') }
    finally { setSubmitting(false) }
  }

  const isPast = booking ? new Date(booking.start_at) < new Date() : false
  const isCancelled = booking?.status === 'cancelled'
  const isCompleted = ['completed', 'done'].includes(booking?.status || '')

  // Date chips for next 30 days
  function getDates() {
    const dates: { key: string; label: string; sub: string }[] = []
    const now = new Date()
    for (let i = 0; i < 30; i++) {
      const d = new Date(now)
      d.setDate(now.getDate() + i)
      const key = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const sub = i <= 1 ? '' : d.toLocaleDateString('en-US', { weekday: 'short' })
      dates.push({ key, label, sub })
    }
    return dates
  }

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 16, padding: '20px', marginBottom: 16,
  }

  if (loading) return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.4)', fontFamily: 'Inter,Helvetica,Arial,sans-serif' }}>
      Loading…
    </div>
  )

  if (error) return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Inter,Helvetica,Arial,sans-serif' }}>
      <div style={{ maxWidth: 400, textAlign: 'center', color: 'rgba(255,130,130,.9)' }}>{error}</div>
    </div>
  )

  if (!booking) return null

  return (
    <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', background: '#0a0a0a', fontFamily: 'Inter,Helvetica,Arial,sans-serif', color: '#e8e8ed', padding: '40px 20px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {booking.logo_url ? (
            <div style={{ width: 56, height: 56, borderRadius: 14, background: '#111', border: '1px solid rgba(255,255,255,.12)', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <img src={booking.logo_url} width={40} height={40} style={{ objectFit: 'contain', borderRadius: 8 }} alt="Logo" />
            </div>
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: 14, background: '#111', border: '1px solid rgba(255,255,255,.12)', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="https://vurium.com/logo-white.jpg" width={34} height={34} style={{ borderRadius: 8 }} alt="Logo" />
            </div>
          )}
          {booking.shop_name && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginBottom: 6 }}>{booking.shop_name}</div>
          )}
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Manage Booking</h1>
        </div>

        {/* Booking card */}
        <div style={card}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{booking.service_name || 'Appointment'}</div>
          <div style={{ color: 'rgba(255,255,255,.45)', fontSize: 13, marginBottom: 8 }}>with {booking.barber_name || 'your specialist'}</div>
          <div style={{ color: 'rgba(130,150,220,.8)', fontWeight: 500, fontSize: 14 }}>
            {formatDate(booking.start_at)} at {formatTime(booking.start_at)}
          </div>
          {(isCancelled || isCompleted) && (
            <div style={{ marginTop: 10, padding: '6px 12px', borderRadius: 8, background: isCancelled ? 'rgba(220,60,60,.12)' : 'rgba(50,200,100,.1)', color: isCancelled ? 'rgba(255,130,130,.9)' : 'rgba(100,220,140,.9)', fontSize: 12, fontWeight: 600, display: 'inline-block' }}>
              {booking.status.toUpperCase()}
            </div>
          )}
        </div>

        {/* === MAIN VIEW === */}
        {view === 'main' && !isCancelled && !isCompleted && !isPast && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ ...btn('ghost'), flex: 1 }} onClick={() => { setView('reschedule'); setActionError('') }}>Reschedule</button>
            <button style={{ ...btn('danger'), flex: 1 }} onClick={() => { setView('cancel-confirm'); setActionError('') }}>Cancel</button>
          </div>
        )}

        {(isCancelled || isCompleted || isPast) && view === 'main' && (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,.35)', fontSize: 13 }}>
            {isCancelled && 'This appointment has been cancelled.'}
            {isCompleted && 'This appointment is completed.'}
            {isPast && !isCancelled && !isCompleted && 'This appointment has already passed.'}
          </div>
        )}

        {/* === CANCEL CONFIRM === */}
        {view === 'cancel-confirm' && (
          <div>
            <div style={{ ...card, background: 'rgba(220,60,60,.07)', border: '1px solid rgba(220,60,60,.2)', textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Cancel appointment?</div>
              <div style={{ color: 'rgba(255,255,255,.45)', fontSize: 13 }}>This action cannot be undone. You'll receive a confirmation email.</div>
            </div>
            {actionError && <div style={{ color: 'rgba(255,130,130,.9)', fontSize: 13, marginBottom: 12 }}>{actionError}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...btn('ghost'), flex: 1 }} onClick={() => setView('main')} disabled={submitting}>Back</button>
              <button style={{ ...btn('danger'), flex: 1, opacity: submitting ? 0.5 : 1 }} onClick={handleCancel} disabled={submitting}>
                {submitting ? 'Cancelling…' : 'Yes, cancel'}
              </button>
            </div>
          </div>
        )}

        {/* === RESCHEDULE === */}
        {view === 'reschedule' && (
          <div>
            <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 600 }}>Pick a new date & time</h2>

            {/* Date chips */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 10 }}>Date</div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
                {getDates().map(d => (
                  <div key={d.key} onClick={() => setSelectedDate(d.key)} style={{
                    padding: '10px 14px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                    flexShrink: 0, minWidth: 60,
                    background: selectedDate === d.key ? 'rgba(130,150,220,.12)' : 'rgba(255,255,255,.03)',
                    border: `1px solid ${selectedDate === d.key ? 'rgba(130,150,220,.25)' : 'rgba(255,255,255,.08)'}`,
                  }}>
                    {d.sub && <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginBottom: 2 }}>{d.sub}</div>}
                    <div style={{ fontSize: 13, fontWeight: 500, color: selectedDate === d.key ? 'rgba(130,150,220,.9)' : 'rgba(255,255,255,.6)' }}>{d.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Time slots */}
            {selectedDate && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 10 }}>Available times</div>
                {slotsLoading ? (
                  <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Loading…</div>
                ) : slots.length === 0 ? (
                  <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No available times on this day. Try another date.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 8 }}>
                    {slots.map(slot => (
                      <div key={slot} onClick={() => setSelectedSlot(slot)} style={{
                        padding: '11px 6px', borderRadius: 10, cursor: 'pointer', fontSize: 13, textAlign: 'center',
                        background: selectedSlot === slot ? 'rgba(130,220,170,.1)' : 'rgba(255,255,255,.03)',
                        border: `1px solid ${selectedSlot === slot ? 'rgba(130,220,170,.25)' : 'rgba(255,255,255,.08)'}`,
                        color: selectedSlot === slot ? 'rgba(130,220,170,.9)' : 'rgba(255,255,255,.6)',
                        fontWeight: selectedSlot === slot ? 600 : 400,
                      }}>
                        {formatTime(slot)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {actionError && <div style={{ color: 'rgba(255,130,130,.9)', fontSize: 13, marginBottom: 12 }}>{actionError}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...btn('ghost'), flex: 1 }} onClick={() => { setView('main'); setSelectedDate(''); setSelectedSlot('') }} disabled={submitting}>Back</button>
              <button style={{ ...btn('primary'), flex: 1, opacity: (!selectedSlot || submitting) ? 0.4 : 1 }}
                onClick={handleReschedule} disabled={!selectedSlot || submitting}>
                {submitting ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        )}

        {/* === DONE CANCEL === */}
        {view === 'done-cancel' && (
          <div style={{ ...card, textAlign: 'center', background: 'rgba(220,60,60,.07)', border: '1px solid rgba(220,60,60,.2)' }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>✓</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Appointment Cancelled</div>
            <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 13 }}>A confirmation has been sent to your email.</div>
          </div>
        )}

        {/* === DONE RESCHEDULE === */}
        {view === 'done-reschedule' && (
          <div style={{ ...card, textAlign: 'center' }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>✓</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Appointment Rescheduled</div>
            <div style={{ color: 'rgba(130,150,220,.8)', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
              {formatDate(booking.start_at)} at {formatTime(booking.start_at)}
            </div>
            <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 13 }}>A confirmation has been sent to your email.</div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <a href="https://vurium.com" style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>Powered by VuriumBook</a>
        </div>
      </div>
    </div>
  )
}

export default function ManageBookingPage() {
  return (
    <Suspense fallback={
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.4)', fontFamily: 'Inter,Helvetica,Arial,sans-serif' }}>
        Loading…
      </div>
    }>
      <ManageBookingContent />
    </Suspense>
  )
}
