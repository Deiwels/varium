'use client'
import { useEffect, useState, useCallback } from 'react'
import Shell from '@/components/Shell'
import FeatureGate from '@/components/FeatureGate'

import { apiFetch, API } from '@/lib/api'

const isoToday = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
const fmtTime = (iso?: string) => { if (!iso) return '—'; try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) } catch { return '—' } }
const fmtMins = (m: number) => { const h = Math.floor(m / 60); const mm = m % 60; return h > 0 ? `${h}h ${mm}m` : `${mm}m` }
const fmtHours = (m: number) => (m / 60).toFixed(1) + 'h'

const ROLE_COLORS: Record<string, string> = { owner: 'rgba(220,190,130,.5)', admin: 'rgba(130,220,170,.5)', barber: 'rgba(130,150,220,.6)', student: 'rgba(180,140,220,.6)' }
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface AttRecord {
  id: string; user_id: string; user_name: string; role: string; barber_id?: string
  clock_in: string | null; clock_out: string | null; duration_minutes: number | null; date: string
  auto_closed?: boolean; auto_close_reason?: string
  at_shop?: boolean; capped_to_schedule?: boolean; distance_meters?: number
}
interface Barber {
  id: string; name: string; schedule?: any; work_schedule?: any
}
interface UserSummary {
  name: string; role: string; total_minutes: number; shifts: number; late_minutes: number; late_count: number
}

function getScheduleStartMin(barber: Barber | undefined, dayOfWeek: number): number | null {
  const sch = barber?.schedule || barber?.work_schedule
  if (!sch) return null
  // Format 1: per-day array [Sun..Sat]
  if (Array.isArray(sch)) {
    const day = sch[dayOfWeek]
    if (!day || day.enabled === false) return null
    const sm = day.startMin ?? day.start_min
    return sm != null ? Number(sm) : null
  }
  if (typeof sch === 'object') {
    // Format 2: { perDay: [...], startMin, endMin, days }
    const perDay = sch.perDay || sch.per_day
    if (Array.isArray(perDay) && perDay[dayOfWeek]) {
      const day = perDay[dayOfWeek]
      if (day.enabled === false) return null
      const sm = day.startMin ?? day.start_min
      if (sm != null) return Number(sm)
    }
    // Fallback to global startMin
    const globalStart = sch.startMin ?? sch.start_min
    if (globalStart !== undefined) {
      const days: number[] = Array.isArray(sch.days) ? sch.days : [0, 1, 2, 3, 4, 5, 6]
      if (!days.includes(dayOfWeek)) return null
      return Number(globalStart)
    }
  }
  return null
}

// Convert Date to Chicago timezone hours/minutes/dayOfWeek
function toChicago(d: Date): { hours: number; minutes: number; dow: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false
  }).formatToParts(d)
  const obj: Record<string, string> = {}
  parts.forEach(p => { obj[p.type] = p.value })
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    hours: Number(obj.hour || 0),
    minutes: Number(obj.minute || 0),
    dow: dowMap[(obj.weekday || '').slice(0, 3)] ?? d.getDay()
  }
}

function getLateMinutes(clockIn: string | null, barber: Barber | undefined): number {
  if (!clockIn) return 0
  const d = new Date(clockIn)
  if (isNaN(d.getTime())) return 0
  // Convert to Chicago timezone (shop timezone)
  const chi = toChicago(d)
  const schedStart = getScheduleStartMin(barber, chi.dow)
  if (schedStart === null) return 0
  const clockMinOfDay = chi.hours * 60 + chi.minutes
  const late = clockMinOfDay - schedStart
  return late > 2 ? late : 0 // 2 min grace
}

export default function AttendancePage() {
  const [from, setFrom] = useState(isoToday())
  const [to, setTo] = useState(isoToday())
  const [records, setRecords] = useState<AttRecord[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterUser, setFilterUser] = useState('')

  const [user] = useState(() => { try { return JSON.parse(localStorage.getItem('VURIUMBOOK_USER') || 'null') } catch { return null } })
  const isOwner = user?.role === 'owner'
  const isAdmin = user?.role === 'admin'
  const canManage = isOwner || isAdmin

  async function forceClockOut(attendanceId: string, userName: string, userId: string) {
    if (!window.confirm(`Clock out ${userName} now?`)) return
    try {
      const token = localStorage.getItem('VURIUMBOOK_TOKEN') || ''
      const res = await fetch(`${API}/api/attendance/admin-clock-out`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ attendance_id: attendanceId, user_id: userId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Clock out failed. Backend may need admin-clock-out endpoint.')
      loadAll()
    } catch (e: any) { alert(e.message) }
  }

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [attData, brData, usData] = await Promise.all([
        apiFetch(`/api/attendance?from=${from}&to=${to}`),
        apiFetch('/api/barbers'),
        apiFetch('/api/users'),
      ])
      setRecords(attData?.attendance || [])
      const barberList = Array.isArray(brData) ? brData : (brData?.barbers || [])
      setBarbers(barberList)
      setUsers(usData?.users || [])
    } catch { setRecords([]); setBarbers([]); setUsers([]) }
    setLoading(false)
  }, [from, to])

  useEffect(() => { loadAll(); const interval = setInterval(loadAll, 30000); return () => clearInterval(interval) }, [loadAll])

  // Build barber map (barber_id → Barber) and user→barber map
  const barberMap: Record<string, Barber> = {}
  barbers.forEach(b => { barberMap[b.id] = b })

  // Map user_id → barber (via users table barber_id)
  const userBarberMap: Record<string, Barber | undefined> = {}
  users.forEach((u: any) => {
    if (u.barber_id && barberMap[u.barber_id]) userBarberMap[u.id] = barberMap[u.barber_id]
  })

  // Filter
  const filtered = filterUser ? records.filter(r => r.user_id === filterUser) : records

  // Group by date
  const byDate: Record<string, AttRecord[]> = {}
  filtered.forEach(r => {
    const d = r.date || '?'
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(r)
  })
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

  // Summary per user
  const summaryMap: Record<string, UserSummary> = {}
  filtered.forEach(r => {
    if (!summaryMap[r.user_id]) summaryMap[r.user_id] = { name: r.user_name, role: r.role, total_minutes: 0, shifts: 0, late_minutes: 0, late_count: 0 }
    const s = summaryMap[r.user_id]
    if (r.duration_minutes) s.total_minutes += r.duration_minutes
    s.shifts++
    const barber = r.barber_id ? barberMap[r.barber_id] : userBarberMap[r.user_id]
    const late = getLateMinutes(r.clock_in, barber)
    if (late > 0) { s.late_minutes += late; s.late_count++ }
  })
  const summaryList = Object.entries(summaryMap).sort((a, b) => b[1].total_minutes - a[1].total_minutes)

  // Unique users for filter
  const uniqueUsers = [...new Map(records.map(r => [r.user_id, { id: r.user_id, name: r.user_name }])).values()]

  const card: React.CSSProperties = { borderRadius: 18, border: '1px solid rgba(255,255,255,.10)', background: 'linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02))', boxShadow: '0 10px 40px rgba(0,0,0,.35)', padding: 16 }
  const inp: React.CSSProperties = { height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(0,0,0,.22)', color: '#fff', padding: '0 10px', outline: 'none', fontSize: 12, colorScheme: 'dark' as any }

  return (
    <Shell page="attendance"><FeatureGate feature="attendance" label="Attendance" requiredPlan="salon">

      <div style={{ padding: '18px 18px 40px', maxWidth: 1400, margin: '0 auto', overflowY: 'auto', height: '100vh', color: '#e8e8ed', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <style>{`
          @keyframes latePulse { 0%,100%{opacity:.7} 50%{opacity:1} }
          .late-badge { animation: latePulse 2s ease-in-out infinite; }
          .att-grid { display: grid; grid-template-columns: minmax(0,2fr) minmax(0,1fr); gap: 14px; }
          .att-topbar-controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
          .att-topbar-controls input[type="date"],
          .att-topbar-controls select { min-width: 0; }
          .att-log-col { display: flex; flex-direction: column; gap: 14px; max-height: none; overflow-y: visible; }
          @media (max-width: 768px) {
            .att-grid { grid-template-columns: 1fr !important; }
            .att-topbar-controls { flex-direction: column; align-items: stretch; }
            .att-topbar-controls input[type="date"],
            .att-topbar-controls select,
            .att-topbar-controls button { width: 100%; box-sizing: border-box; }
            .att-log-col { max-height: 60vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }
          }
        `}</style>

        {/* Topbar */}
        <div style={{ position: 'sticky', top: 0, zIndex: 20, padding: '10px 0 12px', background: 'linear-gradient(to bottom,rgba(0,0,0,.88),rgba(0,0,0,.68),transparent)', backdropFilter: 'blur(14px)', marginBottom: 16 } as React.CSSProperties}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, fontFamily: '"Inter", sans-serif', letterSpacing: '.18em', textTransform: 'uppercase', fontSize: 16 }}>Attendance</h2>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.40)', marginTop: 2 }}>Hours & clock history</div>
            </div>
            <div className="att-topbar-controls">
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inp} />
              <span style={{ color: 'rgba(255,255,255,.30)', fontSize: 12 }}>→</span>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} style={inp} />
              <select value={filterUser} onChange={e => setFilterUser(e.target.value)} style={{ ...inp, minWidth: 120 }}>
                <option value="">All staff</option>
                {uniqueUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Main grid */}
        <div className="att-grid">

          {/* Left — Attendance Log */}
          <div className="att-log-col">
            {loading && <div style={{ ...card, textAlign: 'center', color: 'rgba(255,255,255,.40)' }}>Loading attendance records…</div>}
            {!loading && sortedDates.length === 0 && <div style={{ ...card, textAlign: 'center', color: 'rgba(255,255,255,.40)' }}>No attendance records for this period.</div>}

            {sortedDates.map(date => {
              const dayRecords = byDate[date]
              const dayDate = new Date(date + 'T12:00:00')
              const dayName = !isNaN(dayDate.getTime()) ? dayDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : date
              return (
                <div key={date} style={card}>
                  <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', marginBottom: 10, fontWeight: 900 }}>{dayName}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {dayRecords.map(r => {
                      const barber = r.barber_id ? barberMap[r.barber_id] : userBarberMap[r.user_id]
                      const late = getLateMinutes(r.clock_in, barber)
                      const schedStart = barber && r.clock_in ? getScheduleStartMin(barber, toChicago(new Date(r.clock_in)).dow) : null
                      return (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 12, background: late > 0 ? 'rgba(255,107,107,.06)' : 'rgba(255,255,255,.03)', border: `1px solid ${late > 0 ? 'rgba(255,107,107,.15)' : 'rgba(255,255,255,.06)'}` }}>
                          {/* Clock icon */}
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={r.clock_out ? 'rgba(255,255,255,.30)' : 'rgba(130,220,170,.8)'} strokeWidth="2" strokeLinecap="round">
                            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                          </svg>
                          {/* Name + role */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: 700, fontSize: 13, color: '#e8e8ed' }}>{r.user_name}</span>
                              <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 999, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)', color: ROLE_COLORS[r.role] || 'rgba(255,255,255,.50)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{r.role}</span>
                              {late > 0 && (
                                <span className="late-badge" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, background: 'rgba(255,107,107,.15)', border: '1px solid rgba(255,107,107,.30)', color: '#ff6b6b', fontWeight: 700 }}>
                                  +{fmtMins(late)} late
                                </span>
                              )}
                            </div>
                            {schedStart !== null && (
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', marginTop: 1 }}>
                                Scheduled: {schedStart < 780 ? Math.floor(schedStart / 60) : Math.floor(schedStart / 60) - 12}:{String(schedStart % 60).padStart(2, '0')} {schedStart < 720 ? 'AM' : 'PM'}
                              </div>
                            )}
                          </div>
                          {/* Times */}
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)' }}>
                              {fmtTime(r.clock_in || undefined)} → {r.clock_out ? (<>{fmtTime(r.clock_out)}{r.auto_closed && <span style={{ fontSize: 9, color: '#ffb000', marginLeft: 4 }} title="Auto-closed: forgot to clock out">AUTO</span>}{r.capped_to_schedule && <span style={{ fontSize: 9, color: '#ff6b6b', marginLeft: 4 }} title={`Capped to schedule end (was ${r.distance_meters}m away)`}>CAPPED</span>}{r.at_shop === false && !r.auto_closed && !r.capped_to_schedule && <span style={{ fontSize: 9, color: 'rgba(255,255,255,.35)', marginLeft: 4 }}>OUT</span>}</>) : (<><span style={{ color: 'rgba(130,220,170,.8)' }}>Still in</span>{isOwner && <button onClick={() => forceClockOut(r.id, r.user_name || '?', r.user_id || '')} style={{ marginLeft: 6, height: 20, padding: '0 8px', borderRadius: 6, border: '1px solid rgba(255,107,107,.35)', background: 'rgba(255,107,107,.08)', color: 'rgba(220,130,160,.5)', cursor: 'pointer', fontSize: 9, fontWeight: 700, fontFamily: 'inherit' }}>Clock out</button>}</>)}
                            </div>
                            <div style={{ fontSize: 11, color: 'rgba(130,220,170,.8)', fontWeight: 700 }}>
                              {r.duration_minutes ? fmtMins(r.duration_minutes) : (r.clock_in ? fmtMins(Math.round((Date.now() - new Date(r.clock_in).getTime()) / 60000)) : '—')}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Right — Summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Total hours card */}
            <div style={card}>
              <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', marginBottom: 8, fontWeight: 900 }}>Period summary</div>
              <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '.02em', lineHeight: 1, marginBottom: 4 }}>
                {fmtHours(summaryList.reduce((s, [, u]) => s + u.total_minutes, 0))}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.40)' }}>
                {summaryList.reduce((s, [, u]) => s + u.shifts, 0)} shifts · {summaryList.length} staff
              </div>
            </div>

            {/* Per user breakdown */}
            <div style={card}>
              <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', marginBottom: 10, fontWeight: 900 }}>By staff member</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {summaryList.map(([uid, u]) => (
                  <div key={uid} style={{ padding: '8px 10px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#e8e8ed', flex: 1 }}>{u.name}</span>
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 999, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)', color: ROLE_COLORS[u.role] || 'rgba(255,255,255,.50)', textTransform: 'uppercase' }}>{u.role}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                      <div>
                        <span style={{ color: 'rgba(255,255,255,.40)' }}>Hours: </span>
                        <span style={{ color: 'rgba(130,220,170,.8)', fontWeight: 700 }}>{fmtHours(u.total_minutes)}</span>
                      </div>
                      <div>
                        <span style={{ color: 'rgba(255,255,255,.40)' }}>Shifts: </span>
                        <span style={{ color: 'rgba(130,150,220,.6)', fontWeight: 700 }}>{u.shifts}</span>
                      </div>
                      {u.late_count > 0 && (
                        <div>
                          <span style={{ color: 'rgba(255,255,255,.40)' }}>Late: </span>
                          <span style={{ color: '#ff6b6b', fontWeight: 700 }}>{u.late_count}× (avg {fmtMins(Math.round(u.late_minutes / u.late_count))})</span>
                        </div>
                      )}
                    </div>
                    {/* Hours bar */}
                    <div style={{ marginTop: 6, height: 4, borderRadius: 999, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,rgba(10,132,255,.60),rgba(143,240,177,.60))', width: `${Math.min(100, (u.total_minutes / Math.max(1, summaryList[0]?.[1]?.total_minutes || 1)) * 100)}%`, transition: 'width .3s ease' }} />
                    </div>
                  </div>
                ))}
                {summaryList.length === 0 && !loading && (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.30)', textAlign: 'center', padding: 12 }}>No data</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </FeatureGate></Shell>
  )
}
