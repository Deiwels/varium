'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { loadStripe, Appearance } from '@stripe/stripe-js'
import { getStaffLabel } from '@/lib/terminology'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://vuriumbook-api-431945333485.us-central1.run.app'
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
const stripePromise = STRIPE_PK ? loadStripe(STRIPE_PK) : null

const stripeAppearanceDark: Appearance = {
  theme: 'night',
  variables: {
    colorPrimary: 'rgba(255,255,255,.85)',
    colorBackground: '#0d0d0d',
    colorText: '#e8e8ed',
    colorTextSecondary: 'rgba(255,255,255,.45)',
    colorDanger: 'rgba(220,130,160,.8)',
    borderRadius: '12px',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    fontSizeBase: '14px',
    spacingUnit: '4px',
    colorTextPlaceholder: 'rgba(255,255,255,.25)',
  },
  rules: {
    '.Input': { border: '1px solid rgba(255,255,255,.10)', backgroundColor: 'rgba(255,255,255,.04)', boxShadow: 'none', transition: 'border-color .2s' },
    '.Input:focus': { border: '1px solid rgba(255,255,255,.25)', boxShadow: '0 0 0 1px rgba(255,255,255,.08)' },
    '.Label': { color: 'rgba(255,255,255,.45)', fontSize: '12px', fontWeight: '500', letterSpacing: '.03em' },
    '.Tab': { border: '1px solid rgba(255,255,255,.08)', backgroundColor: 'rgba(255,255,255,.03)', color: 'rgba(255,255,255,.50)' },
    '.Tab--selected': { border: '1px solid rgba(255,255,255,.18)', backgroundColor: 'rgba(255,255,255,.06)', color: '#e8e8ed' },
    '.Tab:hover': { backgroundColor: 'rgba(255,255,255,.05)' },
    '.Block': { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,.06)' },
    '.Error': { color: 'rgba(220,130,160,.8)' },
  },
}

const stripeAppearanceLight: Appearance = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#333',
    borderRadius: '12px',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    fontSizeBase: '14px',
    spacingUnit: '4px',
  },
}

/* ── Inline Payment Form (rendered inside <Elements>) ── */
function InlinePaymentForm({ onSuccess, onError, amount, isLight, showAmount = true }: {
  onSuccess: (paymentIntentId: string) => void
  onError: (msg: string) => void
  amount: number
  isLight: boolean
  showAmount?: boolean
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState('')

  async function handlePay(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setPaying(true); setPayError('')
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      })
      if (error) {
        setPayError(error.message || 'Payment failed')
        onError(error.message || 'Payment failed')
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess(paymentIntent.id)
      } else {
        setPayError('Payment was not completed')
        onError('Payment was not completed')
      }
    } catch (err: any) {
      setPayError(err.message || 'Payment failed')
      onError(err.message || 'Payment failed')
    } finally { setPaying(false) }
  }

  const textMuted = isLight ? 'rgba(0,0,0,.45)' : 'rgba(255,255,255,.3)'

  return (
    <form onSubmit={handlePay}>
      <PaymentElement options={{ layout: 'tabs' }} />
      {payError && (
        <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(220,80,80,.08)', border: '1px solid rgba(220,80,80,.15)', color: 'rgba(255,160,160,.8)', fontSize: 13 }}>{payError}</div>
      )}
      <button type="submit" disabled={!stripe || paying} style={{
        width: '100%', marginTop: 20, padding: '14px', borderRadius: 12, fontSize: 15, fontFamily: 'inherit',
        cursor: !stripe || paying ? 'default' : 'pointer',
        background: 'rgba(130,220,170,.1)', border: '1px solid rgba(130,220,170,.2)', color: 'rgba(130,220,170,.9)',
        opacity: !stripe || paying ? 0.5 : 1,
      }}>
        {paying ? 'Processing payment…' : (showAmount ? `Pay $${(amount / 100).toFixed(2)} & Confirm` : 'Pay & Confirm')}
      </button>
    </form>
  )
}

interface Barber { id: string; name: string; photo_url?: string; level?: string; schedule?: any }
interface Service { id: string; name: string; duration_minutes: number; price_cents: number; barber_ids?: string[]; service_type?: string }
interface Config {
  shop_name?: string
  shop_address?: string
  shop_phone?: string
  shop_email?: string
  hero_media_url?: string
  bannerText?: string
  bannerEnabled?: boolean
  timezone?: string
  online_booking_enabled?: boolean
  waitlist_enabled?: boolean
  booking?: { cancellation_hours?: number }
  display?: { show_prices?: boolean; require_phone?: boolean; allow_notes?: boolean }
}
// Each selected service is tied to a specific barber
interface BookingLine { barberId: string; serviceId: string }

function escapeHtml(s: string): string {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim())
}

function isValidPhone(s: string): boolean {
  const digits = String(s || '').replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15
}

function formatTimezoneLabel(tz?: string): string {
  const zone = tz || 'America/Chicago'
  try {
    const shortName = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      timeZoneName: 'short',
    }).formatToParts(new Date()).find(part => part.type === 'timeZoneName')?.value
    return shortName && shortName !== zone ? `${zone} (${shortName})` : zone
  } catch {
    return zone
  }
}

function hashIdempotencyValue(input: string): string {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function processCustomHTML(html: string, data: { shopName: string; barbers: Barber[]; reviews: any[] }): string {
  let result = html
  // Simple variables
  result = result.replace(/\{\{shop_name\}\}/gi, escapeHtml(data.shopName))
  result = result.replace(/\{\{barber_count\}\}/gi, String(data.barbers.length))

  // {{#each barbers}}...{{/each}} loop
  result = result.replace(/\{\{#each barbers\}\}([\s\S]*?)\{\{\/each\}\}/gi, (_, tpl) => {
    return data.barbers.map(b => {
      let card = tpl as string
      card = card.replace(/\{\{name\}\}/g, escapeHtml(b.name || ''))
      card = card.replace(/\{\{photo_url\}\}/g, escapeHtml(b.photo_url || ''))
      card = card.replace(/\{\{level\}\}/g, escapeHtml(b.level || ''))
      card = card.replace(/\{\{id\}\}/g, escapeHtml(b.id || ''))
      card = card.replace(/\{\{initials\}\}/g, escapeHtml((b.name || '').split(' ').map(n => n[0]).join('').slice(0, 2)))
      return card
    }).join('')
  })

  // {{#each reviews}}...{{/each}} loop
  result = result.replace(/\{\{#each reviews\}\}([\s\S]*?)\{\{\/each\}\}/gi, (_, tpl) => {
    return data.reviews.slice(0, 10).map(r => {
      let item = tpl as string
      item = item.replace(/\{\{reviewer_name\}\}/g, escapeHtml(r.name || 'Anonymous'))
      item = item.replace(/\{\{rating\}\}/g, String(Number(r.rating) || 5))
      item = item.replace(/\{\{stars\}\}/g, '★'.repeat(Math.min(5, Number(r.rating) || 5)) + '☆'.repeat(5 - Math.min(5, Number(r.rating) || 5)))
      item = item.replace(/\{\{review_text\}\}/g, escapeHtml(r.text || ''))
      return item
    }).join('')
  })

  return result
}

function phoneHref(raw?: string): string {
  const digits = String(raw || '').replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : ''
}

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
  const [businessType, setBusinessType] = useState<string | null>(null)
  const [config, setConfig] = useState<Config>({})
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showBooking, setShowBooking] = useState(false) // for salon/custom: landing first

  // Booking state
  const [step, setStep] = useState(0) // 0=barber, 1=services(multi), 2=date/time, 3=info, 4=done
  const [bookingLines, setBookingLines] = useState<BookingLine[]>([])
  const [barberPickerService, setBarberPickerService] = useState<Service | null>(null) // popup state
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [bookingDraftHydrated, setBookingDraftHydrated] = useState(false)
  const [bookingDraftRestored, setBookingDraftRestored] = useState(false)
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientNote, setClientNote] = useState('')
  const [referencePhoto, setReferencePhoto] = useState<{ dataUrl: string; name: string } | null>(null)
  const [smsConsent, setSmsConsent] = useState(false)
  const [bookLoading, setBookLoading] = useState(false)
  const [booked, setBooked] = useState(false)
  const [error, setError] = useState('')

  // Waitlist state
  const [waitlistEnabled, setWaitlistEnabled] = useState(false)
  const [showWaitlistForm, setShowWaitlistForm] = useState(false)
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistPhone, setWaitlistPhone] = useState('')
  const [waitlistName, setWaitlistName] = useState('')
  const [waitlistNote, setWaitlistNote] = useState('')
  const [waitlistPhoto, setWaitlistPhoto] = useState<{ dataUrl: string; name: string } | null>(null)
  const [waitlistSmsConsent, setWaitlistSmsConsent] = useState(false)
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false)
  const [waitlistDone, setWaitlistDone] = useState(false)
  const [waitlistStartMin, setWaitlistStartMin] = useState(9 * 60)  // 9:00 AM
  const [waitlistEndMin, setWaitlistEndMin] = useState(18 * 60)     // 6:00 PM
  const bookingDraftKey = wsId ? `VB_PUBLIC_BOOKING_DRAFT_${wsId}` : ''

  // Payment state
  const [stripeConnected, setStripeConnected] = useState(false)
  const [payOnline, setPayOnline] = useState(false)
  const [paymentClientSecret, setPaymentClientSecret] = useState('')
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentBookingId, setPaymentBookingId] = useState('')

  // Parallax stars — idle/visibility optimized
  useEffect(() => {
    // Hide global cosmos when page has own .space-bg or AI template (full custom bg)
    const cosmos = document.getElementById('vurium-cosmos')
    if (cosmos) cosmos.style.display = 'none'
    // Also hide noise overlay for AI template
    const noise = document.querySelector('.noise-overlay') as HTMLElement
    if (noise) noise.style.display = 'none'

    const isMobile = window.matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window
    let tx = 0, ty = 0, cx = 0, cy = 0
    let raf = 0, running = false
    let idleTimer: ReturnType<typeof setTimeout> | null = null

    // Cache DOM refs once
    const pf = document.querySelector('.stars-far') as HTMLElement
    const pm = document.querySelector('.stars-mid') as HTMLElement
    const pn = document.querySelector('.stars-near') as HTMLElement

    function tick() {
      if (!running) return
      cx += (tx - cx) * 0.02; cy += (ty - cy) * 0.02
      if (Math.abs(tx - cx) < 0.001 && Math.abs(ty - cy) < 0.001) { running = false; return }
      if (pf) pf.style.transform = `translate(${cx * 8}px, ${cy * 8}px)`
      if (pm) pm.style.transform = `translate(${cx * 20}px, ${cy * 20}px)`
      if (pn) pn.style.transform = `translate(${cx * 35}px, ${cy * 35}px)`
      raf = requestAnimationFrame(tick)
    }
    function startLoop() { if (!running) { running = true; raf = requestAnimationFrame(tick) } }
    function onVisibility() { if (document.hidden) { running = false; cancelAnimationFrame(raf) } }
    document.addEventListener('visibilitychange', onVisibility)

    if (isMobile) {
      function onOrientation(e: DeviceOrientationEvent) {
        const gamma = Math.max(-15, Math.min(15, e.gamma || 0))
        const beta  = Math.max(-15, Math.min(15, (e.beta || 0) - 45))
        tx = gamma / 15 * 4; ty = beta / 15 * 4; startLoop()
      }
      const doe = DeviceOrientationEvent as any
      if (typeof doe.requestPermission === 'function') {
        function reqGyro() { doe.requestPermission().then((s: string) => { if (s === 'granted') window.addEventListener('deviceorientation', onOrientation, { passive: true }) }).catch(() => {}); document.removeEventListener('click', reqGyro) }
        document.addEventListener('click', reqGyro, { once: true })
      } else { window.addEventListener('deviceorientation', onOrientation, { passive: true }) }
      return () => { window.removeEventListener('deviceorientation', onOrientation); document.removeEventListener('visibilitychange', onVisibility); cancelAnimationFrame(raf); if (cosmos) cosmos.style.display = '' }
    }

    function onMouse(e: MouseEvent) {
      tx = (e.clientX / window.innerWidth - 0.5) * 2; ty = (e.clientY / window.innerHeight - 0.5) * 2
      startLoop()
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => { running = false }, 2000)
    }
    window.addEventListener('mousemove', onMouse, { passive: true })
    return () => { window.removeEventListener('mousemove', onMouse); document.removeEventListener('visibilitychange', onVisibility); cancelAnimationFrame(raf); if (idleTimer) clearTimeout(idleTimer); if (cosmos) cosmos.style.display = '' }
  }, [])

  const isSolo = barbers.length <= 1

  // Backward-compat: derive selectedServiceIds from bookingLines
  const selectedServiceIds = bookingLines.map(l => l.serviceId)
  // Resolve each line to its service, preserving duplicates
  const selectedServices = bookingLines.map(l => services.find(s => s.id === l.serviceId)).filter(Boolean) as Service[]
  const selectedService = selectedServices.length > 0 ? selectedServices[0] : null
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0) || 30
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price_cents, 0)
  const combinedServiceName = selectedServices.map(s => s.name).join(' + ')

  // Multi-barber helpers
  // Group booking lines by barber → { barberId: { barber, lines, duration } }
  const linesByBarber = (() => {
    const map: Record<string, { barber: Barber | undefined; lines: BookingLine[]; serviceIds: string[]; duration: number; serviceName: string }> = {}
    for (const l of bookingLines) {
      if (!map[l.barberId]) {
        const b = barbers.find(br => br.id === l.barberId)
        map[l.barberId] = { barber: b, lines: [], serviceIds: [], duration: 0, serviceName: '' }
      }
      const svc = services.find(s => s.id === l.serviceId)
      map[l.barberId].lines.push(l)
      map[l.barberId].serviceIds.push(l.serviceId)
      map[l.barberId].duration += svc?.duration_minutes || 30
    }
    for (const bid of Object.keys(map)) {
      map[bid].serviceName = map[bid].serviceIds.map(id => services.find(s => s.id === id)?.name || 'Service').join(' + ')
    }
    return map
  })()
  const involvedBarberIds = Object.keys(linesByBarber)
  const isMultiBarber = involvedBarberIds.length > 1

  function getBookingIdempotencyKey() {
    const fingerprint = JSON.stringify({
      wsId: resolvedWsId || wsId || '',
      startAt: selectedSlot || '',
      clientName: clientName.trim().toLowerCase(),
      clientEmail: clientEmail.trim().toLowerCase(),
      clientPhone: clientPhone.replace(/\D/g, ''),
      smsConsent: !!smsConsent,
      lines: bookingLines.map(line => `${line.barberId}:${line.serviceId}`).sort(),
    })
    return `vb-book-${hashIdempotencyValue(fingerprint)}`
  }

  useEffect(() => {
    if (typeof window === 'undefined' || !bookingDraftKey) return
    setBookingDraftHydrated(false)
    try {
      const rawDraft = window.sessionStorage.getItem(bookingDraftKey)
      if (rawDraft) {
        const draft = JSON.parse(rawDraft)
        const restored =
          (typeof draft.clientName === 'string' && !!draft.clientName.trim()) ||
          (typeof draft.clientPhone === 'string' && !!draft.clientPhone.trim()) ||
          (typeof draft.clientEmail === 'string' && !!draft.clientEmail.trim()) ||
          (typeof draft.clientNote === 'string' && !!draft.clientNote.trim()) ||
          (typeof draft.smsConsent === 'boolean' && draft.smsConsent)
        if (typeof draft.clientName === 'string') setClientName(draft.clientName)
        if (typeof draft.clientPhone === 'string') setClientPhone(draft.clientPhone)
        if (typeof draft.clientEmail === 'string') setClientEmail(draft.clientEmail)
        if (typeof draft.clientNote === 'string') setClientNote(draft.clientNote)
        if (typeof draft.smsConsent === 'boolean') setSmsConsent(draft.smsConsent)
        setBookingDraftRestored(!!restored)
      } else {
        setBookingDraftRestored(false)
      }
    } catch {
      setBookingDraftRestored(false)
    }
    setBookingDraftHydrated(true)
  }, [bookingDraftKey])

  useEffect(() => {
    if (typeof window === 'undefined' || !bookingDraftKey || !bookingDraftHydrated) return
    try {
      const hasDraft = !!(clientName.trim() || clientPhone.trim() || clientEmail.trim() || clientNote.trim() || smsConsent)
      if (!hasDraft) {
        window.sessionStorage.removeItem(bookingDraftKey)
        return
      }
      window.sessionStorage.setItem(bookingDraftKey, JSON.stringify({
        clientName,
        clientPhone,
        clientEmail,
        clientNote,
        smsConsent,
      }))
    } catch {}
  }, [bookingDraftHydrated, bookingDraftKey, clientEmail, clientName, clientNote, clientPhone, smsConsent])

  function clearBookingDraft() {
    if (typeof window === 'undefined' || !bookingDraftKey) return
    try { window.sessionStorage.removeItem(bookingDraftKey) } catch {}
    setBookingDraftRestored(false)
  }

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
      setBusinessType(resolved.business_type || null)
      setWaitlistEnabled(!!resolved.waitlist_enabled)
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
      setWaitlistEnabled(cfg?.waitlist_enabled ?? !!resolved.waitlist_enabled)
      setBarbers(bData?.barbers || [])
      setServices(sData?.services || [])
      setReviews(revData?.items || [])
      // Check if workspace has Stripe Connect for online payments
      if (stripePromise) {
        api(`/public/stripe-connect/create-payment-intent/${realWsId}`, {
          method: 'POST', body: JSON.stringify({ amount_cents: 0 }),
        }).then(r => {
          // "Amount too small" means Stripe IS connected; "Online payments not available" means not
          if (r.error && r.error !== 'Online payments not available') setStripeConnected(true)
          if (r.clientSecret) setStripeConnected(true)
        }).catch(() => {})
      }
      if ((bData?.barbers || []).length === 1) { setSelectedBarber((bData.barbers)[0]); setStep(1) }
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
    }).catch(() => { setError('Unable to connect. Check your internet and try again.') }).finally(() => setLoading(false))
  }, [wsId])

  // Load slots when barber(s) + date selected
  // For multi-barber: fetch availability for each barber individually, then intersect
  useEffect(() => {
    if (bookingLines.length === 0 || !selectedDate || !resolvedWsId) return
    // Single barber → simple fetch (backward compat)
    if (!isMultiBarber) {
      const bid = involvedBarberIds[0] || selectedBarber?.id
      if (!bid) return
      setSlotsLoading(true); setSlots([]); setSelectedSlot(''); setShowWaitlistForm(false); setWaitlistDone(false)
      api(`/public/availability/${resolvedWsId}`, {
        method: 'POST',
        body: JSON.stringify({ barber_id: bid, date: selectedDate, duration_minutes: totalDuration }),
      }).then(d => setSlots(d.slots || []))
        .catch(() => setError('Could not load available times. Please try again.'))
        .finally(() => setSlotsLoading(false))
      return
    }
    // Multi-barber → fetch per-barber availability, intersect
    setSlotsLoading(true); setSlots([]); setSelectedSlot(''); setShowWaitlistForm(false); setWaitlistDone(false)
    const fetches = involvedBarberIds.map(bid =>
      api(`/public/availability/${resolvedWsId}`, {
        method: 'POST',
        body: JSON.stringify({ barber_id: bid, date: selectedDate, duration_minutes: linesByBarber[bid].duration }),
      }).then(d => new Set<string>(d.slots || []))
    )
    Promise.all(fetches).then(sets => {
      if (sets.length === 0) { setSlots([]); return }
      // Intersection: a slot is available only if it appears in ALL sets
      const intersection = [...sets[0]].filter(s => sets.every(set => set.has(s)))
      intersection.sort()
      setSlots(intersection)
    }).catch(() => setError('Could not load available times. Please try again.'))
      .finally(() => setSlotsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(involvedBarberIds), JSON.stringify(Object.fromEntries(involvedBarberIds.map(b => [b, linesByBarber[b]?.duration]))), selectedDate, resolvedWsId])

  function selectBarber(b: Barber) {
    setSelectedBarber(b)
    setStep(1)
  }

  function addLine(serviceId: string, barberId: string) {
    setBookingLines(prev => [...prev, { barberId, serviceId }])
  }
  function removeLineAt(idx: number) {
    setBookingLines(prev => prev.filter((_, i) => i !== idx))
  }

  // When tapping a service in the checkbox list:
  // - If not selected yet: add with primary barber, OR show picker if multi-barber
  //   and there's already a primary service in the cart (so client can split between barbers)
  // - If already selected: remove the last instance of it
  function handleServiceTap(s: Service) {
    const hasIt = bookingLines.some(l => l.serviceId === s.id)
    if (hasIt) {
      // Remove last instance of this service
      const idx = bookingLines.map(l => l.serviceId).lastIndexOf(s.id)
      if (idx >= 0) removeLineAt(idx)
    } else {
      // If multi-barber shop AND there's already a primary service selected → show picker
      // so the client can choose which barber to assign this new service to
      const hasPrimaryAlready = bookingLines.some(l => {
        const svc = services.find(sv => sv.id === l.serviceId)
        return svc && svc.service_type !== 'addon'
      })
      const isThisPrimary = s.service_type !== 'addon'
      if (!isSolo && isThisPrimary && hasPrimaryAlready) {
        setBarberPickerService(s)
      } else {
        addLine(s.id, selectedBarber?.id || barbers[0]?.id || '')
      }
    }
  }

  // "Add another" for already-selected service → show barber picker (if multi-barber)
  function handleAddAnother(s: Service) {
    if (!isSolo) {
      // Always show barber picker in multi-barber shops so client can choose who to assign it to
      setBarberPickerService(s)
    } else {
      // Solo shop: just add another with the same barber
      addLine(s.id, selectedBarber?.id || barbers[0]?.id || '')
    }
  }

  function confirmServices() {
    if (bookingLines.length === 0) return
    setStep(2)
  }

  async function handleBook() {
    if (!clientName || !clientEmail || !selectedSlot) return
    if (bookingLines.length === 0) return
    if (!onlineBookingEnabled) { setError('Online booking is currently unavailable. Please contact the business directly.'); return }
    if (!isValidEmail(clientEmail)) { setError('Please enter a valid email address.'); return }
    if (requirePhone && !clientPhone.trim()) { setError('Please enter a phone number.'); return }
    if (clientPhone && !isValidPhone(clientPhone)) { setError('Please enter a valid phone number.'); return }
    setBookLoading(true); setError('')
    try {
      const noteWithPhoto = referencePhoto
        ? (clientNote ? `${clientNote}\nReference photo attached: ${referencePhoto.name}` : `Reference photo attached: ${referencePhoto.name}`)
        : clientNote
      const photoPayload = referencePhoto ? { data_url: referencePhoto.dataUrl, file_name: referencePhoto.name } : undefined
      const idempotencyKey = getBookingIdempotencyKey()

      let res: any
      if (isMultiBarber) {
        const groups = involvedBarberIds.map(bid => ({
          barber_id: bid,
          barber_name: linesByBarber[bid].barber?.name || '',
          service_ids: linesByBarber[bid].serviceIds,
          service_name: linesByBarber[bid].serviceName,
          duration_minutes: linesByBarber[bid].duration,
        }))
        res = await api(`/public/bookings-group/${resolvedWsId}`, {
          method: 'POST',
          body: JSON.stringify({
            start_at: selectedSlot, client_name: clientName,
            client_phone: clientPhone || undefined, client_email: clientEmail || undefined,
            sms_consent: clientPhone ? smsConsent : undefined,
            sms_consent_text: clientPhone && smsConsent ? smsConsentText : undefined,
            sms_consent_text_version: clientPhone && smsConsent ? smsConsentTextVersion : undefined,
            idempotency_key: idempotencyKey,
            customer_note: noteWithPhoto || undefined,
            reference_photo: photoPayload, bookings: groups,
          }),
        })
      } else {
        const bid = involvedBarberIds[0] || selectedBarber?.id || ''
        res = await api(`/public/bookings/${resolvedWsId}`, {
          method: 'POST',
          body: JSON.stringify({
            barber_id: bid,
            barber_name: linesByBarber[bid]?.barber?.name || selectedBarber?.name,
            start_at: selectedSlot, client_name: clientName,
            client_phone: clientPhone || undefined, client_email: clientEmail || undefined,
            sms_consent: clientPhone ? smsConsent : undefined,
            sms_consent_text: clientPhone && smsConsent ? smsConsentText : undefined,
            sms_consent_text_version: clientPhone && smsConsent ? smsConsentTextVersion : undefined,
            idempotency_key: idempotencyKey,
            service_id: selectedService?.id, service_ids: selectedServiceIds,
            service_name: combinedServiceName || 'Appointment',
            duration_minutes: totalDuration,
            customer_note: noteWithPhoto || undefined,
            reference_photo: photoPayload,
          }),
        })
      }
      if (res.error) {
        if (res.error.includes('outside') || res.error.includes('OUTSIDE')) {
          setSelectedSlot(''); setStep(2); throw new Error('This time slot is no longer available. Please choose another time.')
        }
        throw new Error(res.error)
      }
      clearBookingDraft()
      setBooked(true); setStep(4)
    } catch (e: any) {
      setError(e.message || 'Booking failed. Please try again.')
    } finally { setBookLoading(false) }
  }

  async function handlePayOnlineFlow() {
    if (!clientName || !clientEmail || !selectedSlot || bookingLines.length === 0) return
    if (!onlineBookingEnabled) { setError('Online booking is currently unavailable. Please contact the business directly.'); return }
    if (!isValidEmail(clientEmail)) { setError('Please enter a valid email address.'); return }
    if (requirePhone && !clientPhone.trim()) { setError('Please enter a phone number.'); return }
    if (clientPhone && !isValidPhone(clientPhone)) { setError('Please enter a valid phone number.'); return }
    setPaymentLoading(true); setError('')
    try {
      // 1. Create booking(s) first
      const payNoteWithPhoto = referencePhoto
        ? (clientNote ? `${clientNote}\nReference photo attached: ${referencePhoto.name}` : `Reference photo attached: ${referencePhoto.name}`)
        : clientNote
      const photoPayload = referencePhoto ? { data_url: referencePhoto.dataUrl, file_name: referencePhoto.name } : undefined
      const idempotencyKey = getBookingIdempotencyKey()

      let bookRes: any
      if (isMultiBarber) {
        const groups = involvedBarberIds.map(bid => ({
          barber_id: bid,
          barber_name: linesByBarber[bid].barber?.name || '',
          service_ids: linesByBarber[bid].serviceIds,
          service_name: linesByBarber[bid].serviceName,
          duration_minutes: linesByBarber[bid].duration,
        }))
        bookRes = await api(`/public/bookings-group/${resolvedWsId}`, {
          method: 'POST',
          body: JSON.stringify({
            start_at: selectedSlot, client_name: clientName,
            client_phone: clientPhone || undefined, client_email: clientEmail || undefined,
            sms_consent: clientPhone ? smsConsent : undefined,
            sms_consent_text: clientPhone && smsConsent ? smsConsentText : undefined,
            sms_consent_text_version: clientPhone && smsConsent ? smsConsentTextVersion : undefined,
            idempotency_key: idempotencyKey,
            customer_note: payNoteWithPhoto || undefined,
            reference_photo: photoPayload, bookings: groups,
          }),
        })
      } else {
        const bid = involvedBarberIds[0] || selectedBarber?.id || ''
        bookRes = await api(`/public/bookings/${resolvedWsId}`, {
          method: 'POST',
          body: JSON.stringify({
            barber_id: bid,
            barber_name: linesByBarber[bid]?.barber?.name || selectedBarber?.name,
            start_at: selectedSlot, client_name: clientName,
            client_phone: clientPhone || undefined, client_email: clientEmail || undefined,
            sms_consent: clientPhone ? smsConsent : undefined,
            sms_consent_text: clientPhone && smsConsent ? smsConsentText : undefined,
            sms_consent_text_version: clientPhone && smsConsent ? smsConsentTextVersion : undefined,
            idempotency_key: idempotencyKey,
            service_id: selectedService?.id, service_ids: selectedServiceIds,
            service_name: combinedServiceName || 'Appointment',
            duration_minutes: totalDuration,
            customer_note: payNoteWithPhoto || undefined,
            reference_photo: photoPayload,
          }),
        })
      }
      if (bookRes.error) {
        if (bookRes.error.includes('outside') || bookRes.error.includes('OUTSIDE')) {
          setSelectedSlot(''); setStep(2); throw new Error('This time slot is no longer available. Please choose another time.')
        }
        throw new Error(bookRes.error)
      }
      const bookingId = bookRes.booking_id || bookRes.id
      setPaymentBookingId(bookingId)
      // 2. Create payment intent
      const piRes = await api(`/public/stripe-connect/create-payment-intent/${resolvedWsId}`, {
        method: 'POST',
        body: JSON.stringify({
          amount_cents: totalPrice,
          booking_id: bookingId,
          client_name: clientName,
          description: `${combinedServiceName} – ${clientName}`,
        }),
      })
      if (piRes.error) throw new Error(piRes.error)
      setPaymentClientSecret(piRes.clientSecret)
    } catch (e: any) {
      setError(e.message || 'Could not initiate payment. Please try again.')
    } finally { setPaymentLoading(false) }
  }

  function onPaymentSuccess(_paymentIntentId: string) {
    // Booking already created, webhook will mark it paid
    clearBookingDraft()
    setBooked(true); setStep(4)
  }

  function onPaymentError(msg: string) {
    setError(msg)
  }

  function resetBooking() {
    clearBookingDraft()
    setStep(isSolo ? 1 : 0); setBookingLines([]); setSelectedSlot('')
    setSelectedDate(''); setClientName(''); setClientPhone('')
    setClientNote(''); setReferencePhoto(null); setBooked(false); setError('')
    setPayOnline(false); setPaymentClientSecret(''); setPaymentBookingId('')
    setShowWaitlistForm(false); setWaitlistDone(false); setWaitlistEmail(''); setWaitlistPhone(''); setWaitlistName(''); setWaitlistNote(''); setWaitlistPhoto(null); setWaitlistSmsConsent(false); setWaitlistStartMin(9 * 60); setWaitlistEndMin(18 * 60)
    if (!isSolo) setSelectedBarber(null)
  }

  function formatWaitlistPhone(raw: string) {
    const d = raw.replace(/\D/g, '').replace(/^1/, '').slice(0, 10)
    if (d.length === 0) return ''
    if (d.length <= 3) return `(${d}`
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  }

  async function handleJoinWaitlist() {
    if (!waitlistName.trim() || !selectedBarber || !selectedDate) return
    if (!waitlistHasContact) { setError('Add an email or phone number so we can reach you.'); return }
    if (trimmedWaitlistEmail && !waitlistHasValidEmail) { setError('Please enter a valid email address'); return }
    if (waitlistPhone && !waitlistHasValidPhone) { setError('Please enter a valid 10-digit phone number'); return }
    setWaitlistSubmitting(true); setError('')
    try {
      const res = await api(`/public/waitlist/${resolvedWsId}`, {
        method: 'POST',
        body: JSON.stringify({
          email: trimmedWaitlistEmail || undefined,
          phone: waitlistHasValidPhone ? `+1${waitlistPhoneDigits}` : undefined,
          barber_id: selectedBarber.id,
          barber_name: selectedBarber.name,
          date: selectedDate,
          client_name: waitlistName.trim(),
          service_ids: selectedServiceIds,
          service_names: selectedServices.map(s => s.name),
          duration_minutes: totalDuration,
          preferred_start_min: waitlistStartMin,
          preferred_end_min: waitlistEndMin,
          customer_note: allowBookingNotes ? waitlistNote || undefined : undefined,
          sms_consent: waitlistHasValidPhone ? waitlistSmsConsent : undefined,
          sms_consent_text: waitlistHasValidPhone && waitlistSmsConsent ? smsConsentText : undefined,
          sms_consent_text_version: waitlistHasValidPhone && waitlistSmsConsent ? smsConsentTextVersion : undefined,
          reference_photo: allowBookingNotes && waitlistPhoto ? { data_url: waitlistPhoto.dataUrl, file_name: waitlistPhoto.name } : undefined,
        }),
      })
      if (res.error) throw new Error(res.error)
      setWaitlistDone(true)
    } catch (e: any) {
      setError(e.message || 'Could not join waitlist. Please try again.')
    } finally { setWaitlistSubmitting(false) }
  }

  function getDates() {
    const tz = config.timezone || 'America/Chicago'
    const dates: { key: string; label: string; sub: string }[] = []
    const now = new Date()
    for (let i = 0; i < 14; i++) {
      const d = new Date(now.getTime() + i * 86400000)
      // Use workspace timezone for date key to avoid UTC date mismatch
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
      const key = parts // en-CA formats as YYYY-MM-DD
      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric' })
      const sub = i <= 1 ? '' : d.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' })
      dates.push({ key, label, sub })
    }
    return dates
  }

  function fmtTime(iso: string) {
    const tz = config.timezone || 'America/Chicago'
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz })
  }

  function fmtPrice(cents: number) { return '$' + (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2) }

  function fmtFullDate(key: string) {
    return new Date(key + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }

  const displayName = shopName || config.shop_name || 'Book an Appointment'
  const smsSenderName = shopName || config.shop_name || 'this business'
  const smsProgramName = shopName || config.shop_name
    ? `${smsSenderName} Appointment Notifications`
    : 'appointment notifications'
  const smsConsentTextVersion = 'booking-sms-optin-business-name-v1'
  const smsConsentText = `I agree to receive ${smsProgramName} via SMS (confirmations, reminders, reschedules, and cancellations). Message frequency may vary (up to 5 per booking). Standard message and data rates may apply. Reply STOP to opt out. Reply HELP for help. Consent is not a condition of purchase. Terms: https://vurium.com/terms Privacy Policy: https://vurium.com/privacy`
  const smsFooterComplianceText = `${shopName || config.shop_name ? smsProgramName : 'Appointment notifications'}: up to 5 messages per booking. Msg & data rates may apply. Reply STOP to opt out, HELP for help.`
  const bookingSettings = config.booking || {}
  const displaySettings = config.display || {}
  const onlineBookingEnabled = config.online_booking_enabled !== false
  const showPublicPrices = displaySettings.show_prices !== false
  const requirePhone = !!displaySettings.require_phone
  const allowBookingNotes = displaySettings.allow_notes !== false
  const cancellationHours = Math.max(0, Number(bookingSettings.cancellation_hours || 0))
  const publicAddress = String(config.shop_address || '').trim()
  const publicPhone = String(config.shop_phone || '').trim()
  const publicEmail = String(config.shop_email || '').trim()
  const hasBusinessDetails = !!(publicAddress || publicPhone || publicEmail)
  const featuredServices = services.slice(0, 6)
  const timezoneLabel = formatTimezoneLabel(config.timezone)
  const phoneReadyForBooking = clientPhone ? isValidPhone(clientPhone) : !requirePhone
  const canSubmitBooking = !!clientName.trim() && isValidEmail(clientEmail) && phoneReadyForBooking
  const bookingSubmitting = bookLoading || paymentLoading
  const trimmedWaitlistEmail = waitlistEmail.trim()
  const waitlistPhoneDigits = waitlistPhone.replace(/\D/g, '').replace(/^1/, '')
  const waitlistHasValidPhone = waitlistPhoneDigits.length >= 10
  const waitlistHasValidEmail = !!trimmedWaitlistEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedWaitlistEmail)
  const waitlistHasContact = waitlistHasValidEmail || waitlistHasValidPhone
  const waitlistCanSubmit = !!waitlistName.trim() && waitlistHasContact && (!trimmedWaitlistEmail || waitlistHasValidEmail) && (!waitlistPhone || waitlistHasValidPhone)
  const waitlistContactLabel = waitlistHasValidPhone
    ? formatWaitlistPhone(waitlistPhone)
    : (trimmedWaitlistEmail || '')

  // Styles
  // card & inp are defined after template is resolved (see below)
  let card: React.CSSProperties = { borderRadius: 16, padding: '20px 22px', cursor: 'pointer', transition: 'all .2s' }
  let inp: React.CSSProperties = { width: '100%', padding: '14px 16px', borderRadius: 12, fontSize: 15, outline: 'none', fontFamily: 'inherit' }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.3)', fontFamily: 'Inter, system-ui, sans-serif' }}>
      Loading booking page…
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
    custom:       { bg: '#000', text: '#e9e9e9', card: 'rgba(255,255,255,.04)', cardBorder: 'rgba(255,255,255,.08)', accent: '#0a84ff', headerBg: 'rgba(0,0,0,.5)' },
    ai:           { bg: 'transparent', text: '#f0f0f5', card: 'rgba(255,255,255,.025)', cardBorder: 'rgba(255,255,255,.06)', accent: '#fff', headerBg: 'rgba(0,0,0,.5)' },
  }
  // Individual: Vurium (modern) unless AI style. Salon/Custom: use selected template.
  const activeTemplate = template === 'ai' ? 'ai' : (effectivePlan === 'salon' || effectivePlan === 'custom') ? template : 'modern'
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

  // Custom code: click handler for data-action attributes
  const handleCustomBlockClick = (e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null
    if (!target) return
    e.preventDefault()
    const action = target.getAttribute('data-action')
    if (action === 'book') {
      if (!onlineBookingEnabled) return
      const barberId = target.getAttribute('data-barber-id')
      if (barberId) {
        const barber = barbers.find(b => b.id === barberId)
        if (barber) { setSelectedBarber(barber); setStep(1) }
      }
      setShowBooking(true)
    }
  }

  // Process custom HTML with template variables
  const processedCustomHTML = effectivePlan === 'custom' && siteConfig?.custom_html
    ? processCustomHTML(siteConfig.custom_html, { shopName: shopName || config.shop_name || '', barbers, reviews })
    : ''

  return (
    <div className="booking-page" style={{ minHeight: '100vh', background: t.bg, fontFamily: 'Inter, -apple-system, sans-serif', color: t.text, position: 'relative' }}>

      {/* AI-generated CSS */}
      {activeTemplate === 'ai' && siteConfig?.ai_css && <style dangerouslySetInnerHTML={{ __html: siteConfig.ai_css }} />}

      {/* Space background — bold & dark-luxury get their own stars; Vurium uses global cosmos from layout; AI template = clean canvas */}
      {!isLightTheme && activeTemplate !== 'modern' && activeTemplate !== 'ai' && (
        <div className="space-bg" style={{ position: 'fixed' }}>
          <div className="stars-wrap stars-wrap-far"><div className="stars stars-far" /></div>
          <div className="stars-wrap stars-wrap-mid"><div className="stars stars-mid" /></div>
          <div className="stars-wrap stars-wrap-near"><div className="stars stars-near" /></div>
          <div className="nebula-layer" style={{ width: 600, height: 350, top: '8%', left: '-10%', background: 'radial-gradient(ellipse at center, rgba(30,45,110,.10) 0%, transparent 70%)' }} />
          <div className="nebula-layer" style={{ width: 400, height: 250, top: '40%', right: '-8%', background: 'radial-gradient(ellipse at center, rgba(55,35,100,.06) 0%, transparent 70%)', animationDelay: '.5s' }} />
        </div>
      )}
      {!isLightTheme && activeTemplate !== 'modern' && activeTemplate !== 'ai' && <div className="noise-overlay" />}

      {/* Header */}
      <header className="bp-header" style={{ padding: '20px 24px', borderBottom: `1px solid ${t.cardBorder}`, background: t.headerBg, backdropFilter: isLightTheme ? 'none' : 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {(config.hero_media_url || siteConfig?.hero_image) && <img src={config.hero_media_url || siteConfig?.hero_image} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} />}
          <span style={{ fontSize: 16, fontWeight: 600, color: t.text }}>{shopName}</span>
        </div>
        <a href="https://vurium.com/vuriumbook" target="_blank" rel="noopener" style={{ fontSize: 11, color: isLightTheme ? 'rgba(0,0,0,.2)' : 'rgba(255,255,255,.15)', textDecoration: 'none' }}>Powered by VuriumBook&trade;</a>
      </header>

      {/* Banner */}
      {config.bannerEnabled && config.bannerText && (
        <div style={{ padding: '10px 24px', background: 'rgba(130,150,220,.06)', borderBottom: '1px solid rgba(130,150,220,.1)', fontSize: 13, color: 'rgba(130,150,220,.7)', textAlign: 'center' }}>
          {config.bannerText}
        </div>
      )}

      {/* ── SALON/CUSTOM LANDING PAGE ── */}
      {(effectivePlan === 'salon' || effectivePlan === 'custom') && !showBooking && (
        <main style={{ maxWidth: activeTemplate === 'custom' ? 1200 : 700, margin: '0 auto', padding: activeTemplate === 'custom' ? '20px 16px 80px' : '40px 20px 80px', position: 'relative', zIndex: 2 }}>

          {/* Default sections — hidden when "custom" template is active */}
          {activeTemplate !== 'custom' && (<>
          {/* Hero */}
          <div className="bp-hero" style={{ textAlign: 'center', marginBottom: 48 }}>
            {(config.hero_media_url || siteConfig?.hero_image) && (
              <div className="bp-hero-image" style={{ width: '100%', height: 200, borderRadius: 16, overflow: 'hidden', marginBottom: 24, border: '1px solid rgba(255,255,255,.06)' }}>
                <img src={config.hero_media_url || siteConfig?.hero_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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

          {/* Business details */}
          {hasBusinessDetails && (
            <div style={{ marginBottom: 40, padding: '20px 24px', borderRadius: 16, border: `1px solid ${t.cardBorder}`, background: t.card, backdropFilter: isLightTheme ? 'none' : 'blur(12px)' }}>
              <div className="bp-section-title" style={{ fontSize: 12, color: isLightTheme ? 'rgba(0,0,0,.4)' : 'rgba(255,255,255,.35)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 14 }}>Business details</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                {publicAddress && (
                  <div>
                    <div style={{ fontSize: 11, color: textDim, letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 6 }}>Location</div>
                    <div style={{ fontSize: 14, color: textMuted, lineHeight: 1.6 }}>{publicAddress}</div>
                  </div>
                )}
                {publicPhone && (
                  <div>
                    <div style={{ fontSize: 11, color: textDim, letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 6 }}>Phone</div>
                    <a href={phoneHref(publicPhone)} style={{ fontSize: 14, color: textMain, textDecoration: 'none' }}>{publicPhone}</a>
                  </div>
                )}
                {publicEmail && (
                  <div>
                    <div style={{ fontSize: 11, color: textDim, letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 6 }}>Email</div>
                    <a href={`mailto:${publicEmail}`} style={{ fontSize: 14, color: textMain, textDecoration: 'none', wordBreak: 'break-word' }}>{publicEmail}</a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Services preview */}
          {featuredServices.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <div className="bp-section-title" style={{ fontSize: 12, color: isLightTheme ? 'rgba(0,0,0,.4)' : 'rgba(255,255,255,.35)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 14 }}>Services</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                {featuredServices.map(s => (
                  <div key={s.id} style={{ padding: '14px 16px', borderRadius: 14, border: `1px solid ${t.cardBorder}`, background: t.card }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: textMain }}>{s.name}</div>
                      {showPublicPrices && s.price_cents > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(130,220,170,.75)' }}>{fmtPrice(s.price_cents)}</div>}
                    </div>
                    <div style={{ fontSize: 12, color: textMuted, marginTop: 5 }}>{s.duration_minutes} min</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Team */}
          {barbers.length > 1 && (
            <div style={{ marginBottom: 40 }}>
              <div className="bp-section-title" style={{ fontSize: 12, color: isLightTheme ? 'rgba(0,0,0,.4)' : 'rgba(255,255,255,.35)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 14 }}>Our {getStaffLabel(businessType, true)}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
                {barbers.map(b => (
                  <div key={b.id} className="bp-card" style={{ textAlign: 'center', padding: '16px 8px', borderRadius: 14, border: `1px solid ${t.cardBorder}`, background: t.card }}>
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
          </>)}
          {/* END default sections */}

          {/* Custom HTML/CSS — custom plan only, with template variables & interactive data-actions */}
          {effectivePlan === 'custom' && processedCustomHTML && (
            <>
              {siteConfig.custom_css && <style dangerouslySetInnerHTML={{ __html: siteConfig.custom_css }} />}
              <div
                className="custom-site-block"
                style={{ marginBottom: 40, position: 'relative', zIndex: 1 }}
                onClick={handleCustomBlockClick}
                dangerouslySetInnerHTML={{ __html: processedCustomHTML }}
              />
            </>
          )}

          {/* Book Now CTA — hidden for custom template since buttons are in custom HTML */}
          {activeTemplate !== 'custom' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            {onlineBookingEnabled ? (
              <button className="bp-btn" onClick={() => setShowBooking(true)} style={{
                padding: '16px 48px', borderRadius: 14, fontSize: 16, fontWeight: 600, fontFamily: 'inherit',
                background: isLightTheme ? t.accent : 'rgba(255,255,255,.1)',
                border: `1px solid ${isLightTheme ? t.accent : 'rgba(255,255,255,.15)'}`,
                color: isLightTheme ? '#fff' : t.text, cursor: 'pointer', transition: 'all .2s',
              }}>Book Now</button>
            ) : (
              <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 8, alignItems: 'center', padding: '16px 22px', borderRadius: 16, border: `1px solid ${t.cardBorder}`, background: t.card }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: textMain }}>Online booking is temporarily unavailable</div>
                <div style={{ fontSize: 13, color: textMuted, maxWidth: 360, lineHeight: 1.6 }}>Please contact the business directly to request an appointment.</div>
              </div>
            )}
          </div>
          )}
        </main>
      )}

      {/* ── BOOKING FLOW (all plans, or after Book Now for salon/custom) ── */}
      {!onlineBookingEnabled && effectivePlan === 'individual' && (
      <main className="bp-booking-flow" style={{ maxWidth: 560, margin: '0 auto', padding: '40px 20px 80px', position: 'relative', zIndex: 2 }}>
        <div style={{ ...card, cursor: 'default', textAlign: 'center', padding: '24px 22px' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: textMain, marginBottom: 8 }}>Booking is currently unavailable</div>
          <div style={{ fontSize: 14, color: textMuted, lineHeight: 1.7 }}>
            This business has temporarily turned off online booking. Please call, text, or email them directly for the latest availability.
          </div>
        </div>
      </main>
      )}

      {onlineBookingEnabled && (showBooking || effectivePlan === 'individual') && (
      <main className="bp-booking-flow" style={{ maxWidth: 560, margin: '0 auto', padding: '40px 20px 80px', position: 'relative', zIndex: 2 }}>

        {/* Back to landing (salon/custom only) */}
        {effectivePlan !== 'individual' && !booked && (
          <button onClick={() => { setShowBooking(false); setStep(isSolo ? 1 : 0); setBookingLines([]); setSelectedSlot('') }} style={{ marginBottom: 16, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', background: 'none', border: `1px solid ${borderSoft}`, color: textMuted }}>← Back</button>
        )}

        {/* Progress */}
        {!booked && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 36, alignItems: 'center', justifyContent: 'center' }}>
            {[!isSolo ? 'Staff' : null, 'Services', 'Date & Time', 'Your Info'].filter(Boolean).map((lbl, i) => {
              const actualStep = isSolo ? (i + 1) : i
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

        {/* Step 0: Team Member (salon mode only — solo skips to step 1) */}
        {step === 0 && !isSolo && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, color: textHeading }}>Choose your {getStaffLabel(businessType).toLowerCase()}</h2>
            <div style={{ fontSize: 13, color: textMuted, lineHeight: 1.6, marginTop: -8, marginBottom: 18 }}>
              Pick the person you want to book with first. You can still adjust services on the next step.
            </div>
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
          </div>
        )}

        {/* Barber picker popup — shown when adding a service that multiple barbers can do */}
        {barberPickerService && (() => {
          const svc = barberPickerService
          // Show all barbers — the client can decide who to assign this service to
          const eligible = barbers
          return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.70)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
              onClick={e => { if (e.target === e.currentTarget) setBarberPickerService(null) }}>
              <div style={{ width: 'min(360px, 92vw)', borderRadius: 22, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(6,6,12,.97)', padding: '24px 20px', boxShadow: '0 24px 80px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.04)' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#e8e8ed', marginBottom: 4, letterSpacing: '.01em' }}>Who is this for?</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.40)', marginBottom: 18 }}>{svc.name} — {svc.duration_minutes} min{showPublicPrices && svc.price_cents > 0 ? ` · ${fmtPrice(svc.price_cents)}` : ''}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {eligible.map(b => (
                    <button key={b.id} onClick={() => { addLine(svc.id, b.id); setBarberPickerService(null) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, cursor: 'pointer', border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', textAlign: 'left', fontFamily: 'inherit', transition: 'all .15s', width: '100%' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.14)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.08)' }}>
                      {b.photo_url ? (
                        <img src={b.photo_url} alt="" style={{ width: 40, height: 40, borderRadius: 12, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(255,255,255,.08)' }} />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,.50)', flexShrink: 0 }}>{b.name.charAt(0)}</div>
                      )}
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#e8e8ed' }}>{b.name}</div>
                        {b.level && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>{b.level}</div>}
                      </div>
                    </button>
                  ))}
                </div>
                <button onClick={() => setBarberPickerService(null)} style={{ width: '100%', marginTop: 14, padding: '11px', borderRadius: 12, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.45)', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', transition: 'all .15s' }}>Cancel</button>
              </div>
            </div>
          )
        })()}

        {/* Step 1: Services — multi-select with qty counter + barber picker */}
        {step === 1 && (() => {
          // Show all services available to the primary barber (or all if solo)
          const filteredServices = services.filter(s =>
            !s.barber_ids || s.barber_ids.length === 0 || (selectedBarber && s.barber_ids.includes(selectedBarber.id))
          )
          const primaryServices = filteredServices.filter(s => s.service_type !== 'addon')
          const addonServices = filteredServices.filter(s => s.service_type === 'addon')

          // Count qty of each service across all booking lines
          function qtyOf(svcId: string) {
            return bookingLines.filter(l => l.serviceId === svcId).length
          }

          function ServiceCard({ s }: { s: Service }) {
            const qty = qtyOf(s.id)
            const isSelected = qty > 0
            return (
              <div onClick={() => {
                if (isSelected) { handleAddAnother(s) } else { handleServiceTap(s) }
              }} style={{
                ...card,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                border: `1.5px solid ${isSelected ? 'rgba(130,150,220,.4)' : t.cardBorder}`,
                background: isSelected ? (isLightTheme ? 'rgba(99,102,241,.04)' : 'rgba(130,150,220,.06)') : t.card,
                padding: '14px 18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                  {qty === 0 ? (
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      border: `1.5px solid ${isLightTheme ? 'rgba(0,0,0,.15)' : 'rgba(255,255,255,.15)'}`,
                      background: 'transparent',
                    }} />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                      <button onClick={(e) => { e.stopPropagation(); handleServiceTap(s) }} style={{
                        width: 28, height: 28, borderRadius: 8, border: '1.5px solid rgba(130,150,220,.4)',
                        background: 'rgba(130,150,220,.12)', color: 'rgba(130,150,220,.9)',
                        cursor: 'pointer', fontWeight: 800, fontSize: 16, fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                      }}>−</button>
                      <span style={{ minWidth: 20, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'rgba(130,150,220,.9)' }}>{qty}</span>
                      <button onClick={(e) => { e.stopPropagation(); handleAddAnother(s) }} style={{
                        width: 28, height: 28, borderRadius: 8, border: '1.5px solid rgba(130,150,220,.4)',
                        background: 'rgba(130,150,220,.12)', color: 'rgba(130,150,220,.9)',
                        cursor: 'pointer', fontWeight: 800, fontSize: 16, fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                      }}>+</button>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: textMain }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: textMuted, marginTop: 2 }}>{s.duration_minutes} min</div>
                  </div>
                </div>
                {showPublicPrices && s.price_cents > 0 && <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(130,220,170,.7)', flexShrink: 0 }}>{fmtPrice(s.price_cents)}</div>}
              </div>
            )
          }

          return (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, color: textHeading }}>Select services</h2>
              <div style={{ fontSize: 13, color: textMuted, lineHeight: 1.6, marginTop: -8, marginBottom: 18 }}>
                Choose one or more services to build the appointment. Your time and total update automatically as you go.
              </div>

              {/* Primary Services */}
              {primaryServices.length > 0 && (
                <div style={{ marginBottom: addonServices.length > 0 ? 24 : 0 }}>
                  <div style={{ fontSize: 12, color: textMuted, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>Services</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {primaryServices.map(s => <ServiceCard key={s.id} s={s} />)}
                  </div>
                </div>
              )}

              {/* Add-ons */}
              {addonServices.length > 0 && (
                <div>
                  <div style={{ height: 1, background: borderSoft, marginBottom: 16 }} />
                  <div style={{ fontSize: 12, color: textMuted, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>Add-ons</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {addonServices.map(s => <ServiceCard key={s.id} s={s} />)}
                  </div>
                </div>
              )}

              {filteredServices.length === 0 && (
                <div style={{ textAlign: 'center', color: textDim, padding: '28px 24px', borderRadius: 16, border: `1px solid ${borderSoft}`, background: bgSubtle, lineHeight: 1.7 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: textMain, marginBottom: 6 }}>This booking menu is still being set up.</div>
                  <div style={{ fontSize: 13 }}>
                    There are no services live yet. Please contact the business directly if you need help booking.
                  </div>
                </div>
              )}

              {/* Your selection summary — shows each line with barber name */}
              {bookingLines.length > 0 && (
                <div style={{ marginTop: 20, padding: '14px 18px', borderRadius: 14, border: `1px solid ${borderSoft}`, background: bgSubtle }}>
                  <div style={{ fontSize: 12, color: textMuted, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 10 }}>Your selection</div>
                  {bookingLines.map((line, idx) => {
                    const svc = services.find(sv => sv.id === line.serviceId)
                    const barber = barbers.find(b => b.id === line.barberId)
                    if (!svc) return null
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: idx < bookingLines.length - 1 ? `1px solid ${borderSoft}` : 'none' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: textMain }}>{svc.name}</div>
                          {!isSolo && barber && <div style={{ fontSize: 11, color: textMuted, marginTop: 1 }}>with {barber.name}</div>}
                        </div>
                        <div style={{ fontSize: 11, color: textDim, flexShrink: 0 }}>{svc.duration_minutes} min</div>
                        {showPublicPrices && svc.price_cents > 0 && <div style={{ fontSize: 12, color: 'rgba(130,220,170,.65)', fontWeight: 600, flexShrink: 0 }}>{fmtPrice(svc.price_cents)}</div>}
                        <button onClick={() => removeLineAt(idx)} style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${isLightTheme ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.1)'}`, background: 'none', color: textDim, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>×</button>
                      </div>
                    )
                  })}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTop: `1px solid ${borderSoft}` }}>
                    <div style={{ fontSize: 13, color: textMuted }}>{bookingLines.length} service{bookingLines.length > 1 ? 's' : ''}{isMultiBarber ? ` · ${involvedBarberIds.length} team members` : ''}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: textSoft }}>
                      {totalDuration} min{showPublicPrices && totalPrice > 0 ? ` · ${fmtPrice(totalPrice)}` : ''}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                {!isSolo && (
                  <button onClick={() => setStep(0)} style={{ padding: '10px 20px', background: 'none', border: `1px solid ${borderSoft}`, borderRadius: 10, color: textMuted, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Back</button>
                )}
                <button onClick={confirmServices} disabled={bookingLines.length === 0} style={{
                  flex: 1, padding: '14px', borderRadius: 12, fontSize: 15, fontFamily: 'inherit',
                  cursor: bookingLines.length === 0 ? 'default' : 'pointer',
                  background: 'rgba(130,220,170,.1)', border: '1px solid rgba(130,220,170,.2)', color: 'rgba(130,220,170,.9)',
                  opacity: bookingLines.length === 0 ? 0.4 : 1,
                }}>Continue</button>
              </div>
            </div>
          )
        })()}

        {/* Step 2: Date & Time */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: isMultiBarber ? 8 : 20, color: textHeading }}>Pick date & time</h2>
            <div style={{ fontSize: 13, color: textMuted, lineHeight: 1.6, marginTop: isMultiBarber ? 0 : -8, marginBottom: 18 }}>
              Choose the day first, then select the time that works best for you.
            </div>
            {isMultiBarber && (
              <div style={{ fontSize: 12, color: 'rgba(130,150,220,.7)', marginBottom: 16, padding: '8px 12px', borderRadius: 10, background: isLightTheme ? 'rgba(99,102,241,.05)' : 'rgba(130,150,220,.06)', border: `1px solid ${isLightTheme ? 'rgba(99,102,241,.12)' : 'rgba(130,150,220,.15)'}` }}>
                Showing times when all {involvedBarberIds.length} team members are available
              </div>
            )}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 18, padding: '8px 12px', borderRadius: 999, border: `1px solid ${borderSoft}`, background: bgSubtle, fontSize: 12, color: textMuted }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: textDim }}>TZ</span>
              All times shown in {timezoneLabel}
            </div>

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
                  <div style={{ color: textDim, padding: 20, textAlign: 'center' }}>Checking available times…</div>
                ) : slots.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center' }}>
                    <div style={{ color: textMain, fontWeight: 600, marginBottom: 6 }}>No times are currently open for this day.</div>
                    <div style={{ color: textDim, fontSize: 13, lineHeight: 1.6 }}>
                      {waitlistEnabled
                        ? 'Try another date above, or join the waitlist below so we can reach out if something opens.'
                        : 'Try another date above, or contact the business directly for the latest availability.'}
                    </div>
                  </div>
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
                {/* Waitlist — always visible when enabled, regardless of slot availability */}
                {waitlistEnabled && !slotsLoading && !waitlistDone && (
                  <div style={{ marginTop: 16 }}>
                    {!showWaitlistForm ? (
                      <button onClick={() => setShowWaitlistForm(true)} style={{
                        width: '100%', padding: '12px 20px', borderRadius: 14, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
                        background: 'transparent', border: `1px solid ${borderSoft}`, color: textMuted,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}>
                        {slots.length === 0 ? 'Join waitlist — get notified when a slot opens' : 'Need a different time? Join the waitlist'}
                      </button>
                    ) : (
                      <div style={{ padding: 20, borderRadius: 16, border: `1px solid ${isLightTheme ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.08)'}`, background: isLightTheme ? 'rgba(0,0,0,.02)' : 'rgba(255,255,255,.03)' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: textHeading, marginBottom: 14 }}>Join the waitlist</div>
                        <div style={{ fontSize: 12, color: textMuted, marginBottom: 16, lineHeight: 1.5 }}>
                          We&apos;ll notify you if a slot opens up for {selectedBarber?.name} on {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}.
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          <div>
                            <label style={{ fontSize: 13, color: textMuted, display: 'block', marginBottom: 6 }}>Name *</label>
                            <input type="text" value={waitlistName} onChange={e => setWaitlistName(e.target.value)} placeholder="Your full name" required autoComplete="name" style={inp} disabled={waitlistSubmitting} />
                          </div>
                        <div>
                            <label style={{ fontSize: 13, color: textMuted, display: 'block', marginBottom: 6 }}>Email</label>
                            <input type="email" value={waitlistEmail} onChange={e => setWaitlistEmail(e.target.value)} placeholder="your@email.com" autoComplete="email" style={inp} disabled={waitlistSubmitting} />
                          </div>
                          <div>
                            <label style={{ fontSize: 13, color: textMuted, display: 'block', marginBottom: 6 }}>Phone</label>
                            <input type="tel" value={waitlistPhone} onChange={e => setWaitlistPhone(formatWaitlistPhone(e.target.value))} placeholder="+1 (555) 123-4567" autoComplete="tel" style={inp} disabled={waitlistSubmitting} />
                            <div style={{ fontSize: 11, color: textDim, marginTop: 6 }}>Add an email or phone number so we can reach you if a slot opens.</div>
                          </div>
                          {allowBookingNotes && (
                            <>
                              <div>
                                <label style={{ fontSize: 13, color: textMuted, display: 'block', marginBottom: 6 }}>Notes (optional)</label>
                                <textarea value={waitlistNote} onChange={e => setWaitlistNote(e.target.value)} placeholder="Any special requests..." rows={3} style={{ ...inp, resize: 'vertical' }} disabled={waitlistSubmitting} />
                              </div>
                              <div>
                                <label style={{ fontSize: 13, color: textMuted, display: 'block', marginBottom: 6 }}>Reference photo (optional)</label>
                                <div style={{ border: `1px dashed ${isLightTheme ? 'rgba(0,0,0,.15)' : 'rgba(255,255,255,.12)'}`, borderRadius: 12, padding: '12px 14px', background: isLightTheme ? 'rgba(0,0,0,.02)' : 'rgba(255,255,255,.02)' }}>
                                  <input type="file" accept="image/*" disabled={waitlistSubmitting} onChange={e => {
                                    const file = e.target.files?.[0]; if (!file) return
                                    if (file.size > 10 * 1024 * 1024) { setError('Photo must be under 10MB'); return }
                                    const reader = new FileReader()
                                    reader.onload = () => {
                                      const img = new Image()
                                      img.onload = () => {
                                        const maxW = 1200; const scale = img.width > maxW ? maxW / img.width : 1
                                        const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
                                        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
                                        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
                                        let q = 0.75; let dataUrl = canvas.toDataURL('image/jpeg', q)
                                        while (dataUrl.length > 500000 && q > 0.3) { q -= 0.1; dataUrl = canvas.toDataURL('image/jpeg', q) }
                                        setWaitlistPhoto({ dataUrl, name: file.name })
                                      }
                                      img.src = reader.result as string
                                    }
                                    reader.readAsDataURL(file); e.target.value = ''
                                  }} style={{ fontSize: 12, color: textMuted, fontFamily: 'inherit' }} />
                                  <div style={{ fontSize: 11, color: textDim, marginTop: 6 }}>Attach a reference photo of the style you want</div>
                                </div>
                                {waitlistPhoto && (
                                  <div style={{ marginTop: 10, position: 'relative', display: 'inline-block' }}>
                                    <img src={waitlistPhoto.dataUrl} alt="Reference" style={{ maxWidth: 200, maxHeight: 200, borderRadius: 12, objectFit: 'cover', border: `1px solid ${isLightTheme ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.1)'}` }} />
                                    <button onClick={() => setWaitlistPhoto(null)} disabled={waitlistSubmitting} style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 999, background: 'rgba(220,60,60,.8)', border: 'none', color: '#fff', cursor: waitlistSubmitting ? 'default' : 'pointer', opacity: waitlistSubmitting ? 0.55 : 1, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                          <div>
                            <label style={{ fontSize: 13, color: textMuted, display: 'block', marginBottom: 6 }}>Preferred time</label>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <select value={waitlistStartMin} onChange={e => setWaitlistStartMin(Number(e.target.value))} style={{ ...inp, flex: 1 }} disabled={waitlistSubmitting}>
                                {Array.from({ length: 28 }, (_, i) => {
                                  const m = 7 * 60 + i * 30
                                  const h = Math.floor(m / 60), mm = m % 60
                                  const ampm = h >= 12 ? 'PM' : 'AM'
                                  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
                                  return <option key={m} value={m}>{h12}:{String(mm).padStart(2, '0')} {ampm}</option>
                                })}
                              </select>
                              <span style={{ color: textDim, fontSize: 12, fontWeight: 600 }}>to</span>
                              <select value={waitlistEndMin} onChange={e => setWaitlistEndMin(Number(e.target.value))} style={{ ...inp, flex: 1 }} disabled={waitlistSubmitting}>
                                {Array.from({ length: 28 }, (_, i) => {
                                  const m = 7 * 60 + 30 + i * 30
                                  const h = Math.floor(m / 60), mm = m % 60
                                  const ampm = h >= 12 ? 'PM' : 'AM'
                                  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
                                  return <option key={m} value={m}>{h12}:{String(mm).padStart(2, '0')} {ampm}</option>
                                })}
                              </select>
                            </div>
                          </div>

                          {waitlistHasValidPhone && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 4 }}>
                              <input type="checkbox" checked={waitlistSmsConsent} onChange={e => setWaitlistSmsConsent(e.target.checked)} disabled={waitlistSubmitting} id="wl-sms-consent" style={{ marginTop: 3, width: 18, height: 18, accentColor: 'rgba(130,220,170,.7)', cursor: waitlistSubmitting ? 'default' : 'pointer', flexShrink: 0 }} />
                              <label htmlFor="wl-sms-consent" style={{ fontSize: 12, color: textMuted, lineHeight: 1.5, cursor: 'pointer' }}>
                                I agree to receive <strong>{smsProgramName}</strong> via SMS (confirmations, reminders, reschedules, and cancellations). Message frequency may vary (up to 5 per booking). Standard message and data rates may apply. Reply STOP to opt out. Reply HELP for help. Consent is not a condition of purchase. View our <a href="https://vurium.com/terms" target="_blank" rel="noopener" style={{ color: 'rgba(130,150,220,.6)', textDecoration: 'none' }}>Terms</a> and <a href="https://vurium.com/privacy" target="_blank" rel="noopener" style={{ color: 'rgba(130,150,220,.6)', textDecoration: 'none' }}>Privacy Policy</a>.
                              </label>
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                          <button onClick={() => setShowWaitlistForm(false)} disabled={waitlistSubmitting} style={{ padding: '12px 20px', borderRadius: 12, fontSize: 13, fontFamily: 'inherit', cursor: waitlistSubmitting ? 'default' : 'pointer', opacity: waitlistSubmitting ? 0.5 : 1, background: 'none', border: `1px solid ${borderSoft}`, color: textMuted }}>Cancel</button>
                          <button onClick={handleJoinWaitlist} disabled={waitlistSubmitting || !waitlistCanSubmit} style={{
                            flex: 1, padding: '14px', borderRadius: 12, fontSize: 15, fontFamily: 'inherit', cursor: waitlistSubmitting || !waitlistCanSubmit ? 'default' : 'pointer',
                            background: 'rgba(130,150,220,.1)', border: '1px solid rgba(130,150,220,.2)', color: 'rgba(130,150,220,.9)',
                            opacity: waitlistSubmitting || !waitlistCanSubmit ? 0.5 : 1,
                          }}>{waitlistSubmitting ? 'Joining waitlist…' : 'Join Waitlist'}</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {waitlistDone && (
                  <div style={{ marginTop: 16, padding: 20, borderRadius: 16, border: '1px solid rgba(130,220,170,.15)', background: 'rgba(130,220,170,.04)', textAlign: 'center' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 999, margin: '0 auto 12px', background: 'rgba(130,220,170,.1)', border: '1px solid rgba(130,220,170,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'rgba(130,220,170,.8)' }}>✓</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: textMain, marginBottom: 4 }}>You&apos;re on the waitlist!</div>
                    <div style={{ fontSize: 13, color: textMuted, lineHeight: 1.5 }}>
                      {waitlistContactLabel
                        ? `We’ll reach out at ${waitlistContactLabel} if a spot opens up.`
                        : 'We’ll notify you if a spot opens up.'}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(1)} style={{ padding: '10px 20px', background: 'none', border: `1px solid ${borderSoft}`, borderRadius: 10, color: textMuted, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Back</button>
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
            <div style={{ fontSize: 13, color: textMuted, lineHeight: 1.6, marginTop: -8, marginBottom: 18 }}>
              We&apos;ll keep these details on this device while you finish booking, even if you go back to change the time.
            </div>
            {bookingDraftRestored && (clientName || clientPhone || clientEmail || clientNote || smsConsent) && (
              <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 12, border: `1px solid ${isLightTheme ? 'rgba(99,102,241,.14)' : 'rgba(130,150,220,.18)'}`, background: isLightTheme ? 'rgba(99,102,241,.04)' : 'rgba(130,150,220,.08)', fontSize: 12, color: isLightTheme ? 'rgba(67,56,202,.78)' : 'rgba(195,205,255,.82)', lineHeight: 1.55 }}>
                Your saved details were restored on this device so you can keep booking without retyping everything.
              </div>
            )}

            {/* Summary */}
            <div style={{ ...card, cursor: 'default', marginBottom: 24, padding: '16px 20px' }}>
              {isMultiBarber ? (
                <div>
                  {involvedBarberIds.map(bid => {
                    const info = linesByBarber[bid]
                    return (
                      <div key={bid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', padding: '6px 0', borderBottom: `1px solid ${borderSoft}` }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: textMain }}>{info.serviceName}</div>
                          <div style={{ fontSize: 12, color: textMuted, marginTop: 2 }}>with {info.barber?.name} — {info.duration} min</div>
                        </div>
                      </div>
                    )
                  })}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: textDim }}>{bookingLines.length} services · {involvedBarberIds.length} team members</div>
                    {showPublicPrices && totalPrice > 0 && <div style={{ fontSize: 17, fontWeight: 600, color: 'rgba(130,220,170,.7)' }}>{fmtPrice(totalPrice)}</div>}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: textMain }}>{combinedServiceName || 'Appointment'}</div>
                    {!isSolo && <div style={{ fontSize: 13, color: textMuted, marginTop: 3 }}>with {selectedBarber?.name || linesByBarber[involvedBarberIds[0]]?.barber?.name}</div>}
                    <div style={{ fontSize: 12, color: textDim, marginTop: 2 }}>{totalDuration} min</div>
                  </div>
                  {showPublicPrices && totalPrice > 0 && (
                    <div style={{ fontSize: 17, fontWeight: 600, color: 'rgba(130,220,170,.7)' }}>{fmtPrice(totalPrice)}</div>
                  )}
                </div>
              )}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${borderSoft}`, fontSize: 14, fontWeight: 500, color: 'rgba(130,150,220,.7)' }}>
                {fmtFullDate(selectedDate)} at {fmtTime(selectedSlot)}
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: textDim }}>
                All times shown in {timezoneLabel}
              </div>
              {cancellationHours > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: textDim, lineHeight: 1.6 }}>
                  Self-service changes close {cancellationHours} hour{cancellationHours === 1 ? '' : 's'} before the appointment.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, color: textMuted, display: 'block', marginBottom: 6 }}>Name *</label>
                <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Your full name" required style={inp} disabled={bookingSubmitting} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: textMuted, display: 'block', marginBottom: 6 }}>Email *</label>
                <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="your@email.com" required style={inp} disabled={bookingSubmitting} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: textMuted, display: 'block', marginBottom: 6 }}>Phone {requirePhone ? '*' : '(optional)'}</label>
                <input type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="+1 (555) 123-4567" required={requirePhone} style={inp} disabled={bookingSubmitting} />
                <div style={{ fontSize: 10, color: textDim, marginTop: 4, lineHeight: 1.4 }}>
                  {requirePhone
                    ? 'Phone is required for this business. SMS still stays opt-in only.'
                    : 'Add a phone number if you want SMS confirmations and reminders.'}
                </div>
              </div>
              {allowBookingNotes && (
                <>
                  <div>
                    <label style={{ fontSize: 13, color: textMuted, display: 'block', marginBottom: 6 }}>Notes (optional)</label>
                    <textarea value={clientNote} onChange={e => setClientNote(e.target.value)} placeholder="Any special requests..." rows={3} disabled={bookingSubmitting}
                      style={{ ...inp, resize: 'vertical' }} />
                  </div>

                  <div>
                    <label style={{ fontSize: 13, color: textMuted, display: 'block', marginBottom: 6 }}>Reference photo (optional)</label>
                    <div style={{
                      border: `1px dashed ${isLightTheme ? 'rgba(0,0,0,.15)' : 'rgba(255,255,255,.12)'}`,
                      borderRadius: 12, padding: '12px 14px',
                      background: isLightTheme ? 'rgba(0,0,0,.02)' : 'rgba(255,255,255,.02)',
                    }}>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={bookingSubmitting}
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          if (file.size > 10 * 1024 * 1024) { setError('Photo must be under 10MB'); return }
                          const reader = new FileReader()
                          reader.onload = () => {
                            const img = new Image()
                            img.onload = () => {
                              const maxW = 1200
                              const scale = img.width > maxW ? maxW / img.width : 1
                              const w = Math.round(img.width * scale)
                              const h = Math.round(img.height * scale)
                              const canvas = document.createElement('canvas')
                              canvas.width = w; canvas.height = h
                              canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
                              let q = 0.75
                              let dataUrl = canvas.toDataURL('image/jpeg', q)
                              while (dataUrl.length > 500000 && q > 0.3) { q -= 0.1; dataUrl = canvas.toDataURL('image/jpeg', q) }
                              setReferencePhoto({ dataUrl, name: file.name })
                            }
                            img.src = reader.result as string
                          }
                          reader.readAsDataURL(file)
                          e.target.value = ''
                        }}
                        style={{ fontSize: 12, color: textMuted, fontFamily: 'inherit' }}
                      />
                      <div style={{ fontSize: 11, color: textDim, marginTop: 6 }}>Attach a reference photo of the style you want</div>
                    </div>
                    {referencePhoto && (
                      <div style={{ marginTop: 10, position: 'relative', display: 'inline-block' }}>
                        <img src={referencePhoto.dataUrl} alt="Reference" style={{
                          maxWidth: 200, maxHeight: 200, borderRadius: 12, objectFit: 'cover',
                          border: `1px solid ${isLightTheme ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.1)'}`,
                        }} />
                        <button onClick={() => setReferencePhoto(null)} disabled={bookingSubmitting} style={{
                          position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 999,
                          background: 'rgba(220,60,60,.8)', border: 'none', color: '#fff', cursor: bookingSubmitting ? 'default' : 'pointer', opacity: bookingSubmitting ? 0.55 : 1,
                          fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                        }}>×</button>
                        <div style={{ fontSize: 11, color: textDim, marginTop: 4 }}>{referencePhoto.name}</div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {clientPhone && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 4 }}>
                  <input
                    type="checkbox"
                    checked={smsConsent}
                    onChange={e => setSmsConsent(e.target.checked)}
                    disabled={bookingSubmitting}
                    id="sms-consent"
                    style={{ marginTop: 3, width: 18, height: 18, accentColor: 'rgba(130,220,170,.7)', cursor: bookingSubmitting ? 'default' : 'pointer', flexShrink: 0 }}
                  />
                  <label htmlFor="sms-consent" style={{ fontSize: 12, color: textMuted, lineHeight: 1.5, cursor: 'pointer' }}>
                    I agree to receive <strong>{smsProgramName}</strong> via SMS (confirmations, reminders, reschedules, and cancellations). Message frequency may vary (up to 5 per booking). Standard message and data rates may apply. Reply STOP to opt out. Reply HELP for help. Consent is not a condition of purchase. View our <a href="https://vurium.com/terms" target="_blank" rel="noopener" style={{ color: 'rgba(130,150,220,.6)', textDecoration: 'none' }}>Terms</a> and <a href="https://vurium.com/privacy" target="_blank" rel="noopener" style={{ color: 'rgba(130,150,220,.6)', textDecoration: 'none' }}>Privacy Policy</a>.
                  </label>
                </div>
              )}
              {clientPhone && !smsConsent && (
                <div style={{ fontSize: 11, color: 'rgba(220,160,80,.6)', marginTop: 6, paddingLeft: 28 }}>
                  SMS notifications stay optional even when a phone number is provided.
                </div>
              )}
            </div>

            {/* Payment option */}
            {stripeConnected && totalPrice > 0 && !paymentClientSecret && (
              <div style={{ marginTop: 20, padding: '16px 20px', borderRadius: 14, border: `1px solid ${borderSoft}`, background: bgSubtle }}>
                <div style={{ fontSize: 13, color: textMuted, marginBottom: 12, fontWeight: 500 }}>Payment</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setPayOnline(false)} disabled={bookingSubmitting} style={{
                    flex: 1, padding: '12px 10px', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', cursor: bookingSubmitting ? 'default' : 'pointer',
                    background: !payOnline ? 'rgba(130,220,170,.1)' : bgSubtle,
                    border: `1px solid ${!payOnline ? 'rgba(130,220,170,.2)' : borderSoft}`,
                    color: !payOnline ? 'rgba(130,220,170,.9)' : textMuted,
                    opacity: bookingSubmitting ? 0.55 : 1,
                  }}>Pay at salon</button>
                  <button onClick={() => setPayOnline(true)} disabled={bookingSubmitting} style={{
                    flex: 1, padding: '12px 10px', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', cursor: bookingSubmitting ? 'default' : 'pointer',
                    background: payOnline ? 'rgba(130,150,220,.12)' : bgSubtle,
                    border: `1px solid ${payOnline ? 'rgba(130,150,220,.2)' : borderSoft}`,
                    color: payOnline ? 'rgba(130,150,220,.9)' : textMuted,
                    opacity: bookingSubmitting ? 0.55 : 1,
                  }}>{showPublicPrices ? `Pay now (${fmtPrice(totalPrice)})` : 'Pay now'}</button>
                </div>
              </div>
            )}

            {/* Stripe Payment Form (shown after payment intent created) */}
            {paymentClientSecret && stripePromise && (
              <div style={{ marginTop: 20, padding: '20px', borderRadius: 14, border: `1px solid ${borderSoft}`, background: bgSubtle }}>
                <div style={{ fontSize: 13, color: textMuted, marginBottom: 14, fontWeight: 500 }}>Complete payment</div>
                <Elements stripe={stripePromise} options={{
                  clientSecret: paymentClientSecret,
                  appearance: isLightTheme ? stripeAppearanceLight : stripeAppearanceDark,
                  loader: 'auto',
                }}>
                  <InlinePaymentForm
                    onSuccess={onPaymentSuccess}
                    onError={onPaymentError}
                    amount={totalPrice}
                    isLight={isLightTheme}
                    showAmount={showPublicPrices}
                  />
                </Elements>
              </div>
            )}

            {!paymentClientSecret && (
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button onClick={() => setStep(2)} disabled={bookingSubmitting} style={{ padding: '12px 20px', background: 'none', border: `1px solid ${borderSoft}`, borderRadius: 12, color: textMuted, cursor: bookingSubmitting ? 'default' : 'pointer', opacity: bookingSubmitting ? 0.5 : 1, fontSize: 13, fontFamily: 'inherit' }}>Back</button>
                {payOnline ? (
                  <button onClick={handlePayOnlineFlow} disabled={!canSubmitBooking || bookingSubmitting} style={{
                    flex: 1, padding: '14px', borderRadius: 12, fontSize: 15, fontFamily: 'inherit',
                    cursor: !canSubmitBooking || bookingSubmitting ? 'default' : 'pointer',
                    background: 'rgba(130,150,220,.12)', border: '1px solid rgba(130,150,220,.2)', color: 'rgba(130,150,220,.9)',
                    opacity: !canSubmitBooking || bookingSubmitting ? 0.5 : 1,
                  }}>{paymentLoading ? 'Preparing secure checkout…' : showPublicPrices ? `Pay ${fmtPrice(totalPrice)} & Book` : 'Pay online & Book'}</button>
                ) : (
                  <button onClick={handleBook} disabled={!canSubmitBooking || bookingSubmitting} style={{
                    flex: 1, padding: '14px', borderRadius: 12, fontSize: 15, fontFamily: 'inherit', cursor: !canSubmitBooking || bookingSubmitting ? 'default' : 'pointer',
                    background: 'rgba(130,220,170,.1)', border: '1px solid rgba(130,220,170,.2)', color: 'rgba(130,220,170,.9)',
                    opacity: !canSubmitBooking || bookingSubmitting ? 0.5 : 1,
                  }}>{bookLoading ? 'Saving your booking…' : 'Confirm Booking'}</button>
                )}
              </div>
            )}
            {bookingSubmitting && !paymentClientSecret && (
              <div style={{ marginTop: 10, fontSize: 12, color: textDim, lineHeight: 1.55 }}>
                {paymentLoading
                  ? 'Checking availability and preparing secure payment...'
                  : 'Checking availability and confirming your appointment...'}
              </div>
            )}
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
              {combinedServiceName || 'Appointment'}
              {!isSolo && (isMultiBarber
                ? ` with ${involvedBarberIds.map(bid => linesByBarber[bid]?.barber?.name).filter(Boolean).join(' & ')}`
                : selectedBarber?.name ? ` with ${selectedBarber.name}` : ''
              )}
            </p>
            <p style={{ color: 'rgba(130,150,220,.7)', fontSize: 16, fontWeight: 500, marginTop: 8, marginBottom: 20 }}>
              {fmtFullDate(selectedDate)} at {fmtTime(selectedSlot)}
            </p>
            {clientEmail && (
              <div style={{
                margin: '0 auto 28px', maxWidth: 340, padding: '12px 16px',
                borderRadius: 12, background: isLightTheme ? 'rgba(0,0,0,.04)' : 'rgba(255,255,255,.04)',
                border: `1px solid ${isLightTheme ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.07)'}`,
                fontSize: 13, color: textMuted, lineHeight: 1.55, textAlign: 'center',
              }}>
                A confirmation was sent to <span style={{ color: textSoft, fontWeight: 500 }}>{clientEmail}</span>.
                <br />To reschedule or cancel, use the link in the email.
              </div>
            )}
            <button onClick={resetBooking} style={{
              padding: '12px 28px', borderRadius: 12, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
              background: bgSubtle, border: `1px solid ${isLightTheme ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.1)'}`, color: textSoft,
            }}>Book Another</button>
          </div>
        )}
      </main>
      )}

      <footer className="bp-footer" style={{ padding: '20px 24px', borderTop: `1px solid ${borderSoft}`, textAlign: 'center', position: 'relative', zIndex: 2 }}>
        <a href="https://vurium.com/vuriumbook" target="_blank" rel="noopener" style={{ fontSize: 11, color: isLightTheme ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.12)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <img src="/logo-white.jpg" alt="" style={{ width: 14, height: 14, borderRadius: 3, opacity: isLightTheme ? 0.35 : 0.25, filter: isLightTheme ? 'none' : 'invert(1)' }} />
          Powered by VuriumBook&trade;
        </a>
        <div className="bp-legal" style={{ fontSize: 10, color: isLightTheme ? 'rgba(0,0,0,.3)' : 'rgba(255,255,255,.22)', lineHeight: 1.6, maxWidth: 400, margin: '8px auto 0' }}>
          {smsFooterComplianceText}
          <div style={{ marginTop: 3 }}>
            <a href="https://vurium.com/privacy#sms" target="_blank" rel="noopener" style={{ color: isLightTheme ? 'rgba(0,0,0,.4)' : 'rgba(255,255,255,.3)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>Privacy Policy</a> &amp; <a href="https://vurium.com/terms#sms" target="_blank" rel="noopener" style={{ color: isLightTheme ? 'rgba(0,0,0,.4)' : 'rgba(255,255,255,.3)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>Terms</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
