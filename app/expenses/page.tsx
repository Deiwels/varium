'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import Shell from '@/components/Shell'
import FeatureGate from '@/components/FeatureGate'
import { apiFetch } from '@/lib/api'

// ─── Types ───────────────────────────────────────────────────────────────────
interface Expense {
  id: string; amount: number; category: string; description: string
  date: string; created_by: string; created_by_name: string; created_by_role: string
  receipt_url?: string; created_at: string; updated_at: string
}
interface User { uid: string; role: string; name: string }

// ─── Constants ───────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  Rent: '#ff6b6b', Supplies: 'rgba(130,150,220,.9)', Equipment: '#bf5af2', Utilities: 'rgba(220,190,100,.8)',
  Marketing: '#ff9f0a', Insurance: '#30d158', Maintenance: '#64d2ff', Software: '#5e5ce6', Other: 'rgba(255,255,255,.35)',
}
const FALLBACK_COLORS = ['#ff6b6b','rgba(130,150,220,.9)','#bf5af2','rgba(220,190,100,.8)','#ff9f0a','#30d158','#64d2ff','#5e5ce6','rgba(220,130,160,.8)','rgba(130,200,220,.8)']
function catColor(cat: string) { return CATEGORY_COLORS[cat] || FALLBACK_COLORS[Math.abs([...cat].reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0)) % FALLBACK_COLORS.length] }

const money = (n: number) => '$' + Number(n || 0).toFixed(2)
const fmtDate = (d: string) => { try { const dt = new Date(d + 'T12:00:00'); return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) } catch { return d } }
const isoToday = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DOW = ['Mo','Tu','We','Th','Fr','Sa','Su']

// ─── DatePicker ──────────────────────────────────────────────────────────────
function DatePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
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
  const todayStr = isoToday()
  const cells: (number | null)[] = Array(startOffset).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1))
  while (cells.length % 7 !== 0) cells.push(null)

  const displayDate = value ? new Date(value + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select date'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {label && <div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 5 }}>{label}</div>}
      <button onClick={() => { setOpen(!open); const dd = value ? new Date(value + 'T12:00:00') : new Date(); setViewYear(dd.getFullYear()); setViewMonth(dd.getMonth()) }}
        style={{ width: '100%', height: 44, borderRadius: 14, border: `1px solid ${open ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.12)'}`, background: open ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.22)', color: '#fff', padding: '0 14px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', transition: 'all .2s ease', boxShadow: open ? '0 0 12px rgba(255,255,255,.04)' : 'none' }}>
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
            {DOW.map(day => <div key={day} style={{ textAlign: 'center', fontSize: 9, letterSpacing: '.10em', color: 'rgba(255,255,255,.35)', padding: '4px 0', fontWeight: 700 }}>{day}</div>)}
            {cells.map((day, i) => {
              if (day === null) return <div key={`e${i}`} />
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const isSelected = dateStr === value
              const isToday = dateStr === todayStr
              return (
                <button key={i} onClick={() => { onChange(dateStr); setOpen(false) }}
                  style={{ width: '100%', height: 36, borderRadius: 10, border: isSelected ? '1px solid rgba(255,255,255,.18)' : isToday ? '1px solid rgba(255,255,255,.25)' : '1px solid transparent', background: isSelected ? 'rgba(255,255,255,.06)' : 'transparent', color: isSelected ? '#fff' : isToday ? 'rgba(130,150,220,.6)' : 'rgba(255,255,255,.75)', cursor: 'pointer', fontWeight: isSelected || isToday ? 900 : 500, fontSize: 13, fontFamily: 'inherit', transition: 'all .15s ease', boxShadow: isSelected ? '0 0 14px rgba(255,255,255,.08)' : 'none' }}>
                  {day}
                </button>
              )
            })}
          </div>
          <button onClick={() => { onChange(todayStr); setOpen(false) }}
            style={{ width: '100%', height: 32, marginTop: 8, borderRadius: 999, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.60)', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', letterSpacing: '.06em', textTransform: 'uppercase' }}>
            Today
          </button>
        </div>
      )}
    </div>
  )
}

export default function ExpensesPage() {
  const [user, setUser] = useState<User | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)

  // Date range — default: first of month → today
  const today = isoToday()
  const firstOfMonth = today.slice(0, 8) + '01'
  const [from, setFrom] = useState(firstOfMonth)
  const [to, setTo] = useState(today)
  const [activePreset, setActivePreset] = useState('month')

  // Form state
  const [fAmount, setFAmount] = useState('')
  const [fCategory, setFCategory] = useState('')
  const [fNewCat, setFNewCat] = useState('')
  const [fDesc, setFDesc] = useState('')
  const [fDate, setFDate] = useState(today)
  const [saving, setSaving] = useState(false)
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null)

  useEffect(() => {
    try { const u = JSON.parse(localStorage.getItem('VURIUMBOOK_USER') || '{}'); setUser(u) } catch {}
  }, [])

  const isOwner = user?.role === 'owner'

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [expData, catData] = await Promise.all([
        apiFetch(`/api/expenses?from=${from}&to=${to}`),
        apiFetch('/api/expenses/categories'),
      ])
      setExpenses(expData?.expenses || [])
      setCategories(catData?.categories || [])
    } catch (e: any) { showToast('Error: ' + e.message) }
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  function setPreset(key: string) {
    setActivePreset(key)
    const d = new Date()
    if (key === 'week') {
      const w = new Date(d); w.setDate(d.getDate() - 7)
      setFrom(isoDate(w)); setTo(isoToday())
    } else if (key === 'month') {
      setFrom(isoToday().slice(0, 8) + '01'); setTo(isoToday())
    } else if (key === 'quarter') {
      const q = new Date(d); q.setMonth(d.getMonth() - 3)
      setFrom(isoDate(q)); setTo(isoToday())
    }
  }
  function isoDate(d: Date) { const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }

  function openAdd() {
    setEditing(null); setFAmount(''); setFCategory(categories[0] || 'Other'); setFNewCat(''); setFDesc(''); setFDate(today); setShowModal(true)
  }
  function openEdit(e: Expense) {
    setEditing(e); setFAmount(String(e.amount)); setFCategory(e.category); setFNewCat(''); setFDesc(e.description); setFDate(e.date); setShowModal(true)
  }

  async function handleSave() {
    const amount = Number(fAmount)
    if (!amount || amount <= 0) { showToast('Enter valid amount'); return }
    let category = fCategory
    if (fCategory === '__new__') {
      if (!fNewCat.trim()) { showToast('Enter category name'); return }
      category = fNewCat.trim()
      try { await apiFetch('/api/expenses/categories', { method: 'POST', body: JSON.stringify({ name: category }) }) } catch {}
    }
    setSaving(true)
    try {
      if (editing) {
        await apiFetch(`/api/expenses/${editing.id}`, { method: 'PATCH', body: JSON.stringify({ amount, category, description: fDesc, date: fDate }) })
        showToast('Expense updated ✓')
      } else {
        await apiFetch('/api/expenses', { method: 'POST', body: JSON.stringify({ amount, category, description: fDesc, date: fDate }) })
        showToast('Expense added ✓')
      }
      setShowModal(false); load()
    } catch (e: any) { showToast('Error: ' + e.message) }
    setSaving(false)
  }

  function handleDelete(id: string) {
    setConfirmModal({
      message: 'Are you sure you want to delete this expense?',
      onConfirm: async () => {
        setConfirmModal(null)
        try { await apiFetch(`/api/expenses/${id}`, { method: 'DELETE' }); showToast('Deleted ✓'); load() }
        catch (e: any) { showToast('Error: ' + e.message) }
      }
    })
  }

  // ─── Calculations ──────────────────────────────────────────────────────────
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const byCategory: Record<string, number> = {}
  expenses.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount })
  const sortedCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
  const maxCat = sortedCats[0]?.[1] || 1

  // Group by date
  const byDate: Record<string, Expense[]> = {}
  expenses.forEach(e => { if (!byDate[e.date]) byDate[e.date] = []; byDate[e.date].push(e) })
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

  // ─── Styles ────────────────────────────────────────────────────────────────
  const card: React.CSSProperties = { borderRadius: 18, border: '1px solid rgba(255,255,255,.08)', background: 'linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02))', padding: 16 }
  const inp: React.CSSProperties = { width: '100%', height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(0,0,0,.22)', color: '#fff', padding: '0 14px', outline: 'none', fontSize: 14, fontFamily: 'inherit' }
  const lbl: React.CSSProperties = { fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', display: 'block', marginBottom: 6 }
  const pill = (active: boolean): React.CSSProperties => ({ height: 32, padding: '0 14px', borderRadius: 999, cursor: 'pointer', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'inherit', border: `1px solid ${active ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.08)'}`, background: active ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.03)', color: active ? '#fff' : 'rgba(255,255,255,.40)', transition: 'all .2s' })

  return (
    <Shell page="expenses"><FeatureGate feature="expenses" label="Expenses" requiredPlan="custom">

      {/* Loading overlay */}
      {loading && expenses.length === 0 && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(1,1,1,.8)', gap: 16 }}>
          <div style={{ position: 'relative', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/Element_logo-05.jpg" alt="Element" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }} />
            <svg viewBox="0 0 80 80" fill="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', animation: 'expSpin 1.2s linear infinite' }}>
              <circle cx="40" cy="40" r="38" stroke="rgba(255,255,255,.08)" strokeWidth="2.5" />
              <path d="M40 2a38 38 0 0 1 38 38" stroke="rgba(130,150,220,.6)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.30)', letterSpacing: '.08em' }}>Loading expenses…</div>
        </div>
      )}

      {/* Header — compact */}
      <div style={{ padding: '10px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>{expenses.length} expenses · {money(totalExpenses)}</span>
          <div style={{ flex: 1 }} />
          <button onClick={openAdd} style={{ height: 32, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontWeight: 600, fontSize: 11, fontFamily: 'inherit' }}>
            + Add
          </button>
        </div>

        {/* Date presets */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {[{ k: 'week', l: 'This week' }, { k: 'month', l: 'This month' }, { k: 'quarter', l: '3 months' }].map(p => (
            <button key={p.k} onClick={() => setPreset(p.k)} style={pill(activePreset === p.k)}>{p.l}</button>
          ))}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginLeft: 'auto' }}>
            <div style={{ width: 150 }}><DatePicker value={from} onChange={v => { setFrom(v); setActivePreset('') }} label="From" /></div>
            <span style={{ color: 'rgba(255,255,255,.20)', fontSize: 11, paddingBottom: 14 }}>→</span>
            <div style={{ width: 150 }}><DatePicker value={to} onChange={v => { setTo(v); setActivePreset('') }} label="To" /></div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Total card */}
        <div style={{ ...card, border: '1px solid rgba(255,107,107,.20)', background: 'rgba(255,107,107,.04)' }}>
          <div style={lbl}>Total expenses</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'rgba(220,130,160,.5)', letterSpacing: '-.02em' }}>{money(totalExpenses)}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.30)', marginTop: 4 }}>{expenses.length} expense{expenses.length !== 1 ? 's' : ''} · {sortedCats.length} categor{sortedCats.length !== 1 ? 'ies' : 'y'}</div>
        </div>

        {/* Category breakdown */}
        {sortedCats.length > 0 && (
          <div style={card}>
            <div style={{ ...lbl, marginBottom: 12 }}>By category</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sortedCats.map(([cat, amount], i) => {
                const pct = (amount / totalExpenses) * 100
                const color = catColor(cat)
                return (
                  <div key={cat} style={{ animation: 'expSlide .4s ease both', animationDelay: `${i * 0.05}s` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{cat}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 800 }}>{money(amount)}</span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,.30)' }}>{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 999, background: color, width: `${(amount / maxCat) * 100}%`, transition: 'width .6s cubic-bezier(.4,0,.2,1)', animation: 'barGrow .8s ease both', animationDelay: `${i * 0.08}s` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Expense list grouped by date */}
        {sortedDates.map((date, di) => (
          <div key={date}>
            <div style={{ fontSize: 11, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 8, marginTop: di > 0 ? 8 : 0 }}>{fmtDate(date)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {byDate[date].map((e, i) => {
                const color = catColor(e.category)
                const canEdit = isOwner || e.created_by === user?.uid
                return (
                  <div key={e.id} style={{ ...card, padding: '12px 14px', animation: 'expSlide .35s ease both', animationDelay: `${(di * 3 + i) * 0.04}s`, transition: 'border-color .2s, transform .2s', cursor: canEdit ? 'pointer' : 'default' }}
                    onClick={() => canEdit && openEdit(e)}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '18', border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 14 }}>{money(e.amount)}</div>
                          {e.description && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.50)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.description}</div>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999, border: `1px solid ${color}40`, background: color + '14', color }}>
                          {e.category}
                        </span>
                        {isOwner && (
                          <button onClick={ev => { ev.stopPropagation(); handleDelete(e.id) }} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,107,107,.25)', background: 'rgba(255,107,107,.06)', color: 'rgba(220,130,160,.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontFamily: 'inherit', flexShrink: 0, transition: 'all .2s' }}>✕</button>
                        )}
                      </div>
                    </div>
                    {isOwner && e.created_by_name && (
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 4, height: 4, borderRadius: 999, background: e.created_by_role === 'admin' ? 'rgba(130,220,170,.5)' : 'rgba(220,190,130,.5)' }} />
                        {e.created_by_name}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {!loading && expenses.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,.25)', fontSize: 13 }}>
            No expenses recorded for this period
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div style={{ width: 'min(420px,100%)', borderRadius: 24, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(10,10,20,.90)', backdropFilter: 'saturate(180%) blur(40px)', color: '#e8e8ed', fontFamily: 'Inter,sans-serif', boxShadow: '0 30px 80px rgba(0,0,0,.55)', overflow: 'hidden', animation: 'modalIn .3s cubic-bezier(.4,0,.2,1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
              <div style={{ fontFamily: '"Inter",sans-serif', letterSpacing: '.16em', textTransform: 'uppercase', fontSize: 13 }}>
                {editing ? 'Edit expense' : 'New expense'}
              </div>
              <button onClick={() => setShowModal(false)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.06)', color: '#fff', cursor: 'pointer', fontSize: 15, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>Amount ($)</label>
                <input type="number" step="0.01" min="0" value={fAmount} onChange={e => setFAmount(e.target.value)} placeholder="0.00" style={{ ...inp, fontSize: 22, fontWeight: 900, textAlign: 'center', letterSpacing: '.02em' }} autoFocus />
              </div>
              <div>
                <label style={lbl}>Category</label>
                <select value={fCategory} onChange={e => setFCategory(e.target.value)} style={inp}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__new__">+ Add new category…</option>
                </select>
                {fCategory === '__new__' && (
                  <input value={fNewCat} onChange={e => setFNewCat(e.target.value)} placeholder="New category name" style={{ ...inp, marginTop: 8 }} />
                )}
              </div>
              <div>
                <label style={lbl}>Description (optional)</label>
                <input value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="What was this expense for?" style={inp} />
              </div>
              <DatePicker value={fDate} onChange={setFDate} label="Date" />
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => setShowModal(false)} style={{ flex: 1, height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.60)', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={{ flex: 1, height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.6)', cursor: 'pointer', fontWeight: 900, fontSize: 13, fontFamily: 'inherit', opacity: saving ? .5 : 1, transition: 'all .2s' }}>
                  {saving ? 'Saving…' : editing ? 'Update' : 'Add expense'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 250, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'expSlide .2s ease' }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmModal(null) }}>
          <div style={{ width: 'min(360px,90vw)', borderRadius: 20, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(10,10,20,.92)', backdropFilter: 'saturate(180%) blur(40px)', padding: '24px 22px', boxShadow: '0 30px 80px rgba(0,0,0,.6)', animation: 'modalIn .25s cubic-bezier(.4,0,.2,1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,107,107,.12)', border: '1px solid rgba(255,107,107,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'rgba(220,130,160,.5)' }}>Delete expense</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', marginTop: 3 }}>{confirmModal.message}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirmModal(null)} style={{ flex: 1, height: 42, borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.60)', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', transition: 'all .2s' }}>Cancel</button>
              <button onClick={confirmModal.onConfirm} style={{ flex: 1, height: 42, borderRadius: 12, border: '1px solid rgba(255,107,107,.40)', background: 'rgba(255,107,107,.12)', color: 'rgba(220,130,160,.5)', cursor: 'pointer', fontWeight: 900, fontSize: 13, fontFamily: 'inherit', transition: 'all .2s' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: 'rgba(8,8,8,.92)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 999, padding: '10px 20px', boxShadow: '0 20px 60px rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', gap: 10, backdropFilter: 'blur(18px)', fontSize: 13, zIndex: 5000, whiteSpace: 'nowrap', color: '#e8e8ed', fontFamily: 'inherit', animation: 'expSlide .25s ease' }}>
          {toast}
        </div>
      )}

      <style>{`
        @keyframes expSpin { to { transform: rotate(360deg) } }
        @keyframes expSlide { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes modalIn { 0% { opacity: 0; transform: scale(.96) translateY(8px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes barGrow { 0% { width: 0; } }
        @keyframes calPopIn { 0%{opacity:0;transform:translateY(-6px) scale(.97)} 100%{opacity:1;transform:translateY(0) scale(1)} }
        select option { background: #111; }
      `}</style>
    </FeatureGate></Shell>
  )
}
