'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { API } from '@/lib/api'

const NAV = [
  { href: '/developer', label: 'Analytics', icon: '\u2728' },
  { href: '/developer/email', label: 'Email', icon: '\u2709\uFE0F' },
]

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  // Login and verify pages don't need auth check
  const isAuthPage = pathname === '/developer/login' || pathname === '/developer/verify'

  useEffect(() => {
    if (isAuthPage) { setOk(true); setLoading(false); return }
    fetch(`${API}/api/vurium-dev/ping`, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(() => { setOk(true); setLoading(false) })
      .catch(() => { router.replace('/developer/login') })
  }, [router, isAuthPage])

  if (loading) return null

  // Login/verify pages render without sidebar
  if (isAuthPage) return <div style={{ position: 'relative', zIndex: 2 }}>{children}</div>

  if (!ok) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 2 }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, flexShrink: 0, padding: '24px 16px',
        borderRight: '1px solid rgba(255,255,255,.06)',
        background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 20 }}>
          <img src="/logo.jpg" alt="V" style={{ width: 28, height: 28, borderRadius: 8 }} />
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-.02em', color: 'rgba(255,255,255,.8)' }}>Developer</span>
        </div>
        {NAV.map(n => {
          const active = pathname === n.href || (n.href !== '/developer' && pathname.startsWith(n.href))
          return (
            <a key={n.href} href={n.href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10, textDecoration: 'none',
              fontSize: 13, fontWeight: 500,
              color: active ? 'rgba(130,150,220,.95)' : 'rgba(255,255,255,.5)',
              background: active ? 'rgba(130,150,220,.08)' : 'transparent',
              transition: 'all .15s',
            }}>
              <span style={{ fontSize: 16 }}>{n.icon}</span>
              {n.label}
            </a>
          )
        })}
        <div style={{ flex: 1 }} />
        <button onClick={async () => {
          await fetch(`${API}/api/vurium-dev/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {})
          router.replace('/developer/login')
        }} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
          fontSize: 12, color: 'rgba(255,255,255,.3)', background: 'transparent',
          fontFamily: 'inherit', textAlign: 'left', width: '100%',
        }}>
          Sign out
        </button>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: '32px 40px', maxWidth: 1200, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
