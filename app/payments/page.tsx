'use client'
import Shell from '@/components/Shell'
import { useEffect, useState, useCallback, useRef } from 'react'

import { apiFetch } from '@/lib/api'
import { useVisibilityPolling } from '@/lib/useVisibilityPolling'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Payment {
  id: string; square_id?: string; date: string; created_at?: string
  client_name?: string; client_phone?: string; barber_name?: string; barber_id?: string
  method: string; amount: number; tip?: number; fee?: number; net?: number
  status: string; note?: string; receipt_url?: string; booking_id?: string; source?: string
}
interface Totals { gross: number; tips: number; fees: number; net: number; count: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, '0')
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}` }
const daysAgoIso = (n: number) => { const d = new Date(); d.setDate(d.getDate()-n); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}` }
const fmtMoney = (n: number) => '$' + (Math.round((n||0)*100)/100).toFixed(2)
const fmtDateShort = (iso: string) => { try { return new Date(iso+'T00:00:00').toLocaleDateString([], { month:'short', day:'numeric' }) } catch { return iso } }
const fmtDateFull  = (iso: string) => { try { return new Date(iso+'T00:00:00').toLocaleDateString([], { month:'long', day:'numeric', year:'numeric' }) } catch { return iso } }
const methodLabel  = (m: string) => ({ card:'Card', applepay:'Apple Pay', cash:'Cash', zelle:'Zelle', terminal:'Terminal', other:'Other' }[m?.toLowerCase()] || m || '—')
const initials     = (name: string) => { const p = (name||'').split(' '); return (p[0]?.[0]||'')+(p[1]?.[0]||'') }
const isSquareId   = (s: string) => s.length > 14 && /^[A-Za-z0-9]{14,}$/.test(s.replace(/\s/g,''))

// ─── StatusChip ───────────────────────────────────────────────────────────────
function StatusChip({ status }: { status: string }) {
  const styles: Record<string, React.CSSProperties> = {
    paid:     { borderColor: 'rgba(143,240,177,.45)', background: 'rgba(143,240,177,.10)', color: 'rgba(130,220,170,.5)' },
    refunded: { borderColor: 'rgba(255,107,107,.45)', background: 'rgba(255,107,107,.10)', color: 'rgba(220,130,160,.5)' },
    pending:  { borderColor: 'rgba(255,207,63,.45)',  background: 'rgba(255,207,63,.10)',  color: '#ffe7c8' },
  }
  const s = styles[status] || {}
  return (
    <span style={{ fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', padding: '4px 8px', borderRadius: 999, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(0,0,0,.12)', color: 'rgba(255,255,255,.70)', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', ...s }}>
      <span style={{ width: 4, height: 4, borderRadius: 999, background: 'currentColor', flexShrink: 0 }} />
      {status || '—'}
    </span>
  )
}

// ─── DatePicker ───────────────────────────────────────────────────────────────
function DatePicker({ from, to, onChange, onClose }: { from: string; to: string; onChange: (f: string, t: string) => void; onClose: () => void }) {
  const [step, setStep] = useState<'from'|'to'>('from')
  const [selFrom, setSelFrom] = useState(from)
  const [selTo, setSelTo] = useState(to)
  const [month, setMonth] = useState(() => { const d = new Date(from+'T00:00:00'); d.setDate(1); return d })

  const todayStr = todayIso()
  const offset = (month.getDay() + 6) % 7
  const start = new Date(month); start.setDate(1 - offset)
  const days: string[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i)
    days.push(`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`)
  }
  const monthKey = `${month.getFullYear()}-${pad2(month.getMonth()+1)}`

  function pick(iso: string) {
    if (step === 'from') { setSelFrom(iso); setSelTo(iso); setStep('to') }
    else {
      const f = iso < selFrom ? iso : selFrom
      const t = iso < selFrom ? selFrom : iso
      onChange(f, t); onClose()
    }
  }

  const presets = [
    { label: 'Today', f: todayIso(), t: todayIso() },
    { label: 'Last 7 days', f: daysAgoIso(7), t: todayIso() },
    { label: 'Last 14 days', f: daysAgoIso(14), t: todayIso() },
    { label: 'Last 30 days', f: daysAgoIso(30), t: todayIso() },
    { label: 'This month', f: `${new Date().getFullYear()}-${pad2(new Date().getMonth()+1)}-01`, t: todayIso() },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: 'min(520px,96vw)', borderRadius: 20, border: '1px solid rgba(255,255,255,.12)', background: 'linear-gradient(180deg,rgba(20,20,30,.90),rgba(10,10,20,.88))', backdropFilter: 'blur(24px)', padding: 18, color: '#e8e8ed', fontFamily: 'Inter,sans-serif', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ fontFamily: '"Inter",sans-serif', letterSpacing: '.16em', textTransform: 'uppercase', fontSize: 13 }}>Date range</div>
          <button onClick={onClose} style={{ height: 32, padding: '0 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>Close</button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {presets.map(p => (
            <button key={p.label} onClick={() => { onChange(p.f, p.t); onClose() }}
              style={{ height: 32, padding: '0 12px', borderRadius: 999, border: `1px solid ${selFrom===p.f && selTo===p.t ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.10)'}`, background: selFrom===p.f && selTo===p.t ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.04)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 11, fontFamily: 'inherit' }}>
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { const m = new Date(month); m.setMonth(m.getMonth()-1); setMonth(m) }} style={{ height: 34, width: 34, borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#fff', cursor: 'pointer', fontWeight: 900, fontFamily: 'inherit' }}>←</button>
            <button onClick={() => { const m = new Date(month); m.setMonth(m.getMonth()+1); setMonth(m) }} style={{ height: 34, width: 34, borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#fff', cursor: 'pointer', fontWeight: 900, fontFamily: 'inherit' }}>→</button>
          </div>
          <div style={{ fontWeight: 900, fontSize: 14 }}>{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: step==='from' ? 'rgba(130,150,220,.9)' : 'rgba(130,220,170,.8)' }}>{step==='from' ? 'Pick start →' : '← Pick end'}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <div key={d} style={{ textAlign: 'center', fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', padding: '4px 0' }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
          {days.map(iso => {
            const inMonth = iso.startsWith(monthKey)
            const isFrom = iso === selFrom, isTo = iso === selTo, inRange = iso > selFrom && iso < selTo
            return (
              <button key={iso} onClick={() => pick(iso)}
                style={{ height: 38, borderRadius: 10, border: `1px solid ${isFrom ? 'rgba(255,255,255,.15)' : isTo ? 'rgba(143,240,177,.65)' : iso===todayStr ? 'rgba(255,207,63,.50)' : 'rgba(255,255,255,.08)'}`, background: isFrom ? 'rgba(255,255,255,.06)' : isTo ? 'rgba(143,240,177,.15)' : inRange ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.18)', color: isTo ? 'rgba(130,220,170,.5)' : '#fff', cursor: 'pointer', opacity: inMonth ? 1 : 0.3, fontWeight: isFrom||isTo ? 900 : 500, fontSize: 12, fontFamily: 'inherit' }}>
                {parseInt(iso.slice(8))}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── RefundModal ──────────────────────────────────────────────────────────────
function RefundModal({ payment, onClose, onDone }: { payment: Payment; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('Requested by customer')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  async function confirm() {
    const squareId = payment.square_id || payment.id
    setSaving(true)
    try {
      const body: any = { reason }
      if (amount) body.amount_cents = Math.round(Number(amount) * 100)
      await apiFetch(`/api/payments/refund/${encodeURIComponent(squareId)}`, { method: 'POST', body: JSON.stringify(body) })
      onDone()
    } catch (e: any) { alert('Refund error: ' + e.message) }
    setSaving(false)
  }

  const inp: React.CSSProperties = { height: 38, borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(0,0,0,.22)', color: '#fff', padding: '0 10px', outline: 'none', fontSize: 13, fontFamily: 'inherit', width: '100%' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.60)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(10px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: 'min(380px,92vw)', borderRadius: 20, border: '1px solid rgba(255,255,255,.12)', background: 'linear-gradient(180deg,rgba(22,22,32,.92),rgba(12,12,20,.90))', backdropFilter: 'blur(24px)', padding: 22, color: '#e8e8ed', fontFamily: 'Inter,sans-serif', boxShadow: '0 24px 80px rgba(0,0,0,.6)' }}>
        <div style={{ fontFamily: '"Inter",sans-serif', letterSpacing: '.16em', textTransform: 'uppercase', fontSize: 12, color: 'rgba(255,255,255,.55)', marginBottom: 12 }}>Refund payment</div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 18, lineHeight: 1.5 }}>
          {payment.client_name || '—'}<br/>
          <span style={{ fontWeight: 400, color: 'rgba(255,255,255,.55)', fontSize: 13 }}>{methodLabel(payment.method)} · {fmtMoney(payment.amount)}{payment.tip ? ` + ${fmtMoney(payment.tip)} tip` : ''}</span>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', display: 'block', marginBottom: 5 }}>Reason</label>
          <input value={reason} onChange={e => setReason(e.target.value)} style={inp} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', display: 'block', marginBottom: 5 }}>Amount (blank = full refund)</label>
          <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Full refund" style={inp} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ height: 38, padding: '0 16px', borderRadius: 999, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', fontSize: 13 }}>Cancel</button>
          <button onClick={confirm} disabled={saving} style={{ height: 38, padding: '0 18px', borderRadius: 999, border: '1px solid rgba(255,107,107,.55)', background: 'rgba(255,107,107,.12)', color: 'rgba(220,130,160,.5)', cursor: 'pointer', fontWeight: 900, fontFamily: 'inherit', fontSize: 13 }}>
            {saving ? 'Processing…' : 'Refund'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PaymentsPage() {
  const [from, setFrom] = useState(daysAgoIso(14))
  const [to, setTo]   = useState(todayIso())
  const [payments, setPayments] = useState<Payment[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [refundTarget, setRefundTarget] = useState<Payment | null>(null)
  const [mobileDetail, setMobileDetail] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState('')

  const [user] = useState(() => { try { return JSON.parse(localStorage.getItem('VURIUMBOOK_USER') || '{}') } catch { return {} } })
  const isOwner = user?.role === 'owner'

  // Sync tips from payments to bookings — recovers lost tips
  async function syncTips() {
    if (!window.confirm('Sync tips from Square payments to bookings? This will update bookings that are missing tip data.')) return
    setSyncing(true); setSyncResult('')
    try {
      const [paymentsRes, bookingsRes] = await Promise.all([
        apiFetch(`/api/payments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
        apiFetch(`/api/bookings?from=${encodeURIComponent(from + 'T00:00:00.000Z')}&to=${encodeURIComponent(to + 'T23:59:59.999Z')}`)
      ])
      const allPayments: Payment[] = paymentsRes?.payments || []
      const bookings: any[] = bookingsRes?.bookings || []
      let updated = 0, skipped = 0

      for (const p of allPayments) {
        if (p.status !== 'paid') continue
        const tip = Number(p.tip || 0)
        if (!tip) { skipped++; continue }

        // Try direct booking_id match first
        let bookingId = p.booking_id || ''

        // If no booking_id — match by amount + barber + date
        if (!bookingId) {
          const pDate = String(p.date || p.created_at || '').slice(0, 10)
          const pAmount = Number(p.amount || 0)
          const match = bookings.find((b: any) => {
            if (b.tip && Number(b.tip) > 0) return false // already has tip
            const bDate = String(b.start_at || '').slice(0, 10)
            const bAmount = Number(b.service_amount || b.amount || b.price || 0)
            const bBarberId = String(b.barber_id || '')
            // Match by date + approximate amount (within $2 for tax/fee differences)
            return bDate === pDate && Math.abs(bAmount - pAmount) < 2 && (!p.barber_id || bBarberId === p.barber_id)
          })
          if (match) bookingId = match.id
        }

        if (!bookingId) { skipped++; continue }

        try {
          await apiFetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
            method: 'PATCH',
            body: JSON.stringify({ tip, tip_amount: tip, payment_method: p.method || 'terminal' })
          })
          // Mark booking as matched so it's not matched again
          const idx = bookings.findIndex((b: any) => b.id === bookingId)
          if (idx >= 0) bookings[idx].tip = tip
          updated++
        } catch { skipped++ }
      }
      setSyncResult(`Done! Updated ${updated} bookings, skipped ${skipped}`)
      load()
    } catch (e: any) { setSyncResult('Error: ' + e.message) }
    setSyncing(false)
  }

  // Filters
  const [q, setQ] = useState('')
  const [filterBarber, setFilterBarber] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterMethod, setFilterMethod] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const data = await apiFetch(`/api/payments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      const list: Payment[] = (data?.payments || []).sort((a: Payment, b: Payment) =>
        String(b.created_at || b.date || '').localeCompare(String(a.created_at || a.date || ''))
      )
      setPayments(list)
      setTotals(data?.totals || null)
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }, [from, to])

  useVisibilityPolling(load, 30000, [load])

  // Filtered list
  const ql = q.toLowerCase()
  const visible = payments.filter(p => {
    if (filterBarber && p.barber_name !== filterBarber && p.barber_id !== filterBarber) return false
    if (filterStatus && p.status !== filterStatus) return false
    if (filterMethod && p.method !== filterMethod) return false
    if (ql) {
      const hay = [p.client_name, p.note, p.id, p.square_id, p.barber_name].join(' ').toLowerCase()
      if (!hay.includes(ql)) return false
    }
    return true
  })

  const selectedPayment = payments.find(p => p.id === selectedId) || null
  const allBarbers = [...new Set(payments.map(p => p.barber_name).filter(Boolean))] as string[]

  // KPIs from visible
  const kpis = {
    gross: visible.reduce((s, p) => s + (p.amount || 0) + (p.tip || 0), 0),
    tips:  visible.reduce((s, p) => s + (p.tip || 0), 0),
    fees:  visible.reduce((s, p) => s + (p.fee || 0), 0),
    net:   visible.reduce((s, p) => s + (p.net || 0), 0),
  }

  function getClientName(p: Payment): string {
    const raw = p.client_name || ''
    if (!raw || isSquareId(raw)) {
      // Try note: "VuriumBook • ClientName • Service • time"
      const parts = (p.note || '').split('•').map(s => s.trim())
      return parts[1] || ''
    }
    return raw
  }
  function getService(p: Payment): string {
    const parts = (p.note || '').split('•').map(s => s.trim())
    return parts[2] || ''
  }

  function exportCSV() {
    const rows = [['Date','Client','Team Member','Method','Amount','Tip','Fee','Net','Status','Note','ID']]
    visible.forEach(p => rows.push([p.date, getClientName(p), p.barber_name||'', methodLabel(p.method), String(p.amount.toFixed(2)), String((p.tip||0).toFixed(2)), String((p.fee||0).toFixed(2)), String((p.net||0).toFixed(2)), p.status, (p.note||'').replace(/"/g,"'"), p.square_id||p.id]))
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = `payments_${from}_${to}.csv`; a.click()
  }

  const lbl: React.CSSProperties = { fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)' }
  const card: React.CSSProperties = { borderRadius: 18, border: '1px solid rgba(255,255,255,.10)', background: 'linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02))', backdropFilter: 'blur(14px)', overflow: 'hidden' }
  const inp: React.CSSProperties = { height: 40, borderRadius: 999, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(0,0,0,.22)', color: '#fff', padding: '0 14px', outline: 'none', fontSize: 13, fontFamily: 'inherit' }


  return (
    <Shell page="payments">
      <style>{`
        ::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:3px}
        select option{background:#111}
        .pay-row:hover td{background:rgba(255,255,255,.025)!important}
        .pay-row.sel td{background:rgba(255,255,255,.04)!important}
        @media(max-width:768px){
          .page-topbar{padding-left:60px!important;}
          .page-topbar h2{font-size:13px!important;}
          .pay-grid{grid-template-columns:1fr!important;}
          .pay-details{display:none!important;}
          .pay-kpis{grid-template-columns:1fr 1fr!important;}
          .pay-filters{gap:6px!important;}
          .pay-filters select{width:auto!important;min-width:0!important;font-size:12px!important;}
          .pay-topbar-row{flex-direction:column!important;align-items:flex-start!important;gap:8px!important;}
          /* Hide table on mobile — show cards instead */
          .pay-table{display:none!important;}
          .pay-cards{display:flex!important;}
          .pay-main-grid{grid-template-columns:1fr!important;}
          .pay-details-panel{display:none!important;}
        }
        @media(min-width:769px){
          .pay-cards{display:none!important;}
        }
        @keyframes payCardIn {
          from { opacity:0; transform:translateY(8px) }
          to { opacity:1; transform:translateY(0) }
        }
        .pay-card-item {
          animation: payCardIn .2s ease-out both;
        }
        @keyframes paySpin { to { transform:rotate(360deg) } }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'transparent', color: '#e8e8ed', fontFamily: 'Inter,system-ui,sans-serif' }}>

        {/* Topbar */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,.06)', position: 'sticky', top: 0, zIndex: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>{visible.length} payments</span>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
              <button onClick={() => setShowDatePicker(true)}
                style={{ height: 34, padding: '0 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 11, fontFamily: 'inherit' }}>
                {from === to && from === todayIso() ? 'Today' : `${fmtDateShort(from)} → ${fmtDateShort(to)}`}
              </button>
              <button onClick={exportCSV}
                style={{ height: 34, padding: '0 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.18)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.6)', cursor: 'pointer', fontWeight: 800, fontSize: 10, fontFamily: 'inherit' }}>
                CSV
              </button>
              {isOwner && (
                <button onClick={syncTips} disabled={syncing}
                  style={{ height: 34, padding: '0 10px', borderRadius: 999, border: '1px solid rgba(143,240,177,.35)', background: 'rgba(143,240,177,.06)', color: 'rgba(130,220,170,.5)', cursor: syncing ? 'wait' : 'pointer', fontWeight: 800, fontSize: 10, fontFamily: 'inherit', opacity: syncing ? .5 : 1 }}>
                  {syncing ? '…' : 'Sync'}
                </button>
              )}
            </div>
            {syncResult && <div style={{ padding: '8px 14px', borderRadius: 10, background: 'rgba(143,240,177,.06)', border: '1px solid rgba(143,240,177,.15)', color: 'rgba(130,220,170,.5)', fontSize: 12, marginTop: 8 }}>{syncResult}</div>}
          </div>
          {/* Filters — horizontal scrolling chips on mobile */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', alignItems: 'center', paddingBottom: 2, scrollbarWidth: 'none' as any, WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…"
              style={{ ...inp, width: 'min(160px,35vw)', flexShrink: 0 }} />
            {[
              { value: filterBarber, set: setFilterBarber, opts: allBarbers.map(b => ({ v: b, l: b })), ph: 'All team members' },
              { value: filterStatus, set: setFilterStatus, opts: ['paid','pending','refunded'].map(s => ({ v: s, l: s })), ph: 'All statuses' },
              { value: filterMethod, set: setFilterMethod, opts: ['card','applepay','terminal','cash','zelle','other'].map(m => ({ v: m, l: methodLabel(m) })), ph: 'All methods' },
            ].map((f, i) => (
              <select key={i} value={f.value} onChange={e => f.set(e.target.value)} style={{ ...inp, flexShrink: 0 }}>
                <option value="">{f.ph}</option>
                {f.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            ))}
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: '1px solid rgba(255,255,255,.06)', background: 'rgba(0,0,0,.12)', flexShrink: 0, overflowX: 'auto' as const }}>
          {[{ label: 'Gross', val: kpis.gross }, { label: 'Tips', val: kpis.tips }, { label: 'Fees', val: kpis.fees }, { label: 'Net', val: kpis.net }].map(k => (
            <div key={k.label} style={{ padding: '10px 16px', borderRight: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{ ...lbl, marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontWeight: 900, fontSize: 15 }}>{fmtMoney(k.val)}</div>
            </div>
          ))}
        </div>

        {/* Main grid */}
        <div className="pay-main-grid" style={{ flex: 1, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1.7fr .85fr' }}>

          {/* Table — desktop only */}
          <div className="pay-table" style={{ overflowY: 'auto', borderRight: '1px solid rgba(255,255,255,.08)' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.40)', fontSize: 13 }}>
                <div style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid rgba(255,255,255,.18)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin .8s linear infinite', marginRight: 8, verticalAlign: 'middle' }} />
                Loading…
              </div>
            ) : error ? (
              <div style={{ padding: 24, color: '#ff6b6b', fontSize: 13 }}>Error: {error}</div>
            ) : visible.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.40)', fontSize: 13 }}>No transactions found</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    {[['Date', 70], ['Client / Team Member', undefined], ['Method', 75], ['Amount', 80], ['Tip', 65], ['Status', 90]].map(([h, w]) => (
                      <th key={String(h)} style={{ padding: '10px 12px', ...lbl, background: 'rgba(0,0,0,.90)', position: 'sticky', top: 0, textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,.08)', ...(w ? { width: w } : {}) }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map(p => {
                    const clientName = getClientName(p)
                    const service = getService(p)
                    const isSel = p.id === selectedId
                    const isTerminal = p.source === 'terminal' || p.method === 'terminal'
                    return (
                      <tr key={p.id} className={`pay-row${isSel ? ' sel' : ''}`} onClick={() => { setSelectedId(p.id); setMobileDetail(true) }} style={{ cursor: 'pointer' }}>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,.05)', color: 'rgba(255,255,255,.50)', fontSize: 12 }}>{fmtDateShort(p.date)}</td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,.05)', overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                            <div style={{ width: 28, height: 28, borderRadius: 9, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, flexShrink: 0 }}>
                              {clientName ? initials(clientName) : '–'}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 900, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                                {clientName || <span style={{ color: 'rgba(255,255,255,.30)' }}>—</span>}
                                {isTerminal && <span style={{ fontSize: 9, letterSpacing: '.06em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 999, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.6)' }}>Terminal</span>}
                              </div>
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.40)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                                {[p.barber_name, service].filter(Boolean).join(' · ')}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,.05)', fontSize: 12 }}>{methodLabel(p.method)}</td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,.05)', fontWeight: 700 }}>{fmtMoney(p.amount)}</td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,.05)', color: 'rgba(255,255,255,.45)', fontSize: 12 }}>{p.tip ? fmtMoney(p.tip) : '—'}</td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,.05)' }}><StatusChip status={p.status} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Mobile cards view */}
          <div className="pay-cards" style={{ display: 'none', flexDirection: 'column', gap: 8, overflowY: 'auto', padding: '12px 14px 80px' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.30)' }}>
                <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,.15)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'paySpin .8s linear infinite', margin: '0 auto 10px' }} />
              </div>
            ) : visible.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.25)', fontSize: 13 }}>No transactions</div>
            ) : visible.map((p, idx) => {
              const cn = getClientName(p)
              return (
                <div key={p.id} className="pay-card-item" onClick={() => { setSelectedId(p.id); setMobileDetail(true) }}
                  style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.03)', cursor: 'pointer', animationDelay: `${Math.min(idx * 30, 300)}ms` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0, color: 'rgba(255,255,255,.60)' }}>{cn ? initials(cn) : '–'}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cn || '—'}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {[p.barber_name, fmtDateShort(p.date), methodLabel(p.method)].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 14 }}>{fmtMoney(p.amount)}</div>
                      {(p.tip || 0) > 0 && <div style={{ fontSize: 10, color: 'rgba(220,190,130,.5)', marginTop: 1 }}>+{fmtMoney(p.tip || 0)} tip</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                    <StatusChip status={p.status} />
                    {p.source === 'square' && <span style={{ fontSize: 8, color: 'rgba(255,255,255,.20)', letterSpacing: '.06em', textTransform: 'uppercase' }}>Square</span>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Details panel — hidden on mobile unless fullscreen */}
          <div className={mobileDetail && selectedId ? '' : 'pay-details-panel'} style={mobileDetail && selectedId
            ? { position: 'fixed' as const, inset: 0, zIndex: 90, background: 'rgba(0,0,0,.97)', overflowY: 'auto' as const, display: 'flex', flexDirection: 'column' as const }
            : { overflowY: 'auto' as const, padding: 14, display: 'flex', flexDirection: 'column' as const, gap: 10, background: 'rgba(0,0,0,.08)' }}>
            {mobileDetail && selectedId && (
              <div style={{ position: 'sticky', top: 0, zIndex: 10, padding: '10px 14px', background: 'rgba(0,0,0,.90)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <button onClick={() => setMobileDetail(false)} style={{ height: 34, padding: '0 14px', borderRadius: 999, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>← Back</button>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,.45)' }}>Payment detail</span>
              </div>
            )}
            <div style={{ padding: mobileDetail ? '14px' : 0, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
            {!selectedPayment ? (
              <div style={{ color: 'rgba(255,255,255,.30)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>Click any payment to view details</div>
            ) : (() => {
              const p = selectedPayment
              const clientName = getClientName(p)
              const service = getService(p)
              const timePart = (p.note||'').split('•')[3]?.trim() || ''
              const block = (children: React.ReactNode) => <div style={{ padding: 12, borderRadius: 14, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(0,0,0,.16)' }}>{children}</div>
              const row = (label: string, value: React.ReactNode) => (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(0,0,0,.12)' }}>
                  <span style={{ fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)' }}>{label}</span>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{value}</span>
                </div>
              )
              return <>
                {block(<>
                  <div style={{ ...lbl, marginBottom: 6 }}>Client</div>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>{clientName || '—'}</div>
                  {p.client_phone && <div style={{ marginTop: 5, fontSize: 13, color: 'rgba(255,255,255,.55)' }}>{p.client_phone}</div>}
                </>)}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {row('Team Member', p.barber_name || '—')}
                  {service && row('Service', service)}
                  {row('Date', fmtDateFull(p.date) + (timePart ? ' · ' + timePart : ''))}
                  {row('Method', methodLabel(p.method))}
                  {row('Status', <StatusChip status={p.status} />)}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {row('Amount', fmtMoney(p.amount))}
                  {row('Tip', fmtMoney(p.tip || 0))}
                  {row('Square fee', fmtMoney(p.fee || 0))}
                  {row('Net', <strong style={{ fontSize: 16 }}>{fmtMoney(p.net || 0)}</strong>)}
                </div>

                {block(<>
                  <div style={{ ...lbl, marginBottom: 6 }}>Transaction ID</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', wordBreak: 'break-all', fontFamily: 'monospace', lineHeight: 1.5 }}>{p.square_id || p.id}</div>
                </>)}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {p.status === 'paid' && p.square_id && (
                    <button onClick={() => setRefundTarget(p)}
                      style={{ height: 36, padding: '0 16px', borderRadius: 999, border: '1px solid rgba(255,107,107,.55)', background: 'rgba(255,107,107,.10)', color: 'rgba(220,130,160,.5)', cursor: 'pointer', fontWeight: 900, fontSize: 12, fontFamily: 'inherit' }}>
                      Refund
                    </button>
                  )}
                  {p.receipt_url && (
                    <a href={p.receipt_url} target="_blank" rel="noopener"
                      style={{ height: 36, padding: '0 16px', borderRadius: 999, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
                      Receipt ↗
                    </a>
                  )}
                </div>
              </>
            })()}
            </div>
          </div>
        </div>
      </div>

      {showDatePicker && (
        <DatePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} onClose={() => setShowDatePicker(false)} />
      )}
      {refundTarget && (
        <RefundModal payment={refundTarget} onClose={() => setRefundTarget(null)} onDone={() => { setRefundTarget(null); load() }} />
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </Shell>
  )
}
// fixed
