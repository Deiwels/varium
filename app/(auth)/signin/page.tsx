'use client'
import { useState } from 'react'
import { API } from '@/lib/api'
import { setAuthCookie } from '@/lib/auth-cookie'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { setError('Email and password required'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      const token = data.token || ''
      if (token) localStorage.setItem('VURIUMBOOK_TOKEN', token)
      const userData = data.user || {}
      localStorage.setItem('VURIUMBOOK_USER', JSON.stringify(userData))
      setAuthCookie(userData.role + ':' + (userData.uid || userData.account_id || ''))
      const redirect = new URLSearchParams(window.location.search).get('redirect') || '/dashboard'
      window.location.href = (userData.role === 'barber' || userData.role === 'student') ? '/calendar' : redirect
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  const card: React.CSSProperties = {
    width: '100%', maxWidth: 400,
    borderRadius: 24,
    border: '1px solid rgba(255,255,255,.08)',
    background: 'rgba(0,0,0,.60)',
    backdropFilter: 'saturate(180%) blur(40px)',
    WebkitBackdropFilter: 'saturate(180%) blur(40px)',
    padding: '40px 32px',
    boxShadow: '0 30px 80px rgba(0,0,0,.55), inset 0 0 0 0.5px rgba(255,255,255,.06)',
  }
  const inp: React.CSSProperties = {
    width: '100%', height: 46, borderRadius: 12,
    border: '1px solid rgba(255,255,255,.10)',
    background: 'rgba(255,255,255,.06)',
    color: '#fff', padding: '0 14px', outline: 'none',
    fontSize: 14, fontFamily: 'inherit',
  }
  const lbl: React.CSSProperties = {
    fontSize: 11, letterSpacing: '.10em', textTransform: 'uppercase',
    color: 'rgba(255,255,255,.40)', display: 'block', marginBottom: 6,
  }

  return (
    <div style={card}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', color: '#f5f5f7', marginBottom: 6 }}>
          VuriumBook
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.40)' }}>Sign in to your workspace</div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={lbl}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@business.com" style={inp} autoComplete="email" />
        </div>
        <div>
          <label style={lbl}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inp} autoComplete="current-password" />
        </div>

        {error && (
          <div style={{ fontSize: 12, color: '#ffd0d0', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,107,107,.22)', background: 'rgba(255,107,107,.06)' }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} style={{
          height: 46, borderRadius: 12, border: 'none',
          background: '#fff', color: '#000',
          fontSize: 14, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'inherit', opacity: loading ? .5 : 1,
          marginTop: 4,
        }}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <a href="/signup" style={{ fontSize: 13, color: '#8b9aff', textDecoration: 'none' }}>
          Don&apos;t have an account? Sign up
        </a>
      </div>
    </div>
  )
}
