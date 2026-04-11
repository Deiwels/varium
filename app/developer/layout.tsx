'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { API } from '@/lib/api'

function IconOverview() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/></svg>
}
function IconAnalytics() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 14V8M6 14V4M10 14V6M14 14V2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
}
function IconEmail() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M1 5l7 4 7-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function IconBack() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function IconLogout() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2H3a1 1 0 00-1 1v8a1 1 0 001 1h2M9 10l3-3-3-3M12 7H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

const NAV = [
  { href: '/developer', label: 'Overview', Icon: IconOverview },
  { href: '/developer/analytics', label: 'Analytics', Icon: IconAnalytics },
  { href: '/developer/email', label: 'Email', Icon: IconEmail },
]

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  const isAuthPage = pathname === '/developer/login' || pathname === '/developer/verify'

  useEffect(() => {
    if (isAuthPage) { setOk(true); setLoading(false); return }
    fetch(`${API}/api/vurium-dev/ping`, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(() => { setOk(true); setLoading(false) })
      .catch(() => { router.replace('/developer/login') })
  }, [router, isAuthPage])

  if (loading) return null
  if (isAuthPage) return <div style={{ position: 'relative', zIndex: 2 }}>{children}</div>
  if (!ok) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 2 }}>
      <aside style={{
        width: 220, flexShrink: 0, padding: '24px 16px',
        borderRight: '1px solid rgba(255,255,255,.06)',
        background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 24 }}>
          <img src="/logo.jpg" alt="V" style={{ width: 28, height: 28, borderRadius: 8 }} />
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-.02em', color: 'rgba(255,255,255,.8)' }}>Developer</span>
        </div>

        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.2)', padding: '8px 12px 4px' }}>Platform</div>

        {NAV.map(n => {
          const active = pathname === n.href || (n.href !== '/developer' && pathname.startsWith(n.href))
          return (
            <a key={n.href} href={n.href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 10, textDecoration: 'none',
              fontSize: 13, fontWeight: 500,
              color: active ? 'rgba(130,150,220,.95)' : 'rgba(255,255,255,.45)',
              background: active ? 'rgba(130,150,220,.08)' : 'transparent',
              transition: 'all .15s',
            }}>
              <n.Icon />
              {n.label}
            </a>
          )
        })}

        <div style={{ flex: 1 }} />

        <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 8, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <a href="/dashboard" style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 12px', borderRadius: 10, textDecoration: 'none',
            fontSize: 12, color: 'rgba(255,255,255,.3)',
          }}>
            <IconBack /> VuriumBook
          </a>
          <button onClick={async () => {
            await fetch(`${API}/api/vurium-dev/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {})
            router.replace('/developer/login')
          }} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontSize: 12, color: 'rgba(255,255,255,.25)', background: 'transparent',
            fontFamily: 'inherit', textAlign: 'left', width: '100%',
          }}>
            <IconLogout /> Sign out
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: '32px 40px', maxWidth: 1200, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
