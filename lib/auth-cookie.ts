// lib/auth-cookie.ts
// Sets a non-httpOnly cookie with role:uid so middleware.ts can do redirects.
// The real auth token is in the backend's HttpOnly cookie (set by /api/auth/login).

const COOKIE_NAME = 'VURIUMBOOK_TOKEN'
const MAX_AGE = 60 * 60 * 24 * 7 // 7 days

// value = "role:uid" e.g. "owner:abc123" or "barber:xyz"
export function setAuthCookie(value: string): void {
  if (typeof document === 'undefined') return
  const isSecure = window.location.protocol === 'https:'
  document.cookie = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    `path=/`,
    `max-age=${MAX_AGE}`,
    `SameSite=Lax`,
    isSecure ? 'Secure' : '',
  ].filter(Boolean).join('; ')
}

export function clearAuthCookie(): void {
  if (typeof document === 'undefined') return
  // Match the attributes used in setAuthCookie (including Secure on HTTPS) so the
  // delete actually applies. Safari/WKWebView ignores cookie deletes that drop
  // the Secure flag a cookie was originally set with, which previously left the
  // role cookie alive after sign-out and caused the middleware to redirect users
  // back to /dashboard on iOS.
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:'
  document.cookie = [
    `${COOKIE_NAME}=`,
    'path=/',
    'max-age=0',
    'SameSite=Lax',
    isSecure ? 'Secure' : '',
  ].filter(Boolean).join('; ')
}
