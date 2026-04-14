'use client'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { clearAuthCookie, setAuthCookie } from '@/lib/auth-cookie'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import ImageCropper from '@/components/ImageCropper'
import { useDialog } from '@/components/StyledDialog'
import { hasPinSetup, verifyPin, getCredentials, getPinUsername } from '@/lib/pin'
import { usePlan } from '@/components/PlanProvider'
import { usePermissions } from '@/components/PermissionsProvider'
import { useVisibilityPolling } from '@/lib/useVisibilityPolling'

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://vuriumbook-api-431945333485.us-central1.run.app'

interface User {
  uid: string; name: string; username: string; role: string; barber_id?: string; photo?: string; mentor_barber_ids?: string[]
}

const NAV = [
  { id: 'dashboard', href: '/dashboard', label: 'Dashboard',  sub: 'Today overview' },
  { id: 'calendar',  href: '/calendar',  label: 'Calendar',   sub: 'Bookings grid' },
  { id: 'history',   href: '/history',   label: 'History',    sub: 'Booking records' },
  { id: 'messages',  href: '/messages',  label: 'Messages',   sub: 'Team chat' },
  { id: 'waitlist',  href: '/waitlist',  label: 'Waitlist',   sub: 'Queue & notify' },
  { id: 'portfolio',  href: '/portfolio',  label: 'Portfolio',  sub: 'Work gallery' },
  { id: 'clients',   href: '/clients',   label: 'Clients',    sub: 'Search / notes',      ownerAdmin: true },
  { id: 'payments',  href: '/payments',  label: 'Payments',   sub: 'Square + Terminal',   ownerAdmin: true },
  { id: 'attendance', href: '/attendance', label: 'Attendance', sub: 'Hours & clock',       ownerAdmin: true },
  { id: 'cash',      href: '/cash',      label: 'Cash',       sub: 'Daily register',      ownerAdmin: true },
  { id: 'membership', href: '/membership', label: 'Membership', sub: 'Recurring clients',   ownerAdmin: true },
  { id: 'analytics', href: '/analytics', label: 'Analytics',   sub: 'Traffic & sources',   ownerAdmin: true },
  { id: 'expenses',  href: '/expenses',  label: 'Expenses',   sub: 'Track costs',         ownerAdmin: true, feature: 'expenses' },
  { id: 'payroll',   href: '/payroll',   label: 'Payroll',    sub: 'Commission + tips',   ownerOnly: true, feature: 'payroll' },
  { id: 'billing',   href: '/billing',   label: 'Billing',    sub: 'Plan & payments',     ownerOnly: true },
  { id: 'settings',  href: '/settings',  label: 'Settings',   sub: 'Config & sync',       ownerAdmin: true },
] as const

// ─── SVG icons ────────────────────────────────────────────────────────────────
function Icon({ id, color }: { id: string; color: string }) {
  const s = { stroke: color, strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
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
    case 'history':
      return <svg width="17" height="17" viewBox="0 0 24 24" {...{}}>
        <circle cx="12" cy="12" r="10" {...s}/>
        <polyline points="12 6 12 12 16 14" {...s}/>
        <path d="M1 4v6h6" {...s}/>
        <path d="M3.51 15a9 9 0 1 0 .49-7.5" {...s}/>
      </svg>
    case 'portfolio':
      return <svg width="17" height="17" viewBox="0 0 24 24" {...{}}>
        <rect x="3" y="3" width="18" height="18" rx="2.5" {...s}/>
        <circle cx="8.5" cy="8.5" r="1.5" fill={color}/>
        <path d="M21 15l-5-5L5 21" {...s}/>
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
    case 'cash':
      return <svg width="17" height="17" viewBox="0 0 24 24" {...{}}>
        <line x1="12" y1="1" x2="12" y2="23" {...s}/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" {...s}/>
      </svg>
    case 'membership':
      return <svg width="17" height="17" viewBox="0 0 24 24" {...{}}>
        <polyline points="23 4 23 10 17 10" {...s}/>
        <polyline points="1 20 1 14 7 14" {...s}/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" {...s}/>
      </svg>
    case 'analytics':
      return <svg width="17" height="17" viewBox="0 0 24 24" {...{}}>
        <line x1="18" y1="20" x2="18" y2="10" {...s}/>
        <line x1="12" y1="20" x2="12" y2="4" {...s}/>
        <line x1="6" y1="20" x2="6" y2="14" {...s}/>
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
    case 'billing':
      return <svg width="17" height="17" viewBox="0 0 24 24" {...{}}>
        <rect x="2" y="5" width="20" height="14" rx="2.5" {...s}/>
        <line x1="2" y1="10" x2="22" y2="10" {...s}/>
        <line x1="6" y1="15" x2="10" y2="15" {...s}/>
      </svg>
    default:
      return <svg width="17" height="17" viewBox="0 0 24 24" {...{}}>
        <circle cx="12" cy="12" r="4" {...s}/>
      </svg>
  }
}

// ─── Profile Modal ────────────────────────────────────────────────────────────
function ProfileModal({ user, onClose, onUpdated, canChangePassword }: {
  user: User; onClose: () => void; onUpdated: (u: User) => void; canChangePassword: boolean
}) {
  const { showConfirm } = useDialog()
  const [name, setName] = useState(user.name || '')
  const [photo, setPhoto] = useState(user.photo || '')
  const [cropSrc, setCropSrc] = useState('')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<'profile' | 'password'>('profile')
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
    if (newPw.length < 8) { setErr('Min 8 characters'); return }
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
    background: 'rgba(0,0,0,.70)',
    backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
  }
  const modalBox: React.CSSProperties = {
    width: 'min(420px,100%)', borderRadius: 24,
    border: '1px solid rgba(255,255,255,.10)',
    background: 'rgba(10,10,14,.92)',
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
  const profileTabs: Array<{ id: 'profile' | 'password'; label: string }> = [
    { id: 'profile', label: 'Profile' },
    ...(canChangePassword ? [{ id: 'password' as const, label: 'Password' }] : []),
  ]

  return (
    <div style={glassModal} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modalBox}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
          <div style={{ fontFamily: '"Inter",sans-serif', letterSpacing: '.16em', textTransform: 'uppercase', fontSize: 13 }}>My Profile</div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.06)', color: '#fff', cursor: 'pointer', fontSize: 15, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>

        <div style={{ display: 'flex', gap: 6, padding: '12px 18px 0' }}>
          {profileTabs.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setMsg(''); setErr('') }}
              style={{ height: 30, padding: '0 12px', borderRadius: 999, cursor: 'pointer', fontWeight: tab === t.id ? 600 : 400, fontSize: 11, fontFamily: 'inherit', border: `1px solid ${tab === t.id ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.06)'}`, background: tab === t.id ? 'rgba(255,255,255,.08)' : 'transparent', color: tab === t.id ? '#e8e8ed' : 'rgba(255,255,255,.35)', transition: 'all .2s' }}>
              {t.label}
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
            <div><label style={lbl}>Email</label><input value={user.username || ''} disabled style={{ ...inp, opacity: .35, cursor: 'not-allowed' }} /></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}><label style={lbl}>Role</label><div style={{ height: 40, borderRadius: 12, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.03)', padding: '0 12px', display: 'flex', alignItems: 'center', fontSize: 13, color: 'rgba(255,255,255,.45)', textTransform: 'capitalize' }}>{user.role === 'owner' ? 'Owner' : user.role === 'admin' ? 'Admin' : 'Member'}</div></div>
            </div>
            <button onClick={saveProfile} disabled={saving} style={{ height: 38, borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.06)', color: '#e8e8ed', cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'inherit', opacity: saving ? .5 : 1 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>}

          {tab === 'password' && <>
            <div><label style={lbl}>Current password</label><input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="••••••••" style={inp} /></div>
            <div><label style={lbl}>New password</label><input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min 8 characters" style={inp} /></div>
            <button onClick={savePassword} disabled={saving} style={{ height: 38, borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.06)', color: '#e8e8ed', cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'inherit', opacity: saving ? .5 : 1 }}>
              {saving ? 'Saving…' : 'Update password'}
            </button>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', marginTop: 4 }}>You can also manage account deletion from Settings → Accounts.</div>
          </>}


          {msg && <div style={{ fontSize: 12, color: 'rgba(130,220,170,.5)', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(143,240,177,.22)', background: 'rgba(143,240,177,.06)' }}>{msg}</div>}
          {err && <div style={{ fontSize: 12, color: 'rgba(220,130,160,.5)', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,107,107,.22)', background: 'rgba(255,107,107,.06)' }}>{err}</div>}

          {/* Sign Out */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', marginTop: 8, paddingTop: 14 }}>
            <button onClick={async () => {
              const ok = await showConfirm('Sign out of VuriumBook?', 'Sign Out')
              if (!ok) return
              // Unregister push token before logout
              try {
                const token = localStorage.getItem('VURIUMBOOK_TOKEN') || ''
                if (token && (window as any).__VURIUM_IS_NATIVE) {
                  const pushToken = (window as any).__VURIUM_PUSH_TOKEN || ''
                  if (pushToken) {
                    await fetch((process.env.NEXT_PUBLIC_API_BASE_URL || 'https://vuriumbook-api-431945333485.us-central1.run.app') + '/api/push/unregister', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                      body: JSON.stringify({ device_token: pushToken })
                    })
                  }
                }
              } catch {}
              localStorage.removeItem('VURIUMBOOK_TOKEN')
              localStorage.removeItem('VURIUMBOOK_USER')
              localStorage.removeItem('VURIUMBOOK_PIN_HASH')
              document.cookie = 'VURIUMBOOK_TOKEN=; path=/; max-age=0; SameSite=Lax'
              // Clear native stored token
              if ((window as any).__VURIUM_IS_NATIVE) {
                try { (window as any).webkit?.messageHandlers?.logout?.postMessage('logout') } catch {}
              }
              window.location.replace('/signin')
            }} style={{
              width: '100%', height: 42, borderRadius: 12,
              border: '1px solid rgba(220,80,80,.15)', background: 'rgba(220,80,80,.04)',
              color: 'rgba(220,130,130,.7)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
              Sign Out
            </button>
          </div>
        </div>
      </div>
      {cropSrc && <ImageCropper src={cropSrc} onSave={(url) => { setPhoto(url); setCropSrc('') }} onClose={() => setCropSrc('')} shape="circle" />}
    </div>
  )
}

// ─── Shell ────────────────────────────────────────────────────────────────────
export default function Shell({ children, page }: { children: React.ReactNode; page: string }) {
  // Read auth state synchronously from localStorage to avoid blank screen flash
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'noauth'>('loading')
  const [showProfile, setShowProfile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [unreadChat, setUnreadChat] = useState<string | null>(null)
  const [showPinOverlay, setShowPinOverlay] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const pathname = usePathname()
  const authRedirectingRef = useRef(false)

  const redirectToSignIn = useCallback(() => {
    if (authRedirectingRef.current) return
    authRedirectingRef.current = true
    setShowPinOverlay(false)
    setPinInput('')
    setPinError('')
    setPinLoading(false)
    localStorage.removeItem('VURIUMBOOK_TOKEN')
    localStorage.removeItem('VURIUMBOOK_USER')
    clearAuthCookie()
    if (typeof window !== 'undefined' && window.location.pathname !== '/signin') {
      window.location.replace('/signin')
    }
  }, [])

  const openPinUnlock = useCallback(() => {
    authRedirectingRef.current = false
    localStorage.removeItem('VURIUMBOOK_TOKEN')
    setStatus('ok')
    setPinInput('')
    setPinError('')
    setPinLoading(false)
    setShowPinOverlay(true)
  }, [])

  // Detect virtual keyboard open/close
  useEffect(() => {
    // Method 1: visualViewport (works in most browsers)
    const vv = typeof visualViewport !== 'undefined' ? visualViewport : null
    const check = () => {
      if (vv) {
        const diff = window.innerHeight - vv.height
        setKeyboardOpen(diff > 120)
      }
    }
    if (vv) {
      vv.addEventListener('resize', check)
      vv.addEventListener('scroll', check)
    }
    // Method 2: focusin/focusout fallback for WKWebView
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement
      if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.isContentEditable) {
        setKeyboardOpen(true)
      }
    }
    const onFocusOut = () => {
      // Delay to allow focus to move to another input
      setTimeout(() => {
        const a = document.activeElement as HTMLElement
        if (!a || (a.tagName !== 'INPUT' && a.tagName !== 'TEXTAREA' && !a.isContentEditable)) {
          setKeyboardOpen(false)
        }
      }, 100)
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      if (vv) { vv.removeEventListener('resize', check); vv.removeEventListener('scroll', check) }
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  // Listen for PIN-required events from api.ts
  useEffect(() => {
    const handler = () => {
      if (hasPinSetup()) {
        openPinUnlock()
      } else {
        redirectToSignIn()
      }
    }
    window.addEventListener('vuriumbook-pin-required', handler)
    return () => window.removeEventListener('vuriumbook-pin-required', handler)
  }, [openPinUnlock, redirectToSignIn])

  const handlePinSubmit = useCallback(async (enteredPin: string) => {
    setPinError('')
    setPinLoading(true)
    try {
      const valid = await verifyPin(enteredPin)
      if (!valid) { setPinError('Wrong PIN'); setPinLoading(false); setPinInput(''); return }
      const creds = await getCredentials(enteredPin)
      if (!creds) { setPinError('PIN data corrupted. Please login with password.'); setPinLoading(false); return }
      // Re-login with saved credentials (use login-email which doesn't need workspace_id)
      const res = await fetch(`${API}/auth/login-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: creds.username, password: creds.password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      const token = data.token || data.access_token || ''
      if (token) localStorage.setItem('VURIUMBOOK_TOKEN', token)
      const userData = { ...(data.user || {}) }
      localStorage.setItem('VURIUMBOOK_USER', JSON.stringify(userData))
      setAuthCookie(userData.role + ':' + (userData.uid || ''))
      setUser(userData)
      setStatus('ok')
      authRedirectingRef.current = false
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
    // Load user from localStorage immediately to prevent flash
    try { const stored = JSON.parse(localStorage.getItem('VURIUMBOOK_USER') || 'null'); if (stored) setUser(stored) } catch {}
    const token = localStorage.getItem('VURIUMBOOK_TOKEN')
    if (!token) { setStatus('noauth'); return }
    authRedirectingRef.current = false
    setStatus('ok') // optimistic — will revert to noauth if /me fails
    fetch(`${API}/api/auth/me`, { credentials: 'include', headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (r.status === 401) {
          redirectToSignIn()
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
        authRedirectingRef.current = false
        setUser(userData)
        localStorage.setItem('VURIUMBOOK_USER', JSON.stringify(userData))
        // Auto-register push token for current account (native iOS only)
        if ((window as any).__VURIUM_IS_NATIVE && (window as any).__VURIUM_PUSH_TOKEN) {
          const pushToken = (window as any).__VURIUM_PUSH_TOKEN
          fetch(`${API}/api/push/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ device_token: pushToken, platform: 'ios', app: 'vuriumbook' })
          }).then(() => console.log('[PUSH] Re-registered token for current account')).catch(() => {})
        }
      })
      .catch(() => {})
  }, [redirectToSignIn])

  // Periodically check session validity — show PIN overlay if expired
  const checkSession = useCallback(() => {
    if (status !== 'ok' || !user || showPinOverlay || authRedirectingRef.current) return
    const token = localStorage.getItem('VURIUMBOOK_TOKEN')
    if (!token) {
      if (hasPinSetup()) {
        openPinUnlock()
        return
      }
      setStatus('noauth')
      return
    }
    fetch(`${API}/api/auth/me`, { credentials: 'include', headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (r.status === 401) {
          if (hasPinSetup()) {
            openPinUnlock()
            return
          }
          setStatus('noauth')
        }
      })
      .catch(() => {})
  }, [status, user, showPinOverlay, openPinUnlock])
  useVisibilityPolling(checkSession, 5 * 60 * 1000, [checkSession])

  useEffect(() => {
    if (status === 'noauth') {
      redirectToSignIn()
    }
  }, [status, redirectToSignIn])

  // Poll for unread messages — check latest message per chat type
  const CHAT_COLORS: Record<string, string> = useMemo(() => ({ general: 'rgba(130,150,220,.6)', barbers: 'rgba(130,150,220,.6)', admins: 'rgba(130,220,170,.5)', students: 'rgba(180,140,220,.6)', requests: 'rgba(220,190,130,.5)', applications: 'rgba(220,130,160,.5)' }), [])
  const checkUnread = useCallback(async () => {
    if (status !== 'ok' || !user) return
    if (pathname === '/messages') { setUnreadChat(null); return }
    const token = localStorage.getItem('VURIUMBOOK_TOKEN') || ''
    if (!token) return
    const hdrs = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    const lastSeen = localStorage.getItem('VB_MSG_LAST_SEEN') || ''
    const isOwnerAdmin = user.role === 'owner' || user.role === 'admin'
    try {
      // Consolidate: single /api/messages/unread call if available, else batch
      const chatTypes = ['general', 'barbers', 'admins', 'students']
      const chatPromises = chatTypes.map(ct =>
        fetch(`${API}/api/messages?chatType=${ct}&limit=1`, { credentials: 'include', headers: hdrs })
          .then(r => r.ok ? r.json() : null).catch(() => null)
          .then(data => ({ ct, data }))
      )
      const extraPromises: Promise<{ type: string; data: any }>[] = []
      if (isOwnerAdmin) {
        extraPromises.push(
          fetch(`${API}/api/applications?status=new&limit=1`, { credentials: 'include', headers: hdrs })
            .then(r => r.ok ? r.json() : null).catch(() => null)
            .then(data => ({ type: 'applications', data }))
        )
        extraPromises.push(
          fetch(`${API}/api/requests`, { credentials: 'include', headers: hdrs })
            .then(r => r.ok ? r.json() : null).catch(() => null)
            .then(data => ({ type: 'requests', data }))
        )
      }

      const [chatResults, ...extraResults] = await Promise.all([
        Promise.all(chatPromises), ...extraPromises
      ])

        // Check chat messages
        for (const { ct, data } of chatResults as { ct: string; data: any }[]) {
          if (!data) continue
          const msgs = data?.messages || []
          if (msgs.length && msgs[msgs.length - 1]?.createdAt > lastSeen && msgs[msgs.length - 1]?.senderId !== user.uid) {
            setUnreadChat(CHAT_COLORS[ct] || 'rgba(130,150,220,.6)')
            return
          }
        }
        // Check applications
        if (isOwnerAdmin) {
          const appsResult = extraResults.find((r: any) => r?.type === 'applications')
          if (appsResult) {
            const lastSeenApps = localStorage.getItem('VB_APPS_LAST_SEEN') || ''
            const apps = appsResult.data?.applications || []
            if (apps.length && apps[0]?.created_at > lastSeenApps) {
              setUnreadChat(CHAT_COLORS.applications)
              return
            }
          }
          const reqResult = extraResults.find((r: any) => r?.type === 'requests')
          if (reqResult) {
            const lastSeenReq = localStorage.getItem('VB_REQ_LAST_SEEN') || ''
            const pending = (reqResult.data?.requests || []).filter((r: any) => r.status === 'pending')
            if (pending.length && pending[0]?.createdAt > lastSeenReq) {
              setUnreadChat(CHAT_COLORS.requests)
              return
            }
          }
        }
        setUnreadChat(null)
      } catch { /* ignore */ }
  }, [status, user, pathname, CHAT_COLORS])
  useVisibilityPolling(checkUnread, 45000, [checkUnread])

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


  if (status === 'noauth') {
    return (
      <div style={{ minHeight: '100vh', background: '#000', color: 'rgba(255,255,255,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Inter,system-ui,sans-serif' }}>
        Redirecting to sign in…
      </div>
    )
  }

  const { hasFeature: planHasFeature, expired: planExpired, trial_days_left } = usePlan()
  const { hasPerm } = usePermissions()
  const role = user?.role || 'barber'
  const isBarber = role === 'barber'
  const isStudent = role === 'student'
  const isGuest = role === 'guest'
  // Check if user has any settings_access permission
  const hasAnySettingsAccess = role === 'owner' || ['general', 'booking', 'site_builder', 'fees_tax', 'integrations', 'change_password', 'view_pin'].some(k => hasPerm('settings_access', k))
  const visibleNav = NAV.filter(item => {
    if ((item as any).ownerOnly && role !== 'owner') return false
    if ((item as any).feature && !planHasFeature((item as any).feature)) return false
    // Settings: show if user has any settings_access permission
    if (item.id === 'settings') return hasAnySettingsAccess
    // For non-owner roles, check permissions
    if (role !== 'owner') {
      if (!hasPerm('pages', item.id)) return false
    }
    return true
  })
  const initials = (n: string) => { const p = (n || '').split(' '); return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() }

  return (
    <>
      {/* PIN Overlay — Vurium Dark Cosmos */}
      {showPinOverlay && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', padding: 20, fontFamily: 'Inter, system-ui, sans-serif', overflow: 'hidden' }}>
          {/* Cosmic background */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            {/* Stars */}
            {Array.from({ length: 40 }).map((_, i) => (
              <div key={i} style={{
                position: 'absolute',
                width: i % 5 === 0 ? 2 : 1,
                height: i % 5 === 0 ? 2 : 1,
                borderRadius: '50%',
                background: `rgba(255,255,255,${0.1 + (i % 4) * 0.08})`,
                left: `${(i * 37 + 13) % 100}%`,
                top: `${(i * 53 + 7) % 100}%`,
              }} />
            ))}
            {/* Nebula glow */}
            <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translate(-50%, -50%)', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(100,120,200,.06) 0%, transparent 70%)', filter: 'blur(60px)' }} />
            <div style={{ position: 'absolute', bottom: '10%', right: '20%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(130,150,220,.04) 0%, transparent 70%)', filter: 'blur(50px)' }} />
          </div>

          <div style={{ width: '100%', maxWidth: 360, textAlign: 'center', position: 'relative', zIndex: 1 }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
              <svg width="24" height="24" viewBox="0 0 32 32" fill="none" style={{ opacity: 0.7 }}>
                <path d="M6 8 L16 4 L26 8 L26 20 L16 28 L6 20Z" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" fill="none" />
                <path d="M16 4 L16 28" stroke="rgba(255,255,255,.25)" strokeWidth="1" />
                <path d="M6 8 L26 20" stroke="rgba(255,255,255,.15)" strokeWidth="1" />
                <path d="M26 8 L6 20" stroke="rgba(255,255,255,.15)" strokeWidth="1" />
              </svg>
              <span style={{ fontSize: 20, fontWeight: 600, color: '#e8e8ed', letterSpacing: '-.02em' }}>VuriumBook</span>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.30)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 32 }}>Session expired</div>

            <div style={{ fontSize: 14, color: 'rgba(255,255,255,.50)', marginBottom: 32 }}>
              Enter PIN to continue as <strong style={{ color: 'rgba(130,150,220,.7)' }}>{user?.name || getPinUsername()}</strong>
            </div>

            {/* PIN dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginBottom: 32 }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{
                  width: 14, height: 14, borderRadius: '50%',
                  border: `1.5px solid ${i < pinInput.length ? 'rgba(130,150,220,.5)' : 'rgba(255,255,255,.15)'}`,
                  background: i < pinInput.length ? 'rgba(130,150,220,.6)' : 'transparent',
                  transition: 'all .2s ease',
                  boxShadow: i < pinInput.length ? '0 0 12px rgba(130,150,220,.3)' : 'none',
                }} />
              ))}
            </div>

            {pinError && (
              <div style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(255,107,107,.20)', background: 'rgba(255,107,107,.06)', color: 'rgba(255,130,130,.7)', fontSize: 12, marginBottom: 20 }}>
                {pinError}
              </div>
            )}

            {/* Number pad */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, maxWidth: 280, margin: '0 auto' }}>
              {[1,2,3,4,5,6,7,8,9,null,0,'del'].map((n, i) => (
                <button key={i} type="button" disabled={pinLoading}
                  onClick={() => {
                    if (n === 'del') { setPinInput(p => p.slice(0, -1)); setPinError('') }
                    else if (n !== null && pinInput.length < 4) { setPinInput(p => p + n); setPinError('') }
                  }}
                  style={{
                    height: 60, borderRadius: 16,
                    border: n === null ? 'none' : '1px solid rgba(255,255,255,.06)',
                    background: n === null ? 'transparent' : 'rgba(255,255,255,.03)',
                    color: n === 'del' ? 'rgba(255,255,255,.35)' : '#e8e8ed',
                    fontSize: n === 'del' ? 16 : 24, fontWeight: 500,
                    cursor: n === null ? 'default' : 'pointer',
                    fontFamily: 'inherit', transition: 'all .15s',
                    visibility: n === null ? 'hidden' : 'visible',
                    letterSpacing: '-.02em',
                  }}
                  onMouseEnter={e => { if (n !== null) (e.target as HTMLElement).style.background = 'rgba(255,255,255,.08)' }}
                  onMouseLeave={e => { if (n !== null) (e.target as HTMLElement).style.background = 'rgba(255,255,255,.03)' }}
                >
                  {n === 'del' ? '\u232B' : n}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 24, display: 'grid', gap: 12 }}>
              <button
                type="button"
                onClick={redirectToSignIn}
                style={{
                  width: '100%',
                  height: 46,
                  borderRadius: 14,
                  border: '1px solid rgba(255,255,255,.12)',
                  background: 'rgba(255,255,255,.05)',
                  color: '#e8e8ed',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  letterSpacing: '.01em',
                }}
              >
                Use password instead
              </button>
              <div style={{ fontSize: 12, lineHeight: 1.45, color: 'rgba(255,255,255,.42)' }}>
                This PIN only unlocks this device. You can always return to sign in if the PIN is unavailable.
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        :root{--shell-top:52px;--sab:0px;--sat:0px;}
        html,body{height:100%;background:#000;color:#e8e8ed;font-family:Inter,system-ui,sans-serif;}
        a{color:#fff!important;text-decoration:none!important;}

        .shell{display:flex;flex-direction:column;height:100vh;width:100vw;overflow:hidden;position:relative;background:transparent;}

        /* ── Top Header Bar — Vurium Glass ── */
        .top-bar{
          height:52px;flex:0 0 52px;
          display:flex;align-items:center;justify-content:space-between;
          padding:0 20px;
          border-bottom:1px solid rgba(255,255,255,.05);
          background:rgba(0,0,0,.5);
          position:relative;
          backdrop-filter:saturate(180%) blur(40px);
          -webkit-backdrop-filter:saturate(180%) blur(40px);
          z-index:50;
          box-shadow:0 1px 20px rgba(0,0,0,.3);
        }
        .top-bar-brand{
          display:flex;align-items:center;gap:10px;
        }
        .top-bar-brand img{ width:28px;height:28px;border-radius:7px; }
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
          padding-bottom:56px; /* space for thin bottom bar */
          position:relative;z-index:1;
        }

        /* ── Bottom Pill Nav — Vurium thin ── */
        .pill-bar{
          position:fixed;bottom:0;left:0;right:0;z-index:60;
          display:flex;align-items:center;justify-content:center;
          padding:6px 16px max(6px, env(safe-area-inset-bottom, 6px));
          background:linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(1,1,1,.9) 60%);
          pointer-events:none;
          transition:opacity .2s, transform .2s;
        }
        .pill-bar.keyboard-open{
          opacity:0;pointer-events:none!important;transform:translateY(20px);
        }
        @keyframes navBreathe {
          0%, 100% { box-shadow: 0 0 12px 2px rgba(255,255,255,0), 0 2px 16px rgba(0,0,0,.35); border-color: rgba(255,255,255,.04); }
          50% { box-shadow: 0 0 18px 4px rgba(255,255,255,.03), 0 2px 16px rgba(0,0,0,.35); border-color: rgba(255,255,255,.08); }
        }
        .pill-inner{
          pointer-events:auto;
          display:flex;align-items:center;gap:2px;
          padding:3px 8px;border-radius:22px;
          background:rgba(0,0,0,.45);
          backdrop-filter:saturate(180%) blur(30px);
          -webkit-backdrop-filter:saturate(180%) blur(30px);
          border:1px solid rgba(255,255,255,.05);
          box-shadow:0 2px 16px rgba(0,0,0,.35);
          animation: navBreathe 4s ease-in-out infinite;
          max-width:calc(100vw - 32px);
          overflow-x:auto;
          overflow-y:hidden;
          scrollbar-width:none;
          -ms-overflow-style:none;
        }
        .pill-inner::-webkit-scrollbar{display:none;}
        .pill-item{
          display:flex;align-items:center;justify-content:center;
          padding:7px 20px;border-radius:18px;
          cursor:pointer;transition:all .2s ease;
          border:1px solid transparent;
          text-decoration:none!important;
          position:relative;
        }
        .pill-item:hover{
          background:rgba(255,255,255,.04);
        }
        .pill-item.active{
          background:rgba(255,255,255,.06);
          border-color:rgba(255,255,255,.08);
        }
        .pill-item .pill-ico{
          width:20px;height:20px;display:flex;align-items:center;justify-content:center;
          position:relative;
          transition:opacity .15s;
          opacity:0.35;
        }
        .pill-item.active .pill-ico{opacity:0.9;}
        .pill-item:hover .pill-ico{opacity:0.6;}
        .pill-label{display:none!important;}

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
          .pill-item{padding:6px 14px;min-width:44px;}
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
            <img src="/logo.jpg" alt="" style={{ width: 28, height: 28, borderRadius: 7 }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,.55)', letterSpacing: '.04em', textTransform: 'uppercase' }}>{page}</span>
          </div>
          {/* Center slot — used by calendar for controls */}
          <div id="topbar-center" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 4 }}></div>
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
        <div className="content">
          {/* Block entire app if subscription expired */}
          {planExpired && page.toLowerCase() !== 'billing' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: '#e8e8ed', marginBottom: 8 }}>Your trial has ended</h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,.4)', maxWidth: 400, lineHeight: 1.6, marginBottom: 28 }}>
                To continue using Vurium, please subscribe to a plan. Your data is safe and will be available after subscribing. Online bookings are paused until you subscribe.
              </p>
              <a href="/billing" style={{ padding: '12px 32px', borderRadius: 12, fontSize: 15, fontWeight: 600, textDecoration: 'none', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', color: '#fff' }}>
                Subscribe
              </a>
            </div>
          ) : children}
        </div>

        {/* ── Bottom Pill Navigation ──
            Fixed 5-item mobile pill as per the 2026-04-13 design
            (Home · History · Calendar · Messages · Settings). This is
            NOT the full navigation — pages not in this list (Payments,
            Clients, Waitlist, Portfolio, Membership, Analytics, Cash,
            Expenses, Payroll, Billing) are reachable from the Dashboard
            shortcuts grid which already respects hasPerm().

            An earlier fix for PERM-001 replaced this list with a
            `visibleNav.map(...)` render which caused up to 8+ icons to
            appear in the pill for owners/admins — visually broken on
            mobile and user-reported as a regression. This restores the
            fixed 5-item layout and still filters each item through
            `visibleNav` so role-restricted users who can't see (e.g.)
            messages or history simply lose that slot — same as before.
        */}
        <div className={`pill-bar${keyboardOpen ? ' keyboard-open' : ''}`}>
          <div className="pill-inner">
            {(['dashboard', 'history', 'calendar', 'messages', 'settings'] as const).map(id => {
              const item = visibleNav.find(n => n.id === id)
              if (!item) return null
              const active = item.href === '/dashboard'
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`)
              const hasUnread = item.id === 'messages' && !!unreadChat && pathname !== '/messages'
              return (
                <Link key={item.id} href={item.href} className={`pill-item${active ? ' active' : ''}`} aria-label={item.label} title={item.label}>
                  <div className={`pill-ico${hasUnread ? ' has-unread' : ''}`}>
                    <Icon id={item.id} color="#fff" />
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
          canChangePassword={role === 'owner' || hasPerm('settings_access', 'change_password')}
          onClose={() => setShowProfile(false)}
          onUpdated={u => { setUser(u); setShowProfile(false) }}
        />
      )}
    </>
  )
}
