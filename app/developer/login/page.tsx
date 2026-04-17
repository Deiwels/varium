'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getDevApiBase } from '../_lib/dev-fetch'

export default function DevLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isLocalDev, setIsLocalDev] = useState(false)
  const devApiBase = getDevApiBase()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const host = window.location.hostname
    setIsLocalDev(host === '127.0.0.1' || host === 'localhost')
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setLoading(true); setError('')
    try {
      await fetch(`${devApiBase}/api/vurium-dev/auth/request`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setSent(true)
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{
        width: '100%', maxWidth: 380, borderRadius: 20,
        border: '1px solid rgba(255,255,255,.08)',
        background: 'rgba(255,255,255,.03)', 
        padding: '40px 32px', textAlign: 'center',
      }}>
        <img src="/logo.jpg" alt="Vurium" style={{ width: 48, height: 48, borderRadius: 12, marginBottom: 16 }} />
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'rgba(255,255,255,.85)', margin: '0 0 6px' }}>Developer</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.3)', margin: '0 0 28px' }}>
          {isLocalDev ? 'Use local owner access or request a magic link.' : 'Sign in with a magic link'}
        </p>

        {isLocalDev && !sent && (
          <div style={{ marginBottom: 16 }}>
            <a
              href="/developer/local-access"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%', height: 44, borderRadius: 12, border: 'none',
                background: 'rgba(130,220,170,.15)', color: 'rgba(130,220,170,.95)',
                fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              Continue as local owner
            </a>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,.28)', margin: '10px 0 0', lineHeight: 1.5 }}>
              Localhost mode uses a direct local-access route, so you do not have to wait for a magic-link email just to use the operator panel.
            </p>
          </div>
        )}

        {!isLocalDev && sent ? (
          <div style={{
            padding: '20px 16px', borderRadius: 14,
            background: 'rgba(130,220,170,.06)', border: '1px solid rgba(130,220,170,.12)',
          }}>
            <p style={{ fontSize: 14, color: 'rgba(130,220,170,.8)', fontWeight: 600, margin: '0 0 6px' }}>Check your email</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', margin: 0, lineHeight: 1.5 }}>
              If the email is authorized, you will receive a sign-in link. It expires in 15 minutes.
            </p>
          </div>
        ) : !isLocalDev ? (
          <form onSubmit={handleSubmit}>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com" autoFocus required
              style={{
                width: '100%', height: 44, borderRadius: 12,
                border: '1px solid rgba(255,255,255,.10)', background: 'rgba(0,0,0,.3)',
                color: '#fff', padding: '0 14px', outline: 'none',
                fontSize: 14, fontFamily: 'inherit', marginBottom: 12,
                boxSizing: 'border-box',
              }}
            />
            {error && <p style={{ fontSize: 12, color: 'rgba(220,100,100,.8)', margin: '0 0 12px' }}>{error}</p>}
            <button type="submit" disabled={loading || !email} style={{
              width: '100%', height: 44, borderRadius: 12, border: 'none',
              background: 'rgba(130,150,220,.15)', color: 'rgba(130,150,220,.95)',
              fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
              opacity: loading || !email ? 0.4 : 1,
            }}>
              {loading ? 'Sending...' : 'Send magic link'}
            </button>
          </form>
        ) : (
          <div style={{
            padding: '16px 14px',
            borderRadius: 14,
            background: 'rgba(255,255,255,.03)',
            border: '1px solid rgba(255,255,255,.06)',
          }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,.38)', margin: 0, lineHeight: 1.6 }}>
              Magic-link login is hidden on localhost to keep the local operator panel clean. Use the local owner button above.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
