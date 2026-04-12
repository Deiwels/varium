'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { API } from '@/lib/api'

export default function DevVerifyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) { setStatus('error'); setErrorMsg('Missing token'); return }

    fetch(`${API}/api/vurium-dev/auth/verify`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async r => {
        if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Verification failed') }
        setStatus('success')
        setTimeout(() => router.replace('/developer'), 1000)
      })
      .catch(e => { setStatus('error'); setErrorMsg(e.message || 'Verification failed') })
  }, [searchParams, router])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{
        width: '100%', maxWidth: 380, borderRadius: 20,
        border: '1px solid rgba(255,255,255,.08)',
        background: 'rgba(255,255,255,.03)', 
        padding: '40px 32px', textAlign: 'center',
      }}>
        {status === 'verifying' && (
          <>
            <div style={{ fontSize: 32, marginBottom: 12 }}>&#8987;</div>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.5)' }}>Verifying...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div style={{ fontSize: 32, marginBottom: 12 }}>&#9989;</div>
            <p style={{ fontSize: 14, color: 'rgba(130,220,170,.8)', fontWeight: 600 }}>Signed in successfully</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>Redirecting to dashboard...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: 32, marginBottom: 12 }}>&#10060;</div>
            <p style={{ fontSize: 14, color: 'rgba(220,100,100,.8)', fontWeight: 600, margin: '0 0 8px' }}>{errorMsg}</p>
            <a href="/developer/login" style={{
              display: 'inline-block', marginTop: 16, padding: '10px 24px', borderRadius: 999,
              background: 'rgba(130,150,220,.12)', color: 'rgba(130,150,220,.9)',
              fontSize: 13, fontWeight: 600, textDecoration: 'none',
            }}>Try again</a>
          </>
        )}
      </div>
    </div>
  )
}
