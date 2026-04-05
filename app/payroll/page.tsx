'use client'
import Shell from '@/components/Shell'
import FeatureGate from '@/components/FeatureGate'
import { useEffect, useState, useCallback, useRef } from 'react'

import { apiFetch } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Tier { type: 'revenue' | 'clients'; threshold: number; pct: number }
interface CustomBonus { label: string; type: 'percent_revenue' | 'percent_owner' | 'fixed'; value: number }
interface Rule { base_pct: number; tips_pct: number; tiers: Tier[]; hourly_rate?: number; owner_profit_pct?: number; service_fee_pct?: number; service_fee_days?: number[]; custom_bonuses?: CustomBonus[]; late_penalty_per_min?: number }
interface Booking { id: string; date: string; client: string; service: string; service_amount: number; tip: number; status: string; paid: boolean }
interface BarberPayroll {
  barber_id: string; barber_name: string; barber_photo: string; barber_level: string
  bookings_count: number; client_count: number; service_total: number; tips_total: number
  effective_pct: number; base_pct: number
  barber_service_share: number; owner_service_share: number
  barber_tips: number; barber_total: number
  rule: Rule; bookings: Booking[]
}
interface Totals { service_total: number; tips_total: number; barber_service_share: number; owner_service_share: number; barber_total: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, '0')
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}` }
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate()-n); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}` }
const thisWeekMonday = () => { const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}` }
const fmtDate = (iso: string) => { try { const d = new Date(iso+'T00:00:00'); return d.toLocaleDateString([], { month:'short', day:'numeric', year:'numeric' }) } catch { return iso } }
const fmtMoney = (n: number) => '$' + (Math.round((n||0)*100)/100).toFixed(2)
const initials = (name: string) => { const p = (name||'').split(' '); return (p[0]?.[0]||'')+(p[1]?.[0]||'') }

// ─── DatePicker ───────────────────────────────────────────────────────────────
function DatePicker({ from, to, onChange, onClose }: {
  from: string; to: string; onChange: (f: string, t: string) => void; onClose: () => void
}) {
  const [step, setStep] = useState<'from'|'to'>('from')
  const [selFrom, setSelFrom] = useState(from)
  const [selTo, setSelTo] = useState(to)
  const [month, setMonth] = useState(() => { const d = new Date(from+'T00:00:00'); d.setDate(1); return d })

  const todayStr = today()
  const offset = (month.getDay() + 6) % 7
  const start = new Date(month); start.setDate(1 - offset)
  const days: string[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i)
    days.push(`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`)
  }
  const monthKey = `${month.getFullYear()}-${pad2(month.getMonth()+1)}`

  function pickDay(iso: string) {
    if (step === 'from') { setSelFrom(iso); setSelTo(iso); setStep('to') }
    else {
      const f = iso < selFrom ? iso : selFrom
      const t = iso < selFrom ? selFrom : iso
      setSelFrom(f); setSelTo(t); onChange(f, t); onClose()
    }
  }

  const presets = [
    { label: 'Today', f: today(), t: today() },
    { label: 'This week', f: thisWeekMonday(), t: today() },
    { label: 'Last 7 days', f: daysAgo(7), t: today() },
    { label: 'Last 14 days', f: daysAgo(14), t: today() },
    { label: 'Last 30 days', f: daysAgo(30), t: today() },
    { label: 'This month', f: `${new Date().getFullYear()}-${pad2(new Date().getMonth()+1)}-01`, t: today() },
  ]

  const s: React.CSSProperties = { fontFamily: 'Inter,sans-serif', color: '#e8e8ed' }
  const btnBase: React.CSSProperties = { height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ ...s, width: 'min(560px,96vw)', borderRadius: 20, border: '1px solid rgba(255,255,255,.12)', background: 'linear-gradient(180deg,rgba(20,20,30,.90),rgba(10,10,20,.88))', backdropFilter: 'blur(24px)', padding: 18, boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ fontFamily: '"Inter",sans-serif', letterSpacing: '.16em', textTransform: 'uppercase', fontSize: 13 }}>Date range</div>
          <button onClick={onClose} style={{ ...btnBase, padding: '0 14px' }}>Close</button>
        </div>

        {/* Presets */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {presets.map(p => (
            <button key={p.label} onClick={() => { onChange(p.f, p.t); onClose() }}
              style={{ ...btnBase, padding: '0 12px', fontSize: 11, letterSpacing: '.06em', background: selFrom === p.f && selTo === p.t ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.04)', borderColor: selFrom === p.f && selTo === p.t ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.10)' }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Month nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { const m = new Date(month); m.setMonth(m.getMonth()-1); setMonth(m) }} style={{ ...btnBase, width: 36, padding: 0 }}>←</button>
            <button onClick={() => { const m = new Date(month); m.setMonth(m.getMonth()+1); setMonth(m) }} style={{ ...btnBase, width: 36, padding: 0 }}>→</button>
          </div>
          <div style={{ fontWeight: 900 }}>{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</div>
          <div style={{ fontSize: 12, color: step === 'from' ? 'rgba(130,150,220,.9)' : 'rgba(130,220,170,.8)', fontWeight: 700, letterSpacing: '.06em' }}>
            {step === 'from' ? 'Pick start →' : '← Pick end'}
          </div>
        </div>

        {/* Days header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', padding: '4px 0' }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
          {days.map(iso => {
            const inMonth = iso.startsWith(monthKey)
            const isToday = iso === todayStr
            const isFrom = iso === selFrom
            const isTo = iso === selTo
            const inRange = iso > selFrom && iso < selTo
            return (
              <button key={iso} onClick={() => pickDay(iso)}
                style={{ height: 40, borderRadius: 10, border: `1px solid ${isFrom ? 'rgba(255,255,255,.15)' : isTo ? 'rgba(143,240,177,.65)' : isToday ? 'rgba(255,207,63,.50)' : 'rgba(255,255,255,.08)'}`, background: isFrom ? 'rgba(255,255,255,.06)' : isTo ? 'rgba(143,240,177,.15)' : inRange ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.18)', color: isTo ? 'rgba(130,220,170,.5)' : '#fff', cursor: 'pointer', opacity: inMonth ? 1 : 0.3, fontWeight: isFrom || isTo ? 900 : 500, fontSize: 13, fontFamily: 'inherit' }}>
                {parseInt(iso.slice(8))}
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.40)' }}>Click start date, then end date</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.6)' }}>{selFrom && selTo ? fmtDate(selFrom) + ' → ' + fmtDate(selTo) : '—'}</div>
        </div>
      </div>
    </div>
  )
}

// ─── CommissionEditor ─────────────────────────────────────────────────────────
function CommissionEditor({ barber, rule, onSaved }: { barber: BarberPayroll; rule: Rule; onSaved: (r: Rule) => void }) {
  const [open, setOpen] = useState(false)
  const [basePct, setBasePct] = useState(rule.base_pct)
  const [tipsPct, setTipsPct] = useState(rule.tips_pct)
  const [tiers, setTiers] = useState<Tier[]>(rule.tiers || [])
  const [bonuses, setBonuses] = useState<CustomBonus[]>(rule.custom_bonuses || [])
  const [latePenalty, setLatePenalty] = useState(rule.late_penalty_per_min ?? 1)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const inp: React.CSSProperties = { height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(0,0,0,.22)', color: '#fff', padding: '0 10px', outline: 'none', fontSize: 13, fontFamily: 'inherit', width: '100%' }

  async function save() {
    setSaving(true)
    try {
      await apiFetch(`/api/payroll/rules/${encodeURIComponent(barber.barber_id)}`, {
        method: 'POST', body: JSON.stringify({ base_pct: basePct, tips_pct: tipsPct, tiers: tiers.filter(t => t.threshold > 0), custom_bonuses: bonuses.filter(b => b.label && b.value > 0), late_penalty_per_min: latePenalty })
      })
      onSaved({ base_pct: basePct, tips_pct: tipsPct, tiers, custom_bonuses: bonuses, late_penalty_per_min: latePenalty })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch (e: any) { alert('Error: ' + e.message) }
    setSaving(false)
  }

  return (
    <div style={{ borderRadius: 14, border: `1px solid ${open ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.08)'}`, overflow: 'hidden', background: open ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.12)' }}>
      <div onClick={() => setOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {barber.barber_photo
            ? <img src={barber.barber_photo} alt={barber.barber_name} style={{ width: 32, height: 32, borderRadius: 10, objectFit: 'cover', border: '1px solid rgba(255,255,255,.14)' }} onError={e => (e.currentTarget.style.display='none')} />
            : <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>{initials(barber.barber_name)}</div>
          }
          <div style={{ fontWeight: 900, fontSize: 13 }}>{barber.barber_name}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.45)' }}>{rule.base_pct}% base · {rule.tips_pct}% tips{bonuses.length > 0 ? ` · ${bonuses.length} bonus` : ''}</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.40)' }}>{open ? '▴' : '▾'}</span>
        </div>
      </div>
      {open && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <div className="comm-editor-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', display: 'block', marginBottom: 5 }}>Base commission %</label>
              <input type="number" min={0} max={100} value={basePct} onChange={e => setBasePct(Number(e.target.value))} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', display: 'block', marginBottom: 5 }}>Tips %</label>
              <input type="number" min={0} max={100} value={tipsPct} onChange={e => setTipsPct(Number(e.target.value))} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', display: 'block', marginBottom: 5 }}>Late penalty $/min</label>
              <input type="number" min={0} step={0.25} value={latePenalty} onChange={e => setLatePenalty(Number(e.target.value))} style={{ ...inp, borderColor: 'rgba(255,107,107,.25)' }} />
            </div>
          </div>

          {/* Tiers */}
          <div style={{ fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.40)', marginBottom: 8 }}>Bonus tiers</div>
          {tiers.length > 0 && (
            <div className="tier-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6, marginBottom: 6 }}>
              {['Type','Threshold','Rate %',''].map(h => <div key={h} style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.30)' }}>{h}</div>)}
            </div>
          )}
          {tiers.map((t, i) => (
            <div key={i} className="tier-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6, marginBottom: 6 }}>
              <select value={t.type} onChange={e => { const n=[...tiers]; n[i]={...n[i],type:e.target.value as 'revenue'|'clients'}; setTiers(n) }} style={{ ...inp, height: 34, fontSize: 12 }}>
                <option value="revenue">Revenue ≥</option>
                <option value="clients">Clients ≥</option>
              </select>
              <input type="number" min={0} value={t.threshold} onChange={e => { const n=[...tiers]; n[i]={...n[i],threshold:Number(e.target.value)}; setTiers(n) }} style={{ ...inp, height: 34, fontSize: 12 }} placeholder="Threshold" />
              <input type="number" min={0} max={100} value={t.pct} onChange={e => { const n=[...tiers]; n[i]={...n[i],pct:Number(e.target.value)}; setTiers(n) }} style={{ ...inp, height: 34, fontSize: 12 }} placeholder="%" />
              <button onClick={() => setTiers(tiers.filter((_,j) => j!==i))} style={{ height: 34, width: 34, borderRadius: 10, border: '1px solid rgba(255,107,107,.35)', background: 'rgba(255,107,107,.08)', color: '#ff6b6b', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
          ))}
          <button onClick={() => setTiers([...tiers, { type: 'revenue', threshold: 0, pct: 65 }])}
            style={{ height: 32, padding: '0 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.65)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', marginBottom: 12 }}>
            + Add tier
          </button>

          {/* Custom bonuses */}
          <div style={{ fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.40)', marginBottom: 8 }}>Custom bonuses / deductions</div>
          {bonuses.map((b, i) => (
            <div key={i} className="bonus-row" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr auto', gap: 6, marginBottom: 6 }}>
              <input value={b.label} onChange={e => { const n=[...bonuses]; n[i]={...n[i],label:e.target.value}; setBonuses(n) }} style={{ ...inp, height: 34, fontSize: 12 }} placeholder="Label (e.g. Product bonus)" />
              <select value={b.type} onChange={e => { const n=[...bonuses]; n[i]={...n[i],type:e.target.value as any}; setBonuses(n) }} style={{ ...inp, height: 34, fontSize: 12 }}>
                <option value="percent_revenue">% of revenue</option>
                <option value="percent_owner">% of owner share</option>
                <option value="fixed">Fixed $</option>
              </select>
              <input type="number" min={0} step={0.5} value={b.value} onChange={e => { const n=[...bonuses]; n[i]={...n[i],value:Number(e.target.value)}; setBonuses(n) }} style={{ ...inp, height: 34, fontSize: 12 }} placeholder="Value" />
              <button onClick={() => setBonuses(bonuses.filter((_,j) => j!==i))} style={{ height: 34, width: 34, borderRadius: 10, border: '1px solid rgba(255,107,107,.35)', background: 'rgba(255,107,107,.08)', color: '#ff6b6b', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
          ))}
          <button onClick={() => setBonuses([...bonuses, { label: '', type: 'percent_revenue', value: 0 }])}
            style={{ height: 32, padding: '0 14px', borderRadius: 10, border: '1px solid rgba(168,107,255,.30)', background: 'rgba(168,107,255,.08)', color: 'rgba(180,140,220,.6)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', marginBottom: 12 }}>
            + Add custom bonus
          </button>

          <button onClick={save} disabled={saving}
            style={{ width: '100%', height: 40, borderRadius: 12, border: '1px solid rgba(255,255,255,.18)', background: saved ? 'rgba(143,240,177,.12)' : 'rgba(255,255,255,.06)', color: saved ? 'rgba(130,220,170,.5)' : 'rgba(130,150,220,.6)', cursor: 'pointer', fontWeight: 900, fontSize: 13, fontFamily: 'inherit', borderColor: saved ? 'rgba(143,240,177,.45)' : 'rgba(255,255,255,.18)' }}>
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save rules'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── AdminPayrollEditor ───────────────────────────────────────────────────────
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
function AdminPayrollEditor({ userId, userName, rule, onSaved, extraDays }: { userId: string; userName: string; rule: Rule; onSaved: (r: Rule) => void; extraDays?: number[] }) {
  const [open, setOpen] = useState(false)
  const [hourly, setHourly] = useState(rule.hourly_rate ?? 0)
  const [ownerPct, setOwnerPct] = useState(rule.owner_profit_pct ?? 2)
  const [feePct, setFeePct] = useState(rule.service_fee_pct ?? 3)
  const [bonusDays, setBonusDays] = useState<number[]>(rule.service_fee_days ?? [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const inp: React.CSSProperties = { height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(0,0,0,.22)', color: '#fff', padding: '0 10px', outline: 'none', fontSize: 13, fontFamily: 'inherit', width: '100%' }

  async function save() {
    setSaving(true)
    try {
      await apiFetch(`/api/payroll/rules/${encodeURIComponent(userId)}`, {
        method: 'POST', body: JSON.stringify({ ...rule, hourly_rate: hourly, owner_profit_pct: ownerPct, service_fee_pct: feePct, service_fee_days: bonusDays })
      })
      onSaved({ ...rule, hourly_rate: hourly, owner_profit_pct: ownerPct, service_fee_pct: feePct, service_fee_days: bonusDays })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch (e: any) { alert('Error: ' + e.message) }
    setSaving(false)
  }

  function toggleBonusDay(d: number) { setBonusDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort()) }

  // Days admin actually worked (from attendance) are auto-included
  const workedDays = extraDays || []

  return (
    <div style={{ borderRadius: 14, border: `1px solid ${open ? 'rgba(143,240,177,.25)' : 'rgba(255,255,255,.08)'}`, overflow: 'hidden', background: open ? 'rgba(143,240,177,.04)' : 'rgba(0,0,0,.12)' }}>
      <div onClick={() => setOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(143,240,177,.12)', border: '1px solid rgba(143,240,177,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: 'rgba(130,220,170,.5)' }}>{initials(userName)}</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 13 }}>{userName}</div>
            <div style={{ fontSize: 10, color: 'rgba(130,220,170,.5)' }}>ADMIN</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.45)' }}>${hourly}/hr · {ownerPct}% profit · {feePct}% fee</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.40)' }}>{open ? '▴' : '▾'}</span>
        </div>
      </div>
      {open && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <div className="admin-editor-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', display: 'block', marginBottom: 5 }}>Hourly rate ($)</label>
              <input type="number" min={0} step={0.5} value={hourly} onChange={e => setHourly(Number(e.target.value))} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', display: 'block', marginBottom: 5 }}>Owner profit %</label>
              <input type="number" min={0} max={100} step={0.5} value={ownerPct} onChange={e => setOwnerPct(Number(e.target.value))} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', display: 'block', marginBottom: 5 }}>Service fee %</label>
              <input type="number" min={0} max={100} step={0.5} value={feePct} onChange={e => setFeePct(Number(e.target.value))} style={inp} />
            </div>
          </div>
          {/* Worked days (auto from attendance) */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', display: 'block', marginBottom: 6 }}>Days worked (auto from clock-in)</label>
            <div className="day-pills" style={{ display: 'flex', gap: 6 }}>
              {DAY_LABELS.map((d, i) => (
                <div key={i} style={{ height: 30, width: 40, borderRadius: 8, border: `1px solid ${workedDays.includes(i) ? 'rgba(143,240,177,.45)' : 'rgba(255,255,255,.06)'}`, background: workedDays.includes(i) ? 'rgba(143,240,177,.12)' : 'rgba(255,255,255,.02)', color: workedDays.includes(i) ? 'rgba(130,220,170,.5)' : 'rgba(255,255,255,.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                  {d}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.25)', marginTop: 3 }}>Service fee auto-counts on days admin clocked in</div>
          </div>
          {/* Extra days override */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', display: 'block', marginBottom: 6 }}>Add extra days (override)</label>
            <div className="day-pills" style={{ display: 'flex', gap: 6 }}>
              {DAY_LABELS.map((d, i) => (
                <button key={i} onClick={() => toggleBonusDay(i)}
                  style={{ height: 30, width: 40, borderRadius: 8, border: `1px solid ${bonusDays.includes(i) ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.10)'}`, background: bonusDays.includes(i) ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.03)', color: bonusDays.includes(i) ? 'rgba(130,150,220,.6)' : 'rgba(255,255,255,.40)', cursor: 'pointer', fontSize: 10, fontWeight: 700, fontFamily: 'inherit' }}>
                  {d}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.25)', marginTop: 3 }}>Blue = manually added extra days for service fee</div>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginBottom: 12, lineHeight: 1.5 }}>
            <strong style={{ color: 'rgba(255,255,255,.55)' }}>Formula:</strong><br/>
            Base pay = ${hourly}/hr × hours worked<br/>
            Profit share = owner net profit × {ownerPct}%<br/>
            Service fee = total fees × {feePct}% (days clocked in + extra days)
          </div>
          <button onClick={save} disabled={saving}
            style={{ width: '100%', height: 40, borderRadius: 12, border: `1px solid ${saved ? 'rgba(143,240,177,.45)' : 'rgba(143,240,177,.40)'}`, background: saved ? 'rgba(143,240,177,.18)' : 'rgba(143,240,177,.10)', color: 'rgba(130,220,170,.5)', cursor: 'pointer', fontWeight: 900, fontSize: 13, fontFamily: 'inherit' }}>
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save admin rules'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── AdminScheduleEditor ──────────────────────────────────────────────────────
const DEFAULT_SCHEDULE = Array.from({ length: 7 }, () => ({ enabled: false, startMin: 540, endMin: 1020 }))
function minToTime(m: number) { return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }
function timeToMin(t: string) { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0) }

function AdminScheduleEditor({ userId, userName, schedule, onSaved }: { userId: string; userName: string; schedule: any[] | null; onSaved: (s: any[]) => void }) {
  const [sched, setSched] = useState<{ enabled: boolean; startMin: number; endMin: number }[]>(() => {
    if (Array.isArray(schedule) && schedule.length === 7) return schedule.map(d => ({ enabled: !!d.enabled, startMin: d.startMin ?? d.start_min ?? 540, endMin: d.endMin ?? d.end_min ?? 1020 }))
    return DEFAULT_SCHEDULE.map(d => ({ ...d }))
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function updateDay(i: number, patch: Partial<typeof sched[0]>) {
    setSched(prev => prev.map((d, idx) => idx === i ? { ...d, ...patch } : d))
  }

  async function save() {
    setSaving(true)
    try {
      await apiFetch(`/api/users/${encodeURIComponent(userId)}`, { method: 'PATCH', body: JSON.stringify({ schedule: sched }) })
      onSaved(sched)
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch (e: any) { alert('Error: ' + e.message) }
    setSaving(false)
  }

  const lbl: React.CSSProperties = { fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', display: 'block', marginBottom: 6 }
  const timeInp: React.CSSProperties = { height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(0,0,0,.22)', color: '#fff', padding: '0 8px', outline: 'none', fontSize: 12, fontFamily: 'inherit', width: '100%' }

  return (
    <div style={{ marginTop: 8, borderRadius: 12, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.02)', padding: '12px 14px' }}>
      <label style={lbl}>Work schedule — {userName}</label>
      <div style={{ display: 'grid', gap: 6 }}>
        {DAY_LABELS.map((d, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '50px 44px 1fr 1fr', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: sched[i].enabled ? '#e8e8ed' : 'rgba(255,255,255,.25)' }}>{d}</span>
            <button onClick={() => updateDay(i, { enabled: !sched[i].enabled })}
              style={{ height: 28, borderRadius: 8, border: `1px solid ${sched[i].enabled ? 'rgba(143,240,177,.40)' : 'rgba(255,255,255,.10)'}`, background: sched[i].enabled ? 'rgba(143,240,177,.10)' : 'rgba(255,255,255,.03)', color: sched[i].enabled ? 'rgba(130,220,170,.6)' : 'rgba(255,255,255,.30)', cursor: 'pointer', fontSize: 9, fontWeight: 800, fontFamily: 'inherit' }}>
              {sched[i].enabled ? 'ON' : 'OFF'}
            </button>
            <input type="time" value={minToTime(sched[i].startMin)} onChange={e => updateDay(i, { startMin: timeToMin(e.target.value) })} disabled={!sched[i].enabled} style={{ ...timeInp, opacity: sched[i].enabled ? 1 : .3 }} />
            <input type="time" value={minToTime(sched[i].endMin)} onChange={e => updateDay(i, { endMin: timeToMin(e.target.value) })} disabled={!sched[i].enabled} style={{ ...timeInp, opacity: sched[i].enabled ? 1 : .3 }} />
          </div>
        ))}
      </div>
      <button onClick={save} disabled={saving}
        style={{ width: '100%', height: 36, borderRadius: 10, border: `1px solid ${saved ? 'rgba(143,240,177,.45)' : 'rgba(255,255,255,.15)'}`, background: saved ? 'rgba(143,240,177,.15)' : 'rgba(255,255,255,.04)', color: saved ? 'rgba(130,220,170,.6)' : 'rgba(255,255,255,.55)', cursor: 'pointer', fontWeight: 800, fontSize: 12, fontFamily: 'inherit', marginTop: 10 }}>
        {saving ? 'Saving…' : saved ? 'Schedule saved ✓' : 'Save schedule'}
      </button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PayrollPage() {
  const [from, setFrom] = useState(thisWeekMonday())
  const [to, setTo] = useState(today())
  const [barbers, setBarbers] = useState<BarberPayroll[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [rules, setRules] = useState<Record<string, Rule>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filterBarber, setFilterBarber] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [activeTab, setActiveTab] = useState<'summary'|'rules'|'attendance'>('summary')
  const [adminUsers, setAdminUsers] = useState<any[]>([])
  const [adminAttendance, setAdminAttendance] = useState<Record<string, number>>({})
  const [adminWorkDays, setAdminWorkDays] = useState<Record<string, number[]>>({})
  const [allAttendance, setAllAttendance] = useState<any[]>([])
  const [lateMinutes, setLateMinutes] = useState<Record<string, number>>({})
  const [expensesTotal, setExpensesTotal] = useState(0)
  const [expensesByCategory, setExpensesByCategory] = useState<Record<string, number>>({})
  const [adminSchedules, setAdminSchedules] = useState<Record<string, any[]>>({})

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [payData, rulesData, usersData, attData, expData] = await Promise.all([
        apiFetch(`/api/payroll?from=${encodeURIComponent(from+'T00:00:00.000Z')}&to=${encodeURIComponent(to+'T23:59:59.999Z')}`),
        apiFetch('/api/payroll/rules').catch(() => ({ rules: {} })),
        apiFetch('/api/users').catch(() => ({ users: [] })),
        apiFetch(`/api/attendance?from=${from}&to=${to}`).catch(() => ({ attendance: [], summary: {} })),
        apiFetch(`/api/expenses/total?from=${from}&to=${to}`).catch(() => ({ total: 0, by_category: {} })),
      ])
      // Recalculate totals from paid bookings only (server counts all bookings including unpaid)
      const rawBarbers = payData?.barbers || []
      const fixedBarbers = rawBarbers.map((b: any) => {
        const paidBookings = (b.bookings || []).filter((bk: any) => bk.paid)
        const serviceTotal = paidBookings.reduce((s: number, bk: any) => s + Number(bk.service_amount || 0), 0)
        const tipsTotal = paidBookings.reduce((s: number, bk: any) => s + Number(bk.tip || 0), 0)
        const clientCount = paidBookings.length
        const rule = (rulesData?.rules || {})[b.barber_id] || { base_pct: 60, tips_pct: 100, tiers: [] }
        const basePct = Number(rule.base_pct ?? 60)
        const tipsPct = Number(rule.tips_pct ?? 100)
        const tiers = Array.isArray(rule.tiers) ? rule.tiers : []
        let effectivePct = basePct
        const allMatching = [...tiers.filter((t: any) => t.type === 'revenue' && serviceTotal >= t.threshold), ...tiers.filter((t: any) => t.type === 'clients' && clientCount >= t.threshold)]
        if (allMatching.length) effectivePct = Math.max(...allMatching.map((t: any) => t.pct))
        const barberServiceShare = Math.round(serviceTotal * (effectivePct / 100) * 100) / 100
        const ownerServiceShare = Math.round(serviceTotal * ((100 - effectivePct) / 100) * 100) / 100
        const barberTips = Math.round(tipsTotal * (tipsPct / 100) * 100) / 100
        const barberTotal = Math.round((barberServiceShare + barberTips) * 100) / 100
        return { ...b, service_total: serviceTotal, tips_total: tipsTotal, client_count: clientCount, effective_pct: effectivePct, barber_service_share: barberServiceShare, owner_service_share: ownerServiceShare, barber_tips: barberTips, barber_total: barberTotal }
      })
      const fixedTotals = {
        service_total: fixedBarbers.reduce((s: number, b: any) => s + b.service_total, 0),
        tips_total: fixedBarbers.reduce((s: number, b: any) => s + b.tips_total, 0),
        barber_service_share: fixedBarbers.reduce((s: number, b: any) => s + b.barber_service_share, 0),
        owner_service_share: fixedBarbers.reduce((s: number, b: any) => s + b.owner_service_share, 0),
        barber_total: fixedBarbers.reduce((s: number, b: any) => s + b.barber_total, 0),
        // Terminal-only service total (for admin service fee calculation)
        terminal_service_total: fixedBarbers.reduce((s: number, b: any) => {
          const terminalBookings = (b.bookings || []).filter((bk: any) => bk.paid && (bk.payment_method === 'terminal' || bk.payment_method === 'card' || bk.payment_method === 'applepay'))
          return s + terminalBookings.reduce((ss: number, bk: any) => ss + Number(bk.service_amount || 0), 0)
        }, 0),
      }
      setBarbers(fixedBarbers)
      setTotals(fixedTotals)
      setExpensesTotal(Number(expData?.total || 0))
      setExpensesByCategory(expData?.by_category || {})
      setRules(rulesData?.rules || {})
      // Admin users — API returns array directly or { users: [...] }
      const allUsers = Array.isArray(usersData) ? usersData : (usersData?.users || [])
      // Only admin users (not owner) for admin payroll
      const admins = allUsers.filter((u: any) => u.role === 'admin' && u.active !== false)
      setAdminUsers(admins)
      // Extract admin schedules from user records
      const schedMap: Record<string, any[]> = {}
      admins.forEach((u: any) => { if (Array.isArray(u.schedule)) schedMap[u.id] = u.schedule })
      setAdminSchedules(schedMap)
      // Attendance hours per user (keyed by user_id AND barber_id)
      const attHours: Record<string, number> = {}
      const attRecords = attData?.attendance || []
      attRecords.forEach((r: any) => {
        if (r.duration_minutes) {
          attHours[r.user_id] = (attHours[r.user_id] || 0) + r.duration_minutes
          if (r.barber_id) attHours[r.barber_id] = (attHours[r.barber_id] || 0) + r.duration_minutes
        }
      })
      // For currently clocked in, add elapsed
      attRecords.forEach((r: any) => {
        if (!r.clock_out && r.clock_in) {
          const elapsed = Math.round((Date.now() - new Date(r.clock_in).getTime()) / 60000)
          attHours[r.user_id] = (attHours[r.user_id] || 0) + Math.max(0, elapsed)
          if (r.barber_id) attHours[r.barber_id] = (attHours[r.barber_id] || 0) + Math.max(0, elapsed)
        }
      })
      setAdminAttendance(attHours)
      setAllAttendance(attRecords)
      // Also compute service fee days for admins
      // Store which days each user worked
      const attDaysSet: Record<string, Set<number>> = {}
      attRecords.forEach((r: any) => {
        if (r.clock_in) {
          const d = new Date(r.clock_in)
          if (!isNaN(d.getTime())) {
            if (!attDaysSet[r.user_id]) attDaysSet[r.user_id] = new Set()
            attDaysSet[r.user_id].add(d.getDay())
          }
        }
      })
      const attDaysArr: Record<string, number[]> = {}
      Object.entries(attDaysSet).forEach(([uid, s]) => { attDaysArr[uid] = [...s] })
      setAdminWorkDays(attDaysArr)

      // Calculate late minutes per barber/user
      // Compare clock_in time vs scheduled start from barbers data
      const barbersData = payData?.barbers || []
      const barbersMap: Record<string, any> = {}
      barbersData.forEach((b: any) => { barbersMap[b.barber_id] = b })
      // Also need barber schedule — fetch from /api/barbers
      let barberSchedules: Record<string, any> = {}
      try {
        const barbersResp = await apiFetch('/api/barbers')
        const barbersList = Array.isArray(barbersResp) ? barbersResp : (barbersResp?.barbers || [])
        barbersList.forEach((b: any) => { barberSchedules[b.id] = b.schedule || b.work_schedule || null })
      } catch (_) {}

      const lateMins: Record<string, number> = {}
      const currentRules = rulesData?.rules || {}
      // Load late resets from localStorage as backup
      let localResets: Record<string, string> = {}
      try { localResets = JSON.parse(localStorage.getItem('VB_LATE_RESETS') || '{}') } catch {}
      attRecords.forEach((r: any) => {
        if (!r.clock_in || !r.barber_id) return
        const sched = barberSchedules[r.barber_id]
        if (!sched) return
        // Check late_reset_at — skip attendance records before this timestamp
        const bRule = currentRules[r.barber_id] || {}
        const resetStr = bRule.late_reset_at || localResets[r.barber_id] || ''
        if (resetStr) {
          const resetAt = new Date(resetStr)
          const clockDate = new Date(r.clock_in)
          if (!isNaN(resetAt.getTime()) && clockDate <= resetAt) return
        }
        const clockIn = new Date(r.clock_in)
        if (isNaN(clockIn.getTime())) return
        const chicagoTime = new Date(clockIn.toLocaleString('en-US', { timeZone: 'America/Chicago' }))
        const dow = chicagoTime.getDay()
        // Read per-day schedule first, fallback to global startMin
        let schedStartMin: number | null = null
        const perDay = sched.perDay || sched.per_day
        if (Array.isArray(sched) && sched[dow]) {
          const day = sched[dow]
          if (day.enabled === false) return
          const sm = day.startMin ?? day.start_min
          schedStartMin = sm != null ? Number(sm) : null
        } else if (Array.isArray(perDay) && perDay[dow]) {
          const day = perDay[dow]
          if (day.enabled === false) return
          const sm = day.startMin ?? day.start_min
          schedStartMin = sm != null ? Number(sm) : null
        } else {
          const days = Array.isArray(sched.days) ? sched.days : []
          if (!days.includes(dow)) return
          const gs = sched.startMin ?? sched.start_min
          schedStartMin = gs != null ? Number(gs) : null
        }
        if (schedStartMin == null) return
        const clockInMin = chicagoTime.getHours() * 60 + chicagoTime.getMinutes()
        const late = clockInMin - schedStartMin
        if (late > 0) {
          const key = r.barber_id
          lateMins[key] = (lateMins[key] || 0) + late
          lateMins[r.user_id] = (lateMins[r.user_id] || 0) + late
        }
      })
      setLateMinutes(lateMins)
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  const visible = filterBarber ? barbers.filter(b => b.barber_id === filterBarber) : barbers

  function toggleExpand(id: string) {
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  function exportCSV() {
    const rows = [['Team member','Rate%','Services Gross','Member Share','Owner Share','Tips','Total Payout','Clients','Bookings']]
    visible.forEach(b => rows.push([b.barber_name, String(b.effective_pct), b.service_total.toFixed(2), b.barber_service_share.toFixed(2), b.owner_service_share.toFixed(2), b.tips_total.toFixed(2), b.barber_total.toFixed(2), String(b.client_count), String(b.bookings_count)]))
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = `payroll_${from}_${to}.csv`; a.click()
  }

  const lbl: React.CSSProperties = { fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)' }
  const card: React.CSSProperties = { borderRadius: 18, border: '1px solid rgba(255,255,255,.10)', background: 'linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02))', backdropFilter: 'blur(14px)', overflow: 'hidden' }

  function exportPDF() {
    const doc: string[] = []
    doc.push(`<html><head><meta charset="utf-8">`)
    doc.push(`<title>Payroll Report ${from} – ${to}</title>`)
    doc.push(`<style>
      body{font-family:Inter,Arial,sans-serif;background:#fff;color:#111;padding:32px;max-width:900px;margin:0 auto}
      h1{font-size:22px;letter-spacing:.1em;text-transform:uppercase;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:4px}
      .meta{font-size:12px;color:#666;margin-bottom:24px}
      .barber{margin-bottom:28px;border:1px solid #ddd;border-radius:8px;overflow:hidden}
      .barber-head{background:#f5f5f5;padding:12px 16px;display:flex;justify-content:space-between;align-items:center}
      .barber-name{font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}
      .barber-total{font-size:18px;font-weight:900}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#f9f9f9;padding:8px 12px;text-align:left;border-bottom:1px solid #eee;text-transform:uppercase;font-size:10px;letter-spacing:.08em;color:#666}
      td{padding:7px 12px;border-bottom:1px solid #f0f0f0}
      .totals{padding:12px 16px;background:#fafafa;display:flex;gap:24px;font-size:13px}
      .totals span{color:#666}
      .totals b{color:#111}
      @media print{body{padding:16px}.barber{break-inside:avoid}}
    </style></head><body>`)
    doc.push(`<h1>VuriumBook — Payroll Report</h1>`)
    doc.push(`<div class="meta">Period: ${from} — ${to} &nbsp;·&nbsp; Generated: ${new Date().toLocaleString()}</div>`)

    barbers.forEach(b => {
      doc.push(`<div class="barber">`)
      doc.push(`<div class="barber-head"><span class="barber-name">${b.barber_name}</span><span class="barber-total">${fmtMoney(b.barber_total)}</span></div>`)
      doc.push(`<table><thead><tr><th>Date</th><th>Client</th><th>Service</th><th>Amount</th><th>Tip</th></tr></thead><tbody>`)
      ;(b.bookings||[]).forEach((bk: any) => {
        doc.push(`<tr><td>${bk.date||''}</td><td>${bk.client||''}</td><td>${bk.service||''}</td><td>${fmtMoney(bk.service_amount||0)}</td><td>${fmtMoney(bk.tip||0)}</td></tr>`)
      })
      doc.push(`</tbody></table>`)
      doc.push(`<div class="totals"><span>Services: <b>${fmtMoney(b.service_total)}</b></span><span>Tips: <b>${fmtMoney(b.tips_total)}</b></span><span>Commission: <b>${b.effective_pct}%</b></span><span>Payout: <b>${fmtMoney(b.barber_total)}</b></span></div>`)
      doc.push(`</div>`)
    })
    doc.push(`</body></html>`)

    const blob = new Blob([doc.join('\n')], { type: 'text/html;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    if (win) { win.onload = () => { win.print(); URL.revokeObjectURL(url) } }
    else { const a = document.createElement('a'); a.href = url; a.download = `payroll-${from}-${to}.html`; a.click(); URL.revokeObjectURL(url) }
  }

  return (
    <Shell page="payroll"><FeatureGate feature="payroll" label="Payroll" requiredPlan="custom">

      <style>{`
        ::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:3px}
        select option{background:#111}
        @media(max-width:768px){
          .payroll-body{grid-template-columns:1fr!important}
          .payroll-topbar-row{flex-direction:column!important;align-items:stretch!important;gap:10px!important}
          .payroll-topbar-actions{flex-wrap:wrap!important;justify-content:stretch!important;gap:6px!important}
          .payroll-topbar-actions>button,.payroll-topbar-actions>select{flex:1 1 auto!important;min-width:0!important}
          .payroll-date-btn{width:100%!important;min-width:0!important}
          .payroll-table-wrap{overflow-x:auto!important;-webkit-overflow-scrolling:touch}
          .payroll-table-wrap table{min-width:700px}
          .comm-editor-grid{grid-template-columns:1fr!important}
          .admin-editor-grid{grid-template-columns:1fr!important}
          .tier-row{grid-template-columns:1fr 1fr!important}
          .bonus-row{grid-template-columns:1fr!important}
          .summary-cards{grid-template-columns:1fr!important}
          .owner-net-grid{grid-template-columns:1fr!important}
          .admin-payroll-grid{grid-template-columns:1fr!important}
          .day-pills{flex-wrap:wrap!important}
          .topbar-pad{padding:12px 12px 10px!important}
          .payroll-body{padding:12px!important;gap:12px!important}
        }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'transparent', color: '#e8e8ed', fontFamily: 'Inter,system-ui,sans-serif', overflowY: 'auto' }}>

        {/* Topbar */}
        <div className="topbar-pad" style={{ padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,.06)', position: 'sticky', top: 0, zIndex: 20 }}>
          <div className="payroll-topbar-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>
              {barbers.length} barbers · {barbers.reduce((s,b)=>s+b.bookings_count,0)} bookings
            </span>
            <div className="payroll-topbar-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Date range */}
              <button className="payroll-date-btn" onClick={() => setShowDatePicker(true)}
                style={{ height: 40, padding: '0 16px', borderRadius: 999, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.05)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', minWidth: 200 }}>
                {fmtDate(from)} → {fmtDate(to)}
              </button>
              {/* Barber filter */}
              <select value={filterBarber} onChange={e => setFilterBarber(e.target.value)}
                style={{ height: 40, borderRadius: 999, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(0,0,0,.22)', color: '#fff', padding: '0 14px', outline: 'none', fontSize: 13 }}>
                <option value="">All team members</option>
                {barbers.map(b => <option key={b.barber_id} value={b.barber_id}>{b.barber_name}</option>)}
              </select>
              <button onClick={load} disabled={loading}
                style={{ height: 40, width: 40, borderRadius: 999, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#fff', cursor: 'pointer', fontSize: 16, opacity: loading ? .5 : 1 }}>↻</button>
              <button onClick={exportCSV}
                style={{ height: 40, padding: '0 16px', borderRadius: 999, border: '1px solid rgba(255,255,255,.18)', background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.6)', cursor: 'pointer', fontWeight: 900, fontSize: 13, fontFamily: 'inherit' }}>
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="payroll-body" style={{ flex: 1, padding: '18px 20px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>

          {/* Left — table */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(0,0,0,.12)' }}>
              <div style={{ ...lbl }}>Team payout summary</div>
              <div style={{ ...lbl, border: '1px solid rgba(255,255,255,.12)', padding: '4px 10px', borderRadius: 999 }}>{visible.length} barbers</div>
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.40)', fontSize: 13 }}>
                <div style={{ display: 'inline-block', width: 20, height: 20, border: '2px solid rgba(255,255,255,.18)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin .8s linear infinite', marginRight: 8, verticalAlign: 'middle' }} />
                Loading…
              </div>
            ) : error ? (
              <div style={{ padding: 24, color: '#ff6b6b', fontSize: 13 }}>Error: {error}</div>
            ) : visible.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.40)', fontSize: 13, letterSpacing: '.08em' }}>No data for selected period</div>
            ) : (
              <div className="payroll-table-wrap" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Team member','Hours','Rate','Services','Member share','Owner share','Tips','Total payout',''].map(h => (
                        <th key={h} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,.08)', textAlign: 'left', ...lbl, background: 'rgba(0,0,0,.10)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(b => {
                      const isBoosted = b.effective_pct !== b.base_pct
                      const isOpen = expanded.has(b.barber_id)
                      const bRule: Rule = rules[b.barber_id] || { base_pct: 60, tips_pct: 100, tiers: [] }
                      const penaltyRate = bRule.late_penalty_per_min ?? 1
                      const bLateMins = lateMinutes[b.barber_id] || 0
                      const latePenalty = bLateMins * penaltyRate
                      const adjustedTotal = b.barber_total - latePenalty
                      return <>
                        <tr key={b.barber_id} style={{ background: isOpen ? 'rgba(255,255,255,.03)' : 'transparent' }}
                          onMouseEnter={e => (e.currentTarget.style.background='rgba(255,255,255,.025)')}
                          onMouseLeave={e => (e.currentTarget.style.background=isOpen?'rgba(255,255,255,.03)':'transparent')}>
                          <td style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {b.barber_photo
                                ? <img src={b.barber_photo} alt={b.barber_name} style={{ width: 36, height: 36, borderRadius: 12, objectFit: 'cover', border: '1px solid rgba(255,255,255,.14)', flexShrink: 0 }} onError={e => (e.currentTarget.style.display='none')} />
                                : <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, flexShrink: 0 }}>{initials(b.barber_name)}</div>
                              }
                              <div>
                                <div style={{ fontWeight: 900, fontSize: 13 }}>{b.barber_name}</div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', marginTop: 2 }}>{b.client_count} clients · {b.bookings_count} bookings</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,.06)', whiteSpace: 'nowrap' }}>
                            {(() => { const mins = adminAttendance[b.barber_id] || 0; const h = mins / 60; return h > 0 ? <span style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', fontWeight: 700 }}>{h.toFixed(1)}h</span> : <span style={{ fontSize: 11, color: 'rgba(255,255,255,.25)' }}>—</span> })()}
                          </td>
                          <td style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,.06)', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, border: isBoosted ? '1px solid rgba(143,240,177,.45)' : '1px solid rgba(255,255,255,.12)', background: isBoosted ? 'rgba(143,240,177,.10)' : 'rgba(255,255,255,.04)', color: isBoosted ? 'rgba(130,220,170,.5)' : 'rgba(130,150,220,.6)' }}>
                              {b.effective_pct}%{isBoosted ? ' ↑' : ''}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,.06)', fontWeight: 700 }}>{fmtMoney(b.service_total)}</td>
                          <td style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,.06)', color: 'rgba(255,255,255,.6)' }}>{fmtMoney(b.barber_service_share)}</td>
                          <td style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,.06)', color: 'rgba(255,255,255,.45)' }}>{fmtMoney(b.owner_service_share)}</td>
                          <td style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,.06)', color: 'rgba(130,220,170,.8)' }}>{fmtMoney(b.tips_total)}</td>
                          <td style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,.06)', fontWeight: 900, fontSize: 14 }}>
                            {latePenalty > 0 ? (
                              <div>
                                <span>{fmtMoney(adjustedTotal)}</span>
                                <div style={{ fontSize: 10, color: '#ff6b6b', fontWeight: 600, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span>−{fmtMoney(latePenalty)} late ({bLateMins}min × ${penaltyRate})</span>
                                  <button onClick={async e => {
                                    e.stopPropagation()
                                    if (!window.confirm(`Reset all late penalties for ${b.barber_name}?`)) return
                                    try {
                                      const resetTime = new Date().toISOString()
                                      await apiFetch(`/api/payroll/rules/${encodeURIComponent(b.barber_id)}`, { method: 'POST', body: JSON.stringify({ ...bRule, late_reset_at: resetTime }) })
                                      // Also persist in localStorage as backup (server may not save late_reset_at)
                                      try { const key = 'VB_LATE_RESETS'; const resets = JSON.parse(localStorage.getItem(key) || '{}'); resets[b.barber_id] = resetTime; localStorage.setItem(key, JSON.stringify(resets)) } catch {}
                                      setLateMinutes(prev => ({ ...prev, [b.barber_id]: 0 }))
                                      setRules(prev => ({ ...prev, [b.barber_id]: { ...bRule, late_reset_at: resetTime } as any }))
                                    } catch (err: any) { alert('Failed to reset: ' + err.message) }
                                  }}
                                    style={{ background: 'rgba(255,107,107,.12)', border: '1px solid rgba(255,107,107,.30)', borderRadius: 6, color: '#ff9999', fontSize: 9, padding: '2px 6px', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }}>Reset</button>
                                </div>
                              </div>
                            ) : fmtMoney(b.barber_total)}
                          </td>
                          <td style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                            <button onClick={() => toggleExpand(b.barber_id)}
                              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.45)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 6px', borderRadius: 8 }}>
                              {isOpen ? '▴' : '▾'}
                            </button>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr key={b.barber_id+'_exp'}>
                            <td colSpan={8} style={{ padding: 0, borderBottom: '1px solid rgba(255,255,255,.06)', background: 'rgba(0,0,0,.18)' }}>
                              <div style={{ padding: '10px 14px 14px' }}>
                                {b.bookings.length === 0 ? (
                                  <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 12, padding: '8px 0' }}>No bookings</div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                                    {b.bookings.map(bk => (
                                      <div key={bk.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(0,0,0,.18)', fontSize: 13, gap: 10 }}>
                                        <div>
                                          <div style={{ fontWeight: 700 }}>{bk.client || '—'}</div>
                                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                                            {bk.date} · {bk.service} · {bk.status}{bk.paid ? ' · Paid' : ''}
                                          </div>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                          <div style={{ fontWeight: 700 }}>{fmtMoney(bk.service_amount)}</div>
                                          {bk.tip > 0 && <div style={{ fontSize: 12, color: 'rgba(130,220,170,.8)' }}>+{fmtMoney(bk.tip)} tip</div>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={card}>
              {/* Tabs */}
              <div style={{ display: 'flex', gap: 6, padding: '12px 14px 0', flexWrap: 'wrap' }}>
                {(['summary','attendance','rules'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    style={{ height: 34, padding: '0 14px', borderRadius: 999, border: `1px solid ${activeTab===tab ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.10)'}`, background: activeTab===tab ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.04)', color: activeTab===tab ? 'rgba(130,150,220,.6)' : 'rgba(255,255,255,.70)', cursor: 'pointer', fontWeight: 900, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {tab === 'attendance' && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
                    {tab === 'summary' ? 'Summary' : tab === 'attendance' ? 'Hours & Clock' : 'Commission rules'}
                  </button>
                ))}
              </div>

              {activeTab === 'summary' && (
                <>
                  <div className="summary-cards" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '12px 14px' }}>
                    {[
                      { label: 'Services gross', value: fmtMoney(totals?.service_total||0), wide: true },
                      { label: 'Team total', value: fmtMoney(totals?.barber_service_share||0) },
                      { label: 'Owner share', value: fmtMoney(totals?.owner_service_share||0) },
                      { label: 'Tips', value: fmtMoney(totals?.tips_total||0) },
                      { label: 'Team total payout', value: fmtMoney(totals?.barber_total||0), wide: true, big: true },
                    ].map(k => (
                      <div key={k.label} style={{ padding: '12px', borderRadius: 14, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(0,0,0,.14)', gridColumn: k.wide ? '1/-1' : undefined }}>
                        <div style={{ ...lbl, marginBottom: 4 }}>{k.label}</div>
                        <div style={{ fontWeight: 900, fontSize: k.big ? 22 : 16, letterSpacing: '.02em' }}>{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '0 14px 14px', fontSize: 12, color: 'rgba(255,255,255,.40)', lineHeight: 1.7 }}>
                    <strong style={{ color: 'rgba(255,255,255,.65)' }}>Formula</strong><br/>
                    Barber payout = services × rate% + tips × tips%<br/>
                    Owner share = services × (100 − rate%)<br/>
                    Tiers override base % when threshold reached
                  </div>

                  {/* Admin payroll + Owner net profit */}
                  {(() => {
                    const ownerShare = totals?.owner_service_share || 0
                    const totalServices = totals?.service_total || 0
                    const terminalServices = (totals as any)?.terminal_service_total || 0
                    const barbersTotalPayout = totals?.barber_total || 0
                    // Service fee only from terminal/card payments (Square charges fee)
                    const serviceFeeGross = terminalServices * 0.03

                    // Calculate admin payroll
                    let totalAdminPay = 0
                    const adminCalcs = adminUsers.map(u => {
                      const r = rules[u.id] || { hourly_rate: 0, owner_profit_pct: 2, service_fee_pct: 3, service_fee_days: [] }
                      const hours = (adminAttendance[u.id] || 0) / 60
                      const basePay = (r.hourly_rate || 0) * hours
                      // Profit share from owner's net
                      const profitShare = ownerShare * ((r.owner_profit_pct || 0) / 100)
                      // Service fee: percentage of total services for days worked
                      const workedDays = adminWorkDays[u.id] || []
                      const extraDays = (r.service_fee_days || []) as number[]
                      const allFeeDays = [...new Set([...workedDays, ...extraDays])]
                      // Fee = service_fee_pct% of terminal services only (if worked any days)
                      const feeShare = allFeeDays.length > 0 ? terminalServices * ((r.service_fee_pct || 0) / 100) : 0
                      const total = basePay + profitShare + feeShare
                      totalAdminPay += total
                      return { u, r, hours, basePay, profitShare, feeShare, total, allFeeDays }
                    })

                    // Owner net = owner share - admin pay
                    const ownerNet = ownerShare - totalAdminPay - expensesTotal
                    return (
                      <>
                        {/* Owner net profit */}
                        <div style={{ margin: '0 14px 14px', borderRadius: 14, border: '1px solid rgba(255,207,63,.20)', background: 'rgba(255,207,63,.04)', padding: '14px' }}>
                          <div style={{ ...lbl, color: 'rgba(220,190,130,.5)', marginBottom: 8 }}>Owner net profit</div>
                          <div className="owner-net-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12, marginBottom: 8 }}>
                            <div><span style={{ color: 'rgba(255,255,255,.40)' }}>Gross revenue: </span><span>{fmtMoney(totalServices)}</span></div>
                            <div><span style={{ color: 'rgba(255,255,255,.40)' }}>Team payout: </span><span style={{ color: '#ff6b6b' }}>−{fmtMoney(barbersTotalPayout)}</span></div>
                            <div><span style={{ color: 'rgba(255,255,255,.40)' }}>Owner share: </span><span style={{ color: 'rgba(220,190,130,.5)' }}>{fmtMoney(ownerShare)}</span></div>
                            {adminUsers.length > 0 && <div><span style={{ color: 'rgba(255,255,255,.40)' }}>Admin pay: </span><span style={{ color: '#ff6b6b' }}>−{fmtMoney(totalAdminPay)}</span></div>}
                            {expensesTotal > 0 && <div><span style={{ color: 'rgba(255,255,255,.40)' }}>Expenses: </span><span style={{ color: '#ff6b6b' }}>−{fmtMoney(expensesTotal)}</span></div>}
                          </div>
                          <div style={{ fontWeight: 900, fontSize: 22, color: 'rgba(220,190,130,.5)' }}>
                            Net: {fmtMoney(ownerNet)}
                          </div>
                        </div>

                        {/* Admin payroll breakdown */}
                        {adminCalcs.length > 0 && (
                          <div style={{ margin: '0 14px 14px', borderRadius: 14, border: '1px solid rgba(143,240,177,.20)', background: 'rgba(143,240,177,.04)', padding: '14px' }}>
                            <div style={{ ...lbl, color: 'rgba(130,220,170,.5)', marginBottom: 10 }}>Admin payroll</div>
                            {adminCalcs.map(({ u, r, hours, basePay, profitShare, feeShare, total, allFeeDays }) => (
                              <div key={u.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2, color: '#e8e8ed' }}>{u.name || u.username}</div>
                                {/* Compact schedule display */}
                                {(() => {
                                  const s = adminSchedules[u.id]
                                  if (!Array.isArray(s)) return null
                                  const activeDays = s.map((d, i) => d.enabled ? DAY_LABELS[i] : null).filter(Boolean)
                                  if (!activeDays.length) return null
                                  const firstEnabled = s.find(d => d.enabled)
                                  const timeStr = firstEnabled ? `${minToTime(firstEnabled.startMin)}–${minToTime(firstEnabled.endMin)}` : ''
                                  return <div style={{ fontSize: 10, color: 'rgba(255,255,255,.30)', marginBottom: 6 }}>{activeDays.join(', ')} · {timeStr}</div>
                                })()}
                                <div className="admin-payroll-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
                                  <div><span style={{ color: 'rgba(255,255,255,.40)' }}>Hours: </span><span style={{ color: 'rgba(255,255,255,.6)' }}>{hours.toFixed(1)}h</span></div>
                                  <div><span style={{ color: 'rgba(255,255,255,.40)' }}>Base pay (${r.hourly_rate || 0}/hr): </span><span style={{ color: 'rgba(130,220,170,.8)' }}>{fmtMoney(basePay)}</span></div>
                                  <div><span style={{ color: 'rgba(255,255,255,.40)' }}>Profit {r.owner_profit_pct || 0}%: </span><span style={{ color: 'rgba(220,190,130,.5)' }}>{fmtMoney(profitShare)}</span></div>
                                  <div><span style={{ color: 'rgba(255,255,255,.40)' }}>Fee {r.service_fee_pct || 0}% ({allFeeDays.length}d): </span><span style={{ color: 'rgba(220,190,130,.5)' }}>{fmtMoney(feeShare)}</span></div>
                                </div>
                                <div style={{ marginTop: 6, fontWeight: 900, fontSize: 16 }}>
                                  Total: <span style={{ color: 'rgba(130,220,170,.8)' }}>{fmtMoney(total)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )
                  })()}
                </>
              )}

              {activeTab === 'attendance' && (
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(130,150,220,.6)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)', fontWeight: 900 }}>Attendance history</span>
                  </div>
                  {/* Hours summary per person */}
                  {(() => {
                    const byUser: Record<string, { name: string; role: string; mins: number; shifts: number }> = {}
                    allAttendance.forEach((r: any) => {
                      if (!byUser[r.user_id]) byUser[r.user_id] = { name: r.user_name || 'Unknown', role: r.role || '', mins: 0, shifts: 0 }
                      if (r.duration_minutes) byUser[r.user_id].mins += r.duration_minutes
                      if (!r.clock_out && r.clock_in) byUser[r.user_id].mins += Math.max(0, Math.round((Date.now() - new Date(r.clock_in).getTime()) / 60000))
                      byUser[r.user_id].shifts++
                    })
                    const entries = Object.entries(byUser).sort((a, b) => b[1].mins - a[1].mins)
                    return entries.length > 0 ? (
                      <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 14, background: 'rgba(0,0,0,.14)', border: '1px solid rgba(255,255,255,.08)' }}>
                        {entries.map(([uid, u]) => (
                          <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: '#e8e8ed', flex: 1 }}>{u.name}</span>
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.50)' }}>{u.role}</span>
                            <span style={{ fontSize: 13, color: 'rgba(130,220,170,.8)', fontWeight: 900 }}>{(u.mins / 60).toFixed(1)}h</span>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>{u.shifts} shift{u.shifts !== 1 ? 's' : ''}</span>
                          </div>
                        ))}
                      </div>
                    ) : <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginBottom: 12 }}>No attendance records for this period.</div>
                  })()}
                  {/* Full log */}
                  <div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.40)', fontWeight: 900, marginBottom: 8 }}>Full log</div>
                  <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                    {allAttendance.length === 0 && <div style={{ fontSize: 12, color: 'rgba(255,255,255,.30)', padding: 8 }}>No records found.</div>}
                    {allAttendance.map((r: any) => {
                      const inTime = r.clock_in ? new Date(r.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'
                      const outTime = r.clock_out ? new Date(r.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Still in'
                      const isIn = !r.clock_out
                      return (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.06)', fontSize: 12 }}>
                          {isIn && <span style={{ width: 6, height: 6, borderRadius: 999, background: 'rgba(130,220,170,.8)', animation: 'clockDot 2s ease-in-out infinite', flexShrink: 0 }} />}
                          <span style={{ fontWeight: 700, color: '#e8e8ed', flex: 1, minWidth: 70 }}>{r.user_name}</span>
                          <span style={{ color: 'rgba(255,255,255,.35)', minWidth: 72, fontSize: 11 }}>{r.date}</span>
                          <span style={{ color: 'rgba(255,255,255,.55)' }}>{inTime}</span>
                          <span style={{ color: 'rgba(255,255,255,.20)' }}>→</span>
                          <span style={{ color: isIn ? 'rgba(130,220,170,.8)' : 'rgba(255,255,255,.55)' }}>{outTime}</span>
                          <span style={{ color: 'rgba(130,220,170,.8)', fontWeight: 700, minWidth: 45, textAlign: 'right' as const }}>{r.duration_minutes ? `${(r.duration_minutes/60).toFixed(1)}h` : isIn ? 'now' : '—'}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {activeTab === 'rules' && (
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Admin rules */}
                  {adminUsers.length > 0 && (
                    <>
                      <div style={{ ...lbl, marginBottom: 4, marginTop: 4 }}>Admin payroll rules</div>
                      {adminUsers.map(u => (
                        <div key={u.id}>
                          <AdminPayrollEditor userId={u.id} userName={u.name || u.username}
                            rule={rules[u.id] || { base_pct: 0, tips_pct: 0, tiers: [], hourly_rate: 0, owner_profit_pct: 2, service_fee_pct: 3, service_fee_days: [] }}
                            extraDays={adminWorkDays[u.id] || []}
                            onSaved={r => { setRules(prev => ({ ...prev, [u.id]: r })); load() }}
                          />
                          <AdminScheduleEditor userId={u.id} userName={u.name || u.username}
                            schedule={adminSchedules[u.id] || null}
                            onSaved={s => setAdminSchedules(prev => ({ ...prev, [u.id]: s }))}
                          />
                        </div>
                      ))}
                      <div style={{ height: 1, background: 'rgba(255,255,255,.08)', margin: '4px 0' }} />
                      <div style={{ ...lbl, marginBottom: 4 }}>Commission rules</div>
                    </>
                  )}
                  {barbers.length === 0 ? (
                    <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 12, padding: '12px 0' }}>Load data first</div>
                  ) : barbers.map(b => (
                    <CommissionEditor key={b.barber_id} barber={b}
                      rule={rules[b.barber_id] || b.rule || { base_pct: 60, tips_pct: 100, tiers: [] }}
                      onSaved={r => { setRules(prev => ({ ...prev, [b.barber_id]: r })); load() }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showDatePicker && (
        <DatePicker from={from} to={to}
          onChange={(f, t) => { setFrom(f); setTo(t) }}
          onClose={() => setShowDatePicker(false)} />
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </FeatureGate></Shell>
  )
}
// fixed
