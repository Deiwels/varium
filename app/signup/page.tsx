'use client'
import { useEffect, useRef, useState } from 'react'
import { API } from '@/lib/api'
import { setAuthCookie } from '@/lib/auth-cookie'

export default function SignupPage() {
  const spaceRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState(0)
  const [businessName, setBusinessName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [phone, setPhone] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [plan, setPlan] = useState('free')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [wsId, setWsId] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const p = params.get('plan')
    if (p) setPlan(p)
  }, [])

  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window
    let tx = 0, ty = 0, cx = 0, cy = 0, raf: number
    function tick() {
      cx += (tx - cx) * 0.02; cy += (ty - cy) * 0.02
      const far = document.querySelector('.stars-far') as HTMLElement
      const mid = document.querySelector('.stars-mid') as HTMLElement
      const near = document.querySelector('.stars-near') as HTMLElement
      if (far) far.style.transform = `translate(${cx * 8}px, ${cy * 8}px)`
      if (mid) mid.style.transform = `translate(${cx * 20}px, ${cy * 20}px)`
      if (near) near.style.transform = `translate(${cx * 35}px, ${cy * 35}px)`
      raf = requestAnimationFrame(tick)
    }
    if (isMobile) {
      function onO(e: DeviceOrientationEvent) { const g = Math.max(-15, Math.min(15, e.gamma || 0)); const b = Math.max(-15, Math.min(15, (e.beta || 0) - 45)); tx = g / 15 * 4; ty = b / 15 * 4 }
      const doe = DeviceOrientationEvent as any
      if (typeof doe.requestPermission === 'function') { const r = () => { doe.requestPermission().then((s: string) => { if (s === 'granted') window.addEventListener('deviceorientation', onO, { passive: true }) }).catch(() => {}); document.removeEventListener('click', r) }; document.addEventListener('click', r, { once: true }) }
      else { window.addEventListener('deviceorientation', onO, { passive: true }) }
      raf = requestAnimationFrame(tick)
      return () => { window.removeEventListener('deviceorientation', onO); cancelAnimationFrame(raf) }
    }
    function onMouse(e: MouseEvent) { tx = (e.clientX / window.innerWidth - 0.5) * 2; ty = (e.clientY / window.innerHeight - 0.5) * 2 }
    window.addEventListener('mousemove', onMouse, { passive: true })
    raf = requestAnimationFrame(tick)
    return () => { window.removeEventListener('mousemove', onMouse); cancelAnimationFrame(raf) }
  }, [])

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!businessName || !email || !password || !ownerName) {
      setError('Please fill in all required fields.'); return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.'); return
    }
    if (!/[A-Z]/.test(password)) {
      setError('Password must contain at least one uppercase letter.'); return
    }
    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number.'); return
    }
    if (!/[^a-zA-Z0-9]/.test(password)) {
      setError('Password must contain at least one special character (!@#$%^&*).'); return
    }
    if (password !== passwordConfirm) {
      setError('Passwords do not match.'); return
    }
    if (!email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid email address.'); return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          workspace_name: businessName,
          username: email.toLowerCase().trim(),
          password,
          name: ownerName,
          email: email.toLowerCase().trim(),
          phone: phone || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed')

      localStorage.setItem('VURIUMBOOK_TOKEN', data.token)
      localStorage.setItem('VURIUMBOOK_USER', JSON.stringify({
        uid: data.user_id,
        username: email.toLowerCase().trim(),
        role: 'owner',
        name: ownerName,
        workspace_id: data.workspace_id,
      }))
      setAuthCookie('owner:' + data.user_id)
      setWsId(data.workspace_id)
      setStep(1)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const planLabels: Record<string, { label: string; color: string }> = {
    free: { label: '30-Day Free Trial', color: 'rgba(255,255,255,.6)' },
    individual: { label: 'Individual — $29/mo', color: 'rgba(255,255,255,.6)' },
    salon: { label: 'Salon — $79/mo', color: 'rgba(255,255,255,.6)' },
    custom: { label: 'Custom Plan', color: 'rgba(255,255,255,.6)' },
    // Legacy fallbacks
    starter: { label: 'Individual — $29/mo', color: 'rgba(255,255,255,.6)' },
    pro: { label: 'Salon — $79/mo', color: 'rgba(255,255,255,.6)' },
    enterprise: { label: 'Custom Plan', color: 'rgba(255,255,255,.6)' },
  }

  const planInfo = planLabels[plan] || planLabels.free

  const inp: React.CSSProperties = {
    width: '100%', padding: '14px 16px', borderRadius: 12,
    border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)',
    color: '#fff', fontSize: 15, outline: 'none', fontFamily: 'inherit',
    transition: 'border-color .2s',
  }

  const lbl: React.CSSProperties = {
    fontSize: 13, color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: 6,
  }

  const businessTypes = [
    'Barbershop', 'Hair Salon', 'Nail Studio', 'Beauty Salon',
    'Spa & Wellness', 'Tattoo Studio', 'Lash & Brow Bar', 'Other',
  ]

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

      <nav className="navbar">
        <a href="/" className="navbar-logo">
          <img src="/logo.jpg" alt="Vurium" />
          Vurium
        </a>
        <ul className="navbar-links">
          <li><a href="/vuriumbook">VuriumBook</a></li>
          <li><a href="/#about">About</a></li>
        </ul>
      </nav>

      <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'clamp(100px, 12vh, 140px) 20px 60px', position: 'relative', zIndex: 2 }}>

        {/* STEP 0: Registration Form */}
        {step === 0 && (
          <div className="fade-up" style={{ maxWidth: 480, width: '100%' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: planInfo.color, display: 'inline-block' }} />
                <span className="label-glow" style={{ color: planInfo.color }}>{planInfo.label}</span>
              </div>
              <h1 className="shimmer-text" style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 600, letterSpacing: '-.03em' }}>
                Create your workspace
              </h1>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,.35)', marginTop: 10, lineHeight: 1.5 }}>
                Set up VuriumBook for your business in under a minute.
              </p>
            </div>

            <form onSubmit={handleSignup}>
              <div className="glass-card" style={{ padding: '32px 28px' }}>
                {error && (
                  <div style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(220,80,80,.1)', border: '1px solid rgba(220,80,80,.2)', color: 'rgba(255,160,160,.9)', fontSize: 13, marginBottom: 20 }}>
                    {error}
                  </div>
                )}

                {/* Section: Your Business */}
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(130,150,220,.6)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Your Business</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
                  <div>
                    <label style={lbl}>Business Name *</label>
                    <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="e.g. Studio Glow, The Sharp Edge" required style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Business Type</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {businessTypes.map(t => (
                        <button key={t} type="button" onClick={() => setBusinessType(t)} style={{
                          padding: '7px 14px', borderRadius: 999, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
                          background: businessType === t ? 'rgba(130,150,220,.15)' : 'rgba(255,255,255,.03)',
                          border: `1px solid ${businessType === t ? 'rgba(130,150,220,.3)' : 'rgba(255,255,255,.07)'}`,
                          color: businessType === t ? 'rgba(130,150,220,.9)' : 'rgba(255,255,255,.4)',
                          transition: 'all .2s',
                        }}>{t}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Section: Your Account */}
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(130,220,170,.6)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Your Account</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
                  <div>
                    <label style={lbl}>Full Name *</label>
                    <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Your full name" required style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Email *</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@yourbusiness.com" required style={inp} />
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', marginTop: 4 }}>This will be your login</p>
                  </div>
                  <div>
                    <label style={lbl}>Phone (optional)</label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 123-4567" style={inp} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={lbl}>Password *</label>
                      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 chars" required minLength={8} style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>Confirm *</label>
                      <input type="password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} placeholder="Repeat" required style={inp} />
                    </div>
                  </div>
                  {password && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      {[
                        { ok: password.length >= 8, label: '8+ chars' },
                        { ok: /[A-Z]/.test(password), label: 'Uppercase' },
                        { ok: /[0-9]/.test(password), label: 'Number' },
                        { ok: /[^a-zA-Z0-9]/.test(password), label: 'Special' },
                      ].map((r, i) => (
                        <span key={i} style={{
                          fontSize: 10, padding: '3px 8px', borderRadius: 999,
                          background: r.ok ? 'rgba(130,220,170,.1)' : 'rgba(255,255,255,.03)',
                          border: `1px solid ${r.ok ? 'rgba(130,220,170,.2)' : 'rgba(255,255,255,.06)'}`,
                          color: r.ok ? 'rgba(130,220,170,.8)' : 'rgba(255,255,255,.25)',
                        }}>{r.ok ? '✓' : '○'} {r.label}</span>
                      ))}
                    </div>
                  )}
                </div>

                <button type="submit" disabled={loading} className="btn-primary" style={{
                  width: '100%', fontSize: 15, fontFamily: 'inherit',
                  opacity: loading ? 0.5 : 1,
                }}>
                  {loading ? 'Creating workspace...' : 'Create Workspace — Free'}
                </button>

                <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'rgba(255,255,255,.2)', lineHeight: 1.5 }}>
                  By creating an account you agree to our Terms of Service.
                </p>
              </div>
            </form>

            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,.25)' }}>
              Already have an account? <a href="/signin" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Sign in</a>
            </p>
          </div>
        )}

        {/* STEP 1: Success */}
        {step === 1 && (
          <div className="fade-up" style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
            <div className="glass-card" style={{ padding: '48px 32px' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 999, margin: '0 auto 24px',
                background: 'rgba(130,220,170,.12)', border: '2px solid rgba(130,220,170,.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: 'rgba(130,220,170,.8)',
              }}>&#10003;</div>

              <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: '#e8e8ed' }}>Welcome to VuriumBook!</h2>
              <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
                Your workspace <strong style={{ color: 'rgba(255,255,255,.7)' }}>{businessName}</strong> is ready.
              </p>

              {/* Workspace ID card */}
              <div style={{ padding: '16px 20px', borderRadius: 14, background: 'rgba(130,150,220,.06)', border: '1px solid rgba(130,150,220,.15)', marginBottom: 28, textAlign: 'left' }}>
                <div style={{ fontSize: 11, color: 'rgba(130,150,220,.6)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>Your Workspace ID</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(130,150,220,.9)', fontFamily: 'monospace', wordBreak: 'break-all' }}>{wsId}</div>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 8, lineHeight: 1.4 }}>
                  Save this! Your team members will need it to sign in.
                </p>
                <button type="button" onClick={() => { navigator.clipboard.writeText(wsId); }} style={{
                  marginTop: 10, padding: '8px 16px', borderRadius: 8, fontSize: 12, fontFamily: 'inherit',
                  background: 'rgba(130,150,220,.1)', border: '1px solid rgba(130,150,220,.2)',
                  color: 'rgba(130,150,220,.8)', cursor: 'pointer',
                }}>Copy to Clipboard</button>
              </div>

              {/* Login info */}
              <div style={{ padding: '14px 20px', borderRadius: 14, background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)', marginBottom: 28, textAlign: 'left', fontSize: 13 }}>
                <div style={{ color: 'rgba(255,255,255,.35)', marginBottom: 4 }}>Login: <strong style={{ color: 'rgba(255,255,255,.6)' }}>{email}</strong></div>
                <div style={{ color: 'rgba(255,255,255,.35)' }}>Role: <strong style={{ color: 'rgba(130,220,170,.7)' }}>Owner</strong></div>
              </div>

              <a href="/dashboard" className="btn-primary" style={{ width: '100%', fontSize: 15, justifyContent: 'center' }}>
                Go to Dashboard →
              </a>
            </div>
          </div>
        )}

      </main>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,.05)', padding: '20px clamp(20px, 4vw, 48px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2, flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>&copy; 2026 Vurium. All rights reserved.</span>
        <a href="https://vurium.com/vuriumbook" target="_blank" rel="noopener" style={{ fontSize: 11, color: 'rgba(255,255,255,.15)', textDecoration: 'none' }}>Powered by VuriumBook</a>
      </footer>
    </>
  )
}
