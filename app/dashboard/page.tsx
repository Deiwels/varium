'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import Shell from '@/components/Shell'
import { apiFetch } from '@/lib/api'
import { useVisibilityPolling } from '@/lib/useVisibilityPolling'

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
let _dashTz = 'America/Chicago'
const isoToday = () => {
  // Use workspace timezone for "today" calculation
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: _dashTz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return parts // en-CA gives YYYY-MM-DD format
}
const isoDate = (d: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: _dashTz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  return parts
}
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
  booked:    { borderColor: 'rgba(255,255,255,.15)',  background: 'rgba(255,255,255,.06)',  color: 'rgba(255,255,255,.6)' },
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
  const dots: Record<string, string> = { ok: 'rgba(130,220,170,.6)', bad: '#ff6b6b', blue: 'rgba(255,255,255,.4)', gold: 'rgba(220,190,100,.6)' }
  return (
    <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,.05)', background: 'rgba(255,255,255,.025)', padding: '12px 14px' }}>
      <div style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.02em', lineHeight: 1, color: '#e8e8ed' }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,.4)' }}>
        {color && <span style={{ width: 5, height: 5, borderRadius: 999, background: dots[color] || 'rgba(255,255,255,.15)', flexShrink: 0, display: 'inline-block' }} />}
        {sub}
      </div>
    </div>
  )
}

// ─── Clock Widget — transparent analog clock ──────────────────────────────────
function ClockWidget() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    let t: ReturnType<typeof setInterval> | null = null
    const start = () => { if (!t) t = setInterval(() => setTime(new Date()), 1000) }
    const stop = () => { if (t) { clearInterval(t); t = null } }
    const onVis = () => { if (document.hidden) stop(); else { setTime(new Date()); start() } }
    document.addEventListener('visibilitychange', onVis)
    start()
    return () => { stop(); document.removeEventListener('visibilitychange', onVis) }
  }, [])
  const h = time.getHours() % 12, m = time.getMinutes(), s = time.getSeconds()
  const hDeg = h * 30 + m * 0.5, mDeg = m * 6, sDeg = s * 6
  const size = 70, cx = size / 2, cy = size / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 - 90) * Math.PI / 180
        return <line key={i} x1={cx + Math.cos(a) * 27} y1={cy + Math.sin(a) * 27} x2={cx + Math.cos(a) * 31} y2={cy + Math.sin(a) * 31} stroke="rgba(255,255,255,.18)" strokeWidth={i % 3 === 0 ? 1.5 : .5} strokeLinecap="round" />
      })}
      <line x1={cx} y1={cy} x2={cx + Math.cos((hDeg - 90) * Math.PI / 180) * 16} y2={cy + Math.sin((hDeg - 90) * Math.PI / 180) * 16} stroke="rgba(255,255,255,.7)" strokeWidth={2} strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={cx + Math.cos((mDeg - 90) * Math.PI / 180) * 24} y2={cy + Math.sin((mDeg - 90) * Math.PI / 180) * 24} stroke="rgba(255,255,255,.5)" strokeWidth={1.2} strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={cx + Math.cos((sDeg - 90) * Math.PI / 180) * 27} y2={cy + Math.sin((sDeg - 90) * Math.PI / 180) * 27} stroke="rgba(255,255,255,.2)" strokeWidth={.5} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={1.5} fill="rgba(255,255,255,.35)" />
    </svg>
  )
}

// ─── Mini Calendar Widget — today's schedule by barber ────────────────────────
function MiniCalendarWidget({ bookings }: { bookings: Booking[] }) {
  const now = new Date()
  // Group today's bookings by barber
  const byBarber: Record<string, Booking[]> = {}
  bookings.forEach(b => {
    const name = b.barber_name || b.barber || 'Unassigned'
    if (!byBarber[name]) byBarber[name] = []
    byBarber[name].push(b)
  })
  const barberNames = Object.keys(byBarber).sort()
  const fmt = (iso?: string) => { try { return new Date(iso!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) } catch { return '' } }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)' }}>
          {now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>{bookings.length} bookings</div>
      </div>
      {barberNames.length === 0 ? (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', padding: '6px 0' }}>No appointments today</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 80, overflowY: 'auto' }}>
          {barberNames.slice(0, 3).map(name => (
            <div key={name}>
              <div style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,.3)', marginBottom: 2 }}>{name}</div>
              <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {byBarber[name].sort((a, b) => (a.start_at || '').localeCompare(b.start_at || '')).slice(0, 4).map((b, i) => (
                  <div key={i} style={{ fontSize: 8, padding: '1px 4px', borderRadius: 4, border: '1px solid rgba(255,255,255,.05)', background: b.paid || b.is_paid ? 'rgba(130,220,170,.05)' : 'rgba(255,255,255,.02)', color: b.paid || b.is_paid ? 'rgba(130,220,170,.5)' : 'rgba(255,255,255,.35)' }}>
                    {fmt(b.start_at)}
                  </div>
                ))}
                {byBarber[name].length > 4 && <span style={{ fontSize: 7, color: 'rgba(255,255,255,.2)' }}>+{byBarber[name].length - 4}</span>}
              </div>
            </div>
          ))}
          {barberNames.length > 3 && <div style={{ fontSize: 7, color: 'rgba(255,255,255,.2)' }}>+{barberNames.length - 3} more</div>}
        </div>
      )}
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

  // Mobile iPhone home screen
  const [isMobile, setIsMobile] = useState(false)
  const [homePage, setHomePage] = useState(0)
  const [jiggleMode, setJiggleMode] = useState(false)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const HOME_LAYOUT_KEY = 'VB_HOME_LAYOUT'
  const [homeLayout, setHomeLayout] = useState<string[]>([])
  const homeLayoutLoaded = useRef(false)
  const homeSwipeRef = useRef<{ startX: number; startY: number } | null>(null)
  const jiggleTimerRef = useRef<any>(null)
  // Drag-to-reorder
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const dragStartPos = useRef<{ x: number; y: number } | null>(null)
  const dragActive = useRef(false)
  const dragCloneRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check(); window.addEventListener('resize', check)
    // Load home layout from localStorage
    if (!homeLayoutLoaded.current) {
      homeLayoutLoaded.current = true
      try { const s = JSON.parse(localStorage.getItem(HOME_LAYOUT_KEY) || 'null'); if (Array.isArray(s) && s.length > 0) setHomeLayout(s) } catch {}
    }
    return () => window.removeEventListener('resize', check)
  }, [])

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
  const [clockOutSummary, setClockOutSummary] = useState<{ hours: string; earnings: string; tips: string; clients: number; services: string } | null>(null)
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

  // Get current user from localStorage (deferred to avoid hydration mismatch)
  const [user, setUser] = useState<any>(null)
  useEffect(() => {
    try { setUser(JSON.parse(localStorage.getItem('VURIUMBOOK_USER') || 'null')) } catch {}
    // Restore clock-out summary
    try { const saved = JSON.parse(localStorage.getItem('VB_CLOCKOUT_SUMMARY') || 'null'); if (saved && saved.date === isoToday()) setClockOutSummary(saved.data) } catch {}
  }, [])
  const role: string = user?.role || 'owner'
  const isBarber = role === 'barber'
  const isStudent = role === 'student'
  const myBarberId: string = user?.barber_id || ''
  const myBarberName: string = user?.name || ''

  // Dashboard shortcut settings + slug
  const [dashSettings, setDashSettings] = useState<Record<string, any>>({})
  const [slug, setSlug] = useState('')
  const [editingShortcuts, setEditingShortcuts] = useState(false)
  const [dashShortcuts, setDashShortcuts] = useState<string[]>([])
  // Widgets
  const [dashWidgets, setDashWidgets] = useState<string[]>(['clock', 'todays-earnings', 'mini-calendar', 'weekly-chart', 'new-clients', 'team-on-duty', 'expenses-month', 'site-analytics'])
  const [editingWidgets, setEditingWidgets] = useState(false)
  const widgetSettingsLoaded = useRef(false) // true once API settings have been applied
  const myEarningsInjected = useRef(false)
  const [widgetData, setWidgetData] = useState<Record<string, any>>({})
  const [widgetLoading, setWidgetLoading] = useState(true)
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editJustActivated = useRef(false)

  useEffect(() => {
    apiFetch('/api/settings').then(d => {
      setDashSettings(d || {})
      const saved = d?.dash_shortcuts
      setDashShortcuts(saved && saved.length ? saved : ['/payments', '/waitlist', '/portfolio', '/cash', '/membership'])
      const savedW = d?.dash_widgets
      if (savedW && savedW.length) widgetSettingsLoaded.current = true
      setDashWidgets(savedW && savedW.length ? savedW : ['clock', 'todays-earnings', 'mini-calendar', 'weekly-chart', 'new-clients', 'team-on-duty', 'expenses-month', 'site-analytics'])
    }).catch(() => {})
    apiFetch('/api/account/limits').then(d => { if (d?.slug) setSlug(d.slug) }).catch(() => {})
  }, [])

  // Auto-add my-earnings widget for barbers (once)
  useEffect(() => {
    if (isBarber && !myEarningsInjected.current && !dashWidgets.includes('my-earnings')) {
      myEarningsInjected.current = true
      setDashWidgets(prev => {
        if (prev.includes('my-earnings')) return prev
        const next = ['my-earnings', ...prev]
        apiFetch('/api/settings', { method: 'POST', body: JSON.stringify({ dash_widgets: next }) }).catch(() => {})
        return next
      })
    }
  }, [isBarber, dashWidgets])

  // Load widget-specific data
  useEffect(() => {
    const today = isoToday()
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 6)
    const monthStart = new Date(); monthStart.setDate(1)

    // Today's earnings + weekly revenue
    if (dashWidgets.includes('todays-earnings') || dashWidgets.includes('weekly-chart')) {
      apiFetch(`/api/payments?from=${today}T00:00:00.000Z&to=${today}T23:59:59.999Z`).then(d => {
        const payments = d?.payments || d || []
        const todayTotal = Array.isArray(payments) ? payments.reduce((s: number, p: any) => s + (Number(p.amount_cents || 0) / 100), 0) : 0
        setWidgetData(prev => ({ ...prev, todaysEarnings: todayTotal }))
      }).catch(() => {})
    }
    if (dashWidgets.includes('weekly-chart')) {
      apiFetch(`/api/payments?from=${isoDate(weekAgo)}T00:00:00.000Z&to=${today}T23:59:59.999Z`).then(d => {
        const payments = d?.payments || d || []
        if (!Array.isArray(payments)) return
        const byDay: Record<string, number> = {}
        for (let i = 0; i < 7; i++) {
          const dd = new Date(); dd.setDate(dd.getDate() - 6 + i)
          byDay[isoDate(dd)] = 0
        }
        payments.forEach((p: any) => {
          const day = (p.created_at || '').slice(0, 10)
          if (byDay[day] !== undefined) byDay[day] += Number(p.amount_cents || 0) / 100
        })
        setWidgetData(prev => ({ ...prev, weeklyRevenue: Object.entries(byDay).map(([d, v]) => ({ day: d, amount: v })) }))
      }).catch(() => {})
    }
    // New clients this week
    if (dashWidgets.includes('new-clients')) {
      apiFetch('/api/clients').then(d => {
        const clients = d?.clients || d || []
        if (!Array.isArray(clients)) return
        const weekStart = isoDate(weekAgo)
        const newCount = clients.filter((c: any) => (c.created_at || '') >= weekStart).length
        setWidgetData(prev => ({ ...prev, newClients: newCount, totalClients: clients.length }))
      }).catch(() => {})
    }
    // Pending requests
    if (dashWidgets.includes('pending-requests')) {
      apiFetch('/api/requests').then(d => {
        const reqs = d?.requests || []
        const pending = reqs.filter((r: any) => r.status === 'pending').length
        setWidgetData(prev => ({ ...prev, pendingRequests: pending }))
      }).catch(() => {})
    }
    // Cash register
    if (dashWidgets.includes('cash-register')) {
      apiFetch(`/api/cash-reports?date=${today}`).then(d => {
        const reports = d?.reports || d || []
        const total = Array.isArray(reports) ? reports.reduce((s: number, r: any) => s + Number(r.amount || 0), 0) : 0
        setWidgetData(prev => ({ ...prev, cashBalance: total }))
      }).catch(() => {})
    }
    // Expenses this month
    if (dashWidgets.includes('expenses-month')) {
      apiFetch(`/api/expenses?from=${isoDate(monthStart)}&to=${today}`).then(d => {
        const expenses = d?.expenses || d || []
        const total = Array.isArray(expenses) ? expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0) : 0
        setWidgetData(prev => ({ ...prev, expensesMonth: total }))
      }).catch(() => {})
    }
    // Site analytics
    if (dashWidgets.includes('site-analytics')) {
      apiFetch('/api/analytics/summary').then(d => {
        if (d && !d.error) setWidgetData(prev => ({ ...prev, analytics: d }))
      }).catch(() => {})
    }
    // Mark loading done after a short delay for all fetches to complete
    setTimeout(() => setWidgetLoading(false), 1500)
  }, [dashWidgets])

  function toggleShortcut(href: string) {
    setDashShortcuts(prev => {
      const next = prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href]
      apiFetch('/api/settings', { method: 'POST', body: JSON.stringify({ dash_shortcuts: next }) }).catch(() => {})
      return next
    })
  }
  function toggleWidget(id: string) {
    setDashWidgets(prev => {
      const next = prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
      apiFetch('/api/settings', { method: 'POST', body: JSON.stringify({ dash_widgets: next }) }).catch(() => {})
      return next
    })
  }
  const isOwnerOrAdmin = role === 'owner' || role === 'admin'

  const loadAll = useCallback(async () => {
    const token = localStorage.getItem('VURIUMBOOK_TOKEN') || ''
    const headers: Record<string,string> = { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    // Load workspace timezone + clock_in_enabled (available to all users)
    try { const tz = await fetch(`${API}/api/settings/timezone`, { headers }).then(r => r.json()); if (tz?.timezone) _dashTz = tz.timezone; if (tz?.clock_in_enabled !== undefined) setDashSettings(prev => ({ ...prev, clock_in_enabled: tz.clock_in_enabled })) } catch {}
    const today = isoToday()
    const range = getDateRange(earningsPeriod, earningsOffset)
    if (!bookings.length && !myPayroll) setLoading(true) // only show loading on first load
    try {
      // Fire ALL requests in parallel instead of sequentially
      const fetches: Record<string, Promise<any>> = {
        bookings: fetch(`${API}/api/bookings?from=${today}T00:00:00.000Z&to=${today}T23:59:59.999Z`, { headers }).then(r => r.json()).catch(() => null),
        barbers: fetch(`${API}/api/barbers`, { headers }).then(r => r.json()).catch(() => null),
        reviews: fetch(`${API}/api/reviews`, { headers }).then(r => r.json()).catch(() => null),
        attStatus: fetch(`${API}/api/attendance/status`, { credentials: 'include', headers }).then(r => r.json()).catch(() => null),
      }
      if (!isBarber) {
        fetches.settings = fetch(`${API}/api/settings`, { credentials: 'include', headers }).then(r => r.json()).catch(() => null)
        fetches.staff = fetch(`${API}/api/attendance?from=${today}&to=${today}`, { credentials: 'include', headers }).then(r => r.json()).catch(() => null)
      }
      if (isBarber && myBarberId) {
        fetches.payroll = fetch(`${API}/api/payroll?from=${range.from}T00:00:00.000Z&to=${range.to}T23:59:59.999Z`, { credentials: 'include', headers }).then(r => r.json()).catch(() => null)
      }
      if (role === 'owner') {
        fetches.phoneLog = fetch(`${API}/api/admin/phone-access-log?limit=20`, { credentials: 'include', headers }).then(r => r.json()).catch(() => null)
      }

      const results = await Promise.all(
        Object.entries(fetches).map(async ([key, promise]) => [key, await promise] as const)
      )
      const data: Record<string, any> = Object.fromEntries(results)

      // Process barbers
      const brData = data.barbers
      const barberList = Array.isArray(brData) ? brData : (brData?.barbers || [])
      const barberMap: Record<string, string> = {}
      barberList.forEach((b: any) => { if (b.id && b.name) barberMap[String(b.id)] = String(b.name) })

      // Process bookings
      const bkData = data.bookings
      let bks: Booking[] = Array.isArray(bkData?.bookings) ? bkData.bookings : Array.isArray(bkData) ? bkData : []
      bks = bks.map(b => {
        const bn = b.barber_name || b.barber || ''
        const isId = bn.length > 16 && /^[A-Za-z0-9]+$/.test(bn)
        const realName = b.barber_id ? barberMap[String(b.barber_id)] : undefined
        return { ...b, barber_name: (isId || !bn) ? (realName || bn) : bn }
      })
      if (isBarber && myBarberId) {
        bks = bks.filter(b => String(b.barber_id || '') === myBarberId)
      }
      setBookings(bks)

      // Parse barbers schedule
      const parsedBarbers = barberList.map((b: any) => {
        const raw = b.schedule || b.work_schedule
        let schedule = null
        if (raw && typeof raw === 'object') {
          if (Array.isArray(raw)) {
            schedule = { startMin: raw[1]?.startMin ?? 10*60, endMin: raw[1]?.endMin ?? 20*60, days: raw.map((d: any, i: number) => d.enabled ? i : -1).filter((i: number) => i >= 0) }
          } else if (raw.startMin !== undefined) {
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


      // Settings
      if (data.settings) {
        if (data.settings.shopStatusMode) setShopStatus(data.settings.shopStatusMode)
        if (data.settings.banner) {
          setBannerEnabled(!!data.settings.banner.enabled)
          setBannerText(data.settings.banner.text || '')
        }
      }

      // Payroll
      if (data.payroll) {
        const mine = (data.payroll?.barbers || []).find((b: BarberPayroll) => b.barber_id === myBarberId)
        setMyPayroll(mine || null)
      }

      // Reviews
      setReviews(data.reviews?.reviews || [])

      // Attendance
      if (data.attStatus) {
        setClockedIn(!!data.attStatus.clocked_in)
        setClockInTime(data.attStatus.clock_in || null)
        setTodayMinutes(data.attStatus.today_minutes || 0)
      }

      // Staff on clock — deduplicate by user_id, keep latest clock_in
      if (data.staff) {
        const records = data.staff?.attendance || []
        const open = records.filter((r: any) => !r.clock_out)
        const byUser: Record<string, any> = {}
        open.forEach((r: any) => {
          if (!byUser[r.user_id] || (r.clock_in && r.clock_in > (byUser[r.user_id].clock_in || ''))) {
            byUser[r.user_id] = r
          }
        })
        setStaffOnClock(Object.values(byUser))
      }

      // Phone access log
      if (data.phoneLog) {
        setPhoneAccessLog(data.phoneLog?.logs || [])
      }
    } catch {}
    setLoading(false)
  }, [isBarber, myBarberId, earningsPeriod, earningsOffset])

  useVisibilityPolling(loadAll, 30000, [loadAll])

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

  // Tools — filtered by dashboard settings + role
  // Default 4 core always shown, extras only if enabled in settings
  const allActions = [
    { label: 'Calendar', desc: 'Bookings & schedule', href: '/calendar', dashKey: 'dash_calendar', core: true },
    { label: 'History', desc: 'Booking records', href: '/history', dashKey: 'dash_history', core: true },
    { label: 'Clients', desc: 'Your client base', href: '/clients', dashKey: 'dash_clients', core: true },
    { label: 'Payments', desc: 'Transactions', href: '/payments', dashKey: 'dash_payments', core: true },
    { label: 'Waitlist', desc: 'Queue & notify', href: '/waitlist', dashKey: 'dash_waitlist' },
    { label: 'Portfolio', desc: 'Work gallery', href: '/portfolio', dashKey: 'dash_portfolio' },
    { label: 'Cash', desc: 'Daily register', href: '/cash', dashKey: 'dash_cash' },
    { label: 'Membership', desc: 'Recurring clients', href: '/membership', dashKey: 'dash_membership' },
    { label: 'Attendance', desc: 'Clock in / out', href: '/attendance', dashKey: 'dash_attendance' },
    ...(role === 'owner' ? [
      { label: 'Expenses', desc: 'Track costs', href: '/expenses', dashKey: 'dash_expenses' },
      { label: 'Payroll', desc: 'Commission + tips', href: '/payroll', dashKey: 'dash_payroll' },
    ] : []),
    { label: 'Settings', desc: 'Config & team', href: '/settings', dashKey: null, core: true },
  ]
  const actions = allActions.filter(item => {
    if (isBarber && ['Clients', 'Payments', 'Cash', 'Membership', 'Expenses', 'Payroll', 'Settings'].includes(item.label)) return false
    if (isStudent && item.label !== 'Calendar') return false
    // Core items always shown; extras only if enabled in settings
    if (!(item as any).core && item.dashKey && dashSettings[item.dashKey] === false) return false
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

  // Live elapsed timer — visibility-aware
  const tickElapsed = useCallback(() => {
    if (!clockedIn || !clockInTime) { setElapsedStr(''); return }
    const ms = Date.now() - new Date(clockInTime).getTime()
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    setElapsedStr(h > 0 ? `${h}h ${m}m` : `${m}m`)
  }, [clockedIn, clockInTime])
  useVisibilityPolling(tickElapsed, 30000, [tickElapsed])

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
      {/* ── Mobile: iPhone Home Screen ── */}
      {isMobile && (() => {
        // All possible items with icons, widgets, sizes
        const iconSvgs: Record<string,React.ReactNode> = {
          Calendar: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
          History: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/></svg>,
          Clients: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
          Payments: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
          Waitlist: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
          Portfolio: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>,
          Cash: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
          Membership: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
          Attendance: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
          Expenses: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="12" y2="15"/></svg>,
          Payroll: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
          Settings: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
          Booking: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
        }

        // All available home screen items: widgets (span 2 or 4 cols) + icons (span 1)
        type HItem = { id: string; type: 'icon' | 'widget-s' | 'widget-m'; label: string; href?: string; cols: number }
        const showClockIn = dashSettings.clock_in_enabled && role !== 'owner'
        const ALL_ITEMS: HItem[] = [
          // Clock-in widget — for staff/admin when enabled
          ...(showClockIn ? [{ id: 'w_clockin', type: 'widget-s' as const, label: 'Clock In', cols: 2 }] : []),
          // Widgets — small (2 cols), medium (4 cols)
          { id: 'w_clock', type: 'widget-s', label: 'Clock', cols: 2 },
          { id: 'w_earnings', type: 'widget-s', label: 'Earnings', cols: 2 },
          { id: 'w_schedule', type: 'widget-m', label: 'Schedule', cols: 4 },
          { id: 'w_revenue', type: 'widget-s', label: 'Revenue', cols: 2 },
          { id: 'w_newclients', type: 'widget-s', label: 'New Clients', cols: 2 },
          { id: 'w_expenses', type: 'widget-s', label: 'Expenses', cols: 2 },
          { id: 'w_quickbook', type: 'widget-s', label: 'Quick Book', cols: 2 },
          ...(isOwnerOrAdmin ? [{ id: 'w_visits', type: 'widget-m' as const, label: 'Site Visits', cols: 4 }] : []),
          { id: 'w_bookings', type: 'widget-s', label: 'Bookings', cols: 2 },
          { id: 'w_paid', type: 'widget-s', label: isBarber ? 'Earnings' : 'Paid', cols: 2 },
          { id: 'w_noshows', type: 'widget-s', label: 'No-shows', cols: 2 },
          { id: 'w_team', type: 'widget-s', label: isBarber ? 'Status' : 'Team', cols: 2 },
          { id: 'w_activity', type: 'widget-m', label: 'Today Activity', cols: 4 },
          // Team barbers as widgets
          ...barbers.map((b: any) => ({ id: `w_barber_${b.id}`, type: 'widget-s' as const, label: b.name, cols: 2 })),
          // Icons — each action
          ...actions.map(a => ({ id: `i_${a.label}`, type: 'icon' as const, label: a.label, href: a.href, cols: 1 })),
        ]

        // Determine active layout
        const defaultOrder = [...(showClockIn ? ['w_clockin'] : []), 'w_clock', 'w_earnings', 'w_schedule', 'w_revenue', 'w_newclients', 'w_expenses', 'w_visits', ...actions.map(a => `i_${a.label}`)]
        const layout = homeLayout.length > 0 ? homeLayout.filter(id => ALL_ITEMS.some(i => i.id === id)) : defaultOrder
        const activeItems = layout.map(id => ALL_ITEMS.find(i => i.id === id)!).filter(Boolean)
        const hiddenItems = ALL_ITEMS.filter(i => !layout.includes(i.id))

        // Render widget content
        const renderWidget = (item: HItem) => {
          const ws = { borderRadius: 16, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)', padding: '12px 12px 10px', minHeight: 76 } as React.CSSProperties
          const wl: React.CSSProperties = { fontSize: 9, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.40)', marginBottom: 6 }
          switch (item.id) {
            case 'w_clockin': return (
              <div
                onTouchStart={e => { e.stopPropagation(); clearTimeout(jiggleTimerRef.current) }}
                onTouchEnd={e => { if (jiggleMode || clockLoading) return; e.preventDefault(); e.stopPropagation(); handleClockAction() }}
                onClick={e => { if (jiggleMode || clockLoading) return; e.stopPropagation(); handleClockAction() }}
                style={{...ws, cursor: clockLoading ? 'wait' : 'pointer', opacity: clockLoading ? .7 : 1, border: clockedIn ? '1px solid rgba(143,240,177,.20)' : ws.border }}>
                <div style={wl}>{clockedIn ? 'On Shift' : 'Clock In'}</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: clockedIn ? 'rgba(130,220,170,.8)' : 'rgba(255,255,255,.7)', lineHeight: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {clockedIn && <span style={{ width: 6, height: 6, borderRadius: 999, background: 'rgba(130,220,170,.8)', animation: 'clockDot 2s ease-in-out infinite', flexShrink: 0 }} />}
                  {clockLoading ? '...' : clockedIn ? (elapsedStr || fmtMins(todayMinutes)) : 'Off'}
                </div>
                <div style={{ fontSize: 9, color: clockedIn ? 'rgba(255,107,107,.6)' : 'rgba(255,255,255,.3)', marginTop: 3, fontWeight: clockedIn ? 700 : 400 }}>{clockError || (clockedIn ? 'Clock Out' : 'tap to start')}</div>
              </div>
            )
            case 'w_clock': return <div style={{...ws, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><ClockWidget /></div>
            case 'w_earnings': return <div style={ws}><div style={wl}>Earnings</div><div style={{ fontSize: 22, fontWeight: 600, color: 'rgba(130,220,170,.8)' }}>{money(widgetData.todaysEarnings || 0)}</div><div style={{ fontSize: 9, color: 'rgba(255,255,255,.3)', marginTop: 3 }}>{total} bookings</div></div>
            case 'w_schedule': {
              const fm = (m: number) => `${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}`
              const today = new Date().getDay()
              const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
              const barberSlots = barbers.map((b: any) => {
                const sched = b.schedule
                const wd: number[] = Array.isArray(sched?.days) ? sched.days : [1,2,3,4,5,6]
                if (!wd.includes(today)) return { name: b.name, slots: [] as string[] }
                const startM = sched?.startMin ?? 600, endM = sched?.endMin ?? 1200
                const bkgs = bookings.filter(bk => String(bk.barber_id || '') === String(b.id))
                const busy = new Set<number>()
                bkgs.forEach(bk => { if (!bk.start_at) return; const dt = new Date(bk.start_at); const s = dt.getHours() * 60 + dt.getMinutes(); const d = (bk as any).duration ?? (bk as any).durMin ?? 30; for (let m = s; m < s + d; m += 5) busy.add(m) })
                const free: string[] = []
                for (let m = Math.max(startM, nowMin); m <= endM - 30; m += 30) {
                  let ok = true; for (let c = m; c < m + 30; c += 5) if (busy.has(c)) { ok = false; break }
                  if (ok && free.length < 3) free.push(fm(m))
                }
                return { name: b.name, slots: free }
              }).filter(b => b.slots.length > 0).slice(0, 6)
              const half = Math.ceil(barberSlots.length / 2)
              const leftCol = barberSlots.slice(0, half)
              const rightCol = barberSlots.slice(half)
              const col = (items: typeof barberSlots) => <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>{items.map(b => <div key={b.name}><div style={{ fontSize: 7, fontWeight: 600, color: 'rgba(255,255,255,.35)', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div><div style={{ display: 'flex', gap: 2 }}>{b.slots.map((s,i) => <span key={i} style={{ fontSize: 7, padding: '0 3px', borderRadius: 3, border: '1px solid rgba(255,255,255,.06)', color: 'rgba(255,255,255,.3)' }}>{s}</span>)}</div></div>)}</div>
              return <div style={{...ws, minHeight: 55, padding: '6px 8px'}}><div style={wl}>Free Slots</div>{barberSlots.length === 0 ? <div style={{ fontSize: 9, color: 'rgba(255,255,255,.2)' }}>No free slots</div> : <div style={{ display: 'flex', gap: 8 }}>{col(leftCol)}{rightCol.length > 0 && col(rightCol)}</div>}</div>
            }
            case 'w_revenue': {
              const days = widgetData.weeklyRevenue || []
              const mx = Math.max(...days.map((d: any) => d.amount), 1)
              return <div style={ws}><div style={wl}>Revenue</div><div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 32 }}>{days.map((d: any, i: number)=><div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}><div style={{ width: '100%', borderRadius: 2, background: i===days.length-1?'rgba(130,220,170,.4)':'rgba(255,255,255,.1)', height: `${Math.max(2,(d.amount/mx)*26)}px` }}/><span style={{ fontSize: 6, color: 'rgba(255,255,255,.2)' }}>{new Date(d.day+'T12:00').toLocaleDateString([],{weekday:'narrow'})}</span></div>)}</div>{days.length>0&&<div style={{ fontSize: 9, color: 'rgba(255,255,255,.25)', marginTop: 3 }}>{money(days.reduce((s: number,d: any)=>s+d.amount,0))}</div>}</div>
            }
            case 'w_newclients': return <div style={ws}><div style={wl}>New Clients</div><div style={{ fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,.7)' }}>{widgetData.newClients ?? '—'}</div><div style={{ fontSize: 9, color: 'rgba(255,255,255,.25)', marginTop: 3 }}>this week</div></div>
            case 'w_expenses': return <div style={ws}><div style={wl}>Expenses</div><div style={{ fontSize: 22, fontWeight: 600, color: 'rgba(255,130,130,.6)' }}>{money(widgetData.expensesMonth || 0)}</div><div style={{ fontSize: 9, color: 'rgba(255,255,255,.25)', marginTop: 3 }}>this month</div></div>
            case 'w_quickbook': return <div style={ws}><a href="/calendar?action=new-booking" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'rgba(255,255,255,.4)' }}>+</div><span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.5)' }}>Quick Book</span></a></div>
            case 'w_visits': {
              const a = widgetData.analytics || { total: 0, by_source: {}, by_day: [] }
              const sources = Object.entries(a.by_source || {}).sort((x: any, y: any) => y[1] - x[1])
              const maxS = Math.max(...sources.map((s: any) => s[1]), 1)
              const _ms = { stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
              const mSrcIcon = (n: string) => {
                const p = { width: 9, height: 9, viewBox: '0 0 24 24' }
                switch (n) {
                  case 'instagram': return <svg {...p}><rect x="2" y="2" width="20" height="20" rx="5" {..._ms}/><circle cx="12" cy="12" r="5" {..._ms}/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/></svg>
                  case 'google': return <svg {...p}><circle cx="11" cy="11" r="7" {..._ms}/><line x1="16.5" y1="16.5" x2="21" y2="21" {..._ms}/></svg>
                  case 'facebook': return <svg {...p}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" {..._ms}/></svg>
                  case 'tiktok': return <svg {...p}><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" {..._ms}/></svg>
                  case 'direct': return <svg {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" {..._ms}/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" {..._ms}/></svg>
                  default: return <svg {...p}><circle cx="12" cy="12" r="10" {..._ms}/><line x1="2" y1="12" x2="22" y2="12" {..._ms}/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" {..._ms}/></svg>
                }
              }
              return <div onClick={() => { if (!jiggleMode) window.location.href = '/analytics' }} style={{...ws, minHeight: 90, cursor: jiggleMode ? 'default' : 'pointer'}}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><div style={wl}>Site Visits</div>{!jiggleMode && <span style={{ fontSize: 9, color: 'rgba(255,255,255,.2)' }}>→</span>}</div><div style={{ fontSize: 20, fontWeight: 600, color: '#e8e8ed', marginBottom: 6 }}>{a.total}</div>{sources.slice(0,4).map(([s,c]: any)=><div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}><span style={{ width: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.35)' }}>{mSrcIcon(s)}</span><span style={{ fontSize: 8, color: 'rgba(255,255,255,.4)', width: 45, textTransform: 'capitalize' }}>{s}</span><div style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,.06)' }}><div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,.2)', width: `${(c/maxS)*100}%` }}/></div><span style={{ fontSize: 8, color: 'rgba(255,255,255,.3)' }}>{c}</span></div>)}{sources.length===0&&<div style={{ fontSize: 9, color: 'rgba(255,255,255,.2)' }}>No visits</div>}</div>
            }
            case 'w_bookings': return <div style={ws}><div style={wl}>Bookings</div><div style={{ fontSize: 22, fontWeight: 600, color: '#e8e8ed', lineHeight: 1 }}>{total}</div><div style={{ fontSize: 9, color: 'rgba(255,255,255,.3)', marginTop: 3 }}>{upcoming} upcoming</div></div>
            case 'w_paid': return <div style={ws}><div style={wl}>{isBarber ? 'Earnings' : 'Paid'}</div><div style={{ fontSize: 22, fontWeight: 600, color: '#e8e8ed', lineHeight: 1 }}>{isBarber ? money(barberEarnings) : `${paid}/${total}`}</div><div style={{ fontSize: 9, color: 'rgba(255,255,255,.3)', marginTop: 3 }}>{isBarber ? `${money(barberTips)} tips` : (total - paid > 0 ? `${total - paid} unpaid` : 'all paid')}</div></div>
            case 'w_noshows': return <div style={ws}><div style={wl}>No-shows</div><div style={{ fontSize: 22, fontWeight: 600, color: noshow > 0 ? 'rgba(255,107,107,.8)' : '#e8e8ed', lineHeight: 1 }}>{noshow}</div><div style={{ fontSize: 9, color: 'rgba(255,255,255,.3)', marginTop: 3 }}>{noshow > 0 ? 'attention' : 'all good'}</div></div>
            case 'w_team': return <div style={ws}><div style={wl}>{isBarber ? 'Status' : 'Team'}</div><div style={{ fontSize: 22, fontWeight: 600, color: '#e8e8ed', lineHeight: 1 }}>{isBarber ? (noshow > 0 ? '!' : '✓') : Object.keys(byBarber).length}</div><div style={{ fontSize: 9, color: 'rgba(255,255,255,.3)', marginTop: 3 }}>{isBarber ? 'today' : 'working'}</div></div>
            case 'w_activity': return <div style={{...ws, minHeight: 90}}><div style={wl}>Today Activity</div>{Object.keys(byBarber).length > 0 ? <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{Object.entries(byBarber).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([n,c])=><div key={n} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 45, fontSize: 9, color: 'rgba(255,255,255,.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n}</span><div style={{ flex: 1, height: 3, borderRadius: 999, background: 'rgba(255,255,255,.06)' }}><div style={{ height: 3, borderRadius: 999, background: 'rgba(255,255,255,.18)', width: `${Math.round(c/maxCount*100)}%` }}/></div><span style={{ fontSize: 8, color: 'rgba(255,255,255,.3)' }}>{c}</span></div>)}</div> : <div style={{ fontSize: 10, color: 'rgba(255,255,255,.2)' }}>No activity</div>}</div>
            default: {
              // Barber widgets
              if (item.id.startsWith('w_barber_')) {
                const bid = item.id.replace('w_barber_', '')
                const b = barbers.find((x: any) => x.id === bid)
                if (!b) return <div style={ws}>{item.label}</div>
                const sched = b.schedule
                const wd: number[] = Array.isArray(sched?.days) ? sched.days : [1,2,3,4,5,6]
                const fm = (m: number) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`
                return <div style={{...ws, textAlign: 'center'}}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 4 }}>{b.photo_url ? <img src={b.photo_url} alt="" style={{ width: 20, height: 20, borderRadius: 6, objectFit: 'cover' }} /> : <div style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'rgba(255,255,255,.4)' }}>{(b.name||'?')[0]}</div>}<span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.8)' }}>{b.name}</span></div><div style={{ display: 'flex', justifyContent: 'center', gap: 1, marginBottom: 3 }}>{DAY_NAMES_SHORT.map((d: string,i: number)=><span key={d} style={{ fontSize: 6, padding: '1px 3px', borderRadius: 2, border: `1px solid ${wd.includes(i)?'rgba(255,255,255,.08)':'rgba(255,255,255,.02)'}`, color: wd.includes(i)?'rgba(255,255,255,.5)':'rgba(255,255,255,.12)' }}>{d}</span>)}</div><div style={{ fontSize: 8, color: 'rgba(255,255,255,.3)' }}>{fm(sched?.startMin??600)} — {fm(sched?.endMin??1200)}</div></div>
              }
              return <div style={ws}>{item.label}</div>
            }
          }
        }

        // Build grid items in a 4-col grid
        // Each item knows how many cols it spans
        const COLS = 4
        // Use container height if available, otherwise estimate from window
        const containerEl = typeof document !== 'undefined' ? document.querySelector('.content') as HTMLElement : null
        const safeBot = (typeof window !== 'undefined' && (window as any).__VURIUM_SAFE_BOTTOM) || 34
        const pillBarH = 56 + safeBot
        const availH = containerEl ? containerEl.clientHeight - pillBarH - 20 : (typeof window !== 'undefined' ? window.innerHeight - pillBarH - 140 : 600)

        // Simple flow: place items sequentially, track col position
        // Widgets take 2 or 4 cols, icons take 1 col
        // Pack into pages based on height
        type GridCell = { item: HItem; row: number; col: number }
        const cells: GridCell[] = []
        let row = 0, col = 0
        activeItems.forEach(item => {
          if (col + item.cols > COLS) { row++; col = 0 }
          cells.push({ item, row, col })
          col += item.cols
          if (col >= COLS) { row++; col = 0 }
        })

        // Row heights: icon rows ~82px, widget rows ~90px (small) or ~110px (medium/activity)
        const rowHeights: Record<number, number> = {}
        cells.forEach(c => {
          const h = c.item.type === 'icon' ? 82 : c.item.id === 'w_activity' ? 110 : c.item.id === 'w_schedule' ? 60 : 90
          rowHeights[c.row] = Math.max(rowHeights[c.row] || 0, h)
        })
        const totalRows = Math.max(...Object.keys(rowHeights).map(Number), 0) + 1

        // Paginate rows
        const GAP = 8
        const pages: { startRow: number; endRow: number }[] = []
        let pageStart = 0, pageH = 0
        for (let r = 0; r < totalRows; r++) {
          const rh = (rowHeights[r] || 82) + GAP
          if (pageH + rh > availH && r > pageStart) {
            pages.push({ startRow: pageStart, endRow: r - 1 })
            pageStart = r; pageH = rh
          } else { pageH += rh }
        }
        pages.push({ startRow: pageStart, endRow: totalRows - 1 })
        const totalPages = pages.length

        const removeItem = (id: string) => {
          const newLayout = layout.filter(x => x !== id)
          setHomeLayout(newLayout)
          localStorage.setItem(HOME_LAYOUT_KEY, JSON.stringify(newLayout))
        }
        const addItem = (id: string) => {
          const newLayout = [...layout, id]
          setHomeLayout(newLayout)
          localStorage.setItem(HOME_LAYOUT_KEY, JSON.stringify(newLayout))
        }
        const reorderItem = (fromId: string, toIdx: number) => {
          const fromIdx = layout.indexOf(fromId)
          if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return
          const newLayout = [...layout]
          const [item] = newLayout.splice(fromIdx, 1)
          newLayout.splice(toIdx, 0, item)
          setHomeLayout(newLayout)
          localStorage.setItem(HOME_LAYOUT_KEY, JSON.stringify(newLayout))
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', color: '#e8e8ed', fontFamily: 'Inter, system-ui, sans-serif', overflow: 'hidden', width: '100%', height: '100%', touchAction: jiggleMode ? 'none' : 'pan-x', WebkitUserSelect: jiggleMode ? 'none' : undefined, userSelect: jiggleMode ? 'none' : undefined, WebkitTouchCallout: jiggleMode ? 'none' : undefined } as React.CSSProperties}
            onClick={() => { if (jiggleMode) { setJiggleMode(false); setDragId(null); setDragPos(null); setDragOverIdx(null) } }}
            onTouchStart={e => {
              homeSwipeRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY }
              if (!jiggleMode) {
                jiggleTimerRef.current = setTimeout(() => { setJiggleMode(true) }, 600)
              }
            }}
            onTouchMove={() => { clearTimeout(jiggleTimerRef.current) }}
            onTouchEnd={e => {
              clearTimeout(jiggleTimerRef.current)
              if (dragActive.current) return // don't swipe pages during drag
              if (!homeSwipeRef.current) return
              const dx = e.changedTouches[0].clientX - homeSwipeRef.current.startX
              const dy = e.changedTouches[0].clientY - homeSwipeRef.current.startY
              homeSwipeRef.current = null
              if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return
              if (dx < 0 && homePage < totalPages - 1) setHomePage(homePage + 1)
              if (dx > 0 && homePage > 0) setHomePage(homePage - 1)
            }}>
            <style>{`
              @keyframes editBreathe {
                0%, 100% { box-shadow: 0 0 8px 2px rgba(255,255,255,.06), 0 0 18px 4px rgba(255,255,255,.02); }
                50% { box-shadow: 0 0 14px 4px rgba(255,255,255,.14), 0 0 28px 8px rgba(255,255,255,.05); }
              }
              .edit-glow { animation: editBreathe 2.5s ease-in-out infinite; border-radius: 16px; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
              .edit-glow-icon { animation: editBreathe 2.5s ease-in-out infinite; border-radius: 16px; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
              .edit-glow a, .edit-glow-icon a { -webkit-user-drag: none; user-drag: none; pointer-events: none; }
              .edit-glow-icon:nth-child(even) { animation-delay: .4s; }
              .edit-glow:nth-child(even) { animation-delay: .6s; }
              html, body { overflow: hidden !important; }
              * { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
            `}</style>

            {/* Pages */}
            <div style={{ flex: 1, display: 'flex', transition: 'transform .35s cubic-bezier(.25,.1,.25,1)', transform: `translateX(-${homePage * 100}%)`, minHeight: 0 }}>
              {pages.map((pg, pi) => (
                <div key={pi} style={{ minWidth: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', padding: '8px 16px 0', gap: GAP }}>
                  {/* Render rows for this page */}
                  {Array.from({ length: pg.endRow - pg.startRow + 1 }, (_, ri) => {
                    const r = pg.startRow + ri
                    const rowCells = cells.filter(c => c.row === r)
                    if (rowCells.length === 0) return null
                    return (
                      <div key={r} style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: GAP, justifyItems: 'center' }}>
                        {rowCells.map(c => {
                          const isWidget = c.item.type !== 'icon'
                          const layoutIdx = layout.indexOf(c.item.id)
                          const isDragging = dragId === c.item.id
                          const isDropTarget = dragOverIdx === layoutIdx && dragId !== c.item.id
                          return (
                            <div key={c.item.id} data-item-id={c.item.id} data-layout-idx={layoutIdx}
                              className={jiggleMode && !isDragging ? (c.item.type === 'icon' ? 'edit-glow-icon' : 'edit-glow') : ''}
                              style={{ gridColumn: `span ${c.item.cols}`, width: '100%', position: 'relative', opacity: isDragging ? 0.25 : 1, transition: isDragging ? 'none' : 'opacity .2s, transform .2s', transform: isDropTarget ? 'scale(1.05)' : 'scale(1)' }}
                              onTouchStart={jiggleMode ? (e) => {
                                e.preventDefault() // prevent link drag / text selection
                                const t = e.touches[0]
                                dragStartPos.current = { x: t.clientX, y: t.clientY }
                                dragActive.current = false
                              } : undefined}
                              onTouchMove={jiggleMode ? (e) => {
                                const t = e.touches[0]
                                if (!dragStartPos.current) return
                                const dx = Math.abs(t.clientX - dragStartPos.current.x)
                                const dy = Math.abs(t.clientY - dragStartPos.current.y)
                                if (!dragActive.current && (dx > 8 || dy > 8)) {
                                  dragActive.current = true
                                  setDragId(c.item.id)
                                }
                                if (dragActive.current) {
                                  e.preventDefault()
                                  setDragPos({ x: t.clientX, y: t.clientY })
                                  // Find drop target
                                  const el = document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null
                                  const target = el?.closest?.('[data-layout-idx]') as HTMLElement | null
                                  if (target) {
                                    const idx = parseInt(target.dataset.layoutIdx || '-1', 10)
                                    if (idx >= 0) setDragOverIdx(idx)
                                  }
                                }
                              } : undefined}
                              onTouchEnd={jiggleMode ? () => {
                                if (dragActive.current && dragId && dragOverIdx !== null) {
                                  reorderItem(dragId, dragOverIdx)
                                }
                                dragStartPos.current = null
                                dragActive.current = false
                                setDragId(null)
                                setDragPos(null)
                                setDragOverIdx(null)
                              } : undefined}
                            >
                              {/* Remove button in jiggle mode */}
                              {jiggleMode && !isDragging && (
                                <button onClick={e => { e.stopPropagation(); e.preventDefault(); removeItem(c.item.id) }} style={{ position: 'absolute', top: -6, left: isWidget ? -4 : 6, zIndex: 10, width: 20, height: 20, borderRadius: 999, background: 'rgba(60,60,60,.95)', border: '1px solid rgba(255,255,255,.15)', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', lineHeight: 1 }}>−</button>
                              )}
                              {isWidget ? renderWidget(c.item) : (
                                <a href={c.item.href} onClick={e => { if (jiggleMode) e.preventDefault() }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, textDecoration: 'none', padding: '4px 0' }}>
                                  <div style={{ width: 60, height: 60, borderRadius: 15, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.55)' }}>
                                    {iconSvgs[c.item.label] || iconSvgs.Calendar}
                                  </div>
                                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,.55)', textAlign: 'center', lineHeight: 1.1, fontWeight: 500 }}>{c.item.label}</span>
                                </a>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Done + Add buttons in jiggle mode — portaled to body to escape .content stacking context */}
            {jiggleMode && typeof document !== 'undefined' && createPortal(
              <div style={{ position: 'fixed', top: 'calc(var(--shell-top, 52px) + 12px)', left: 16, right: 16, zIndex: 99999, display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none' }}>
                <button onClick={e => { e.stopPropagation(); setJiggleMode(false); setShowAddSheet(false); setDragId(null); setDragPos(null); setDragOverIdx(null) }} style={{ padding: '6px 16px', borderRadius: 999, border: '1px solid rgba(255,255,255,.20)', background: 'rgba(20,20,20,.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', pointerEvents: 'auto', boxShadow: '0 2px 12px rgba(0,0,0,.5)' }}>Done</button>
                <button onClick={e => { e.stopPropagation(); if (hiddenItems.length > 0) setShowAddSheet(true) }} style={{ width: 34, height: 34, borderRadius: 999, border: '1px solid rgba(255,255,255,.20)', background: 'rgba(20,20,20,.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', color: '#fff', fontSize: 18, fontWeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', lineHeight: 1, pointerEvents: 'auto', boxShadow: '0 2px 12px rgba(0,0,0,.5)', opacity: hiddenItems.length > 0 ? 1 : 0.3 }}>+</button>
              </div>, document.body)}

            {/* Floating drag clone */}
            {dragId && dragPos && typeof document !== 'undefined' && createPortal(
              (() => {
                const dragItem = ALL_ITEMS.find(i => i.id === dragId)
                if (!dragItem) return null
                const isWidget = dragItem.type !== 'icon'
                const w = isWidget ? (dragItem.cols === 4 ? 280 : 140) : 70
                return (
                  <div style={{ position: 'fixed', left: dragPos.x - w / 2, top: dragPos.y - 40, width: w, zIndex: 100000, pointerEvents: 'none', transform: 'scale(1.08)', opacity: 0.85, filter: 'drop-shadow(0 8px 24px rgba(0,0,0,.6))' }}>
                    {isWidget ? renderWidget(dragItem) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '4px 0' }}>
                        <div style={{ width: 60, height: 60, borderRadius: 15, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.55)' }}>
                          {iconSvgs[dragItem.label] || iconSvgs.Calendar}
                        </div>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.55)', textAlign: 'center', lineHeight: 1.1, fontWeight: 500 }}>{dragItem.label}</span>
                      </div>
                    )}
                  </div>
                )
              })(), document.body)}

            {/* Add widget sheet */}
            {showAddSheet && hiddenItems.length > 0 && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={() => setShowAddSheet(false)}>
                <div style={{ background: 'rgba(0,0,0,.7)', position: 'absolute', inset: 0 }} />
                <div onClick={e => e.stopPropagation()} style={{ position: 'relative', background: 'rgba(20,20,20,.95)', borderRadius: '20px 20px 0 0', border: '1px solid rgba(255,255,255,.08)', borderBottom: 'none', padding: '16px 20px 80px', maxHeight: '70%', overflowY: 'auto' }}>
                  <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.15)', margin: '0 auto 16px' }} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.55)', marginBottom: 14, letterSpacing: '.06em', textTransform: 'uppercase' }}>Add Widget</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {hiddenItems.map(hi => (
                      <button key={hi.id} onClick={e => { e.stopPropagation(); addItem(hi.id); if (hiddenItems.length <= 1) setShowAddSheet(false) }} style={{ padding: '10px 18px', borderRadius: 999, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.70)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 16, fontWeight: 300, lineHeight: 1, color: 'rgba(255,255,255,.4)' }}>+</span> {hi.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Page dots — fixed above pill bar */}
            {totalPages > 1 && (
              <div style={{ position: 'fixed', bottom: 80, left: 0, right: 0, zIndex: 10001, display: 'flex', justifyContent: 'center', gap: 6, padding: '4px 0', pointerEvents: 'none' }}>
                {Array.from({ length: totalPages }, (_, i) => (
                  <div key={i} style={{ width: homePage === i ? 7 : 5, height: homePage === i ? 7 : 5, borderRadius: 999, background: homePage === i ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.15)', transition: 'all .25s ease' }} />
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Desktop layout ── */}
      {!isMobile && <div className="dash-container" style={{ padding: '10px 18px 0', maxWidth: 1400, margin: '0 auto', height: '100%', color: '#e8e8ed', fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Topbar removed — page name shown in Shell top-bar */}

        <style>{`
          @keyframes widgetBreathe {
            0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); border-color: rgba(255,255,255,.06); }
            50% { box-shadow: 0 0 14px 3px rgba(255,255,255,.05); border-color: rgba(255,255,255,.20); }
          }
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
          @media (min-width: 769px) {
            .content { overflow: hidden !important; }
          }
          @media (max-width: 768px) {
            .dash-topbar-row { flex-direction: column !important; align-items: stretch !important; gap: 8px !important; }
            .dash-search { width: 100% !important; }
            .dash-kpi-grid { grid-template-columns: 1fr !important; }
            .dash-quick-grid { grid-template-columns: 1fr !important; }
            .dash-review-form-grid { grid-template-columns: 1fr !important; }
            .dash-container { padding: 12px 10px 40px !important; }
          }
        `}</style>

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

        {/* Staff on clock — now rendered as a widget in the grid below */}

        {/* Barber earnings rendered as my-earnings widget in the grid below */}

        {/* ── ALL WIDGETS + SHORTCUTS + TEAM — single centered flex grid ── */}
        {(() => {
          const wBox: React.CSSProperties = { width: 170, minHeight: 110, borderRadius: 20, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', padding: '14px 16px', position: 'relative', transition: 'all .2s', animation: editingWidgets ? 'widgetBreathe 2s ease-in-out infinite' : 'none', display: 'flex', flexDirection: 'column' as const, justifyContent: 'space-between' as const }
          const wTitle: React.CSSProperties = { fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,.4)', marginBottom: 6 }
          const longPress = {
            onTouchStart: () => { longPressRef.current = setTimeout(() => { setEditingWidgets(true); editJustActivated.current = true; setTimeout(() => { editJustActivated.current = false }, 300) }, 600) },
            onTouchEnd: () => { if (longPressRef.current) clearTimeout(longPressRef.current) },
            onMouseDown: () => { longPressRef.current = setTimeout(() => { setEditingWidgets(true); editJustActivated.current = true; setTimeout(() => { editJustActivated.current = false }, 300) }, 600) },
            onMouseUp: () => { if (longPressRef.current) clearTimeout(longPressRef.current) },
            onMouseLeave: () => { if (longPressRef.current) clearTimeout(longPressRef.current) },
          }
          return (<>
        {/* ── WIDGETS (centered on screen) ── */}
        <div onClick={e => { if (editingWidgets && e.target === e.currentTarget && !editJustActivated.current) { setEditingWidgets(false); setEditingShortcuts(false) } }}
          style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', alignContent: 'center', overflow: 'hidden', position: 'relative', marginTop: '-5%' }}>
          {dashWidgets.map(wId => {
            const removeBtn = editingWidgets ? (
              <button onClick={() => toggleWidget(wId)} style={{ position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: 999, background: 'rgba(255,107,107,.8)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>−</button>
            ) : null

            if (wId === 'clock') {
              return (
                <div key={wId} {...longPress} style={{ ...wBox, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {removeBtn}
                  <ClockWidget />
                </div>
              )
            }
            if (wId === 'todays-earnings') {
              return (
                <div key={wId} {...longPress} style={wBox}>
                  {removeBtn}
                  <div style={wTitle}>Earnings</div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: 'rgba(130,220,170,.8)', letterSpacing: '-.02em' }}>{widgetLoading ? '—' : money(widgetData.todaysEarnings || 0)}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,.25)', marginTop: 2 }}>{total} bookings · {paid} paid</div>
                </div>
              )
            }
            if (wId === 'my-earnings' && isBarber) {
              const periodLabel = earningsPeriod === 'today' ? 'Day' : earningsPeriod === 'week' ? 'Week' : 'Month'
              return (
                <div key={wId} {...longPress} style={{ ...wBox, width: 350 }}>
                  {removeBtn}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={wTitle}>My Earnings</div>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {(['today', 'week', 'month'] as EarningsPeriod[]).map(p => (
                        <button key={p} onClick={() => { setEarningsPeriod(p); setEarningsOffset(0) }} style={{
                          height: 20, padding: '0 6px', borderRadius: 5, border: `1px solid ${earningsPeriod === p ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.06)'}`,
                          background: earningsPeriod === p ? 'rgba(255,255,255,.06)' : 'transparent',
                          color: earningsPeriod === p ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.25)', fontSize: 8, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '.06em', textTransform: 'uppercase',
                        }}>{p === 'today' ? 'Day' : p === 'week' ? 'Week' : 'Mo'}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
                    <button onClick={() => setEarningsOffset(o => o - 1)} style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', color: 'rgba(255,255,255,.4)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&lsaquo;</button>
                    <div style={{ fontSize: 10, color: earningsOffset === 0 ? 'rgba(255,255,255,.5)' : 'rgba(130,150,220,.6)', fontWeight: 600, minWidth: 80, textAlign: 'center' }}>
                      {getDateRange(earningsPeriod, earningsOffset).label}
                    </div>
                    <button onClick={() => setEarningsOffset(o => Math.min(0, o + 1))} disabled={earningsOffset >= 0} style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', color: earningsOffset >= 0 ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.4)', cursor: earningsOffset >= 0 ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&rsaquo;</button>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div style={{ flex: 1, padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(0,0,0,.12)' }}>
                      <div style={{ fontSize: 7, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 3 }}>Services</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,.6)' }}>{money(myPayroll?.barber_service_share || 0)}</div>
                    </div>
                    <div style={{ flex: 1, padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(0,0,0,.12)' }}>
                      <div style={{ fontSize: 7, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 3 }}>Tips</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(130,220,170,.8)' }}>{money(barberTips)}</div>
                    </div>
                    <div style={{ flex: 1, padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.03)' }}>
                      <div style={{ fontSize: 7, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 3 }}>Total</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{money(barberEarnings)}</div>
                    </div>
                  </div>
                </div>
              )
            }
            if (wId === 'weekly-chart') {
              const days = widgetData.weeklyRevenue || []
              const max = Math.max(...days.map((d: any) => d.amount), 1)
              return (
                <div key={wId} {...longPress} style={wBox}>
                  {removeBtn}
                  <div style={wTitle}>Revenue</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40 }}>
                    {days.map((d: any, i: number) => (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <div style={{ width: '100%', borderRadius: 2, background: i === days.length - 1 ? 'rgba(130,220,170,.4)' : 'rgba(255,255,255,.1)', height: `${Math.max(2, (d.amount / max) * 32)}px`, transition: 'height .4s' }} />
                        <span style={{ fontSize: 7, color: 'rgba(255,255,255,.2)' }}>{new Date(d.day + 'T12:00').toLocaleDateString([], { weekday: 'narrow' })}</span>
                      </div>
                    ))}
                  </div>
                  {days.length > 0 && <div style={{ fontSize: 9, color: 'rgba(255,255,255,.25)', marginTop: 3 }}>{money(days.reduce((s: number, d: any) => s + d.amount, 0))}</div>}
                </div>
              )
            }
            if (wId === 'new-clients') {
              return (
                <div key={wId} {...longPress} style={wBox}>
                  {removeBtn}
                  <div style={wTitle}>New Clients</div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,.7)' }}>{widgetData.newClients ?? '—'}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,.25)', marginTop: 2 }}>this week</div>
                </div>
              )
            }
            if (wId === 'quick-book') {
              return (
                <div key={wId} {...longPress} style={wBox}>
                  {removeBtn}
                  <a href="/calendar?action=new-booking" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'rgba(255,255,255,.5)', flexShrink: 0 }}>+</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.5)' }}>Quick Book</div>
                  </a>
                </div>
              )
            }
            if (wId === 'pending-requests') {
              const cnt = widgetData.pendingRequests ?? 0
              return (
                <div key={wId} {...longPress} style={wBox}>
                  {removeBtn}
                  <div style={wTitle}>Requests</div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: cnt > 0 ? 'rgba(255,180,100,.7)' : 'rgba(255,255,255,.2)' }}>{cnt}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,.25)', marginTop: 2 }}>{cnt > 0 ? 'pending' : 'clear'}</div>
                </div>
              )
            }
            if (wId === 'cash-register') {
              return (
                <div key={wId} {...longPress} style={wBox}>
                  {removeBtn}
                  <div style={wTitle}>Cash</div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: '#e8e8ed' }}>{money(widgetData.cashBalance || 0)}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,.25)', marginTop: 2 }}>today</div>
                </div>
              )
            }
            if (wId === 'team-on-duty') {
              return (
                <div key={wId} {...longPress} style={{ ...wBox, width: staffOnClock.length > 2 ? 350 : 190 }}>
                  {removeBtn}
                  <div style={wTitle}>On Duty</div>
                  {staffOnClock.length === 0 ? (
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.2)' }}>No one clocked in</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {staffOnClock.map((s: any, i: number) => {
                        const since = s.clock_in ? new Date(s.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'
                        const elapsed = s.clock_in ? Math.round((Date.now() - new Date(s.clock_in).getTime()) / 60000) : 0
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 5, height: 5, borderRadius: 999, background: 'rgba(130,220,170,.8)', animation: 'clockDot 2s ease-in-out infinite', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, fontSize: 10, color: 'rgba(255,255,255,.7)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.user_name || 'Staff'}</span>
                            <span style={{ fontSize: 8, color: 'rgba(255,255,255,.3)' }}>{since}</span>
                            <span style={{ fontSize: 9, color: 'rgba(130,220,170,.7)', fontWeight: 700 }}>{fmtMins(elapsed)}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }
            if (wId === 'expenses-month') {
              return (
                <div key={wId} {...longPress} style={wBox}>
                  {removeBtn}
                  <div style={wTitle}>Expenses</div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: 'rgba(255,130,130,.6)' }}>{money(widgetData.expensesMonth || 0)}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,.25)', marginTop: 2 }}>this month</div>
                </div>
              )
            }
            if (wId === 'mini-calendar') {
              return (
                <div key={wId} {...longPress} style={{ ...wBox, width: 350 }}>
                  {removeBtn}
                  <MiniCalendarWidget bookings={bookings} />
                </div>
              )
            }
            if (wId === 'site-analytics' && isOwnerOrAdmin) {
              const a = widgetData.analytics || { total: 0, by_source: {}, by_day: [] }
              const sources = Object.entries(a.by_source || {}).sort((x: any, y: any) => y[1] - x[1])
              const _si = { stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
              const srcIcon = (name: string) => {
                const p = { width: 10, height: 10, viewBox: '0 0 24 24' }
                switch (name) {
                  case 'instagram': return <svg {...p}><rect x="2" y="2" width="20" height="20" rx="5" {..._si}/><circle cx="12" cy="12" r="5" {..._si}/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/></svg>
                  case 'google': return <svg {...p}><circle cx="11" cy="11" r="7" {..._si}/><line x1="16.5" y1="16.5" x2="21" y2="21" {..._si}/></svg>
                  case 'facebook': return <svg {...p}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" {..._si}/></svg>
                  case 'tiktok': return <svg {...p}><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" {..._si}/></svg>
                  case 'twitter': return <svg {...p}><path d="M4 4l6.5 8L4 20h2l5.1-6.3L15 20h5l-6.8-8.4L19.5 4H17.5l-4.8 5.9L9 4H4z" {..._si}/></svg>
                  case 'direct': return <svg {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" {..._si}/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" {..._si}/></svg>
                  default: return <svg {...p}><circle cx="12" cy="12" r="10" {..._si}/><line x1="2" y1="12" x2="22" y2="12" {..._si}/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" {..._si}/></svg>
                }
              }
              const maxS = Math.max(...sources.map((s: any) => s[1]), 1)
              const days = a.by_day || []
              const maxD = Math.max(...days.map((d: any) => d.count), 1)
              return (
                <div key={wId} {...longPress} onClick={() => { if (!editingWidgets) window.location.href = '/analytics' }} style={{ ...wBox, width: 350, cursor: editingWidgets ? 'default' : 'pointer' }}>
                  {removeBtn}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={wTitle}>Site Visits</div>
                    {!editingWidgets && <span style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', marginTop: -2 }}>→</span>}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: '#e8e8ed', marginBottom: 8 }}>{a.total}</div>
                  {/* Sources */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
                    {sources.slice(0, 5).map(([src, cnt]: any) => (
                      <div key={src} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.35)' }}>{srcIcon(src)}</span>
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,.5)', width: 55, textTransform: 'capitalize' }}>{src}</span>
                        <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.06)' }}>
                          <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,.2)', width: `${(cnt / maxS) * 100}%` }} />
                        </div>
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', width: 20, textAlign: 'right' }}>{cnt}</span>
                      </div>
                    ))}
                    {sources.length === 0 && <div style={{ fontSize: 9, color: 'rgba(255,255,255,.2)' }}>No visits yet</div>}
                  </div>
                  {/* Daily chart */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 28 }}>
                    {days.map((d: any, i: number) => (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <div style={{ width: '100%', borderRadius: 2, background: i === days.length - 1 ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.1)', height: `${Math.max(2, (d.count / maxD) * 22)}px` }} />
                        <span style={{ fontSize: 6, color: 'rgba(255,255,255,.2)' }}>{new Date(d.day + 'T12:00').toLocaleDateString([], { weekday: 'narrow' })}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,.25)', marginTop: 4 }}>Last 7 days</div>
                </div>
              )
            }
            return null
          })}



          {/* Available widgets in edit mode */}
          {editingWidgets && (() => {
            const ALL_WIDGETS: { id: string; label: string }[] = [
              { id: 'clock', label: 'Clock' },
              { id: 'todays-earnings', label: 'Earnings' },
              ...(isBarber ? [{ id: 'my-earnings', label: 'My Earnings' }] : []),
              { id: 'weekly-chart', label: 'Revenue' },
              { id: 'new-clients', label: 'New Clients' },
              { id: 'quick-book', label: 'Quick Book' },
              { id: 'pending-requests', label: 'Requests' },
              { id: 'cash-register', label: 'Cash' },
              { id: 'team-on-duty', label: 'On Duty' },
              { id: 'expenses-month', label: 'Expenses' },
              { id: 'mini-calendar', label: 'Schedule' },
              ...(isOwnerOrAdmin ? [{ id: 'site-analytics', label: 'Site Visits' }] : []),
            ]
            const available = ALL_WIDGETS.filter(w => !dashWidgets.includes(w.id))
            return available.map(w => (
              <button key={w.id} onClick={() => toggleWidget(w.id)}
                style={{ width: 170, minHeight: 110, padding: '14px 16px', borderRadius: 20, border: '1px dashed rgba(255,255,255,.10)', background: 'rgba(255,255,255,.02)', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit', animation: 'widgetBreathe 2s ease-in-out infinite', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,.25)', marginBottom: 2 }}>+</div>
                <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,.35)' }}>{w.label}</div>
              </button>
            ))
          })()}

        </div>

        {/* ── APP ICONS (above bottom nav) ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', paddingBottom: 8, flexShrink: 0, marginBottom: '5%' }}>
          {/* ── App Shortcuts (icon + label, like iOS app icons) ── */}
          {(() => {
            const shortcutIcons: Record<string, React.ReactNode> = {
              '/calendar': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
              '/history': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/></svg>,
              '/clients': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
              '/payments': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
              '/waitlist': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 2v4"/><path d="M12 18v4"/><circle cx="12" cy="12" r="6"/></svg>,
              '/portfolio': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>,
              '/cash': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
              '/membership': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
              '/attendance': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
              '/expenses': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 4H3v16h18V4z"/><path d="M3 10h18"/><path d="M9 4v16"/></svg>,
              '/payroll': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/></svg>,
            }
            const visibleActions = editingWidgets
              ? actions.filter(item => item.label !== 'Settings')
              : actions.filter(item => item.label !== 'Settings' && ((item as any).core || dashShortcuts.includes(item.href)))
            return visibleActions.map(item => {
              const isActive = dashShortcuts.includes(item.href)
              const isEditing = editingWidgets
              return (
                <a key={'sc-'+item.href} {...longPress} href={isEditing ? undefined : item.href} onClick={isEditing ? (e: any) => { e.preventDefault(); e.stopPropagation(); toggleShortcut(item.href) } : undefined}
                  style={{ width: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 4px', textDecoration: 'none', position: 'relative', opacity: !isActive && isEditing ? 0.4 : 1, animation: isEditing ? 'widgetBreathe 2s ease-in-out infinite' : 'none', cursor: isEditing ? 'pointer' : undefined }}>
                  {isEditing && isActive && (
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleShortcut(item.href) }} style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: 999, background: 'rgba(255,107,107,.8)', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>−</button>
                  )}
                  {isEditing && !isActive && (
                    <div style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: 999, background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 700, zIndex: 2 }}>+</div>
                  )}
                  <div style={{ width: 56, height: 56, borderRadius: 16, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.5)' }}>
                    {shortcutIcons[item.href] || <span style={{ fontSize: 16 }}>•</span>}
                  </div>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', textAlign: 'center', lineHeight: 1.2, fontWeight: 500 }}>{item.label}</span>
                </a>
              )
            })
          })()}

          {/* ── Booking shortcut ── */}
          {!isBarber && user?.workspace_id && (
            <a href={`/book/${slug || user.workspace_id}`} target="_blank" rel="noopener"
              style={{ width: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 4px', textDecoration: 'none' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.5)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              </div>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', textAlign: 'center', lineHeight: 1.2, fontWeight: 500 }}>Booking</span>
            </a>
          )}

        </div>

        </>)
        })()}

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
                      <div style={{ fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.40)', marginBottom: 4 }}>Team Member</div>
                      <select value={rvBarber} onChange={e => setRvBarber(e.target.value)}
                        style={{ width: '100%', height: 40, borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)', color: '#fff', padding: '0 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
                        <option value="">Select specialist</option>
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
                      style={{ height: 28, padding: '0 10px', borderRadius: 999, border: `1px solid ${reviewFilter === b.id ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.08)'}`, background: reviewFilter === b.id ? 'rgba(255,255,255,.06)' : 'transparent', color: reviewFilter === b.id ? 'rgba(130,150,220,.6)' : 'rgba(255,255,255,.55)', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}>
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
                            {r.barber_name && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.6)', letterSpacing: '.06em', textTransform: 'uppercase' }}>{r.barber_name}</span>}
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
                        {r.barber_name && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.6)', letterSpacing: '.06em', textTransform: 'uppercase' }}>{r.barber_name}</span>}
                        {r.source === 'google' && <span style={{ fontSize: 9, color: 'rgba(255,255,255,.4)' }}>Google</span>}
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

      </div>}
    </Shell>
  )
}
