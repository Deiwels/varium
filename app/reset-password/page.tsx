'use client'
import { useState, useEffect, useRef } from 'react'

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://vuriumbook-api-431945333485.us-central1.run.app'

export default function ResetPasswordPage() {
  const [token, setToken] = useState('')
  const [ws, setWs] = useState('')
  const [uid, setUid] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const spaceRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setToken(params.get('token') || '')
    setWs(params.get('ws') || '')
    setUid(params.get('uid') || '')
  }, [])

  // Parallax handled by global CosmosParallax component — no duplicate rAF needed

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) { setError('Password must contain a letter and a number'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ws, uid, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setSuccess(true)
    } catch (err: any) { setError(err.message || 'Something went wrong') }
    setLoading(false)
  }

  // Password strength
  const checks = [
    { ok: password.length >= 8, label: '8+ characters' },
    { ok: /[a-zA-Z]/.test(password), label: 'Contains a letter' },
    { ok: /[0-9]/.test(password), label: 'Contains a number' },
    { ok: password.length > 0 && password === confirm, label: 'Passwords match' },
  ]

  const inp: React.CSSProperties = {
    width: '100%', padding: '14px 18px', borderRadius: 14,
    border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)',
    color: '#e8e8ed', fontSize: 15, outline: 'none', fontFamily: 'inherit',
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    transition: 'border-color .2s',
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'Inter, -apple-system, sans-serif', color: '#e8e8ed', position: 'relative' }}>

      <style>{`
        .rp-input:focus { border-color: rgba(255,255,255,.18) !important; }
        @keyframes rpFadeIn {
          from { opacity: 0; transform: translateY(12px) scale(.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes rpCheckIn {
          0% { opacity: 0; transform: scale(.5); }
          60% { transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
        .rp-card { animation: rpFadeIn .5s cubic-bezier(.16,1,.3,1) both; }
        .rp-success { animation: rpCheckIn .5s cubic-bezier(.16,1.2,.3,1) both; }
      `}</style>

      <div className="rp-card" style={{
        width: '100%', maxWidth: 420, padding: '44px 36px',
        borderRadius: 28, border: '1px solid rgba(255,255,255,.06)',
        background: 'rgba(255,255,255,.025)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 32px 80px rgba(0,0,0,.4), inset 0 0 0 .5px rgba(255,255,255,.04)',
        position: 'relative', zIndex: 2,
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
            <img src="/logo.jpg" alt="" style={{ width: 28, height: 28, borderRadius: 7, filter: 'invert(1)', opacity: 0.5 }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,.5)', letterSpacing: '-.02em' }}>VuriumBook</span>
          </div>
        </div>

        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div className="rp-success" style={{
              width: 64, height: 64, borderRadius: 999, margin: '0 auto 20px',
              background: 'rgba(130,220,170,.08)', border: '2px solid rgba(130,220,170,.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, color: 'rgba(130,220,170,.8)',
            }}>✓</div>
            <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Password Updated</h2>
            <p style={{ color: 'rgba(255,255,255,.35)', fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
              Your password has been reset successfully. You can now sign in with your new password.
            </p>
            <a href="/signin" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 32px', borderRadius: 14,
              background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)',
              color: '#e8e8ed', textDecoration: 'none', fontSize: 14, fontWeight: 600,
              transition: 'all .2s',
            }}>
              Sign In →
            </a>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4, textAlign: 'center', letterSpacing: '-.02em' }}>Reset Password</h2>
            <p style={{ color: 'rgba(255,255,255,.3)', fontSize: 13, textAlign: 'center', marginBottom: 28 }}>
              Create a new secure password for your account
            </p>

            {error && (
              <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(255,107,107,.06)', border: '1px solid rgba(255,107,107,.12)', color: 'rgba(255,160,160,.8)', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>!</span> {error}
              </div>
            )}

            <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>New Password</label>
                <input className="rp-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter new password" required style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Confirm Password</label>
                <input className="rp-input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm new password" required style={inp} />
              </div>

              {/* Password strength indicators */}
              {password && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                  {checks.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                      <div style={{ width: 14, height: 14, borderRadius: 999, border: `1px solid ${c.ok ? 'rgba(130,220,170,.3)' : 'rgba(255,255,255,.08)'}`, background: c.ok ? 'rgba(130,220,170,.1)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: 'rgba(130,220,170,.7)', transition: 'all .2s' }}>
                        {c.ok && '✓'}
                      </div>
                      <span style={{ color: c.ok ? 'rgba(130,220,170,.6)' : 'rgba(255,255,255,.25)', transition: 'color .2s' }}>{c.label}</span>
                    </div>
                  ))}
                </div>
              )}

              <button type="submit" disabled={loading || !checks.every(c => c.ok)} style={{
                height: 50, borderRadius: 14, border: '1px solid rgba(255,255,255,.12)',
                background: checks.every(c => c.ok) ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.02)',
                color: checks.every(c => c.ok) ? '#e8e8ed' : 'rgba(255,255,255,.25)',
                fontSize: 15, fontWeight: 600, cursor: checks.every(c => c.ok) ? 'pointer' : 'default',
                fontFamily: 'inherit', marginTop: 8, transition: 'all .2s',
                opacity: loading ? 0.5 : 1,
              }}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <a href="/signin" style={{ fontSize: 12, color: 'rgba(255,255,255,.25)', textDecoration: 'none' }}>← Back to Sign In</a>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,.05)', position: 'relative', zIndex: 2, width: '100%', marginTop: 'auto' }}>
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
