'use client'
import { useEffect, useState, useCallback } from 'react'
import Shell from '@/components/Shell'
import FeatureGate from '@/components/FeatureGate'
import { apiFetch } from '@/lib/api'

interface Membership {
  id: string; client_id: string; client_name: string; client_phone: string
  barber_id: string; barber_name: string; service_id: string; service_name: string
  frequency: string; preferred_day: number; preferred_time_min: number
  duration_minutes: number; amount_cents: number; status: string
  next_booking_at: string; last_booking_at: string; charge_count: number
  created_at: string
}
interface Barber { id: string; name: string }
interface Service { id: string; name: string; durationMin: number; price?: string; barberIds: string[] }

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const FREQ_LABELS: Record<string,string> = { weekly: 'Weekly', biweekly: 'Every 2 weeks', monthly: 'Monthly' }
const STATUS_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  active: { color: 'rgba(130,220,170,.8)', bg: 'rgba(143,240,177,.10)', border: 'rgba(143,240,177,.30)' },
  paused: { color: 'rgba(220,190,130,.5)', bg: 'rgba(255,207,63,.08)', border: 'rgba(255,207,63,.30)' },
  cancelled: { color: 'rgba(220,130,160,.5)', bg: 'rgba(255,107,107,.08)', border: 'rgba(255,107,107,.25)' },
}

const money = (cents: number) => '$' + (cents / 100).toFixed(2)
const minToTime = (min: number) => { const h = Math.floor(min / 60), m = min % 60, ap = h >= 12 ? 'PM' : 'AM'; return `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(m).padStart(2, '0')} ${ap}` }
const fmtDate = (iso: string) => { try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return iso } }
const fmtDateTime = (iso: string) => { try { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) } catch { return iso } }

export default function MembershipPage() {
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Membership | null>(null)

  // Form
  const [fClient, setFClient] = useState('')
  const [fPhone, setFPhone] = useState('')
  const [fBarber, setFBarber] = useState('')
  const [fServiceIds, setFServiceIds] = useState<string[]>([])
  const [fFreq, setFFreq] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly')
  const [fDay, setFDay] = useState(1)
  const [fTime, setFTime] = useState(600)
  const [fDiscount, setFDiscount] = useState(10)
  const [saving, setSaving] = useState(false)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [mData, bData, sData] = await Promise.all([
        apiFetch('/api/memberships'),
        apiFetch('/api/barbers'),
        apiFetch('/api/services'),
      ])
      setMemberships(mData?.memberships || [])
      const bList = (Array.isArray(bData) ? bData : bData?.barbers || []).filter((b: any) => b.active !== false)
      setBarbers(bList.map((b: any) => ({ id: b.id, name: b.name })))
      const sList = (sData?.services || []).map((s: any) => ({
        id: s.id, name: s.name,
        durationMin: s.duration_minutes || Math.round((s.durationMs || 0) / 60000) || 30,
        price: s.price_cents > 0 ? (s.price_cents / 100).toFixed(2) : '',
        barberIds: (s.barber_ids || []).map(String),
      }))
      setServices(sList)
    } catch (e: any) { showToast('Error: ' + e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditing(null); setFClient(''); setFPhone(''); setFBarber(barbers[0]?.id || ''); setFServiceIds([]); setFFreq('weekly'); setFDay(1); setFTime(600); setFDiscount(10); setShowModal(true)
  }
  function openEdit(m: Membership) {
    setEditing(m); setFClient(m.client_name); setFPhone(m.client_phone || ''); setFBarber(m.barber_id); setFServiceIds((m as any).service_ids?.length ? (m as any).service_ids : m.service_id ? [m.service_id] : []); setFFreq(m.frequency as any); setFDay(m.preferred_day); setFTime(m.preferred_time_min); setFDiscount((m as any).discount_pct ?? 10); setShowModal(true)
  }

  async function handleSave() {
    if (!fClient.trim()) { showToast('Enter client name'); return }
    if (!fBarber) { showToast('Select team member'); return }
    if (!fServiceIds.length) { showToast('Select at least one service'); return }
    setSaving(true)
    const barber = barbers.find(b => b.id === fBarber)
    const selectedSvcs = services.filter(s => fServiceIds.includes(s.id))
    const totalDur = selectedSvcs.reduce((sum, s) => sum + (s.durationMin || 30), 0)
    const totalCentsRaw = selectedSvcs.reduce((sum, s) => sum + (s.price ? Math.round(parseFloat(s.price) * 100) : 0), 0)
    const discountedCents = Math.round(totalCentsRaw * (1 - fDiscount / 100))
    const svcNames = selectedSvcs.map(s => s.name).join(' + ')
    try {
      if (editing) {
        await apiFetch(`/api/memberships/${editing.id}`, { method: 'PATCH', body: JSON.stringify({
          barber_id: fBarber, barber_name: barber?.name || '',
          service_id: fServiceIds.join(','), service_ids: fServiceIds, service_name: svcNames,
          duration_minutes: totalDur, frequency: fFreq, preferred_day: fDay, preferred_time_min: fTime,
          amount_cents: discountedCents, discount_pct: fDiscount,
        }) })
        showToast('Membership updated ✓')
      } else {
        await apiFetch('/api/memberships', { method: 'POST', body: JSON.stringify({
          client_name: fClient.trim(), client_phone: fPhone, barber_id: fBarber, barber_name: barber?.name || '',
          service_id: fServiceIds.join(','), service_ids: fServiceIds, service_name: svcNames,
          duration_minutes: totalDur, frequency: fFreq, preferred_day: fDay, preferred_time_min: fTime,
          amount_cents: discountedCents, discount_pct: fDiscount,
        }) })
        showToast('Membership created ✓')
      }
      setShowModal(false); load()
    } catch (e: any) { showToast('Error: ' + e.message) }
    setSaving(false)
  }

  async function toggleStatus(m: Membership) {
    const newStatus = m.status === 'active' ? 'paused' : 'active'
    try {
      await apiFetch(`/api/memberships/${m.id}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) })
      showToast(newStatus === 'active' ? 'Resumed ✓' : 'Paused ✓'); load()
    } catch (e: any) { showToast('Error: ' + e.message) }
  }

  async function cancelMembership(m: Membership) {
    try {
      const res = await apiFetch(`/api/memberships/${m.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) })
      const cnt = res?.cancelled_bookings || 0
      showToast(`Cancelled ✓${cnt ? ` — ${cnt} future booking${cnt !== 1 ? 's' : ''} removed` : ''}`); load()
    } catch (e: any) { showToast('Error: ' + e.message) }
  }

  async function deleteMembership(m: Membership) {
    try {
      const res = await apiFetch(`/api/memberships/${m.id}`, { method: 'DELETE' })
      const cnt = res?.deleted_bookings || 0
      showToast(`Deleted ✓${cnt ? ` — ${cnt} booking${cnt !== 1 ? 's' : ''} removed` : ''}`); load()
    } catch (e: any) { showToast('Error: ' + e.message) }
  }

  const active = memberships.filter(m => m.status === 'active')
  const paused = memberships.filter(m => m.status === 'paused')
  const cancelled = memberships.filter(m => m.status === 'cancelled')

  const card: React.CSSProperties = { borderRadius: 18, border: '1px solid rgba(255,255,255,.08)', background: 'linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02))', padding: 16 }
  const inp: React.CSSProperties = { width: '100%', height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(0,0,0,.22)', color: '#fff', padding: '0 14px', outline: 'none', fontSize: 14, fontFamily: 'inherit' }
  const lbl: React.CSSProperties = { fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', display: 'block', marginBottom: 6 }

  // Time options
  const timeOptions: { value: number; label: string }[] = []
  for (let h = 6; h <= 21; h++) for (let m = 0; m < 60; m += 30) timeOptions.push({ value: h * 60 + m, label: minToTime(h * 60 + m) })

  return (
    <Shell page="membership"><FeatureGate feature="membership" label="Membership" requiredPlan="salon">

      {/* Loading */}
      {loading && memberships.length === 0 && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(1,1,1,.8)', gap: 16 }}>
          <div style={{ position: 'relative', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/Element_logo-05.jpg" alt="Element" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }} />
            <svg viewBox="0 0 80 80" fill="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', animation: 'memSpin 1.2s linear infinite' }}>
              <circle cx="40" cy="40" r="38" stroke="rgba(255,255,255,.08)" strokeWidth="2.5" />
              <path d="M40 2a38 38 0 0 1 38 38" stroke="rgba(130,150,220,.6)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.30)', letterSpacing: '.08em' }}>Loading memberships…</div>
        </div>
      )}

      <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 14, height: '100vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' as any, paddingBottom: 100 }}>
        {/* Header — compact */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>{active.length} active · {paused.length} paused</span>
          <div style={{ flex: 1 }} />
          <button onClick={openAdd} style={{ height: 32, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontWeight: 600, fontSize: 11, fontFamily: 'inherit' }}>
            + Add
          </button>
        </div>

        {/* Membership cards */}
        {memberships.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,.25)', fontSize: 13 }}>No memberships yet</div>
        )}

        {memberships.map((m, i) => {
          const st = STATUS_STYLES[m.status] || STATUS_STYLES.active
          return (
            <div key={m.id} style={{ ...card, animation: 'memSlide .35s ease both', animationDelay: `${i * 0.04}s`, borderColor: st.border + '40' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 900, fontSize: 16 }}>{m.client_name}</span>
                    <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999, border: `1px solid ${st.border}`, background: st.bg, color: st.color }}>{m.status}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 12, color: 'rgba(255,255,255,.50)' }}>
                    <span>{m.barber_name || 'No team member'}</span>
                    <span style={{ color: 'rgba(255,255,255,.20)' }}>·</span>
                    <span>{m.service_name || 'No service'}</span>
                    <span style={{ color: 'rgba(255,255,255,.20)' }}>·</span>
                    <span style={{ color: 'rgba(255,255,255,.6)', fontWeight: 700 }}>{FREQ_LABELS[m.frequency] || m.frequency}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,.40)' }}>
                    <span>Every {DAYS[m.preferred_day]} at {minToTime(m.preferred_time_min)}</span>
                    {m.amount_cents > 0 && <span style={{ color: 'rgba(220,190,130,.5)', fontWeight: 700 }}>{money(m.amount_cents)}</span>}
                    {(m as any).discount_pct > 0 && <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(130,220,170,.8)', background: 'rgba(143,240,177,.12)', padding: '2px 6px', borderRadius: 999 }}>-{(m as any).discount_pct}%</span>}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6, fontSize: 11 }}>
                    {m.next_booking_at && m.status === 'active' && (
                      <span style={{ color: 'rgba(130,220,170,.8)' }}>Next: {fmtDateTime(m.next_booking_at)}</span>
                    )}
                    {m.charge_count > 0 && (
                      <span style={{ color: 'rgba(255,255,255,.30)' }}>{m.charge_count} booking{m.charge_count !== 1 ? 's' : ''} created</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => openEdit(m)} style={{ height: 28, padding: '0 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.60)', cursor: 'pointer', fontSize: 10, fontWeight: 700, fontFamily: 'inherit' }}>Edit</button>
                  {m.status !== 'cancelled' && (
                    <button onClick={() => toggleStatus(m)} style={{ height: 28, padding: '0 10px', borderRadius: 8, border: `1px solid ${m.status === 'active' ? 'rgba(255,207,63,.30)' : 'rgba(143,240,177,.30)'}`, background: m.status === 'active' ? 'rgba(255,207,63,.06)' : 'rgba(143,240,177,.06)', color: m.status === 'active' ? 'rgba(220,190,130,.5)' : 'rgba(130,220,170,.5)', cursor: 'pointer', fontSize: 10, fontWeight: 700, fontFamily: 'inherit' }}>
                      {m.status === 'active' ? 'Pause' : 'Resume'}
                    </button>
                  )}
                  {m.status !== 'cancelled' && (
                    <button onClick={() => cancelMembership(m)} style={{ height: 28, padding: '0 10px', borderRadius: 8, border: '1px solid rgba(255,107,107,.25)', background: 'rgba(255,107,107,.06)', color: 'rgba(220,130,160,.5)', cursor: 'pointer', fontSize: 10, fontWeight: 700, fontFamily: 'inherit' }}>Cancel</button>
                  )}
                  <button onClick={() => deleteMembership(m)} style={{ height: 28, padding: '0 10px', borderRadius: 8, border: '1px solid rgba(255,107,107,.40)', background: 'rgba(255,107,107,.10)', color: '#ff6b6b', cursor: 'pointer', fontSize: 10, fontWeight: 700, fontFamily: 'inherit' }}>Delete</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div style={{ width: 'min(440px,100%)', maxHeight: '90vh', overflowY: 'auto', borderRadius: 24, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(6,6,6,.96)', color: '#e8e8ed', fontFamily: 'Inter,sans-serif', boxShadow: '0 30px 80px rgba(0,0,0,.7)', animation: 'memModalIn .3s cubic-bezier(.4,0,.2,1)', WebkitOverflowScrolling: 'touch' as any }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
              <div style={{ fontFamily: '"Inter",sans-serif', letterSpacing: '.16em', textTransform: 'uppercase', fontSize: 13 }}>
                {editing ? 'Edit membership' : 'New membership'}
              </div>
              <button onClick={() => setShowModal(false)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.06)', color: '#fff', cursor: 'pointer', fontSize: 15, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {!editing && <>
                <div>
                  <label style={lbl}>Find client by phone</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={fPhone} onChange={e => setFPhone(e.target.value)} placeholder="Phone number" type="tel" style={{ ...inp, flex: 1 }} />
                    <button onClick={async () => {
                      if (!fPhone.trim()) return
                      try {
                        const data = await apiFetch(`/api/clients?q=${encodeURIComponent(fPhone.trim())}`)
                        const list = Array.isArray(data) ? data : (data?.clients || [])
                        if (list.length > 0) { setFClient(list[0].name || ''); showToast(`Found: ${list[0].name}`) }
                        else showToast('Client not found')
                      } catch { showToast('Search failed') }
                    }} style={{ height: 44, padding: '0 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.6)', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Search</button>
                  </div>
                  {fClient && <div style={{ marginTop: 6, fontSize: 13, color: 'rgba(130,220,170,.5)', fontWeight: 700 }}>{fClient}</div>}
                  {!fClient && <div style={{ marginTop: 6 }}><label style={lbl}>Or enter name manually</label><input value={fClient} onChange={e => setFClient(e.target.value)} placeholder="John Smith" style={inp} /></div>}
                </div>
              </>}
              <div><label style={lbl}>Team Member</label>
                <select value={fBarber} onChange={e => setFBarber(e.target.value)} style={inp}>
                  <option value="">Select team member</option>
                  {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Services <span style={{ color: 'rgba(255,255,255,.25)', fontWeight: 400 }}>({fServiceIds.length} selected)</span></label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {services.filter(s => !fBarber || !s.barberIds.length || s.barberIds.includes(fBarber)).map(s => {
                    const on = fServiceIds.includes(s.id)
                    return (
                      <button key={s.id} onClick={() => setFServiceIds(prev => on ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                        style={{ height: 36, padding: '0 12px', borderRadius: 10, border: `1px solid ${on ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.10)'}`, background: on ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.03)', color: on ? 'rgba(130,150,220,.6)' : 'rgba(255,255,255,.50)', cursor: 'pointer', fontSize: 12, fontWeight: on ? 800 : 500, fontFamily: 'inherit', transition: 'all .2s', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {on && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        {s.name}{s.price ? ` $${s.price}` : ''}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div><label style={lbl}>Frequency</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['weekly', 'biweekly', 'monthly'] as const).map(f => (
                    <button key={f} onClick={() => setFFreq(f)}
                      style={{ flex: 1, height: 38, borderRadius: 10, border: `1px solid ${fFreq === f ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.10)'}`, background: fFreq === f ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.03)', color: fFreq === f ? 'rgba(130,150,220,.6)' : 'rgba(255,255,255,.45)', cursor: 'pointer', fontWeight: 700, fontSize: 11, fontFamily: 'inherit', transition: 'all .2s' }}>
                      {FREQ_LABELS[f]}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lbl}>Day of week</label>
                  <select value={fDay} onChange={e => setFDay(Number(e.target.value))} style={inp}>
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Time</label>
                  <select value={fTime} onChange={e => setFTime(Number(e.target.value))} style={inp}>
                    {timeOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              {/* Discount + price preview */}
              <div>
                <label style={lbl}>Membership discount</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[0, 5, 10, 15, 20].map(d => (
                    <button key={d} onClick={() => setFDiscount(d)}
                      style={{ flex: 1, height: 36, borderRadius: 10, border: `1px solid ${fDiscount === d ? 'rgba(143,240,177,.50)' : 'rgba(255,255,255,.10)'}`, background: fDiscount === d ? 'rgba(143,240,177,.12)' : 'rgba(255,255,255,.03)', color: fDiscount === d ? 'rgba(130,220,170,.5)' : 'rgba(255,255,255,.45)', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', transition: 'all .2s' }}>
                      {d}%
                    </button>
                  ))}
                </div>
              </div>
              {fServiceIds.length > 0 && (() => {
                const svcs = services.filter(s => fServiceIds.includes(s.id))
                const raw = svcs.reduce((sum, s) => sum + (s.price ? parseFloat(s.price) : 0), 0)
                const discounted = raw * (1 - fDiscount / 100)
                return (
                  <div style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid rgba(143,240,177,.20)', background: 'rgba(143,240,177,.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.40)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Per visit price</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 3 }}>
                        {fDiscount > 0 && <span style={{ fontSize: 13, color: 'rgba(255,255,255,.30)', textDecoration: 'line-through' }}>${raw.toFixed(2)}</span>}
                        <span style={{ fontSize: 20, fontWeight: 900, color: 'rgba(130,220,170,.5)' }}>${discounted.toFixed(2)}</span>
                      </div>
                    </div>
                    {fDiscount > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(130,220,170,.8)', background: 'rgba(143,240,177,.15)', padding: '4px 10px', borderRadius: 999 }}>SAVE {fDiscount}%</span>}
                  </div>
                )
              })()}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => setShowModal(false)} style={{ flex: 1, height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.60)', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={{ flex: 1, height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.6)', cursor: 'pointer', fontWeight: 900, fontSize: 13, fontFamily: 'inherit', opacity: saving ? .5 : 1 }}>
                  {saving ? 'Saving…' : editing ? 'Update' : 'Create membership'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: 'rgba(8,8,8,.92)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 999, padding: '10px 20px', boxShadow: '0 20px 60px rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', gap: 10, backdropFilter: 'blur(18px)', fontSize: 13, zIndex: 5000, whiteSpace: 'nowrap', color: '#e8e8ed', fontFamily: 'inherit', animation: 'memSlide .25s ease' }}>
          {toast}
        </div>
      )}

      <style>{`
        @keyframes memSpin { to { transform: rotate(360deg) } }
        @keyframes memSlide { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes memModalIn { 0% { opacity: 0; transform: scale(.96) translateY(8px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        select option { background: #111; }
      `}</style>
    </FeatureGate></Shell>
  )
}
