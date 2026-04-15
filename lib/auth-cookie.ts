// lib/auth-cookie.ts
// Sets non-httpOnly role cookies so middleware.ts can do redirects.
// Canonical cookie is VURIUMBOOK_TOKEN; vuriumbook_auth is a legacy/native alias
// still used by the iOS WKWebView wrapper on cold start.

const COOKIE_NAME = 'VURIUMBOOK_TOKEN'
const LEGACY_ROLE_COOKIE_NAME = 'vuriumbook_auth'
const LEGACY_TOKEN_COOKIE_NAME = 'vuriumbook_token'
const MAX_AGE = 60 * 60 * 24 * 7 // 7 days

// value = "role:uid" e.g. "owner:abc123" or "barber:xyz"
export function setAuthCookie(value: string): void {
  if (typeof document === 'undefined') return
  const isSecure = window.location.protocol === 'https:'
  for (const name of [COOKIE_NAME, LEGACY_ROLE_COOKIE_NAME]) {
    document.cookie = [
      `${name}=${encodeURIComponent(value)}`,
      `path=/`,
      `max-age=${MAX_AGE}`,
      `SameSite=Lax`,
      isSecure ? 'Secure' : '',
    ].filter(Boolean).join('; ')
  }
}

export function clearAuthCookie(): void {
  if (typeof document === 'undefined') return
  for (const name of [COOKIE_NAME, LEGACY_ROLE_COOKIE_NAME, LEGACY_TOKEN_COOKIE_NAME]) {
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
  }
}
