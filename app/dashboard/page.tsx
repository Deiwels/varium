'use client'
import { useEffect, useState, useCallback } from 'react'
import Shell from '@/components/Shell'

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://vuriumbook-api-431945333485.us-central1.run.app'

// Decode HTML entities like &#x27; → '
function decHtml(s: string) {
  if (!s || !s.includes('&')) return s
  const el = typeof document !== 'undefined' ? document.createElement('textarea') : null
  if (!el) return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#x27;/g,"'").replace(/&#39;/g,"'")
  el.innerHTML = s; return el.value
}

interface Booking {
  id: string; client_name?: string; barber_name?: string; barber?: string
  barber_id?: string; service_name?: string; service?: string
  start_at?: string; status?: string; paid?: boolean
  is_paid?: boolean; payment_status?: string
}
interface BarberPayroll {
  barber_id: string; barber_name: string
  service_total: number; tips_total: number; barber_total: number
  barber_service_share: number; client_count: number; bookings_count: number
}

const money = (n: number) => '$' + Number(n || 0).toFixed(2)
const fmtTime = (iso?: string) => { try { return new Date(iso!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) } catch { return '—' } }
const isoToday = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}` }
const isoDate = (d: Date) => { const p = (n: number) => String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}` }
type EarningsPeriod = 'today' | 'week' | 'month'
function getDateRange(period: EarningsPeriod, offset: number): { from: string; to: string; label: string } {
  const now = new Date()
  if (period === 'today') {
    const d = new Date(now); d.setDate(d.getDate() + offset)
    const iso = isoDate(d)
    const label = offset === 0 ? 'Today' : offset === -1 ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    return { from: iso, to: iso, label }
  }
  if (period === 'week') {
    // Pay week: Sunday to Saturday
    const dow = now.getDay()
    const sun = new Date(now); sun.setDate(now.getDate() - dow + offset * 7)
    const sat = new Date(sun); sat.setDate(sun.getDate() + 6)
    const label = offset === 0 ? 'This week' : offset === -1 ? 'Last week'
      : `${sun.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — ${sat.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
    return { from: isoDate(sun), to: isoDate(sat), label }
  }
  // month
  const m = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const last = new Date(m.getFullYear(), m.getMonth() + 1, 0)
  const label = offset === 0 ? 'This month' : m.toLocaleDateString(undefined, { month: 'long', year: now.getFullYear() !== m.getFullYear() ? 'numeric' : undefined })
  return { from: isoDate(m), to: isoDate(last), label }
}
const fmtDateLong = () => new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  paid:      { borderColor: 'rgba(143,240,177,.40)', background: 'rgba(143,240,177,.10)', color: 'rgba(130,220,170,.5)' },
  booked:    { borderColor: 'rgba(10,132,255,.40)',  background: 'rgba(10,132,255,.10)',  color: 'rgba(130,150,220,.6)' },
  arrived:   { borderColor: 'rgba(143,240,177,.40)', background: 'rgba(143,240,177,.10)', color: 'rgba(130,220,170,.5)' },
  done:      { borderColor: 'rgba(255,207,63,.40)',  background: 'rgba(255,207,63,.08)',  color: 'rgba(220,190,130,.5)' },
  noshow:    { borderColor: 'rgba(255,107,107,.40)', background: 'rgba(255,107,107,.10)', color: 'rgba(220,130,160,.5)' },
  cancelled: { borderColor: 'rgba(255,107,107,.30)', background: 'rgba(255,107,107,.07)', color: 'rgba(220,130,160,.5)' },
}

function Chip({ label, type }: { label: string; type: string }) {
  const s = STATUS_STYLE[type] || {}
  return <span style={{ fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', padding: '4px 8px', borderRadius: 999, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(0,0,0,.12)', color: 'rgba(255,255,255,.70)', ...s }}>{label}</span>
}

function KpiCard({ title, value, sub, color }: { title: string; value: string; sub: string; color?: string }) {
  const dots: Record<string, string> = { ok: 'rgba(130,220,170,.8)', bad: '#ff6b6b', blue: 'rgba(255,255,255,.6)', gold: 'rgba(220,190,100,.8)' }
  return (
    <div style={{ borderRadius: 18, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.025)', backdropFilter: 'blur(12px)', padding: 16, transition: 'border-color .2s' }}>
      <div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)', marginBottom: 10 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.01em', lineHeight: 1, color: '#f0f0f5' }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,.35)' }}>
        {color && <span style={{ width: 6, height: 6, borderRadius: 999, background: dots[color] || 'rgba(255,255,255,.2)', flexShrink: 0, display: 'inline-block' }} />}
        {sub}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [myPayroll, setMyPayroll] = useState<BarberPayroll | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterBarber, setFilterBarber] = useState('')
  const [barbers, setBarbers] = useState<any[]>([])

  // Reviews
  const [reviews, setReviews] = useState<any[]>([])
  const [reviewFilter, setReviewFilter] = useState('')
  const [addingReview, setAddingReview] = useState(false)
  const [rvBarber, setRvBarber] = useState('')
  const [rvName, setRvName] = useState('')
  const [rvRating, setRvRating] = useState(5)
  const [rvText, setRvText] = useState('')
  const [rvSaving, setRvSaving] = useState(false)

  // Shop status & banner — owner/admin only
  const [shopStatus, setShopStatus] = useState<'auto'|'open'|'closed'>('auto')
  const [bannerEnabled, setBannerEnabled] = useState(false)
  const [bannerText, setBannerText] = useState('')
  const [statusSaving, setStatusSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  // Phone access log
  const [phoneAccessLog, setPhoneAccessLog] = useState<any[]>([])

  // Attendance
  const [clockedIn, setClockedIn] = useState(false)
  const [clockInTime, setClockInTime] = useState<string | null>(null)
  const [todayMinutes, setTodayMinutes] = useState(0)
  const [clockLoading, setClockLoading] = useState(false)
  const [clockError, setClockError] = useState('')
  const [clockSuccess, setClockSuccess] = useState<'in'|'out'|null>(null)
  const [clockErrorAnim, setClockErrorAnim] = useState(false)
  const [clockOutSummary, setClockOutSummary] = useState<{ hours: string; earnings: string; tips: string; clients: number; services: string } | null>(() => {
    // Restore clock-out summary from localStorage if same day
    try {
      const saved = JSON.parse(localStorage.getItem('VB_CLOCKOUT_SUMMARY') || 'null')
      if (saved && saved.date === isoToday()) return saved.data
    } catch {}
    return null
  })
  const [elapsedStr, setElapsedStr] = useState('')
  const [staffOnClock, setStaffOnClock] = useState<any[]>([])
  const [attHistory, setAttHistory] = useState<any[]>([])
  const [attSummary, setAttSummary] = useState<any>(null)
  const [attFrom, setAttFrom] = useState(() => isoToday())
  const [attTo, setAttTo] = useState(() => isoToday())
  const [attOpen, setAttOpen] = useState(false)
  const [attLoading, setAttLoading] = useState(false)

  const [earningsPeriod, setEarningsPeriod] = useState<EarningsPeriod>('today')
  const [earningsOffset, setEarningsOffset] = useState(0)

  // Get current user from localStorage
  const [user] = useState(() => {
    try { return JSON.parse(localStorage.getItem('VURIUMBOOK_USER') || 'null') } catch { return null }
  })
  const role: string = user?.role || 'owner'
  const isBarber = role === 'barber'
  const isStudent = role === 'student'
  const myBarberId: string = user?.barber_id || ''
  const myBarberName: string = user?.name || ''
  const isOwnerOrAdmin = role === 'owner' || role === 'admin'

  const loadAll = useCallback(async () => {
    const token = localStorage.getItem('VURIUMBOOK_TOKEN') || ''
    const headers: Record<string,string> = { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    const today = isoToday()
    const range = getDateRange(earningsPeriod, earningsOffset)
    if (!bookings.length && !myPayroll) setLoading(true) // only show loading on first load
    try {
      // Load barbers for name lookup — bookings for today (calendar), payroll for selected period
      const [bkRes, brRes] = await Promise.all([
        fetch(`${API}/api/bookings?from=${today}T00:00:00.000Z&to=${today}T23:59:59.999Z`, { headers }),
        fetch(`${API}/api/barbers`, { headers }),
      ])
      const bkData = await bkRes.json()
      const brData = await brRes.json()
      const barberList = Array.isArray(brData) ? brData : (brData?.barbers || [])
      const barberMap: Record<string, string> = {}
      barberList.forEach((b: any) => { if (b.id && b.name) barberMap[String(b.id)] = String(b.name) })

      let bks: Booking[] = Array.isArray(bkData?.bookings) ? bkData.bookings : Array.isArray(bkData) ? bkData : []

      // Enrich with barber names
      bks = bks.map(b => {
        const bn = b.barber_name || b.barber || ''
        // If barber_name looks like an ID (long alphanum) — replace with real name
        const isId = bn.length > 16 && /^[A-Za-z0-9]+$/.test(bn)
        const realName = b.barber_id ? barberMap[String(b.barber_id)] : undefined
        return { ...b, barber_name: (isId || !bn) ? (realName || bn) : bn }
      })

      // Extra client-side filter for barbers (safety)
      if (isBarber && myBarberId) {
        bks = bks.filter(b => String(b.barber_id || '') === myBarberId)
      }
      setBookings(bks)

      // Parse barbers schedule same as calendar — flat {startMin, endMin, days} from server
      const parsedBarbers = barberList.map((b: any) => {
        const raw = b.schedule || b.work_schedule
        let schedule = null
        if (raw && typeof raw === 'object') {
          if (Array.isArray(raw)) {
            schedule = { startMin: raw[1]?.startMin ?? 10*60, endMin: raw[1]?.endMin ?? 20*60, days: raw.map((d: any, i: number) => d.enabled ? i : -1).filter((i: number) => i >= 0) }
          } else if (raw.startMin !== undefined) {
            // Flat object — what server normalizeSchedule returns
            schedule = {
              startMin: Number(raw.startMin ?? 10*60),
              endMin: Number(raw.endMin ?? 20*60),
              days: Array.isArray(raw.days) ? raw.days.map(Number) : [1,2,3,4,5,6]
            }
          }
        }
        return { ...b, schedule }
      })
      setBarbers(parsedBarbers)

      // Load shop settings for owner/admin
      if (!isBarber) {
        try {
          const settRes = await fetch(`${API}/api/settings`, { credentials: 'include', headers })
          const settData = await settRes.json()
          if (settData.shopStatusMode) setShopStatus(settData.shopStatusMode)
          if (settData.banner) {
            setBannerEnabled(!!settData.banner.enabled)
            setBannerText(settData.banner.text || '')
          }
        } catch {}
      }

      // Payroll for barber — load their personal stats for selected period
      if (isBarber && myBarberId) {
        try {
          const pr = await fetch(`${API}/api/payroll?from=${range.from}T00:00:00.000Z&to=${range.to}T23:59:59.999Z`, { credentials: 'include', headers })
          const prData = await pr.json()
          const mine = (prData?.barbers || []).find((b: BarberPayroll) => b.barber_id === myBarberId)
          setMyPayroll(mine || null)
        } catch { setMyPayroll(null) }
      }
    } catch {}
    // Load reviews
    try {
      const rvRes = await fetch(`${API}/api/reviews`, { headers })
      const rvData = await rvRes.json()
      setReviews(rvData?.reviews || [])
    } catch { setReviews([]) }
    // Load attendance status
    try {
      const attStatusRes = await fetch(`${API}/api/attendance/status`, { credentials: 'include', headers })
      const attStatus = await attStatusRes.json()
      setClockedIn(!!attStatus.clocked_in)
      setClockInTime(attStatus.clock_in || null)
      setTodayMinutes(attStatus.today_minutes || 0)
    } catch { /* don't reset clock status on fetch error */ }
    // Admin: load who's on clock today
    if (!isBarber) {
      try {
        const staffRes = await fetch(`${API}/api/attendance?from=${today}&to=${today}`, { credentials: 'include', headers })
        const staffData = await staffRes.json()
        const records = staffData?.attendance || []
        // Currently clocked in = clock_out is null
        setStaffOnClock(records.filter((r: any) => !r.clock_out))
      } catch { setStaffOnClock([]) }
    }
    // Owner: load phone access log
    if (role === 'owner') {
      try {
        const palRes = await fetch(`${API}/api/admin/phone-access-log?limit=20`, { credentials: 'include', headers })
        const palData = await palRes.json()
        setPhoneAccessLog(palData?.logs || [])
      } catch { setPhoneAccessLog([]) }
    }
    setLoading(false)
  }, [isBarber, myBarberId, earningsPeriod, earningsOffset])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => { const t = setInterval(loadAll, 30000); return () => clearInterval(t) }, [loadAll])

  // For owner/admin: all barbers. For barber: only themselves
  const allBarberNames = [...new Set(bookings.map(b => b.barber_name || b.barber).filter(Boolean))] as string[]

  const filtered = bookings
    .filter(b => !filterBarber || (b.barber_name || b.barber) === filterBarber)
    .filter(b => !search || [b.client_name, b.barber_name, b.service_name].join(' ').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => String(a.start_at || '').localeCompare(String(b.start_at || '')))

  const total   = filtered.length
  const paid    = filtered.filter(b => b.paid || b.is_paid || b.payment_status === 'paid').length
  const noshow  = filtered.filter(b => b.status === 'noshow').length
  const upcoming = filtered.filter(b => b.status === 'booked' || b.status === 'arrived').length

  // Barber: show their payroll stats. Owner: show totals from bookings (rough)
  const barberEarnings = myPayroll?.barber_total || 0
  const barberTips     = myPayroll?.tips_total || 0
  const barberClients  = myPayroll?.client_count || total

  // Owner/Admin bars by barber
  const byBarber = bookings.reduce((acc, b) => {
    const name = b.barber_name || b.barber || '?'
    acc[name] = (acc[name] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const maxCount = Math.max(...Object.values(byBarber), 1)

  // Tools — plan-based access
  // Starter: Calendar, Clients, Payments, Settings
  // Pro: + Waitlist, Messages, Portfolio, Cash, Membership
  // Enterprise: + Expenses, Payroll
  const actions = [
    { label: 'Calendar', desc: 'Bookings & schedule', href: '/calendar', color: 'rgba(255,255,255,.4)' },
    { label: 'Clients', desc: 'Your client base', href: '/clients', color: 'rgba(255,255,255,.35)' },
    { label: 'Payments', desc: 'Transactions', href: '/payments', color: 'rgba(255,255,255,.35)' },
    { label: 'Waitlist', desc: 'Queue & notify', href: '/waitlist', color: 'rgba(255,255,255,.3)', pro: true },
    { label: 'Portfolio', desc: 'Work gallery', href: '/portfolio', color: 'rgba(255,255,255,.3)', pro: true },
    { label: 'Cash', desc: 'Daily register', href: '/cash', color: 'rgba(255,255,255,.3)', pro: true },
    { label: 'Membership', desc: 'Recurring clients', href: '/membership', color: 'rgba(255,255,255,.3)', pro: true },
    ...(role === 'owner' ? [
      { label: 'Expenses', desc: 'Track costs', href: '/expenses', color: 'rgba(255,255,255,.25)', enterprise: true },
      { label: 'Payroll', desc: 'Commission + tips', href: '/payroll', color: 'rgba(255,255,255,.25)', enterprise: true },
    ] : []),
    { label: 'Settings', desc: 'Config & team', href: '/settings', color: 'rgba(255,255,255,.25)' },
  ].filter(item => {
    if (isBarber && ['Clients', 'Payments', 'Cash', 'Membership', 'Expenses', 'Payroll', 'Settings'].includes(item.label)) return false
    if (isStudent && item.label !== 'Calendar') return false
    return true
  })

  async function saveShopStatus(mode: 'auto'|'open'|'closed') {
    setShopStatus(mode)
    setStatusSaving(true)
    try {
      const token = localStorage.getItem('VURIUMBOOK_TOKEN') || ''
      await fetch(`${API}/api/settings`, { credentials: 'include',
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopStatusMode: mode })
      })
      setStatusMsg('Saved ✓')
      setTimeout(() => setStatusMsg(''), 2000)
    } catch { setStatusMsg('Error') }
    setStatusSaving(false)
  }

  async function saveBanner() {
    setStatusSaving(true)
    try {
      const token = localStorage.getItem('VURIUMBOOK_TOKEN') || ''
      await fetch(`${API}/api/settings`, { credentials: 'include',
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ banner: { enabled: bannerEnabled, text: bannerText } })
      })
      setStatusMsg('Banner saved ✓')
      setTimeout(() => setStatusMsg(''), 2000)
    } catch { setStatusMsg('Error') }
    setStatusSaving(false)
  }

  const DAY_NAMES_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  // Attendance helpers
  const fmtMins = (m: number) => { const h = Math.floor(m / 60); const mm = m % 60; return h > 0 ? `${h}h ${mm}m` : `${mm}m` }
  const clockInSince = clockInTime ? new Date(clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : ''

  // Live elapsed timer
  useEffect(() => {
    if (!clockedIn || !clockInTime) { setElapsedStr(''); return }
    function tick() {
      const ms = Date.now() - new Date(clockInTime!).getTime()
      const h = Math.floor(ms / 3600000)
      const m = Math.floor((ms % 3600000) / 60000)
      setElapsedStr(h > 0 ? `${h}h ${m}m` : `${m}m`)
    }
    tick()
    const t = setInterval(tick, 30000)
    return () => clearInterval(t)
  }, [clockedIn, clockInTime])

  async function handleClockAction() {
    setClockLoading(true)
    setClockError('')
    const wasClocked = clockedIn
    try {
      let lat = 0, lng = 0
      try {
        if (!navigator.geolocation) throw new Error('Location is not supported by your browser. Please use a different device.')
        const perm = await navigator.permissions?.query({ name: 'geolocation' }).catch(() => null)
        if (perm && perm.state === 'denied') throw new Error('Location access is disabled. Please enable location in your device settings and try again.')
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
        })
        lat = pos.coords.latitude; lng = pos.coords.longitude
      } catch (gpsErr: any) {
        // For clock OUT — proceed without GPS (server allows it, caps to schedule end)
        if (wasClocked) { lat = 0; lng = 0 }
        else {
          const msg = gpsErr?.code === 1 ? 'Location access denied. Please enable location in your device settings and try again.'
            : gpsErr?.code === 2 ? 'Location unavailable. Please check that location services are turned on.'
            : gpsErr?.code === 3 ? 'Location request timed out. Please try again.'
            : gpsErr?.message || 'Location is required for clock-in. Please enable location services.'
          throw new Error(msg)
        }
      }
      const endpoint = clockedIn ? '/api/attendance/clock-out' : '/api/attendance/clock-in'
      const token = localStorage.getItem('VURIUMBOOK_TOKEN') || ''
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lat, lng })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      if (wasClocked) {
        // Clock out — fetch today's payroll for summary
        try {
          const today = isoToday()
          const pr = await fetch(`${API}/api/payroll?from=${today}T00:00:00.000Z&to=${today}T23:59:59.999Z`, { credentials: 'include', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } })
          const prData = await pr.json()
          const uid = user?.barber_id || user?.uid || ''
          const mine = (prData?.barbers || []).find((b: any) => b.barber_id === uid)
          const totalMins = data?.duration_minutes || todayMinutes
          const h = Math.floor(totalMins / 60)
          const m = totalMins % 60
          const summaryData = {
            hours: h > 0 ? `${h}h ${m}m` : `${m}m`,
            earnings: money(mine?.barber_total || 0),
            tips: money(mine?.tips_total || 0),
            clients: mine?.client_count || 0,
            services: money(mine?.barber_service_share || 0),
          }
          setClockOutSummary(summaryData)
          try { localStorage.setItem('VB_CLOCKOUT_SUMMARY', JSON.stringify({ date: isoToday(), data: summaryData })) } catch {}
        } catch {
          const totalMins = data?.duration_minutes || todayMinutes
          const h = Math.floor(totalMins / 60)
          const m = totalMins % 60
          const fallbackData = { hours: h > 0 ? `${h}h ${m}m` : `${m}m`, earnings: '—', tips: '—', clients: 0, services: '—' }
          setClockOutSummary(fallbackData)
          try { localStorage.setItem('VB_CLOCKOUT_SUMMARY', JSON.stringify({ date: isoToday(), data: fallbackData })) } catch {}
        }
        setClockSuccess('out')
        // After animation, keep summary visible (don't clear it — stays until midnight)
        setTimeout(() => { setClockSuccess(null) }, 3500)
      } else {
        setClockSuccess('in')
        setTimeout(() => { setClockSuccess(null); loadAll() }, 1400)
      }
    } catch (err: any) {
      let msg = err?.message || 'Clock action failed'
      if (err?.code === 1) msg = 'Location access denied. Enable GPS.'
      else if (err?.code === 2 || err?.code === 3) msg = 'Could not get location. Try again.'
      setClockError(msg)
      setClockErrorAnim(true)
      setTimeout(() => setClockErrorAnim(false), 3200)
    }
    setClockLoading(false)
  }

  async function loadAttHistory() {
    setAttLoading(true)
    try {
      const token = localStorage.getItem('VURIUMBOOK_TOKEN') || ''
      const res = await fetch(`${API}/api/attendance?from=${attFrom}&to=${attTo}`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
      })
      const data = await res.json()
      setAttHistory(data?.attendance || [])
      setAttSummary(data?.summary || null)
    } catch { setAttHistory([]); setAttSummary(null) }
    setAttLoading(false)
  }

  return (
    <Shell page="dashboard">
      <div className="dash-container" style={{ padding: '18px 18px 40px', maxWidth: 1400, margin: '0 auto', overflowY: 'auto', height: '100vh', color: '#e8e8ed', fontFamily: 'Inter, system-ui, sans-serif' }}>

        {/* Topbar removed — page name shown in Shell top-bar */}

        <style>{`
          @keyframes clockPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(143,240,177,0); }
            50% { box-shadow: 0 0 16px 4px rgba(143,240,177,.35); }
          }
          @keyframes clockDot {
            0%, 100% { opacity: .4; }
            50% { opacity: 1; }
          }
          @keyframes clockCheckIn {
            0% { opacity:0; transform:scale(.3) }
            50% { opacity:1; transform:scale(1.1) }
            70% { transform:scale(.95) }
            100% { transform:scale(1) }
          }
          @keyframes clockCheckDraw {
            0% { stroke-dashoffset: 32 }
            100% { stroke-dashoffset: 0 }
          }
          @keyframes clockRingDraw {
            0% { stroke-dashoffset: 160 }
            100% { stroke-dashoffset: 0 }
          }
          @keyframes clockSuccessGlow {
            0% { box-shadow: 0 0 0 rgba(143,240,177,0) }
            40% { box-shadow: 0 0 30px rgba(143,240,177,.40) }
            100% { box-shadow: 0 0 0 rgba(143,240,177,0) }
          }
          @keyframes clockOutGlow {
            0% { box-shadow: 0 0 0 rgba(255,107,107,0) }
            40% { box-shadow: 0 0 30px rgba(255,107,107,.35) }
            100% { box-shadow: 0 0 0 rgba(255,107,107,0) }
          }
          .clock-success-card { animation: clockCheckIn .45s cubic-bezier(.16,1.2,.3,1) both, clockSuccessGlow 1.4s ease-out both; }
          .clock-out-success-card { animation: clockCheckIn .45s cubic-bezier(.16,1.2,.3,1) both, clockOutGlow 1.4s ease-out both; }
          .clock-btn-morph { transition: all .4s cubic-bezier(.4,0,.2,1); }
          .clock-btn-morph:active { transform: scale(.92) }
          @keyframes clockSummaryIn {
            0% { opacity: 0; transform: scale(.92) }
            100% { opacity: 1; transform: scale(1) }
          }
          @keyframes clockSummaryItem {
            0% { opacity: 0; transform: translateY(8px) }
            100% { opacity: 1; transform: translateY(0) }
          }
          .clock-summary { animation: clockSummaryIn .4s cubic-bezier(.16,1,.3,1) both }
          .clock-summary-item { animation: clockSummaryItem .3s ease-out both }
          .clock-summary-item:nth-child(1) { animation-delay: .15s }
          .clock-summary-item:nth-child(2) { animation-delay: .25s }
          .clock-summary-item:nth-child(3) { animation-delay: .35s }
          .clock-summary-item:nth-child(4) { animation-delay: .45s }
          @keyframes radarSweep {
            0% { transform: rotate(0deg) }
            100% { transform: rotate(720deg) }
          }
          @keyframes radarRing1 {
            0% { transform: scale(.2); opacity: .6 }
            100% { transform: scale(1); opacity: 0 }
          }
          @keyframes radarRing2 {
            0% { transform: scale(.2); opacity: .5 }
            100% { transform: scale(.75); opacity: 0 }
          }
          @keyframes radarFadeIn {
            0% { opacity: 0 }
            100% { opacity: 1 }
          }
          @keyframes radarXIn {
            0% { opacity: 0; transform: scale(.3) rotate(-90deg) }
            60% { opacity: 1; transform: scale(1.1) rotate(5deg) }
            100% { transform: scale(1) rotate(0deg) }
          }
          @keyframes radarFadeOut {
            0%,70% { opacity: 1 }
            100% { opacity: 0 }
          }
          .radar-overlay { animation: radarFadeIn .2s ease-out, radarFadeOut 3.2s ease-in-out forwards }
          .radar-x { animation: radarXIn .4s cubic-bezier(.16,1.2,.3,1) 1.6s both }
          .radar-text { animation: radarFadeIn .3s ease-out 2s both }
          @media (max-width: 768px) {
            .dash-topbar-row { flex-direction: column !important; align-items: stretch !important; gap: 8px !important; }
            .dash-search { width: 100% !important; }
            .dash-kpi-grid { grid-template-columns: 1fr !important; }
            .dash-quick-grid { grid-template-columns: 1fr !important; }
            .dash-review-form-grid { grid-template-columns: 1fr !important; }
            .dash-container { padding: 12px 10px 40px !important; }
          }
        `}</style>
        {/* Clock in/out — hidden via CSS, moved to Settings > Features */}
        <div className="clock-section-hidden" style={{ display: 'none' }}>
        {clockOutSummary && !clockedIn ? (
          <div className={clockSuccess === 'out' ? 'clock-out-success-card' : ''} style={{ borderRadius: 18, border: '1px solid rgba(143,240,177,.20)', background: 'linear-gradient(180deg,rgba(143,240,177,.06),rgba(0,0,0,.30))', boxShadow: '0 10px 40px rgba(0,0,0,.35)', padding: '18px 16px', marginBottom: 14 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(143,240,177,.10)', border: '1px solid rgba(143,240,177,.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(130,220,170,.8)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: 'rgba(130,220,170,.5)' }}>Clocked out</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginTop: 1 }}>{clockOutSummary.hours} <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.40)' }}>today</span></div>
              </div>
            </div>
            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="clock-summary-item" style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)' }}>
                <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 4 }}>Earnings</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: 'rgba(130,220,170,.8)' }}>{clockOutSummary.earnings}</div>
              </div>
              <div className="clock-summary-item" style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)' }}>
                <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 4 }}>Tips</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: 'rgba(220,190,100,.8)' }}>{clockOutSummary.tips}</div>
              </div>
              <div className="clock-summary-item" style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)' }}>
                <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 4 }}>Services</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: 'rgba(130,150,220,.6)' }}>{clockOutSummary.services}</div>
              </div>
              <div className="clock-summary-item" style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)' }}>
                <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 4 }}>Clients</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{clockOutSummary.clients}</div>
              </div>
            </div>
          </div>
        ) : (
        <div className={clockSuccess === 'in' ? 'clock-success-card' : ''} style={{ borderRadius: 18, border: `1px solid ${clockSuccess === 'in' ? 'rgba(143,240,177,.50)' : clockedIn ? 'rgba(143,240,177,.25)' : 'rgba(255,255,255,.10)'}`, background: clockSuccess === 'in' ? 'linear-gradient(180deg,rgba(143,240,177,.14),rgba(143,240,177,.04))' : clockedIn ? 'linear-gradient(180deg,rgba(143,240,177,.06),rgba(143,240,177,.01))' : 'linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02))', boxShadow: '0 10px 40px rgba(0,0,0,.35)', padding: '14px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', transition: 'border-color .4s, background .4s' }}>
          {/* Status icon / Success checkmark */}
          {clockSuccess === 'in' ? (
            <div style={{ width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="32" height="32" viewBox="0 0 60 60">
                <circle cx="30" cy="30" r="24" fill="none" stroke="rgba(143,240,177,.70)" strokeWidth="2.5" strokeDasharray="160" strokeDashoffset="160" strokeLinecap="round" style={{ animation: 'clockRingDraw .5s ease-out .1s forwards' }} />
                <polyline points="20,32 27,39 40,24" fill="none" stroke="rgba(130,220,170,.8)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="32" strokeDashoffset="32" style={{ animation: 'clockCheckDraw .3s ease-out .35s forwards' }} />
              </svg>
            </div>
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: 14, background: clockedIn ? 'rgba(143,240,177,.12)' : 'rgba(255,255,255,.06)', border: `1px solid ${clockedIn ? 'rgba(143,240,177,.30)' : 'rgba(255,255,255,.12)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .4s' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={clockedIn ? 'rgba(130,220,170,.8)' : 'rgba(255,255,255,.45)'} strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
          )}
          {/* Text */}
          <div style={{ flex: 1, minWidth: 120 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {clockedIn && !clockSuccess && <span style={{ width: 8, height: 8, borderRadius: 999, background: 'rgba(130,220,170,.8)', display: 'inline-block', animation: 'clockDot 2s ease-in-out infinite' }} />}
              <span style={{ fontWeight: 800, fontSize: 14, color: clockSuccess === 'in' ? 'rgba(130,220,170,.8)' : clockedIn ? 'rgba(130,220,170,.5)' : 'rgba(255,255,255,.70)', transition: 'color .3s' }}>
                {clockSuccess === 'in' ? 'Clocked in!' : clockedIn ? `Clocked in since ${clockInSince}` : 'Not clocked in'}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.40)', marginTop: 2 }}>
              Today: {fmtMins(todayMinutes)}
            </div>
            {clockError && <div style={{ fontSize: 11, color: '#ff6b6b', marginTop: 4 }}>{clockError}</div>}
          </div>
          {/* Button */}
          {!clockSuccess && (
            <button onClick={handleClockAction} disabled={clockLoading} className="clock-btn-morph"
              style={{
                height: 44, padding: '0 22px', borderRadius: 999, cursor: clockLoading ? 'wait' : 'pointer',
                fontWeight: 900, fontSize: 13, fontFamily: 'inherit', letterSpacing: '.04em', textTransform: 'uppercase',
                border: `1px solid ${clockedIn ? 'rgba(255,107,107,.45)' : 'rgba(143,240,177,.45)'}`,
                background: clockedIn ? 'rgba(255,107,107,.12)' : 'rgba(143,240,177,.12)',
                color: clockedIn ? 'rgba(220,130,160,.5)' : 'rgba(130,220,170,.5)',
                opacity: clockLoading ? .5 : 1,
                animation: !clockLoading && !clockedIn ? 'clockPulse 2.6s ease-in-out infinite' : 'none',
                flexShrink: 0,
              }}>
              {clockLoading ? 'Locating…' : clockedIn ? 'Clock Out' : 'Clock In'}
            </button>
          )}
        </div>
        )}

        </div>{/* end clock-section-hidden */}

        {/* Radar error overlay */}
        {clockErrorAnim && (
          <div className="radar-overlay" style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
            {/* Radar */}
            <div style={{ position: 'relative', width: 160, height: 160, marginBottom: 24 }}>
              {/* Expanding rings */}
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgba(255,107,107,.20)', animation: 'radarRing1 1.6s ease-out infinite' }} />
              <div style={{ position: 'absolute', inset: 20, borderRadius: '50%', border: '1px solid rgba(255,107,107,.25)', animation: 'radarRing2 1.6s ease-out .4s infinite' }} />
              {/* Static rings */}
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid rgba(255,107,107,.10)' }} />
              <div style={{ position: 'absolute', inset: 20, borderRadius: '50%', border: '1px solid rgba(255,107,107,.08)' }} />
              <div style={{ position: 'absolute', inset: 40, borderRadius: '50%', border: '1px solid rgba(255,107,107,.06)' }} />
              {/* Cross lines */}
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(255,107,107,.08)' }} />
              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(255,107,107,.08)' }} />
              {/* Sweep line */}
              <div style={{ position: 'absolute', inset: 0, animation: 'radarSweep 1.6s linear forwards' }}>
                <div style={{ position: 'absolute', top: '50%', left: '50%', width: '50%', height: 2, background: 'linear-gradient(90deg, rgba(255,107,107,.80), transparent)', transformOrigin: '0 50%', boxShadow: '0 0 8px rgba(255,107,107,.50)' }} />
              </div>
              {/* Center dot */}
              <div style={{ position: 'absolute', top: '50%', left: '50%', width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,107,107,.80)', transform: 'translate(-50%,-50%)', boxShadow: '0 0 8px rgba(255,107,107,.60)' }} />
              {/* Red X */}
              <div className="radar-x" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="50" height="50" viewBox="0 0 50 50">
                  <line x1="15" y1="15" x2="35" y2="35" stroke="#ff6b6b" strokeWidth="4" strokeLinecap="round" />
                  <line x1="35" y1="15" x2="15" y2="35" stroke="#ff6b6b" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </div>
            </div>
            {/* Error text */}
            <div className="radar-text" style={{ textAlign: 'center', padding: '0 32px' }}>
              <div style={{ fontFamily: '"Inter",sans-serif', letterSpacing: '.16em', textTransform: 'uppercase', fontSize: 13, color: 'rgba(220,130,160,.5)', marginBottom: 6 }}>Location failed</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.50)', lineHeight: 1.5 }}>{clockError}</div>
            </div>
          </div>
        )}

        {/* Staff on clock — admin/owner only */}
        {isOwnerOrAdmin && staffOnClock.length > 0 && (
          <div style={{ borderRadius: 18, border: '1px solid rgba(143,240,177,.15)', background: 'linear-gradient(180deg,rgba(143,240,177,.04),rgba(143,240,177,.01))', boxShadow: '0 10px 40px rgba(0,0,0,.35)', padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)', marginBottom: 10, fontWeight: 900 }}>Staff on clock</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {staffOnClock.map((s: any) => {
                const since = s.clock_in ? new Date(s.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'
                const elapsed = s.clock_in ? Math.round((Date.now() - new Date(s.clock_in).getTime()) / 60000) : 0
                return (
                  <div key={s.id || s.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: 'rgba(130,220,170,.8)', animation: 'clockDot 2s ease-in-out infinite', flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#e8e8ed', flex: 1 }}>{s.user_name || 'Staff'}</span>
                    <span style={{ fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.50)' }}>{s.role}</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,.45)' }}>since {since}</span>
                    <span style={{ fontSize: 12, color: 'rgba(130,220,170,.8)', fontWeight: 700 }}>{fmtMins(elapsed)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Barber: earnings breakdown — right after clock in/out */}
        {isBarber ? (
              <div style={{ borderRadius: 18, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.025)', padding: 14, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.60)' }}>My earnings</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['today', 'week', 'month'] as EarningsPeriod[]).map(p => (
                      <button key={p} onClick={() => { setEarningsPeriod(p); setEarningsOffset(0) }} style={{
                        height: 24, padding: '0 8px', borderRadius: 6, border: `1px solid ${earningsPeriod === p ? 'rgba(10,132,255,.45)' : 'rgba(255,255,255,.10)'}`,
                        background: earningsPeriod === p ? 'rgba(10,132,255,.12)' : 'transparent',
                        color: earningsPeriod === p ? 'rgba(130,150,220,.6)' : 'rgba(255,255,255,.35)', fontSize: 9, fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '.06em', textTransform: 'uppercase',
                      }}>{p === 'today' ? 'Day' : p === 'week' ? 'Week' : 'Month'}</button>
                    ))}
                  </div>
                </div>
                {/* Period navigation */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 10 }}>
                  <button onClick={() => setEarningsOffset(o => o - 1)} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.50)', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&lsaquo;</button>
                  <div style={{ fontSize: 12, color: earningsOffset === 0 ? 'rgba(255,255,255,.60)' : 'rgba(130,150,220,.6)', fontWeight: 600, minWidth: 120, textAlign: 'center' }}>
                    {getDateRange(earningsPeriod, earningsOffset).label}
                  </div>
                  <button onClick={() => setEarningsOffset(o => Math.min(0, o + 1))} disabled={earningsOffset >= 0} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)', color: earningsOffset >= 0 ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.50)', cursor: earningsOffset >= 0 ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&rsaquo;</button>
                </div>
                {loading && !myPayroll ? <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 12 }}>Loading…</div> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { label: 'Services', value: money(myPayroll?.barber_service_share || 0), color: 'rgba(130,150,220,.6)' },
                      { label: 'Tips', value: money(barberTips), color: 'rgba(130,220,170,.8)' },
                      { label: 'Total payout', value: money(barberEarnings), color: '#fff', big: true },
                    ].map(row => (
                      <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.08)', background: row.big ? 'rgba(10,132,255,.08)' : 'rgba(0,0,0,.14)', borderColor: row.big ? 'rgba(10,132,255,.30)' : 'rgba(255,255,255,.08)' }}>
                        <span style={{ fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)' }}>{row.label}</span>
                        <span style={{ fontWeight: 900, fontSize: row.big ? 18 : 14, color: row.color }}>{row.value}</span>
                      </div>
                    ))}
                    {!myPayroll && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.30)', marginTop: 4 }}>Updates every 2 minutes</div>}
                  </div>
                )}
          </div>
        ) : null}

        {/* KPIs — barber sees their own earnings, owner sees totals */}
        <div className="dash-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 14 }}>
          {isBarber ? <>
            <KpiCard title="My bookings today" value={String(total)} sub={`${upcoming} upcoming`} color="blue" />
            <KpiCard title={`My earnings · ${getDateRange(earningsPeriod, earningsOffset).label}`} value={money(barberEarnings)} sub={`incl. ${money(barberTips)} tips`} color="ok" />
            <KpiCard title="My clients" value={String(barberClients)} sub={paid > 0 ? `${paid} paid` : ''} color="gold" />
            <KpiCard title="No-shows" value={String(noshow)} sub={noshow > 0 ? 'needs attention' : 'all good'} color={noshow > 0 ? 'bad' : undefined} />
          </> : <>
            <KpiCard title="Bookings today" value={String(total)} sub={`${upcoming} upcoming`} color="blue" />
            <KpiCard title="Paid / Unpaid" value={`${paid}/${total}`} sub={total - paid > 0 ? `${total - paid} unpaid` : 'all paid ✓'} color={paid === total && total > 0 ? 'ok' : 'gold'} />
            <KpiCard title="No-shows" value={String(noshow)} sub={noshow > 0 ? 'needs attention' : 'all good'} color={noshow > 0 ? 'bad' : undefined} />
            <KpiCard title="Team working" value={String(Object.keys(byBarber).length)} sub="today" color="blue" />
          </>}
        </div>

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Booking page link */}
            {!isBarber && user?.workspace_id && (
              <div style={{ borderRadius: 18, border: '1px solid rgba(130,150,220,.12)', background: 'linear-gradient(180deg,rgba(130,150,220,.05),rgba(255,255,255,.02))', padding: 14 }}>
                <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(130,150,220,.6)', marginBottom: 10 }}>Your Booking Page</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <code style={{ flex: 1, fontSize: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.08)', color: 'rgba(130,150,220,.8)', wordBreak: 'break-all', minWidth: 0 }}>
                    vurium.com/book/{user.workspace_id}
                  </code>
                  <button onClick={() => { navigator.clipboard.writeText(`https://vurium.com/book/${user.workspace_id}`); }} style={{
                    padding: '10px 16px', borderRadius: 10, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
                    background: 'rgba(130,150,220,.1)', border: '1px solid rgba(130,150,220,.2)', color: 'rgba(130,150,220,.8)',
                  }}>Copy Link</button>
                  <a href={`/book/${user.workspace_id}`} target="_blank" rel="noopener" style={{
                    padding: '10px 16px', borderRadius: 10, fontSize: 12, textDecoration: 'none', flexShrink: 0,
                    background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', color: 'rgba(255,255,255,.5)',
                  }}>Preview</a>
                </div>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', marginTop: 8 }}>Share this link with your clients so they can book online.</p>
              </div>
            )}

            {/* Quick actions */}
            <div style={{ borderRadius: 18, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.025)', padding: 14 }}>
              <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.60)', marginBottom: 12 }}>Tools</div>
              <div className="dash-quick-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                {actions.map(item => (
                  <a key={item.href} href={item.href} style={{ padding: '13px 12px', borderRadius: 14, border: `1px solid ${(item as any).color ? (item as any).color.replace(/[\d.]+\)$/, '.12)') : 'rgba(255,255,255,.10)'}`, background: (item as any).color ? (item as any).color.replace(/[\d.]+\)$/, '.04)') : 'rgba(0,0,0,.14)', cursor: 'pointer', display: 'block', textDecoration: 'none', transition: 'all .2s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{ width: 3, height: 14, borderRadius: 2, background: (item as any).color || 'rgba(255,255,255,.3)' }} />
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#e8e8ed' }}>{item.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', lineHeight: 1.4, paddingLeft: 11 }}>{item.desc}</div>
                  </a>
                ))}
              </div>
            </div>

            {/* Owner: today by barber */}
            {!isBarber && (
              <div style={{ borderRadius: 18, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.025)', padding: 14 }}>
                <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.60)', marginBottom: 12 }}>Today by team member</div>
                {Object.entries(byBarber).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                    <span style={{ width: 70, fontWeight: 700, fontSize: 12, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                    <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'rgba(255,255,255,.08)' }}>
                      <div style={{ height: 6, borderRadius: 999, background: 'linear-gradient(90deg,rgba(130,150,220,.9),rgba(10,132,255,.5))', width: `${Math.round(count / maxCount * 100)}%`, transition: 'width .6s ease' }} />
                    </div>
                    <span style={{ width: 50, textAlign: 'right', fontSize: 12, color: 'rgba(255,255,255,.55)' }}>{count} bk</span>
                  </div>
                ))}
                {Object.keys(byBarber).length === 0 && <div style={{ color: 'rgba(255,255,255,.30)', fontSize: 12 }}>No data yet</div>}
              </div>
            )}

          </div>
        </div>
          {/* ── OWNER/ADMIN ONLY: Shop Status + Banner + Barbers ── */}
          {isOwnerOrAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>

              {/* Team — days + ratings */}
              <div style={{ borderRadius: 18, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.025)', padding: 16 }}>
                <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.60)', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Team</span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,.25)', textTransform: 'none', letterSpacing: 0 }}>Tap days: green — works, red — day off</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {barbers.map((b: any) => {
                    const sched = b.schedule
                    const workDays: number[] = Array.isArray(sched?.days) ? sched.days : [1,2,3,4,5,6]
                    return (
                      <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, border: '1px solid rgba(255,255,255,.07)', background: 'rgba(0,0,0,.12)' }}>
                        {b.photo_url
                          ? <img src={b.photo_url} alt={b.name} style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'cover', border: '1px solid rgba(255,255,255,.12)', flexShrink: 0 }} onError={e => (e.currentTarget.style.display='none')} />
                          : <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, flexShrink: 0 }}>{(b.name||'?')[0]}</div>
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{b.name}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                            {DAY_NAMES_SHORT.map((day, i) => {
                              const works = workDays.includes(i)
                              return (
                                <span key={day} style={{ fontSize: 9, padding: '2px 7px', borderRadius: 999, border: `1px solid ${works ? 'rgba(143,240,177,.40)' : 'rgba(255,107,107,.28)'}`, background: works ? 'rgba(143,240,177,.10)' : 'rgba(255,107,107,.07)', color: works ? 'rgba(130,220,170,.8)' : 'rgba(220,130,160,.5)', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700 }}>
                                  {day}
                                </span>
                              )
                            })}
                          </div>
                          {(() => {
                            const fmt = (m: number) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`
                            const sm = sched?.startMin ?? 600
                            const em = sched?.endMin ?? 1200
                            return (
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                <span>{fmt(sm)} — {fmt(em)}</span>
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                    )
                  })}
                  {barbers.length === 0 && <div style={{ color: 'rgba(255,255,255,.30)', fontSize: 12 }}>Loading…</div>}
                </div>
              </div>

            </div>
          )}

          {/* ─── Reviews — hidden, moved to separate page ─── */}
          {false && isOwnerOrAdmin && (
            <div style={{ marginTop: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)', fontWeight: 900 }}>
                  Reviews ({reviews.length})
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setAddingReview(!addingReview)}
                    style={{ height: 30, padding: '0 12px', borderRadius: 999, border: '1px solid rgba(255,207,63,.45)', background: 'rgba(255,207,63,.08)', color: 'rgba(220,190,130,.5)', cursor: 'pointer', fontWeight: 700, fontSize: 11, fontFamily: 'inherit' }}>
                    {addingReview ? 'Cancel' : '+ Add review'}
                  </button>
                </div>
              </div>

              {/* Add review form */}
              {addingReview && (
                <div style={{ padding: 14, borderRadius: 16, border: '1px solid rgba(255,207,63,.20)', background: 'rgba(255,207,63,.04)', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="dash-review-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.40)', marginBottom: 4 }}>Barber</div>
                      <select value={rvBarber} onChange={e => setRvBarber(e.target.value)}
                        style={{ width: '100%', height: 40, borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)', color: '#fff', padding: '0 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
                        <option value="">Select team member</option>
                        {barbers.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.40)', marginBottom: 4 }}>Client name</div>
                      <input value={rvName} onChange={e => setRvName(e.target.value)} placeholder="Client name"
                        style={{ width: '100%', height: 40, borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)', color: '#fff', padding: '0 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.40)', marginBottom: 4 }}>Rating</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[1,2,3,4,5].map(n => (
                        <button key={n} onClick={() => setRvRating(n)} type="button"
                          style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${n <= rvRating ? 'rgba(255,207,63,.55)' : 'rgba(255,255,255,.10)'}`, background: n <= rvRating ? 'rgba(255,207,63,.14)' : 'rgba(255,255,255,.04)', color: n <= rvRating ? 'rgba(220,190,130,.5)' : 'rgba(255,255,255,.30)', cursor: 'pointer', fontSize: 16, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.40)', marginBottom: 4 }}>Review text</div>
                    <textarea value={rvText} onChange={e => setRvText(e.target.value)} placeholder="Great experience…" rows={3}
                      style={{ width: '100%', borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)', color: '#fff', padding: '10px', fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical' as const }} />
                  </div>
                  <button onClick={async () => {
                    if (!rvBarber || !rvName.trim()) return
                    setRvSaving(true)
                    try {
                      const token = localStorage.getItem('VURIUMBOOK_TOKEN') || ''
                      const barber = barbers.find((b: any) => b.id === rvBarber)
                      await fetch(`${API}/api/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ barber_id: rvBarber, barber_name: barber?.name || '', name: rvName.trim(), rating: rvRating, text: rvText.trim(), source: 'crm', status: 'approved' }) })
                      setRvName(''); setRvText(''); setRvRating(5); setAddingReview(false); loadAll()
                    } catch {}
                    setRvSaving(false)
                  }} disabled={rvSaving || !rvBarber || !rvName.trim()}
                    style={{ height: 40, borderRadius: 10, border: '1px solid rgba(255,207,63,.55)', background: 'rgba(255,207,63,.12)', color: 'rgba(220,190,130,.5)', cursor: 'pointer', fontWeight: 900, fontSize: 13, fontFamily: 'inherit', opacity: rvSaving ? .5 : 1 }}>
                    {rvSaving ? 'Saving…' : 'Add review'}
                  </button>
                </div>
              )}

              {/* Filter */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                <button onClick={() => setReviewFilter('')}
                  style={{ height: 28, padding: '0 10px', borderRadius: 999, border: `1px solid ${!reviewFilter ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.08)'}`, background: !reviewFilter ? 'rgba(255,255,255,.06)' : 'transparent', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}>
                  All ({reviews.length})
                </button>
                {barbers.map((b: any) => {
                  const cnt = reviews.filter(r => r.barber_id === b.id).length
                  return (
                    <button key={b.id} onClick={() => setReviewFilter(b.id)}
                      style={{ height: 28, padding: '0 10px', borderRadius: 999, border: `1px solid ${reviewFilter === b.id ? 'rgba(10,132,255,.45)' : 'rgba(255,255,255,.08)'}`, background: reviewFilter === b.id ? 'rgba(10,132,255,.10)' : 'transparent', color: reviewFilter === b.id ? 'rgba(130,150,220,.6)' : 'rgba(255,255,255,.55)', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}>
                      {b.name} ({cnt})
                    </button>
                  )
                })}
              </div>

              {/* Pending reviews first */}
              {(() => {
                const pending = reviews.filter(r => r.status === 'pending')
                if (!pending.length) return null
                return (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,207,63,.70)', marginBottom: 8, fontWeight: 700 }}>Pending approval ({pending.length})</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {pending.map((r: any) => (
                        <div key={r.id} style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid rgba(255,207,63,.25)', background: 'rgba(255,207,63,.04)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ color: 'rgba(220,190,100,.8)', fontSize: 13 }}>{'★'.repeat(r.rating || 5)}{'☆'.repeat(5 - (r.rating || 5))}</span>
                              <span style={{ fontWeight: 700, fontSize: 13 }}>{r.name || 'Anonymous'}</span>
                              <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 999, border: '1px solid rgba(255,207,63,.35)', background: 'rgba(255,207,63,.10)', color: 'rgba(220,190,130,.5)', letterSpacing: '.06em', textTransform: 'uppercase' }}>PENDING</span>
                            </div>
                            {r.barber_name && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(10,132,255,.25)', background: 'rgba(10,132,255,.06)', color: 'rgba(10,132,255,.80)', letterSpacing: '.06em', textTransform: 'uppercase' }}>{r.barber_name}</span>}
                          </div>
                          {r.text && <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', marginTop: 2, lineHeight: 1.4 }}>{String(r.text).slice(0, 300)}{String(r.text).length > 300 ? '…' : ''}</div>}
                          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                            <button onClick={async () => {
                              const token = localStorage.getItem('VURIUMBOOK_TOKEN') || ''
                              await fetch(`${API}/api/reviews/${encodeURIComponent(r.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: 'approved' }) })
                              loadAll()
                            }} style={{ height: 28, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(143,240,177,.45)', background: 'rgba(143,240,177,.10)', color: 'rgba(130,220,170,.5)', cursor: 'pointer', fontWeight: 700, fontSize: 11, fontFamily: 'inherit' }}>
                              Approve
                            </button>
                            <button onClick={async () => {
                              const token = localStorage.getItem('VURIUMBOOK_TOKEN') || ''
                              await fetch(`${API}/api/reviews/${encodeURIComponent(r.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: 'rejected' }) })
                              loadAll()
                            }} style={{ height: 28, padding: '0 10px', borderRadius: 8, border: '1px solid rgba(255,107,107,.35)', background: 'rgba(255,107,107,.06)', color: 'rgba(220,130,160,.5)', cursor: 'pointer', fontWeight: 700, fontSize: 11, fontFamily: 'inherit' }}>
                              Reject
                            </button>
                            <button onClick={async () => {
                              const token = localStorage.getItem('VURIUMBOOK_TOKEN') || ''
                              await fetch(`${API}/api/reviews/${encodeURIComponent(r.id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
                              loadAll()
                            }} style={{ height: 28, padding: '0 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,.10)', background: 'transparent', color: 'rgba(255,255,255,.35)', cursor: 'pointer', fontWeight: 700, fontSize: 11, fontFamily: 'inherit' }}>
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Reviews list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
                {(reviewFilter ? reviews.filter(r => r.barber_id === reviewFilter) : reviews).filter(r => r.status !== 'pending').slice(0, 50).map((r: any) => (
                  <div key={r.id} style={{ padding: '10px 12px', borderRadius: 14, border: `1px solid ${r.status === 'rejected' ? 'rgba(255,107,107,.15)' : 'rgba(255,255,255,.06)'}`, background: r.status === 'rejected' ? 'rgba(255,107,107,.03)' : 'rgba(255,255,255,.02)', opacity: r.status === 'rejected' ? 0.5 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: 'rgba(220,190,100,.8)', fontSize: 13 }}>{'★'.repeat(r.rating || 5)}{'☆'.repeat(5 - (r.rating || 5))}</span>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{r.name || 'Anonymous'}</span>
                        {r.status === 'rejected' && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 999, border: '1px solid rgba(255,107,107,.30)', color: 'rgba(220,130,160,.5)', letterSpacing: '.06em', textTransform: 'uppercase' }}>REJECTED</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {r.barber_name && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(10,132,255,.25)', background: 'rgba(10,132,255,.06)', color: 'rgba(10,132,255,.80)', letterSpacing: '.06em', textTransform: 'uppercase' }}>{r.barber_name}</span>}
                        {r.source === 'google' && <span style={{ fontSize: 9, color: 'rgba(255,255,255,.25)' }}>Google</span>}
                      </div>
                    </div>
                    {r.text && <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', marginTop: 4, lineHeight: 1.4 }}>{String(r.text).slice(0, 200)}{String(r.text).length > 200 ? '…' : ''}</div>}
                  </div>
                ))}
                {reviews.length === 0 && <div style={{ color: 'rgba(255,255,255,.25)', fontSize: 12, textAlign: 'center', padding: 20 }}>No reviews yet</div>}
              </div>
            </div>
          )}

      {/* Phone access log — owner only */}
      {role === 'owner' && phoneAccessLog.length > 0 && (
        <div style={{ borderRadius: 18, border: '1px solid rgba(168,107,255,.20)', background: 'linear-gradient(180deg,rgba(168,107,255,.06),rgba(168,107,255,.01))', boxShadow: '0 10px 40px rgba(0,0,0,.35)', padding: 16, marginTop: 14 }}>
          <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(180,140,220,.6)', marginBottom: 10, fontWeight: 900 }}>
            Phone access log
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {phoneAccessLog.map((l: any) => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.06)', fontSize: 12 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: l.result === 'granted' ? 'rgba(130,220,170,.8)' : '#ff6b6b', flexShrink: 0 }} />
                <span style={{ fontWeight: 700, color: '#e8e8ed', minWidth: 70 }}>{l.admin_name}</span>
                <span style={{ color: 'rgba(255,255,255,.55)', flex: 1 }}>→ {l.client_name || l.client_id?.slice(0,8)}</span>
                <span style={{ color: 'rgba(255,255,255,.30)', fontSize: 10 }}>{l.reason || ''}</span>
                <span style={{ color: 'rgba(255,255,255,.30)', fontSize: 10, minWidth: 60, textAlign: 'right' as const }}>
                  {l.timestamp ? new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      </div>
    </Shell>
  )
}
