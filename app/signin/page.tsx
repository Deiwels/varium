'use client'
import { useState } from 'react'
import { setAuthCookie } from '@/lib/auth-cookie'
import { hasPinSetup, savePin } from '@/lib/pin'

const API = 'https://vuriumbook-api-431945333485.us-central1.run.app'

export default function SignInPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // PIN setup state
  const [pinSetup, setPinSetup] = useState<{ username: string; password: string; role: string; dest: string } | null>(null)
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [pinError, setPinError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!username || !password) { setError('Enter username and password.'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-KEY': 'R1403ss81fxrx*rx1403' },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')

      // Backend returns { ok: true, user: {...}, token?: string }
      // token may or may not be present depending on backend version
      let userData = { ...(data.user || {}) }
      const token = data.token || data.access_token || ''

      // Load barber info — also auto-link barber_id if missing
      if (userData.role === 'barber') {
        try {
          const br = await fetch(`${API}/api/barbers`, {
            headers: {
              'X-API-KEY': 'R1403ss81fxrx*rx1403',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            credentials: 'include',
          }).then(r => r.json())
          const list = Array.isArray(br) ? br : (br?.barbers || [])
          // Find by barber_id first, then fallback to username match
          let me = list.find((b: any) => String(b.id) === String(userData.barber_id))
          if (!me && userData.username) {
            me = list.find((b: any) =>
              String(b.username || '').toLowerCase() === String(userData.username || '').toLowerCase() ||
              String(b.name || '').toLowerCase() === String(userData.name || '').toLowerCase()
            )
          }
          if (me) {
            if (me.photo_url) userData = { ...userData, photo: me.photo_url }
            if (me.name) userData = { ...userData, name: me.name }
            // Auto-fix missing barber_id
            if (!userData.barber_id && me.id) userData = { ...userData, barber_id: me.id }
          }
        } catch {}
      }

      // Save to localStorage — works on all devices including mobile Safari
      if (token) localStorage.setItem('VURIUMBOOK_TOKEN', token)
      localStorage.setItem('VURIUMBOOK_USER', JSON.stringify(userData))

      // Set role cookie for middleware redirects
      setAuthCookie(userData.role + ':' + (userData.uid || ''))

      const role = userData.role || 'barber'
      const dest = (role === 'barber' || role === 'student') ? '/calendar' : '/dashboard'

      // If PIN not set up yet, show PIN setup screen
      if (!hasPinSetup()) {
        setPinSetup({ username: username.trim(), password, role, dest })
        setLoading(false)
        return
      }

      // Small delay to ensure cookie is persisted in WKWebView before navigation
      await new Promise(r => setTimeout(r, 300))
      window.location.replace(dest)

    } catch (err: any) {
      setError(err.message || 'Login failed')
      setLoading(false)
    }
  }

  async function handlePinSetup() {
    setPinError('')
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) { setPinError('Enter 4 digits'); return }
    if (pin !== pinConfirm) { setPinError('PINs do not match'); return }
    if (!pinSetup) return
    try {
      await savePin(pin, pinSetup.username, pinSetup.password)
      await new Promise(r => setTimeout(r, 300))
      window.location.replace(pinSetup.dest)
    } catch { setPinError('Failed to save PIN') }
  }

  function skipPinSetup() {
    if (!pinSetup) return
    window.location.replace(pinSetup.dest)
  }

  const inputStyle: React.CSSProperties = { width: '100%', height: 48, borderRadius: 14, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(0,0,0,.30)', color: '#fff', padding: '0 16px', fontSize: 15 }
  const lblStyle: React.CSSProperties = { display: 'block', fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', marginBottom: 8 }
  const btnStyle: React.CSSProperties = { width: '100%', height: 52, marginTop: 8, borderRadius: 14, border: '1px solid rgba(10,132,255,.65)', background: 'rgba(10,132,255,.14)', color: '#d7ecff', fontSize: 14, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit' }
  const errStyle: React.CSSProperties = { padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,107,107,.30)', background: 'rgba(255,107,107,.08)', color: '#ffd0d0', fontSize: 13, marginBottom: 12 }

  // PIN Setup screen
  if (pinSetup) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', padding: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&family=Julius+Sans+One&display=swap');
          * { box-sizing: border-box; }
          input:focus { outline: none; border-color: rgba(10,132,255,.65) !important; box-shadow: 0 0 0 3px rgba(10,132,255,.18) !important; }
          input::placeholder { color: rgba(255,255,255,.25); }
        `}</style>
        <div style={{ width: '100%', maxWidth: 400, borderRadius: 24, border: '1px solid rgba(255,255,255,.10)', background: 'linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02))', boxShadow: '0 24px 80px rgba(0,0,0,.6)', backdropFilter: 'blur(20px)', padding: '36px 32px 32px' }}>
          <div style={{ fontFamily: '"Julius Sans One", sans-serif', letterSpacing: '.22em', textTransform: 'uppercase', fontSize: 18, textAlign: 'center', marginBottom: 6, color: '#e9e9e9' }}>Set your PIN</div>
          <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,.40)', marginBottom: 28, lineHeight: 1.5 }}>Create a 4-digit PIN for quick access.<br/>You won't need to enter your password again.</div>
          <div style={{ marginBottom: 16 }}>
            <label style={lblStyle}>PIN</label>
            <input type="password" inputMode="numeric" maxLength={4} placeholder="4 digits" autoFocus value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              style={{ ...inputStyle, textAlign: 'center', fontSize: 24, letterSpacing: '.4em', fontWeight: 900 }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={lblStyle}>Confirm PIN</label>
            <input type="password" inputMode="numeric" maxLength={4} placeholder="Repeat 4 digits" value={pinConfirm} onChange={e => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
              style={{ ...inputStyle, textAlign: 'center', fontSize: 24, letterSpacing: '.4em', fontWeight: 900 }} />
          </div>
          {pinError && <div style={errStyle}>{pinError}</div>}
          <button type="button" onClick={handlePinSetup} style={btnStyle}>Save PIN</button>
          <button type="button" onClick={skipPinSetup} style={{ ...btnStyle, border: '1px solid rgba(255,255,255,.10)', background: 'transparent', color: 'rgba(255,255,255,.40)', fontWeight: 500, fontSize: 12 }}>Skip for now</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', padding: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&family=Julius+Sans+One&display=swap');
        * { box-sizing: border-box; }
        input:focus { outline: none; border-color: rgba(10,132,255,.65) !important; box-shadow: 0 0 0 3px rgba(10,132,255,.18) !important; }
        input::placeholder { color: rgba(255,255,255,.25); }
        button:disabled { opacity: .4; cursor: not-allowed; }
      `}</style>
      <div style={{ width: '100%', maxWidth: 400, borderRadius: 24, border: '1px solid rgba(255,255,255,.10)', background: 'linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02))', boxShadow: '0 24px 80px rgba(0,0,0,.6)', backdropFilter: 'blur(20px)', padding: '36px 32px 32px' }}>
        <div style={{ fontFamily: '"Julius Sans One", sans-serif', letterSpacing: '.22em', textTransform: 'uppercase', fontSize: 20, textAlign: 'center', marginBottom: 6, color: '#e9e9e9' }}>Element</div>
        <div style={{ textAlign: 'center', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 32 }}>CRM · Staff portal</div>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={lblStyle}>Username</label>
            <input type="text" placeholder="Enter your username" autoComplete="username" autoCapitalize="none" value={username} onChange={e => setUsername(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={lblStyle}>Password</label>
            <input type="password" placeholder="Enter your password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
          </div>
          {error && <div style={errStyle}>{error}</div>}
          <button type="submit" disabled={loading} style={{ ...btnStyle, background: loading ? 'rgba(10,132,255,.08)' : 'rgba(10,132,255,.14)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.4 : 1 }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,.25)', letterSpacing: '.06em' }}>Accounts are created by the owner.</div>
      </div>
    </div>
  )
}
