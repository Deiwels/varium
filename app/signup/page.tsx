'use client'
import { useEffect, useRef, useState } from 'react'
import { API, apiFetch } from '@/lib/api'
import { getTimezoneList, detectUserTimezone } from '@/lib/timezones'
import { setAuthCookie } from '@/lib/auth-cookie'
import { loadStripe, Appearance } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

// ─── Native iOS detection ───────────────────────────────────────────────────
declare global {
  interface Window {
    __VURIUM_IS_NATIVE?: boolean
    webkit?: { messageHandlers?: {
      purchase?: { postMessage: (msg: any) => void }
      restore?: { postMessage: (msg: any) => void }
    } }
  }
}

// ─── Stripe setup ───────────────────────────────────────────────────────────
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
const stripePromise = STRIPE_PK ? loadStripe(STRIPE_PK) : null

const stripeAppearance: Appearance = {
  theme: 'night',
  variables: {
    colorPrimary: 'rgba(255,255,255,.85)',
    colorBackground: '#0d0d0d',
    colorText: '#e8e8ed',
    colorTextSecondary: 'rgba(255,255,255,.45)',
    colorDanger: 'rgba(220,130,160,.8)',
    borderRadius: '12px',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSizeBase: '14px',
    colorTextPlaceholder: 'rgba(255,255,255,.25)',
  },
  rules: {
    '.Input': { border: '1px solid rgba(255,255,255,.10)', backgroundColor: 'rgba(255,255,255,.04)', boxShadow: 'none' },
    '.Input:focus': { border: '1px solid rgba(255,255,255,.25)', boxShadow: '0 0 0 1px rgba(255,255,255,.08)' },
    '.Label': { color: 'rgba(255,255,255,.45)', fontSize: '12px', fontWeight: '500' },
    '.Tab': { border: '1px solid rgba(255,255,255,.08)', backgroundColor: 'rgba(255,255,255,.03)', color: 'rgba(255,255,255,.50)' },
    '.Tab--selected': { border: '1px solid rgba(255,255,255,.18)', backgroundColor: 'rgba(255,255,255,.06)', color: '#e8e8ed' },
    '.Error': { color: 'rgba(220,130,160,.8)' },
  },
}

const SIGNUP_PLANS = [
  { id: 'individual', name: 'Individual', price: 29, desc: 'For solo professionals' },
  { id: 'salon', name: 'Salon', price: 79, desc: 'For teams up to 10', featured: true },
  { id: 'custom', name: 'Custom', price: 99, desc: 'Unlimited team + payroll' },
]

// ─── Inline Checkout Form ───────────────────────────────────────────────────
function SignupCheckoutForm({ planId, planPrice, planName, onSuccess }: { planId: string; planPrice: number; planName: string; onSuccess: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setProcessing(true); setError('')
    const { error: submitErr } = await elements.submit()
    if (submitErr) { setError(submitErr.message || 'Validation failed'); setProcessing(false); return }
    // Try confirmSetup first (for trial subscriptions), fall back to confirmPayment
    const { error: err } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: `${window.location.origin}/dashboard?billing=success` },
      redirect: 'if_required',
    }).catch(() => stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/dashboard?billing=success` },
      redirect: 'if_required',
    }))
    if (err) { setError(err.message || 'Payment failed'); setProcessing(false); return }
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 20 }}>
        <PaymentElement options={{ layout: 'tabs', defaultValues: { billingDetails: { address: { country: 'US' } } } }} />
      </div>
      {error && <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(220,130,160,.08)', border: '1px solid rgba(220,130,160,.15)', color: 'rgba(220,130,160,.8)', fontSize: 13, marginBottom: 16 }}>{error}</div>}
      <button type="submit" disabled={!stripe || processing} style={{
        width: '100%', height: 50, borderRadius: 999, border: '1px solid rgba(255,255,255,.15)',
        background: '#000', color: 'rgba(255,255,255,.85)', fontSize: 15, fontWeight: 600,
        cursor: processing ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: processing ? 0.5 : 1,
      }}>
        {processing ? 'Processing...' : `Start 14-Day Free Trial — then $${planPrice}/mo`}
      </button>
      <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,.15)', lineHeight: 1.6 }}>
        No charge for 14 days · Cancel anytime · Secured by Stripe
      </div>
      <div style={{ textAlign: 'center', marginTop: 8, fontSize: 10, color: 'rgba(255,255,255,.12)', lineHeight: 1.6 }}>
        Subscription automatically renews unless cancelled at least 24 hours before the end of the current period.
      </div>
    </form>
  )
}

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
  const [timezone, setTimezone] = useState('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [plan, setPlan] = useState('free')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [wsId, setWsId] = useState('')
  const [selectedPlan, setSelectedPlan] = useState<string>('salon')
  const [clientSecret, setClientSecret] = useState('')
  // 10DLC business info for Salon/Custom plans
  const [bizInfo, setBizInfo] = useState({
    company_name: '', display_name: '', ein: '', entity_type: 'PRIVATE_PROFIT',
    vertical: 'PROFESSIONAL', website: '', phone: '', email: '',
    street: '', city: '', state: '', postal_code: '', country: 'US',
    first_name: '', last_name: '', date_of_birth: '', mobile_phone: '',
  })
  const [smsRegLoading, setSmsRegLoading] = useState(false)
  const [smsRegError, setSmsRegError] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [appleLoading, setAppleLoading] = useState(false)
  const [verifyCode, setVerifyCode] = useState('')
  const [verifySending, setVerifySending] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [verifyResent, setVerifyResent] = useState(false)
  const [smsConsent, setSmsConsent] = useState(false)
  const [termsConsent, setTermsConsent] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const p = params.get('plan')
    if (p) setPlan(p)
    // If redirected from Google/Apple Sign In for new user — go straight to plan selection
    const stepParam = params.get('step')
    if (stepParam === 'plan') setStep(1)
    setTimezone(detectUserTimezone())
  }, [])

  // Listen for Apple IAP results
  useEffect(() => {
    const onSuccess = () => { setAppleLoading(false); setStep(2) }
    const onError = (e: any) => { setAppleLoading(false); const msg = e?.detail?.error; if (msg && msg !== 'cancelled') setError('Purchase failed: ' + msg) }
    window.addEventListener('vuriumPurchaseSuccess', onSuccess)
    window.addEventListener('vuriumPurchaseError', onError)
    return () => { window.removeEventListener('vuriumPurchaseSuccess', onSuccess); window.removeEventListener('vuriumPurchaseError', onError) }
  }, [])

  useEffect(() => {
    // Hide global cosmos — this page has its own .space-bg
    const cosmos = document.getElementById('vurium-cosmos')
    if (cosmos) cosmos.style.display = 'none'

    const isMobile = window.matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, running = false
    let idleTimer: ReturnType<typeof setTimeout> | null = null

    const far = document.querySelector('.stars-far') as HTMLElement
    const mid = document.querySelector('.stars-mid') as HTMLElement
    const near = document.querySelector('.stars-near') as HTMLElement

    function tick() {
      if (!running) return
      cx += (tx - cx) * 0.02; cy += (ty - cy) * 0.02
      if (Math.abs(tx - cx) < 0.001 && Math.abs(ty - cy) < 0.001) { running = false; return }
      if (far) far.style.transform = `translate(${cx * 8}px, ${cy * 8}px)`
      if (mid) mid.style.transform = `translate(${cx * 20}px, ${cy * 20}px)`
      if (near) near.style.transform = `translate(${cx * 35}px, ${cy * 35}px)`
      raf = requestAnimationFrame(tick)
    }
    function startLoop() { if (!running) { running = true; raf = requestAnimationFrame(tick) } }
    function onVisibility() { if (document.hidden) { running = false; cancelAnimationFrame(raf) } }
    document.addEventListener('visibilitychange', onVisibility)

    if (isMobile) {
      function onO(e: DeviceOrientationEvent) { const g = Math.max(-15, Math.min(15, e.gamma || 0)); const b = Math.max(-15, Math.min(15, (e.beta || 0) - 45)); tx = g / 15 * 4; ty = b / 15 * 4; startLoop() }
      const doe = DeviceOrientationEvent as any
      if (typeof doe.requestPermission === 'function') { const r = () => { doe.requestPermission().then((s: string) => { if (s === 'granted') window.addEventListener('deviceorientation', onO, { passive: true }) }).catch(() => {}); document.removeEventListener('click', r) }; document.addEventListener('click', r, { once: true }) }
      else { window.addEventListener('deviceorientation', onO, { passive: true }) }
      return () => { window.removeEventListener('deviceorientation', onO); document.removeEventListener('visibilitychange', onVisibility); cancelAnimationFrame(raf); if (cosmos) cosmos.style.display = '' }
    }
    function onMouse(e: MouseEvent) { tx = (e.clientX / window.innerWidth - 0.5) * 2; ty = (e.clientY / window.innerHeight - 0.5) * 2; startLoop(); if (idleTimer) clearTimeout(idleTimer); idleTimer = setTimeout(() => { running = false }, 2000) }
    window.addEventListener('mousemove', onMouse, { passive: true })
    return () => { window.removeEventListener('mousemove', onMouse); document.removeEventListener('visibilitychange', onVisibility); cancelAnimationFrame(raf); if (idleTimer) clearTimeout(idleTimer); if (cosmos) cosmos.style.display = '' }
  }, [])

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!businessName || !email || !password || !ownerName || !timezone) {
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
    if (!smsConsent) {
      setError('Please agree to receive the SMS verification code to continue.'); return
    }
    if (!termsConsent) {
      setError('Please confirm you are at least 16 and agree to the Terms of Service and Privacy Policy.'); return
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
          timezone,
          business_type: businessType || undefined,
          shop_name: businessName,
          shop_address: `${street}, ${city}, ${state} ${zip}`,
          street, city, state, postal_code: zip,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'email_exists') {
          setError('email_exists')
          setLoading(false)
          return
        }
        throw new Error(data.message || data.error || 'Registration failed')
      }

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
      setStep(1) // Go directly to plan selection — SMS is auto-enabled
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const planLabels: Record<string, { label: string; color: string }> = {
    free: { label: '14-Day Free Trial', color: 'rgba(255,255,255,.6)' },
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

  const isNative = typeof window !== 'undefined' && (window as any).__VURIUM_IS_NATIVE

  return (
    <div style={{ overflowX: 'hidden', width: '100%', maxWidth: '100vw' }}>
      {/* Fix navbar + content safe area for native iOS */}
      {isNative && <style>{`
        .navbar { padding-top: env(safe-area-inset-top, 0px) !important; height: calc(56px + env(safe-area-inset-top, 0px)) !important; }
        .signup-main { padding-top: calc(env(safe-area-inset-top, 0px) + clamp(100px, 12vh, 140px)) !important; padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 60px) !important; }
      `}</style>}
      <div className="space-bg" ref={spaceRef}>
        <div className="stars-wrap stars-wrap-far"><div className="stars stars-far" /></div>
        <div className="stars-wrap stars-wrap-mid"><div className="stars stars-mid" /></div>
        <div className="stars-wrap stars-wrap-near"><div className="stars stars-near" /></div>
        <div className="shooting-star shooting-star-1" />
        <div className="nebula-layer" style={{ width: 800, height: 450, top: '6%', left: '-14%', background: 'radial-gradient(ellipse at center, rgba(30,45,110,.12) 0%, transparent 70%)' }} />
        <div className="nebula-layer" style={{ width: 550, height: 300, top: '35%', right: '-10%', background: 'radial-gradient(ellipse at center, rgba(55,35,100,.08) 0%, transparent 70%)', animationDelay: '.5s' }} />
      </div>
      <div className="noise-overlay" />

      <nav className="navbar">
        <a href="/" className="navbar-logo">
          <img src="/logo.jpg" alt="Vurium" />
          Vurium
        </a>
        <ul className="navbar-links">
          <li><a href="/vuriumbook">VuriumBook</a></li>
          <li><a href="/about">About</a></li>
          <li><a href="/blog">Blog</a></li>
          <li><a href="/contact">Contact</a></li>
        </ul>
      </nav>

      <main className="signup-main" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'clamp(100px, 12vh, 140px) 20px 60px', position: 'relative', zIndex: 2 }}>

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
                Set up VuriumBook&trade; for your business in under a minute.
              </p>
            </div>

            <form onSubmit={handleSignup}>
              <div className="glass-card" style={{ padding: '32px 28px' }}>
                {error && (
                  <div style={{ padding: '12px 16px', borderRadius: 12, background: error === 'email_exists' ? 'rgba(255,255,255,.06)' : 'rgba(220,80,80,.1)', border: `1px solid ${error === 'email_exists' ? 'rgba(255,255,255,.12)' : 'rgba(220,80,80,.2)'}`, color: error === 'email_exists' ? '#e8e8ed' : 'rgba(255,160,160,.9)', fontSize: 13, marginBottom: 20 }}>
                    {error === 'email_exists' ? (
                      <div>
                        <div style={{ marginBottom: 8 }}>An account with this email already exists.</div>
                        <a href="/signin" style={{ display: 'inline-block', padding: '8px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.08)', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>Sign In →</a>
                      </div>
                    ) : error}
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
                  <div>
                    <label style={lbl}>Timezone *</label>
                    <select value={timezone} onChange={e => setTimezone(e.target.value)} required style={inp}>
                      <option value="" disabled>Select your timezone</option>
                      {getTimezoneList().map(tz => (
                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Business Address *</label>
                    <input type="text" value={street} onChange={e => setStreet(e.target.value)} placeholder="Street address" required style={inp} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={lbl}>City *</label>
                      <input type="text" value={city} onChange={e => setCity(e.target.value)} required style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>State *</label>
                      <input type="text" value={state} onChange={e => setState(e.target.value)} placeholder="IL" maxLength={2} required style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>ZIP *</label>
                      <input type="text" value={zip} onChange={e => setZip(e.target.value)} placeholder="60089" required style={inp} />
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
                    <label style={lbl}>Mobile Phone *</label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 123-4567" required style={inp} />
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                  <label htmlFor="terms-consent" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                    <input
                      id="terms-consent"
                      type="checkbox"
                      checked={termsConsent}
                      onChange={e => setTermsConsent(e.target.checked)}
                      style={{ marginTop: 3, width: 16, height: 16, accentColor: 'rgba(130,220,170,.7)', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', lineHeight: 1.5 }}>
                      I confirm I am at least 16 years old and agree to the <a href="/terms" target="_blank" rel="noopener" style={{ color: 'rgba(130,150,220,.6)', textDecoration: 'none' }}>Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener" style={{ color: 'rgba(130,150,220,.6)', textDecoration: 'none' }}>Privacy Policy</a>.
                    </span>
                  </label>
                  <label htmlFor="sms-auth-consent" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                    <input
                      id="sms-auth-consent"
                      type="checkbox"
                      checked={smsConsent}
                      onChange={e => setSmsConsent(e.target.checked)}
                      style={{ marginTop: 3, width: 16, height: 16, accentColor: 'rgba(130,220,170,.7)', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', lineHeight: 1.5 }}>
                      I authorize VuriumBook&trade; to send appointment-related text messages to my clients on my behalf when enabled in my booking settings. I am responsible for using SMS features lawfully and only where my clients have provided consent.
                    </span>
                  </label>
                </div>

                <button type="submit" disabled={loading || !termsConsent || !smsConsent} className="btn-primary" style={{
                  width: '100%', fontSize: 15, fontFamily: 'inherit',
                  opacity: loading || !termsConsent || !smsConsent ? 0.5 : 1,
                  cursor: loading || !termsConsent || !smsConsent ? 'not-allowed' : 'pointer',
                }}>
                  {loading ? 'Creating workspace...' : 'Create Workspace'}
                </button>
              </div>
            </form>

            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,.25)' }}>
              Already have an account? <a href="/signin" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Sign in</a>
            </p>
          </div>
        )}

        {/* STEP 0.5: Phone Verification */}
        {step === (0.5 as any) && (
          <div className="fade-up" style={{ maxWidth: 440, width: '100%' }}>
            <div className="glass-card" style={{ padding: '36px 28px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>&#128241;</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8ed', marginBottom: 8 }}>Verify your phone</h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,.35)', marginBottom: 24, lineHeight: 1.5 }}>
                We sent a 6-digit code to <strong style={{ color: 'rgba(255,255,255,.6)' }}>{phone}</strong>. Enter it below to continue.
              </p>
              {verifyError && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(220,80,80,.1)', border: '1px solid rgba(220,80,80,.2)', color: 'rgba(255,160,160,.9)', fontSize: 13, marginBottom: 16 }}>
                  {verifyError}
                </div>
              )}
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={verifyCode}
                onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                style={{
                  ...inp, textAlign: 'center', fontSize: 28, fontWeight: 700, letterSpacing: '.3em',
                  maxWidth: 220, margin: '0 auto 20px',
                }}
              />
              <button
                type="button"
                disabled={verifyCode.length !== 6 || verifySending}
                onClick={async () => {
                  setVerifySending(true); setVerifyError('')
                  try {
                    const res = await fetch(`${API}/public/verify/check/${wsId}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ phone: phone.replace(/\D/g, ''), code: verifyCode }),
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error || 'Invalid code')
                    setStep(1) // Proceed to plan selection
                  } catch (err: any) {
                    setVerifyError(err.message || 'Verification failed')
                  } finally {
                    setVerifySending(false)
                  }
                }}
                className="btn-primary"
                style={{ width: '100%', fontSize: 15, fontFamily: 'inherit', opacity: (verifyCode.length !== 6 || verifySending) ? 0.5 : 1 }}
              >
                {verifySending ? 'Verifying...' : 'Verify & Continue'}
              </button>
              <button
                type="button"
                disabled={verifyResent}
                onClick={async () => {
                  try {
                    await fetch(`${API}/public/verify/send/${wsId}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ phone: phone.replace(/\D/g, '') }),
                    })
                    setVerifyResent(true)
                    setTimeout(() => setVerifyResent(false), 30000)
                  } catch {}
                }}
                style={{
                  marginTop: 16, background: 'none', border: 'none', color: verifyResent ? 'rgba(255,255,255,.15)' : 'rgba(130,150,220,.6)',
                  fontSize: 13, cursor: verifyResent ? 'default' : 'pointer', fontFamily: 'inherit',
                }}
              >
                {verifyResent ? 'Code sent! Wait 30s to resend' : 'Resend code'}
              </button>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,.15)', marginTop: 20, lineHeight: 1.5 }}>
                Msg &amp; data rates may apply. Reply STOP to opt out, HELP for help. <a href="/privacy" style={{ color: 'rgba(130,150,220,.4)', textDecoration: 'none' }}>Privacy Policy</a>
              </p>
            </div>
          </div>
        )}

        {/* STEP 1: Choose Plan & Payment */}
        {step === 1 && (
          <div className="fade-up" style={{ maxWidth: 440, width: '100%' }}>
            <div className="glass-card" style={{ padding: 'clamp(24px, 5vw, 36px) clamp(16px, 4vw, 28px)' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: '#e8e8ed', textAlign: 'center' }}>Choose Your Plan</h2>
              <p style={{ color: 'rgba(255,255,255,.35)', fontSize: 13, textAlign: 'center', marginBottom: 24, lineHeight: 1.5 }}>
                Try free for 14 days. After that, you&#39;ll be charged automatically. Cancel anytime.
              </p>

              {/* Plan selector */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                {SIGNUP_PLANS.map(p => (
                  <button key={p.id} type="button" onClick={() => { setSelectedPlan(p.id); setClientSecret('') }}
                    style={{
                      flex: 1, padding: 'clamp(12px, 3vw, 16px) clamp(10px, 2.5vw, 14px)', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                      border: `1.5px solid ${selectedPlan === p.id ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.08)'}`,
                      background: selectedPlan === p.id ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.02)',
                      transition: 'all .2s', minWidth: 0,
                    }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: selectedPlan === p.id ? '#e8e8ed' : 'rgba(255,255,255,.50)', marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', marginBottom: 6 }}>{p.desc}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: selectedPlan === p.id ? '#e8e8ed' : 'rgba(255,255,255,.40)' }}>
                      ${p.price}<span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,.20)' }}>/mo</span>
                    </div>
                    {p.featured && <div style={{ marginTop: 4, fontSize: 9, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(130,220,170,.6)' }}>POPULAR</div>}
                  </button>
                ))}
              </div>

              {/* Native iOS: trigger Apple IAP with free trial */}
              {typeof window !== 'undefined' && window.__VURIUM_IS_NATIVE ? (
                <>
                  <button type="button" disabled={appleLoading} onClick={() => {
                    if (window.webkit?.messageHandlers?.purchase) {
                      setAppleLoading(true); setError('')
                      window.webkit.messageHandlers.purchase.postMessage({ plan: selectedPlan })
                    }
                  }} style={{
                    width: '100%', height: 48, borderRadius: 999, border: '1px solid rgba(130,220,170,.25)',
                    background: 'rgba(130,220,170,.1)', color: 'rgba(130,220,170,.85)', fontSize: 14, fontWeight: 600,
                    cursor: appleLoading ? 'wait' : 'pointer', fontFamily: 'inherit',
                    opacity: appleLoading ? 0.5 : 1,
                  }}>
                    {appleLoading ? 'Processing...' : `Subscribe — ${SIGNUP_PLANS.find(p => p.id === selectedPlan)?.price ? '$' + SIGNUP_PLANS.find(p => p.id === selectedPlan)?.price + '/mo' : ''} with 14-Day Free Trial`}
                  </button>
                  <div style={{ textAlign: 'center', marginTop: 12, fontSize: 10, color: 'rgba(255,255,255,.15)', lineHeight: 1.6 }}>
                    No charge for 14 days · Cancel anytime
                  </div>
                  <div style={{ textAlign: 'center', marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,.12)', lineHeight: 1.6 }}>
                    Subscription automatically renews unless cancelled at least 24 hours before the end of the current period. You can manage and cancel your subscriptions in your Apple ID Settings.
                  </div>
                  <div style={{ textAlign: 'center', marginTop: 10, display: 'flex', justifyContent: 'center', gap: 16 }}>
                    <a href="/privacy" style={{ fontSize: 11, color: 'rgba(255,255,255,.20)', textDecoration: 'none' }}>Privacy Policy</a>
                    <a href="/terms" style={{ fontSize: 11, color: 'rgba(255,255,255,.20)', textDecoration: 'none' }}>Terms of Service</a>
                  </div>
                </>
              ) : (
                <>
                  {/* Load Stripe Elements for selected plan */}
                  {!clientSecret && (
                    <button type="button" disabled={checkoutLoading} onClick={async () => {
                      setCheckoutLoading(true); setError('')
                      try {
                        const data = await apiFetch('/api/billing/create-subscription', {
                          method: 'POST', body: JSON.stringify({ plan: selectedPlan }),
                        })
                        if (data.clientSecret) setClientSecret(data.clientSecret)
                        else throw new Error('Failed to initialize payment')
                      } catch (e: any) { setError(e.message || 'Failed to start checkout') }
                      setCheckoutLoading(false)
                    }} style={{
                      width: '100%', height: 48, borderRadius: 999, border: '1px solid rgba(255,255,255,.15)',
                      background: '#000', color: 'rgba(255,255,255,.85)', fontSize: 14, fontWeight: 600,
                      cursor: checkoutLoading ? 'wait' : 'pointer', fontFamily: 'inherit',
                      opacity: checkoutLoading ? 0.5 : 1,
                    }}>
                      {checkoutLoading ? 'Loading...' : 'Continue to Payment'}
                    </button>
                  )}

                  {clientSecret && stripePromise && (
                    <Elements stripe={stripePromise} options={{ clientSecret, appearance: stripeAppearance, loader: 'auto' }}>
                      <SignupCheckoutForm
                        planId={selectedPlan}
                        planPrice={SIGNUP_PLANS.find(p => p.id === selectedPlan)?.price || 79}
                        planName={SIGNUP_PLANS.find(p => p.id === selectedPlan)?.name || 'Salon'}
                        onSuccess={() => setStep(2)}
                      />
                    </Elements>
                  )}
                </>
              )}

              {error && <div style={{ marginTop: 14, padding: '8px 12px', borderRadius: 10, background: 'rgba(220,130,160,.08)', border: '1px solid rgba(220,130,160,.15)', color: 'rgba(220,130,160,.8)', fontSize: 12 }}>{error}</div>}
            </div>
          </div>
        )}

        {/* STEP 2: Success */}
        {/* STEP 1.5: Business Info for SMS Registration (Salon/Custom) */}
        {step === (1.5 as any) && (
          <div className="fade-up" style={{ maxWidth: 480, width: '100%' }}>
            <div className="glass-card" style={{ padding: '32px 28px' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: '#e8e8ed', textAlign: 'center' }}>SMS Setup</h2>
              <p style={{ color: 'rgba(255,255,255,.35)', fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
                Enter your business details to enable SMS appointment reminders for your clients.
              </p>

              {smsRegError && <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(220,80,80,.1)', border: '1px solid rgba(220,80,80,.2)', color: 'rgba(255,160,160,.9)', fontSize: 13, marginBottom: 16 }}>{smsRegError}</div>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: 4 }}>Legal Business Name *</label><input style={inp} value={bizInfo.company_name || businessName} onChange={e => setBizInfo(p => ({ ...p, company_name: e.target.value }))} /></div>
                  <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: 4 }}>Display Name</label><input style={inp} value={bizInfo.display_name || businessName} onChange={e => setBizInfo(p => ({ ...p, display_name: e.target.value }))} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: 4 }}>Entity Type *</label>
                    <select style={inp} value={bizInfo.entity_type} onChange={e => setBizInfo(p => ({ ...p, entity_type: e.target.value }))}>
                      <option value="PRIVATE_PROFIT">Private Company</option>
                      <option value="SOLE_PROPRIETOR">Sole Proprietor (no EIN)</option>
                      <option value="PUBLIC_PROFIT">Public Company</option>
                      <option value="NON_PROFIT">Non-Profit</option>
                    </select>
                  </div>
                  <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: 4 }}>EIN / Tax ID {bizInfo.entity_type === 'SOLE_PROPRIETOR' ? '(optional)' : '*'}</label><input style={inp} value={bizInfo.ein} onChange={e => setBizInfo(p => ({ ...p, ein: e.target.value }))} placeholder="XX-XXXXXXX" /></div>
                </div>
                <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: 4 }}>Street Address *</label><input style={inp} value={bizInfo.street} onChange={e => setBizInfo(p => ({ ...p, street: e.target.value }))} placeholder="123 Main St" /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
                  <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: 4 }}>City *</label><input style={inp} value={bizInfo.city} onChange={e => setBizInfo(p => ({ ...p, city: e.target.value }))} /></div>
                  <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: 4 }}>State *</label><input style={inp} value={bizInfo.state} onChange={e => setBizInfo(p => ({ ...p, state: e.target.value }))} maxLength={2} placeholder="IL" /></div>
                  <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: 4 }}>ZIP *</label><input style={inp} value={bizInfo.postal_code} onChange={e => setBizInfo(p => ({ ...p, postal_code: e.target.value }))} placeholder="60089" /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: 4 }}>Business Phone *</label><input style={inp} value={bizInfo.phone || phone} onChange={e => setBizInfo(p => ({ ...p, phone: e.target.value }))} /></div>
                  <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: 4 }}>Business Email *</label><input style={inp} value={bizInfo.email || email} onChange={e => setBizInfo(p => ({ ...p, email: e.target.value }))} /></div>
                </div>

                {bizInfo.entity_type === 'SOLE_PROPRIETOR' && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,180,80,.5)', letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 6 }}>Owner Verification</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: 4 }}>First Name *</label><input style={inp} value={bizInfo.first_name} onChange={e => setBizInfo(p => ({ ...p, first_name: e.target.value }))} /></div>
                      <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: 4 }}>Last Name *</label><input style={inp} value={bizInfo.last_name} onChange={e => setBizInfo(p => ({ ...p, last_name: e.target.value }))} /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: 4 }}>Date of Birth</label><input type="date" style={inp} value={bizInfo.date_of_birth} onChange={e => setBizInfo(p => ({ ...p, date_of_birth: e.target.value }))} /></div>
                      <div><label style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: 4 }}>Mobile (for OTP) *</label><input style={inp} value={bizInfo.mobile_phone || phone} onChange={e => setBizInfo(p => ({ ...p, mobile_phone: e.target.value }))} /></div>
                    </div>
                  </>
                )}

                <button disabled={smsRegLoading} onClick={async () => {
                  setSmsRegLoading(true); setSmsRegError('')
                  try {
                    const payload = { ...bizInfo }
                    if (!payload.company_name) payload.company_name = businessName
                    if (!payload.display_name) payload.display_name = businessName
                    if (!payload.phone) payload.phone = phone
                    if (!payload.email) payload.email = email
                    payload.website = `https://vurium.com/book/${wsId}`
                    const res = await fetch(`${API}/api/sms/register`, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                      body: JSON.stringify(payload),
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error || 'Registration failed')
                    // If SP OTP needed, stay here; otherwise go to welcome
                    if (data.step === 'otp_sent') {
                      setSmsRegError('Verification code sent to your phone. Check Settings → Booking → SMS to enter the code.')
                      setTimeout(() => setStep(2), 3000)
                    } else {
                      setStep(2)
                    }
                  } catch (e: any) {
                    setSmsRegError(e.message || 'Failed')
                  } finally {
                    setSmsRegLoading(false)
                  }
                }} className="btn-primary" style={{ width: '100%', fontSize: 15, fontFamily: 'inherit', opacity: smsRegLoading ? 0.5 : 1, marginTop: 8 }}>
                  {smsRegLoading ? 'Registering...' : 'Register & Continue'}
                </button>

                <button onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.25)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
                  Skip for now — I&apos;ll set up SMS later
                </button>

                <p style={{ fontSize: 10, color: 'rgba(255,255,255,.12)', textAlign: 'center', lineHeight: 1.5, marginTop: 4 }}>
                  SMS registration costs: ~$4.50 brand + $15 campaign review. Approval takes 5-10 business days for businesses with EIN, instant for sole proprietors.
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="fade-up" style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
            <div className="glass-card" style={{ padding: '48px 32px' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 999, margin: '0 auto 24px',
                background: 'rgba(130,220,170,.12)', border: '2px solid rgba(130,220,170,.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: 'rgba(130,220,170,.8)',
              }}>&#10003;</div>

              <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8, color: '#e8e8ed' }}>Welcome to VuriumBook&trade;!</h2>
              <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 14, lineHeight: 1.7, marginBottom: 32 }}>
                Your workspace <strong style={{ color: 'rgba(255,255,255,.7)' }}>{businessName}</strong> is ready.
              </p>

              <div style={{ padding: '14px 20px', borderRadius: 14, background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)', marginBottom: 28, textAlign: 'left', fontSize: 13 }}>
                <div style={{ color: 'rgba(255,255,255,.35)' }}>Signed in as <strong style={{ color: 'rgba(255,255,255,.6)' }}>{email}</strong></div>
              </div>

              <a href="/dashboard" className="btn-primary" style={{ width: '100%', fontSize: 15, justifyContent: 'center' }}>
                Go to Dashboard →
              </a>
            </div>
          </div>
        )}

      </main>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,.05)', position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 24px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 32, marginBottom: 32 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.25)', marginBottom: 12 }}>Company</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <a href="/about" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>About</a>
                <a href="/careers" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>Careers</a>
                <a href="/contact" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>Contact</a>
              </div>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.25)', marginBottom: 12 }}>Product</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <a href="/vuriumbook" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>VuriumBook</a>
                <a href="/vuriumbook#pricing" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>Pricing</a>
                <a href="/faq" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>FAQ</a>
              </div>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.25)', marginBottom: 12 }}>Resources</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <a href="/blog" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>Blog</a>
                <a href="/support" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>Support</a>
              </div>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.25)', marginBottom: 12 }}>Legal</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <a href="/privacy" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>Privacy</a>
                <a href="/terms" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>Terms</a>
                <a href="/cookies" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>Cookies</a>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,.04)', paddingTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>&copy; 2026 Vurium&trade;. All rights reserved.</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.15)' }}>support@vurium.com</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
