'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { API } from '@/lib/api'

interface Email {
  id: string; direction: string; from: string; to: string
  subject: string; body_html: string; body_text: string
  status: string; read: boolean; created_at: string
}

export default function EmailDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [email, setEmail] = useState<Email | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('vurium_dev_token') || ''
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    fetch(`${API}/api/vurium-dev/emails/${id}`, {
      credentials: 'include',
      headers,
    })
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => { setEmail(d); setLoading(false) })
      .catch(() => router.push('/developer/email'))
  }, [id, router])

  if (loading || !email) return null

  return (
    <>
      <button onClick={() => router.push('/developer/email')} style={{
        background: 'none', border: 'none', color: 'rgba(130,150,220,.7)', fontSize: 13,
        cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16, padding: 0,
      }}>&larr; Back to inbox</button>

      <div style={{
        borderRadius: 16, border: '1px solid rgba(255,255,255,.06)',
        background: 'rgba(255,255,255,.03)', padding: '24px 28px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: 'rgba(255,255,255,.85)', margin: 0 }}>{email.subject}</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginTop: 6 }}>
              <strong style={{ color: 'rgba(255,255,255,.55)' }}>From:</strong> {email.from}
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>
              <strong style={{ color: 'rgba(255,255,255,.55)' }}>To:</strong> {email.to}
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,.25)', marginTop: 4 }}>
              {new Date(email.created_at).toLocaleString()}
            </p>
          </div>
          <span style={{
            fontSize: 10, padding: '4px 10px', borderRadius: 6, fontWeight: 600,
            background: email.direction === 'inbound' ? 'rgba(130,220,170,.1)' : 'rgba(130,150,220,.1)',
            color: email.direction === 'inbound' ? 'rgba(130,220,170,.7)' : 'rgba(130,150,220,.7)',
          }}>{email.direction}</span>
        </div>

        <div style={{
          borderRadius: 12, border: '1px solid rgba(255,255,255,.06)', padding: 24,
          background: 'rgba(0,0,0,.2)', fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,.6)',
          overflow: 'auto',
        }}>
          {email.body_html ? (
            <div dangerouslySetInnerHTML={{ __html: email.body_html }} />
          ) : (
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{email.body_text || '(empty)'}</pre>
          )}
        </div>
      </div>
    </>
  )
}
