'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { API } from '@/lib/api'
import { setAuthCookie } from '@/lib/auth-cookie'

export default function InvitePage() {
  const params = useParams()
  const token = params.token as string
  const [step, setStep] = useState<'loading' | 'join' | 'register' | 'error'>('loading')
  const [invite, setInvite] = useState<any>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`${API}/api/invitations/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); setStep('error'); return }
        setInvite(data)
        setEmail(data.email || '')
        const existingToken = localStorage.getItem('VURIUMBOOK_TOKEN')
        setStep(existingToken ? 'join' : 'register')
      })
      .catch(() => { setError('Invalid invite link'); setStep('error') })
  }, [token])

  async function handleJoin() {
    setLoading(true); setError('')
    try {
      const authToken = localStorage.getItem('VURIUMBOOK_TOKEN') || ''
      const res = await fetch(`${API}/api/workspaces/${invite.workspace_id}/join`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ invite_token: token }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to join')
      if (data.token) localStorage.setItem('VURIUMBOOK_TOKEN', data.token)
      if (data.user) {
        localStorage.setItem('VURIUMBOOK_USER', JSON.stringify(data.user))
        setAuthCookie(data.user.role + ':' + (data.user.uid || ''))
      }
      window.location.href = '/dashboard'
    } catch (err: any) { setError(err.message) }
    setLoading(false)
  }

  async function handleRegisterAndJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password || !name) { setError('All fields required'); return }
    setLoading(true); setError('')
    try {
      // Register account
      const regRes = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, invite_token: token }),
      })
      const regData = await regRes.json()
      if (!regRes.ok) throw new Error(regData.error || 'Registration failed')
      if (regData.token) localStorage.setItem('VURIUMBOOK_TOKEN', regData.token)
      if (regData.user) {
        localStorage.setItem('VURIUMBOOK_USER', JSON.stringify(regData.user))
        setAuthCookie(regData.user.role + ':' + (regData.user.uid || ''))
      }
      window.location.href = '/dashboard'
    } catch (err: any) { setError(err.message) }
    setLoading(false)
  }

  const card: React.CSSProperties = {
    width: '100%', maxWidth: 400, borderRadius: 24,
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

  if (step === 'loading') return <div style={card}><div style={{ textAlign: 'center', color: 'rgba(255,255,255,.40)' }}>Loading invite...</div></div>
  if (step === 'error') return (
    <div style={card}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#f5f5f7', marginBottom: 12 }}>Invalid Invite</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.40)', marginBottom: 20 }}>{error}</div>
        <a href="/signin" style={{ color: '#8b9aff', fontSize: 13, textDecoration: 'none' }}>Go to sign in</a>
      </div>
    </div>
  )

  return (
    <div style={card}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', color: '#f5f5f7', marginBottom: 6 }}>
          VuriumBook
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.40)' }}>
          You&apos;ve been invited to join <strong style={{ color: '#8b9aff' }}>{invite?.workspace_name || 'a workspace'}</strong>
        </div>
        {invite?.role && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.30)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.08em' }}>
            as {invite.role}
          </div>
        )}
      </div>

      {step === 'join' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && <div style={{ fontSize: 12, color: '#ffd0d0', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,107,107,.22)', background: 'rgba(255,107,107,.06)' }}>{error}</div>}
          <button onClick={handleJoin} disabled={loading} style={{
            height: 46, borderRadius: 12, border: 'none', background: '#fff', color: '#000',
            fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? .5 : 1,
          }}>
            {loading ? 'Joining...' : 'Join workspace'}
          </button>
        </div>
      ) : (
        <form onSubmit={handleRegisterAndJoin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={lbl}>Your name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" style={inp} /></div>
          <div><label style={lbl}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" style={inp} /></div>
          <div><label style={lbl}>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="min 6 characters" style={inp} /></div>
          {error && <div style={{ fontSize: 12, color: '#ffd0d0', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,107,107,.22)', background: 'rgba(255,107,107,.06)' }}>{error}</div>}
          <button type="submit" disabled={loading} style={{
            height: 46, borderRadius: 12, border: 'none', background: '#fff', color: '#000',
            fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? .5 : 1,
          }}>
            {loading ? 'Creating account...' : 'Create account & join'}
          </button>
        </form>
      )}
    </div>
  )
}
