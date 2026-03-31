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
    let tx = 0, ty = 0, cx = 0, cy = 0, raf: number
    function onMouse(e: MouseEvent) {
      tx = (e.clientX / window.innerWidth - 0.5) * 2
      ty = (e.clientY / window.innerHeight - 0.5) * 2
    }
    function tick() {
      cx += (tx - cx) * 0.04; cy += (ty - cy) * 0.04
      const far = document.querySelector('.stars-far') as HTMLElement
      const mid = document.querySelector('.stars-mid') as HTMLElement
      const near = document.querySelector('.stars-near') as HTMLElement
      if (far) far.style.transform = `translate(${cx * 3}px, ${cy * 3}px)`
      if (mid) mid.style.transform = `translate(${cx * 7}px, ${cy * 7}px)`
      if (near) near.style.transform = `translate(${cx * 12}px, ${cy * 12}px)`
      raf = requestAnimationFrame(tick)
    }
    window.addEventListener('mousemove', onMouse, { passive: true })
    raf = requestAnimationFrame(tick)
    return () => { window.removeEventListener('mousemove', onMouse); cancelAnimationFrame(raf) }
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

          {/* Footer links */}
          <div style={{ textAlign: 'center', marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.25)' }}>
              Don&apos;t have a workspace? <a href="/signup" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Create one</a>
            </p>
            <a href="/" style={{ fontSize: 12, color: 'rgba(255,255,255,.2)', textDecoration: 'none' }}>← Back to Vurium</a>
          </div>
        </div>
      </main>
    </>
  )
}
