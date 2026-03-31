// middleware.ts — Next.js Edge Middleware
// Reads VURIUMBOOK_TOKEN cookie for route protection.
// Does NOT verify JWT signature — only checks exp claim.
// Real auth happens on the backend on every API request.

import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'VURIUMBOOK_TOKEN'

// Routes that don't need auth
const PUBLIC_PATHS = ['/', '/signin', '/signup', '/vuriumbook', '/booking', '/public']

// Routes restricted by role
const OWNER_ADMIN_ONLY = ['/settings', '/payroll', '/billing', '/payments', '/attendance', '/expenses', '/membership']
const STUDENT_BLOCKED  = ['/settings', '/payroll', '/billing', '/payments', '/clients', '/dashboard', '/attendance', '/expenses', '/membership']
const BARBER_REDIRECT  = '/calendar'

// Cookie format: "role:uid" — set from JS after login
// Not a JWT — just a role flag for redirect logic
// Real auth happens on every API call via HttpOnly cookie verified by backend
function parseRoleCookie(value: string): { role: string; uid: string } | null {
  if (!value) return null
  const parts = value.split(':')
  if (parts.length < 1) return null
  const role = parts[0]
  if (!['owner', 'admin', 'barber', 'student'].includes(role)) return null
  return { role, uid: parts[1] || '' }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Always allow public paths, static files, api routes
  if (
    pathname === '/' ||
    PUBLIC_PATHS.some(p => p !== '/' && pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const cookieValue = req.cookies.get(COOKIE_NAME)?.value
    ? decodeURIComponent(req.cookies.get(COOKIE_NAME)!.value)
    : null

  // No cookie → redirect to signin
  if (!cookieValue) {
    const url = req.nextUrl.clone()
    url.pathname = '/signin'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  const parsed = parseRoleCookie(cookieValue)

  // Invalid cookie → redirect to signin + clear cookie
  if (!parsed) {
    const url = req.nextUrl.clone()
    url.pathname = '/signin'
    const res = NextResponse.redirect(url)
    res.cookies.set(COOKIE_NAME, '', { path: '/', maxAge: 0 })
    return res
  }

  const role = parsed.role

  // Barber trying to access owner/admin routes → redirect to calendar
  if (role === 'barber' && OWNER_ADMIN_ONLY.some(p => pathname.startsWith(p))) {
    const url = req.nextUrl.clone()
    url.pathname = BARBER_REDIRECT
    return NextResponse.redirect(url)
  }

  // Student can only access calendar — block everything else
  if (role === 'student' && STUDENT_BLOCKED.some(p => pathname.startsWith(p))) {
    const url = req.nextUrl.clone()
    url.pathname = '/calendar'
    return NextResponse.redirect(url)
  }

  // Authenticated user going to /signin → redirect to their home
  if (pathname.startsWith('/signin')) {
    const url = req.nextUrl.clone()
    url.pathname = (role === 'barber' || role === 'student') ? '/calendar' : '/dashboard'
    return NextResponse.redirect(url)
  }

  // All good — pass through + add role header for server components
  const res = NextResponse.next()
  if (role) res.headers.set('x-user-role', role)
  return res
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static, _next/image
     * - favicon, public files
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
