'use client'
import React, { useState, useEffect, useCallback } from 'react'
import Shell from '../../components/Shell'

import { apiFetch } from '@/lib/api'

interface WaitlistEntry {
  id: string
  client_name?: string
  phone_raw?: string
  phone_norm?: string
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

interface Barber { id: string; name: string }

export default function WaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [adding, setAdding] = useState(false)

  // Add form
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newBarberId, setNewBarberId] = useState('')
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [newDuration, setNewDuration] = useState(30)
  const [prefStartMin, setPrefStartMin] = useState(8 * 60)
  const [prefEndMin, setPrefEndMin] = useState(20 * 60)
  const [calOpen, setCalOpen] = useState(false)
  const [calYear, setCalYear] = useState(() => new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth())
  const [saving, setSaving] = useState(false)
  const [phoneSearching, setPhoneSearching] = useState(false)
  const [foundClients, setFoundClients] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [services, setServices] = useState<any[]>([])
  const [newServiceIds, setNewServiceIds] = useState<string[]>([])

  const [user] = useState(() => {
    try { return JSON.parse(localStorage.getItem('VURIUMBOOK_USER') || '{}') } catch { return {} }
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Load barbers and services independently — don't let waitlist error break them
      const [bd, sv] = await Promise.all([
        apiFetch('/api/barbers').catch(() => []),
        apiFetch('/api/services').catch(() => ({ services: [] })),
      ])
      const list = (Array.isArray(bd) ? bd : bd?.barbers || []).map((b: any) => ({ id: b.id, name: b.name }))
      setBarbers(list)
      if (!newBarberId && list.length) setNewBarberId(list[0].id)
      const svcList = sv?.services || []
      setServices(svcList.map((s: any) => ({ id: s.id, name: s.name, duration_minutes: s.duration_minutes || 30, barber_ids: s.barber_ids || [] })))
      // Waitlist may fail if index not ready
      try {
        const wl = await apiFetch('/api/waitlist')
        setEntries(wl?.waitlist || [])
      } catch { setEntries([]) }
    } catch (e: any) { console.warn('waitlist load:', e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { load(); const interval = setInterval(load, 30000); return () => clearInterval(interval) }, [load])

  async function confirm(id: string) {
    try {
      await apiFetch(`/api/waitlist/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ action: 'confirm' }) })
      load()
    } catch (e: any) { alert(e.message) }
  }

  async function remove(id: string) {
    try {
      await apiFetch(`/api/waitlist/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ action: 'remove' }) })
      load()
    } catch (e: any) { alert(e.message) }
  }

  // Phone formatting
  function digits(s: string) { return s.replace(/\D/g, '') }
  function formatPhoneDisplay(raw: string) {
    const d = digits(raw).replace(/^1/, '').slice(0, 10)
    if (d.length === 0) return ''
    if (d.length <= 3)  return `+1 (${d}`
    if (d.length <= 6)  return `+1 (${d.slice(0,3)}) ${d.slice(3)}`
    return `+1 (${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
  }

  async function searchByPhone(raw: string) {
    const d = digits(raw).replace(/^1/, '')
    if (d.length < 10) { setFoundClients([]); setShowNewForm(false); return }
    setPhoneSearching(true)
    try {
      const data = await apiFetch(`/api/clients?q=${encodeURIComponent(d)}`)
      const list = Array.isArray(data) ? data : Array.isArray(data?.clients) ? data.clients : []
      if (list.length > 0) {
        setFoundClients(list.slice(0, 5))
        setShowNewForm(false)
      } else {
        setFoundClients([])
        setShowNewForm(true)
      }
    } catch { setFoundClients([]); setShowNewForm(true) }
    setPhoneSearching(false)
  }

  function selectClient(c: any) {
    setSelectedClient(c)
    setNewName(c.name || '')
    setFoundClients([])
    setShowNewForm(false)
  }

  function clearClient() {
    setSelectedClient(null)
    setNewName('')
    setNewPhone('')
    setFoundClients([])
    setShowNewForm(false)
  }

  async function addEntry() {
    const name = selectedClient?.name || newName.trim()
    const phone = newPhone.trim() || selectedClient?.phone || ''
    if (!name || !newBarberId || !newDate) return
    setSaving(true)
    try {
      const barber = barbers.find(b => b.id === newBarberId)
      const selSvcs = services.filter((s: any) => newServiceIds.includes(s.id))
      const totalDur = selSvcs.reduce((sum: number, s: any) => sum + (s.duration_minutes || 30), 0) || newDuration
      await apiFetch('/api/waitlist', {
        method: 'POST',
        body: JSON.stringify({
          client_name: name,
          phone: phone,
          barber_id: newBarberId,
          barber_name: barber?.name || '',
          date: newDate,
          duration_minutes: totalDur,
          service_ids: newServiceIds,
          service_names: selSvcs.map((s: any) => s.name),
          preferred_start_min: prefStartMin,
          preferred_end_min: prefEndMin,
        }),
      })
      clearClient(); setAdding(false); setNewServiceIds([])
      load()
    } catch (e: any) { alert(e.message) }
    setSaving(false)
  }

  async function checkWaitlist() {
    try {
      const res = await apiFetch('/api/admin/waitlist/check')
      alert(`Checked: ${res.checked}, Notified: ${res.notified}`)
      load()
    } catch (e: any) { alert(e.message) }
  }

  const isBarber = user?.role === 'barber'
  const isStudent = user?.role === 'student'
  const myBarberId = user?.barber_id || ''

  const filtered = (() => {
    let list = entries
    // Barber sees only their own waitlist
    if (isBarber && myBarberId) list = list.filter(e => e.barber_id === myBarberId)
    // Manual filter on top
    if (filter) list = list.filter(e => e.barber_id === filter)
    return list
  })()

  const inp: React.CSSProperties = { width: '100%', height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)', color: '#fff', padding: '0 14px', outline: 'none', fontSize: 14, fontFamily: 'inherit' }
  const lbl: React.CSSProperties = { fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', display: 'block', marginBottom: 5 }

  return (
    <Shell page="Waitlist">
      <style>{`
        @media (max-width: 768px) {
          .wl-form-grid { grid-template-columns: 1fr !important; }
          .wl-time-row { flex-direction: column !important; }
          .wl-time-row select { width: 100% !important; flex: unset !important; }
          .wl-header-row { flex-direction: column !important; align-items: stretch !important; }
          .wl-header-row > div:last-child { justify-content: flex-end !important; }
          .wl-filter-pills { flex-wrap: nowrap !important; overflow-x: auto !important; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding-bottom: 4px; }
          .wl-filter-pills::-webkit-scrollbar { display: none; }
          .wl-filter-pills button { flex-shrink: 0 !important; }
          .wl-entry-card { flex-direction: column !important; align-items: stretch !important; }
          .wl-entry-actions { justify-content: flex-end !important; }
          .wl-cal-popup { left: -12px !important; right: -12px !important; min-width: 280px !important; }
          .wl-services-wrap { gap: 8px !important; }
          .wl-services-wrap button { flex: 1 1 auto !important; min-width: 0 !important; text-align: center !important; }
        }
      `}</style>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16, height: '100vh', overflowY: 'auto' }}>

        {/* Header */}
        <div className="wl-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#e9e9e9', fontFamily: '"Julius Sans One",sans-serif', letterSpacing: '.12em', textTransform: 'uppercase' }}>Waitlist</h2>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.40)', marginTop: 2 }}>{filtered.length} waiting</div>
          </div>
          <div style={{ visibility: 'hidden', pointerEvents: 'none' }}>
            <div style={{ height: 36 }}>placeholder</div>
          </div>
          <div style={{ display: 'flex', gap: 8, position: 'relative', zIndex: 1 }}>
            <button onClick={checkWaitlist} style={{ height: 36, padding: '0 14px', borderRadius: 999, border: '1px solid rgba(143,240,177,.35)', background: 'rgba(143,240,177,.08)', color: '#c9ffe1', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>
              Check & notify
            </button>
            <button onClick={() => setAdding(!adding)} style={{ height: 36, padding: '0 14px', borderRadius: 999, border: '1px solid rgba(10,132,255,.55)', background: 'rgba(10,132,255,.12)', color: '#d7ecff', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>
              {adding ? 'Cancel' : '+ Add'}
            </button>
          </div>
        </div>

        {/* Filter by barber — owner/admin only */}
        {!isBarber && !isStudent && (
        <div className="wl-filter-pills" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setFilter('')}
            style={{ height: 32, padding: '0 12px', borderRadius: 999, border: `1px solid ${!filter ? 'rgba(255,255,255,.30)' : 'rgba(255,255,255,.10)'}`, background: !filter ? 'rgba(255,255,255,.08)' : 'transparent', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>
            All
          </button>
          {barbers.map(b => (
            <button key={b.id} onClick={() => setFilter(b.id)}
              style={{ height: 32, padding: '0 12px', borderRadius: 999, border: `1px solid ${filter === b.id ? 'rgba(10,132,255,.55)' : 'rgba(255,255,255,.10)'}`, background: filter === b.id ? 'rgba(10,132,255,.12)' : 'transparent', color: filter === b.id ? '#d7ecff' : 'rgba(255,255,255,.65)', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>
              {b.name}
            </button>
          ))}
        </div>
        )}

        {/* Add form */}
        {adding && (
          <div style={{ padding: 16, borderRadius: 18, border: '1px solid rgba(10,132,255,.25)', background: 'rgba(10,132,255,.06)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#d7ecff', letterSpacing: '.08em', textTransform: 'uppercase' }}>Add to waitlist</div>

            {/* Selected client card */}
            {selectedClient ? (
              <div style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{selectedClient.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', marginTop: 2 }}>{selectedClient.phone || newPhone}</div>
                </div>
                <button onClick={clearClient} style={{ height: 28, padding: '0 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.55)', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}>Change</button>
              </div>
            ) : (
              <>
                {/* Phone search */}
                <div>
                  <label style={lbl}>Phone number</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <div style={{ position: 'absolute', left: 14, fontSize: 14, color: 'rgba(255,255,255,.55)', pointerEvents: 'none', fontWeight: 700, zIndex: 1 }}>+1</div>
                    <input
                      value={newPhone.replace(/^\+1\s?/, '')}
                      onChange={e => {
                        const formatted = formatPhoneDisplay(e.target.value)
                        setNewPhone(formatted)
                        searchByPhone(e.target.value)
                      }}
                      placeholder="(___) ___-____"
                      style={{ ...inp, paddingLeft: 38 }}
                      type="tel" autoComplete="off"
                    />
                    {phoneSearching && <div style={{ position: 'absolute', right: 14, width: 16, height: 16, border: '2px solid rgba(255,255,255,.20)', borderTop: '2px solid #0a84ff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
                  </div>
                </div>

                {/* Found clients dropdown */}
                {foundClients.length > 0 && (
                  <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.05)', overflow: 'hidden' }}>
                    {foundClients.map(c => (
                      <div key={c.id} onClick={() => selectClient(c)}
                        style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', gap: 10 }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(10,132,255,.10)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.40)' }}>{c.phone || ''}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* New client form */}
                {showNewForm && (
                  <div style={{ padding: '12px', borderRadius: 12, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)' }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', marginBottom: 8 }}>No client found — enter name:</div>
                    <div>
                      <label style={lbl}>Full name</label>
                      <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Client name" style={inp} autoFocus />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Barber, date, services */}
            <div className="wl-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={lbl}>Barber</label>
                <select value={newBarberId} onChange={e => setNewBarberId(e.target.value)} style={inp}>
                  {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div style={{ position: 'relative' }}>
                <label style={lbl}>Date</label>
                <button type="button" onClick={() => { setCalOpen(!calOpen); if (!calOpen) { const d = newDate ? new Date(newDate + 'T00:00:00') : new Date(); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()) } }}
                  style={{ ...inp, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{newDate ? new Date(newDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Select date'}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.40)" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                </button>
                {calOpen && (() => {
                  const today = new Date(); today.setHours(0,0,0,0)
                  const first = new Date(calYear, calMonth, 1)
                  const startDow = first.getDay()
                  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
                  const monthLabel = new Date(calYear, calMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                  const selectedDate = newDate ? new Date(newDate + 'T00:00:00') : null
                  const cells: { day: number; date: Date; inMonth: boolean }[] = []
                  for (let i = 0; i < 42; i++) {
                    const dayNum = i - startDow + 1
                    if (dayNum < 1) { cells.push({ day: new Date(calYear, calMonth, dayNum).getDate(), date: new Date(calYear, calMonth, dayNum), inMonth: false }) }
                    else if (dayNum > daysInMonth) { cells.push({ day: dayNum - daysInMonth, date: new Date(calYear, calMonth, dayNum), inMonth: false }) }
                    else { cells.push({ day: dayNum, date: new Date(calYear, calMonth, dayNum), inMonth: true }) }
                  }
                  return (
                    <div className="wl-cal-popup" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4, borderRadius: 18, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(0,0,0,.90)', backdropFilter: 'saturate(180%) blur(30px)', WebkitBackdropFilter: 'saturate(180%) blur(30px)', boxShadow: '0 16px 50px rgba(0,0,0,.60)', padding: 12 }}>
                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <button type="button" onClick={() => { let m = calMonth - 1, y = calYear; if (m < 0) { m = 11; y-- } setCalMonth(m); setCalYear(y) }}
                          style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.06)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 900 }}>‹</button>
                        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>{monthLabel}</span>
                        <button type="button" onClick={() => { let m = calMonth + 1, y = calYear; if (m > 11) { m = 0; y++ } setCalMonth(m); setCalYear(y) }}
                          style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.06)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 900 }}>›</button>
                      </div>
                      {/* DOW */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
                        {['S','M','T','W','T','F','S'].map((d,i) => <div key={i} style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,.40)', fontWeight: 700, letterSpacing: '.12em', padding: '4px 0' }}>{d}</div>)}
                      </div>
                      {/* Days */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
                        {cells.map((c, i) => {
                          const isPast = c.date < today
                          const isToday = c.date.getTime() === today.getTime()
                          const isSel = selectedDate && c.date.getFullYear() === selectedDate.getFullYear() && c.date.getMonth() === selectedDate.getMonth() && c.date.getDate() === selectedDate.getDate()
                          const disabled = !c.inMonth || isPast
                          return (
                            <button key={i} type="button" disabled={disabled}
                              onClick={() => { if (disabled) return; const y = c.date.getFullYear(), m = c.date.getMonth(), d = c.date.getDate(); setNewDate(`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`); setCalOpen(false) }}
                              style={{ height: 36, borderRadius: 999, border: 'none', cursor: disabled ? 'default' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                                background: isSel ? 'rgba(10,132,255,.22)' : 'transparent',
                                color: disabled ? 'rgba(255,255,255,.18)' : isSel ? '#fff' : c.inMonth ? '#e9e9e9' : 'rgba(255,255,255,.18)',
                                boxShadow: isSel ? '0 0 0 2px rgba(10,132,255,.75) inset, 0 0 14px rgba(10,132,255,.30)' : isToday && c.inMonth ? '0 0 0 1px rgba(255,255,255,.20) inset' : 'none',
                              }}>
                              {c.day}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Services */}
            {services.length > 0 && (
              <div>
                <label style={lbl}>Services</label>
                <div className="wl-services-wrap" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {services.filter((s: any) => !s.barber_ids?.length || s.barber_ids.includes(newBarberId)).map((s: any) => (
                    <button key={s.id} onClick={() => setNewServiceIds(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                      style={{ height: 32, padding: '0 12px', borderRadius: 999, border: `1px solid ${newServiceIds.includes(s.id) ? 'rgba(10,132,255,.55)' : 'rgba(255,255,255,.12)'}`, background: newServiceIds.includes(s.id) ? 'rgba(10,132,255,.14)' : 'rgba(255,255,255,.04)', color: newServiceIds.includes(s.id) ? '#d7ecff' : 'rgba(255,255,255,.60)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                      {s.name} ({s.duration_minutes}min)
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Preferred time range */}
            <div>
              <label style={lbl}>Preferred time range</label>
              <div className="wl-time-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select value={prefStartMin} onChange={e => setPrefStartMin(Number(e.target.value))} style={{ ...inp, flex: 1 }}>
                  {Array.from({ length: 28 }, (_, i) => {
                    const m = (7 * 60) + i * 30 // 7:00 AM to 20:30
                    const h = Math.floor(m / 60), mm = m % 60
                    const ampm = h >= 12 ? 'PM' : 'AM'
                    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
                    return <option key={m} value={m}>{h12}:{String(mm).padStart(2,'0')} {ampm}</option>
                  })}
                </select>
                <span style={{ color: 'rgba(255,255,255,.35)', fontSize: 12, fontWeight: 700 }}>to</span>
                <select value={prefEndMin} onChange={e => setPrefEndMin(Number(e.target.value))} style={{ ...inp, flex: 1 }}>
                  {Array.from({ length: 28 }, (_, i) => {
                    const m = (7 * 60 + 30) + i * 30 // 7:30 AM to 21:00
                    const h = Math.floor(m / 60), mm = m % 60
                    const ampm = h >= 12 ? 'PM' : 'AM'
                    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
                    return <option key={m} value={m}>{h12}:{String(mm).padStart(2,'0')} {ampm}</option>
                  })}
                </select>
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.30)', marginTop: 4 }}>Client will be notified only if a slot opens in this window</div>
            </div>

            {/* Duration override if no services selected */}
            {newServiceIds.length === 0 && (
              <div>
                <label style={lbl}>Duration</label>
                <select value={newDuration} onChange={e => setNewDuration(Number(e.target.value))} style={inp}>
                  {[15, 20, 25, 30, 35, 40, 45, 60, 90].map(m => <option key={m} value={m}>{m} min</option>)}
                </select>
              </div>
            )}

            <button onClick={addEntry} disabled={saving || (!(selectedClient?.name || newName.trim())) || !newBarberId}
              style={{ height: 44, borderRadius: 12, border: '1px solid rgba(10,132,255,.55)', background: 'rgba(10,132,255,.14)', color: '#d7ecff', cursor: 'pointer', fontWeight: 900, fontSize: 13, fontFamily: 'inherit', opacity: saving ? .5 : 1 }}>
              {saving ? 'Adding…' : 'Add to waitlist'}
            </button>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,.30)', fontSize: 13 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,.25)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="1.5" strokeLinecap="round" style={{ margin: '0 auto 12px' }}>
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
            </svg>
            <div style={{ fontSize: 14, fontWeight: 600 }}>No one waiting</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Clients will appear here when they join the waitlist</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(entry => {
              const barber = barbers.find(b => b.id === entry.barber_id)
              return (
                <div key={entry.id} className="wl-entry-card" style={{ padding: '14px 16px', borderRadius: 16, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, fontSize: 14 }}>{entry.client_name || 'Unknown'}</span>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(255,207,63,.30)', background: 'rgba(255,207,63,.08)', color: '#ffe9a3', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700 }}>WAITING</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>{barber?.name || entry.barber_name || '—'}</span>
                      <span>{entry.date}</span>
                      <span>{entry.duration_minutes}min</span>
                      {(entry as any).preferred_start_min != null && (entry as any).preferred_end_min != null && (entry as any).preferred_end_min < 1440 && (
                        <span style={{ color: 'rgba(10,132,255,.70)' }}>
                          {(() => { const s = (entry as any).preferred_start_min, e = (entry as any).preferred_end_min; const fmt = (m: number) => { const h = Math.floor(m/60), mm = m%60; return `${h===0?12:h>12?h-12:h}:${String(mm).padStart(2,'0')}${h>=12?'PM':'AM'}` }; return `${fmt(s)}–${fmt(e)}` })()}
                        </span>
                      )}
                      {entry.phone_raw && <span>{entry.phone_raw}</span>}
                    </div>
                    {entry.service_names?.length ? (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 4 }}>{entry.service_names.join(', ')}</div>
                    ) : null}
                  </div>
                  <div className="wl-entry-actions" style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => confirm(entry.id)}
                      style={{ height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(143,240,177,.40)', background: 'rgba(143,240,177,.10)', color: '#c9ffe1', cursor: 'pointer', fontWeight: 700, fontSize: 11, fontFamily: 'inherit' }}>
                      Confirm
                    </button>
                    <button onClick={() => remove(entry.id)}
                      style={{ height: 32, padding: '0 10px', borderRadius: 8, border: '1px solid rgba(255,107,107,.30)', background: 'rgba(255,107,107,.06)', color: '#ffd0d0', cursor: 'pointer', fontWeight: 700, fontSize: 11, fontFamily: 'inherit' }}>
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Shell>
  )
}
