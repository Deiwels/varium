'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://vuriumbook-api-431945333485.us-central1.run.app'

interface Barber { id: string; name: string; photo_url?: string; level?: string; schedule?: any }
interface Service { id: string; name: string; duration_minutes: number; price_cents: number; barber_ids?: string[] }
interface Config { shop_name?: string; hero_media_url?: string; bannerText?: string; bannerEnabled?: boolean }

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(`${API}${path}`, { ...opts, headers: { 'Content-Type': 'application/json', ...opts?.headers } })
  return res.json()
}

export default function PublicBookingPage() {
  const params = useParams()
  const wsId = params.id as string

  const [resolvedWsId, setResolvedWsId] = useState('')
  const [effectivePlan, setEffectivePlan] = useState('individual')
  const [siteConfig, setSiteConfig] = useState<any>(null)
  const [shopName, setShopName] = useState('')
  const [config, setConfig] = useState<Config>({})
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showBooking, setShowBooking] = useState(false) // for salon/custom: landing first

  // Booking state
  const [step, setStep] = useState(0) // 0=service, 1=barber(if multi), 2=date/time, 3=info, 4=done
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientNote, setClientNote] = useState('')
  const [smsConsent, setSmsConsent] = useState(false)
  const [bookLoading, setBookLoading] = useState(false)
  const [booked, setBooked] = useState(false)
  const [error, setError] = useState('')

  // Parallax stars — targets both global (#v-stars-*) and page-level (.stars-*) stars
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window

    let tx = 0, ty = 0, cx = 0, cy = 0
    let raf: number

    function tick() {
      cx += (tx - cx) * 0.02
      cy += (ty - cy) * 0.02

      // Global stars from layout (Vurium template uses these)
      const gf = document.getElementById('v-stars-far')
      const gm = document.getElementById('v-stars-mid')
      const gn = document.getElementById('v-stars-near')
      if (gf) gf.style.transform = `translate(${cx * 8}px, ${cy * 8}px)`
      if (gm) gm.style.transform = `translate(${cx * 20}px, ${cy * 20}px)`
      if (gn) gn.style.transform = `translate(${cx * 35}px, ${cy * 35}px)`

      // Page-level stars (bold/dark-luxury templates)
      const pf = document.querySelector('.stars-far') as HTMLElement
      const pm = document.querySelector('.stars-mid') as HTMLElement
      const pn = document.querySelector('.stars-near') as HTMLElement
      if (pf) pf.style.transform = `translate(${cx * 8}px, ${cy * 8}px)`
      if (pm) pm.style.transform = `translate(${cx * 20}px, ${cy * 20}px)`
      if (pn) pn.style.transform = `translate(${cx * 35}px, ${cy * 35}px)`

      raf = requestAnimationFrame(tick)
    }

    if (isMobile) {
      function onOrientation(e: DeviceOrientationEvent) {
        const gamma = Math.max(-15, Math.min(15, e.gamma || 0))
        const beta  = Math.max(-15, Math.min(15, (e.beta || 0) - 45))
        tx = gamma / 15 * 4
        ty = beta  / 15 * 4
      }
      const doe = DeviceOrientationEvent as any
      if (typeof doe.requestPermission === 'function') {
        function reqGyro() {
          doe.requestPermission().then((s: string) => {
            if (s === 'granted') window.addEventListener('deviceorientation', onOrientation, { passive: true })
          }).catch(() => {})
          document.removeEventListener('click', reqGyro)
        }
        document.addEventListener('click', reqGyro, { once: true })
      } else {
        window.addEventListener('deviceorientation', onOrientation, { passive: true })
      }
      raf = requestAnimationFrame(tick)
      return () => { window.removeEventListener('deviceorientation', onOrientation); cancelAnimationFrame(raf) }
    }

    function onMouse(e: MouseEvent) {
      tx = (e.clientX / window.innerWidth - 0.5) * 2
      ty = (e.clientY / window.innerHeight - 0.5) * 2
    }

    window.addEventListener('mousemove', onMouse, { passive: true })
    raf = requestAnimationFrame(tick)
    return () => { window.removeEventListener('mousemove', onMouse); cancelAnimationFrame(raf) }
  }, [])

  const isSolo = barbers.length <= 1

  useEffect(() => {
    if (!wsId) return
    // Step 1: Resolve slug → workspace_id + plan
    api(`/public/resolve/${wsId}`).then(async (resolved) => {
      if (!resolved || resolved.error) { setNotFound(true); setLoading(false); return }
      const realWsId = resolved.workspace_id
      setResolvedWsId(realWsId)
      setEffectivePlan(resolved.effective_plan || 'individual')
      setSiteConfig(resolved.site_config || null)
      setShopName(resolved.name || '')
      // Individual plan → go straight to booking
      if (resolved.effective_plan === 'individual') setShowBooking(true)
      // Step 2: Load data
      const [cfg, bData, sData, revData] = await Promise.all([
        api(`/public/config/${realWsId}`).catch(() => null),
        api(`/public/barbers/${realWsId}`).catch(() => null),
        api(`/public/services/${realWsId}`).catch(() => null),
        api(`/public/reviews/${realWsId}`).catch(() => ({ items: [] })),
      ])
      if (!bData || bData.error === 'Workspace not found') { setNotFound(true); return }
      setConfig(cfg || {})
      setBarbers(bData?.barbers || [])
      setServices(sData?.services || [])
      setReviews(revData?.items || [])
      if ((bData?.barbers || []).length === 1) setSelectedBarber((bData.barbers)[0])
      // Track page visit
      try {
        const ref = document.referrer?.toLowerCase() || ''
        const params = new URLSearchParams(window.location.search)
        const utm = params.get('utm_source')?.toLowerCase() || ''
        const source = utm ? utm
          : ref.includes('instagram') ? 'instagram'
          : ref.includes('google') ? 'google'
          : ref.includes('facebook') || ref.includes('fb.com') ? 'facebook'
          : ref.includes('tiktok') ? 'tiktok'
          : ref.includes('twitter') || ref.includes('x.com') ? 'twitter'
          : !ref ? 'direct' : 'other'
        api(`/public/analytics/${realWsId}`, { method: 'POST', body: JSON.stringify({ source, referrer: ref.slice(0, 200) }) }).catch(() => {})
      } catch {}
    }).catch(() => { setNotFound(true) }).finally(() => setLoading(false))
  }, [wsId])

  // Load slots when barber + date selected
  useEffect(() => {
    if (!selectedBarber || !selectedDate || !resolvedWsId) return
    setSlotsLoading(true); setSlots([]); setSelectedSlot('')
    const start = new Date(selectedDate + 'T00:00:00')
    const end = new Date(start.getTime() + 86400000)
    api(`/public/availability/${resolvedWsId}`, {
      method: 'POST',
      body: JSON.stringify({
        barber_id: selectedBarber.id,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        duration_minutes: selectedService?.duration_minutes || 30,
      }),
    }).then(d => setSlots(d.slots || []))
      .catch(() => {})
      .finally(() => setSlotsLoading(false))
  }, [selectedBarber, selectedDate, selectedService, resolvedWsId])

  function selectService(s: Service) {
    setSelectedService(s)
    if (isSolo) setStep(2) // Skip barber for solo
    else setStep(1)
  }

  function selectBarber(b: Barber) {
    setSelectedBarber(b)
    setStep(2)
  }

  async function handleBook() {
    if (!clientName || !selectedBarber || !selectedSlot) return
    setBookLoading(true); setError('')
    try {
      const res = await api(`/public/bookings/${resolvedWsId}`, {
        method: 'POST',
        body: JSON.stringify({
          barber_id: selectedBarber.id,
          barber_name: selectedBarber.name,
          start_at: selectedSlot,
          client_name: clientName,
          client_phone: clientPhone || undefined,
          sms_consent: clientPhone ? smsConsent : undefined,
          service_id: selectedService?.id,
          service_name: selectedService?.name,
          duration_minutes: selectedService?.duration_minutes || 30,
          customer_note: clientNote || undefined,
        }),
      })
      if (res.error) throw new Error(res.error)
      setBooked(true); setStep(4)
    } catch (e: any) {
      setError(e.message || 'Booking failed. Please try again.')
    } finally { setBookLoading(false) }
  }

  function resetBooking() {
    setStep(0); setSelectedService(null); setSelectedSlot('')
    setSelectedDate(''); setClientName(''); setClientPhone('')
    setClientNote(''); setBooked(false); setError('')
    if (!isSolo) setSelectedBarber(null)
  }

  function getDates() {
    const dates: { key: string; label: string; sub: string }[] = []
    const now = new Date()
    for (let i = 0; i < 14; i++) {
      const d = new Date(now.getTime() + i * 86400000)
      const key = d.toISOString().slice(0, 10)
      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const sub = i <= 1 ? '' : d.toLocaleDateString('en-US', { weekday: 'short' })
      dates.push({ key, label, sub })
    }
    return dates
  }

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  function fmtPrice(cents: number) { return '$' + (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2) }

  function fmtFullDate(key: string) {
    return new Date(key + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }

  const displayName = shopName || config.shop_name || 'Book an Appointment'

  // Styles
  // card & inp are defined after template is resolved (see below)
  let card: React.CSSProperties = { borderRadius: 16, padding: '20px 22px', cursor: 'pointer', transition: 'all .2s' }
  let inp: React.CSSProperties = { width: '100%', padding: '14px 16px', borderRadius: 12, fontSize: 15, outline: 'none', fontFamily: 'inherit' }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.3)', fontFamily: 'Inter, system-ui, sans-serif' }}>
      Loading...
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif', flexDirection: 'column', gap: 16, color: 'rgba(255,255,255,.4)' }}>
      <div style={{ fontSize: 48, opacity: 0.2 }}>404</div>
      <div>This booking page doesn&apos;t exist.</div>
      <a href="/" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none', fontSize: 14 }}>← Go to Vurium</a>
    </div>
  )

  // Template styles
  const template = siteConfig?.template || 'modern'
  const TEMPLATES: Record<string, { bg: string; text: string; card: string; cardBorder: string; accent: string; headerBg: string }> = {
    classic:      { bg: '#f8f8f8', text: '#1a1a1a', card: 'rgba(255,255,255,.9)', cardBorder: 'rgba(0,0,0,.08)', accent: '#333', headerBg: 'rgba(255,255,255,.95)' },
    modern:       { bg: 'transparent', text: '#f0f0f5', card: 'rgba(255,255,255,.025)', cardBorder: 'rgba(255,255,255,.06)', accent: '#fff', headerBg: 'rgba(0,0,0,.5)' },
    bold:         { bg: '#0a0a0a', text: '#ffffff', card: 'rgba(255,255,255,.04)', cardBorder: 'rgba(255,255,255,.08)', accent: '#fff', headerBg: 'rgba(0,0,0,.6)' },
    'dark-luxury': { bg: '#0c0a08', text: '#e8dcc8', card: 'rgba(200,170,120,.04)', cardBorder: 'rgba(200,170,120,.1)', accent: '#c8a87a', headerBg: 'rgba(12,10,8,.7)' },
    colorful:     { bg: '#fafafa', text: '#2a2a2a', card: 'rgba(0,0,0,.03)', cardBorder: 'rgba(0,0,0,.06)', accent: '#6366f1', headerBg: 'rgba(255,255,255,.9)' },
  }
  // Individual: always Vurium (modern). Salon/Custom: use selected template.
  const activeTemplate = (effectivePlan === 'salon' || effectivePlan === 'custom') ? template : 'modern'
  const t = TEMPLATES[activeTemplate] || TEMPLATES.modern
  const isLightTheme = ['classic', 'colorful'].includes(activeTemplate)

  // Apply template to card & inp styles
  card = { ...card, border: `1px solid ${t.cardBorder}`, background: t.card }
  inp = { ...inp, border: `1px solid ${isLightTheme ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.1)'}`, background: isLightTheme ? 'rgba(0,0,0,.04)' : 'rgba(255,255,255,.04)', color: t.text }

  // Theme-aware colors
  const textMuted = isLightTheme ? 'rgba(0,0,0,.45)' : 'rgba(255,255,255,.3)'
  const textDim = isLightTheme ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.25)'
  const textSoft = isLightTheme ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.5)'
  const textMain = isLightTheme ? '#1a1a1a' : '#e8e8ed'
  const textHeading = isLightTheme ? 'rgba(0,0,0,.65)' : 'rgba(255,255,255,.7)'
  const borderSoft = isLightTheme ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.06)'
  const bgSubtle = isLightTheme ? 'rgba(0,0,0,.02)' : 'rgba(255,255,255,.02)'

  return (
    <div style={{ minHeight: '100vh', background: t.bg, fontFamily: 'Inter, -apple-system, sans-serif', color: t.text, position: 'relative' }}>

      {/* Space background — bold & dark-luxury get their own stars; Vurium uses global cosmos from layout */}
      {!isLightTheme && activeTemplate !== 'modern' && (
        <div className="space-bg" style={{ position: 'fixed' }}>
          <div className="stars-wrap stars-wrap-far"><div className="stars stars-far" /></div>
          <div className="stars-wrap stars-wrap-mid"><div className="stars stars-mid" /></div>
          <div className="stars-wrap stars-wrap-near"><div className="stars stars-near" /></div>
          <div className="nebula-layer" style={{ width: 600, height: 350, top: '8%', left: '-10%', background: 'rgba(30,45,110,.05)' }} />
          <div className="nebula-layer" style={{ width: 400, height: 250, top: '40%', right: '-8%', background: 'rgba(55,35,100,.03)', animationDelay: '.5s' }} />
        </div>
      )}
      {!isLightTheme && activeTemplate !== 'modern' && <div className="noise-overlay" />}

      {/* Header */}
      <header style={{ padding: '20px 24px', borderBottom: `1px solid ${t.cardBorder}`, background: t.headerBg, backdropFilter: isLightTheme ? 'none' : 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {config.hero_media_url && <img src={config.hero_media_url} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} />}
          <span style={{ fontSize: 16, fontWeight: 600, color: t.text }}>{shopName}</span>
        </div>
        <a href="https://vurium.com/vuriumbook" target="_blank" rel="noopener" style={{ fontSize: 11, color: isLightTheme ? 'rgba(0,0,0,.2)' : 'rgba(255,255,255,.15)', textDecoration: 'none' }}>Powered by VuriumBook</a>
      </header>

      {/* Banner */}
      {config.bannerEnabled && config.bannerText && (
        <div style={{ padding: '10px 24px', background: 'rgba(130,150,220,.06)', borderBottom: '1px solid rgba(130,150,220,.1)', fontSize: 13, color: 'rgba(130,150,220,.7)', textAlign: 'center' }}>
          {config.bannerText}
        </div>
      )}

      {/* ── SALON/CUSTOM LANDING PAGE ── */}
      {(effectivePlan === 'salon' || effectivePlan === 'custom') && !showBooking && (
        <main style={{ maxWidth: 700, margin: '0 auto', padding: '40px 20px 80px', position: 'relative', zIndex: 2 }}>
          {/* Hero */}
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            {config.hero_media_url && (
              <div style={{ width: '100%', height: 200, borderRadius: 16, overflow: 'hidden', marginBottom: 24, border: '1px solid rgba(255,255,255,.06)' }}>
                <img src={config.hero_media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            <h1 style={{ fontSize: 28, fontWeight: 600, color: t.text, marginBottom: 8 }}>{shopName || config.shop_name || 'Welcome'}</h1>
            {siteConfig?.hero_subtitle && <p style={{ fontSize: 15, color: isLightTheme ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.4)', lineHeight: 1.6 }}>{siteConfig.hero_subtitle}</p>}
          </div>

          {/* About */}
          {siteConfig?.about_text && (
            <div style={{ marginBottom: 40, padding: '20px 24px', borderRadius: 16, border: `1px solid ${t.cardBorder}`, background: t.card, backdropFilter: isLightTheme ? 'none' : 'blur(12px)' }}>
              <p style={{ fontSize: 14, color: isLightTheme ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.5)', lineHeight: 1.7 }}>{siteConfig.about_text}</p>
            </div>
          )}

          {/* Services listed in booking flow after Book Now — not here */}

          {/* Team */}
          {barbers.length > 1 && (
            <div style={{ marginBottom: 40 }}>
              <div style={{ fontSize: 12, color: isLightTheme ? 'rgba(0,0,0,.4)' : 'rgba(255,255,255,.35)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 14 }}>Our Team</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
                {barbers.map(b => (
                  <div key={b.id} style={{ textAlign: 'center', padding: '16px 8px', borderRadius: 14, border: `1px solid ${t.cardBorder}`, background: t.card }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 999, margin: '0 auto 10px',
                      background: b.photo_url ? `url(${b.photo_url}) center/cover` : (isLightTheme ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.06)'),
                      border: `1px solid ${t.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 600, color: isLightTheme ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.35)',
                    }}>{!b.photo_url && b.name?.[0]}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{b.name}</div>
                    {b.level && <div style={{ fontSize: 11, color: isLightTheme ? 'rgba(0,0,0,.4)' : 'rgba(255,255,255,.3)', marginTop: 2 }}>{b.level}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          {reviews.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <div style={{ fontSize: 12, color: isLightTheme ? 'rgba(0,0,0,.4)' : 'rgba(255,255,255,.35)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 14 }}>Reviews</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {reviews.slice(0, 5).map((r: any, i: number) => (
                  <div key={i} style={{ padding: '12px 16px', borderRadius: 12, border: `1px solid ${t.cardBorder}`, background: t.card }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: textSoft, fontWeight: 500 }}>{r.name}</span>
                      <span style={{ fontSize: 11, color: textDim }}>{'★'.repeat(r.rating || 5)}</span>
                    </div>
                    {r.text && <p style={{ fontSize: 13, color: textMuted, lineHeight: 1.5 }}>{r.text}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Book Now CTA */}
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <button onClick={() => setShowBooking(true)} style={{
              padding: '16px 48px', borderRadius: 14, fontSize: 16, fontWeight: 600, fontFamily: 'inherit',
              background: isLightTheme ? t.accent : 'rgba(255,255,255,.1)',
              border: `1px solid ${isLightTheme ? t.accent : 'rgba(255,255,255,.15)'}`,
              color: isLightTheme ? '#fff' : t.text, cursor: 'pointer', transition: 'all .2s',
            }}>Book Now</button>
          </div>
        </main>
      )}

      {/* ── BOOKING FLOW (all plans, or after Book Now for salon/custom) ── */}
      {(showBooking || effectivePlan === 'individual') && (
      <main style={{ maxWidth: 560, margin: '0 auto', padding: '40px 20px 80px', position: 'relative', zIndex: 2 }}>

        {/* Back to landing (salon/custom only) */}
        {effectivePlan !== 'individual' && !booked && (
          <button onClick={() => { setShowBooking(false); setStep(0); setSelectedService(null); setSelectedSlot('') }} style={{ marginBottom: 16, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', background: 'none', border: `1px solid ${borderSoft}`, color: textMuted }}>← Back</button>
        )}

        {/* Progress */}
        {!booked && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 36, alignItems: 'center', justifyContent: 'center' }}>
            {[isSolo ? 'Service' : 'Service', !isSolo ? 'Staff' : null, 'Date & Time', 'Your Info'].filter(Boolean).map((t, i) => {
              const actualStep = isSolo ? (i >= 1 ? i + 1 : i) : i
              const isActive = step === actualStep
              const isDone = step > actualStep
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div onClick={() => { if (isDone) setStep(actualStep) }} style={{
                    width: 28, height: 28, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 500, cursor: isDone ? 'pointer' : 'default',
                    background: isActive ? 'rgba(130,150,220,.15)' : isDone ? 'rgba(130,220,170,.1)' : bgSubtle,
                    border: `1px solid ${isActive ? 'rgba(130,150,220,.25)' : isDone ? 'rgba(130,220,170,.15)' : borderSoft}`,
                    color: isActive ? 'rgba(130,150,220,.9)' : isDone ? 'rgba(130,220,170,.7)' : textDim,
                  }}>{isDone ? '✓' : i + 1}</div>
                  {i < (isSolo ? 2 : 3) && <div style={{ width: 20, height: 1, background: isDone ? 'rgba(130,220,170,.15)' : borderSoft }} />}
                </div>
              )
            })}
          </div>
        )}

        {error && (
          <div style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(220,80,80,.08)', border: '1px solid rgba(220,80,80,.15)', color: 'rgba(255,160,160,.8)', fontSize: 13, marginBottom: 20 }}>{error}</div>
        )}

        {/* Step 0: Services */}
        {step === 0 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, color: textHeading }}>Choose a service</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {services.map(s => (
                <div key={s.id} onClick={() => selectService(s)} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: textMain }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: textMuted, marginTop: 3 }}>{s.duration_minutes} min</div>
                  </div>
                  {s.price_cents > 0 && <div style={{ fontSize: 17, fontWeight: 600, color: 'rgba(130,220,170,.7)' }}>{fmtPrice(s.price_cents)}</div>}
                </div>
              ))}
              {services.length === 0 && <div style={{ textAlign: 'center', color: textDim, padding: 40 }}>No services available</div>}
            </div>
          </div>
        )}

        {/* Step 1: Barbers (salon mode only) */}
        {step === 1 && !isSolo && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, color: textHeading }}>Choose your team member</h2>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${barbers.length <= 3 ? '140px' : '120px'}, 1fr))`, gap: 12 }}>
              {barbers.map(b => (
                <div key={b.id} onClick={() => selectBarber(b)} style={{ ...card, textAlign: 'center', padding: '24px 12px' }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 999, margin: '0 auto 12px',
                    background: b.photo_url ? `url(${b.photo_url}) center/cover` : 'linear-gradient(135deg, rgba(130,150,220,.2), rgba(130,220,170,.15))',
                    border: `2px solid ${t.cardBorder}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 600, color: textMuted,
                  }}>{!b.photo_url && (b.name?.split(' ').map(n => n[0]).join('').slice(0, 2))}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: textMain }}>{b.name}</div>
                  {b.level && <div style={{ fontSize: 11, color: textDim, marginTop: 3 }}>{b.level}</div>}
                </div>
              ))}
            </div>
            <button onClick={() => setStep(0)} style={{ marginTop: 16, padding: '8px 18px', background: 'none', border: `1px solid ${borderSoft}`, borderRadius: 10, color: textMuted, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Back</button>
          </div>
        )}

        {/* Step 2: Date & Time */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, color: textHeading }}>Pick date & time</h2>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: textMuted, marginBottom: 10 }}>Date</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {getDates().map(d => (
                  <div key={d.key} onClick={() => setSelectedDate(d.key)} style={{
                    padding: '10px 14px', borderRadius: 12, cursor: 'pointer', textAlign: 'center', minWidth: 64,
                    background: selectedDate === d.key ? 'rgba(130,150,220,.12)' : bgSubtle,
                    border: `1px solid ${selectedDate === d.key ? 'rgba(130,150,220,.2)' : borderSoft}`,
                  }}>
                    {d.sub && <div style={{ fontSize: 10, color: textDim, marginBottom: 2 }}>{d.sub}</div>}
                    <div style={{ fontSize: 13, fontWeight: 500, color: selectedDate === d.key ? 'rgba(130,150,220,.9)' : textSoft }}>{d.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {selectedDate && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, color: textMuted, marginBottom: 10 }}>Available times</div>
                {slotsLoading ? (
                  <div style={{ color: textDim, padding: 20, textAlign: 'center' }}>Loading...</div>
                ) : slots.length === 0 ? (
                  <div style={{ color: textDim, padding: 20, textAlign: 'center' }}>No available times</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 8 }}>
                    {slots.map(s => (
                      <div key={s} onClick={() => setSelectedSlot(s)} style={{
                        padding: '11px 6px', borderRadius: 10, cursor: 'pointer', fontSize: 13, textAlign: 'center',
                        background: selectedSlot === s ? 'rgba(130,220,170,.1)' : bgSubtle,
                        border: `1px solid ${selectedSlot === s ? 'rgba(130,220,170,.2)' : borderSoft}`,
                        color: selectedSlot === s ? 'rgba(130,220,170,.9)' : textSoft,
                      }}>{fmtTime(s)}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(isSolo ? 0 : 1)} style={{ padding: '10px 20px', background: 'none', border: `1px solid ${borderSoft}`, borderRadius: 10, color: textMuted, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Back</button>
              {selectedSlot && (
                <button onClick={() => setStep(3)} style={{
                  padding: '10px 24px', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
                  background: 'rgba(130,220,170,.1)', border: '1px solid rgba(130,220,170,.2)', color: 'rgba(130,220,170,.9)',
                }}>Continue</button>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Client Info */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, color: textHeading }}>Your details</h2>

            {/* Summary */}
            <div style={{ ...card, cursor: 'default', marginBottom: 24, padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: textMain }}>{selectedService?.name || 'Appointment'}</div>
                  {!isSolo && <div style={{ fontSize: 13, color: textMuted, marginTop: 3 }}>with {selectedBarber?.name}</div>}
                </div>
                {selectedService && selectedService.price_cents > 0 && (
                  <div style={{ fontSize: 17, fontWeight: 600, color: 'rgba(130,220,170,.7)' }}>{fmtPrice(selectedService.price_cents)}</div>
                )}
              </div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${borderSoft}`, fontSize: 14, fontWeight: 500, color: 'rgba(130,150,220,.7)' }}>
                {fmtFullDate(selectedDate)} at {fmtTime(selectedSlot)}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, color: textMuted, display: 'block', marginBottom: 6 }}>Name *</label>
                <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Your full name" required style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: textMuted, display: 'block', marginBottom: 6 }}>Phone</label>
                <input type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="+1 (555) 123-4567" style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: textMuted, display: 'block', marginBottom: 6 }}>Notes (optional)</label>
                <textarea value={clientNote} onChange={e => setClientNote(e.target.value)} placeholder="Any special requests..." rows={3}
                  style={{ ...inp, resize: 'vertical' }} />
              </div>

              {clientPhone && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 4 }}>
                  <input
                    type="checkbox"
                    checked={smsConsent}
                    onChange={e => setSmsConsent(e.target.checked)}
                    id="sms-consent"
                    style={{ marginTop: 3, width: 18, height: 18, accentColor: 'rgba(130,220,170,.7)', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <label htmlFor="sms-consent" style={{ fontSize: 12, color: textMuted, lineHeight: 1.5, cursor: 'pointer' }}>
                    I agree to receive appointment-related SMS (confirmations, reminders, changes) at the number provided. Msg frequency varies, up to 5 msgs per booking. Msg &amp; data rates may apply. Reply STOP to opt out, HELP for help. <a href="/privacy" target="_blank" rel="noopener" style={{ color: 'rgba(130,150,220,.6)', textDecoration: 'none' }}>Privacy</a> &amp; <a href="/terms" target="_blank" rel="noopener" style={{ color: 'rgba(130,150,220,.6)', textDecoration: 'none' }}>Terms</a>.
                  </label>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setStep(2)} style={{ padding: '12px 20px', background: 'none', border: `1px solid ${borderSoft}`, borderRadius: 12, color: textMuted, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Back</button>
              <button onClick={handleBook} disabled={!clientName || bookLoading} style={{
                flex: 1, padding: '14px', borderRadius: 12, fontSize: 15, fontFamily: 'inherit', cursor: !clientName || bookLoading ? 'default' : 'pointer',
                background: 'rgba(130,220,170,.1)', border: '1px solid rgba(130,220,170,.2)', color: 'rgba(130,220,170,.9)',
                opacity: !clientName || bookLoading ? 0.5 : 1,
              }}>{bookLoading ? 'Booking...' : 'Confirm Booking'}</button>
            </div>
          </div>
        )}

        {/* Step 4: Confirmed */}
        {booked && step === 4 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 999, margin: '0 auto 20px',
              background: 'rgba(130,220,170,.1)', border: '2px solid rgba(130,220,170,.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'rgba(130,220,170,.8)',
            }}>✓</div>
            <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6, color: textMain }}>Booking Confirmed!</h2>
            <p style={{ color: textMuted, fontSize: 14, lineHeight: 1.6 }}>
              {selectedService?.name}{!isSolo ? ` with ${selectedBarber?.name}` : ''}
            </p>
            <p style={{ color: 'rgba(130,150,220,.7)', fontSize: 16, fontWeight: 500, marginTop: 8, marginBottom: 32 }}>
              {fmtFullDate(selectedDate)} at {fmtTime(selectedSlot)}
            </p>
            <button onClick={resetBooking} style={{
              padding: '12px 28px', borderRadius: 12, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
              background: bgSubtle, border: `1px solid ${isLightTheme ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.1)'}`, color: textSoft,
            }}>Book Another</button>
          </div>
        )}
      </main>
      )}

      <footer style={{ padding: '20px 24px', borderTop: `1px solid ${borderSoft}`, textAlign: 'center', position: 'relative', zIndex: 2 }}>
        <a href="https://vurium.com/vuriumbook" target="_blank" rel="noopener" style={{ fontSize: 11, color: isLightTheme ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.12)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <img src="/logo-white.jpg" alt="" style={{ width: 14, height: 14, borderRadius: 3, opacity: isLightTheme ? 0.35 : 0.25, filter: isLightTheme ? 'none' : 'invert(1)' }} />
          Powered by VuriumBook
        </a>
      </footer>
    </div>
  )
}
