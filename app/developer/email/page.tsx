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

function adminFetch(path: string, opts?: RequestInit) {
  return fetch(`${API}${path}`, {
    credentials: 'include',
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) },
  }).then(r => r.json())
}

interface Email {
  id: string; direction: string; from: string; to: string
  subject: string; body_html: string; body_text: string
  status: string; read: boolean; created_at: string
}

export default function AdminEmailPage() {
  const [emails, setEmails] = useState<Email[]>([])
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<Email | null>(null)
  const [composing, setComposing] = useState(false)
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)

  function loadEmails() {
    setLoading(true)
    adminFetch(`/api/vurium-dev/emails?direction=${filter}&limit=100`)
      .then(d => setEmails(d.emails || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadEmails() }, [filter])

  async function handleSend() {
    if (!to || !subject) return
    setSending(true)
    try {
      await adminFetch('/api/vurium-dev/email/send', {
        method: 'POST',
        body: JSON.stringify({ to, subject, body_html: body.replace(/\n/g, '<br>') }),
      })
      setTo(''); setSubject(''); setBody('')
      setComposing(false)
      loadEmails()
    } catch (e) {
      alert('Failed to send: ' + (e as any)?.message)
    } finally {
      setSending(false)
    }
  }

  async function openEmail(email: Email) {
    setSelected(email)
    setComposing(false)
    if (!email.read && email.direction === 'inbound') {
      await adminFetch(`/api/vurium-dev/emails/${email.id}`, { method: 'PATCH', body: JSON.stringify({ read: true }) }).catch(() => {})
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, read: true } : e))
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,.85)', margin: 0 }}>Email</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginTop: 4 }}>Send and receive branded emails</p>
        </div>
        <button onClick={() => { setComposing(true); setSelected(null) }} style={{
          height: 36, padding: '0 20px', borderRadius: 999, border: 'none', cursor: 'pointer',
          background: 'rgba(130,150,220,.15)', color: 'rgba(130,150,220,.9)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
        }}>+ Compose</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, minHeight: 500 }}>
        {/* Inbox list */}
        <div style={{ ...card, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Filter tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.06)', padding: '0 4px' }}>
            {['all', 'inbound', 'outbound'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 600, fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '.08em',
                color: filter === f ? 'rgba(130,150,220,.9)' : 'rgba(255,255,255,.3)',
                background: 'transparent', borderBottom: filter === f ? '2px solid rgba(130,150,220,.5)' : '2px solid transparent',
              }}>{f}</button>
            ))}
          </div>

          {/* Email list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.2)', fontSize: 12 }}>Loading...</div>
            ) : emails.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.2)', fontSize: 12 }}>No emails</div>
            ) : emails.map(e => (
              <div key={e.id} onClick={() => openEmail(e)} style={{
                padding: '12px 16px', cursor: 'pointer',
                borderBottom: '1px solid rgba(255,255,255,.04)',
                background: selected?.id === e.id ? 'rgba(130,150,220,.06)' : 'transparent',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: e.read ? 400 : 700, color: 'rgba(255,255,255,.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                    {e.direction === 'inbound' ? e.from : `To: ${e.to}`}
                  </span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', flexShrink: 0 }}>{fmtDate(e.created_at)}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: e.read ? 400 : 600, color: e.read ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.subject}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                  <span style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: 4, fontWeight: 600, letterSpacing: '.05em',
                    background: e.direction === 'inbound' ? 'rgba(130,220,170,.1)' : 'rgba(130,150,220,.1)',
                    color: e.direction === 'inbound' ? 'rgba(130,220,170,.7)' : 'rgba(130,150,220,.7)',
                  }}>{e.direction === 'inbound' ? 'IN' : 'OUT'}</span>
                  {!e.read && e.direction === 'inbound' && (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(130,150,220,.8)', alignSelf: 'center' }} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel: compose or detail */}
        <div style={{ ...card, padding: '24px 28px' }}>
          {composing ? (
            <>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,.7)', marginTop: 0, marginBottom: 16 }}>New Email</h2>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: 4 }}>To</label>
                <input value={to} onChange={e => setTo(e.target.value)} placeholder="recipient@example.com" style={inp} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: 4 }}>Subject</label>
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" style={inp} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: 4 }}>Body</label>
                <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message..." rows={10}
                  style={{ ...inp, height: 'auto', padding: '10px 12px', resize: 'vertical', lineHeight: 1.6 }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleSend} disabled={sending || !to || !subject} style={{
                  height: 40, padding: '0 28px', borderRadius: 999, border: 'none', cursor: 'pointer',
                  background: 'rgba(130,150,220,.2)', color: 'rgba(130,150,220,.95)', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                  opacity: sending || !to || !subject ? 0.4 : 1,
                }}>{sending ? 'Sending...' : 'Send'}</button>
                <button onClick={() => setComposing(false)} style={{
                  height: 40, padding: '0 20px', borderRadius: 999, border: '1px solid rgba(255,255,255,.1)',
                  background: 'transparent', color: 'rgba(255,255,255,.4)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
                }}>Cancel</button>
              </div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', marginTop: 12 }}>
                Emails are sent from noreply@vurium.com with Vurium dark cosmos branding.
              </p>
            </>
          ) : selected ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,.8)', margin: 0 }}>{selected.subject}</h2>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginTop: 4 }}>
                    {selected.direction === 'inbound' ? `From: ${selected.from}` : `To: ${selected.to}`}
                    {' \u00B7 '}{new Date(selected.created_at).toLocaleString()}
                  </p>
                </div>
                <span style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 6, fontWeight: 600,
                  background: selected.direction === 'inbound' ? 'rgba(130,220,170,.1)' : 'rgba(130,150,220,.1)',
                  color: selected.direction === 'inbound' ? 'rgba(130,220,170,.7)' : 'rgba(130,150,220,.7)',
                }}>{selected.direction}</span>
              </div>
              <div style={{
                borderRadius: 12, border: '1px solid rgba(255,255,255,.06)', padding: 20,
                background: 'rgba(0,0,0,.2)', fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,.6)',
                overflow: 'auto', maxHeight: 500,
              }}>
                {selected.body_html ? (
                  <div dangerouslySetInnerHTML={{ __html: selected.body_html }} />
                ) : (
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{selected.body_text || '(empty)'}</pre>
                )}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,.2)', fontSize: 13 }}>
              Select an email or compose a new one
            </div>
          )}
        </div>
      </div>
    </>
  )
}
