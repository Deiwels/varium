'use client'

import { useState, useEffect } from 'react'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('cookie_notice_seen')) {
      setVisible(true)
    }
  }, [])

  function dismiss() {
    localStorage.setItem('cookie_notice_seen', '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: 'rgba(10,10,14,.95)', backdropFilter: 'blur(12px)',
      borderTop: '1px solid rgba(255,255,255,.08)',
      padding: '16px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 16, flexWrap: 'wrap',
    }}>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', margin: 0, lineHeight: 1.5, maxWidth: 600 }}>
        We use a strictly necessary cookie to keep you signed in. No tracking or advertising cookies are used.{' '}
        <a href="/cookies" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Cookie Policy</a>
      </p>
      <button
        onClick={dismiss}
        style={{
          padding: '8px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,.12)',
          background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.7)',
          fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
          whiteSpace: 'nowrap',
        }}
      >
        Got it
      </button>
    </div>
  )
}
