'use client'
import { useEffect, useRef, useState } from 'react'
import { API } from '@/lib/api'
import { setAuthCookie } from '@/lib/auth-cookie'

export default function SignupPage() {
  const spaceRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState(0) // 0=form, 1=success
  const [workspaceName, setWorkspaceName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [plan, setPlan] = useState('free')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const p = params.get('plan')
    if (p) setPlan(p)
  }, [])

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

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!workspaceName || !username || !password) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          workspace_name: workspaceName,
          username,
          password,
          email: email || undefined,
          phone: phone || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Signup failed')
      // Save token and user
      localStorage.setItem('VURIUMBOOK_TOKEN', data.token)
      localStorage.setItem('VURIUMBOOK_USER', JSON.stringify({
        uid: data.user_id,
        username,
        role: 'owner',
        name: username,
        workspace_id: data.workspace_id,
      }))
      setAuthCookie('owner:' + data.user_id)
      setStep(1)
      // Redirect to dashboard after 2s
      setTimeout(() => {
        window.location.href = '/dashboard'
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const planLabels: Record<string, string> = {
    free: 'Free Trial',
    starter: 'Starter — $29/mo',
    pro: 'Pro — $79/mo',
    enterprise: 'Enterprise',
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '14px 16px', borderRadius: 12,
    border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)',
    color: '#fff', fontSize: 15, outline: 'none', fontFamily: 'inherit',
    transition: 'border-color .2s',
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

        {step === 0 && (
          <div className="fade-up" style={{ maxWidth: 440, width: '100%' }}>
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: 'rgba(130,220,170,.7)', display: 'inline-block' }} />
                <span className="label-glow" style={{ color: 'rgba(130,220,170,.8)' }}>{planLabels[plan] || 'Get Started'}</span>
              </div>
              <h1 className="shimmer-text" style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 600, letterSpacing: '-.03em' }}>
                Create your workspace
              </h1>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,.35)', marginTop: 10 }}>
                Set up VuriumBook for your business in seconds.
              </p>
            </div>

            <form onSubmit={handleSignup}>
              <div className="glass-card" style={{ padding: '32px 28px' }}>
                {error && (
                  <div style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(220,80,80,.1)', border: '1px solid rgba(220,80,80,.2)', color: 'rgba(255,160,160,.9)', fontSize: 13, marginBottom: 20 }}>
                    {error}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: 6 }}>Business Name *</label>
                    <input type="text" value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} placeholder="My Barbershop" required style={inp} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: 6 }}>Username *</label>
                    <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" required style={inp} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: 6 }}>Password *</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 4 characters" required minLength={4} style={inp} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: 6 }}>Email (optional)</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@business.com" style={inp} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: 6 }}>Phone (optional)</label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 123-4567" style={inp} />
                  </div>
                </div>

                <button type="submit" disabled={loading || !workspaceName || !username || !password} className="btn-primary" style={{
                  width: '100%', marginTop: 28, fontSize: 15, fontFamily: 'inherit',
                  opacity: loading || !workspaceName || !username || !password ? 0.5 : 1,
                }}>
                  {loading ? 'Creating...' : 'Create Workspace'}
                </button>

                <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,.25)' }}>
                  Already have an account? <a href="/signin" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Sign in</a>
                </p>
              </div>
            </form>
          </div>
        )}

        {step === 1 && (
          <div className="fade-up" style={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
            <div className="glass-card" style={{ padding: '48px 32px' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 999, margin: '0 auto 24px',
                background: 'rgba(130,220,170,.12)', border: '2px solid rgba(130,220,170,.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: 'rgba(130,220,170,.8)',
              }}>&#10003;</div>
              <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: '#e8e8ed' }}>Welcome to VuriumBook!</h2>
              <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 14, lineHeight: 1.6 }}>
                Your workspace <strong style={{ color: 'rgba(255,255,255,.7)' }}>{workspaceName}</strong> is ready.
                <br />Redirecting to your dashboard...
              </p>
            </div>
          </div>
        )}

      </main>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,.05)', padding: '20px clamp(20px, 4vw, 48px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2, flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>&copy; 2026 Vurium. All rights reserved.</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.15)' }}>Powered by VuriumBook</span>
      </footer>
    </>
  )
}
