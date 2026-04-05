'use client'
import React, { useEffect, useState, useCallback, useRef } from 'react'
import Shell from '@/components/Shell'
import FeatureGate from '@/components/FeatureGate'

import { apiFetch } from '@/lib/api'

// ─── Types ───────────────────────────────────────────────────────────────────
type TopTab = 'chat' | 'requests' | 'applications'

interface Application {
  id: string; type: string; role: string; name: string; phone: string; email: string
  instagram: string; experience: string; english: string; fulltime: string
  portfolio: string; motivation: string; status: string; created_at: string
  license?: string; fade_level?: string; medium_hair?: string; beard?: string; barber_notes?: string
  admin_experience?: string; pos?: string; typing?: string; multitask?: string; admin_notes?: string
  schedule?: string; message?: string; lang?: string; notes?: string; reviewed_by?: string
}

interface Message {
  id: string
  chatType: string
  senderId: string
  senderName: string
  senderRole: string
  senderPhoto?: string
  text: string
  imageUrl?: string
  audioUrl?: string
  fileUrl?: string
  fileName?: string
  createdAt: string
  reactions?: Record<string, string[]>
}

interface Request {
  id: string
  type: 'schedule_change' | 'photo_change' | 'profile_change' | 'service_change' | 'block_time'
  barberId: string
  barberName: string
  status: 'pending' | 'approved' | 'rejected'
  data: any
  createdAt: string
  reviewedBy?: string
  reviewedAt?: string
}

// ─── Tab config ──────────────────────────────────────────────────────────────
function TabIcon({ id, color }: { id: string; color: string }) {
  const s = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
  switch (id) {
    case 'chat': return <svg width="14" height="14" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" {...s}/></svg>
    case 'requests': return <svg width="14" height="14" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" {...s}/><path d="M9 12l2 2 4-4" {...s}/><line x1="9" y1="7" x2="15" y2="7" {...s}/><line x1="9" y1="17" x2="13" y2="17" {...s}/></svg>
    case 'applications': return <svg width="14" height="14" viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" {...s}/><rect x="8" y="2" width="8" height="4" rx="1" {...s}/><path d="M9 14h6M9 18h4" {...s}/></svg>
    default: return null
  }
}

const TAB_COLORS: Record<string, string> = {
  chat: 'rgba(130,150,220,.6)', requests: 'rgba(220,190,130,.5)', applications: 'rgba(220,130,160,.5)'
}

const TABS: { id: TopTab; label: string; roles: string[] }[] = [
  { id: 'chat', label: 'Chat', roles: ['owner','admin','barber','student'] },
  { id: 'requests', label: 'Requests', roles: ['owner','admin','barber'] },
  { id: 'applications', label: 'Applications', roles: ['owner','admin'] },
]

// ─── Styles ──────────────────────────────────────────────────────────────────
const GLASS = { borderRadius: 18, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', backdropFilter: 'saturate(180%) blur(20px)' } as React.CSSProperties

function timeAgo(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

const ROLE_COLORS: Record<string, string> = {
  owner: 'rgba(220,190,130,.5)', admin: 'rgba(130,220,170,.5)', barber: 'rgba(130,150,220,.6)', student: 'rgba(180,140,220,.6)'
}

const ROLE_GRADIENTS: Record<string, string> = {
  owner: 'linear-gradient(135deg, rgba(220,190,130,.5), #f0c040)',
  admin: 'linear-gradient(135deg, rgba(130,220,170,.5), #4ade80)',
  barber: 'linear-gradient(135deg, rgba(130,150,220,.6), #60a5fa)',
  student: 'linear-gradient(135deg, rgba(180,140,220,.6), #a78bfa)',
}

// ─── Reaction emojis ─────────────────────────────────────────────────────────
const REACTION_EMOJIS = ['👍', '❤️', '😂', '🔥', '👏', '😢']

// ─── DM helper ───────────────────────────────────────────────────────────────
function dmChatType(a: string, b: string) { return 'dm_' + [a, b].sort().join('_') }

// ─── AudioPlayer ─────────────────────────────────────────────────────────────
function AudioPlayer({ src, isOwn }: { src: string; isOwn: boolean }) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const a = new Audio(src)
    audioRef.current = a
    a.addEventListener('loadedmetadata', () => setDuration(a.duration))
    a.addEventListener('ended', () => { setPlaying(false); setProgress(0); cancelAnimationFrame(rafRef.current) })
    return () => { a.pause(); a.src = ''; cancelAnimationFrame(rafRef.current) }
  }, [src])

  function tick() {
    const a = audioRef.current
    if (a && a.duration) setProgress(a.currentTime / a.duration)
    rafRef.current = requestAnimationFrame(tick)
  }

  function toggle() {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause(); cancelAnimationFrame(rafRef.current) }
    else { a.play(); rafRef.current = requestAnimationFrame(tick) }
    setPlaying(!playing)
  }

  function fmt(s: number) { const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${sec.toString().padStart(2, '0')}` }

  // Generate deterministic "waveform" bars from audioUrl hash
  const bars = Array.from({ length: 24 }, (_, i) => 0.2 + 0.8 * Math.abs(Math.sin(i * 1.7 + 3.14)))

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 180, padding: '2px 0' }}>
      <button onClick={toggle} style={{ width: 32, height: 32, borderRadius: 999, border: 'none', background: isOwn ? 'rgba(255,255,255,.20)' : 'rgba(255,255,255,.08)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="6,4 20,12 6,20"/></svg>
        )}
      </button>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 22 }}>
          {bars.map((h, i) => {
            const filled = progress > i / bars.length
            return <div key={i} style={{ flex: 1, height: `${h * 100}%`, borderRadius: 1, background: filled ? (isOwn ? 'rgba(255,255,255,.80)' : 'rgba(255,255,255,.6)') : (isOwn ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.15)'), transition: 'background .15s' }} />
          })}
        </div>
        <div style={{ fontSize: 10, color: isOwn ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.30)' }}>
          {duration > 0 ? fmt(playing ? (audioRef.current?.currentTime || 0) : duration) : '0:00'}
        </div>
      </div>
    </div>
  )
}

// ─── MessageBubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg, isOwn, onImageClick, isGrouped, onReaction, myUid }: { msg: Message; isOwn: boolean; onImageClick?: (url: string) => void; isGrouped?: boolean; onReaction?: (msgId: string, emoji: string) => void; myUid?: string }) {
  const roleColor = ROLE_COLORS[msg.senderRole] || '#e8e8ed'
  const [showReactions, setShowReactions] = React.useState(false)
  const longPressRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = React.useRef(false)

  function onPointerDown() {
    didLongPress.current = false
    longPressRef.current = setTimeout(() => {
      didLongPress.current = true
      setShowReactions(true)
    }, 500)
  }
  function onPointerUp() {
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null }
  }
  function onPointerLeave() {
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null }
  }

  const reactions = msg.reactions || {}
  const hasReactions = Object.keys(reactions).length > 0

  return (
    <div className="msg-bubble-wrap" style={{ display: 'flex', flexDirection: isOwn ? 'row-reverse' : 'row', gap: isGrouped ? 0 : 10, alignItems: 'flex-end', marginBottom: isGrouped ? 2 : (hasReactions ? 28 : 8), padding: '0 16px', position: 'relative' }}>
      {/* Avatar — hidden when grouped */}
      {!isGrouped ? (
        msg.senderPhoto ? (
          <img src={msg.senderPhoto} alt="" style={{ width: 32, height: 32, borderRadius: 999, objectFit: 'cover', border: '1.5px solid rgba(255,255,255,.15)', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 32, height: 32, borderRadius: 999, background: ROLE_GRADIENTS[msg.senderRole] || 'rgba(255,255,255,.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#1a1a2e', flexShrink: 0 }}>
            {initials(msg.senderName)}
          </div>
        )
      ) : <div style={{ width: 32, flexShrink: 0 }} />}
      {/* Bubble — iMessage / Instagram style */}
      <div style={{ maxWidth: '72%', position: 'relative' }}
        onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerLeave={onPointerLeave}
        onContextMenu={e => { e.preventDefault(); setShowReactions(true) }}>
        <div style={{
          padding: '9px 14px',
          borderRadius: isOwn
            ? (isGrouped ? '18px' : '20px 20px 4px 20px')
            : (isGrouped ? '18px' : '20px 20px 20px 4px'),
          background: isOwn
            ? 'linear-gradient(135deg, rgba(255,255,255,.15), rgba(255,255,255,.10))'
            : 'rgba(255,255,255,.08)',
          backdropFilter: isOwn ? 'none' : 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: isOwn ? 'none' : 'blur(20px) saturate(180%)',
          border: isOwn ? 'none' : '0.5px solid rgba(255,255,255,.12)',
          boxShadow: '0 2px 12px rgba(0,0,0,.15)',
          userSelect: 'none' as const, WebkitUserSelect: 'none' as const,
        }}>
          {!isOwn && !isGrouped && (
            <div style={{ fontSize: 10, fontWeight: 800, color: roleColor, marginBottom: 3, letterSpacing: '.04em' }}>
              {msg.senderName} <span style={{ color: 'rgba(255,255,255,.20)', fontWeight: 400 }}>· {msg.senderRole}</span>
            </div>
          )}
          {msg.text && <div style={{ fontSize: 13, lineHeight: 1.5, color: isOwn ? '#fff' : '#e8e8ed', wordBreak: 'break-word' }}>{msg.text}</div>}
          {msg.imageUrl && (
            <img src={msg.imageUrl} alt="" onClick={() => { if (!didLongPress.current) onImageClick?.(msg.imageUrl!) }}
              style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 10, marginTop: msg.text ? 6 : 0, cursor: 'pointer', objectFit: 'cover', border: '1px solid rgba(255,255,255,.08)' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          )}
          {msg.audioUrl && <AudioPlayer src={msg.audioUrl} isOwn={isOwn} />}
          {msg.fileUrl && (
            <a href={msg.fileUrl} download={msg.fileName || 'file'} onClick={e => e.stopPropagation()}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginTop: msg.text ? 6 : 0, borderRadius: 10, background: isOwn ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', textDecoration: 'none', color: '#e8e8ed' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isOwn ? '#fff' : 'rgba(255,255,255,.50)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.fileName || 'File'}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,.35)', marginTop: 1 }}>Tap to download</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </a>
          )}
          <div style={{ fontSize: 9, color: isOwn ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.20)', marginTop: 3, textAlign: isOwn ? 'right' : 'left' }}>{timeAgo(msg.createdAt)}</div>
        </div>

        {/* Reaction badges under bubble */}
        {hasReactions && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4, ...(isOwn ? { justifyContent: 'flex-end' } : {}) }}>
            {Object.entries(reactions).map(([emoji, uids]) => {
              const isMine = myUid ? uids.includes(myUid) : false
              return (
                <button key={emoji} onClick={() => onReaction?.(msg.id, emoji)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 3, height: 24, padding: '0 7px', borderRadius: 999,
                    border: `1px solid ${isMine ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.12)'}`,
                    background: isMine ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.06)',
                    cursor: 'pointer', fontSize: 12, color: '#e8e8ed', fontFamily: 'inherit',
                    transition: 'all .2s ease',
                  }}>
                  <span>{emoji}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: isMine ? 'rgba(130,150,220,.6)' : 'rgba(255,255,255,.50)' }}>{uids.length}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Reaction picker popup */}
        {showReactions && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setShowReactions(false)} />
            <div style={{
              position: 'absolute', bottom: '100%', marginBottom: 6,
              ...(isOwn ? { right: 0 } : { left: 0 }),
              display: 'flex', gap: 4, padding: '6px 10px', borderRadius: 999,
              background: 'rgba(20,20,20,.92)', border: '1px solid rgba(255,255,255,.14)',
              backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
              boxShadow: '0 8px 32px rgba(0,0,0,.6)', zIndex: 999,
              animation: 'reactionPopIn .2s ease',
            }}>
              {REACTION_EMOJIS.map(emoji => (
                <button key={emoji} onClick={() => { onReaction?.(msg.id, emoji); setShowReactions(false) }}
                  style={{ width: 36, height: 36, borderRadius: 999, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform .15s ease' }}
                  onPointerDown={e => (e.currentTarget.style.transform = 'scale(1.3)')}
                  onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}>
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── RequestCard ─────────────────────────────────────────────────────────────
const REQ_TYPE_INFO: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  schedule_change: { label: 'Schedule change', color: 'rgba(220,190,130,.5)', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(220,190,130,.5)" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  photo_change:    { label: 'Photo change', color: 'rgba(130,150,220,.6)', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(130,150,220,.6)" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg> },
  profile_change:  { label: 'Profile update', color: 'rgba(180,140,220,.6)', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(180,140,220,.6)" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  service_change:  { label: 'Service change', color: 'rgba(130,200,220,.8)', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(130,200,220,.8)" strokeWidth="2" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg> },
  block_time:      { label: 'Block time', color: 'rgba(220,130,160,.5)', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(220,130,160,.5)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> },
}

function RequestCard({ req, isOwnerOrAdmin, onReview }: { req: Request; isOwnerOrAdmin: boolean; onReview: (id: string, status: 'approved' | 'rejected') => void }) {
  const isPending = req.status === 'pending'
  const statusColors: Record<string, { bg: string; border: string; color: string }> = {
    pending:  { bg: 'rgba(255,207,63,.08)', border: 'rgba(255,207,63,.25)', color: 'rgba(220,190,130,.5)' },
    approved: { bg: 'rgba(143,240,177,.08)', border: 'rgba(143,240,177,.25)', color: 'rgba(130,220,170,.5)' },
    rejected: { bg: 'rgba(255,107,107,.08)', border: 'rgba(255,107,107,.25)', color: 'rgba(220,130,160,.5)' },
  }
  const sc = statusColors[req.status] || statusColors.pending
  const info = REQ_TYPE_INFO[req.type] || { label: req.type, color: '#e8e8ed', icon: null }
  const detailStyle: React.CSSProperties = { padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', fontSize: 12, color: 'rgba(255,255,255,.55)', marginBottom: isPending && isOwnerOrAdmin ? 10 : 0, lineHeight: 1.6 }

  return (
    <div style={{ ...GLASS, padding: '14px 16px', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{info.icon}</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: info.color }}>{info.label}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.40)' }}>{req.barberName} · {timeAgo(req.createdAt)}</div>
          </div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color, textTransform: 'uppercase', letterSpacing: '.06em' }}>{req.status}</span>
      </div>

      {/* Details per type */}
      {req.type === 'schedule_change' && req.data && (
        <div style={detailStyle}>
          {req.data.dayName && <div>Day: <strong style={{ color: '#e8e8ed' }}>{req.data.dayName}</strong></div>}
          {req.data.workDays && <div>Days: <strong style={{ color: '#e8e8ed' }}>{req.data.workDays.join(', ')}</strong></div>}
          <div>Hours: <strong style={{ color: '#e8e8ed' }}>{req.data.startTime} — {req.data.endTime}</strong></div>
          {req.data.note && <div style={{ marginTop: 4, color: 'rgba(255,255,255,.40)' }}>Note: {req.data.note}</div>}
        </div>
      )}

      {req.type === 'photo_change' && req.data?.newPhotoUrl && (
        <div style={{ marginBottom: isPending && isOwnerOrAdmin ? 10 : 0 }}>
          <img src={req.data.newPhotoUrl} alt="new photo" style={{ width: 80, height: 80, borderRadius: 12, objectFit: 'cover', border: '1px solid rgba(255,255,255,.12)' }} />
        </div>
      )}

      {req.type === 'profile_change' && req.data?.changes && (
        <div style={detailStyle}>
          {req.data.changes.about && <div>Bio: <strong style={{ color: '#e8e8ed' }}>{String(req.data.changes.about).slice(0, 60)}{String(req.data.changes.about).length > 60 ? '…' : ''}</strong></div>}
          {req.data.changes.level && <div>Level: <strong style={{ color: '#e8e8ed' }}>{req.data.changes.level}</strong></div>}
          {req.data.changes.base_price && <div>Price: <strong style={{ color: '#e8e8ed' }}>${req.data.changes.base_price}</strong></div>}
          {req.data.changes.public_role && <div>Role: <strong style={{ color: '#e8e8ed' }}>{req.data.changes.public_role}</strong></div>}
          {req.data.scheduleSummary && Array.isArray(req.data.scheduleSummary) && (
            <div>Schedule: <strong style={{ color: '#e8e8ed' }}>{req.data.scheduleSummary.join(', ')}</strong></div>
          )}
          {!req.data.scheduleSummary && req.data.changes.schedule && <div>Schedule: <strong style={{ color: '#e8e8ed' }}>Updated</strong></div>}
          {req.data.changes.photo_url && (
            <div style={{ marginTop: 6 }}>
              <div style={{ marginBottom: 4 }}>New photo:</div>
              <img src={req.data.changes.photo_url} alt="" style={{ width: 60, height: 60, borderRadius: 10, objectFit: 'cover', border: '1px solid rgba(255,255,255,.12)' }} />
            </div>
          )}
        </div>
      )}

      {req.type === 'service_change' && req.data && (
        <div style={detailStyle}>
          <div>Service: <strong style={{ color: '#e8e8ed' }}>{req.data.serviceName || req.data.changes?.name || '—'}</strong></div>
          {req.data.changes?.duration_minutes && <div>Duration: <strong style={{ color: '#e8e8ed' }}>{req.data.changes.duration_minutes} min</strong></div>}
          {req.data.changes?.price_cents != null && <div>Price: <strong style={{ color: '#e8e8ed' }}>${(req.data.changes.price_cents / 100).toFixed(2)}</strong></div>}
          {req.data.changes?.name && <div>New name: <strong style={{ color: '#e8e8ed' }}>{req.data.changes.name}</strong></div>}
        </div>
      )}

      {req.type === 'block_time' && req.data && (
        <div style={detailStyle}>
          <div>Date: <strong style={{ color: '#e8e8ed' }}>{req.data.date || '—'}</strong></div>
          <div>Time: <strong style={{ color: '#e8e8ed' }}>{req.data.startAt ? new Date(req.data.startAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'} — {req.data.endAt ? new Date(req.data.endAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}</strong></div>
          {req.data.barberName && <div>Team Member: <strong style={{ color: '#e8e8ed' }}>{req.data.barberName}</strong></div>}
        </div>
      )}

      {/* Actions */}
      {isPending && isOwnerOrAdmin && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onReview(req.id, 'approved')} style={{ flex: 1, height: 36, borderRadius: 10, border: '1px solid rgba(143,240,177,.45)', background: 'rgba(143,240,177,.10)', color: 'rgba(130,220,170,.5)', cursor: 'pointer', fontWeight: 800, fontSize: 12, fontFamily: 'inherit' }}>Approve</button>
          <button onClick={() => onReview(req.id, 'rejected')} style={{ flex: 1, height: 36, borderRadius: 10, border: '1px solid rgba(255,107,107,.35)', background: 'rgba(255,107,107,.08)', color: 'rgba(220,130,160,.5)', cursor: 'pointer', fontWeight: 800, fontSize: 12, fontFamily: 'inherit' }}>Reject</button>
        </div>
      )}
      {req.reviewedBy && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.30)', marginTop: 6 }}>Reviewed by {req.reviewedBy}{req.reviewedAt ? ` · ${timeAgo(req.reviewedAt)}` : ''}</div>
      )}
    </div>
  )
}

// ─── NewRequestModal ─────────────────────────────────────────────────────────
function NewRequestModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [type, setType] = useState<'schedule_change' | 'photo_change'>('schedule_change')
  const [days, setDays] = useState<string[]>(['Mon','Tue','Wed','Thu','Fri','Sat'])
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('20:00')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  const inp: React.CSSProperties = { width: '100%', height: 40, borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#fff', padding: '0 10px', outline: 'none', fontSize: 13, fontFamily: 'inherit' }

  async function submit() {
    setSaving(true)
    try {
      await apiFetch('/api/requests', { method: 'POST', body: JSON.stringify({ type, data: type === 'schedule_change' ? { workDays: days, startTime, endTime, note } : {} }) })
      onCreated()
    } catch (e: any) { alert(e.message) }
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(18px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: 'min(440px,100%)', borderRadius: 22, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(0,0,0,.65)', backdropFilter: 'saturate(180%) blur(40px)', boxShadow: '0 32px 80px rgba(0,0,0,.60)', color: '#e8e8ed', fontFamily: 'Inter,sans-serif' }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: '"Inter",sans-serif', letterSpacing: '.16em', textTransform: 'uppercase', fontSize: 13 }}>New request</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Type selector */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[{ v: 'schedule_change' as const, l: 'Schedule change' }, { v: 'photo_change' as const, l: 'Photo change' }].map(t => (
              <button key={t.v} onClick={() => setType(t.v)}
                style={{ flex: 1, height: 38, borderRadius: 999, border: `1px solid ${type === t.v ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.10)'}`, background: type === t.v ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.03)', color: type === t.v ? '#fff' : 'rgba(255,255,255,.55)', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>{t.l}</button>
            ))}
          </div>

          {type === 'schedule_change' && (
            <>
              {/* Days */}
              <div>
                <div style={{ fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 6 }}>Working days</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {DAY_NAMES.map(d => (
                    <button key={d} onClick={() => setDays(prev => prev.includes(d) ? prev.filter(x=>x!==d) : [...prev, d])}
                      style={{ width: 42, height: 34, borderRadius: 8, border: `1px solid ${days.includes(d) ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.10)'}`, background: days.includes(d) ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.04)', color: days.includes(d) ? 'rgba(130,150,220,.6)' : 'rgba(255,255,255,.40)', cursor: 'pointer', fontWeight: 700, fontSize: 11, fontFamily: 'inherit' }}>{d}</button>
                  ))}
                </div>
              </div>
              {/* Times */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 4 }}>Start time</div>
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={inp} />
                </div>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 4 }}>End time</div>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={inp} />
                </div>
              </div>
              {/* Note */}
              <div>
                <div style={{ fontSize: 10, letterSpacing: '.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 4 }}>Note (optional)</div>
                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Reason for change…" rows={2} style={{ ...inp, height: 'auto', padding: '8px 10px', resize: 'vertical' as const }} />
              </div>
            </>
          )}

          {type === 'photo_change' && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,.40)', fontSize: 12 }}>
              Photo change requests — upload a new photo in your profile settings, and it will be sent for approval.
            </div>
          )}

          <button onClick={submit} disabled={saving}
            style={{ height: 42, borderRadius: 12, border: '1px solid rgba(255,255,255,.18)', background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.6)', cursor: 'pointer', fontWeight: 900, fontSize: 13, fontFamily: 'inherit', opacity: saving ? .5 : 1 }}>
            {saving ? 'Sending…' : 'Send request'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Messages Page ───────────────────────────────────────────────────────────
export default function MessagesPage() {
  const [user, setUser] = useState<any>(null)
  const [topTab, setTopTab] = useState<TopTab>('chat')
  const [chatView, setChatView] = useState<'list' | 'conversation'>('list')
  const [chatTarget, setChatTarget] = useState<{ chatType: string; label: string; photo?: string } | null>(null)
  const [staffList, setStaffList] = useState<{id: string; name: string; photo_url?: string; role: string}[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [requests, setRequests] = useState<Request[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showNewRequest, setShowNewRequest] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState('')
  const [imagePreview, setImagePreview] = useState('')
  const [filePreview, setFilePreview] = useState<{ name: string; dataUrl: string } | null>(null)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const wasAtBottom = useRef(true)

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Show mic button but test actual support only on first tap (lazy check)
  const [micTested, setMicTested] = useState(false)
  useEffect(() => { setVoiceSupported(true) }, []) // optimistic — hide on first failure

  useEffect(() => {
    try { setUser(JSON.parse(localStorage.getItem('VURIUMBOOK_USER') || 'null')) } catch {}
    const t = setTimeout(() => {
      try { setUser(JSON.parse(localStorage.getItem('VURIUMBOOK_USER') || 'null')) } catch {}
    }, 2000)
    return () => clearTimeout(t)
  }, [])

  // Load staff list on mount — use /api/staff (returns user IDs for consistent DM chatTypes)
  useEffect(() => {
    async function loadStaff() {
      try {
        const res = await apiFetch('/api/staff')
        const list = Array.isArray(res) ? res : []
        setStaffList(list.map((u: any) => ({ id: u.id, name: u.name, photo_url: u.photo_url, role: u.role || 'barber' })))
      } catch { setStaffList([]) }
    }
    loadStaff()
  }, [])

  const role = user?.role || 'barber'
  const uid = user?.uid || ''
  const isOwnerOrAdmin = role === 'owner' || role === 'admin'
  const visibleTabs = TABS.filter(t => t.roles.includes(role))

  // Load messages
  const loadMessages = useCallback(async (ct?: string) => {
    const chatType = ct || chatTarget?.chatType
    if (!chatType) return
    try {
      const res = await apiFetch(`/api/messages?chatType=${chatType}&limit=100`)
      const data = Array.isArray(res?.messages) ? res.messages : Array.isArray(res) ? res : []
      const mapped = data.map((m: any) => ({ ...m, text: m.content || m.text || '', senderId: m.sender_id || m.senderId, senderName: m.sender_name || m.senderName, senderRole: m.sender_role || m.senderRole, senderPhoto: m.senderPhoto || m.sender_photo }))
      setMessages(mapped)
    } catch { /* ignore */ }
  }, [chatTarget?.chatType])

  // Toggle reaction on a message
  async function handleReaction(msgId: string, emoji: string) {
    try {
      const data = await apiFetch(`/api/messages/${encodeURIComponent(msgId)}/reactions`, {
        method: 'PATCH', body: JSON.stringify({ emoji })
      })
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions: data.reactions || {} } : m))
    } catch {}
  }

  // Load requests
  const loadRequests = useCallback(async () => {
    try {
      const data = await apiFetch('/api/requests')
      setRequests(Array.isArray(data?.requests) ? data.requests : [])
    } catch { /* ignore */ }
  }, [])

  // Load applications
  const loadApplications = useCallback(async () => {
    try {
      const data = await apiFetch('/api/applications')
      setApplications(Array.isArray(data?.applications) ? data.applications : [])
    } catch { /* ignore */ }
  }, [])

  // Initial load + polling
  useEffect(() => {
    const hasData = messages.length > 0 || requests.length > 0 || applications.length > 0
    if (!hasData) setLoading(true)
    if (topTab === 'requests') {
      loadRequests().then(() => setLoading(false))
    } else if (topTab === 'applications') {
      loadApplications().then(() => setLoading(false))
    } else if (topTab === 'chat' && chatView === 'conversation' && chatTarget) {
      loadMessages().then(() => setLoading(false))
    } else {
      setLoading(false)
    }
    const interval = setInterval(() => {
      if (topTab === 'requests') loadRequests()
      else if (topTab === 'applications') loadApplications()
      else if (topTab === 'chat' && chatView === 'conversation' && chatTarget) loadMessages()
    }, 10000)
    return () => clearInterval(interval)
  }, [topTab, chatView, chatTarget, loadMessages, loadRequests, loadApplications])

  // Fix mobile keyboard pushing content
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    function onResize() {
      const container = document.querySelector('.msg-container') as HTMLElement
      if (!container) return
      container.style.height = `${vv!.height}px`
      window.scrollTo(0, 0)
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }
    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onResize)
    function onBlur() {
      setTimeout(() => {
        window.scrollTo(0, 0)
        document.documentElement.scrollTop = 0
        document.body.scrollTop = 0
        const container = document.querySelector('.msg-container') as HTMLElement
        if (container) container.style.height = '100%'
      }, 100)
    }
    document.addEventListener('focusout', onBlur)
    return () => { vv.removeEventListener('resize', onResize); vv.removeEventListener('scroll', onResize); document.removeEventListener('focusout', onBlur) }
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    const el = listRef.current
    if (el && wasAtBottom.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages])

  function onScroll() {
    const el = listRef.current
    if (el) wasAtBottom.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 40
  }

  function handleFileAttach(file: File | null) {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { console.warn('Max 10MB'); return }
    const reader = new FileReader()
    reader.onload = () => { setFilePreview({ name: file.name, dataUrl: reader.result as string }) }
    reader.readAsDataURL(file)
  }

  async function sendMessage() {
    if ((!input.trim() && !imagePreview && !filePreview) || sending || !chatTarget) return
    setSending(true)
    try {
      let userPhoto = user?.photo || ''
      try { const fresh = JSON.parse(localStorage.getItem('VURIUMBOOK_USER') || '{}'); userPhoto = fresh?.photo || userPhoto } catch {}
      const body: any = { chatType: chatTarget.chatType, text: input.trim(), senderPhoto: userPhoto }
      if (imagePreview) body.imageUrl = imagePreview
      if (filePreview) { body.fileUrl = filePreview.dataUrl; body.fileName = filePreview.name }
      await apiFetch('/api/messages', { method: 'POST', body: JSON.stringify(body) })
      setInput(''); setImagePreview(''); setFilePreview(null)
      wasAtBottom.current = true
      await loadMessages()
    } catch (e: any) { console.warn(e.message) }
    setSending(false)
  }

  // Voice recording functions
  async function startRecording() {
    if (!voiceSupported) return

    if (!micTested) {
      setMicTested(true)
      try {
        if (!navigator?.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
          setVoiceSupported(false)
          return
        }
        if (navigator.permissions?.query) {
          try {
            const perm = await navigator.permissions.query({ name: 'microphone' as PermissionName })
            if (perm.state === 'denied') { setVoiceSupported(false); return }
          } catch {}
        }
      } catch { setVoiceSupported(false); return }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      let mimeType = ''
      try {
        mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4'
          : MediaRecorder.isTypeSupported('audio/aac') ? 'audio/aac'
          : ''
      } catch { mimeType = '' }
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      mediaRecorder.ondataavailable = (e) => {
        try { if (e.data.size > 0) audioChunksRef.current.push(e.data) } catch {}
      }
      mediaRecorder.onerror = () => { try { cancelRecording() } catch {} }
      mediaRecorder.start()
      setIsRecording(true)
      setRecordingDuration(0)
      recordingTimerRef.current = setInterval(() => setRecordingDuration(prev => prev + 1), 1000)
    } catch (err: any) {
      console.warn('Recording error:', err)
      try { streamRef.current?.getTracks().forEach(t => t.stop()) } catch {}
      streamRef.current = null
      setIsRecording(false)
      setVoiceSupported(false)
    }
  }

  async function stopRecording() {
    return new Promise<string | null>((resolve) => {
      const mr = mediaRecorderRef.current
      if (!mr || mr.state === 'inactive') { resolve(null); return }

      mr.onstop = () => {
        const blobType = mr.mimeType || 'audio/webm'
        const blob = new Blob(audioChunksRef.current, { type: blobType })
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      mr.stop()
      setIsRecording(false)
      if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null }
    })
  }

  async function handleVoiceToggle() {
    try {
      if (isRecording) {
        const audioUrl = await stopRecording()
        if (audioUrl && chatTarget) {
          setSending(true)
          try {
            let userPhoto = user?.photo || ''
            try { const fresh = JSON.parse(localStorage.getItem('VURIUMBOOK_USER') || '{}'); userPhoto = fresh?.photo || userPhoto } catch {}
            await apiFetch('/api/messages', { method: 'POST', body: JSON.stringify({ chatType: chatTarget.chatType, text: '', senderPhoto: userPhoto, audioUrl }) })
            wasAtBottom.current = true
            await loadMessages()
          } catch (e: any) { console.warn(e.message) }
          setSending(false)
        }
      } else {
        await startRecording()
      }
    } catch (e) {
      console.warn('Voice toggle error:', e)
      setIsRecording(false)
    }
  }

  function cancelRecording() {
    try {
      const mr = mediaRecorderRef.current
      if (mr && mr.state !== 'inactive') mr.stop()
    } catch {}
    try { streamRef.current?.getTracks().forEach(t => t.stop()) } catch {}
    streamRef.current = null
    mediaRecorderRef.current = null
    setIsRecording(false)
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null }
    audioChunksRef.current = []
  }

  function handleImageAttach(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const MAX = 800, scale = Math.min(1, MAX / img.width, MAX / img.height)
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        let q = 0.75, out = canvas.toDataURL('image/jpeg', q)
        while (out.length > 500000 && q > 0.3) { q -= 0.1; out = canvas.toDataURL('image/jpeg', q) }
        setImagePreview(out)
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  async function reviewRequest(id: string, status: 'approved' | 'rejected') {
    try {
      await apiFetch(`/api/requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      if (status === 'approved') {
        const req = requests.find(r => r.id === id)
        if (req?.type === 'block_time' && req.data) {
          const d = req.data
          const startAt = d.startAt || (d.date && d.startMin != null ? `${d.date}T${String(Math.floor(d.startMin / 60)).padStart(2, '0')}:${String(d.startMin % 60).padStart(2, '0')}:00` : '')
          const dur = d.duration || d.duration_min || 30
          const endAt = d.endAt || (startAt ? new Date(new Date(startAt).getTime() + dur * 60000).toISOString() : '')
          if (startAt && endAt) {
            try {
              await apiFetch('/api/bookings', { method: 'POST', body: JSON.stringify({ barber_id: d.barber_id || d.barberId || '', type: 'block', status: 'confirmed', client_name: 'BLOCKED', service_id: '', start_at: startAt.includes('T') && startAt.includes('Z') ? startAt : new Date(startAt).toISOString(), end_at: endAt.includes('T') && endAt.includes('Z') ? endAt : new Date(endAt).toISOString(), notes: 'Blocked (approved request)' }) })
            } catch (_) { /* backend may already create booking on approve — 409 is ok */ }
          }
        }
      }
      loadRequests()
    } catch (e: any) { alert(e.message) }
  }

  // Navigation helpers
  function openChat(chatType: string, label: string, photo?: string) {
    setChatTarget({ chatType, label, photo })
    setChatView('conversation')
    setMessages([])
    setLoading(true)
    // load messages for this chat
    apiFetch(`/api/messages?chatType=${chatType}&limit=100`).then(res => {
      const data = Array.isArray(res?.messages) ? res.messages : Array.isArray(res) ? res : []
      const mapped = data.map((m: any) => ({ ...m, text: m.content || m.text || '', senderId: m.sender_id || m.senderId, senderName: m.sender_name || m.senderName, senderRole: m.sender_role || m.senderRole, senderPhoto: m.senderPhoto || m.sender_photo }))
      setMessages(mapped)
      setLoading(false)
      wasAtBottom.current = true
      setTimeout(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight }, 50)
    }).catch(() => setLoading(false))
  }

  function goBackToList() {
    setChatView('list')
    setChatTarget(null)
    setMessages([])
  }

  function handleTabChange(tab: TopTab) {
    setTopTab(tab)
    setChatView('list')
    setChatTarget(null)
    setMessages([])
  }

  const hasContent = input.trim() || imagePreview || filePreview
  const fmtDur = (s: number) => { const m = Math.floor(s / 60); const sec = s % 60; return `${m}:${sec.toString().padStart(2, '0')}` }

  // Staff list excluding current user (check both uid and barber_id)
  const myBarberId = user?.barber_id || ''
  const otherStaff = staffList.filter(s => s.id !== uid && s.id !== myBarberId)

  return (
    <Shell page="Messages"><FeatureGate feature="messages" label="Messages" requiredPlan="salon">

      {/* Loading — inline spinner, no fullscreen overlay */}
      {loading && messages.length === 0 && requests.length === 0 && applications.length === 0 && chatView === 'conversation' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(1,1,1,.8)' }}>
          <div style={{ width: 24, height: 24, border: '2px solid rgba(255,255,255,.10)', borderTop: '2px solid rgba(255,255,255,.50)', borderRadius: '50%', animation: 'msgLoadSpin .8s linear infinite' }} />
          <style>{`@keyframes msgLoadSpin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}
      <style>{`
        .content { overflow: hidden !important; }
        .msg-input:focus { border-color: rgba(255,255,255,.20) !important; box-shadow: 0 0 0 3px rgba(255,255,255,.04) !important; }
        .msg-list::-webkit-scrollbar { width: 4px; }
        .msg-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 2px; }
        @keyframes msgSlideUp {
          0% { opacity: 0; transform: translateY(16px) scale(.97) }
          60% { transform: translateY(-2px) scale(1.01) }
          100% { opacity: 1; transform: translateY(0) scale(1) }
        }
        .msg-bubble-wrap { animation: msgSlideUp .35s cubic-bezier(.16,1.2,.3,1) both }
        @keyframes sendGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); }
          50% { box-shadow: 0 0 12px 3px rgba(255,255,255,.08); }
        }
        .msg-send-glow { animation: sendGlow 1.8s ease-in-out infinite; }
        @keyframes reactionPopIn {
          0% { opacity: 0; transform: scale(.6) translateY(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes recPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .5; transform: scale(1.3); }
        }
        .rec-pulse { animation: recPulse 1s ease-in-out infinite; }
        @keyframes waveBar {
          0%, 100% { height: 4px; }
          50% { height: 16px; }
        }
        .wave-bar { animation: waveBar .6s ease-in-out infinite; }
        @media(max-width:640px) {
          .msg-tabs { gap: 4px !important; }
          .msg-tab { font-size: 10px !important; padding: 0 10px !important; height: 30px !important; }
        }
        .msg-tabs-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; -ms-overflow-style: none; }
        .msg-tabs-scroll::-webkit-scrollbar { display: none; }
        .chat-list-item { transition: background .15s ease; }
        .chat-list-item:active { background: rgba(255,255,255,.08) !important; }
      `}</style>

      <div className="msg-container" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'Inter,sans-serif', color: '#e8e8ed' }}>
        {/* Top tab bar — only show when NOT in conversation view */}
        {!(topTab === 'chat' && chatView === 'conversation') && (
          <div className="msg-tabs msg-tabs-scroll" style={{ display: 'flex', gap: 6, padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,.06)', overflowX: 'auto', flexShrink: 0 }}>
            {visibleTabs.map(t => {
              const isActive = topTab === t.id
              return (
                <button key={t.id} className="msg-tab" onClick={() => handleTabChange(t.id)}
                  style={{
                    height: 32, padding: '0 12px', borderRadius: 999,
                    border: `1px solid ${isActive ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.06)'}`,
                    background: isActive ? 'rgba(255,255,255,.08)' : 'transparent',
                    color: isActive ? '#e8e8ed' : 'rgba(255,255,255,.35)',
                    cursor: 'pointer', fontWeight: isActive ? 600 : 400, fontSize: 11, fontFamily: 'inherit',
                    whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
                    transition: 'all .2s ease',
                  }}>
                  <TabIcon id={t.id} color={isActive ? (TAB_COLORS[t.id] || '#fff') : 'rgba(255,255,255,.25)'} /> {t.label}
                </button>
              )
            })}
          </div>
        )}

        {/* ─── CONTENT ─── */}

        {/* ─── Applications tab ─── */}
        {topTab === 'applications' ? (
          <div className="msg-list" style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
            {loading && !messages.length && !requests.length && !applications.length && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 40 }}><div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,.08)', borderTop: '2px solid rgba(255,255,255,.40)', borderRadius: '50%', animation: 'msgSpin .8s linear infinite' }} /><style>{`@keyframes msgSpin{to{transform:rotate(360deg)}}`}</style></div>}
            {!loading && applications.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,.20)' }}>
                <div style={{ marginBottom: 8 }}><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="1.5" strokeLinecap="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg></div>
                <div style={{ fontSize: 13 }}>No applications yet</div>
              </div>
            )}
            {applications.map(app => {
              const roleType = String(app.role || app.type || '').toLowerCase()
              const isBarber = roleType.includes('barber') && !roleType.includes('academy')
              const isAcademy = roleType.includes('academy')
              const statusColors: Record<string,{bg:string;border:string;color:string}> = {
                new:       { bg: 'rgba(255,255,255,.04)', border: 'rgba(255,255,255,.12)', color: 'rgba(130,150,220,.6)' },
                reviewed:  { bg: 'rgba(255,207,63,.08)', border: 'rgba(255,207,63,.35)', color: 'rgba(220,190,130,.5)' },
                interview: { bg: 'rgba(168,107,255,.08)', border: 'rgba(168,107,255,.35)', color: 'rgba(180,140,220,.6)' },
                hired:     { bg: 'rgba(143,240,177,.08)', border: 'rgba(143,240,177,.35)', color: 'rgba(130,220,170,.5)' },
                rejected:  { bg: 'rgba(255,107,107,.08)', border: 'rgba(255,107,107,.35)', color: 'rgba(220,130,160,.5)' },
              }
              const sc = statusColors[app.status] || statusColors.new
              const roleBadge = isAcademy ? { bg: 'rgba(168,107,255,.12)', border: 'rgba(168,107,255,.40)', color: 'rgba(180,140,220,.6)', label: 'ACADEMY' } : isBarber ? { bg: 'rgba(255,255,255,.06)', border: 'rgba(255,255,255,.12)', color: 'rgba(130,150,220,.6)', label: 'TEAM MEMBER' } : { bg: 'rgba(143,240,177,.12)', border: 'rgba(143,240,177,.40)', color: 'rgba(130,220,170,.5)', label: 'ADMIN' }
              return (
                <div key={app.id} style={{ padding: '14px 16px', borderRadius: 16, border: `1px solid ${sc.border}`, background: sc.bg, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 900, fontSize: 15 }}>{app.name}</span>
                      <span style={{ fontSize: 9, letterSpacing: '.10em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 999, border: `1px solid ${roleBadge.border}`, background: roleBadge.bg, color: roleBadge.color, fontWeight: 900 }}>{roleBadge.label}</span>
                      <span style={{ fontSize: 9, letterSpacing: '.10em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 999, border: `1px solid ${sc.border}`, color: sc.color, fontWeight: 700 }}>{app.status}</span>
                    </div>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,.30)' }}>{app.created_at?.slice(0, 10)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.60)', lineHeight: 1.6, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '4px 16px' }}>
                    {app.phone && <div><b style={{ color: 'rgba(255,255,255,.40)' }}>Phone:</b> {app.phone}</div>}
                    {app.email && <div><b style={{ color: 'rgba(255,255,255,.40)' }}>Email:</b> {app.email}</div>}
                    {app.instagram && <div><b style={{ color: 'rgba(255,255,255,.40)' }}>IG:</b> {app.instagram}</div>}
                    {app.experience && <div><b style={{ color: 'rgba(255,255,255,.40)' }}>Experience:</b> {app.experience}</div>}
                    {app.english && app.english !== 'N/A' && <div><b style={{ color: 'rgba(255,255,255,.40)' }}>English:</b> {app.english}</div>}
                    {app.fulltime && <div><b style={{ color: 'rgba(255,255,255,.40)' }}>Availability:</b> {app.fulltime}</div>}
                    {isBarber && app.license && <div><b style={{ color: 'rgba(255,255,255,.40)' }}>License:</b> {app.license}</div>}
                    {isBarber && app.fade_level && <div><b style={{ color: 'rgba(255,255,255,.40)' }}>Fade:</b> {app.fade_level}</div>}
                    {isBarber && app.beard && <div><b style={{ color: 'rgba(255,255,255,.40)' }}>Beard:</b> {app.beard}</div>}
                    {!isBarber && !isAcademy && app.admin_experience && <div><b style={{ color: 'rgba(255,255,255,.40)' }}>Clients:</b> {app.admin_experience}</div>}
                    {!isBarber && !isAcademy && app.multitask && <div><b style={{ color: 'rgba(255,255,255,.40)' }}>Multitask:</b> {app.multitask}</div>}
                    {isAcademy && app.schedule && <div><b style={{ color: 'rgba(255,255,255,.40)' }}>Schedule:</b> {app.schedule}</div>}
                  </div>
                  {(app.motivation || app.message || app.barber_notes || app.admin_notes) && (
                    <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,.50)', fontStyle: 'italic' }}>{app.motivation || app.message || app.barber_notes || app.admin_notes}</div>
                  )}
                  {isOwnerOrAdmin && app.status === 'new' && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      {['reviewed', 'interview', 'hired', 'rejected'].map(s => (
                        <button key={s} onClick={async () => { try { await apiFetch(`/api/applications/${app.id}`, { method: 'PATCH', body: JSON.stringify({ status: s }) }); loadApplications() } catch (e: any) { alert(e.message) } }}
                          style={{ height: 28, padding: '0 10px', borderRadius: 8, border: `1px solid ${(statusColors[s] || statusColors.new).border}`, background: (statusColors[s] || statusColors.new).bg, color: (statusColors[s] || statusColors.new).color, cursor: 'pointer', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'inherit' }}>{s}</button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

        ) : topTab === 'requests' ? (
          /* ─── Requests tab ─── */
          <div className="msg-list" style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
            {(role === 'barber') && (
              <div style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', marginBottom: 12, fontSize: 12, color: 'rgba(255,255,255,.40)', lineHeight: 1.5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.30)" strokeWidth="2" strokeLinecap="round" style={{ verticalAlign: 'middle', marginRight: 6 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                Requests are created automatically when you change your schedule, photo, or profile in Calendar Settings.
              </div>
            )}
            {loading && !messages.length && !requests.length && !applications.length && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 40 }}><div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,.08)', borderTop: '2px solid rgba(255,255,255,.40)', borderRadius: '50%', animation: 'msgSpin .8s linear infinite' }} /><style>{`@keyframes msgSpin{to{transform:rotate(360deg)}}`}</style></div>}
            {!loading && requests.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,.20)' }}>
                <div style={{ marginBottom: 8 }}><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="17" x2="13" y2="17"/></svg></div>
                <div style={{ fontSize: 13 }}>No requests</div>
              </div>
            )}
            {requests.map(req => (
              <RequestCard key={req.id} req={req} isOwnerOrAdmin={isOwnerOrAdmin} onReview={reviewRequest} />
            ))}
          </div>

        ) : topTab === 'chat' && chatView === 'list' ? (
          /* ─── Chat List View ─── */
          <div className="msg-list" style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
            {/* Team Chat card */}
            <button className="chat-list-item" onClick={() => openChat('team', 'Team Chat')}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 18, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', backdropFilter: 'saturate(180%) blur(20px)', cursor: 'pointer', marginBottom: 16, textAlign: 'left', fontFamily: 'inherit', color: 'inherit' }}>
              {/* Group icon */}
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, rgba(130,150,220,.25), rgba(130,150,220,.10))', border: '1px solid rgba(130,150,220,.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(130,150,220,.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e8ed' }}>Team Chat</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginTop: 1 }}>All staff</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.20)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            {/* Direct Messages header */}
            {otherStaff.length > 0 && (
              <>
                <div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.30)', fontWeight: 700, padding: '0 4px 8px', marginTop: 4 }}>Direct Messages</div>
                {otherStaff.map(s => {
                  const staffRole = s.role || 'barber'
                  const rc = ROLE_COLORS[staffRole] || 'rgba(255,255,255,.30)'
                  const rg = ROLE_GRADIENTS[staffRole] || 'rgba(255,255,255,.10)'
                  return (
                    <button key={s.id} className="chat-list-item" onClick={() => openChat(dmChatType(uid, s.id), s.name, s.photo_url)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 14, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.02)', cursor: 'pointer', marginBottom: 4, textAlign: 'left', fontFamily: 'inherit', color: 'inherit' }}>
                      {/* Avatar */}
                      {s.photo_url ? (
                        <img src={s.photo_url} alt="" style={{ width: 38, height: 38, borderRadius: 999, objectFit: 'cover', border: '1.5px solid rgba(255,255,255,.12)', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 38, height: 38, borderRadius: 999, background: rg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#1a1a2e', flexShrink: 0 }}>
                          {initials(s.name)}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8ed' }}>{s.name}</div>
                      </div>
                      <span style={{ fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 999, border: `1px solid ${rc}`, color: rc, fontWeight: 700, opacity: .7, flexShrink: 0 }}>{staffRole}</span>
                    </button>
                  )
                })}
              </>
            )}

            {otherStaff.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: 20, color: 'rgba(255,255,255,.20)', fontSize: 12 }}>No other staff members found</div>
            )}
          </div>

        ) : (
          /* ─── Conversation View ─── */
          <>
            {/* Conversation header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
              <button onClick={goBackToList}
                style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)', color: '#e8e8ed', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              {chatTarget?.photo ? (
                <img src={chatTarget.photo} alt="" style={{ width: 32, height: 32, borderRadius: 999, objectFit: 'cover', border: '1.5px solid rgba(255,255,255,.12)', flexShrink: 0 }} />
              ) : chatTarget?.chatType === 'general' ? (
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, rgba(130,150,220,.25), rgba(130,150,220,.10))', border: '1px solid rgba(130,150,220,.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(130,150,220,.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: 999, background: 'rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,.50)', flexShrink: 0 }}>
                  {chatTarget ? initials(chatTarget.label) : '?'}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#e8e8ed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chatTarget?.label || 'Chat'}</div>
                {chatTarget?.chatType === 'general' && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.30)' }}>All staff</div>}
              </div>
            </div>

            {/* Messages list */}
            <div ref={listRef} className="msg-list" onScroll={onScroll}
              style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 12, paddingBottom: 8 }}>
              {loading && messages.length === 0 && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 40 }}><div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,.08)', borderTop: '2px solid rgba(255,255,255,.40)', borderRadius: '50%', animation: 'msgSpin .8s linear infinite' }} /><style>{`@keyframes msgSpin{to{transform:rotate(360deg)}}`}</style></div>}
              {!loading && messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,.20)' }}>
                  <div style={{ marginBottom: 8 }}><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
                  <div style={{ fontSize: 13 }}>No messages yet</div>
                  <div style={{ fontSize: 11, marginTop: 4, color: 'rgba(255,255,255,.15)' }}>Be the first to say something!</div>
                </div>
              )}
              {messages.map((msg, i) => {
                const prev = i > 0 ? messages[i - 1] : null
                const isGrouped = prev?.senderId === msg.senderId && prev?.senderName === msg.senderName
                return <MessageBubble key={msg.id} msg={msg} isOwn={msg.senderId === uid} onImageClick={url => setLightboxUrl(url)} isGrouped={isGrouped} onReaction={handleReaction} myUid={uid} />
              })}
            </div>

            {/* Attachment previews */}
            {(imagePreview || filePreview) && (
              <div style={{ padding: '8px 16px 0', flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
                {imagePreview && <img src={imagePreview} alt="" style={{ width: 60, height: 60, borderRadius: 10, objectFit: 'cover', border: '1px solid rgba(255,255,255,.14)' }} />}
                {filePreview && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.10)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,207,63,.70)" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,.70)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filePreview.name}</span>
                  </div>
                )}
                <button onClick={() => { setImagePreview(''); setFilePreview(null) }} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid rgba(255,107,107,.30)', background: 'rgba(255,107,107,.08)', color: 'rgba(220,130,160,.5)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            )}

            {/* Input Bar — glass style */}
            <div style={{ padding: '4px 10px', paddingBottom: 'max(6px, env(safe-area-inset-bottom))', flexShrink: 0, display: 'flex', gap: 6, alignItems: 'center', background: 'rgba(18,18,18,.50)', backdropFilter: 'blur(30px) saturate(180%)', WebkitBackdropFilter: 'blur(30px) saturate(180%)', borderTop: '1px solid rgba(255,255,255,.04)' } as React.CSSProperties}>
              {isRecording && voiceSupported ? (
                /* Recording UI */
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, height: 36 }}>
                  <button onClick={cancelRecording} style={{ width: 36, height: 36, borderRadius: 999, border: '1px solid rgba(255,107,107,.30)', background: 'rgba(255,107,107,.10)', color: 'rgba(220,130,160,.5)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                  <div className="rec-pulse" style={{ width: 8, height: 8, borderRadius: 999, background: '#ff3b30', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#ff6b6b', fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: 36 }}>{fmtDur(recordingDuration)}</span>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, height: 24 }}>
                    {Array.from({ length: 20 }, (_, i) => (
                      <div key={i} className="wave-bar" style={{ width: 3, borderRadius: 2, background: 'rgba(255,59,48,.60)', animationDelay: `${i * 0.08}s` }} />
                    ))}
                  </div>
                  <button onClick={handleVoiceToggle} style={{ width: 34, height: 34, borderRadius: 999, border: 'none', background: 'linear-gradient(135deg, rgba(255,255,255,.15), rgba(255,255,255,.10))', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 12px rgba(255,255,255,.08)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </button>
                </div>
              ) : (
                /* Normal input UI */
                <>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button onClick={() => setShowAttachMenu(v => !v)}
                      style={{ width: 34, height: 34, borderRadius: 999, border: `1px solid ${showAttachMenu ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.08)'}`, background: showAttachMenu ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all .2s ease', transform: showAttachMenu ? 'rotate(45deg)' : 'none', color: showAttachMenu ? 'rgba(130,150,220,.6)' : 'rgba(255,255,255,.40)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                    {showAttachMenu && (
                      <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 98 }} onClick={() => setShowAttachMenu(false)} />
                        <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 8, zIndex: 99, display: 'flex', flexDirection: 'column', gap: 4, padding: '6px', borderRadius: 16, background: 'rgba(20,20,20,.92)', border: '1px solid rgba(255,255,255,.12)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 8px 32px rgba(0,0,0,.5)', animation: 'reactionPopIn .2s ease', minWidth: 150 }}>
                          <label onClick={() => setShowAttachMenu(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', background: 'transparent', border: 'none', color: '#e8e8ed', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}
                            onPointerDown={e => (e.currentTarget.style.background = 'rgba(255,255,255,.06)')} onPointerUp={e => (e.currentTarget.style.background = 'transparent')}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                            Photo
                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { handleImageAttach(e.target.files?.[0] || null); e.target.value = '' }} />
                          </label>
                          <label onClick={() => setShowAttachMenu(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', background: 'transparent', border: 'none', color: '#e8e8ed', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}
                            onPointerDown={e => (e.currentTarget.style.background = 'rgba(255,255,255,.06)')} onPointerUp={e => (e.currentTarget.style.background = 'transparent')}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,207,63,.80)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            File
                            <input type="file" accept="*/*" style={{ display: 'none' }} onChange={e => { handleFileAttach(e.target.files?.[0] || null); e.target.value = '' }} />
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                  <input className="msg-input" value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                    onPaste={e => {
                      const items = e.clipboardData?.items
                      if (!items) return
                      for (let i = 0; i < items.length; i++) {
                        if (items[i].type.startsWith('image/')) {
                          e.preventDefault()
                          const file = items[i].getAsFile()
                          if (file) handleImageAttach(file)
                          return
                        }
                      }
                    }}
                    placeholder="Type a message..."
                    style={{ flex: 1, height: 36, borderRadius: 18, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.06)', color: '#fff', padding: '0 14px', outline: 'none', fontSize: 13, fontFamily: 'inherit', transition: 'border-color .2s, box-shadow .2s' }} />
                  {hasContent ? (
                    <button onClick={sendMessage} disabled={sending}
                      className="msg-send-glow"
                      style={{ width: 34, height: 34, borderRadius: 999, border: 'none', background: 'linear-gradient(135deg, rgba(255,255,255,.15), rgba(255,255,255,.10))', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .2s' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </button>
                  ) : voiceSupported ? (
                    <button onClick={handleVoiceToggle}
                      style={{ width: 34, height: 34, borderRadius: 999, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.45)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .2s' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="1" width="6" height="12" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Image lightbox */}
      {lightboxUrl && (
        <div onClick={() => setLightboxUrl('')}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, cursor: 'zoom-out', padding: 16 }}>
          <img src={lightboxUrl} alt="" style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 16, objectFit: 'contain', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }} />
          <button onClick={() => setLightboxUrl('')}
            style={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderRadius: 999, border: '1px solid rgba(255,255,255,.20)', background: 'rgba(0,0,0,.50)', color: '#fff', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      )}

      {/* New request modal */}
      {showNewRequest && <NewRequestModal onClose={() => setShowNewRequest(false)} onCreated={() => { setShowNewRequest(false); loadRequests() }} />}
    </FeatureGate></Shell>
  )
}
