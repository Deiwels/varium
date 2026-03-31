'use client'
import Shell from '@/components/Shell'
import { useEffect, useState, useCallback, useRef } from 'react'

import { apiFetch } from '@/lib/api'

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function usd(n: number) { return '$' + n.toFixed(2) }

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

interface CashReport { id: string; date: string; actual_cash: number; notes: string; submitted_by: string; submitted_at: string }
interface DaySummary { date: string; cashTotal: number; zelleTotal: number; cashTips: number; zelleTips: number; cashCount: number; zelleCount: number; report?: CashReport }

// ─── Custom Date Picker (dark theme) ─────────────────────────────────────────
function DatePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false)
  const d = value ? new Date(value + 'T12:00:00') : new Date()
  const [viewYear, setViewYear] = useState(d.getFullYear())
  const [viewMonth, setViewMonth] = useState(d.getMonth())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function close(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  function prevMonth() { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) } else setViewMonth(m => m - 1) }
  function nextMonth() { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) } else setViewMonth(m => m + 1) }

  const firstDow = new Date(viewYear, viewMonth, 1).getDay()
  const startOffset = firstDow === 0 ? 6 : firstDow - 1
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const today = localDateStr(new Date())
  const cells: (number | null)[] = Array(startOffset).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1))
  while (cells.length % 7 !== 0) cells.push(null)

  const displayDate = value ? new Date(value + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select date'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', marginBottom: 5 }}>{label}</div>
      <button onClick={() => { setOpen(!open); const dd = value ? new Date(value + 'T12:00:00') : new Date(); setViewYear(dd.getFullYear()); setViewMonth(dd.getMonth()) }}
        style={{ width: '100%', height: 44, borderRadius: 14, border: `1px solid ${open ? 'rgba(10,132,255,.50)' : 'rgba(255,255,255,.12)'}`, background: open ? 'rgba(10,132,255,.06)' : 'rgba(0,0,0,.22)', color: '#fff', padding: '0 14px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', transition: 'all .2s ease', boxShadow: open ? '0 0 12px rgba(10,132,255,.15)' : 'none' }}>
        {displayDate}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, zIndex: 100, borderRadius: 18, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(12,12,12,.95)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', boxShadow: '0 20px 60px rgba(0,0,0,.7), inset 0 0 0 .5px rgba(255,255,255,.06)', padding: '14px 12px 12px', animation: 'calPopIn .2s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button onClick={prevMonth} style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 900, fontFamily: 'inherit' }}>‹</button>
            <div style={{ fontWeight: 900, fontSize: 13, letterSpacing: '.06em' }}>{MONTHS[viewMonth]} {viewYear}</div>
            <button onClick={nextMonth} style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 900, fontFamily: 'inherit' }}>›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
            {DOW.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 9, letterSpacing: '.10em', color: 'rgba(255,255,255,.35)', padding: '4px 0', fontWeight: 700 }}>{d}</div>)}
            {cells.map((day, i) => {
              if (day === null) return <div key={`e${i}`} />
              const dateStr = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const isSelected = dateStr === value
              const isToday = dateStr === today
              return (
                <button key={i} onClick={() => { onChange(dateStr); setOpen(false) }}
                  style={{ width: '100%', height: 36, borderRadius: 10, border: isSelected ? '1px solid rgba(10,132,255,.65)' : isToday ? '1px solid rgba(255,255,255,.25)' : '1px solid transparent', background: isSelected ? 'rgba(10,132,255,.20)' : 'transparent', color: isSelected ? '#fff' : isToday ? 'rgba(130,150,220,.6)' : 'rgba(255,255,255,.75)', cursor: 'pointer', fontWeight: isSelected || isToday ? 900 : 500, fontSize: 13, fontFamily: 'inherit', transition: 'all .15s ease', boxShadow: isSelected ? '0 0 14px rgba(10,132,255,.25)' : 'none' }}>
                  {day}
                </button>
              )
            })}
          </div>
          <button onClick={() => { onChange(today); setOpen(false) }}
            style={{ width: '100%', height: 32, marginTop: 8, borderRadius: 999, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.60)', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', letterSpacing: '.06em', textTransform: 'uppercase' }}>
            Today
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Cash Page ──────────────────────────────────────────────────────────
export default function CashPage() {
  const today = localDateStr(new Date())
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(today)
  const [days, setDays] = useState<DaySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [editingDay, setEditingDay] = useState<string | null>(null)
  const [cashInput, setCashInput] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [activePreset, setActivePreset] = useState<string>('today')

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [paymentsData, reportsData] = await Promise.all([
        apiFetch(`/api/payments?from=${fromDate}&to=${toDate}`),
        apiFetch(`/api/cash-reports?from=${fromDate}&to=${toDate}`)
      ])
      // Use same data source as Payments page — /api/payments (merged Square + local)
      const allPayments = paymentsData?.payments || []
      const reports: CashReport[] = reportsData?.reports || []
      const reportMap = new Map(reports.map(r => [r.date, r]))
      const byDate = new Map<string, { cashTotal: number; zelleTotal: number; cashTips: number; zelleTips: number; cashCount: number; zelleCount: number }>()
      const start = new Date(fromDate + 'T00:00:00'), end = new Date(toDate + 'T00:00:00')
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) byDate.set(localDateStr(d), { cashTotal: 0, zelleTotal: 0, cashTips: 0, zelleTips: 0, cashCount: 0, zelleCount: 0 })
      // Filter exactly like Payments page does — by method field, status paid
      for (const p of allPayments) {
        if (p.status !== 'paid') continue
        const method = String(p.method || '').toLowerCase()
        if (method !== 'cash' && method !== 'zelle') continue
        const date = String(p.date || '').slice(0, 10)
        if (!date) continue
        const entry = byDate.get(date) || { cashTotal: 0, zelleTotal: 0, cashTips: 0, zelleTips: 0, cashCount: 0, zelleCount: 0 }
        const amt = Number(p.amount || 0)
        const tip = Number(p.tip || 0)
        if (method === 'cash') { entry.cashTotal += amt; entry.cashTips += tip; entry.cashCount++ }
        else if (method === 'zelle') { entry.zelleTotal += amt; entry.zelleTips += tip; entry.zelleCount++ }
        byDate.set(date, entry)
      }
      const result: DaySummary[] = []
      byDate.forEach((v, date) => result.push({ date, ...v, report: reportMap.get(date) }))
      result.sort((a, b) => b.date.localeCompare(a.date))
      setDays(result)
    } catch (e: any) { showToast('Error: ' + e.message) }
    setLoading(false)
  }, [fromDate, toDate])

  // Auto-load on mount and when dates change
  useEffect(() => { load() }, [load])

  async function saveReport(date: string) {
    const amount = parseFloat(cashInput)
    if (isNaN(amount) || amount < 0) { showToast('Enter valid amount'); return }
    setSaving(date)
    try {
      await apiFetch('/api/cash-reports', { method: 'POST', body: JSON.stringify({ date, actual_cash: amount, notes: noteInput.trim() }) })
      showToast('Cash report saved ✓')
      setEditingDay(null); setCashInput(''); setNoteInput(''); load()
    } catch (e: any) { showToast('Error: ' + e.message) }
    setSaving(null)
  }

  function setPreset(preset: string) {
    setActivePreset(preset)
    const now = new Date()
    if (preset === 'today') { setFromDate(today); setToDate(today) }
    else if (preset === 'week') { const w = new Date(now); w.setDate(w.getDate() - 6); setFromDate(localDateStr(w)); setToDate(today) }
    else { const m = new Date(now); m.setDate(m.getDate() - 29); setFromDate(localDateStr(m)); setToDate(today) }
  }

  const totalExpectedCash = days.reduce((s, d) => s + d.cashTotal + d.cashTips, 0)
  const totalExpectedZelle = days.reduce((s, d) => s + d.zelleTotal + d.zelleTips, 0)
  const totalActual = days.reduce((s, d) => s + (d.report?.actual_cash || 0), 0)
  const reportsCount = days.filter(d => d.report).length
  const totalDiff = reportsCount > 0 ? totalActual - days.filter(d => d.report).reduce((s, d) => s + d.cashTotal + d.cashTips, 0) : 0

  return (
    <Shell page="cash">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800;900&family=Julius+Sans+One&display=swap');
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:3px}
        @keyframes calPopIn { 0%{opacity:0;transform:translateY(-6px) scale(.97)} 100%{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes cashSlide { 0%{opacity:0;transform:translateY(12px)} 100%{opacity:1;transform:translateY(0)} }
        @keyframes kpiPulse { 0%{box-shadow:0 0 0 0 rgba(10,132,255,0)} 50%{box-shadow:0 0 16px 0 rgba(10,132,255,.12)} 100%{box-shadow:0 0 0 0 rgba(10,132,255,0)} }
        @keyframes toastIn { 0%{opacity:0;transform:translateX(-50%) translateY(16px)} 100%{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes kpiGlow {
          0%, 100% { box-shadow: 0 0 0 0 var(--kpi-glow-color, rgba(255,255,255,0)); }
          50% { box-shadow: 0 0 18px 0 var(--kpi-glow-color, rgba(255,255,255,.12)); }
        }
        @keyframes kpiGlowPerfect {
          0%, 100% { box-shadow: 0 0 0 0 rgba(143,240,177,0); }
          50% { box-shadow: 0 0 22px 2px rgba(143,240,177,.25); }
        }
        .cash-day { animation: cashSlide .35s ease both; }
        .cash-card { transition: border-color .25s ease, box-shadow .25s ease; }
        .cash-card:hover { border-color: rgba(255,255,255,.18) !important; box-shadow: 0 2px 12px rgba(255,255,255,.03); }
        .cash-kpi { animation: cashSlide .4s ease both, kpiGlow 3s ease-in-out infinite; }
        .cash-toast { animation: toastIn .25s ease both; }
        .cash-preset { transition: all .2s ease; }
        .cash-preset:active { transform: scale(.95); }
        @media(max-width:640px) {
          .cash-kpi-grid { grid-template-columns: repeat(2,1fr) !important; gap: 8px !important; }
          .cash-date-row { flex-direction: row !important; }
          .cash-day-nums { grid-template-columns: 1fr 1fr !important; }
          .cash-day-nums > :nth-child(3) { grid-column: 1 / -1 !important; }
          .cash-edit-row { flex-direction: column !important; }
          .cash-page-pad { padding-left: 14px !important; padding-right: 14px !important; }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'transparent', color: '#e8e8ed', fontFamily: 'Inter,system-ui,sans-serif' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px 14px', background: 'linear-gradient(to bottom, rgba(0,0,0,.90), rgba(0,0,0,.70))', backdropFilter: 'blur(18px) saturate(160%)', WebkitBackdropFilter: 'blur(18px) saturate(160%)', borderBottom: '1px solid rgba(255,255,255,.06)', position: 'sticky', top: 0, zIndex: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <h2 style={{ margin: 0, fontFamily: '"Inter",sans-serif', letterSpacing: '.18em', textTransform: 'uppercase', fontSize: 16 }}>Cash Register</h2>
              <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,.35)', fontSize: 11, letterSpacing: '.06em' }}>
                {loading ? 'Loading…' : `${days.length} day${days.length !== 1 ? 's' : ''} · ${days.reduce((s, d) => s + d.cashCount + d.zelleCount, 0)} transactions`}
              </p>
            </div>
            {loading && <div style={{ width: 18, height: 18, borderRadius: 999, border: '2px solid rgba(255,255,255,.15)', borderTopColor: 'rgba(10,132,255,.80)', animation: 'spin .7s linear infinite' }} />}
          </div>

          {/* Presets */}
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            {[{ id: 'today', label: 'Today' }, { id: 'week', label: '7 days' }, { id: 'month', label: '30 days' }].map(p => (
              <button key={p.id} className="cash-preset" onClick={() => setPreset(p.id)}
                style={{ height: 32, padding: '0 14px', borderRadius: 999, border: `1px solid ${activePreset === p.id ? 'rgba(10,132,255,.55)' : 'rgba(255,255,255,.10)'}`, background: activePreset === p.id ? 'rgba(10,132,255,.14)' : 'rgba(255,255,255,.03)', color: activePreset === p.id ? 'rgba(130,150,220,.6)' : 'rgba(255,255,255,.55)', cursor: 'pointer', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'inherit', boxShadow: activePreset === p.id ? '0 0 10px rgba(10,132,255,.15)' : 'none' }}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom date range */}
          <div className="cash-date-row" style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <div style={{ flex: 1 }}><DatePicker value={fromDate} onChange={v => { setFromDate(v); setActivePreset('') }} label="From" /></div>
            <div style={{ flex: 1 }}><DatePicker value={toDate} onChange={v => { setToDate(v); setActivePreset('') }} label="To" /></div>
          </div>
        </div>

        {/* KPIs */}
        <div className="cash-kpi-grid cash-page-pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, padding: '14px 20px' }}>
          {[
            { label: 'Cash', value: usd(totalExpectedCash), color: 'rgba(220,190,130,.5)', border: 'rgba(255,207,63,.18)', bg: 'rgba(255,207,63,.04)', delay: '0s', glow: 'rgba(255,207,63,.12)', perfectGlow: false },
            { label: 'Zelle', value: usd(totalExpectedZelle), color: 'rgba(130,150,220,.6)', border: 'rgba(10,132,255,.18)', bg: 'rgba(10,132,255,.04)', delay: '.05s', glow: 'rgba(10,132,255,.12)', perfectGlow: false },
            { label: 'Counted', value: reportsCount > 0 ? usd(totalActual) : '—', color: 'rgba(130,220,170,.5)', border: 'rgba(143,240,177,.18)', bg: 'rgba(143,240,177,.04)', delay: '.1s', glow: 'rgba(143,240,177,.12)', perfectGlow: reportsCount > 0 && totalDiff === 0 },
            { label: 'Diff', value: reportsCount > 0 ? (totalDiff >= 0 ? '+' : '') + usd(totalDiff) : '—', color: totalDiff >= 0 ? 'rgba(130,220,170,.5)' : 'rgba(220,130,160,.5)', border: totalDiff >= 0 ? 'rgba(143,240,177,.18)' : 'rgba(255,107,107,.18)', bg: totalDiff >= 0 ? 'rgba(143,240,177,.04)' : 'rgba(255,107,107,.04)', delay: '.15s', glow: totalDiff >= 0 ? 'rgba(143,240,177,.12)' : 'rgba(255,107,107,.12)', perfectGlow: false },
          ].map(kpi => (
            <div key={kpi.label} className="cash-kpi" style={{ padding: '12px 12px', borderRadius: 16, border: `1px solid ${kpi.border}`, background: kpi.bg, animationDelay: kpi.delay, '--kpi-glow-color': kpi.glow, ...(kpi.perfectGlow ? { animation: 'cashSlide .4s ease both, kpiGlowPerfect 2s ease-in-out infinite' } : {}) } as React.CSSProperties}>
              <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 4, fontWeight: 700 }}>{kpi.label}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: kpi.color, letterSpacing: '.02em' }}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Day list */}
        <div className="cash-page-pad" style={{ flex: 1, overflowY: 'auto', padding: '0 20px 100px' }}>
          {loading && days.length === 0 ? (
            <div style={{ padding: 50, textAlign: 'center' }}>
              <div style={{ width: 28, height: 28, borderRadius: 999, border: '2px solid rgba(255,255,255,.12)', borderTopColor: 'rgba(10,132,255,.70)', animation: 'spin .7s linear infinite', margin: '0 auto 12px' }} />
              <div style={{ color: 'rgba(255,255,255,.25)', fontSize: 12 }}>Loading cash data…</div>
            </div>
          ) : days.length === 0 ? (
            <div style={{ padding: 50, textAlign: 'center', color: 'rgba(255,255,255,.25)' }}>
              <div style={{ marginBottom: 8 }}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><circle cx="12" cy="12" r="3"/><line x1="1" y1="10" x2="4" y2="10"/><line x1="20" y1="10" x2="23" y2="10"/><line x1="1" y1="14" x2="4" y2="14"/><line x1="20" y1="14" x2="23" y2="14"/></svg></div>
              <div style={{ fontSize: 13 }}>No data for selected period</div>
            </div>
          ) : days.map((day, i) => {
            const expectedCash = day.cashTotal + day.cashTips
            const expectedZelle = day.zelleTotal + day.zelleTips
            const diff = day.report ? day.report.actual_cash - expectedCash : null
            const isEditing = editingDay === day.date
            const dayLabel = new Date(day.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
            const isToday = day.date === today
            const hasActivity = day.cashCount > 0 || day.zelleCount > 0

            return (
              <div key={day.date} className="cash-day cash-card" style={{
                marginTop: i > 0 ? 10 : 0, padding: '14px 14px', borderRadius: 18,
                border: `1px solid ${isToday ? 'rgba(10,132,255,.25)' : 'rgba(255,255,255,.07)'}`,
                background: isToday ? 'rgba(10,132,255,.03)' : 'rgba(255,255,255,.015)',
                animationDelay: `${i * 0.04}s`,
              }}>
                {/* Day header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: hasActivity ? 10 : 0 }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {dayLabel}
                      {isToday && <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(10,132,255,.35)', background: 'rgba(10,132,255,.10)', color: 'rgba(130,150,220,.6)', fontWeight: 800, letterSpacing: '.06em' }}>TODAY</span>}
                      {day.report && diff === 0 && <span style={{ display: 'inline-flex', alignItems: 'center' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(130,220,170,.8)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg></span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.30)', marginTop: 2 }}>
                      {day.cashCount} cash · {day.zelleCount} zelle
                      {day.report && <span style={{ marginLeft: 6, color: 'rgba(255,255,255,.20)' }}>· {day.report.submitted_by}</span>}
                    </div>
                  </div>
                  {!day.report && hasActivity && (
                    <button onClick={() => { setEditingDay(day.date); setCashInput(''); setNoteInput('') }}
                      style={{ height: 30, padding: '0 12px', borderRadius: 999, border: '1px solid rgba(255,207,63,.35)', background: 'rgba(255,207,63,.06)', color: 'rgba(220,190,130,.5)', cursor: 'pointer', fontWeight: 800, fontSize: 10, fontFamily: 'inherit', letterSpacing: '.04em', flexShrink: 0 }}>
                      Count
                    </button>
                  )}
                </div>

                {/* Numbers grid */}
                {hasActivity && (
                  <div className="cash-day-nums" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                    <div style={{ padding: '10px 10px', borderRadius: 12, background: 'rgba(255,207,63,.04)', border: '1px solid rgba(255,207,63,.10)' }}>
                      <div style={{ fontSize: 8, color: 'rgba(255,207,63,.55)', letterSpacing: '.10em', textTransform: 'uppercase', fontWeight: 800 }}>Cash</div>
                      <div style={{ fontSize: 17, fontWeight: 900, color: 'rgba(220,190,130,.5)', marginTop: 3 }}>{usd(expectedCash)}</div>
                      <div style={{ fontSize: 8, color: 'rgba(255,255,255,.20)', marginTop: 2 }}>{usd(day.cashTotal)} + {usd(day.cashTips)} tips</div>
                    </div>
                    <div style={{ padding: '10px 10px', borderRadius: 12, background: 'rgba(10,132,255,.04)', border: '1px solid rgba(10,132,255,.10)' }}>
                      <div style={{ fontSize: 8, color: 'rgba(10,132,255,.55)', letterSpacing: '.10em', textTransform: 'uppercase', fontWeight: 800 }}>Zelle</div>
                      <div style={{ fontSize: 17, fontWeight: 900, color: 'rgba(130,150,220,.6)', marginTop: 3 }}>{usd(expectedZelle)}</div>
                      <div style={{ fontSize: 8, color: 'rgba(255,255,255,.20)', marginTop: 2 }}>{usd(day.zelleTotal)} + {usd(day.zelleTips)} tips</div>
                    </div>
                    <div style={{ padding: '10px 10px', borderRadius: 12, background: day.report ? (diff !== null && diff >= 0 ? 'rgba(143,240,177,.04)' : 'rgba(255,107,107,.04)') : 'rgba(255,255,255,.02)', border: `1px solid ${day.report ? (diff !== null && diff >= 0 ? 'rgba(143,240,177,.12)' : 'rgba(255,107,107,.12)') : 'rgba(255,255,255,.06)'}` }}>
                      <div style={{ fontSize: 8, color: day.report ? (diff !== null && diff >= 0 ? 'rgba(143,240,177,.55)' : 'rgba(255,107,107,.55)') : 'rgba(255,255,255,.30)', letterSpacing: '.10em', textTransform: 'uppercase', fontWeight: 800 }}>Counted</div>
                      {day.report ? (
                        <>
                          <div style={{ fontSize: 17, fontWeight: 900, color: diff !== null && diff >= 0 ? 'rgba(130,220,170,.5)' : 'rgba(220,130,160,.5)', marginTop: 3 }}>{usd(day.report.actual_cash)}</div>
                          <div style={{ fontSize: 9, fontWeight: 800, color: diff !== null && diff >= 0 ? 'rgba(130,220,170,.8)' : '#ff6b6b', marginTop: 2 }}>
                            {diff !== null ? (diff >= 0 ? '+' : '') + usd(diff) : ''}{diff === 0 ? <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 3, verticalAlign: 'middle' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(130,220,170,.8)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg></span> : ''}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.15)', marginTop: 5 }}>—</div>
                      )}
                    </div>
                  </div>
                )}

                {day.report?.notes && (
                  <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,.40)', padding: '6px 10px', borderRadius: 10, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', lineHeight: 1.5 }}>
                    {day.report.notes}
                  </div>
                )}

                {/* Edit form */}
                {isEditing && (
                  <div style={{ marginTop: 10, padding: '12px 12px', borderRadius: 14, border: '1px solid rgba(10,132,255,.20)', background: 'rgba(10,132,255,.03)', animation: 'cashSlide .25s ease' }}>
                    <div className="cash-edit-row" style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 9, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.40)', marginBottom: 4, fontWeight: 700 }}>Cash in drawer ($)</div>
                        <input type="number" min="0" step="0.01" value={cashInput} onChange={e => setCashInput(e.target.value)} placeholder="0.00" autoFocus
                          style={{ width: '100%', height: 44, borderRadius: 12, border: '1px solid rgba(10,132,255,.30)', background: 'rgba(0,0,0,.25)', color: '#fff', padding: '0 12px', outline: 'none', fontSize: 16, fontWeight: 700, fontFamily: 'inherit' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 9, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.40)', marginBottom: 4, fontWeight: 700 }}>Note</div>
                        <input value={noteInput} onChange={e => setNoteInput(e.target.value)} placeholder="Optional…"
                          style={{ width: '100%', height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(0,0,0,.25)', color: '#fff', padding: '0 12px', outline: 'none', fontSize: 13, fontFamily: 'inherit' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button onClick={() => setEditingDay(null)}
                        style={{ flex: 1, height: 38, borderRadius: 12, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.03)', color: 'rgba(255,255,255,.60)', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>Cancel</button>
                      <button onClick={() => saveReport(day.date)} disabled={saving === day.date}
                        style={{ flex: 2, height: 38, borderRadius: 12, border: '1px solid rgba(10,132,255,.55)', background: 'rgba(10,132,255,.10)', color: 'rgba(130,150,220,.6)', cursor: 'pointer', fontWeight: 900, fontSize: 12, fontFamily: 'inherit', boxShadow: '0 0 12px rgba(10,132,255,.15)' }}>
                        {saving === day.date ? 'Saving…' : 'Save count'}
                      </button>
                    </div>
                  </div>
                )}

                {day.report && !isEditing && (
                  <button onClick={() => { setEditingDay(day.date); setCashInput(String(day.report!.actual_cash)); setNoteInput(day.report!.notes || '') }}
                    style={{ marginTop: 8, height: 26, padding: '0 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.06)', background: 'transparent', color: 'rgba(255,255,255,.25)', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}>
                    Update
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {toast && (
        <div className="cash-toast" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'rgba(8,8,8,.92)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 999, padding: '10px 20px', boxShadow: '0 16px 48px rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', gap: 10, backdropFilter: 'blur(18px)', fontSize: 13, zIndex: 5000, whiteSpace: 'nowrap', color: '#e8e8ed', fontFamily: 'inherit' }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: toast.includes('Error') ? '#ff6b6b' : 'rgba(130,220,170,.8)', flexShrink: 0 }} />
          {toast}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </Shell>
  )
}
