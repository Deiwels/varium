'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { devFetch, devHeaders, getDevApiBase } from './_lib/dev-fetch'
import { ToastProvider } from './_components/Toast'

function IconOverview() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/></svg>
}
function IconAnalytics() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 14V8M6 14V4M10 14V6M14 14V2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
}
function IconEmail() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M1 5l7 4 7-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function IconAI() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/><path d="M8 1v3M8 12v3M1 8h3M12 8h3M3.05 3.05l2.12 2.12M10.83 10.83l2.12 2.12M3.05 12.95l2.12-2.12M10.83 5.17l2.12-2.12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
}
function IconIntake() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 4.5A2.5 2.5 0 015.5 2h5A2.5 2.5 0 0113 4.5v4A2.5 2.5 0 0110.5 11H8l-3 3v-3H5.5A2.5 2.5 0 013 8.5v-4z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><path d="M5.5 5.5h5M5.5 7.75h3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
}
function IconSMS() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M4 13l2-1h4l2 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M4 7h8M4 9.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
}
function IconBack() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function IconLogout() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2H3a1 1 0 00-1 1v8a1 1 0 001 1h2M9 10l3-3-3-3M12 7H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function IconMenu() {
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
}

const NAV = [
  { href: '/developer', label: 'Overview', Icon: IconOverview },
  { href: '/developer/intake', label: 'Owner Intake', Icon: IconIntake },
  { href: '/developer/analytics', label: 'Analytics', Icon: IconAnalytics },
  { href: '/developer/email', label: 'Email', Icon: IconEmail },
  { href: '/developer/sms', label: 'SMS', Icon: IconSMS },
  { href: '/developer/ai', label: 'AI Diagnostics', Icon: IconAI },
]

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(false)
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const isAuthPage = pathname === '/developer/login' || pathname === '/developer/verify'

  useEffect(() => {
    if (isAuthPage) { setOk(true); setLoading(false); return }
    devFetch('/api/vurium-dev/ping')
      .then(() => { setOk(true); setLoading(false) })
      .catch(() => { router.replace('/developer/login') })
  }, [router, isAuthPage])

  useEffect(() => { setMenuOpen(false) }, [pathname])

  if (loading) return null
  if (isAuthPage) return <div style={{ position: 'relative', zIndex: 2 }}>{children}</div>
  if (!ok) return null

  return (
    <ToastProvider>
      <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 2 }}>
        {/* Mobile header */}
        <div className="dev-mobile-header" style={{
          display: 'none', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
          height: 56, padding: '0 16px', alignItems: 'center', gap: 12,
          background: 'rgba(6,6,10,.95)', borderBottom: '1px solid rgba(255,255,255,.06)',
        }}>
          <button onClick={() => setMenuOpen(!menuOpen)} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'rgba(255,255,255,.6)',
          }}><IconMenu /></button>
          <img src="/logo.jpg" alt="V" style={{ width: 24, height: 24, borderRadius: 6 }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,.8)' }}>Developer</span>
        </div>

        {/* Sidebar overlay for mobile */}
        {menuOpen && (
          <div
            onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 98 }}
            className="dev-mobile-overlay"
          />
        )}

        {/* Sidebar */}
        <aside className="dev-sidebar" style={{
          width: 220, flexShrink: 0, padding: '24px 16px',
          borderRight: '1px solid rgba(255,255,255,.06)',
          background: 'rgba(6,6,10,.88)',
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
              await fetch(`${getDevApiBase()}/api/vurium-dev/auth/logout`, { method: 'POST', credentials: 'include', headers: devHeaders() }).catch(() => {})
              try { localStorage.removeItem('vurium_dev_token') } catch {}
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

        <main className="dev-main" style={{ flex: 1, padding: '32px 40px', maxWidth: 1200, overflow: 'auto' }}>
          {children}
        </main>

        <style>{`
          @media (max-width: 768px) {
            .dev-mobile-header { display: flex !important; }
            .dev-sidebar {
              position: fixed !important; top: 0; left: 0; bottom: 0; z-index: 99;
              transform: ${menuOpen ? 'translateX(0)' : 'translateX(-100%)'};
              transition: transform .25s ease;
              padding-top: 16px !important;
            }
            .dev-main { padding: 72px 16px 24px !important; }
          }
        `}</style>
      </div>
    </ToastProvider>
  )
}
