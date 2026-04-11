'use client'
import { useEffect, useState } from 'react'
import { API } from '@/lib/api'

const card: React.CSSProperties = {
  borderRadius: 16, border: '1px solid rgba(255,255,255,.06)',
  background: 'rgba(255,255,255,.03)', backdropFilter: 'blur(12px)',
}
const inp: React.CSSProperties = {
  width: '100%', height: 40, borderRadius: 10, border: '1px solid rgba(255,255,255,.10)',
  background: 'rgba(0,0,0,.25)', color: '#fff', padding: '0 12px', outline: 'none',
  fontSize: 13, fontFamily: 'inherit',
}

function devFetch(path: string, opts?: RequestInit) {
  return fetch(`${API}${path}`, {
    credentials: 'include',
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) },
  }).then(r => r.json())
}

const MAILBOXES = [
  { email: 'support@vurium.com', label: 'Support', desc: 'Technical issues, account help, general questions', color: 'rgba(130,150,220,.7)', icon: 'M3 8l9 6 9-6' },
  { email: 'billing@vurium.com', label: 'Billing', desc: 'Invoices, subscription changes, payment issues', color: 'rgba(130,220,170,.7)', icon: 'M3 6h18M3 12h18M3 18h18' },
  { email: 'sales@vurium.com', label: 'Sales', desc: 'Demos, pricing, enterprise plans', color: 'rgba(220,170,100,.7)', icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5' },
  { email: 'security@vurium.com', label: 'Security & Legal', desc: 'Vulnerability reports, legal inquiries, GDPR/CCPA', color: 'rgba(220,130,160,.7)', icon: 'M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z' },
]

interface SentEmail {
  id: string; direction: string; from: string; to: string
  subject: string; body_html: string; body_text: string
  status: string; read: boolean; created_at: string
}

export default function AdminEmailPage() {
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([])
  const [composing, setComposing] = useState(false)
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    devFetch('/api/vurium-dev/emails?direction=outbound&limit=20')
      .then(d => setSentEmails(d.emails || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleSend() {
    if (!to || !subject) return
    setSending(true)
    try {
      await devFetch('/api/vurium-dev/email/send', {
        method: 'POST',
        body: JSON.stringify({ to, subject, body_html: body.replace(/\n/g, '<br>') }),
      })
      setTo(''); setSubject(''); setBody('')
      setComposing(false)
      // Reload sent
      devFetch('/api/vurium-dev/emails?direction=outbound&limit=20')
        .then(d => setSentEmails(d.emails || []))
        .catch(() => {})
    } catch (e) {
      alert('Failed to send: ' + (e as any)?.message)
    } finally {
      setSending(false)
    }
  }

  const fmtDate = (iso: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,.85)', margin: 0 }}>Email</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginTop: 4 }}>Mailboxes and branded email</p>
        </div>
        <button onClick={() => setComposing(!composing)} style={{
          height: 36, padding: '0 20px', borderRadius: 999, border: 'none', cursor: 'pointer',
          background: 'rgba(130,150,220,.15)', color: 'rgba(130,150,220,.9)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
        }}>{composing ? 'Cancel' : '+ Compose'}</button>
      </div>

      {/* Compose */}
      {composing && (
        <div style={{ ...card, padding: '24px 28px', marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,.7)', marginTop: 0, marginBottom: 16 }}>New Branded Email</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: 4 }}>To</label>
              <input value={to} onChange={e => setTo(e.target.value)} placeholder="recipient@example.com" style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: 4 }}>Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" style={inp} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: 4 }}>Body</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message..." rows={6}
              style={{ ...inp, height: 'auto', padding: '10px 12px', resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={handleSend} disabled={sending || !to || !subject} style={{
              height: 38, padding: '0 28px', borderRadius: 999, border: 'none', cursor: 'pointer',
              background: 'rgba(130,150,220,.2)', color: 'rgba(130,150,220,.95)', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              opacity: sending || !to || !subject ? 0.4 : 1,
            }}>{sending ? 'Sending...' : 'Send'}</button>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>From: noreply@vurium.com with Vurium branding</span>
          </div>
        </div>
      )}

      {/* Mailboxes */}
      <div style={{ marginBottom: 24 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: 12 }}>Mailboxes (Google Workspace)</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {MAILBOXES.map(m => (
            <a key={m.email} href={`https://mail.google.com/mail/u/?authuser=${m.email}`} target="_blank" rel="noopener noreferrer" style={{
              ...card, padding: '18px 20px', textDecoration: 'none', display: 'flex', gap: 14, alignItems: 'flex-start',
              transition: 'border-color .15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,.12)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,.06)')}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: m.color.replace('.7)', '.08)'), display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={m.icon} /></svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,.75)', marginBottom: 2 }}>{m.label}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginBottom: 4 }}>{m.email}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', lineHeight: 1.4 }}>{m.desc}</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginLeft: 'auto', flexShrink: 0, marginTop: 2 }}>
                <path d="M6 3l5 5-5 5" stroke="rgba(255,255,255,.15)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          ))}
        </div>
      </div>

      {/* Sent emails */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Sent (Branded via Resend)</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.15)' }}>from noreply@vurium.com</span>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.2)', fontSize: 12 }}>Loading...</div>
        ) : sentEmails.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.2)', fontSize: 12 }}>No sent emails yet</div>
        ) : sentEmails.map(e => (
          <div key={e.id} style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ color: 'rgba(255,255,255,.3)', marginRight: 6 }}>To:</span>{e.to}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{e.subject}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, marginLeft: 12 }}>
              <span style={{
                fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 600,
                background: e.status === 'sent' ? 'rgba(130,220,170,.1)' : 'rgba(220,100,100,.1)',
                color: e.status === 'sent' ? 'rgba(130,220,170,.7)' : 'rgba(220,100,100,.7)',
              }}>{e.status}</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>{fmtDate(e.created_at)}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
