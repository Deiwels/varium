'use client'
import Shell from '@/components/Shell'
import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Booking {
  id: string
  client_name?: string
  client_phone?: string
  service_name?: string
  barber_name?: string
  barber_id?: string
  start_at?: string
  end_at?: string
  duration_minutes?: number
  status?: string
  paid?: boolean
  payment_method?: string
  amount?: number
  tip_amount?: number
  notes?: string
  created_by_role?: string
  source?: string
}
interface WaitlistEntry {
  id: string
  client_name?: string
  phone_raw?: string
  barber_id: string
  barber_name?: string
  date: string
  service_names?: string[]
  duration_minutes: number
  notified: boolean
  confirmed?: boolean
  removed?: boolean
  created_at: string
}
// Unified item for display
interface HistoryItem {
  id: string
  type: 'booking' | 'waitlist'
  client_name?: string
  service_name?: string
  barber_name?: string
  barber_id?: string
  date_iso: string // for sorting
  status: string
  duration_minutes?: number
  amount?: number
  tip_amount?: number
  start_at?: string
}
interface Barber { id: string; name: string; color?: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const BARBER_COLORS = ['#99d100', 'rgba(180,140,220,.8)', 'rgba(255,255,255,.7)', '#ffb000', 'rgba(220,130,160,.8)', 'rgba(130,200,220,.8)', '#ff6b6b']

const STATUS_STYLE: Record<string, { border: string; bg: string; color: string }> = {
  paid:      { border: 'rgba(143,240,177,.40)', bg: 'rgba(143,240,177,.10)', color: 'rgba(130,220,170,.5)' },
  completed: { border: 'rgba(143,240,177,.40)', bg: 'rgba(143,240,177,.10)', color: 'rgba(130,220,170,.5)' },
  done:      { border: 'rgba(255,207,63,.40)',  bg: 'rgba(255,207,63,.08)',  color: 'rgba(220,190,130,.5)' },
  booked:    { border: 'rgba(130,150,220,.35)', bg: 'rgba(130,150,220,.08)', color: 'rgba(130,150,220,.6)' },
  confirmed: { border: 'rgba(130,150,220,.35)', bg: 'rgba(130,150,220,.08)', color: 'rgba(130,150,220,.6)' },
  arrived:   { border: 'rgba(143,240,177,.40)', bg: 'rgba(143,240,177,.10)', color: 'rgba(130,220,170,.5)' },
  noshow:    { border: 'rgba(255,107,107,.40)', bg: 'rgba(255,107,107,.10)', color: 'rgba(220,130,160,.5)' },
  cancelled: { border: 'rgba(255,107,107,.30)', bg: 'rgba(255,107,107,.07)', color: 'rgba(220,130,160,.5)' },
  waitlist:  { border: 'rgba(255,207,63,.35)',  bg: 'rgba(255,207,63,.08)',  color: 'rgba(220,190,130,.5)' },
  'waitlist-confirmed': { border: 'rgba(130,150,220,.35)', bg: 'rgba(130,150,220,.08)', color: 'rgba(130,150,220,.6)' },
  'waitlist-removed':   { border: 'rgba(255,107,107,.30)', bg: 'rgba(255,107,107,.07)', color: 'rgba(220,130,160,.5)' },
}

const fmtDate = (iso: string) => {
  try {
    const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00')
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return iso }
}
const fmtTime = (iso: string) => {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch { return '' }
}
const fmtMoney = (n?: number) => n != null ? `$${n.toFixed(2)}` : '—'

function StatusChip({ status }: { status: string }) {
  const st = STATUS_STYLE[status] || { border: 'rgba(255,255,255,.12)', bg: 'rgba(0,0,0,.12)', color: 'rgba(255,255,255,.70)' }
  const label = status.startsWith('waitlist') ? status.replace('waitlist-', 'WL ').replace('waitlist', 'Waitlist') : status
  return (
    <span style={{
      fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase',
      padding: '3px 8px', borderRadius: 999,
      border: `1px solid ${st.border}`,
      background: st.bg,
      color: st.color,
      display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: 'currentColor', flexShrink: 0 }} />
      {label || '—'}
    </span>
  )
}

// ─── Filters ──────────────────────────────────────────────────────────────────
type DateRange = 'today' | 'week' | 'month' | 'all'
type TypeFilter = 'all' | 'booking' | 'waitlist'

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>('month')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [barberFilter, setBarberFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [bk, wl, br] = await Promise.all([
        apiFetch('/api/bookings?limit=1000'),
        apiFetch('/api/waitlist').catch(() => ({ waitlist: [] })),
        apiFetch('/api/barbers'),
      ])
      const bookings: Booking[] = Array.isArray(bk) ? bk : bk?.bookings || []
      const waitlist: WaitlistEntry[] = Array.isArray(wl) ? wl : wl?.waitlist || []
      const bList: Barber[] = Array.isArray(br) ? br : br?.barbers || []

      // Convert bookings to unified items
      const bookingItems: HistoryItem[] = bookings.map(b => ({
        id: b.id,
        type: 'booking' as const,
        client_name: b.client_name,
        service_name: b.service_name,
        barber_name: b.barber_name,
        barber_id: b.barber_id,
        date_iso: b.start_at || '',
        status: b.status || 'booked',
        duration_minutes: b.duration_minutes,
        amount: b.amount,
        tip_amount: b.tip_amount,
        start_at: b.start_at,
      }))

      // Convert waitlist entries to unified items
      const waitlistItems: HistoryItem[] = waitlist.map(w => ({
        id: `wl_${w.id}`,
        type: 'waitlist' as const,
        client_name: w.client_name,
        service_name: w.service_names?.join(', '),
        barber_name: w.barber_name,
        barber_id: w.barber_id,
        date_iso: w.created_at || w.date,
        status: w.confirmed ? 'waitlist-confirmed' : w.removed ? 'waitlist-removed' : 'waitlist',
        duration_minutes: w.duration_minutes,
        start_at: w.created_at,
      }))

      setItems([...bookingItems, ...waitlistItems])
      setBarbers(bList)
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ─── Filter + sort ────────────────────────────────────────────────────────
  const filtered = items.filter(b => {
    // type
    if (typeFilter !== 'all' && b.type !== typeFilter) return false
    // date range
    if (dateRange !== 'all' && b.date_iso) {
      const d = new Date(b.date_iso.includes('T') ? b.date_iso : b.date_iso + 'T00:00:00')
      const now = new Date()
      if (dateRange === 'today') {
        if (d.toDateString() !== now.toDateString()) return false
      } else if (dateRange === 'week') {
        const diff = now.getTime() - d.getTime()
        if (diff > 7 * 86400000 || diff < 0) return false
      } else if (dateRange === 'month') {
        const diff = now.getTime() - d.getTime()
        if (diff > 30 * 86400000 || diff < 0) return false
      }
    }
    // status
    if (statusFilter !== 'all' && b.status !== statusFilter) return false
    // barber
    if (barberFilter !== 'all' && b.barber_id !== barberFilter) return false
    // search
    if (search) {
      const q = search.toLowerCase()
      if (!(b.client_name || '').toLowerCase().includes(q) &&
          !(b.service_name || '').toLowerCase().includes(q) &&
          !(b.barber_name || '').toLowerCase().includes(q)) return false
    }
    return true
  }).sort((a, b) => {
    const da = new Date(a.date_iso || 0).getTime()
    const db = new Date(b.date_iso || 0).getTime()
    return sortDir === 'desc' ? db - da : da - db
  })

  // Stats
  const totalRevenue = filtered.reduce((s, b) => s + (b.amount || 0), 0)
  const totalTips = filtered.reduce((s, b) => s + (b.tip_amount || 0), 0)
  const completedCount = filtered.filter(b => ['done', 'completed', 'paid'].includes(b.status)).length
  const waitlistCount = filtered.filter(b => b.type === 'waitlist').length

  // ─── Styles ───────────────────────────────────────────────────────────────
  const lbl: React.CSSProperties = { fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)' }
  const selectStyle: React.CSSProperties = {
    height: 34, borderRadius: 10, border: '1px solid rgba(255,255,255,.10)',
    background: 'rgba(0,0,0,.30)', color: 'rgba(255,255,255,.7)',
    padding: '0 10px', outline: 'none', fontSize: 11, fontFamily: 'inherit',
    WebkitAppearance: 'none', cursor: 'pointer',
  }
  const cardBg: React.CSSProperties = {
    borderRadius: 16, border: '1px solid rgba(255,255,255,.06)',
    background: 'rgba(0,0,0,.30)', backdropFilter: 'blur(20px)',
    padding: '14px 16px',
  }

  const getBarberColor = (barberId?: string) => {
    if (!barberId) return 'rgba(255,255,255,.5)'
    const idx = barbers.findIndex(b => b.id === barberId)
    return barbers[idx]?.color || BARBER_COLORS[idx % BARBER_COLORS.length] || 'rgba(255,255,255,.5)'
  }

  return (
    <Shell page="history">
      <div style={{ padding: '16px 16px 120px', maxWidth: 900, margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>

        {/* ─── Header ──────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: '"Inter", sans-serif', letterSpacing: '.18em', textTransform: 'uppercase', fontSize: 15, color: '#e8e8ed', marginBottom: 4 }}>
            History
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', letterSpacing: '.06em' }}>
            Bookings & waitlist records
          </div>
        </div>

        {/* ─── Stats Row ───────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Total', value: String(filtered.length), color: 'rgba(130,150,220,.6)' },
            { label: 'Completed', value: String(completedCount), color: 'rgba(130,220,170,.5)' },
            { label: 'Revenue', value: fmtMoney(totalRevenue), color: 'rgba(220,190,130,.5)' },
            { label: 'Waitlist', value: String(waitlistCount), color: 'rgba(180,140,220,.6)' },
          ].map((s, i) => (
            <div key={i} style={{ ...cardBg, textAlign: 'center', padding: '12px 8px' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.value}</div>
              <div style={lbl}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ─── Filters ─────────────────────────────────────────────────────── */}
        <div style={{ ...cardBg, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {/* Search */}
          <div style={{ flex: '1 1 180px', position: 'relative' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: .35 }}>
              <circle cx="11" cy="11" r="8" stroke="white" strokeWidth="1.5" fill="none" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="white" strokeWidth="1.5" />
            </svg>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search client, service, barber…"
              style={{
                width: '100%', height: 34, borderRadius: 10,
                border: '1px solid rgba(255,255,255,.10)',
                background: 'rgba(0,0,0,.30)', color: '#fff',
                padding: '0 12px 0 32px', outline: 'none', fontSize: 11, fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Type filter */}
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as TypeFilter)} style={selectStyle}>
            <option value="all">All types</option>
            <option value="booking">Bookings</option>
            <option value="waitlist">Waitlist</option>
          </select>

          {/* Date range */}
          <select value={dateRange} onChange={e => setDateRange(e.target.value as DateRange)} style={selectStyle}>
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="all">All time</option>
          </select>

          {/* Status */}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
            <option value="all">All statuses</option>
            <option value="booked">Booked</option>
            <option value="confirmed">Confirmed</option>
            <option value="arrived">Arrived</option>
            <option value="done">Done</option>
            <option value="completed">Completed</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
            <option value="noshow">No-show</option>
            <option value="waitlist">Waitlist (pending)</option>
            <option value="waitlist-confirmed">Waitlist (confirmed)</option>
            <option value="waitlist-removed">Waitlist (removed)</option>
          </select>

          {/* Barber */}
          <select value={barberFilter} onChange={e => setBarberFilter(e.target.value)} style={selectStyle}>
            <option value="all">All barbers</option>
            {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>

          {/* Sort */}
          <button
            onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            style={{
              height: 34, borderRadius: 10, border: '1px solid rgba(255,255,255,.10)',
              background: 'rgba(0,0,0,.30)', color: 'rgba(255,255,255,.5)',
              padding: '0 10px', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            {sortDir === 'desc' ? '\u2193 Newest' : '\u2191 Oldest'}
          </button>
        </div>

        {/* ─── Loading / Error ─────────────────────────────────────────────── */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,.30)', fontSize: 12 }}>
            Loading history…
          </div>
        )}
        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,107,107,.30)', background: 'rgba(255,107,107,.08)', color: 'rgba(220,130,160,.5)', fontSize: 12, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* ─── Empty ───────────────────────────────────────────────────────── */}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 32, marginBottom: 12, opacity: .2 }}>✦</div>
            <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 12 }}>No records found</div>
          </div>
        )}

        {/* ─── History List ────────────────────────────────────────────────── */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map(b => (
              <div key={b.id} style={{
                ...cardBg,
                padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
                transition: 'border-color .15s',
                borderLeftColor: b.type === 'waitlist' ? 'rgba(255,207,63,.25)' : undefined,
              }}>
                {/* Barber color dot */}
                <div style={{
                  width: 4, minHeight: 36, borderRadius: 4,
                  background: b.type === 'waitlist' ? 'rgba(255,207,63,.5)' : getBarberColor(b.barber_id),
                  flexShrink: 0, opacity: .7,
                }} />

                {/* Main info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8ed', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {b.client_name || 'Walk-in'}
                    </span>
                    <StatusChip status={b.status} />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,.45)' }}>
                      {b.service_name || '—'}
                    </span>
                    {b.barber_name && (
                      <>
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,.15)' }}>{'\u2022'}</span>
                        <span style={{ fontSize: 11, color: getBarberColor(b.barber_id), opacity: .8 }}>
                          {b.barber_name}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Date + amount */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.50)', marginBottom: 2 }}>
                    {b.date_iso ? fmtDate(b.date_iso) : '—'}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.30)' }}>
                    {b.start_at ? fmtTime(b.start_at) : ''}
                    {b.duration_minutes ? ` \u00b7 ${b.duration_minutes}m` : ''}
                  </div>
                  {(b.amount != null && b.amount > 0) && (
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(130,220,170,.5)', marginTop: 2 }}>
                      {fmtMoney(b.amount)}
                      {(b.tip_amount != null && b.tip_amount > 0) && (
                        <span style={{ fontSize: 10, color: 'rgba(180,140,220,.5)', marginLeft: 4 }}>
                          +{fmtMoney(b.tip_amount)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── Footer count ────────────────────────────────────────────────── */}
        {!loading && filtered.length > 0 && (
          <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 10, color: 'rgba(255,255,255,.20)', letterSpacing: '.08em' }}>
            {filtered.length} record{filtered.length !== 1 ? 's' : ''}
            {waitlistCount > 0 && ` \u00b7 ${waitlistCount} waitlist`}
          </div>
        )}
      </div>
    </Shell>
  )
}
