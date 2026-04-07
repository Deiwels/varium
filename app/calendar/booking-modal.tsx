'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { usePermissions } from '@/components/PermissionsProvider'

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://vuriumbook-api-431945333485.us-central1.run.app'

// ─── Shop settings — always fresh, no permanent cache ────────────────────────
async function getShopSettings() {
  try {
    const token = localStorage.getItem('VURIUMBOOK_TOKEN') || ''
    const res = await fetch(API + '/api/settings', {
      headers: { Authorization: `Bearer ${token}` }
    })
    return res.ok ? await res.json() : {}
  } catch { return {} }
}

// ─── Price calculation ────────────────────────────────────────────────────────
function calcTotal(basePrice: number, settings: any, paymentMethod?: string) {
  if (!basePrice) return { base: 0, tax: 0, fees: 0, total: 0, breakdown: [] }
  const breakdown: { label: string; amount: number; type: string }[] = []

  // Tax — filter by payment method via applies_to
  let taxAmount = 0
  const tax = settings?.tax
  const taxApplies = tax?.applies_to || 'all'
  const taxMatchesMethod = taxApplies === 'all' || !paymentMethod || taxApplies === paymentMethod
  if (tax?.enabled && tax?.rate && taxMatchesMethod) {
    const rate = Number(tax.rate) / 100
    if (tax.included_in_price) {
      const base = basePrice / (1 + rate)
      taxAmount = Math.round((basePrice - base) * 100) / 100
    } else {
      taxAmount = Math.round(basePrice * rate * 100) / 100
    }
    breakdown.push({ label: tax.label || 'Tax', amount: taxAmount, type: 'tax' })
  }

  // Fees — filter by payment method via applies_to
  let feesTotal = 0
  const fees: any[] = (settings?.fees || []).filter((f: any) => {
    if (f.enabled === false) return false
    const appliesTo = f.applies_to || 'all'
    if (appliesTo === 'all') return true
    if (!paymentMethod) return true // no method selected yet — show all
    return appliesTo === paymentMethod
  })
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
interface Service { id: string; name: string; durationMin: number; price?: string; barberIds: string[]; service_type?: string }

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
  isStudent?: boolean
  mentorBarberIds?: string[]
  allEvents?: Array<{ id: string; barberId: string; startMin: number; durMin: number; status: string; paid: boolean; clientName: string; date?: string; paymentStatus?: string }>
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
    hasReferencePhoto?: boolean
    backendId?: string
    _raw: any
  } | null
  onSave: (data: {
    clientName: string; clientPhone: string; clientId?: string
    barberId: string; serviceId: string; date: string; startMin: number
    durMin: number; status: string; notes: string; photoUrl?: string
  }) => void
  onDelete: () => void
  onPayment: (method: string, tip: number) => void
  onOpenEvent?: (eventId: string) => void
  terminalEnabled?: boolean
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
  const [editingInfo, setEditingInfo] = useState(false)
  const [editName, setEditName] = useState(selected?.name || '')
  const [editPhone, setEditPhone] = useState(selected?.phone || '')
  const [editEmail, setEditEmail] = useState(selected?.email || '')
  const [savingInfo, setSavingInfo] = useState(false)

  useEffect(() => {
    setClientNotes(selected?.notes || '')
    setEditingNotes(false)
    setEditingInfo(false)
    setEditName(selected?.name || '')
    setEditPhone(selected?.phone || '')
    setEditEmail(selected?.email || '')
  }, [selected?.id])

  async function saveClientInfo() {
    if (!editName.trim()) return
    setSavingInfo(true)
    try {
      const patch: any = { name: editName.trim() }
      if (editPhone) patch.phone = editPhone
      if (editEmail) patch.email = editEmail
      if (selected?.id && !selected.id.startsWith('local_')) {
        await apiFetch(`/api/clients/${encodeURIComponent(selected.id)}`, {
          method: 'PATCH', body: JSON.stringify(patch)
        })
      }
      const updated = { ...selected!, name: editName.trim(), phone: editPhone, email: editEmail }
      setSelected(updated)
      onSelect(updated, updated.name)
    } catch {}
    setSavingInfo(false)
    setEditingInfo(false)
  }

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
        {editingInfo ? (
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <label style={{ fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: 5 }}>Name <span style={{ color: '#ff6b6b' }}>*</span></label>
              <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                style={{ width: '100%', height: 40, borderRadius: 10, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.06)', color: '#fff', padding: '0 12px', outline: 'none', fontSize: 14, fontFamily: 'inherit' }} />
            </div>
            <div>
              <label style={{ fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: 5 }}>Phone</label>
              <input value={editPhone} onChange={e => setEditPhone(e.target.value)}
                style={{ width: '100%', height: 40, borderRadius: 10, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.06)', color: '#fff', padding: '0 12px', outline: 'none', fontSize: 14, fontFamily: 'inherit' }} type="tel" />
            </div>
            <div>
              <label style={{ fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: 5 }}>Email</label>
              <input value={editEmail} onChange={e => setEditEmail(e.target.value)}
                style={{ width: '100%', height: 40, borderRadius: 10, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.06)', color: '#fff', padding: '0 12px', outline: 'none', fontSize: 14, fontFamily: 'inherit' }} type="email" />
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
              <button onClick={() => { setEditingInfo(false); setEditName(selected.name); setEditPhone(selected.phone || ''); setEditEmail(selected.email || '') }}
                style={{ height: 32, padding: '0 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.10)', background: 'transparent', color: 'rgba(255,255,255,.55)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={saveClientInfo} disabled={savingInfo || !editName.trim()}
                style={{ height: 32, padding: '0 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,.20)', background: 'rgba(255,255,255,.08)', color: editName.trim() ? '#fff' : 'rgba(255,255,255,.30)', cursor: editName.trim() ? 'pointer' : 'default', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>
                {savingInfo ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(130,150,220,.6)" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 15 }}>{selected.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.50)', marginTop: 2 }}>
                  {isOwnerOrAdmin ? (selected.phone || 'No phone') : maskPhone(selected.phone || '')}
                  {selected.visitCount ? ` · ${selected.visitCount} visit${selected.visitCount !== 1 ? 's' : ''}` : ' · New client'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {isOwnerOrAdmin && selected.phone && (
                <a href={`tel:${selected.phone.replace(/[^\d+]/g, '')}`}
                  title={`Call ${selected.name}`}
                  style={{ height: 30, width: 30, borderRadius: 8, border: '1px solid rgba(130,220,170,.30)', background: 'rgba(130,220,170,.08)', color: 'rgba(130,220,170,.75)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </a>
              )}
              <button onClick={() => setEditingInfo(true)} style={{ height: 30, padding: '0 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.60)', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}>Edit</button>
              <button onClick={clear} style={{ height: 30, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.60)', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}>Change</button>
            </div>
          </div>
        )}

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
          {loading && <div style={{ position: 'absolute', right: 14, top: 14, width: 16, height: 16, border: '2px solid rgba(255,255,255,.20)', borderTop: '2px solid rgba(130,150,220,.9)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
          {!loading && phone && <button onMouseDown={e => { e.preventDefault(); clear() }} style={{ position: 'absolute', right: 10, top: 10, width: 24, height: 24, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.50)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>✕</button>}
        </div>
      </div>

      {/* Dropdown results */}
      {open && results.length > 0 && (
        <div style={{ borderRadius: 18, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.05)', backdropFilter: 'saturate(180%) blur(20px)', overflow: 'hidden' }}>
          {results.slice(0, 6).map(c => (
            <div key={c.id} onClick={() => select(c)}
              style={{ padding: '11px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', gap: 12 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
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
              style={{ height: 42, borderRadius: 12, border: '1px solid rgba(255,255,255,.15)', background: name.trim() ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.04)', color: name.trim() ? 'rgba(130,150,220,.6)' : 'rgba(255,255,255,.30)', cursor: name.trim() ? 'pointer' : 'default', fontWeight: 900, fontSize: 13, fontFamily: 'inherit', marginTop: 2, transition: 'all .15s' }}>
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
      {err && <div style={{ fontSize: 12, color: 'rgba(220,130,160,.5)', marginBottom: 8 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{ flex: 1, height: 38, borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>Cancel</button>
        <button onClick={save} disabled={saving} style={{ flex: 2, height: 38, borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.6)', cursor: 'pointer', fontWeight: 900, fontSize: 12, fontFamily: 'inherit' }}>
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
              style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,107,107,.30)', background: 'rgba(255,107,107,.06)', color: 'rgba(220,130,160,.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>✕</button>
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
function PaymentPanel({ ev, services, onPayment, allEvents, barberId, terminalEnabled }: {
  ev: BookingModalProps['existingEvent']
  services: Service[]
  onPayment: (method: string, tip: number) => void
  allEvents?: BookingModalProps['allEvents']
  terminalEnabled?: boolean
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
  const [manualAmount, setManualAmount] = useState<number | null>(null)
  const { hasPerm: payHasPerm } = usePermissions()
  const [isOwnerOrAdmin] = useState(() => {
    try { const u = JSON.parse(localStorage.getItem('VURIUMBOOK_USER') || '{}'); return u.role === 'owner' || u.role === 'admin' } catch { return false }
  })
  const canRefund = payHasPerm('financial', 'refund')
  const pollRef = useRef<any>(null)
  const mountedRef = useRef(true)

  useEffect(() => { getShopSettings().then(s => { if (mountedRef.current) setShopSettings(s) }) }, [])
  useEffect(() => () => { mountedRef.current = false; if (pollRef.current) clearInterval(pollRef.current) }, [])

  const evServiceIds = ev?.serviceIds?.length ? ev.serviceIds : ev?.serviceId ? [ev.serviceId] : []
  const evSvcs = services.filter(s => evServiceIds.includes(s.id))
  const svc = evSvcs[0]
  const basePrice = evSvcs.reduce((sum, s) => sum + (s.price ? Number(String(s.price).replace(/[^\d.]/g, '')) : 0), 0)
  const priceCalc = calcTotal(basePrice, shopSettings, method)
  const price = priceCalc.total  // total with tax + fees

  // Find blocking event — same barber, same day, earlier start, not resolved
  const RESOLVED = ['paid', 'done', 'cancelled', 'noshow', 'no_show', 'refunded', 'partially_refunded']
  const evDate = ev?._raw?.date || (ev?._raw?.start_at ? ev._raw.start_at.slice(0, 10) : '')
  const now = new Date()
  const localTodayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
  // Only block checkout for unresolved bookings earlier TODAY — not past or future days
  const blockingEvent = ev && allEvents && barberId && evDate === localTodayStr
    ? allEvents.find(e =>
        e.id !== ev.id &&
        e.barberId === barberId &&
        e.date === evDate &&
        e.startMin < (ev._raw?.start_min ?? 0) &&
        !e.paid &&
        e.paymentStatus !== 'refunded' &&
        !RESOLVED.includes(e.status) &&
        e.status !== 'block' &&
        e.clientName !== 'BLOCKED'
      )
    : null

  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [skipBlocking, setSkipBlocking] = useState(false)

  if (blockingEvent && !skipBlocking) {
    if (!checkoutOpen) {
      return (
        <button onClick={() => setCheckoutOpen(true)}
          style={{ width: '100%', height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.55)', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          Checkout
        </button>
      )
    }
    return (
      <div>
        <div style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid rgba(255,207,63,.30)', background: 'rgba(255,207,63,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(220,190,100,.8)" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(220,190,100,.8)' }}>Cannot charge yet</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', lineHeight: 1.5 }}>
            <strong style={{ color: '#fff' }}>{blockingEvent.clientName || 'Previous client'}</strong> has not been charged, cancelled, or marked as no-show yet.
            <br />Please resolve them first.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={() => setCheckoutOpen(false)}
            style={{ flex: 1, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', color: 'rgba(255,255,255,.35)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
            Hide
          </button>
          <button onClick={() => { setSkipBlocking(true); setCheckoutOpen(false) }}
            style={{ flex: 1, height: 32, borderRadius: 8, border: '1px solid rgba(255,207,63,.20)', background: 'rgba(255,207,63,.04)', color: 'rgba(255,207,63,.6)', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>
            Charge anyway
          </button>
        </div>
      </div>
    )
  }

  if (ev?.paid) {
    return (
      <div>
        <div style={{ padding: '10px 14px', borderRadius: 14, border: '1px solid rgba(143,240,177,.30)', background: 'rgba(143,240,177,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(130,220,170,.8)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span style={{ fontSize: 13, color: 'rgba(130,220,170,.5)', fontWeight: 700 }}>Paid via {ev.paymentMethod || '—'}</span>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(143,240,177,.12)', fontSize: 12 }}>
            {(ev._raw?.amount || ev._raw?.service_amount) ? (
              <div><span style={{ color: 'rgba(255,255,255,.40)' }}>Amount: </span><span style={{ color: 'rgba(255,255,255,.65)', fontWeight: 600 }}>${Number(ev._raw?.amount || ev._raw?.service_amount || 0).toFixed(2)}</span></div>
            ) : null}
            <div><span style={{ color: 'rgba(255,255,255,.40)' }}>Tip: </span><span style={{ color: Number(ev._raw?.tip || ev._raw?.tip_amount || 0) > 0 ? 'rgba(130,220,170,.7)' : 'rgba(255,255,255,.35)', fontWeight: 600 }}>${Number(ev._raw?.tip || ev._raw?.tip_amount || 0).toFixed(2)}</span></div>
            {(ev._raw?.amount || ev._raw?.service_amount) && Number(ev._raw?.tip || ev._raw?.tip_amount || 0) > 0 ? (
              <div><span style={{ color: 'rgba(255,255,255,.40)' }}>Total: </span><span style={{ color: 'rgba(255,255,255,.65)', fontWeight: 600 }}>${(Number(ev._raw?.amount || ev._raw?.service_amount || 0) + Number(ev._raw?.tip || ev._raw?.tip_amount || 0)).toFixed(2)}</span></div>
            ) : null}
          </div>
        </div>
        {ev._raw?.client_phone && (
          <button onClick={async () => {
            try {
              await apiFetch('/api/receipts/send', { method: 'POST', body: JSON.stringify({ booking_id: ev._raw?.id, phone: ev._raw?.client_phone }) })
              setHint('Receipt sent ✓'); setHintType('success')
            } catch (e: any) { setHint('Failed: ' + e.message); setHintType('error') }
          }} style={{ width: '100%', height: 36, borderRadius: 10, border: '1px solid rgba(130,150,220,.25)', background: 'rgba(130,150,220,.06)', color: 'rgba(130,150,220,.7)', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', marginTop: 8 }}>
            Send Receipt
          </button>
        )}
        {(isOwnerOrAdmin || canRefund) && ev._raw?.id && (
          <button onClick={handleRefund} style={{ width: '100%', height: 36, borderRadius: 10, border: '1px solid rgba(255,107,107,.30)', background: 'rgba(255,107,107,.06)', color: 'rgba(220,130,160,.5)', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', marginTop: 8 }}>
            Issue Refund
          </button>
        )}
        {hint && (
          <div style={{ fontSize: 12, marginTop: 8, padding: '8px 12px', borderRadius: 10,
            color: hintType==='success' ? 'rgba(130,220,170,.5)' : hintType==='error' ? 'rgba(220,130,160,.5)' : 'rgba(255,255,255,.60)',
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
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, color: '#e8e8ed', borderTop: '1px solid rgba(255,255,255,.08)', marginTop: 6, paddingTop: 6 }}>
        <span>Total</span><span>${priceCalc.total.toFixed(2)}</span>
      </div>
    </div>
  ) : null

  const methodStyle = (m: string): React.CSSProperties => ({
    flex: 1, height: 34, borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 11, fontFamily: 'inherit',
    border: method === m ? {
      terminal: '1px solid rgba(255,255,255,.20)', cash: '1px solid rgba(143,240,177,.30)',
      zelle: '1px solid rgba(168,107,255,.30)', other: '1px solid rgba(255,207,63,.30)'
    }[m]! : '1px solid rgba(255,255,255,.08)',
    background: method === m ? {
      terminal: 'rgba(255,255,255,.08)', cash: 'rgba(143,240,177,.06)',
      zelle: 'rgba(168,107,255,.06)', other: 'rgba(255,207,63,.06)'
    }[m]! : 'rgba(255,255,255,.03)',
    color: method === m ? {
      terminal: '#e8e8ed', cash: 'rgba(130,220,170,.7)', zelle: '#d8b4fe', other: '#fff3b0'
    }[m]! : 'rgba(255,255,255,.45)',
    transition: 'all .2s',
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
          service_name: evSvcs.map(s => s.name).join(' + ') || '',
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
        if (!mountedRef.current) { clearInterval(pollRef.current); return }
        count++
        if (count > 45) { clearInterval(pollRef.current); setHint('Timed out — check Terminal'); setHintType('warning'); setPolling(false); setActiveCheckoutId(null); return }
        try {
          const s = await apiFetch(`/api/payments/terminal/status/${encodeURIComponent(checkoutId)}`)
          const st = String(s?.status || '').toUpperCase()
          if (st === 'COMPLETED') {
            clearInterval(pollRef.current); setPolling(false); setActiveCheckoutId(null)
            // Extract tip from all possible Square response paths (cents → dollars)
            const tipCents = Number(
              s?.tip_money?.amount || s?.raw?.tip_money?.amount ||
              s?.checkout?.tip_money?.amount || s?.payment?.tip_money?.amount ||
              s?.tip_cents || s?.raw?.tip_cents || s?.tip_amount_money?.amount || 0
            )
            const tip = tipCents / 100
            console.log('[Terminal] payment status response:', JSON.stringify(s), 'tip extracted:', tip)
            setHint('Payment completed ✓'); setHintType('success'); onPayment('terminal', tip)
          } else if (st === 'CANCELED' || st.includes('CANCEL')) {
            clearInterval(pollRef.current); setPolling(false); setActiveCheckoutId(null)
            setHint('Payment was cancelled on Terminal'); setHintType('error')
          } else if (st === 'IN_PROGRESS') {
            setHint('Customer is completing payment on Terminal…'); setHintType('info')
          }
        } catch (err) { console.warn('Terminal poll error:', err) }
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
    // Use manual amount if service has no price set
    const effectiveBase = basePrice > 0 ? basePrice : (manualAmount || 0)
    const effectiveTotal = basePrice > 0 ? priceCalc.total : (manualAmount || 0)
    const effectiveTax = basePrice > 0 ? priceCalc.tax : 0
    const effectiveFees = basePrice > 0 ? priceCalc.fees : 0
    if (effectiveTotal <= 0 && tip <= 0) { setHint('Enter an amount'); setHintType('error'); return }
    setHint('Saving…')
    try {
      await apiFetch('/api/payments/terminal', {
        method: 'POST',
        body: JSON.stringify({ booking_id: backendId ? String(backendId) : '', amount: effectiveTotal, tip, tip_amount: tip, source: method, payment_method: method, currency: 'USD', client_name: ev?._raw?.client_name || '', service_name: evSvcs.map(s => s.name).join(' + ') || '', service_amount: effectiveBase, tax_amount: effectiveTax, fee_amount: effectiveFees })
      })
      if (backendId) {
        await apiFetch('/api/bookings/' + encodeURIComponent(String(backendId)), {
          method: 'PATCH', body: JSON.stringify({ paid: true, payment_method: method, tip, service_amount: effectiveBase, tax_amount: effectiveTax, fee_amount: effectiveFees, total_amount: effectiveTotal })
        })
      }
      setHint(`${method} payment recorded ✓`); onPayment(method, tip)
    } catch (e: any) { setHint('Error: ' + e.message) }
  }

  return (
    <div>
      {/* Checkout button — expands to payment options */}
      <button onClick={() => setCheckoutOpen(!checkoutOpen)}
        style={{ width: '100%', height: 40, borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: '#e8e8ed', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all .2s' }}>
        Checkout {price > 0 && <span style={{ color: 'rgba(130,220,170,.7)' }}>${price.toFixed(2)}</span>}
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', transform: checkoutOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▼</span>
      </button>

      {checkoutOpen && (
        <div style={{ marginTop: 8, padding: '12px', borderRadius: 14, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.02)' }}>
          <PriceBreakdown />

          {/* Tip options preview for terminal */}
          {method === 'terminal' && (() => {
            const opts: number[] = shopSettings?.payroll?.tip_options || [15, 20, 25]
            return (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' as const, marginBottom: 8 }}>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,.3)' }}>Tip:</span>
                {opts.map((p: number) => (
                  <span key={p} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', color: 'rgba(255,255,255,.4)' }}>{p}%</span>
                ))}
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(255,255,255,.06)', color: 'rgba(255,255,255,.3)' }}>No tip</span>
              </div>
            )
          })()}

          {/* Payment methods */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {(['terminal','cash','zelle','other'] as const).filter(m => {
              if (m === 'terminal') return terminalEnabled
              if (m === 'cash') return isOwnerOrAdmin || payHasPerm('financial', 'pay_cash')
              if (m === 'zelle') return isOwnerOrAdmin || payHasPerm('financial', 'pay_zelle')
              if (m === 'other') return isOwnerOrAdmin || payHasPerm('financial', 'pay_other')
              return true
            }).map(m => (
              <button key={m} onClick={() => { setMethod(m); setHint(''); if (m === 'terminal') handleTerminal() }} disabled={polling} style={methodStyle(m)}>
                {m === 'terminal' && polling ? 'Waiting…' : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          {/* Tip for non-terminal */}
          {method !== 'terminal' && method !== 'cash' && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 8 }}>
              <button onClick={() => setTipYes(false)} style={{ flex: 1, height: 30, borderRadius: 8, border: `1px solid ${!tipYes ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.06)'}`, background: !tipYes ? 'rgba(255,255,255,.06)' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 10, fontFamily: 'inherit' }}>No tip</button>
              <button onClick={() => setTipYes(true)} style={{ flex: 1, height: 30, borderRadius: 8, border: `1px solid ${tipYes ? 'rgba(143,240,177,.25)' : 'rgba(255,255,255,.06)'}`, background: tipYes ? 'rgba(143,240,177,.04)' : 'transparent', color: tipYes ? 'rgba(130,220,170,.6)' : 'rgba(255,255,255,.5)', cursor: 'pointer', fontWeight: 600, fontSize: 10, fontFamily: 'inherit' }}>Tip</button>
              {tipYes && <input type="number" min="0" step="0.01" placeholder="$" value={tipAmt || ''} onChange={e => setTipAmt(parseFloat(e.target.value) || 0)} style={{ width: 70, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)', color: '#fff', padding: '0 8px', outline: 'none', fontSize: 11 }} />}
            </div>
          )}

          {method === 'cash' && basePrice > 0 && (
            <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(143,240,177,.04)', border: '1px solid rgba(143,240,177,.12)', fontSize: 11, color: 'rgba(130,220,170,.6)', marginBottom: 8 }}>Cash collected</div>
          )}

          {/* Manual amount input when service has no price */}
          {basePrice <= 0 && method !== 'terminal' && (
            <div style={{ marginBottom: 8 }}>
              <input type="number" min="0" step="0.01" placeholder="Enter amount $" value={manualAmount || ''} onChange={e => setManualAmount(parseFloat(e.target.value) || 0)}
                style={{ width: '100%', height: 36, borderRadius: 10, border: '1px solid rgba(255,207,63,.30)', background: 'rgba(255,207,63,.04)', color: '#fff', padding: '0 12px', outline: 'none', fontSize: 13, fontFamily: 'inherit' }} />
            </div>
          )}

          {method !== 'terminal' && (
            <button onClick={handleManual} style={{ width: '100%', height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.06)', color: '#e8e8ed', cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'inherit' }}>
              Confirm {method}
            </button>
          )}

          {polling && activeCheckoutId && (
            <button onClick={handleCancelTerminal} style={{ width: '100%', height: 32, borderRadius: 8, border: '1px solid rgba(255,107,107,.20)', background: 'rgba(255,107,107,.04)', color: 'rgba(255,107,107,.6)', cursor: 'pointer', fontWeight: 600, fontSize: 11, fontFamily: 'inherit', marginTop: 6 }}>
              Cancel Terminal
            </button>
          )}

          {hint && (
            <div style={{ fontSize: 11, marginTop: 6, padding: '6px 10px', borderRadius: 8,
              color: hintType==='success' ? 'rgba(130,220,170,.6)' : hintType==='error' ? 'rgba(255,107,107,.6)' : hintType==='warning' ? 'rgba(220,190,130,.6)' : 'rgba(255,255,255,.5)',
              background: hintType==='success' ? 'rgba(143,240,177,.04)' : hintType==='error' ? 'rgba(255,107,107,.04)' : hintType==='warning' ? 'rgba(255,207,63,.04)' : 'rgba(255,255,255,.03)',
              border: `1px solid ${hintType==='success' ? 'rgba(143,240,177,.12)' : hintType==='error' ? 'rgba(255,107,107,.12)' : hintType==='warning' ? 'rgba(255,207,63,.12)' : 'rgba(255,255,255,.06)'}`,
            }}>{hint}</div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── BookingModal ─────────────────────────────────────────────────────────────
export function BookingModal({
  isOpen, onClose, barberId, barberName, date, startMin,
  barbers, services, isOwnerOrAdmin, myBarberId,
  existingEvent, onSave, onDelete, onPayment, allEvents, terminalEnabled
}: BookingModalProps) {
  // Block background scroll when modal is open
  useEffect(() => {
    if (!isOpen) return
    const scrollEl = document.querySelector('.content') as HTMLElement
    const calScroll = document.querySelector('.cal-container') as HTMLElement
    // Save scroll positions before locking
    const savedBodyScroll = window.scrollY
    const savedCalScroll = calScroll?.scrollTop ?? 0
    if (scrollEl) scrollEl.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${savedBodyScroll}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    return () => {
      if (scrollEl) scrollEl.style.overflow = ''
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      window.scrollTo(0, savedBodyScroll)
      if (calScroll) calScroll.scrollTop = savedCalScroll
    }
  }, [isOpen])

  const { hasPerm } = usePermissions()
  const canCheckout = hasPerm('financial', 'checkout_client')
  const canTerminal = hasPerm('financial', 'access_terminal')

  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientName, setClientName] = useState('')
  const [modalKey, setModalKey] = useState(0)  // force remount ClientSearch on open
  const [selBarberId, setSelBarberId] = useState(barberId)
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [servicesOpen, setServicesOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null)
  const [selStartMin, setSelStartMin] = useState(startMin)
  const [selDate, setSelDate] = useState(date)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [reschCalOpen, setReschCalOpen] = useState(false)
  const [reschMonth, setReschMonth] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d })
  const [status, setStatus] = useState('booked')
  const [notes, setNotes] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [fetchedPhotoUrl, setFetchedPhotoUrl] = useState('')
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
    setSelDate(date)
    setModalKey(k => k + 1)  // remount ClientSearch
    if (existingEvent) {
      setClientName(existingEvent.clientName || '')
      const initSvcIds = existingEvent.serviceIds?.length ? existingEvent.serviceIds : existingEvent.serviceId ? [existingEvent.serviceId] : []
      setServiceIds(initSvcIds)
      setServicesOpen(initSvcIds.length === 0)
      setDeleteConfirm(false)
      setRescheduleOpen(false)
      setReschCalOpen(false)
      setStatus(existingEvent.status || 'booked')
      setNotes(existingEvent.notes || '')
      setPhotoUrl('')
      setFetchedPhotoUrl('')
      // Fetch reference photo on demand if booking has one
      if ((existingEvent.hasReferencePhoto || existingEvent.photoUrl) && existingEvent.backendId) {
        if (existingEvent.photoUrl) {
          setFetchedPhotoUrl(existingEvent.photoUrl)
        } else {
          apiFetch(`/api/bookings/${encodeURIComponent(existingEvent.backendId)}/photo`)
            .then((r: any) => { if (r?.photo_url) setFetchedPhotoUrl(r.photo_url) })
            .catch(() => {})
        }
      }
      // Pre-fill client card if we have client info from existing event
      if (existingEvent.clientName) {
        const cid = existingEvent._raw?.customer_id || ''
        setSelectedClient({ id: cid, name: existingEvent.clientName, phone: existingEvent.clientPhone || '', visitCount: 0 })
      } else {
        setSelectedClient(null)
      }
    } else {
      setClientName(''); setServiceIds([]); setServicesOpen(true); setStatus('booked'); setNotes(''); setPhotoUrl('')
      setSelectedClient(null)
    }
  }, [isOpen, existingEvent?.id, barberId, startMin])

  const selectedSvcs = services.filter(s => serviceIds.includes(s.id))
  const durMin = selectedSvcs.reduce((sum, s) => sum + (s.durationMin || 30), 0) || 30
  const barberServices = services.filter(s => !s.barberIds.length || s.barberIds.includes(selBarberId))

  // Time slots 5min
  const slots: number[] = []
  for (let m = 9 * 60; m <= 21 * 60 - 5; m += 5) slots.push(m)

  function checkOverlap(force?: boolean): boolean {
    const selSvcs = services.filter(s => serviceIds.includes(s.id))
    const totalDur = selSvcs.reduce((sum, s) => sum + (s.durationMin || 30), 0) || 30
    const endMin = selStartMin + totalDur
    if (!allEvents || force) return true
    const currentId = existingEvent?.id || ''
    const conflicts = allEvents.filter(e =>
      e.barberId === selBarberId &&
      e.id !== currentId &&
      e.status !== 'cancelled' && e.status !== 'noshow' &&
      (e.date ? e.date === selDate : true) &&
      e.startMin < endMin && (e.startMin + e.durMin) > selStartMin
    )
    if (conflicts.length > 0) {
      const names = conflicts.map(e => `${e.clientName} (${minToHHMM(e.startMin)}–${minToHHMM(e.startMin + e.durMin)})`).join(', ')
      setOverlapWarning(`Not enough time — overlaps with: ${names}. Save anyway?`)
      return false
    }
    return true
  }

  async function handleSave(force?: boolean, statusOverride?: string) {
    const saveStatus = statusOverride || status
    if (saveStatus !== 'cancelled') {
      if (!clientName.trim()) { alert('Enter client name'); return }
      if (!serviceIds.length) { alert('Choose at least one service'); return }
      if (!force && !checkOverlap()) return
    }
    setOverlapWarning(null)
    setSaving(true)
    const selSvcs = services.filter(s => serviceIds.includes(s.id))
    const totalDur = selSvcs.reduce((sum, s) => sum + (s.durationMin || 30), 0) || 30
    try {
      await onSave({
        clientName: clientName.trim(),
        clientPhone: selectedClient?.phone || '',
        clientId: selectedClient?.id,
        barberId: selBarberId,
        serviceId: serviceIds[0] || '',
        service_ids: serviceIds,
        service_name: selSvcs.map(s => s.name).join(' + '),
        date: selDate,
        startMin: selStartMin,
        durMin: totalDur,
        duration_minutes: totalDur,
        status: saveStatus,
        notes,
        photoUrl,
      } as any)
    } catch {}
    setSaving(false)
  }

  if (!isOpen) return null

  const inp: React.CSSProperties = { width: '100%', height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.06)', color: '#fff', padding: '0 12px', outline: 'none', fontSize: 13, fontFamily: 'inherit' }
  const lbl: React.CSSProperties = { fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', display: 'block', marginBottom: 5 }

  return createPortal(
    <>
      <style>{`
        @keyframes slideDown { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin { to { transform:rotate(360deg) } }
        .bm-scroll::-webkit-scrollbar { width:5px }
        .bm-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,.15); border-radius:3px }
        select option { background:#111 }
        /* Hide pill-bar and date dots when booking modal is open */
        .pill-bar, .date-dot-wrap { opacity: 0 !important; pointer-events: none !important; }
      `}</style>
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10010, padding: 'clamp(8px,3vw,16px)', paddingTop: 'max(env(safe-area-inset-top, 8px), 16px)', paddingBottom: 'max(env(safe-area-inset-bottom, 8px), 16px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
        onTouchMove={e => e.stopPropagation()}>
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} onClick={onClose} />
        <div className="bm-scroll" style={{ position: 'relative', width: 'min(420px,calc(100% - 24px))', maxHeight: 'calc(100dvh - max(env(safe-area-inset-top, 16px), 16px) - max(env(safe-area-inset-bottom, 16px), 16px) - 16px)', borderRadius: 20, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(12,12,12,.95)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', boxShadow: '0 24px 80px rgba(0,0,0,.6)', display: 'flex', flexDirection: 'column', color: '#e8e8ed', fontFamily: 'Inter,sans-serif', overflowY: 'auto' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 12px', borderBottom: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e8e8ed' }}>
                {isNew ? 'New appointment' : existingEvent?.clientName || 'Edit'}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>
                {selDate} · {barbers.find(b => b.id === selBarberId)?.name || barberName} · {minToHHMM(selStartMin)}
              </div>
            </div>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontFamily: 'inherit' }}>✕</button>
          </div>

          <div style={{ padding: '14px 18px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>

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
              {isNew ? (<>
                <div>
                  <label style={lbl}>Team member</label>
                  <select value={selBarberId} onChange={e => setSelBarberId(e.target.value)}
                    disabled={!isOwnerOrAdmin}
                    style={{ ...inp, opacity: isOwnerOrAdmin ? 1 : 0.6, cursor: isOwnerOrAdmin ? 'auto' : 'not-allowed' }}>
                    {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Time</label>
                  <select value={selStartMin} onChange={e => setSelStartMin(Number(e.target.value))} style={inp}>
                    {slots.map(m => <option key={m} value={m}>{minToHHMM(m)}</option>)}
                  </select>
                </div>
              </>) : (
                <div style={{ gridColumn: '1 / -1' }}>
                  <button onClick={() => { setRescheduleOpen(!rescheduleOpen); if (!rescheduleOpen) setReschMonth(() => { const d = new Date(selDate + 'T00:00:00'); d.setDate(1); return d }) }}
                    style={{ width: '100%', height: 44, borderRadius: 12, border: `1px solid ${rescheduleOpen ? 'rgba(130,150,220,.25)' : 'rgba(255,255,255,.10)'}`, background: rescheduleOpen ? 'rgba(130,150,220,.06)' : 'rgba(255,255,255,.04)', color: rescheduleOpen ? 'rgba(130,150,220,.9)' : 'rgba(255,255,255,.55)', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all .15s' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {rescheduleOpen ? 'Cancel reschedule' : 'Reschedule appointment'}
                  </button>
                  {/* Reschedule panel — inline right below button */}
                  {rescheduleOpen && (() => {
                    const today = new Date(); today.setHours(0,0,0,0)
                    const offset = (reschMonth.getDay() + 6) % 7
                    const calStart = new Date(reschMonth); calStart.setDate(1 - offset)
                    const calDays: Date[] = []
                    for (let i = 0; i < 42; i++) { const d = new Date(calStart); d.setDate(calStart.getDate() + i); calDays.push(d) }
                    const selDateObj = new Date(selDate + 'T00:00:00')
                    const calBtn: React.CSSProperties = { height: 36, borderRadius: 999, border: '1px solid rgba(255,255,255,.04)', background: 'rgba(0,0,0,.40)', color: 'rgba(255,255,255,.50)', cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'inherit', width: '100%' }
                    return (
                      <div style={{ borderRadius: 14, border: '1px solid rgba(130,150,220,.15)', background: 'rgba(2,2,6,.90)', padding: 12, marginTop: 8 }}>
                        {/* Date selector */}
                        <div style={{ marginBottom: 8 }}>
                          <label style={{ ...lbl, marginBottom: 4 }}>New date</label>
                          <button onClick={() => setReschCalOpen(!reschCalOpen)} style={{ ...inp, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: reschCalOpen ? 'rgba(130,150,220,.08)' : 'rgba(255,255,255,.06)', borderColor: reschCalOpen ? 'rgba(130,150,220,.20)' : 'rgba(255,255,255,.10)' }}>
                            <span>{new Date(selDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="2" strokeLinecap="round"><polyline points={reschCalOpen ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/></svg>
                          </button>
                        </div>
                        {/* Inline Vurium calendar */}
                        {reschCalOpen && (
                          <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(0,0,0,.30)', padding: 8, marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button onClick={() => { const m = new Date(reschMonth); m.setMonth(m.getMonth()-1); setReschMonth(m) }} style={{ height: 26, width: 26, borderRadius: 999, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.50)', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', fontSize: 11 }}>&lsaquo;</button>
                                <button onClick={() => { const m = new Date(reschMonth); m.setMonth(m.getMonth()+1); setReschMonth(m) }} style={{ height: 26, width: 26, borderRadius: 999, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.50)', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', fontSize: 11 }}>&rsaquo;</button>
                              </div>
                              <span style={{ fontWeight: 700, fontSize: 11, color: 'rgba(255,255,255,.65)' }}>{reschMonth.toLocaleDateString([], { month: 'long', year: 'numeric' })}</span>
                              <button onClick={() => { const t = new Date(); t.setDate(1); t.setHours(0,0,0,0); setReschMonth(t) }} style={{ height: 26, padding: '0 8px', borderRadius: 999, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.40)', cursor: 'pointer', fontWeight: 600, fontSize: 9, fontFamily: 'inherit' }}>Today</button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 2 }}>
                              {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => <div key={d} style={{ textAlign: 'center', fontSize: 8, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,.20)', padding: '2px 0' }}>{d}</div>)}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
                              {calDays.map((d, i) => {
                                const inMonth = d.getMonth() === reschMonth.getMonth()
                                const isToday = +d === +today
                                const isSel = d.toDateString() === selDateObj.toDateString()
                                return <button key={i} onClick={() => { const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; setSelDate(key); setReschCalOpen(false) }} style={{ ...calBtn, height: 32, fontSize: 11, opacity: inMonth ? 1 : 0.2, borderColor: isSel ? 'rgba(130,150,220,.40)' : isToday ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.04)', background: isSel ? 'rgba(130,150,220,.15)' : isToday ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.30)', color: isSel ? '#fff' : isToday ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.45)' }}>{d.getDate()}</button>
                              })}
                            </div>
                          </div>
                        )}
                        {/* Time + Barber */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                          <div>
                            <label style={{ ...lbl, marginBottom: 4 }}>New time</label>
                            <select value={selStartMin} onChange={e => setSelStartMin(Number(e.target.value))} style={inp}>
                              {slots.map(m => <option key={m} value={m}>{minToHHMM(m)}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={{ ...lbl, marginBottom: 4 }}>Barber</label>
                            <select value={selBarberId} onChange={e => setSelBarberId(e.target.value)} style={inp}>
                              {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                          </div>
                        </div>
                        {/* Confirm */}
                        <button onClick={() => { setRescheduleOpen(false); handleSave(false) }} disabled={saving} style={{ width: '100%', height: 38, borderRadius: 10, border: '1px solid rgba(130,150,220,.25)', background: 'rgba(130,150,220,.08)', color: 'rgba(130,150,220,.9)', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', fontSize: 12, opacity: saving ? .5 : 1 }}>
                          {saving ? 'Saving…' : 'Confirm reschedule'}
                        </button>
                      </div>
                    )
                  })()}
                </div>
              )}
              {!isNew && (
                <div>
                  <label style={lbl}>Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value)} style={inp}>
                    {['booked','arrived','done','noshow'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
              <div style={{ gridColumn: !isNew ? '2 / 3' : '1 / -1' }}>
                <label style={lbl}>Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes…" rows={2}
                  style={{ ...inp, height: 'auto', padding: '10px 12px', resize: 'vertical' as const, lineHeight: 1.5 }} />
              </div>
              {!isNew && (existingEvent?._raw?.created_at || existingEvent?._raw?.source) && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16, paddingTop: 2, flexWrap: 'wrap' }}>
                  {existingEvent?._raw?.created_at && (
                    <div>
                      <span style={{ fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,.35)' }}>Created</span>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', marginTop: 2 }}>
                        {new Date(existingEvent._raw.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, {new Date(existingEvent._raw.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )}
                  <div>
                    <span style={{ fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,.35)' }}>Booked by</span>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', marginTop: 2 }}>
                      {(() => {
                        const cb = existingEvent?._raw?.created_by
                        const src = existingEvent?._raw?.source
                        if (cb?.name && cb?.role) {
                          const roleLabel = cb.role === 'owner' ? 'Owner' : cb.role === 'admin' ? 'Admin' : cb.role === 'barber' ? 'Barber' : cb.role === 'client' ? 'Client' : cb.role
                          return `${cb.name} (${roleLabel})`
                        }
                        if (src === 'website') return 'Client (online)'
                        if (src === 'square') return 'Square'
                        return 'Staff (CRM)'
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Services — collapsible checkbox list grouped by type */}
            {(() => {
              const mainSvcs = barberServices.filter(s => s.service_type !== 'addon')
              const addonSvcs = barberServices.filter(s => s.service_type === 'addon')
              const totalPrice = selectedSvcs.reduce((sum, s) => sum + (s.price ? Number(String(s.price).replace(/[^\d.]/g, '')) : 0), 0)
              const totalDur = selectedSvcs.reduce((sum, s) => sum + (s.durationMin || 30), 0)

              function toggleService(id: string) {
                setServiceIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
              }

              const rowStyle = (checked: boolean): React.CSSProperties => ({
                display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 10,
                cursor: 'pointer', transition: 'background .15s',
                background: checked ? 'rgba(130,150,220,.08)' : 'transparent',
              })

              const checkboxStyle = (checked: boolean): React.CSSProperties => ({
                width: 18, height: 18, borderRadius: 6, flexShrink: 0,
                border: checked ? '1.5px solid rgba(130,150,220,.6)' : '1.5px solid rgba(255,255,255,.15)',
                background: checked ? 'rgba(130,150,220,.20)' : 'rgba(255,255,255,.04)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s',
              })

              const dividerStyle: React.CSSProperties = {
                fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.30)',
                padding: '6px 10px 2px', display: 'flex', alignItems: 'center', gap: 8,
              }
              const lineStyle: React.CSSProperties = { flex: 1, height: 1, background: 'rgba(255,255,255,.08)' }

              function ServiceRow({ s }: { s: Service }) {
                const checked = serviceIds.includes(s.id)
                const bp = s.price ? Number(String(s.price).replace(/[^\d.]/g, '')) : 0
                return (
                  <div style={rowStyle(checked)} onClick={() => toggleService(s.id)}
                    onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'rgba(255,255,255,.03)' }}
                    onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent' }}>
                    <div style={checkboxStyle(checked)}>
                      {checked && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(130,150,220,.9)" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: checked ? 700 : 500, color: checked ? '#e8e8ed' : 'rgba(255,255,255,.65)' }}>{s.name}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', whiteSpace: 'nowrap' }}>{s.durationMin || 30}min</span>
                    {bp > 0 && <span style={{ fontSize: 11, color: 'rgba(130,220,170,.55)', fontWeight: 600, whiteSpace: 'nowrap' }}>${bp.toFixed(2)}</span>}
                  </div>
                )
              }

              return (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label style={lbl}>Services</label>
                    <button type="button" onClick={() => setServicesOpen(!servicesOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'rgba(130,150,220,.7)', fontWeight: 600, padding: '2px 6px' }}>
                      {servicesOpen ? 'Hide' : 'Edit'}
                    </button>
                  </div>
                  {/* Collapsed: show selected services summary */}
                  {!servicesOpen && serviceIds.length > 0 && (
                    <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', padding: '8px 12px' }}>
                      {selectedSvcs.map(s => {
                        const bp = s.price ? Number(String(s.price).replace(/[^\d.]/g, '')) : 0
                        return (
                          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 13 }}>
                            <span style={{ color: 'rgba(130,150,220,.7)', fontSize: 10 }}>{'\u2713'}</span>
                            <span style={{ flex: 1, fontWeight: 600, color: '#e8e8ed' }}>{s.name}</span>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>{s.durationMin || 30}min</span>
                            {bp > 0 && <span style={{ fontSize: 11, color: 'rgba(130,220,170,.55)', fontWeight: 600 }}>${bp.toFixed(2)}</span>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {!servicesOpen && serviceIds.length === 0 && (
                    <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', padding: '10px 12px', fontSize: 12, color: 'rgba(255,255,255,.35)', cursor: 'pointer' }} onClick={() => setServicesOpen(true)}>
                      No services selected — tap Edit to add
                    </div>
                  )}
                  {/* Expanded: full checkbox list */}
                  {servicesOpen && (
                    <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', overflow: 'hidden', padding: '4px 0' }}>
                      {mainSvcs.length > 0 && (
                        <>
                          {addonSvcs.length > 0 && <div style={dividerStyle}><span style={lineStyle} /><span>Main</span><span style={lineStyle} /></div>}
                          {mainSvcs.map(s => <ServiceRow key={s.id} s={s} />)}
                        </>
                      )}
                      {addonSvcs.length > 0 && (
                        <>
                          <div style={dividerStyle}><span style={lineStyle} /><span>Add-ons</span><span style={lineStyle} /></div>
                          {addonSvcs.map(s => <ServiceRow key={s.id} s={s} />)}
                        </>
                      )}
                      {barberServices.length === 0 && (
                        <div style={{ padding: '12px 14px', fontSize: 12, color: 'rgba(255,255,255,.35)' }}>No services available for this team member</div>
                      )}
                    </div>
                  )}
                  {serviceIds.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,.50)' }}>
                      <span>{totalDur}min {'\u2192'} {minToHHMM(selStartMin + totalDur)}</span>
                      {totalPrice > 0 && <span style={{ color: 'rgba(130,220,170,.6)', fontWeight: 700 }}>${totalPrice.toFixed(2)}</span>}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Client photo — clean, no decoration */}
            {(fetchedPhotoUrl || existingEvent?.photoUrl) && (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                  <img
                    src={fetchedPhotoUrl || existingEvent?.photoUrl || ''}
                    alt="reference"
                    style={{ width: 110, height: 110, borderRadius: 12, objectFit: 'cover', cursor: 'zoom-in', border: '1px solid rgba(255,255,255,.12)', display: 'block' }}
                    onClick={() => setLightbox(true)}
                    onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none' }}
                  />
                </div>
                {lightbox && (
                  <div onClick={() => setLightbox(false)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, cursor: 'zoom-out', backdropFilter: 'blur(8px)' }}>
                    <img src={fetchedPhotoUrl || existingEvent?.photoUrl || ''} alt="reference"
                      style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 16, objectFit: 'contain', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }} />
                    <button onClick={() => setLightbox(false)}
                      style={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderRadius: 999, border: '1px solid rgba(255,255,255,.20)', background: 'rgba(0,0,0,.50)', color: '#fff', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>
                )}
              </>
            )}

            {/* Upload reference photo */}
            <PhotoUpload value={photoUrl} onChange={(url) => setPhotoUrl(url)} />

            {/* Payment — based on permissions */}
            {(isOwnerOrAdmin || canCheckout) && existingEvent && (
              <PaymentPanel ev={existingEvent} services={services} onPayment={onPayment} allEvents={allEvents} barberId={barberId} terminalEnabled={terminalEnabled && canTerminal} />
            )}


            {/* Overlap warning */}
            {overlapWarning && (
              <div style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,180,60,.20)', background: 'rgba(255,180,60,.05)', marginBottom: 4 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,200,100,.8)', marginBottom: 8, lineHeight: 1.4 }}>{overlapWarning}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setOverlapWarning(null)} style={{ flex: 1, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit', fontSize: 12 }}>Cancel</button>
                  <button onClick={() => handleSave(true)} style={{ flex: 1, height: 36, borderRadius: 10, border: '1px solid rgba(255,180,60,.30)', background: 'rgba(255,180,60,.08)', color: 'rgba(255,200,100,.9)', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', fontSize: 12 }}>Save anyway</button>
                </div>
              </div>
            )}

            {/* Footer */}
            {deleteConfirm ? (
              <div style={{ paddingTop: 8, borderTop: '1px solid rgba(255,107,107,.12)' }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.65)', marginBottom: 10, textAlign: 'center' }}>Cancel this appointment?</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setDeleteConfirm(false)} style={{ flex: 1, height: 40, borderRadius: 10, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit', fontSize: 13 }}>Back</button>
                  <button onClick={() => { setDeleteConfirm(false); handleSave(true, 'cancelled') }} style={{ flex: 1, height: 40, borderRadius: 10, border: '1px solid rgba(255,107,107,.30)', background: 'rgba(255,107,107,.08)', color: 'rgba(255,107,107,.8)', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', fontSize: 13 }}>Cancel appointment</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap' }}>
                {!isNew && (
                  <button onClick={() => setDeleteConfirm(true)} style={{ height: 36, padding: '0 14px', borderRadius: 10, border: '1px solid rgba(255,107,107,.20)', background: 'rgba(255,107,107,.04)', color: 'rgba(255,107,107,.6)', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', fontSize: 12 }}>Cancel appt</button>
                )}
                <div style={{ flex: 1 }} />
                <button onClick={onClose} style={{ height: 36, padding: '0 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit', fontSize: 12 }}>Close</button>
                <button onClick={() => handleSave()} disabled={saving} style={{ height: 36, padding: '0 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,.18)', background: 'rgba(255,255,255,.08)', color: '#e8e8ed', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', fontSize: 12, opacity: saving ? .5 : 1 }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
