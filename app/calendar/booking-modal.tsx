'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'

const API = 'https://vuriumbook-api-431945333485.us-central1.run.app'
const API_KEY = 'R1403ss81fxrx*rx1403'

// ─── Shop settings — always fresh, no permanent cache ────────────────────────
async function getShopSettings() {
  try {
    const token = localStorage.getItem('VURIUMBOOK_TOKEN') || ''
    const res = await fetch(API + '/api/settings', {
      headers: { Authorization: `Bearer ${token}`, 'X-API-KEY': API_KEY }
    })
    return res.ok ? await res.json() : {}
  } catch { return {} }
}

// ─── Price calculation ────────────────────────────────────────────────────────
function calcTotal(basePrice: number, settings: any) {
  if (!basePrice) return { base: 0, tax: 0, fees: 0, total: 0, breakdown: [] }
  const breakdown: { label: string; amount: number; type: string }[] = []

  // Tax
  let taxAmount = 0
  const tax = settings?.tax
  if (tax?.enabled && tax?.rate) {
    const rate = Number(tax.rate) / 100
    if (tax.included_in_price) {
      const base = basePrice / (1 + rate)
      taxAmount = Math.round((basePrice - base) * 100) / 100
    } else {
      taxAmount = Math.round(basePrice * rate * 100) / 100
    }
    breakdown.push({ label: tax.label || 'Tax', amount: taxAmount, type: 'tax' })
  }

  // Fees
  let feesTotal = 0
  const fees: any[] = (settings?.fees || []).filter((f: any) => f.enabled !== false)
  for (const f of fees) {
    let amt = 0
    if (f.type === 'percent') amt = Math.round(basePrice * (Number(f.value||0)/100) * 100) / 100
    else if (f.type === 'fixed') amt = Number(f.value || 0)
    if (amt > 0) { feesTotal += amt; breakdown.push({ label: f.label || 'Fee', amount: amt, type: 'fee' }) }
  }

  const total = tax?.included_in_price
    ? Math.round((basePrice + feesTotal) * 100) / 100
    : Math.round((basePrice + taxAmount + feesTotal) * 100) / 100

  return { base: basePrice, tax: taxAmount, fees: feesTotal, total, breakdown }
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface Client {
  id: string
  name: string
  phone?: string
  email?: string
  notes?: string
  visitCount?: number
}

interface Barber { id: string; name: string; color: string }
interface Service { id: string; name: string; durationMin: number; price?: string; barberIds: string[] }

interface BookingModalProps {
  isOpen: boolean
  onClose: () => void
  barberId: string
  barberName: string
  date: string        // YYYY-MM-DD
  startMin: number    // minutes from midnight
  barbers: Barber[]
  services: Service[]
  isOwnerOrAdmin: boolean
  myBarberId?: string
  allEvents?: Array<{ id: string; barberId: string; startMin: number; durMin: number; status: string; paid: boolean; clientName: string; paymentStatus?: string }>
  existingEvent?: {
    id: string
    clientName: string
    clientPhone?: string
    serviceId: string
    serviceIds?: string[]
    status: string
    notes?: string
    paid: boolean
    paymentMethod?: string
    isModelEvent?: boolean
    photoUrl?: string
    _raw: any
  } | null
  onSave: (data: {
    clientName: string; clientPhone: string; clientId?: string
    barberId: string; serviceId: string; date: string; startMin: number
    durMin: number; status: string; notes: string; photoUrl?: string
  }) => void
  onDelete: () => void
  onPayment: (method: string, tip: number) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, '0')
const minToHHMM = (min: number) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length >= 4) return `+1 ***-***-${digits.slice(-4)}`
  return phone ? '***' : '—'
}

async function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem('VURIUMBOOK_TOKEN') || ''
  const res = await fetch(API + path, { credentials: 'include',
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts?.headers || {}) }
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status)
  return data
}

// ─── ClientSearch ─────────────────────────────────────────────────────────────
function ClientSearch({ onSelect, isOwnerOrAdmin, initialClient, initialName }: {
  onSelect: (c: Client | null, name: string) => void
  isOwnerOrAdmin: boolean
  initialClient?: Client | null
  initialName?: string
}) {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [results, setResults] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Client | null>(initialClient || null)
  const [notFound, setNotFound] = useState(false)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const timerRef = useRef<any>(null)
  const phoneRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSelected(initialClient || null)
    setPhone(initialClient?.phone || '')
    setName(''); setEmail(''); setNotes(''); setResults([]); setNotFound(false); setOpen(false)
  }, [initialClient?.id, initialName])

  // Extract only digits from phone
  function digits(s: string) { return s.replace(/\D/g, '') }

  // Format as +1 (XXX) XXX-XXXX — always show +1 prefix
  function formatPhone(raw: string) {
    const d = digits(raw).replace(/^1/, '').slice(0, 10) // strip leading 1, max 10 digits
    if (d.length === 0) return ''
    if (d.length <= 3)  return `+1 (${d}`
    if (d.length <= 6)  return `+1 (${d.slice(0,3)}) ${d.slice(3)}`
    return `+1 (${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
  }

  function onPhoneChange(raw: string) {
    // If user clears field, reset
    if (!raw.trim()) { setPhone(''); setNotFound(false); setResults([]); setOpen(false); return }
    const formatted = formatPhone(raw)
    setPhone(formatted)
    setNotFound(false); setResults([]); setOpen(false)
    const d = digits(raw).replace(/^1/, '')
    if (d.length >= 10) doSearch(d) // search with raw 10 digits
  }

  const doSearch = useCallback((tenDigits: string) => {
    setLoading(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        // Search by both formatted and raw digits — API uses phone_norm (digits only)
        const queries = [
          apiFetch(`/api/clients/search?q=${encodeURIComponent(tenDigits)}`),
          apiFetch(`/api/clients/search?q=${encodeURIComponent('+1' + tenDigits)}`),
          apiFetch(`/api/clients?q=${encodeURIComponent(tenDigits)}`),
        ]
        const results = await Promise.allSettled(queries)
        const allClients: any[] = []
        const seenIds = new Set<string>()
        for (const r of results) {
          if (r.status !== 'fulfilled') continue
          const data = r.value
          const list = Array.isArray(data?.clients) ? data.clients
            : Array.isArray(data) ? data
            : Array.isArray(data?.data) ? data.data : []
          for (const c of list) {
            const id = String(c.id || c.uid || '')
            if (!id || seenIds.has(id)) continue
            // Backend already filtered by phone_norm — trust the result
            // Don't re-filter by phone digits (barbers see masked phones like ***-1234)
            seenIds.add(id)
            allClients.push(c)
          }
        }
        const mapped: Client[] = allClients.map((c: any) => ({
          id: String(c.id || c.uid || ''),
          name: String(c.name || c.full_name || ''),
          phone: String(c.phone || c.phone_number || ''),
          email: String(c.email || ''),
          notes: String(c.notes || ''),
          visitCount: Number(c.visit_count || c.visits || 0),
        })).filter((c: Client) => c.name)
        if (mapped.length > 0) {
          setResults(mapped); setOpen(true); setNotFound(false)
        } else {
          setResults([]); setNotFound(true); setOpen(false)
        }
      } catch { setResults([]); setNotFound(true) }
      setLoading(false)
    }, 400)
  }, [])

  function select(c: Client) {
    setSelected(c); setPhone(c.phone || phone); setResults([]); setOpen(false); setNotFound(false)
    onSelect(c, c.name)
  }

  function clear() {
    setSelected(null); setPhone(''); setName(''); setEmail(''); setNotes('')
    setResults([]); setNotFound(false); setOpen(false)
    onSelect(null, '')
    setTimeout(() => phoneRef.current?.focus(), 50)
  }

  async function saveNew() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await apiFetch('/api/clients', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), phone, email, notes })
      })
      const c = res?.client || res
      const newClient: Client = { id: String(c.id || c.uid || 'local_' + Date.now()), name: c.name || name.trim(), phone: c.phone || phone, email: c.email || email, visitCount: 0 }
      select(newClient)
    } catch {
      // Save locally anyway
      select({ id: 'local_' + Date.now(), name: name.trim(), phone, email, visitCount: 0 })
    }
    setSaving(false)
  }

  const inp: React.CSSProperties = { width: '100%', height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.06)', color: '#fff', padding: '0 14px', outline: 'none', fontSize: 14, fontFamily: 'inherit' }
  const lbl: React.CSSProperties = { fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,.45)', display: 'block', marginBottom: 5 }

  // ── Selected client card ──────────────────────────────────────────────────
  const [editingNotes, setEditingNotes] = useState(false)
  const [clientNotes, setClientNotes] = useState(selected?.notes || '')
  const [savingNotes, setSavingNotes] = useState(false)

  useEffect(() => {
    setClientNotes(selected?.notes || '')
    setEditingNotes(false)
  }, [selected?.id])

  async function saveClientNotes() {
    if (!selected?.id || selected.id.startsWith('local_')) { setEditingNotes(false); return }
    setSavingNotes(true)
    try {
      await apiFetch(`/api/clients/${encodeURIComponent(selected.id)}`, {
        method: 'PATCH', body: JSON.stringify({ notes: clientNotes })
      })
      setSelected(prev => prev ? { ...prev, notes: clientNotes } : prev)
    } catch {}
    setSavingNotes(false); setEditingNotes(false)
  }

  if (selected) {
    return (
      <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.05)', overflow: 'hidden' }}>
        {/* Client header */}
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d7ecff" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 15 }}>{selected.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.50)', marginTop: 2 }}>
                {isOwnerOrAdmin ? (selected.phone || 'No phone') : maskPhone(selected.phone || '')}
                {selected.visitCount ? ` · ${selected.visitCount} visit${selected.visitCount !== 1 ? 's' : ''}` : ' · New client'}
              </div>
            </div>
          </div>
          <button onClick={clear} style={{ height: 30, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.60)', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', flexShrink: 0 }}>Change</button>
        </div>

        {/* Client notes */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', padding: '10px 14px', background: 'rgba(0,0,0,.12)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editingNotes ? 8 : (clientNotes ? 6 : 0) }}>
            <span style={{ fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)' }}>Client notes</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {!editingNotes && (
                <button onClick={() => setEditingNotes(true)}
                  style={{ height: 24, padding: '0 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,.10)', background: 'transparent', color: 'rgba(255,255,255,.45)', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}>
                  {clientNotes ? 'Edit' : '+ Add note'}
                </button>
              )}
              {!editingNotes && clientNotes && (
                <button onClick={async () => {
                  setClientNotes('')
                  if (selected?.id && !selected.id.startsWith('local_')) {
                    try { await apiFetch(`/api/clients/${encodeURIComponent(selected.id)}`, { method: 'PATCH', body: JSON.stringify({ notes: '' }) }) } catch {}
                  }
                  setSelected(prev => prev ? { ...prev, notes: '' } : prev)
                }} style={{ height: 24, padding: '0 8px', borderRadius: 6, border: '1px solid rgba(255,107,107,.20)', background: 'transparent', color: 'rgba(255,107,107,.60)', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}>Clear</button>
              )}
            </div>
          </div>
          {editingNotes ? (
            <div>
              <textarea value={clientNotes} onChange={e => setClientNotes(e.target.value)} rows={2} autoFocus
                placeholder="Notes about this client…"
                style={{ width: '100%', borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)', color: '#fff', padding: '8px 10px', fontSize: 12, outline: 'none', resize: 'vertical' as const, fontFamily: 'inherit', lineHeight: 1.5 }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button onClick={() => { setClientNotes(selected?.notes || ''); setEditingNotes(false) }}
                  style={{ height: 28, padding: '0 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,.10)', background: 'transparent', color: 'rgba(255,255,255,.55)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={saveClientNotes} disabled={savingNotes}
                  style={{ height: 28, padding: '0 14px', borderRadius: 7, border: '1px solid rgba(255,255,255,.20)', background: 'rgba(255,255,255,.08)', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}>
                  {savingNotes ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : clientNotes ? (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.60)', lineHeight: 1.5 }}>{clientNotes}</div>
          ) : null}
        </div>
      </div>
    )
  }

  // ── Phone input + results/form ────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Phone field */}
      <div style={{ position: 'relative' }}>
        <label style={lbl}>Phone number</label>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <div style={{ position: 'absolute', left: 14, fontSize: 14, color: 'rgba(255,255,255,.55)', pointerEvents: 'none', fontWeight: 700, zIndex: 1 }}>+1</div>
          <input
            ref={phoneRef}
            value={phone.replace(/^\+1\s?/, '')}
            onChange={e => onPhoneChange(e.target.value)}
            placeholder="(___) ___-____"
            style={{ ...inp, paddingLeft: 38, paddingRight: 40 }}
            type="tel"
            autoComplete="off"
          />
          {loading && <div style={{ position: 'absolute', right: 14, top: 14, width: 16, height: 16, border: '2px solid rgba(255,255,255,.20)', borderTop: '2px solid #0a84ff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
          {!loading && phone && <button onMouseDown={e => { e.preventDefault(); clear() }} style={{ position: 'absolute', right: 10, top: 10, width: 24, height: 24, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.50)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>✕</button>}
        </div>
      </div>

      {/* Dropdown results */}
      {open && results.length > 0 && (
        <div style={{ borderRadius: 18, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.05)', backdropFilter: 'saturate(180%) blur(20px)', overflow: 'hidden' }}>
          {results.slice(0, 6).map(c => (
            <div key={c.id} onClick={() => select(c)}
              style={{ padding: '11px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', gap: 12 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(10,132,255,.10)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.50)" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.40)', marginTop: 1 }}>
                  {isOwnerOrAdmin ? c.phone : maskPhone(c.phone || '')}
                  {c.visitCount ? ` · ${c.visitCount} visits` : ''}
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          ))}
        </div>
      )}

      {/* Not found — ask for name */}
      {notFound && (
        <div style={{ padding: '14px', borderRadius: 14, border: '1px solid rgba(255,255,255,.09)', background: 'rgba(255,255,255,.04)', animation: 'slideDown .18s ease' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.50)', marginBottom: 12 }}>
            No client found for <strong style={{ color: '#fff' }}>{phone}</strong> — fill in their details:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <label style={lbl}>Full name <span style={{ color: '#ff6b6b' }}>*</span></label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Client name" style={inp} autoFocus />
            </div>
            <div>
              <label style={lbl}>Email <span style={{ color: 'rgba(255,255,255,.30)' }}>(optional)</span></label>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" style={inp} type="email" />
            </div>
            <div>
              <label style={lbl}>Notes <span style={{ color: 'rgba(255,255,255,.30)' }}>(optional)</span></label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes…" style={inp} />
            </div>
            <button
              onClick={saveNew}
              disabled={!name.trim() || saving}
              style={{ height: 42, borderRadius: 12, border: '1px solid rgba(10,132,255,.65)', background: name.trim() ? 'rgba(10,132,255,.18)' : 'rgba(255,255,255,.04)', color: name.trim() ? '#d7ecff' : 'rgba(255,255,255,.30)', cursor: name.trim() ? 'pointer' : 'default', fontWeight: 900, fontSize: 13, fontFamily: 'inherit', marginTop: 2, transition: 'all .15s' }}>
              {saving ? 'Saving…' : 'Save & use this client'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── NewClientForm ────────────────────────────────────────────────────────────
function NewClientForm({ initialName, onCreated, onCancel }: {
  initialName: string
  onCreated: (c: Client) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    if (!name.trim()) { setErr('Name is required'); return }
    setSaving(true); setErr('')
    try {
      const res = await apiFetch('/api/clients', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), phone, email, notes })
      })
      const client = res?.client || res
      onCreated({ id: client.id || client.uid || String(Date.now()), name: client.name || name, phone: client.phone || phone, email: client.email || email, notes: client.notes || notes, visitCount: 0 })
    } catch (e: any) {
      // If API fails, create locally
      onCreated({ id: 'local_' + Date.now(), name: name.trim(), phone, email, notes, visitCount: 0 })
    }
    setSaving(false)
  }

  const inp: React.CSSProperties = { width: '100%', height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.06)', color: '#fff', padding: '0 12px', outline: 'none', fontSize: 13, fontFamily: 'inherit' }

  return (
    <div style={{ marginTop: 8, padding: '14px', borderRadius: 14, border: '1px solid rgba(255,255,255,.09)', background: 'rgba(255,255,255,.04)', animation: 'slideDown .2s ease' }}>
      <div style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', marginBottom: 12 }}>New client</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', display: 'block', marginBottom: 5 }}>Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Client name" style={inp} />
        </div>
        <div>
          <label style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', display: 'block', marginBottom: 5 }}>Phone</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (___) ___-____" style={inp} />
        </div>
        <div>
          <label style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', display: 'block', marginBottom: 5 }}>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="optional" style={inp} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', display: 'block', marginBottom: 5 }}>Notes</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes…" style={inp} />
        </div>
      </div>
      {err && <div style={{ fontSize: 12, color: '#ffd0d0', marginBottom: 8 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{ flex: 1, height: 38, borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>Cancel</button>
        <button onClick={save} disabled={saving} style={{ flex: 2, height: 38, borderRadius: 10, border: '1px solid rgba(10,132,255,.65)', background: 'rgba(10,132,255,.16)', color: '#d7ecff', cursor: 'pointer', fontWeight: 900, fontSize: 12, fontFamily: 'inherit' }}>
          {saving ? 'Saving…' : 'Save client'}
        </button>
      </div>
    </div>
  )
}

// ─── PhotoUpload ──────────────────────────────────────────────────────────────
function PhotoUpload({ value, onChange }: { value: string; onChange: (url: string, name: string) => void }) {
  const [preview, setPreview] = useState(value)
  const [fileName, setFileName] = useState('')

  function handleFile(file: File | null) {
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const MAX = 900, scale = Math.min(1, MAX / img.width, MAX / img.height)
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        let q = 0.82, out = canvas.toDataURL('image/jpeg', q)
        while (out.length > 900000 && q > 0.35) { q -= 0.08; out = canvas.toDataURL('image/jpeg', q) }
        setPreview(out)
        onChange(out, file.name)
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  return (
    <div>
      <label style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', display: 'block', marginBottom: 6 }}>
        Reference photo (haircut style)
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ height: 44, padding: '0 14px', borderRadius: 14, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.70)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontFamily: 'inherit', whiteSpace: 'nowrap', flex: 1 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          {fileName || (preview ? 'Change photo' : 'Attach reference photo…')}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0] || null)} />
        </label>
        {preview && (
          <>
            <img src={preview} alt="ref" style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover', border: '1px solid rgba(255,255,255,.14)', cursor: 'pointer', flexShrink: 0 }}
              onClick={() => window.open(preview, '_blank')} />
            <button onClick={() => { setPreview(''); setFileName(''); onChange('', '') }}
              style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,107,107,.30)', background: 'rgba(255,107,107,.06)', color: '#ffd0d0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>✕</button>
          </>
        )}
      </div>
      {!preview && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.30)', marginTop: 6 }}>
          Clients can also attach a reference photo when booking online
        </div>
      )}
    </div>
  )
}

// ─── PaymentPanel ─────────────────────────────────────────────────────────────
function PaymentPanel({ ev, services, onPayment, allEvents, barberId }: {
  ev: BookingModalProps['existingEvent']
  services: Service[]
  onPayment: (method: string, tip: number) => void
  allEvents?: BookingModalProps['allEvents']
  barberId?: string
}) {
  const [method, setMethod] = useState('terminal')
  const [tipYes, setTipYes] = useState(false)
  const [tipAmt, setTipAmt] = useState(0)
  const [hint, setHint] = useState('')
  const [hintType, setHintType] = useState<'info'|'success'|'error'|'warning'>('info')
  const [polling, setPolling] = useState(false)
  const [activeCheckoutId, setActiveCheckoutId] = useState<string|null>(null)
  const [shopSettings, setShopSettings] = useState<any>(null)
  const [isOwnerOrAdmin] = useState(() => {
    try { const u = JSON.parse(localStorage.getItem('VURIUMBOOK_USER') || '{}'); return u.role === 'owner' || u.role === 'admin' } catch { return false }
  })
  const pollRef = useRef<any>(null)

  useEffect(() => { getShopSettings().then(setShopSettings) }, [])
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const svc = services.find(s => s.id === ev?.serviceId)
  const basePrice = svc?.price ? Number(String(svc.price).replace(/[^\d.]/g, '')) : 0
  const priceCalc = calcTotal(basePrice, shopSettings)
  const price = priceCalc.total  // total with tax + fees

  // Find blocking event — same barber, earlier start, not resolved
  const RESOLVED = ['paid', 'done', 'cancelled', 'noshow', 'no_show', 'refunded', 'partially_refunded']
  const blockingEvent = ev && allEvents && barberId
    ? allEvents.find(e =>
        e.id !== ev.id &&
        e.barberId === barberId &&
        e.startMin < (ev._raw?.start_min ?? 0) &&
        !e.paid &&
        e.paymentStatus !== 'refunded' && // refunded = resolved even if paid=false
        !RESOLVED.includes(e.status)
      )
    : null

  if (blockingEvent) {
    return (
      <div style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid rgba(255,207,63,.30)', background: 'rgba(255,207,63,.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffcf3f" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#ffcf3f' }}>Cannot charge yet</span>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', lineHeight: 1.5 }}>
          <strong style={{ color: '#fff' }}>{blockingEvent.clientName || 'Previous client'}</strong> has not been charged, cancelled, or marked as no-show yet.
          <br />Please resolve them first.
        </div>
      </div>
    )
  }

  if (ev?.paid) {
    return (
      <div>
        <div style={{ padding: '10px 14px', borderRadius: 14, border: '1px solid rgba(143,240,177,.30)', background: 'rgba(143,240,177,.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8ff0b1" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          <span style={{ fontSize: 13, color: '#c9ffe1', fontWeight: 700 }}>Paid via {ev.paymentMethod || '—'}</span>
        </div>
        {isOwnerOrAdmin && ev._raw?.id && (
          <button onClick={handleRefund} style={{ width: '100%', height: 36, borderRadius: 10, border: '1px solid rgba(255,107,107,.30)', background: 'rgba(255,107,107,.06)', color: '#ffd0d0', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', marginTop: 8 }}>
            Issue Refund
          </button>
        )}
        {hint && (
          <div style={{ fontSize: 12, marginTop: 8, padding: '8px 12px', borderRadius: 10,
            color: hintType==='success' ? '#c9ffe1' : hintType==='error' ? '#ffd0d0' : 'rgba(255,255,255,.60)',
            background: hintType==='success' ? 'rgba(143,240,177,.08)' : hintType==='error' ? 'rgba(255,107,107,.08)' : 'rgba(255,255,255,.04)',
            border: `1px solid ${hintType==='success' ? 'rgba(143,240,177,.20)' : hintType==='error' ? 'rgba(255,107,107,.20)' : 'rgba(255,255,255,.08)'}`,
          }}>{hint}</div>
        )}
      </div>
    )
  }

  // Price breakdown display
  const PriceBreakdown = () => priceCalc.breakdown.length > 0 ? (
    <div style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', fontSize: 11, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,.55)', marginBottom: 4 }}>
        <span>Service</span><span>${basePrice.toFixed(2)}</span>
      </div>
      {priceCalc.breakdown.map((b, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: b.type === 'tax' ? 'rgba(255,207,63,.80)' : 'rgba(255,255,255,.50)', marginBottom: 2 }}>
          <span>{b.label}</span><span>+${b.amount.toFixed(2)}</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, color: '#e9e9e9', borderTop: '1px solid rgba(255,255,255,.08)', marginTop: 6, paddingTop: 6 }}>
        <span>Total</span><span>${priceCalc.total.toFixed(2)}</span>
      </div>
    </div>
  ) : null

  const methodStyle = (m: string): React.CSSProperties => ({
    flex: 1, height: 38, borderRadius: 999, cursor: 'pointer', fontWeight: 900, fontSize: 12, fontFamily: 'inherit',
    border: method === m ? {
      terminal: '1px solid rgba(10,132,255,.75)', cash: '1px solid rgba(143,240,177,.65)',
      zelle: '1px solid rgba(106,0,255,.75)', other: '1px solid rgba(255,207,63,.65)'
    }[m]! : '1px solid rgba(255,255,255,.12)',
    background: method === m ? {
      terminal: 'rgba(10,132,255,.14)', cash: 'rgba(143,240,177,.10)',
      zelle: 'rgba(106,0,255,.14)', other: 'rgba(255,207,63,.10)'
    }[m]! : 'rgba(255,255,255,.04)',
    color: method === m ? {
      terminal: '#d7ecff', cash: '#c9ffe1', zelle: '#d8b4fe', other: '#fff3b0'
    }[m]! : 'rgba(255,255,255,.70)',
  })

  async function handleTerminal() {
    const backendId = ev?._raw?.id
    if (!backendId) { setHint('Save booking first'); return }
    if (!price) { setHint('Service has no price'); return }
    setHint(`Sending $${price.toFixed(2)} to Terminal…`); setPolling(true)
    // Get tip options from settings (default 15/20/25%)
    const tipOptions: number[] = shopSettings?.payroll?.tip_options || [15, 20, 25]
    try {
      const res = await apiFetch('/api/payments/terminal', {
        method: 'POST',
        body: JSON.stringify({
          booking_id: String(backendId),
          amount: priceCalc.total,
          currency: 'USD',
          client_name: ev?._raw?.client_name || '',
          service_name: svc?.name || '',
          service_amount: basePrice,
          tax_amount: priceCalc.tax,
          fee_amount: priceCalc.fees,
          // Tip options for Square Terminal screen
          tip_options: tipOptions,
          tip_percentages: tipOptions,
          allow_tipping: true,
        })
      })
      const checkoutId = res?.checkout_id
      if (!checkoutId) { setHint('No checkout ID. Check Terminal manually.'); setHintType('warning'); setPolling(false); return }
      setActiveCheckoutId(checkoutId)
      const tipOptStr = (shopSettings?.payroll?.tip_options || [15,20,25]).join('% / ') + '%'
      setHint(`Waiting for payment… Tip options: ${tipOptStr} / No tip`); setHintType('info')
      let count = 0
      pollRef.current = setInterval(async () => {
        count++
        if (count > 45) { clearInterval(pollRef.current); setHint('Timed out — check Terminal'); setHintType('warning'); setPolling(false); setActiveCheckoutId(null); return }
        try {
          const s = await apiFetch(`/api/payments/terminal/status/${encodeURIComponent(checkoutId)}`)
          const st = String(s?.status || '').toUpperCase()
          if (st === 'COMPLETED') {
            clearInterval(pollRef.current); setPolling(false); setActiveCheckoutId(null)
            const tip = Number(s?.raw?.tip_money?.amount || 0) / 100
            setHint('Payment completed ✓'); setHintType('success'); onPayment('terminal', tip)
          } else if (st === 'CANCELED' || st.includes('CANCEL')) {
            clearInterval(pollRef.current); setPolling(false); setActiveCheckoutId(null)
            setHint('Payment was cancelled on Terminal'); setHintType('error')
          } else if (st === 'IN_PROGRESS') {
            setHint('Customer is completing payment on Terminal…'); setHintType('info')
          }
        } catch {}
      }, 3000)
    } catch (e: any) { setHint('Error: ' + e.message); setHintType('error'); setPolling(false) }
  }

  async function handleCancelTerminal() {
    if (!activeCheckoutId) return
    try {
      setHint('Cancelling…'); setHintType('info')
      await apiFetch(`/api/payments/terminal/cancel/${encodeURIComponent(activeCheckoutId)}`, { method: 'POST', body: '{}' })
      if (pollRef.current) clearInterval(pollRef.current)
      setPolling(false); setActiveCheckoutId(null)
      setHint('Payment cancelled'); setHintType('warning')
    } catch (e: any) { setHint('Cancel failed: ' + e.message); setHintType('error') }
  }

  async function handleRefund() {
    const backendId = ev?._raw?.id
    if (!backendId) return
    if (!window.confirm('Issue a full refund for this payment?')) return
    try {
      setHint('Processing refund…'); setHintType('info')
      await apiFetch(`/api/payments/refund-by-booking/${encodeURIComponent(String(backendId))}`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Requested by staff' })
      })
      setHint('Refund issued ✓'); setHintType('success')
    } catch (e: any) { setHint('Refund failed: ' + e.message); setHintType('error') }
  }

  async function handleManual() {
    const backendId = ev?._raw?.id
    const tip = tipYes ? tipAmt : 0
    setHint('Saving…')
    try {
      await apiFetch('/api/payments/terminal', {
        method: 'POST',
        body: JSON.stringify({ booking_id: backendId ? String(backendId) : '', amount: priceCalc.total, tip, tip_amount: tip, source: method, payment_method: method, currency: 'USD', client_name: ev?._raw?.client_name || '', service_name: svc?.name || '', service_amount: basePrice, tax_amount: priceCalc.tax, fee_amount: priceCalc.fees })
      })
      if (backendId) {
        await apiFetch('/api/bookings/' + encodeURIComponent(String(backendId)), {
          method: 'PATCH', body: JSON.stringify({ paid: true, payment_method: method, tip, service_amount: basePrice, tax_amount: priceCalc.tax, fee_amount: priceCalc.fees, total_amount: priceCalc.total })
        })
      }
      setHint(`${method} payment recorded ✓`); onPayment(method, tip)
    } catch (e: any) { setHint('Error: ' + e.message) }
  }

  return (
    <div style={{ padding: '14px', borderRadius: 18, border: '1px solid rgba(255,255,255,.09)', background: 'rgba(255,255,255,.04)', marginTop: 4 }}>
      <div style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', marginBottom: 8 }}>
        Accept payment {price > 0 && <span style={{ color: '#e9e9e9', fontWeight: 900 }}> — ${price.toFixed(2)}</span>}
      </div>
      <PriceBreakdown />
      {/* Tip options preview for terminal */}
      {method === 'terminal' && (() => {
        const opts: number[] = shopSettings?.payroll?.tip_options || [15, 20, 25]
        return (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' as const, marginBottom: 8 }}>
            <span style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)' }}>Tip on screen:</span>
            {opts.map((p: number) => (
              <span key={p} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, border: '1px solid rgba(143,240,177,.35)', background: 'rgba(143,240,177,.08)', color: '#c9ffe1' }}>{p}%</span>
            ))}
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.45)' }}>No tip</span>
          </div>
        )
      })()}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {(['terminal','cash','zelle','other'] as const).map(m => (
          <button key={m} onClick={() => { setMethod(m); setHint(''); if (m === 'terminal') handleTerminal() }} disabled={polling} style={methodStyle(m)}>
            {m === 'terminal' && polling ? 'Waiting…' : m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>
      {method !== 'terminal' && method !== 'cash' && (
        <div style={{ padding: '10px 12px', borderRadius: 14, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', marginBottom: 8 }}>
          <div style={{ fontSize: 11, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 8 }}>Tip?</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setTipYes(false)} style={{ flex: 1, height: 32, borderRadius: 8, border: `1px solid ${!tipYes ? 'rgba(255,255,255,.30)' : 'rgba(255,255,255,.10)'}`, background: !tipYes ? 'rgba(255,255,255,.06)' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 11, fontFamily: 'inherit' }}>No tip</button>
            <button onClick={() => setTipYes(true)} style={{ flex: 1, height: 32, borderRadius: 8, border: `1px solid ${tipYes ? 'rgba(143,240,177,.55)' : 'rgba(255,255,255,.10)'}`, background: tipYes ? 'rgba(143,240,177,.08)' : 'transparent', color: tipYes ? '#c9ffe1' : '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 11, fontFamily: 'inherit' }}>Yes, tip</button>
            {tipYes && <input type="number" min="0" step="0.01" placeholder="$ amount" value={tipAmt || ''} onChange={e => setTipAmt(parseFloat(e.target.value) || 0)} style={{ flex: 1, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)', color: '#fff', padding: '0 10px', outline: 'none', fontSize: 12 }} />}
          </div>
        </div>
      )}
      {method === 'cash' && (
        <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(143,240,177,.06)', border: '1px solid rgba(143,240,177,.18)', fontSize: 12, color: 'rgba(143,240,177,.85)', marginBottom: 8 }}>Cash collected by barber directly</div>
      )}
      {method !== 'terminal' && (
        <button onClick={handleManual} style={{ width: '100%', height: 40, borderRadius: 12, border: '1px solid rgba(255,255,255,.22)', background: 'rgba(255,255,255,.10)', color: '#fff', cursor: 'pointer', fontWeight: 900, fontSize: 13, fontFamily: 'inherit' }}>
          Confirm {method} payment
        </button>
      )}
      {/* Cancel terminal button while polling */}
      {polling && activeCheckoutId && (
        <button onClick={handleCancelTerminal} style={{ width: '100%', height: 36, borderRadius: 10, border: '1px solid rgba(255,107,107,.40)', background: 'rgba(255,107,107,.08)', color: '#ffd0d0', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', marginTop: 8 }}>
          Cancel payment on Terminal
        </button>
      )}

      {/* Refund button for owner/admin on paid bookings */}
      {ev?.paid && isOwnerOrAdmin && ev._raw?.id && (
        <button onClick={handleRefund} style={{ width: '100%', height: 36, borderRadius: 10, border: '1px solid rgba(255,107,107,.30)', background: 'rgba(255,107,107,.06)', color: '#ffd0d0', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', marginTop: 8 }}>
          Issue Refund
        </button>
      )}

      {hint && (
        <div style={{ fontSize: 12, marginTop: 8, padding: '8px 12px', borderRadius: 10, 
          color: hintType==='success' ? '#c9ffe1' : hintType==='error' ? '#ffd0d0' : hintType==='warning' ? '#ffe9a3' : 'rgba(255,255,255,.60)',
          background: hintType==='success' ? 'rgba(143,240,177,.08)' : hintType==='error' ? 'rgba(255,107,107,.08)' : hintType==='warning' ? 'rgba(255,207,63,.08)' : 'rgba(255,255,255,.04)',
          border: `1px solid ${hintType==='success' ? 'rgba(143,240,177,.20)' : hintType==='error' ? 'rgba(255,107,107,.20)' : hintType==='warning' ? 'rgba(255,207,63,.20)' : 'rgba(255,255,255,.08)'}`,
        }}>{hint}</div>
      )}
    </div>
  )
}

// ─── BookingModal ─────────────────────────────────────────────────────────────
export function BookingModal({
  isOpen, onClose, barberId, barberName, date, startMin,
  barbers, services, isOwnerOrAdmin, myBarberId,
  existingEvent, onSave, onDelete, onPayment, allEvents
}: BookingModalProps) {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientName, setClientName] = useState('')
  const [modalKey, setModalKey] = useState(0)  // force remount ClientSearch on open
  const [selBarberId, setSelBarberId] = useState(barberId)
  const [serviceId, setServiceId] = useState('')
  const [selStartMin, setSelStartMin] = useState(startMin)
  const [status, setStatus] = useState('booked')
  const [notes, setNotes] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [lightbox, setLightbox] = useState(false)
  const [shopSettings, setShopSettings] = useState<any>(null)
  useEffect(() => { getShopSettings().then(setShopSettings) }, [])
  const [saving, setSaving] = useState(false)

  const isNew = !existingEvent?._raw?.id

  // Init from existing event
  useEffect(() => {
    if (!isOpen) return
    setSelBarberId(barberId)
    setSelStartMin(startMin)
    setModalKey(k => k + 1)  // remount ClientSearch
    if (existingEvent) {
      setClientName(existingEvent.clientName || '')
      setServiceId(existingEvent.serviceId || '')
      setStatus(existingEvent.status || 'booked')
      setNotes(existingEvent.notes || '')
      setPhotoUrl('')
      // Pre-fill client card if we have client info from existing event
      if (existingEvent.clientName) {
        setSelectedClient({ id: '', name: existingEvent.clientName, phone: existingEvent.clientPhone || '', visitCount: 0 })
      } else {
        setSelectedClient(null)
      }
    } else {
      setClientName(''); setServiceId(''); setStatus('booked'); setNotes(''); setPhotoUrl('')
      setSelectedClient(null)
    }
  }, [isOpen, existingEvent?.id, barberId, startMin])

  const svc = services.find(s => s.id === serviceId)
  const durMin = svc?.durationMin || 30
  const barberServices = services.filter(s => !s.barberIds.length || s.barberIds.includes(selBarberId))

  // Time slots 5min
  const slots: number[] = []
  for (let m = 9 * 60; m <= 21 * 60 - 5; m += 5) slots.push(m)

  async function handleSave() {
    if (!clientName.trim()) { alert('Enter client name'); return }
    if (!serviceId) { alert('Choose service'); return }
    setSaving(true)
    onSave({
      clientName: clientName.trim(),
      clientPhone: selectedClient?.phone || '',
      clientId: selectedClient?.id,
      barberId: selBarberId,
      serviceId,
      date,
      startMin: selStartMin,
      durMin,
      status,
      notes,
      photoUrl,
    })
    setSaving(false)
  }

  if (!isOpen) return null

  const inp: React.CSSProperties = { width: '100%', height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.06)', color: '#fff', padding: '0 12px', outline: 'none', fontSize: 13, fontFamily: 'inherit' }
  const lbl: React.CSSProperties = { fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', display: 'block', marginBottom: 5 }

  return (
    <>
      <style>{`
        @keyframes slideDown { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin { to { transform:rotate(360deg) } }
        .bm-scroll::-webkit-scrollbar { width:5px } 
        .bm-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,.15); border-radius:3px }
        select option { background:#111 }
      `}</style>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 'clamp(8px,3vw,16px)' }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="bm-scroll" style={{ width: 'min(580px,100%)', height: 'min(720px,calc(100dvh - 16px))', borderRadius: 22, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(0,0,0,.65)', backdropFilter: 'saturate(180%) blur(40px)', WebkitBackdropFilter: 'saturate(180%) blur(40px)', boxShadow: '0 32px 80px rgba(0,0,0,.60), inset 0 0 0 0.5px rgba(255,255,255,.07)', overflowY: 'auto', display: 'flex', flexDirection: 'column', color: '#e9e9e9', fontFamily: 'Inter,sans-serif' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 14px', borderBottom: '1px solid rgba(255,255,255,.07)', background: 'rgba(255,255,255,.03)' }}>
            <div>
              <div style={{ fontFamily: '"Julius Sans One",sans-serif', letterSpacing: '.16em', textTransform: 'uppercase', fontSize: 13, color: '#e9e9e9' }}>
                {isNew ? 'New appointment' : `Edit — ${existingEvent?.clientName}`}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.40)', marginTop: 3, letterSpacing: '.08em' }}>
                {date} · {barberName} · {minToHHMM(selStartMin)}
              </div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontFamily: 'inherit' }}>✕</button>
          </div>

          <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Client search */}
            <div>
              <label style={lbl}>Client</label>
              <ClientSearch
                key={modalKey}
                isOwnerOrAdmin={isOwnerOrAdmin}
                initialClient={selectedClient}
                initialName={!selectedClient ? clientName : undefined}
                onSelect={(c, name) => {
                  setSelectedClient(c)
                  setClientName(c ? c.name : (name || ''))
                }}
              />
            </div>

            {/* Booking fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={lbl}>Barber</label>
                <select value={selBarberId} onChange={e => setSelBarberId(e.target.value)}
                  disabled={!isOwnerOrAdmin}
                  style={{ ...inp, opacity: isOwnerOrAdmin ? 1 : 0.6, cursor: isOwnerOrAdmin ? 'auto' : 'not-allowed' }}>
                  {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Service</label>
                <select value={serviceId} onChange={e => setServiceId(e.target.value)} style={inp}>
                  <option value="">Choose service…</option>
                  {barberServices.map(s => {
                    const bp = s.price ? Number(String(s.price).replace(/[^\d.]/g, '')) : 0
                    const calc = calcTotal(bp, shopSettings)
                    const label = bp > 0 ? (calc.total !== bp ? ` — $${calc.total.toFixed(2)} (base $${bp.toFixed(2)})` : ` — $${bp.toFixed(2)}`) : ''
                    return <option key={s.id} value={s.id}>{s.name}{label}</option>
                  })}
                </select>
              </div>
              <div>
                <label style={lbl}>Time</label>
                <select value={selStartMin} onChange={e => setSelStartMin(Number(e.target.value))} style={inp}>
                  {slots.map(m => <option key={m} value={m}>{minToHHMM(m)}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Duration → end time</label>
                <div style={{ height: 44, borderRadius: 14, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', padding: '0 12px', display: 'flex', alignItems: 'center', fontSize: 13, color: 'rgba(255,255,255,.60)' }}>
                  {durMin}min → {minToHHMM(selStartMin + durMin)}
                </div>
              </div>
              {!isNew && (
                <div>
                  <label style={lbl}>Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value)} style={inp}>
                    {['booked','arrived','done','noshow','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
              <div style={{ gridColumn: !isNew ? '2 / 3' : '1 / -1' }}>
                <label style={lbl}>Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes…" rows={2}
                  style={{ ...inp, height: 'auto', padding: '10px 12px', resize: 'vertical' as const, lineHeight: 1.5 }} />
              </div>
            </div>

            {/* Client photo — clean, no decoration */}
            {existingEvent?.photoUrl && (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                  <img
                    src={existingEvent.photoUrl}
                    alt="reference"
                    style={{ width: 110, height: 110, borderRadius: 12, objectFit: 'cover', cursor: 'zoom-in', border: '1px solid rgba(255,255,255,.12)', display: 'block' }}
                    onClick={() => setLightbox(true)}
                    onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none' }}
                  />
                </div>
                {lightbox && (
                  <div onClick={() => setLightbox(false)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, cursor: 'zoom-out', backdropFilter: 'blur(8px)' }}>
                    <img src={existingEvent.photoUrl} alt="reference"
                      style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 16, objectFit: 'contain', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }} />
                    <button onClick={() => setLightbox(false)}
                      style={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderRadius: 999, border: '1px solid rgba(255,255,255,.20)', background: 'rgba(0,0,0,.50)', color: '#fff', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>
                )}
              </>
            )}

            {/* Upload reference photo */}
            <PhotoUpload value={photoUrl} onChange={(url) => setPhotoUrl(url)} />

            {/* Payment — owner/admin only */}
            {isOwnerOrAdmin && existingEvent && (
              <PaymentPanel ev={existingEvent} services={services} onPayment={onPayment} allEvents={allEvents} barberId={barberId} />
            )}

            {/* Footer */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid rgba(255,255,255,.08)', flexWrap: 'wrap' as const }}>
              {!isNew && (
                <button onClick={onDelete} style={{ height: 42, padding: '0 16px', borderRadius: 999, border: '1px solid rgba(255,107,107,.35)', background: 'rgba(255,107,107,.08)', color: '#ffd0d0', cursor: 'pointer', fontWeight: 900, fontFamily: 'inherit', fontSize: 13 }}>Delete</button>
              )}
              <button onClick={onClose} style={{ height: 42, padding: '0 16px', borderRadius: 999, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.06)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', fontSize: 13 }}>Close</button>
              <button onClick={handleSave} disabled={saving} style={{ height: 42, padding: '0 20px', borderRadius: 999, border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.12)', color: '#fff', cursor: 'pointer', fontWeight: 900, fontFamily: 'inherit', fontSize: 13, opacity: saving ? .5 : 1 }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
