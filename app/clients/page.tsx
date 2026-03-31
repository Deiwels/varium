'use client'
import Shell from '@/components/Shell'
import { useEffect, useState, useCallback } from 'react'

import { apiFetch } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Client {
  id: string; name: string; phone?: string; email?: string; notes?: string
  status?: string; client_status?: string; tags?: string[]; preferred_barber?: string; barber?: string
  last_visit?: string; visits?: number; spend?: number; no_shows?: number
  bookings?: Booking[]; photos?: string[]
}
interface Booking {
  id: string; service_name?: string; service?: string; barber_name?: string; barber?: string
  start_at?: string; date?: string; paid?: boolean; is_paid?: boolean; status?: string
  reference_photo_url?: string; client_photo_url?: string
}
interface Barber { id: string; name: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (iso: string) => { try { return new Date(iso.includes('T') ? iso : iso+'T00:00:00').toLocaleDateString([], { month:'short', day:'numeric', year:'numeric' }) } catch { return iso } }
const initials = (name: string) => { const p=(name||'').split(' '); return ((p[0]?.[0]||'')+(p[1]?.[0]||'')).toUpperCase() || '?' }
const STATUS_STYLE: Record<string, React.CSSProperties> = {
  vip:     { borderColor:'rgba(255,207,63,.45)', background:'rgba(255,207,63,.10)', color:'rgba(220,190,130,.5)' },
  active:  { borderColor:'rgba(143,240,177,.40)', background:'rgba(143,240,177,.10)', color:'rgba(130,220,170,.5)' },
  new:     { borderColor:'rgba(10,132,255,.45)', background:'rgba(10,132,255,.10)', color:'rgba(130,150,220,.6)' },
  risk:    { borderColor:'rgba(255,107,107,.40)', background:'rgba(255,107,107,.10)', color:'rgba(220,130,160,.5)' },
  at_risk: { borderColor:'rgba(255,107,107,.40)', background:'rgba(255,107,107,.10)', color:'rgba(220,130,160,.5)' },
}
const STATUS_LABELS: Record<string,string> = { vip:'VIP', active:'Active', new:'New', risk:'At risk', at_risk:'At risk' }

// Phone masking — shows +1 ***-***-1234, full number on click for owner/admin
function maskPhone(phone: string): string {
  if (!phone) return '—'
  const digits = phone.replace(/\D/g, '')
  if (digits.length >= 10) {
    const last4 = digits.slice(-4)
    const country = digits.length === 11 ? `+${digits[0]} ` : ''
    return `${country}***-***-${last4}`
  }
  return phone.slice(0, 2) + '***' + phone.slice(-2)
}

function Chip({ status }: { status: string }) {
  const s = STATUS_STYLE[status] || {}
  return <span style={{ fontSize:9, letterSpacing:'.08em', textTransform:'uppercase', padding:'4px 8px', borderRadius:999, border:'1px solid rgba(255,255,255,.12)', background:'rgba(0,0,0,.12)', color:'rgba(255,255,255,.70)', display:'inline-flex', alignItems:'center', gap:4, whiteSpace:'nowrap', ...s }}>
    <span style={{ width:5, height:5, borderRadius:999, background:'currentColor', flexShrink:0 }} />
    {STATUS_LABELS[status] || status || '—'}
  </span>
}


// ─── AddClientModal ───────────────────────────────────────────────────────────
function AddClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Client) => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    if (!name.trim()) { setErr('Name is required'); return }
    setSaving(true); setErr('')
    try {
      const c = await apiFetch('/api/clients', { method: 'POST', body: JSON.stringify({ name: name.trim(), phone: phone.trim(), email: email.trim(), status: 'new', tags: ['first-time'] }) })
      onCreated(c)
    } catch (e: any) { setErr(e.message) }
    setSaving(false)
  }

  const inp: React.CSSProperties = { width:'100%', height:42, borderRadius:12, border:'1px solid rgba(255,255,255,.12)', background:'rgba(0,0,0,.22)', color:'#fff', padding:'0 12px', outline:'none', fontSize:13, fontFamily:'inherit' }
  const lbl: React.CSSProperties = { fontSize:10, letterSpacing:'.10em', textTransform:'uppercase', color:'rgba(255,255,255,.45)', display:'block', marginBottom:5 }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, backdropFilter:'blur(10px)' }}
      onClick={e => { if (e.target===e.currentTarget) onClose() }}>
      <div style={{ width:'min(420px,95vw)', borderRadius:20, border:'1px solid rgba(255,255,255,.12)', background:'linear-gradient(180deg,rgba(20,20,30,.92),rgba(10,10,20,.90))', backdropFilter:'blur(24px)', padding:20, color:'#e8e8ed', fontFamily:'Inter,sans-serif', boxShadow:'0 24px 80px rgba(0,0,0,.7)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, paddingBottom:12, borderBottom:'1px solid rgba(255,255,255,.08)' }}>
          <div style={{ fontFamily:'"Inter",sans-serif', letterSpacing:'.16em', textTransform:'uppercase', fontSize:13 }}>Add client</div>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:8, border:'1px solid rgba(255,255,255,.12)', background:'rgba(255,255,255,.05)', color:'#fff', cursor:'pointer', fontSize:15 }}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div><label style={lbl}>Full name *</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Client name" style={inp} autoFocus /></div>
          <div><label style={lbl}>Phone</label><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+1 (___) ___-____" style={inp} type="tel" /></div>
          <div><label style={lbl}>Email</label><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="optional" style={inp} type="email" /></div>
          {err && <div style={{ fontSize:12, color:'rgba(220,130,160,.5)', padding:'8px 12px', borderRadius:10, border:'1px solid rgba(255,107,107,.30)', background:'rgba(255,107,107,.08)' }}>{err}</div>}
          <button onClick={save} disabled={saving} style={{ height:44, borderRadius:12, border:'1px solid rgba(10,132,255,.65)', background:'rgba(10,132,255,.14)', color:'rgba(130,150,220,.6)', cursor:'pointer', fontWeight:900, fontSize:13, fontFamily:'inherit' }}>
            {saving ? 'Saving…' : 'Add client'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ClientProfile ────────────────────────────────────────────────────────────
function ClientProfile({ clientId, clients, onUpdate }: { clientId: string; clients: Client[]; onUpdate: (c: Client) => void }) {
  const [detailed, setDetailed] = useState<Client | null>(null)
  const [loading, setLoading] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notes, setNotes] = useState('')
  const [revealedPhones, setRevealedPhones] = useState<Record<string, string>>({})
  const [phoneLoading, setPhoneLoading] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [userRole] = useState(() => {
    try { return JSON.parse(localStorage.getItem('VURIUMBOOK_USER') || '{}').role || '' } catch { return '' }
  })
  const isOwner = userRole === 'owner'
  const isAdmin = userRole === 'admin'
  const isOwnerOrAdmin = isOwner || isAdmin

  function revealPhone(cid: string, phone: string) {
    setRevealedPhones(prev => ({ ...prev, [cid]: phone }))
    if (isAdmin) { setTimeout(() => { setRevealedPhones(prev => { const n = { ...prev }; delete n[cid]; return n }) }, 15000) }
  }
  async function requestPhone(cid: string) {
    setPhoneLoading(cid); setPhoneError('')
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
      })
      await new Promise(r => setTimeout(r, 3000))
      const { latitude: lat, longitude: lng } = pos.coords
      const data = await apiFetch('/api/clients/request-phone', { method: 'POST', body: JSON.stringify({ client_id: cid, lat, lng }) })
      if (data.phone) { revealPhone(cid, data.phone) }
    } catch (err: any) {
      if (err?.code === 1) setPhoneError('Дозвольте GPS в налаштуваннях.')
      else setPhoneError(err?.message || 'Помилка')
    }
    setPhoneLoading(null)
  }

  useEffect(() => {
    const cached = clients.find(c => c.id === clientId)
    if (cached) { setDetailed(cached); setNotes(cached.notes || '') }
    setLoading(true)
    apiFetch(`/api/clients/${encodeURIComponent(clientId)}`).then(d => {
      setDetailed(d); setNotes(d.notes || ''); onUpdate(d); setLoading(false)
    }).catch(() => setLoading(false))
  }, [clientId])

  async function patch(body: any) {
    const updated = await apiFetch(`/api/clients/${encodeURIComponent(clientId)}`, { method:'PATCH', body:JSON.stringify(body) })
    setDetailed(prev => ({ ...prev, ...body }))
    onUpdate({ ...(detailed||{}), ...body } as Client)
    return updated
  }

  async function saveNotes() {
    setNotesSaving(true)
    try { await patch({ notes }) } catch {}
    setNotesSaving(false)
  }

  function compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          const MAX = 900
          let w = img.width, h = img.height
          if (w > MAX || h > MAX) {
            const ratio = Math.min(MAX / w, MAX / h)
            w = Math.round(w * ratio); h = Math.round(h * ratio)
          }
          const canvas = document.createElement('canvas')
          canvas.width = w; canvas.height = h
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0, w, h)
          resolve(canvas.toDataURL('image/jpeg', 0.8))
        }
        img.onerror = reject
        img.src = reader.result as string
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    try {
      const dataUrl = await compressImage(file)
      const photos = [...(detailed?.photos || []), dataUrl]
      await patch({ photos })
      setDetailed(prev => prev ? { ...prev, photos } : prev)
    } catch (err) { console.error('Photo upload failed', err) }
    setPhotoUploading(false)
    e.target.value = ''
  }

  async function addTag(tag: string) {
    if (!tag.trim()) return
    const newTags = [...new Set([tag.trim().toLowerCase(), ...(detailed?.tags||[])])]
    await patch({ tags: newTags })
    setTagInput('')
  }

  async function removeTag(tag: string) {
    await patch({ tags: (detailed?.tags||[]).filter(t => t !== tag) })
  }

  if (!detailed && loading) return <div style={{ padding:32, textAlign:'center', color:'rgba(255,255,255,.35)', fontSize:12 }}>Loading…</div>
  if (!detailed) return null

  const c = detailed
  const visits = c.visits || (c.bookings?.length || 0)
  const spend = c.spend || (c.bookings||[]).reduce((s,b) => s + Number((b as any).service_price||(b as any).price||0), 0)
  const noShows = c.no_shows || (c.bookings||[]).filter(b => b.status==='noshow').length
  const lastVisit = c.last_visit || (c.bookings?.[0]?.start_at||'')
  const barber = c.preferred_barber || c.barber || '—'

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'9px 12px', borderRadius:12, border:'1px solid rgba(255,255,255,.08)', background:'rgba(0,0,0,.14)' }}>
      <span style={{ fontSize:11, letterSpacing:'.10em', textTransform:'uppercase', color:'rgba(255,255,255,.45)' }}>{label}</span>
      <span style={{ fontWeight:700, fontSize:13 }}>{value}</span>
    </div>
  )

  return (
    <div style={{ padding:14, display:'flex', flexDirection:'column', gap:10 }}>
      {/* Top */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:16, border:'1px solid rgba(255,255,255,.10)', background:'rgba(0,0,0,.16)' }}>
        <div style={{ width:48, height:48, borderRadius:16, border:'1px solid rgba(255,255,255,.12)', background:'rgba(255,255,255,.05)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:16, flexShrink:0 }}>
          {initials(c.name)}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:900, fontSize:15 }}>{c.name}</div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
            <Chip status={c.client_status||c.status||'new'} />
            <span style={{ fontSize:11, color:'rgba(255,255,255,.40)' }}>{barber}</span>
          </div>
        </div>
        {isOwner && (
          <button onClick={async () => {
            if (!window.confirm(`Delete client "${c.name}"? This cannot be undone.`)) return
            try {
              await apiFetch(`/api/clients/${encodeURIComponent(clientId)}`, { method: 'DELETE' })
              window.location.reload()
            } catch (e: any) { alert(e?.message || 'Delete failed') }
          }} style={{ width:32, height:32, borderRadius:10, border:'1px solid rgba(255,107,107,.30)', background:'rgba(255,107,107,.06)', color:'rgba(220,130,160,.5)', cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }} title="Delete client">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
        {[{v:visits, l:'Visits'},{v:'$'+Number(spend).toFixed(0), l:'Spend'},{v:noShows, l:'No-shows'}].map(k => (
          <div key={k.l} style={{ padding:'10px 12px', borderRadius:14, border:'1px solid rgba(255,255,255,.10)', background:'rgba(0,0,0,.14)' }}>
            <div style={{ fontWeight:900, fontSize:18 }}>{k.v}</div>
            <div style={{ fontSize:10, letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(255,255,255,.45)', marginTop:4 }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Info */}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {c.phone && row('Phone',
          isOwner
            ? (revealedPhones[c.id]
              ? <a href={`tel:${revealedPhones[c.id]}`} style={{ color:'rgba(130,150,220,.6)', textDecoration:'none' }}>{revealedPhones[c.id]}</a>
              : <span onClick={() => revealPhone(c.id, c.phone!)} style={{ color:'rgba(10,132,255,.8)', cursor:'pointer', fontSize:12 }}>{maskPhone(c.phone)} · tap to reveal</span>)
            : isAdmin
              ? (revealedPhones[c.id]
                ? <span style={{ color:'rgba(130,220,170,.8)' }}>{revealedPhones[c.id]} <span style={{ fontSize:9, color:'rgba(255,255,255,.30)' }}>auto-hide 15s</span></span>
                : phoneLoading === c.id
                  ? <span style={{ color:'rgba(255,255,255,.40)', fontSize:11 }}>Verifying location...</span>
                  : <button onClick={() => requestPhone(c.id)} style={{ height:28, padding:'0 10px', borderRadius:999, border:'1px solid rgba(10,132,255,.45)', background:'rgba(10,132,255,.12)', color:'rgba(130,150,220,.6)', cursor:'pointer', fontWeight:700, fontSize:10, fontFamily:'inherit' }}>
                      {maskPhone(c.phone)} · Request phone
                    </button>)
              : <span style={{ color:'rgba(255,255,255,.55)' }}>{maskPhone(c.phone)}</span>
        )}
        {phoneError && <div style={{ fontSize:11, color:'#ff6b6b', padding:'4px 0' }}>{phoneError}</div>}
        {c.email && row('Email', <a href={`mailto:${c.email}`} style={{ color:'rgba(130,150,220,.6)', textDecoration:'none', overflow:'hidden', textOverflow:'ellipsis', maxWidth:160, display:'block' }}>{c.email}</a>)}
        {lastVisit && row('Last visit', fmtDate(lastVisit))}
      </div>

      {/* Status */}
      <div>
        <div style={{ fontSize:10, letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(255,255,255,.40)', marginBottom:8 }}>Status</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' as const }}>
          {(['vip','active','new','risk'] as const).map(s => (
            <button key={s} onClick={() => patch({ status:s })}
              style={{ height:32, padding:'0 14px', borderRadius:999, border:`1px solid ${c.status===s ? (STATUS_STYLE[s]?.borderColor||'rgba(10,132,255,.55)') : 'rgba(255,255,255,.12)'}`, background:c.status===s ? (STATUS_STYLE[s]?.background||'rgba(10,132,255,.12)') : 'rgba(255,255,255,.04)', color:c.status===s ? (STATUS_STYLE[s]?.color||'#fff') : 'rgba(255,255,255,.65)', cursor:'pointer', fontWeight:700, fontSize:11, fontFamily:'inherit' }}>
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div>
        <div style={{ fontSize:10, letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(255,255,255,.40)', marginBottom:8 }}>Tags</div>
        <div style={{ display:'flex', flexWrap:'wrap' as const, gap:6, marginBottom:8 }}>
          {(c.tags||[]).map(t => (
            <span key={t} onClick={() => removeTag(t)}
              style={{ fontSize:10, letterSpacing:'.08em', textTransform:'uppercase', padding:'4px 10px', borderRadius:999, border:'1px solid rgba(255,255,255,.12)', background:'rgba(255,255,255,.04)', color:'rgba(255,255,255,.65)', cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
              {t} <span style={{ opacity:.55 }}>✕</span>
            </span>
          ))}
        </div>
        <input value={tagInput} onChange={e=>setTagInput(e.target.value)}
          onKeyDown={e => { if (e.key==='Enter') { addTag(tagInput); (e.target as HTMLInputElement).value=''; setTagInput('') } }}
          placeholder="Type tag + Enter to add…"
          style={{ height:34, width:'100%', borderRadius:10, border:'1px solid rgba(255,255,255,.10)', background:'rgba(0,0,0,.22)', color:'#fff', padding:'0 10px', outline:'none', fontSize:12, fontFamily:'inherit' }} />
      </div>

      {/* Notes */}
      <div>
        <div style={{ fontSize:10, letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(255,255,255,.40)', marginBottom:8 }}>Notes</div>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}
          style={{ width:'100%', borderRadius:12, border:'1px solid rgba(255,255,255,.12)', background:'rgba(0,0,0,.22)', color:'#fff', padding:'10px 12px', outline:'none', fontSize:13, lineHeight:1.5, resize:'vertical' as const, fontFamily:'inherit' }} />
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <button onClick={saveNotes} disabled={notesSaving}
            style={{ height:34, padding:'0 16px', borderRadius:999, border:'1px solid rgba(10,132,255,.55)', background:'rgba(10,132,255,.12)', color:'rgba(130,150,220,.6)', cursor:'pointer', fontWeight:900, fontSize:12, fontFamily:'inherit' }}>
            {notesSaving ? 'Saving…' : 'Save notes'}
          </button>
          {c.phone && <>
            <a href={`tel:${c.phone}`} style={{ height:34, padding:'0 12px', borderRadius:999, border:'1px solid rgba(255,255,255,.12)', background:'rgba(255,255,255,.05)', color:'#fff', cursor:'pointer', fontWeight:700, fontSize:12, fontFamily:'inherit', display:'flex', alignItems:'center', textDecoration:'none' }}>📞 Call</a>
            <a href={`sms:${c.phone}`} style={{ height:34, padding:'0 12px', borderRadius:999, border:'1px solid rgba(255,255,255,.12)', background:'rgba(255,255,255,.05)', color:'#fff', cursor:'pointer', fontWeight:700, fontSize:12, fontFamily:'inherit', display:'flex', alignItems:'center', textDecoration:'none' }}>✉ SMS</a>
          </>}
        </div>
      </div>

      {/* Photos gallery */}
      {(() => {
        const bookingPhotos = (c.bookings || [])
          .map(b => b.reference_photo_url || b.client_photo_url)
          .filter(Boolean) as string[]
        const clientPhotos = c.photos || []
        const allPhotos = [...clientPhotos, ...bookingPhotos]
        return (
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <div style={{ fontSize:10, letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(255,255,255,.40)' }}>Photos ({allPhotos.length})</div>
              <label style={{ height:28, padding:'0 10px', borderRadius:999, border:'1px solid rgba(10,132,255,.45)', background:'rgba(10,132,255,.10)', color:'rgba(130,150,220,.6)', cursor:'pointer', fontWeight:700, fontSize:10, fontFamily:'inherit', display:'flex', alignItems:'center', gap:4 }}>
                {photoUploading ? 'Uploading…' : '📷 Add photo'}
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} style={{ display:'none' }} disabled={photoUploading} />
              </label>
            </div>
            {allPhotos.length > 0 ? (
              <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4 }}>
                {allPhotos.map((url, i) => (
                  <img key={i} src={url} alt="" onClick={() => setLightboxUrl(url)}
                    style={{ width:56, height:56, borderRadius:10, objectFit:'cover', border:'1px solid rgba(255,255,255,.12)', flexShrink:0, cursor:'pointer', background:'rgba(255,255,255,.04)' }} />
                ))}
              </div>
            ) : (
              <div style={{ fontSize:11, color:'rgba(255,255,255,.25)', padding:'8px 0' }}>No photos yet</div>
            )}
          </div>
        )
      })()}

      {/* Photo lightbox */}
      {lightboxUrl && (
        <div onClick={() => setLightboxUrl(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', backdropFilter:'blur(12px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, cursor:'pointer' }}>
          <img src={lightboxUrl} alt="" style={{ maxWidth:'90vw', maxHeight:'85vh', borderRadius:14, border:'1px solid rgba(255,255,255,.15)', objectFit:'contain' }} />
        </div>
      )}

      {/* Visit history timeline */}
      {(c.bookings||[]).length > 0 && (
        <div>
          <div style={{ fontSize:10, letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(255,255,255,.40)', marginBottom:8 }}>Visit history ({(c.bookings||[]).length})</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {(c.bookings||[]).map((b,i) => {
              const photo = b.reference_photo_url || b.client_photo_url
              const st = b.status || (b.paid || b.is_paid ? 'completed' : 'pending')
              const statusColors: Record<string, { border: string; bg: string; color: string }> = {
                completed: { border:'rgba(143,240,177,.40)', bg:'rgba(143,240,177,.10)', color:'rgba(130,220,170,.5)' },
                cancelled: { border:'rgba(255,107,107,.40)', bg:'rgba(255,107,107,.10)', color:'rgba(220,130,160,.5)' },
                noshow:    { border:'rgba(255,165,0,.40)',   bg:'rgba(255,165,0,.10)',   color:'#ffe0b2' },
                pending:   { border:'rgba(255,255,255,.12)', bg:'rgba(0,0,0,.12)',       color:'rgba(255,255,255,.55)' },
              }
              const sc = statusColors[st] || statusColors.pending
              return (
                <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'9px 12px', borderRadius:12, border:'1px solid rgba(255,255,255,.07)', background:'rgba(0,0,0,.14)' }}>
                  {/* Timeline dot */}
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', paddingTop:4, flexShrink:0 }}>
                    <div style={{ width:8, height:8, borderRadius:999, background:sc.color, flexShrink:0 }} />
                    {i < (c.bookings||[]).length - 1 && <div style={{ width:1, height:28, background:'rgba(255,255,255,.08)', marginTop:4 }} />}
                  </div>
                  {/* Content */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:6 }}>
                      <span style={{ fontWeight:700, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.service_name||b.service||'Service'}</span>
                      <span style={{ fontSize:9, padding:'3px 7px', borderRadius:999, border:`1px solid ${sc.border}`, background:sc.bg, color:sc.color, letterSpacing:'.06em', textTransform:'uppercase', flexShrink:0 }}>
                        {st === 'noshow' ? 'No-show' : st}
                      </span>
                    </div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,.45)', marginTop:3 }}>
                      {b.barber_name||b.barber||'—'} · {fmtDate(b.start_at||b.date||'')}
                      {b.start_at && (() => { try { return ' · ' + new Date(b.start_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) } catch { return '' } })()}
                    </div>
                  </div>
                  {/* Reference photo thumbnail */}
                  {photo && (
                    <img src={photo} alt="" onClick={() => setLightboxUrl(photo)}
                      style={{ width:38, height:38, borderRadius:8, objectFit:'cover', border:'1px solid rgba(255,255,255,.10)', flexShrink:0, cursor:'pointer' }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string|null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [mobileProfile, setMobileProfile] = useState(false)
  const [q, setQ] = useState('')
  const [filterBarber, setFilterBarber] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterClientStatus, setFilterClientStatus] = useState('')
  const [revealedPhones, setRevealedPhones] = useState<Record<string, string>>({})
  const [phoneLoading, setPhoneLoading] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState('')
  const [userRole] = useState(() => {
    try { return JSON.parse(localStorage.getItem('VURIUMBOOK_USER') || '{}').role || '' } catch { return '' }
  })
  const isOwner = userRole === 'owner'
  const isAdmin = userRole === 'admin'
  const isOwnerOrAdmin = isOwner || isAdmin

  // Auto-hide revealed phones after 15 seconds (admin only)
  function revealPhone(clientId: string, phone: string) {
    setRevealedPhones(prev => ({ ...prev, [clientId]: phone }))
    if (isAdmin) {
      setTimeout(() => { setRevealedPhones(prev => { const n = { ...prev }; delete n[clientId]; return n }) }, 15000)
    }
  }

  // Admin: request phone via GPS
  async function requestPhone(clientId: string) {
    setPhoneLoading(clientId)
    setPhoneError('')
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
      })
      // 3-5 sec delay for security
      await new Promise(r => setTimeout(r, 3000))
      const { latitude: lat, longitude: lng } = pos.coords
      const data = await apiFetch('/api/clients/request-phone', { method: 'POST', body: JSON.stringify({ client_id: clientId, lat, lng }) })
      if (data.phone) {
        revealPhone(clientId, data.phone)
        setPhoneError('')
      }
    } catch (err: any) {
      if (err?.code === 1) setPhoneError('Дозвольте GPS в налаштуваннях браузера.')
      else if (err?.code === 2 || err?.code === 3) setPhoneError('Не вдалось визначити локацію.')
      else setPhoneError(err?.message || 'Помилка доступу')
    }
    setPhoneLoading(null)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cd, bd] = await Promise.all([
        apiFetch('/api/clients'),
        apiFetch('/api/barbers').catch(() => [])
      ])
      setClients(Array.isArray(cd) ? cd : [])
      const bl = Array.isArray(bd) ? bd : (bd?.barbers || [])
      setBarbers(bl.filter((b: Barber) => b.name))
    } catch (e: any) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { load(); const interval = setInterval(load, 30000); return () => clearInterval(interval) }, [load])

  const ql = q.toLowerCase()
  const visible = clients.filter(c => {
    if (filterBarber && (c.preferred_barber||c.barber) !== filterBarber) return false
    if (filterStatus && c.status !== filterStatus) return false
    if (filterClientStatus && (c.client_status || 'new') !== filterClientStatus) return false
    if (ql) {
      const hay = [c.name, c.phone, c.email, c.notes, ...(c.tags||[])].join(' ').toLowerCase()
      if (!hay.includes(ql)) return false
    }
    return true
  })

  function updateClient(updated: Client) {
    setClients(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
  }

  const inp: React.CSSProperties = { height:40, borderRadius:999, border:'1px solid rgba(255,255,255,.12)', background:'rgba(0,0,0,.22)', color:'#fff', padding:'0 14px', outline:'none', fontSize:13, fontFamily:'inherit' }

  return (
    <Shell page="clients">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&family=Julius+Sans+One&display=swap');
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:3px}
        select option{background:#111}
        .cl-row:hover td{background:rgba(255,255,255,.025)!important}
        .cl-row.sel td{background:rgba(10,132,255,.07)!important}
        @media(max-width:768px){
          .page-topbar{padding-left:60px!important;}
          .page-topbar h2{font-size:13px!important;}
          .cl-grid{grid-template-columns:1fr!important;}
          .cl-profile-panel{display:none!important;}
          th:nth-child(3),td:nth-child(3){display:none;}
          th:nth-child(4),td:nth-child(4){display:none;}
          th:nth-child(5),td:nth-child(5){display:none;}
          .cl-filters{gap:6px!important;}
          .cl-filters select,.cl-filters input{height:36px!important;font-size:12px!important;}
        }
      `}</style>
      <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'#000', color:'#e8e8ed', fontFamily:'Inter,system-ui,sans-serif' }}>

        {/* Topbar */}
        <div style={{ padding:'12px 18px', background:'rgba(0,0,0,.80)', backdropFilter:'blur(14px)', borderBottom:'1px solid rgba(255,255,255,.08)', position:'sticky', top:0, zIndex:20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap' as const, marginBottom:10, position:'relative' }}>
            <div style={{ position:'absolute', left:0, right:0, textAlign:'center', pointerEvents:'none' }}>
              <h2 className="page-title" style={{ margin:0, fontFamily:'"Inter",sans-serif', letterSpacing:'.18em', textTransform:'uppercase', fontSize:15 }}>Clients</h2>
              <p style={{ margin:'3px 0 0', color:'rgba(255,255,255,.40)', fontSize:11, letterSpacing:'.08em' }}>
                {visible.length} of {clients.length} clients
              </p>
            </div>
            <div style={{ visibility:'hidden', pointerEvents:'none' }}>
              <div style={{ height:40 }}>placeholder</div>
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' as const, alignItems:'center', position:'relative', zIndex:1 }}>
              <button onClick={() => setShowAdd(true)}
                style={{ height:40, padding:'0 16px', borderRadius:999, border:'1px solid rgba(10,132,255,.75)', background:'rgba(0,0,0,.75)', color:'rgba(130,150,220,.6)', cursor:'pointer', fontWeight:900, fontSize:13, fontFamily:'inherit', boxShadow:'0 0 18px rgba(10,132,255,.25)' }}>
                + Add client
              </button>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' as const, alignItems:'center' }} className="cl-filters">
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name / phone / notes / tags…"
              style={{ ...inp, width:'min(280px,55vw)' }} />
            <select value={filterBarber} onChange={e=>setFilterBarber(e.target.value)} style={inp}>
              <option value="">All barbers</option>
              {barbers.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={inp}>
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginTop:8 }}>
            {[{v:'',l:'All'},{v:'vip',l:'VIP'},{v:'active',l:'Active'},{v:'new',l:'New'},{v:'at_risk',l:'At Risk'}].map(f => (
              <button key={f.v} onClick={() => setFilterClientStatus(f.v)}
                style={{ height:30, padding:'0 12px', borderRadius:999, border:`1px solid ${filterClientStatus===f.v ? 'rgba(10,132,255,.65)' : 'rgba(255,255,255,.12)'}`, background:filterClientStatus===f.v ? 'rgba(10,132,255,.14)' : 'rgba(255,255,255,.04)', color:filterClientStatus===f.v ? 'rgba(130,150,220,.6)' : 'rgba(255,255,255,.55)', cursor:'pointer', fontWeight:700, fontSize:11, fontFamily:'inherit', letterSpacing:'.04em' }}>
                {f.l}
              </button>
            ))}
          </div>
        </div>

        {/* Main grid */}
        <div style={{ flex:1, overflow:'hidden', display:'grid', gridTemplateColumns:'1.6fr .9fr' }} className="cl-grid">

          {/* Table */}
          <div style={{ overflowY:'auto', borderRight:'1px solid rgba(255,255,255,.08)' }}>
            {loading && clients.length===0 ? (
              <div style={{ padding:40, textAlign:'center', color:'rgba(255,255,255,.40)', fontSize:13 }}>Loading…</div>
            ) : visible.length===0 ? (
              <div style={{ padding:40, textAlign:'center', color:'rgba(255,255,255,.40)', fontSize:13 }}>No clients found</div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed' }}>
                <thead>
                  <tr>
                    {[['Client','38%'],['Status','14%'],['Last visit','16%'],['Barber','16%'],['Tags','16%']].map(([h,w]) => (
                      <th key={h} style={{ padding:'10px 14px', fontSize:10, letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(255,255,255,.55)', background:'rgba(0,0,0,.90)', position:'sticky', top:0, textAlign:'left', borderBottom:'1px solid rgba(255,255,255,.08)', width:w }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map(c => {
                    const isSel = c.id === selectedId
                    return (
                      <tr key={c.id} className={`cl-row${isSel?' sel':''}`} onClick={() => { setSelectedId(c.id); setMobileProfile(true) }} style={{ cursor:'pointer' }}>
                        <td style={{ padding:'11px 14px', borderBottom:'1px solid rgba(255,255,255,.06)', overflow:'hidden' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                            <div style={{ width:34, height:34, borderRadius:12, border:'1px solid rgba(255,255,255,.12)', background:'rgba(255,255,255,.05)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:11, flexShrink:0 }}>
                              {initials(c.name)}
                            </div>
                            <div style={{ minWidth:0 }}>
                              <div style={{ fontWeight:900, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</div>
                              <div style={{ fontSize:11, color:'rgba(255,255,255,.45)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:1 }}>
                                {isOwner
                                  ? (revealedPhones[c.id]
                                    ? <span onClick={() => setRevealedPhones(p => { const n={...p}; delete n[c.id]; return n })} style={{ cursor:'pointer' }}>{revealedPhones[c.id]}</span>
                                    : <span onClick={() => revealPhone(c.id, c.phone||'')} style={{ cursor:'pointer', color:'rgba(10,132,255,.8)' }}>{maskPhone(c.phone||'')}</span>)
                                  : isAdmin
                                    ? (revealedPhones[c.id]
                                      ? <span style={{ color:'rgba(130,220,170,.8)' }}>{revealedPhones[c.id]}</span>
                                      : phoneLoading === c.id
                                        ? <span style={{ color:'rgba(255,255,255,.40)', fontSize:10 }}>Verifying...</span>
                                        : <span onClick={() => requestPhone(c.id)} style={{ cursor:'pointer', color:'rgba(10,132,255,.8)', fontSize:10 }}>{maskPhone(c.phone||'')} · request</span>)
                                    : maskPhone(c.phone||'')}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding:'11px 14px', borderBottom:'1px solid rgba(255,255,255,.06)' }}><Chip status={c.client_status||c.status||'new'} /></td>
                        <td style={{ padding:'11px 14px', borderBottom:'1px solid rgba(255,255,255,.06)', fontSize:12, color:'rgba(255,255,255,.55)' }}>{c.last_visit ? fmtDate(c.last_visit) : '—'}</td>
                        <td style={{ padding:'11px 14px', borderBottom:'1px solid rgba(255,255,255,.06)', fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.preferred_barber||c.barber||'—'}</td>
                        <td style={{ padding:'11px 14px', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
                          <div style={{ display:'flex', gap:4, flexWrap:'wrap' as const }}>
                            {(c.tags||[]).slice(0,2).map(t => <span key={t} style={{ fontSize:9, padding:'3px 7px', borderRadius:999, border:'1px solid rgba(255,255,255,.12)', background:'rgba(255,255,255,.04)', color:'rgba(255,255,255,.60)', letterSpacing:'.06em', textTransform:'uppercase' }}>{t}</span>)}
                            {(c.tags||[]).length>2 && <span style={{ fontSize:9, color:'rgba(255,255,255,.35)' }}>+{(c.tags||[]).length-2}</span>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Profile panel — desktop sidebar */}
          <div className="cl-profile-panel"
            style={{ overflowY:'auto', background:'rgba(0,0,0,.08)' }}>
            {!selectedId ? (
              <div style={{ padding:32, textAlign:'center', color:'rgba(255,255,255,.30)', fontSize:13 }}>Click any client to view profile</div>
            ) : (
              <ClientProfile
                key={selectedId}
                clientId={selectedId}
                clients={clients}
                onUpdate={updateClient}
              />
            )}
          </div>

          {/* Mobile profile modal */}
          {mobileProfile && selectedId && (
            <div style={{ position:'fixed', inset:0, zIndex:300, background:'#000', overflow:'hidden', display:'flex', flexDirection:'column' }}>
              {/* Header */}
              <div style={{ padding:'10px 14px', background:'rgba(0,0,0,.95)', backdropFilter:'blur(12px)', borderBottom:'1px solid rgba(255,255,255,.08)', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                <button onClick={() => setMobileProfile(false)} style={{ height:36, padding:'0 14px', borderRadius:999, border:'1px solid rgba(255,255,255,.12)', background:'rgba(255,255,255,.06)', color:'#fff', cursor:'pointer', fontWeight:700, fontSize:13, fontFamily:'inherit' }}>← Back</button>
                <span style={{ fontSize:12, color:'rgba(255,255,255,.55)', letterSpacing:'.06em' }}>Client profile</span>
              </div>
              {/* Content */}
              <div style={{ flex:1, overflowY:'auto', background:'#000' }}>
                <ClientProfile
                  key={selectedId + '_mobile'}
                  clientId={selectedId}
                  clients={clients}
                  onUpdate={updateClient}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <AddClientModal
          onClose={() => setShowAdd(false)}
          onCreated={c => { setClients(prev => [c, ...prev]); setSelectedId(c.id); setShowAdd(false) }}
        />
      )}
    </Shell>
  )
}
