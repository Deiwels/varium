'use client'
import { useState, useEffect } from 'react'

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setToken(params.get('token') || '')
    setWs(params.get('ws') || '')
    setUid(params.get('uid') || '')
  }, [])

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

  const inp: React.CSSProperties = { width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: '#fff', fontSize: 15, outline: 'none', fontFamily: 'inherit' }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'Inter, system-ui, sans-serif', color: '#e8e8ed' }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '40px 32px', borderRadius: 24, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)' }}>
        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>✓</div>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Password Reset</h2>
            <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 14, marginBottom: 24 }}>Your password has been updated successfully.</p>
            <a href="/signin" style={{ display: 'inline-block', padding: '12px 28px', borderRadius: 12, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', color: '#e8e8ed', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>Sign In →</a>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, textAlign: 'center' }}>New Password</h2>
            <p style={{ color: 'rgba(255,255,255,.35)', fontSize: 13, textAlign: 'center', marginBottom: 24 }}>Min 8 characters, letter + number</p>
            {error && <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,107,107,.08)', border: '1px solid rgba(255,107,107,.15)', color: 'rgba(255,160,160,.8)', fontSize: 13, marginBottom: 16 }}>{error}</div>}
            <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="New password" required style={inp} />
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm password" required style={inp} />
              <button type="submit" disabled={loading} style={{ height: 48, borderRadius: 12, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.08)', color: '#e8e8ed', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.5 : 1 }}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
