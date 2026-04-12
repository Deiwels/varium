'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { API } from '@/lib/api'

const card: React.CSSProperties = {
  borderRadius: 16, border: '1px solid rgba(255,255,255,.06)',
  background: 'rgba(255,255,255,.03)',
}
const inp: React.CSSProperties = {
  width: '100%', height: 40, borderRadius: 10, border: '1px solid rgba(255,255,255,.10)',
  background: 'rgba(0,0,0,.25)', color: '#fff', padding: '0 12px', outline: 'none',
  fontSize: 13, fontFamily: 'inherit',
}
const btnPrimary: React.CSSProperties = {
  height: 36, padding: '0 24px', borderRadius: 999, border: 'none', cursor: 'pointer',
  background: 'rgba(130,150,220,.15)', color: 'rgba(130,150,220,.9)', fontSize: 13,
  fontWeight: 600, fontFamily: 'inherit',
}

function devFetch(path: string, opts?: RequestInit) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('vurium_dev_token') || '' : ''
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts?.headers as Record<string, string> || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(`${API}${path}`, { credentials: 'include', ...opts, headers }).then(r => r.json())
}

const MAILBOXES = [
  { email: 'support@vurium.com', label: 'Support', color: 'rgba(130,150,220,.7)', icon: 'M3 8l9 6 9-6' },
  { email: 'billing@vurium.com', label: 'Billing', color: 'rgba(130,220,170,.7)', icon: 'M3 6h18M3 12h18M3 18h18' },
  { email: 'sales@vurium.com', label: 'Sales', color: 'rgba(220,170,100,.7)', icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5' },
  { email: 'security@vurium.com', label: 'Security', color: 'rgba(220,130,160,.7)', icon: 'M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z' },
]

interface GmailMessage {
  id: string; threadId: string; snippet: string
  from: string; to: string; subject: string; date: string
  labelIds: string[]; isUnread: boolean
}

interface GmailMessageFull extends GmailMessage {
  messageId: string; body_html: string; body_text: string
}

interface SentEmail {
  id: string; direction: string; from: string; to: string
  subject: string; body_html: string; body_text: string
  status: string; read: boolean; created_at: string
}

type View = 'inbox' | 'detail' | 'compose-branded' | 'compose-gmail' | 'reply'

export default function AdminEmailPage() {
  const searchParams = useSearchParams()
  const [activeAccount, setActiveAccount] = useState(MAILBOXES[0].email)
  const [connectionStatus, setConnectionStatus] = useState<Record<string, boolean>>({})
  const [messages, setMessages] = useState<GmailMessage[]>([])
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)
  const [selectedMsg, setSelectedMsg] = useState<GmailMessageFull | null>(null)
  const [view, setView] = useState<View>('inbox')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Compose state
  const [composeTo, setComposeTo] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [sending, setSending] = useState(false)

  // Reply state
  const [replyBody, setReplyBody] = useState('')

  // Branded (Resend) sent emails
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([])

  const isConnected = connectionStatus[activeAccount]

  // Load connection status
  useEffect(() => {
    devFetch('/api/vurium-dev/gmail/status')
      .then(d => setConnectionStatus(d.status || {}))
      .catch(() => {})
  }, [])

  // Handle OAuth callback
  useEffect(() => {
    const connected = searchParams.get('connected')
    if (connected) {
      setConnectionStatus(prev => ({ ...prev, [connected]: true }))
      setActiveAccount(connected)
    }
  }, [searchParams])

  // Load messages when account changes
  const loadMessages = useCallback((account: string, pageToken?: string) => {
    if (!pageToken) { setLoading(true); setMessages([]) }
    else setLoadingMore(true)

    const params = new URLSearchParams({ account, maxResults: '20' })
    if (pageToken) params.set('pageToken', pageToken)
    if (searchQuery) params.set('q', searchQuery)

    devFetch(`/api/vurium-dev/gmail/messages?${params}`)
      .then(d => {
        if (d.needsAuth) return
        if (pageToken) setMessages(prev => [...prev, ...(d.messages || [])])
        else setMessages(d.messages || [])
        setNextPageToken(d.nextPageToken || null)
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setLoadingMore(false) })
  }, [searchQuery])

  useEffect(() => {
    if (isConnected) {
      setView('inbox')
      setSelectedMsg(null)
      loadMessages(activeAccount)
    }
  }, [activeAccount, isConnected, loadMessages])

  // Load branded sent emails
  useEffect(() => {
    devFetch('/api/vurium-dev/emails?direction=outbound&limit=20')
      .then(d => setSentEmails(d.emails || []))
      .catch(() => {})
  }, [])

  function openMessage(msg: GmailMessage) {
    setLoadingDetail(true)
    devFetch(`/api/vurium-dev/gmail/messages/${msg.id}?account=${activeAccount}`)
      .then(d => { setSelectedMsg(d); setView('detail') })
      .catch(() => {})
      .finally(() => setLoadingDetail(false))
  }

  function startReply() {
    if (!selectedMsg) return
    setReplyBody('')
    setView('reply')
  }

  async function handleReply() {
    if (!selectedMsg || !replyBody.trim()) return
    setSending(true)
    try {
      const fromAddr = selectedMsg.from.includes('<')
        ? selectedMsg.from.match(/<(.+)>/)?.[1] || selectedMsg.from
        : selectedMsg.from
      await devFetch('/api/vurium-dev/gmail/reply', {
        method: 'POST',
        body: JSON.stringify({
          account: activeAccount,
          to: fromAddr,
          subject: selectedMsg.subject.startsWith('Re:') ? selectedMsg.subject : `Re: ${selectedMsg.subject}`,
          body_html: replyBody.replace(/\n/g, '<br>'),
          threadId: selectedMsg.threadId,
          messageId: selectedMsg.messageId,
        }),
      })
      setView('detail')
      setReplyBody('')
    } catch {
      alert('Failed to send reply')
    } finally {
      setSending(false)
    }
  }

  async function handleGmailSend() {
    if (!composeTo || !composeSubject) return
    setSending(true)
    try {
      await devFetch('/api/vurium-dev/gmail/send', {
        method: 'POST',
        body: JSON.stringify({
          account: activeAccount,
          to: composeTo,
          subject: composeSubject,
          body_html: composeBody.replace(/\n/g, '<br>'),
        }),
      })
      setComposeTo(''); setComposeSubject(''); setComposeBody('')
      setView('inbox')
      loadMessages(activeAccount)
    } catch {
      alert('Failed to send email')
    } finally {
      setSending(false)
    }
  }

  async function handleBrandedSend() {
    if (!composeTo || !composeSubject) return
    setSending(true)
    try {
      await devFetch('/api/vurium-dev/email/send', {
        method: 'POST',
        body: JSON.stringify({ to: composeTo, subject: composeSubject, body_html: composeBody.replace(/\n/g, '<br>') }),
      })
      setComposeTo(''); setComposeSubject(''); setComposeBody('')
      setView('inbox')
      devFetch('/api/vurium-dev/emails?direction=outbound&limit=20')
        .then(d => setSentEmails(d.emails || []))
        .catch(() => {})
    } catch {
      alert('Failed to send email')
    } finally {
      setSending(false)
    }
  }

  function connectMailbox() {
    devFetch(`/api/vurium-dev/gmail/auth?account=${activeAccount}`)
      .then(d => { if (d.url) window.location.href = d.url })
      .catch(() => alert('Failed to start OAuth'))
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    loadMessages(activeAccount)
  }

  const fmtDate = (s: string) => {
    if (!s) return ''
    const d = new Date(s)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const activeMailbox = MAILBOXES.find(m => m.email === activeAccount)!

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,.85)', margin: 0 }}>Email</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginTop: 4 }}>Gmail inboxes & branded email</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setComposeTo(''); setComposeSubject(''); setComposeBody(''); setView('compose-branded') }}
            style={{ ...btnPrimary, background: 'rgba(220,170,100,.12)', color: 'rgba(220,170,100,.85)' }}>
            + Branded
          </button>
          {isConnected && (
            <button onClick={() => { setComposeTo(''); setComposeSubject(''); setComposeBody(''); setView('compose-gmail') }}
              style={btnPrimary}>
              + Compose
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, minHeight: 500 }}>
        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '.1em', padding: '0 8px', marginBottom: 4 }}>Mailboxes</span>
          {MAILBOXES.map(m => {
            const active = m.email === activeAccount
            const connected = connectionStatus[m.email]
            return (
              <button key={m.email} onClick={() => setActiveAccount(m.email)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
                background: active ? 'rgba(255,255,255,.06)' : 'transparent',
                transition: 'background .15s',
              }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,.03)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                  background: connected ? m.color : 'rgba(255,255,255,.1)',
                }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.label}</div>
                  {!connected && <div style={{ fontSize: 9, color: 'rgba(255,255,255,.2)', marginTop: 1 }}>Not connected</div>}
                </div>
              </button>
            )
          })}

          <div style={{ height: 1, background: 'rgba(255,255,255,.06)', margin: '8px 0' }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '.1em', padding: '0 8px', marginBottom: 4 }}>Sent (Resend)</span>
          <button onClick={() => setView('inbox')} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
            border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
            background: 'transparent', transition: 'background .15s', fontSize: 12, color: 'rgba(255,255,255,.4)',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.03)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{ width: 8, height: 8, borderRadius: 4, flexShrink: 0, background: 'rgba(220,170,100,.5)' }} />
            Branded history ({sentEmails.length})
          </button>
        </div>

        {/* Main content */}
        <div style={{ ...card, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Not connected state */}
          {!isConnected && view === 'inbox' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: activeMailbox.color.replace('.7)', '.08)'),
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={activeMailbox.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={activeMailbox.icon} /></svg>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,.7)', marginBottom: 4 }}>{activeMailbox.label} Inbox</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.3)' }}>{activeAccount}</div>
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.3)', textAlign: 'center', maxWidth: 320, lineHeight: 1.6 }}>
                Connect this Gmail account to view and reply to emails directly from the Developer panel.
              </p>
              <button onClick={connectMailbox} style={{
                ...btnPrimary, height: 40, padding: '0 28px',
                background: activeMailbox.color.replace('.7)', '.15)'),
                color: activeMailbox.color.replace('.7)', '.9)'),
              }}>Connect Gmail</button>
            </div>
          )}

          {/* Inbox list */}
          {isConnected && view === 'inbox' && (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <form onSubmit={handleSearch} style={{ flex: 1, display: 'flex', gap: 8 }}>
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder={`Search ${activeMailbox.label.toLowerCase()}...`}
                    style={{ ...inp, height: 34, fontSize: 12 }} />
                  <button type="submit" style={{ ...btnPrimary, height: 34, padding: '0 14px', fontSize: 12, flexShrink: 0 }}>Search</button>
                </form>
                <button onClick={() => loadMessages(activeAccount)} style={{
                  width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(255,255,255,.08)',
                  background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }} title="Refresh">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                  </svg>
                </button>
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                {loading ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.2)', fontSize: 12 }}>Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.2)', fontSize: 12 }}>No messages found</div>
                ) : (
                  <>
                    {messages.map(m => (
                      <button key={m.id} onClick={() => openMessage(m)} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', width: '100%',
                        borderBottom: '1px solid rgba(255,255,255,.03)', background: 'transparent',
                        border: 'none', borderBlockEnd: '1px solid rgba(255,255,255,.03)',
                        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                        transition: 'background .1s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.03)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <div style={{
                          width: 6, height: 6, borderRadius: 3, flexShrink: 0,
                          background: m.isUnread ? activeMailbox.color : 'transparent',
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                            <span style={{
                              fontSize: 13, color: m.isUnread ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.55)',
                              fontWeight: m.isUnread ? 600 : 400,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>{m.from.replace(/<.*>/, '').trim() || m.from}</span>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', flexShrink: 0 }}>{fmtDate(m.date)}</span>
                          </div>
                          <div style={{
                            fontSize: 13, color: m.isUnread ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.4)',
                            fontWeight: m.isUnread ? 500 : 400,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{m.subject || '(no subject)'}</div>
                          <div style={{
                            fontSize: 12, color: 'rgba(255,255,255,.2)', marginTop: 2,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{m.snippet}</div>
                        </div>
                      </button>
                    ))}
                    {nextPageToken && (
                      <div style={{ padding: 16, textAlign: 'center' }}>
                        <button onClick={() => loadMessages(activeAccount, nextPageToken)} disabled={loadingMore}
                          style={{ ...btnPrimary, fontSize: 12, height: 32, opacity: loadingMore ? 0.5 : 1 }}>
                          {loadingMore ? 'Loading...' : 'Load more'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {/* Email detail */}
          {view === 'detail' && selectedMsg && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => { setView('inbox'); setSelectedMsg(null) }} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
                  color: 'rgba(130,150,220,.7)', fontSize: 13, fontFamily: 'inherit',
                }}>&larr; Back</button>
                <div style={{ flex: 1 }} />
                <button onClick={startReply} style={{ ...btnPrimary, height: 32, padding: '0 16px', fontSize: 12 }}>Reply</button>
              </div>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,.85)', margin: '0 0 12px' }}>{selectedMsg.subject}</h2>
                <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                  <div>
                    <span style={{ color: 'rgba(255,255,255,.3)' }}>From: </span>
                    <span style={{ color: 'rgba(255,255,255,.6)' }}>{selectedMsg.from}</span>
                  </div>
                  <div>
                    <span style={{ color: 'rgba(255,255,255,.3)' }}>To: </span>
                    <span style={{ color: 'rgba(255,255,255,.6)' }}>{selectedMsg.to}</span>
                  </div>
                  <span style={{ color: 'rgba(255,255,255,.2)', marginLeft: 'auto' }}>{fmtDate(selectedMsg.date)}</span>
                </div>
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
                {selectedMsg.body_html ? (
                  <iframe
                    srcDoc={`<!DOCTYPE html><html><head><style>body{margin:0;padding:24px;font-family:-apple-system,system-ui,sans-serif;font-size:14px;line-height:1.6;color:#333;background:#fafafa;}img{max-width:100%;height:auto;}a{color:#4a6cf7;}</style></head><body>${selectedMsg.body_html}</body></html>`}
                    style={{ width: '100%', height: '100%', border: 'none', minHeight: 300, background: '#fafafa', borderRadius: 0 }}
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <pre style={{ padding: 24, margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14, color: 'rgba(255,255,255,.6)', lineHeight: 1.7 }}>
                    {selectedMsg.body_text || '(empty)'}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* Reply */}
          {view === 'reply' && selectedMsg && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setView('detail')} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
                  color: 'rgba(130,150,220,.7)', fontSize: 13, fontFamily: 'inherit',
                }}>&larr; Back to message</button>
              </div>
              <div style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.3)', marginBottom: 4 }}>
                    Replying to <span style={{ color: 'rgba(255,255,255,.55)' }}>{selectedMsg.from}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.3)' }}>
                    Subject: <span style={{ color: 'rgba(255,255,255,.55)' }}>{selectedMsg.subject.startsWith('Re:') ? selectedMsg.subject : `Re: ${selectedMsg.subject}`}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', marginTop: 4 }}>
                    From: {activeAccount}
                  </div>
                </div>
                <textarea value={replyBody} onChange={e => setReplyBody(e.target.value)} placeholder="Write your reply..."
                  rows={10} style={{ ...inp, height: 'auto', padding: '12px', resize: 'vertical', lineHeight: 1.6, flex: 1 }} autoFocus />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={handleReply} disabled={sending || !replyBody.trim()} style={{
                    ...btnPrimary, height: 38, padding: '0 28px',
                    opacity: sending || !replyBody.trim() ? 0.4 : 1,
                  }}>{sending ? 'Sending...' : 'Send Reply'}</button>
                  <button onClick={() => setView('detail')} style={{
                    ...btnPrimary, background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.4)',
                  }}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Compose via Gmail */}
          {view === 'compose-gmail' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setView('inbox')} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
                  color: 'rgba(130,150,220,.7)', fontSize: 13, fontFamily: 'inherit',
                }}>&larr; Cancel</button>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.6)' }}>New Email</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', marginLeft: 'auto' }}>via Gmail as {activeAccount}</span>
              </div>
              <div style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: 4 }}>To</label>
                    <input value={composeTo} onChange={e => setComposeTo(e.target.value)} placeholder="recipient@example.com" style={inp} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: 4 }}>Subject</label>
                    <input value={composeSubject} onChange={e => setComposeSubject(e.target.value)} placeholder="Subject" style={inp} />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: 4 }}>Body</label>
                  <textarea value={composeBody} onChange={e => setComposeBody(e.target.value)} placeholder="Write your message..."
                    rows={10} style={{ ...inp, height: '100%', padding: '12px', resize: 'vertical', lineHeight: 1.6 }} />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={handleGmailSend} disabled={sending || !composeTo || !composeSubject} style={{
                    ...btnPrimary, height: 38, padding: '0 28px',
                    opacity: sending || !composeTo || !composeSubject ? 0.4 : 1,
                  }}>{sending ? 'Sending...' : 'Send'}</button>
                  <button onClick={() => setView('inbox')} style={{
                    ...btnPrimary, background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.4)',
                  }}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Compose Branded via Resend */}
          {view === 'compose-branded' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setView('inbox')} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
                  color: 'rgba(130,150,220,.7)', fontSize: 13, fontFamily: 'inherit',
                }}>&larr; Cancel</button>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.6)' }}>Branded Email</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', marginLeft: 'auto' }}>via Resend as noreply@vurium.com</span>
              </div>
              <div style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: 4 }}>To</label>
                    <input value={composeTo} onChange={e => setComposeTo(e.target.value)} placeholder="recipient@example.com" style={inp} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: 4 }}>Subject</label>
                    <input value={composeSubject} onChange={e => setComposeSubject(e.target.value)} placeholder="Subject" style={inp} />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: 4 }}>Body</label>
                  <textarea value={composeBody} onChange={e => setComposeBody(e.target.value)} placeholder="Write your message..."
                    rows={10} style={{ ...inp, height: '100%', padding: '12px', resize: 'vertical', lineHeight: 1.6 }} />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={handleBrandedSend} disabled={sending || !composeTo || !composeSubject} style={{
                    ...btnPrimary, height: 38, padding: '0 28px',
                    background: 'rgba(220,170,100,.15)', color: 'rgba(220,170,100,.9)',
                    opacity: sending || !composeTo || !composeSubject ? 0.4 : 1,
                  }}>{sending ? 'Sending...' : 'Send Branded'}</button>
                  <button onClick={() => setView('inbox')} style={{
                    ...btnPrimary, background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.4)',
                  }}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {loadingDetail && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.5)' }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>Loading...</div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
