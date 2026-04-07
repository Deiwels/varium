'use client'
import { useState, useEffect, useRef } from 'react'
import { setAuthCookie } from '@/lib/auth-cookie'
import { hasPinSetup, savePin } from '@/lib/pin'

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://vuriumbook-api-431945333485.us-central1.run.app'

export default function SignInPage() {
  const spaceRef = useRef<HTMLDivElement>(null)
  const [workspaceId, setWorkspaceId] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pinSetup, setPinSetup] = useState<{ username: string; password: string; role: string; dest: string } | null>(null)
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [pinError, setPinError] = useState('')

  useEffect(() => {
    // Hide global cosmos — this page has its own .space-bg starfield
    const cosmos = document.getElementById('vurium-cosmos')
    if (cosmos) cosmos.style.display = 'none'
    // Hide "Back to Vurium" in native iOS app
    const isNative = (navigator as any).standalone || (window as any).webkit?.messageHandlers?.purchase
    if (isNative) { const el = document.getElementById('back-to-vurium'); if (el) el.style.display = 'none' }
    return () => { if (cosmos) cosmos.style.display = '' }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!username || !password) { setError('Email and password required'); return }
    setError(''); setLoading(true)
    try {
      const res = await fetch(`${API}/auth/login-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: username.trim().toLowerCase(), password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')

      let userData = { ...(data.user || {}) }
      const token = data.token || ''

      if (userData.role === 'barber' && token) {
        try {
          const br = await fetch(`${API}/api/barbers`, {
            headers: { Authorization: `Bearer ${token}` },
            credentials: 'include',
          }).then(r => r.json())
          const list = Array.isArray(br) ? br : (br?.barbers || [])
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
            if (!userData.barber_id && me.id) userData = { ...userData, barber_id: me.id }
          }
        } catch {}
      }

      if (token) localStorage.setItem('VURIUMBOOK_TOKEN', token)
      localStorage.setItem('VURIUMBOOK_USER', JSON.stringify(userData))
      setAuthCookie(userData.role + ':' + (userData.uid || ''))

      const role = userData.role || 'barber'
      const dest = (role === 'barber' || role === 'student') ? '/calendar' : '/dashboard'

      if (!hasPinSetup()) {
        setPinSetup({ username: username.trim(), password, role, dest })
        setLoading(false)
        return
      }

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

  const inp: React.CSSProperties = {
    width: '100%', padding: '14px 16px', borderRadius: 12,
    border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)',
    color: '#fff', fontSize: 15, outline: 'none', fontFamily: 'inherit',
    transition: 'border-color .2s',
  }

  const lbl: React.CSSProperties = {
    fontSize: 13, color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: 6,
  }

  // PIN Setup screen
  if (pinSetup) {
    return (
      <>
        <div className="space-bg" ref={spaceRef}>
          <div className="stars-wrap stars-wrap-far"><div className="stars stars-far" /></div>
          <div className="stars-wrap stars-wrap-mid"><div className="stars stars-mid" /></div>
          <div className="stars-wrap stars-wrap-near"><div className="stars stars-near" /></div>
          <div className="nebula-layer" style={{ width: 600, height: 350, top: '10%', left: '-10%', background: 'rgba(30,45,110,.06)' }} />
        </div>
        <div className="noise-overlay" />

        <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative', zIndex: 2 }}>
          <div className="fade-up" style={{ maxWidth: 400, width: '100%' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 24 }}>
                <img src="/logo.jpg" alt="Vurium" style={{ width: 32, height: 32, borderRadius: 8 }} />
                <span style={{ fontSize: 18, fontWeight: 600, color: '#e8e8ed', letterSpacing: '-.02em' }}>VuriumBook</span>
              </a>
              <h1 style={{ fontSize: 22, fontWeight: 600, color: '#e8e8ed', marginBottom: 6 }}>Set your PIN</h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', lineHeight: 1.5 }}>Create a 4-digit PIN for quick access.<br />You won&apos;t need to enter your password again.</p>
            </div>

            <div className="glass-card" style={{ padding: '32px 28px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={lbl}>PIN</label>
                  <input type="password" inputMode="numeric" maxLength={4} placeholder="4 digits" autoFocus value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    style={{ ...inp, textAlign: 'center', fontSize: 24, letterSpacing: '.3em', fontWeight: 700 }} />
                </div>
                <div>
                  <label style={lbl}>Confirm PIN</label>
                  <input type="password" inputMode="numeric" maxLength={4} placeholder="Repeat" value={pinConfirm}
                    onChange={e => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    style={{ ...inp, textAlign: 'center', fontSize: 24, letterSpacing: '.3em', fontWeight: 700 }} />
                </div>
              </div>

              {pinError && (
                <div style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(220,80,80,.1)', border: '1px solid rgba(220,80,80,.2)', color: 'rgba(255,160,160,.9)', fontSize: 13, marginTop: 16 }}>{pinError}</div>
              )}

              <button type="button" onClick={handlePinSetup} className="btn-primary" style={{ width: '100%', marginTop: 24, fontSize: 15, fontFamily: 'inherit' }}>
                Save PIN
              </button>
              <button type="button" onClick={skipPinSetup} style={{
                width: '100%', marginTop: 10, padding: '14px', borderRadius: 14, fontSize: 13, fontFamily: 'inherit',
                background: 'none', border: '1px solid rgba(255,255,255,.08)', color: 'rgba(255,255,255,.35)', cursor: 'pointer',
              }}>
                Skip for now
              </button>
            </div>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <div className="space-bg" ref={spaceRef}>
        <div className="stars-wrap stars-wrap-far"><div className="stars stars-far" /></div>
        <div className="stars-wrap stars-wrap-mid"><div className="stars stars-mid" /></div>
        <div className="stars-wrap stars-wrap-near"><div className="stars stars-near" /></div>
        <div className="shooting-star shooting-star-1" />
        <div className="nebula-layer" style={{ width: 800, height: 450, top: '6%', left: '-14%', background: 'rgba(30,45,110,.06)' }} />
        <div className="nebula-layer" style={{ width: 550, height: 300, top: '35%', right: '-10%', background: 'rgba(55,35,100,.04)', animationDelay: '.5s' }} />
      </div>
      <div className="noise-overlay" />

      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative', zIndex: 2 }}>
        <div className="fade-up" style={{ maxWidth: 420, width: '100%' }}>

          {/* Logo & Title */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 24 }}>
              <img src="/logo.jpg" alt="Vurium" style={{ width: 36, height: 36, borderRadius: 8 }} />
              <span style={{ fontSize: 20, fontWeight: 600, color: '#e8e8ed', letterSpacing: '-.02em' }}>VuriumBook</span>
            </a>
            <h1 className="shimmer-text" style={{ fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 600, letterSpacing: '-.03em' }}>
              Sign in to your workspace
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.3)', marginTop: 8 }}>
              Enter your credentials to access the CRM
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin}>
            <div className="glass-card" style={{ padding: '32px 28px' }}>
              {error && (
                <div style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(220,80,80,.1)', border: '1px solid rgba(220,80,80,.2)', color: 'rgba(255,160,160,.9)', fontSize: 13, marginBottom: 20 }}>{error}</div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={lbl}>Email</label>
                  <input type="email" placeholder="you@yourbusiness.com" autoComplete="email" autoCapitalize="none" value={username}
                    onChange={e => setUsername(e.target.value)} required style={inp} />
                </div>
                <div>
                  <label style={lbl}>Password</label>
                  <input type="password" placeholder="Enter your password" autoComplete="current-password" value={password}
                    onChange={e => setPassword(e.target.value)} required style={inp} />
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary" style={{
                width: '100%', marginTop: 28, fontSize: 15, fontFamily: 'inherit',
                opacity: loading ? 0.5 : 1,
              }}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </div>
          </form>

          {/* Sign in with Apple (web) */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.06)' }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.25)' }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.06)' }} />
            </div>
            <button type="button" onClick={async () => {
              setError(''); setLoading(true)
              try {
                // Use Apple JS SDK popup flow
                const params = new URLSearchParams({
                  client_id: 'com.vurium.VuriumBook',
                  redirect_uri: `${window.location.origin}/signin`,
                  response_type: 'code id_token',
                  response_mode: 'fragment',
                  scope: 'name email',
                })
                const appleAuthUrl = `https://appleid.apple.com/auth/authorize?${params}`
                const popup = window.open(appleAuthUrl, 'apple-signin', 'width=500,height=700')
                if (!popup) { setError('Popup blocked. Please allow popups.'); setLoading(false); return }
                // Poll for redirect
                const pollTimer = setInterval(() => {
                  try {
                    if (popup.closed) { clearInterval(pollTimer); setLoading(false); return }
                    const hash = popup.location.hash
                    if (hash && hash.includes('id_token')) {
                      clearInterval(pollTimer); popup.close()
                      const fragParams = new URLSearchParams(hash.substring(1))
                      const idToken = fragParams.get('id_token')
                      if (!idToken) { setError('No token received'); setLoading(false); return }
                      // Send to backend
                      fetch(`${API}/auth/apple-signin`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ identityToken: idToken, userIdentifier: '' }),
                      }).then(r => r.json()).then(data => {
                        if (!data.ok) throw new Error(data.error || 'Failed')
                        localStorage.setItem('VURIUMBOOK_TOKEN', data.token)
                        localStorage.setItem('VURIUMBOOK_USER', JSON.stringify(data.user))
                        setAuthCookie((data.user?.role || 'owner') + ':' + (data.user?.uid || ''))
                        const dest = (data.user?.role === 'barber' || data.user?.role === 'student') ? '/calendar' : '/dashboard'
                        window.location.replace(dest)
                      }).catch(err => { setError(err.message); setLoading(false) })
                    }
                  } catch { /* cross-origin — keep polling */ }
                }, 500)
              } catch (err: any) { setError(err.message || 'Apple Sign In failed'); setLoading(false) }
            }} disabled={loading} style={{
              width: '100%', height: 50, borderRadius: 999, border: '1px solid rgba(255,255,255,.12)',
              background: '#fff', color: '#000', fontSize: 15, fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: loading ? 0.5 : 1,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#000"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
              Sign in with Apple
            </button>
          </div>

          {/* Forgot password */}
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button type="button" onClick={() => {
              const email = prompt('Enter your email to receive a password reset link:')
              if (!email) return
              fetch(`${API}/auth/forgot-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
                .then(() => alert('If an account exists with that email, a reset link has been sent.'))
                .catch(() => alert('Failed to send reset email.'))
            }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.35)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
              Forgot password?
            </button>
          </div>

          {/* Footer links */}
          <div style={{ textAlign: 'center', marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.25)' }}>
              Don&apos;t have a workspace? <a href="/signup" style={{ color: 'rgba(255,255,255,.45)', textDecoration: 'none' }}>Create one</a>
            </p>
            <a href="/" id="back-to-vurium" style={{ fontSize: 12, color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>← Back to Vurium</a>
          </div>
        </div>
      </main>
    </>
  )
}
