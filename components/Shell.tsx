'use client'
import { useEffect, useState, useCallback } from 'react'
import { clearAuthCookie, setAuthCookie } from '@/lib/auth-cookie'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import ImageCropper from '@/components/ImageCropper'
import { hasPinSetup, verifyPin, getCredentials, getPinUsername } from '@/lib/pin'

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://vuriumbook-api-431945333485.us-central1.run.app'

interface User {
  uid: string; name: string; username: string; role: string; barber_id?: string; photo?: string; mentor_barber_ids?: string[]
}

const NAV = [
  { id: 'dashboard', href: '/dashboard', label: 'Dashboard',  sub: 'Today overview' },
  { id: 'calendar',  href: '/calendar',  label: 'Calendar',   sub: 'Bookings grid' },
  { id: 'messages',  href: '/messages',  label: 'Messages',   sub: 'Team chat' },
  { id: 'waitlist',  href: '/waitlist',  label: 'Waitlist',   sub: 'Queue & notify' },
  { id: 'portfolio',  href: '/portfolio',  label: 'Portfolio',  sub: 'Work gallery' },
  { id: 'clients',   href: '/clients',   label: 'Clients',    sub: 'Search / notes',      ownerAdmin: true },
  { id: 'payments',  href: '/payments',  label: 'Payments',   sub: 'Square + Terminal',   ownerAdmin: true },
  { id: 'attendance', href: '/attendance', label: 'Attendance', sub: 'Hours & clock',       ownerAdmin: true },
  { id: 'cash',      href: '/cash',      label: 'Cash',       sub: 'Daily register',      ownerAdmin: true },
  { id: 'membership', href: '/membership', label: 'Membership', sub: 'Recurring clients',   ownerAdmin: true },
  { id: 'expenses',  href: '/expenses',  label: 'Expenses',   sub: 'Track costs',         ownerAdmin: true },
  { id: 'payroll',   href: '/payroll',   label: 'Payroll',    sub: 'Commission + tips',   ownerOnly: true },
  { id: 'billing',   href: '/billing',   label: 'Billing',    sub: 'Plan & payments',     ownerOnly: true },
  { id: 'settings',  href: '/settings',  label: 'Settings',   sub: 'Config & sync',       ownerAdmin: true },
] as const

// ─── SVG icons ────────────────────────────────────────────────────────────────
function Icon({ id, color }: { id: string; color: string }) {
  const s = { stroke: color, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
  switch (id) {
    case 'dashboard':
      return <svg width="17" height="17" viewBox="0 0 24 24" {...{}}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" {...s}/>
        <rect x="14" y="3" width="7" height="7" rx="1.5" {...s}/>
        <rect x="3" y="14" width="7" height="7" rx="1.5" {...s}/>
        <rect x="14" y="14" width="7" height="7" rx="1.5" {...s}/>
      </svg>
    case 'calendar':
      return <svg width="17" height="17" viewBox="0 0 24 24" {...{}}>
        <rect x="3" y="4" width="18" height="18" rx="2.5" {...s}/>
        <line x1="16" y1="2" x2="16" y2="6" {...s}/>
        <line x1="8" y1="2" x2="8" y2="6" {...s}/>
        <line x1="3" y1="10" x2="21" y2="10" {...s}/>
        <circle cx="8" cy="15" r="1" fill={color}/>
        <circle cx="12" cy="15" r="1" fill={color}/>
        <circle cx="16" cy="15" r="1" fill={color}/>
      </svg>
    case 'messages':
      return <svg width="17" height="17" viewBox="0 0 24 24" {...{}}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" {...s}/>
      </svg>
    case 'waitlist':
      return <svg width="17" height="17" viewBox="0 0 24 24" {...{}}>
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" {...s}/>
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" {...s}/>
        <line x1="9" y1="12" x2="15" y2="12" {...s}/><line x1="9" y1="16" x2="13" y2="16" {...s}/>
      </svg>
    case 'clients':
      return <svg width="17" height="17" viewBox="0 0 24 24" {...{}}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" {...s}/>
        <circle cx="9" cy="7" r="4" {...s}/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" {...s}/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75" {...s}/>
      </svg>
    case 'payments':
      return <svg width="17" height="17" viewBox="0 0 24 24" {...{}}>
        <rect x="1" y="4" width="22" height="16" rx="2.5" {...s}/>
        <line x1="1" y1="10" x2="23" y2="10" {...s}/>
        <line x1="6" y1="16" x2="9" y2="16" {...s}/>
      </svg>
    case 'attendance':
      return <svg width="17" height="17" viewBox="0 0 24 24" {...{}}>
        <circle cx="12" cy="12" r="10" {...s}/><polyline points="12 6 12 12 16 14" {...s}/>
      </svg>
    case 'membership':
      return <svg width="17" height="17" viewBox="0 0 24 24" {...{}}>
        <polyline points="23 4 23 10 17 10" {...s}/>
        <polyline points="1 20 1 14 7 14" {...s}/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" {...s}/>
      </svg>
    case 'expenses':
      return <svg width="17" height="17" viewBox="0 0 24 24" {...{}}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" {...s}/>
        <polyline points="14 2 14 8 20 8" {...s}/>
        <line x1="9" y1="13" x2="15" y2="13" {...s}/>
        <line x1="12" y1="10" x2="12" y2="16" {...s}/>
      </svg>
    case 'payroll':
      return <svg width="17" height="17" viewBox="0 0 24 24" {...{}}>
        <line x1="12" y1="1" x2="12" y2="23" {...s}/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" {...s}/>
      </svg>
    case 'settings':
      return <svg width="17" height="17" viewBox="0 0 24 24" {...{}}>
        <circle cx="12" cy="12" r="3" {...s}/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" {...s}/>
      </svg>
    default:
      return <svg width="17" height="17" viewBox="0 0 24 24" {...{}}>
        <circle cx="12" cy="12" r="4" {...s}/>
      </svg>
  }
}

// ─── Profile Modal ────────────────────────────────────────────────────────────
function ProfileModal({ user, onClose, onUpdated }: {
  user: User; onClose: () => void; onUpdated: (u: User) => void
}) {
  const [name, setName] = useState(user.name || '')
  const [photo, setPhoto] = useState(user.photo || '')
  const [cropSrc, setCropSrc] = useState('')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<'profile' | 'password' | 'notifications'>('profile')
  const [notifPrefs, setNotifPrefs] = useState({
    push_booking_confirm: true,
    push_reminder_24h: true,
    push_reminder_2h: true,
    push_reschedule: true,
    push_cancel: true,
    push_waitlist: true,
    push_arrived: true,
    push_chat_messages: true,
  })
  // Load notification prefs from user object (comes from /api/auth/me)
  useEffect(() => {
    const stored = localStorage.getItem('VURIUMBOOK_USER')
    if (stored) {
      try {
        const u = JSON.parse(stored)
        if (u?.notification_prefs) setNotifPrefs(prev => ({ ...prev, ...u.notification_prefs }))
      } catch {}
    }
  }, [])

  useEffect(() => {
    if (!user.barber_id || user.photo) return
    const token = localStorage.getItem('VURIUMBOOK_TOKEN') || ''
    fetch(`${API}/api/barbers`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((data: any) => {
        const list: any[] = Array.isArray(data) ? data : (data?.barbers || [])
        const me = list.find(b => String(b.id) === String(user.barber_id))
        if (me?.photo_url) setPhoto(me.photo_url)
      })
      .catch(() => {})
  }, [user.barber_id, user.photo])

  function handlePhoto(file: File | null) {
    if (!file) return
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
        setCropSrc(out)
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  async function saveProfile() {
    setSaving(true); setMsg(''); setErr('')
    try {
      const token = localStorage.getItem('VURIUMBOOK_TOKEN') || ''
      const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      const isBarberRole = user.role === 'barber'
      const photoChanged = photo !== (user.photo || '')

      if (user.barber_id) {
        if (isBarberRole && photoChanged) {
          // Barber photo change → send request for approval, save name only
          await fetch(`${API}/api/barbers/${encodeURIComponent(user.barber_id)}`, {
            method: 'PATCH', headers: h, body: JSON.stringify({ name })
          })
          await fetch(`${API}/api/requests`, {
            method: 'POST', headers: h, body: JSON.stringify({ type: 'photo_change', data: { newPhotoUrl: photo, barberId: user.barber_id, barberName: name } })
          })
          setMsg('Name saved. Photo sent for approval ✓')
        } else {
          // Owner/admin with barber profile — save directly to barber
          await fetch(`${API}/api/barbers/${encodeURIComponent(user.barber_id)}`, {
            method: 'PATCH', headers: h, body: JSON.stringify({ name, photo_url: photo })
          })
          setMsg('Saved ✓')
        }
      }
      // Save name + photo to user record (for owner/admin without barber_id and for chat avatars)
      await fetch(`${API}/api/users/${encodeURIComponent(user.uid)}`, {
        method: 'PATCH', headers: h, body: JSON.stringify({ name, ...(photoChanged ? { photo_url: photo } : {}) })
      })
      if (!user.barber_id && photoChanged) setMsg('Saved ✓')
      const updated = { ...user, name, photo: isBarberRole && photoChanged ? user.photo : photo }
      localStorage.setItem('VURIUMBOOK_USER', JSON.stringify(updated))
      onUpdated(updated)
    } catch (e: any) { setErr(e.message) }
    setSaving(false)
  }

  async function savePassword() {
    if (!currentPw || !newPw) { setErr('Fill both fields'); return }
    if (newPw.length < 4) { setErr('Min 4 characters'); return }
    setSaving(true); setMsg(''); setErr('')
    try {
      const token = localStorage.getItem('VURIUMBOOK_TOKEN') || ''
      const res = await fetch(`${API}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: currentPw, new_password: newPw })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      setCurrentPw(''); setNewPw(''); setMsg('Password updated ✓')
    } catch (e: any) { setErr(e.message) }
    setSaving(false)
  }

  async function saveNotifications() {
    setSaving(true); setMsg(''); setErr('')
    try {
      const token = localStorage.getItem('VURIUMBOOK_TOKEN') || ''
      const res = await fetch(`${API}/api/users/${encodeURIComponent(user.uid)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notification_prefs: notifPrefs })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      // Update local storage so prefs persist
      try {
        const stored = JSON.parse(localStorage.getItem('VURIUMBOOK_USER') || '{}')
        localStorage.setItem('VURIUMBOOK_USER', JSON.stringify({ ...stored, notification_prefs: notifPrefs }))
      } catch {}
      setMsg('Notification preferences saved ✓')
    } catch (e: any) { setErr(e.message) }
    setSaving(false)
  }

  const glassModal: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 200,
    background: 'rgba(0,0,0,.50)',
    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
  }
  const modalBox: React.CSSProperties = {
    width: 'min(420px,100%)', borderRadius: 24,
    border: '1px solid rgba(255,255,255,.10)',
    background: 'rgba(0,0,0,.60)',
    backdropFilter: 'saturate(180%) blur(40px)', WebkitBackdropFilter: 'saturate(180%) blur(40px)',
    color: '#e8e8ed', fontFamily: 'Inter,sans-serif',
    boxShadow: '0 30px 80px rgba(0,0,0,.55), inset 0 0 0 0.5px rgba(255,255,255,.06)',
    overflow: 'hidden', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto'
  }
  const inp: React.CSSProperties = {
    width: '100%', height: 42, borderRadius: 12,
    border: '1px solid rgba(255,255,255,.10)',
    background: 'rgba(255,255,255,.06)',
    color: '#fff', padding: '0 12px', outline: 'none', fontSize: 13, fontFamily: 'inherit'
  }
  const lbl: React.CSSProperties = {
    fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase',
    color: 'rgba(255,255,255,.40)', display: 'block', marginBottom: 6
  }

  return (
    <div style={glassModal} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modalBox}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
          <div style={{ fontFamily: '"Inter",sans-serif', letterSpacing: '.16em', textTransform: 'uppercase', fontSize: 13 }}>My Profile</div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.06)', color: '#fff', cursor: 'pointer', fontSize: 15, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>

        <div style={{ display: 'flex', gap: 6, padding: '12px 18px 0' }}>
          {(['profile', 'password', 'notifications'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setMsg(''); setErr('') }}
              style={{ height: 32, padding: '0 14px', borderRadius: 999, cursor: 'pointer', fontWeight: 900, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'inherit', border: `1px solid ${tab === t ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.08)'}`, background: tab === t ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.03)', color: tab === t ? '#fff' : 'rgba(255,255,255,.45)' }}>
              {t === 'profile' ? 'Profile' : t === 'password' ? 'Password' : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>}
            </button>
          ))}
        </div>

        <div style={{ padding: '16px 18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tab === 'profile' && <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {photo
                ? <img src={photo} alt={name} style={{ width: 68, height: 68, borderRadius: 18, objectFit: 'cover', border: '1px solid rgba(255,255,255,.12)', flexShrink: 0 }} />
                : <div style={{ width: 68, height: 68, borderRadius: 18, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, flexShrink: 0 }}>{(user.name || '?')[0].toUpperCase()}</div>
              }
              <div style={{ flex: 1 }}>
                <label style={lbl}>Photo</label>
                <label style={{ height: 36, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.65)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: 12, fontFamily: 'inherit', gap: 6 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  {photo ? 'Change photo' : 'Upload photo'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handlePhoto(e.target.files?.[0] || null)} />
                </label>
                {photo && <button onClick={() => setPhoto('')} style={{ marginTop: 6, height: 26, padding: '0 10px', borderRadius: 7, border: '1px solid rgba(255,107,107,.25)', background: 'rgba(255,107,107,.06)', color: 'rgba(220,130,160,.5)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>Remove</button>}
              </div>
            </div>
            <div><label style={lbl}>Display name</label><input value={name} onChange={e => setName(e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Username</label><input value={user.username || ''} disabled style={{ ...inp, opacity: .35, cursor: 'not-allowed' }} /></div>
            <div><label style={lbl}>Role</label><input value={user.role || ''} disabled style={{ ...inp, opacity: .35, cursor: 'not-allowed', textTransform: 'capitalize' }} /></div>
            <button onClick={saveProfile} disabled={saving} style={{ height: 42, borderRadius: 12, border: '1px solid rgba(255,255,255,.20)', background: 'rgba(255,255,255,.10)', color: '#fff', cursor: 'pointer', fontWeight: 900, fontSize: 13, fontFamily: 'inherit', opacity: saving ? .5 : 1 }}>
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </>}

          {tab === 'password' && <>
            <div><label style={lbl}>Current password</label><input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="••••••••" style={inp} /></div>
            <div><label style={lbl}>New password</label><input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="min 4 characters" style={inp} /></div>
            <button onClick={savePassword} disabled={saving} style={{ height: 42, borderRadius: 12, border: '1px solid rgba(255,255,255,.20)', background: 'rgba(255,255,255,.10)', color: '#fff', cursor: 'pointer', fontWeight: 900, fontSize: 13, fontFamily: 'inherit', opacity: saving ? .5 : 1 }}>
              {saving ? 'Saving…' : 'Update password'}
            </button>
            <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 14, marginTop: 6 }}>
              <div style={{ fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,107,107,.55)', marginBottom: 8 }}>Danger zone</div>
              <button onClick={async () => {
                if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) return
                if (!confirm('This will permanently delete your account and all data. Type your password to confirm.')) return
                try {
                  const token = localStorage.getItem('VURIUMBOOK_TOKEN') || ''
                  const res = await fetch(`${API}/api/auth/delete-account`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ password: currentPw })
                  })
                  const data = await res.json()
                  if (!res.ok) throw new Error(data.error || 'Failed to delete account')
                  localStorage.removeItem('VURIUMBOOK_TOKEN')
                  localStorage.removeItem('VURIUMBOOK_USER')
                  window.location.href = '/signin'
                } catch (e: any) { setErr(e.message) }
              }} style={{ height: 38, padding: '0 16px', borderRadius: 10, border: '1px solid rgba(255,107,107,.30)', background: 'rgba(255,107,107,.08)', color: 'rgba(220,130,160,.5)', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>
                Delete my account
              </button>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', marginTop: 6 }}>Enter your current password above, then click delete. This cannot be undone.</div>
            </div>
          </>}

          {tab === 'notifications' && <>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.50)', marginBottom: 4 }}>Choose which push notifications you receive in the Element Team app.</div>
            {([
              { key: 'push_booking_confirm', label: 'Booking confirmation', sub: 'When a new appointment is booked' },
              { key: 'push_reschedule', label: 'Reschedule', sub: 'When appointment time changes' },
              { key: 'push_cancel', label: 'Cancellation', sub: 'When appointment is cancelled' },
              { key: 'push_waitlist', label: 'Waitlist', sub: 'When a spot opens up' },
              { key: 'push_arrived', label: 'Client arrived', sub: 'When a client checks in' },
              { key: 'push_chat_messages', label: 'Chat messages', sub: 'New messages in team chat' },
            ] as { key: keyof typeof notifPrefs; label: string; sub: string }[]).map(item => (
              <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8ed' }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>{item.sub}</div>
                </div>
                <button onClick={() => setNotifPrefs(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                  style={{ width: 44, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer', padding: 2, transition: 'background .2s', background: notifPrefs[item.key] ? 'rgba(143,240,177,.35)' : 'rgba(255,255,255,.10)', position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 999, background: notifPrefs[item.key] ? 'rgba(130,220,170,.8)' : 'rgba(255,255,255,.30)', transition: 'transform .2s, background .2s', transform: notifPrefs[item.key] ? 'translateX(18px)' : 'translateX(0)' }} />
                </button>
              </div>
            ))}
            <button onClick={saveNotifications} disabled={saving} style={{ height: 42, borderRadius: 12, border: '1px solid rgba(255,255,255,.20)', background: 'rgba(255,255,255,.10)', color: '#fff', cursor: 'pointer', fontWeight: 900, fontSize: 13, fontFamily: 'inherit', opacity: saving ? .5 : 1, marginTop: 4 }}>
              {saving ? 'Saving…' : 'Save preferences'}
            </button>
          </>}

          {msg && <div style={{ fontSize: 12, color: 'rgba(130,220,170,.5)', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(143,240,177,.22)', background: 'rgba(143,240,177,.06)' }}>{msg}</div>}
          {err && <div style={{ fontSize: 12, color: 'rgba(220,130,160,.5)', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,107,107,.22)', background: 'rgba(255,107,107,.06)' }}>{err}</div>}
        </div>
      </div>
      {cropSrc && <ImageCropper src={cropSrc} onSave={(url) => { setPhoto(url); setCropSrc('') }} onClose={() => setCropSrc('')} shape="circle" />}
    </div>
  )
}

// ─── Shell ────────────────────────────────────────────────────────────────────
export default function Shell({ children, page }: { children: React.ReactNode; page: string }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'noauth'>('loading')
  const [showProfile, setShowProfile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [unreadChat, setUnreadChat] = useState<string | null>(null)
  const [showPinOverlay, setShowPinOverlay] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const pathname = usePathname()

  // Listen for PIN-required events from api.ts
  useEffect(() => {
    const handler = () => { if (hasPinSetup()) setShowPinOverlay(true); else { localStorage.removeItem('VURIUMBOOK_USER'); window.location.href = '/signin' } }
    window.addEventListener('vuriumbook-pin-required', handler)
    return () => window.removeEventListener('vuriumbook-pin-required', handler)
  }, [])

  const handlePinSubmit = useCallback(async (enteredPin: string) => {
    setPinError('')
    setPinLoading(true)
    try {
      const valid = await verifyPin(enteredPin)
      if (!valid) { setPinError('Wrong PIN'); setPinLoading(false); setPinInput(''); return }
      const creds = await getCredentials(enteredPin)
      if (!creds) { setPinError('PIN data corrupted. Please login with password.'); setPinLoading(false); return }
      // Re-login with saved credentials
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: creds.username, password: creds.password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      const token = data.token || data.access_token || ''
      if (token) localStorage.setItem('VURIUMBOOK_TOKEN', token)
      const userData = { ...(data.user || {}) }
      localStorage.setItem('VURIUMBOOK_USER', JSON.stringify(userData))
      setAuthCookie(userData.role + ':' + (userData.uid || ''))
      setUser(userData)
      setShowPinOverlay(false)
      setPinInput('')
    } catch (e: any) {
      setPinError(e.message || 'Login failed. Try password.')
    }
    setPinLoading(false)
  }, [])

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (pinInput.length === 4 && showPinOverlay) handlePinSubmit(pinInput)
  }, [pinInput, showPinOverlay, handlePinSubmit])

  const [swipeHintKey, setSwipeHintKey] = useState(0)

  // Swipe to open/close sidebar — sets flag to block other swipe handlers
  useEffect(() => {
    let startX = 0, startY = 0, isSidebarSwipe = false
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]; if (!t) return
      startX = t.clientX; startY = t.clientY
      // Mark as sidebar swipe if starting from left edge or sidebar is open
      isSidebarSwipe = startX < 40 || sidebarOpen
      // Show swipe hint when touching left edge
      if (startX < 40 && !sidebarOpen) setSwipeHintKey(k => k + 1)
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!isSidebarSwipe) return
      const t = e.touches[0]; if (!t) return
      const dx = t.clientX - startX
      // If swiping horizontally from left edge, prevent other handlers
      if (Math.abs(dx) > 10 && (startX < 40 || sidebarOpen)) {
        document.body.setAttribute('data-sidebar-swiping', '1')
      }
    }
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0]; if (!t) return
      const dx = t.clientX - startX, dy = t.clientY - startY
      document.body.removeAttribute('data-sidebar-swiping')
      if (!isSidebarSwipe) return
      isSidebarSwipe = false
      if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return
      if (dx > 0 && startX < 40) setSidebarOpen(true)
      if (dx < 0 && sidebarOpen) setSidebarOpen(false)
    }
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [sidebarOpen])

  useEffect(() => {
    const token = localStorage.getItem('VURIUMBOOK_TOKEN')
    if (!token) { setStatus('noauth'); return }
    const stored = localStorage.getItem('VURIUMBOOK_USER')
    if (stored) { try { setUser(JSON.parse(stored)); setStatus('ok') } catch { setStatus('ok') } }
    else setStatus('ok')

    fetch(`${API}/api/auth/me`, { credentials: 'include', headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (r.status === 401) {
          localStorage.removeItem('VURIUMBOOK_TOKEN')
          if (hasPinSetup()) { setShowPinOverlay(true); throw new Error('Token expired — PIN required') }
          localStorage.removeItem('VURIUMBOOK_USER')
          window.location.href = '/signin'
          throw new Error('Token expired')
        }
        return r.json()
      })
      .then(async (d: any) => {
        if (!d.user) return
        // Preserve barber_id from localStorage if backend returns empty
        const prevStored = localStorage.getItem('VURIUMBOOK_USER')
        let prev: any = {}
        try { prev = JSON.parse(prevStored || '{}') } catch {}
        const barberId = d.user.barber_id || prev.barber_id || ''
        let userData = { ...d.user, barber_id: barberId }
        if (barberId) {
          try {
            const br = await fetch(`${API}/api/barbers`, {
              credentials: 'include',
              headers: { Authorization: `Bearer ${token}` }
            }).then(r => r.json())
            const list: any[] = Array.isArray(br) ? br : (br?.barbers || [])
            const me = list.find(b => String(b.id) === String(barberId))
            if (me?.photo_url) userData = { ...userData, photo: me.photo_url, name: me.name || userData.name }
          } catch {}
        }
        // For users without barber_id (owner/admin), use photo_url from user record
        if (!userData.photo && userData.photo_url) {
          userData = { ...userData, photo: userData.photo_url }
        }
        setUser(userData)
        localStorage.setItem('VURIUMBOOK_USER', JSON.stringify(userData))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (status === 'noauth') {
      if (hasPinSetup()) setShowPinOverlay(true)
      else window.location.href = '/signin'
    }
  }, [status])

  // Poll for unread messages — check latest message per chat type
  useEffect(() => {
    if (status !== 'ok' || !user) return
    const CHAT_COLORS: Record<string, string> = { general: 'rgba(130,150,220,.6)', barbers: 'rgba(130,150,220,.6)', admins: 'rgba(130,220,170,.5)', students: 'rgba(180,140,220,.6)', requests: 'rgba(220,190,130,.5)', applications: 'rgba(220,130,160,.5)' }
    const chatTypes = ['general', 'barbers', 'admins', 'students']
    const lastSeenKey = 'VB_MSG_LAST_SEEN'
    const lastSeenAppsKey = 'VB_APPS_LAST_SEEN'
    const lastSeenReqKey = 'VB_REQ_LAST_SEEN'
    const isOwnerAdmin = user.role === 'owner' || user.role === 'admin'
    const hdrs = { Authorization: `Bearer ${localStorage.getItem('VURIUMBOOK_TOKEN') || ''}`, 'Content-Type': 'application/json' }

    async function checkUnread() {
      if (pathname === '/messages') { setUnreadChat(null); return }
      const token = localStorage.getItem('VURIUMBOOK_TOKEN') || ''
      if (!token) return
      const lastSeen = localStorage.getItem(lastSeenKey) || ''
      try {
        // Check chat messages
        for (const ct of chatTypes) {
          const res = await fetch(`${API}/api/messages?chatType=${ct}&limit=1`, { credentials: 'include', headers: hdrs })
          if (!res.ok) continue
          const data = await res.json()
          const msgs = data?.messages || []
          if (msgs.length && msgs[msgs.length - 1]?.createdAt > lastSeen && msgs[msgs.length - 1]?.senderId !== user.uid) {
            setUnreadChat(CHAT_COLORS[ct] || 'rgba(130,150,220,.6)')
            return
          }
        }
        // Check new applications (owner/admin only)
        if (isOwnerAdmin) {
          const lastSeenApps = localStorage.getItem(lastSeenAppsKey) || ''
          const appsRes = await fetch(`${API}/api/applications?status=new&limit=1`, { credentials: 'include', headers: hdrs })
          if (appsRes.ok) {
            const appsData = await appsRes.json()
            const apps = appsData?.applications || []
            if (apps.length && apps[0]?.created_at > lastSeenApps) {
              setUnreadChat(CHAT_COLORS.applications)
              return
            }
          }
        }
        // Check pending requests
        if (isOwnerAdmin) {
          const lastSeenReq = localStorage.getItem(lastSeenReqKey) || ''
          const reqRes = await fetch(`${API}/api/requests`, { credentials: 'include', headers: hdrs })
          if (reqRes.ok) {
            const reqData = await reqRes.json()
            const pending = (reqData?.requests || []).filter((r: any) => r.status === 'pending')
            if (pending.length && pending[0]?.createdAt > lastSeenReq) {
              setUnreadChat(CHAT_COLORS.requests)
              return
            }
          }
        }
        setUnreadChat(null)
      } catch { /* ignore */ }
    }

    checkUnread()
    const interval = setInterval(checkUnread, 8000)
    return () => clearInterval(interval)
  }, [status, user, pathname])

  // Mark messages as seen when visiting Messages page
  useEffect(() => {
    if (pathname === '/messages') {
      setUnreadChat(null)
      const now = new Date().toISOString()
      localStorage.setItem('VB_MSG_LAST_SEEN', now)
      localStorage.setItem('VB_APPS_LAST_SEEN', now)
      localStorage.setItem('VB_REQ_LAST_SEEN', now)
    }
  }, [pathname])

  if (status === 'loading' || status === 'noauth') {
    return <div style={{ background: '#000', minHeight: '100vh' }} />
  }

  const role = user?.role || 'barber'
  const isBarber = role === 'barber'
  const isStudent = role === 'student'
  const visibleNav = NAV.filter(item => {
    if ((item as any).ownerOnly && role !== 'owner') return false
    if ((item as any).ownerAdmin && (isBarber || isStudent)) return false
    if ((item as any).barberOnly && !isBarber) return false
    // Student sees ONLY calendar
    if (isStudent && item.id !== 'calendar' && item.id !== 'messages') return false
    return true
  })
  const initials = (n: string) => { const p = (n || '').split(' '); return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() }

  return (
    <>
      {/* PIN Overlay */}
      {showPinOverlay && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.95)', backdropFilter: 'blur(20px)', padding: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>
          <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
            <div style={{ fontFamily: '"Inter", sans-serif', letterSpacing: '.22em', textTransform: 'uppercase', fontSize: 18, marginBottom: 6, color: '#e8e8ed' }}>Element</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.40)', marginBottom: 8 }}>Session expired</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', marginBottom: 28 }}>Enter your PIN to continue as <strong style={{ color: 'rgba(130,150,220,.6)' }}>{user?.name || getPinUsername()}</strong></div>
            {/* PIN dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 24 }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,.20)', background: i < pinInput.length ? 'rgba(130,150,220,.6)' : 'transparent', transition: 'background .15s' }} />
              ))}
            </div>
            {pinError && <div style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(255,107,107,.30)', background: 'rgba(255,107,107,.08)', color: 'rgba(220,130,160,.5)', fontSize: 12, marginBottom: 16 }}>{pinError}</div>}
            {/* Number pad */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, maxWidth: 260, margin: '0 auto' }}>
              {[1,2,3,4,5,6,7,8,9,null,0,'del'].map((n, i) => (
                <button key={i} type="button" disabled={pinLoading}
                  onClick={() => {
                    if (n === 'del') { setPinInput(p => p.slice(0, -1)); setPinError('') }
                    else if (n !== null && pinInput.length < 4) { setPinInput(p => p + n); setPinError('') }
                  }}
                  style={{
                    height: 56, borderRadius: 14, border: 'none',
                    background: n === null ? 'transparent' : 'rgba(255,255,255,.06)',
                    color: n === 'del' ? 'rgba(255,255,255,.40)' : '#e8e8ed',
                    fontSize: n === 'del' ? 14 : 22, fontWeight: 600, cursor: n === null ? 'default' : 'pointer',
                    fontFamily: 'inherit', transition: 'background .1s',
                    visibility: n === null ? 'hidden' : 'visible',
                  }}>
                  {n === 'del' ? '\u232B' : n}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => { setShowPinOverlay(false); localStorage.removeItem('VURIUMBOOK_USER'); clearAuthCookie(); window.location.href = '/signin' }}
              style={{ marginTop: 24, background: 'none', border: 'none', color: 'rgba(255,255,255,.30)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '.06em' }}>
              Login with password
            </button>
          </div>
        </div>
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body{height:100%;background:#000;color:#e8e8ed;font-family:Inter,system-ui,sans-serif;}
        a{color:#fff!important;text-decoration:none!important;}

        .shell{display:flex;flex-direction:column;height:100vh;width:100vw;overflow:hidden;position:relative;background:transparent;}

        /* ── Top Header Bar — Vurium Glass ── */
        .top-bar{
          height:52px;flex:0 0 52px;
          display:flex;align-items:center;justify-content:space-between;
          padding:0 20px;
          border-bottom:1px solid rgba(255,255,255,.05);
          background:rgba(5,5,12,.7);
          position:relative;
          backdrop-filter:saturate(180%) blur(40px);
          -webkit-backdrop-filter:saturate(180%) blur(40px);
          z-index:50;
          box-shadow:0 1px 20px rgba(0,0,0,.3);
        }
        .top-bar-brand{
          display:flex;align-items:center;gap:10px;
        }
        .top-bar-brand img{ width:24px;height:24px;border-radius:6px; }
        .top-bar-brand span{
          font-size:15px;font-weight:600;color:#fff;letter-spacing:-.01em;
        }
        .top-bar-user{
          display:flex;align-items:center;gap:10px;cursor:pointer;
          background:none;border:none;padding:4px 8px 4px 4px;border-radius:10px;
          transition:background .15s;
        }
        .top-bar-user:hover{background:rgba(255,255,255,.06);}

        /* ── Content ── */
        .content{
          flex:1;min-height:0;overflow:auto;background:transparent;
          padding-bottom:74px; /* space for bottom bar */
          position:relative;z-index:1;
        }

        /* ── Bottom Pill Nav Bar — Vurium Cosmic ── */
        .pill-bar{
          position:fixed;bottom:0;left:0;right:0;z-index:60;
          display:flex;align-items:center;justify-content:center;
          padding:12px 16px max(12px, env(safe-area-inset-bottom, 12px));
          background:linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.8) 25%, rgba(1,1,1,.97) 100%);
          pointer-events:none;
        }
        .pill-inner{
          pointer-events:auto;
          display:flex;align-items:center;gap:3px;
          padding:5px 6px;border-radius:20px;
          background:rgba(8,8,14,.75);
          backdrop-filter:saturate(180%) blur(40px);
          -webkit-backdrop-filter:saturate(180%) blur(40px);
          border:1px solid rgba(255,255,255,.08);
          box-shadow:0 4px 30px rgba(0,0,0,.5), inset 0 0.5px 0 rgba(255,255,255,.05);
        }
        .pill-item{
          display:flex;flex-direction:column;align-items:center;gap:3px;
          padding:10px 20px;border-radius:15px;
          cursor:pointer;transition:all .2s ease;
          border:1px solid transparent;
          min-width:58px;
          text-decoration:none!important;
          position:relative;
        }
        .pill-item:hover{
          background:rgba(255,255,255,.04);
        }
        .pill-item.active{
          background:rgba(255,255,255,.07);
          border-color:rgba(255,255,255,.10);
          box-shadow:0 0 16px rgba(255,255,255,.03);
        }
        .pill-item .pill-ico{
          width:22px;height:22px;display:flex;align-items:center;justify-content:center;
          position:relative;
          transition:transform .15s;
        }
        .pill-item.active .pill-ico{transform:scale(1.05);}
        .pill-item .pill-label{
          font-size:10px;font-weight:400;
          color:rgba(255,255,255,.25);
          letter-spacing:.02em;
          transition:color .2s;
        }
        .pill-item.active .pill-label{
          color:rgba(255,255,255,.85);
          font-weight:500;
        }

        @keyframes cosmicPulse {
          0%, 100% { box-shadow: 0 0 0 rgba(130,220,170,0); transform:scale(1); }
          50% { box-shadow: 0 0 12px rgba(130,220,170,.4); transform:scale(1.15); }
        }
        .pill-ico.has-unread {
          animation: cosmicPulse 2.4s ease-in-out infinite;
        }
        .pill-unread-dot{
          position:absolute;top:-2px;right:-4px;
          width:7px;height:7px;border-radius:50%;
          background:rgba(130,220,170,.9);
          box-shadow:0 0 8px rgba(130,220,170,.5);
          border:1.5px solid rgba(10,10,20,.8);
        }

        @media(max-width:480px){
          .pill-item{padding:8px 10px;min-width:50px;}
          .pill-item .pill-label{font-size:9px;}
        }

        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:4px;}
        select option{background:#111;}
      `}</style>

      <div className="shell">
        {/* Stars rendered in layout.tsx as global background */}

        {/* ── Top Header Bar ── */}
        <div className="top-bar">
          <div className="top-bar-brand">
            <img src="/logo.jpg" alt="" />
          </div>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.45)', letterSpacing: '.06em', textTransform: 'uppercase', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>{page}</span>
          <button className="top-bar-user" onClick={() => setShowProfile(true)}>
            {(user as any)?.photo
              ? <img src={(user as any).photo} alt="" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover', border: '1px solid rgba(255,255,255,.12)' }}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              : <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,.10)', border: '1px solid rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                  {initials(user?.name || user?.username || '?')}
                </div>
            }
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>

        {/* ── Content ── */}
        <div className="content">{children}</div>

        {/* ── Bottom Pill Navigation ── */}
        <div className="pill-bar">
          <div className="pill-inner">
            {[
              { id: 'dashboard', href: '/dashboard', label: 'Home' },
              { id: 'calendar', href: '/calendar', label: 'Calendar' },
              { id: 'messages', href: '/messages', label: 'Messages' },
              { id: 'clients', href: '/clients', label: 'Clients' },
              { id: 'settings', href: '/settings', label: 'Settings' },
            ].filter(item => {
              if (isStudent && item.id !== 'calendar' && item.id !== 'messages') return false
              if (isBarber && (item.id === 'clients' || item.id === 'settings')) return false
              return true
            }).map(item => {
              const active = pathname === item.href || (item.id === 'settings' && ['/settings', '/billing', '/waitlist', '/portfolio', '/attendance', '/cash', '/membership', '/expenses', '/payroll', '/payments'].some(p => pathname.startsWith(p)))
              const hasUnread = item.id === 'messages' && !!unreadChat && pathname !== '/messages'
              return (
                <Link key={item.id} href={item.href} className={`pill-item${active ? ' active' : ''}`}>
                  <div className={`pill-ico${hasUnread ? ' has-unread' : ''}`}>
                    <Icon id={item.id} color={active ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.3)'} />
                    {hasUnread && <div className="pill-unread-dot" />}
                  </div>
                  <span className="pill-label">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {showProfile && user && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfile(false)}
          onUpdated={u => { setUser(u); setShowProfile(false) }}
        />
      )}
    </>
  )
}
