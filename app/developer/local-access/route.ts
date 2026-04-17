import { NextResponse } from 'next/server'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function localBackendBase() {
  return 'http://127.0.0.1:8080'
}

function remoteBackendBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'https://vuriumbook-api-431945333485.us-central1.run.app'
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const isLocalRequest = url.hostname === '127.0.0.1' || url.hostname === 'localhost'
  const backendBase = isLocalRequest ? localBackendBase() : remoteBackendBase()

  try {
    const response = await fetch(`${backendBase}/api/vurium-dev/auth/local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      cache: 'no-store',
    })

    const data = await response.json().catch(() => ({} as { error?: string; token?: string }))
    if (!response.ok || !data?.token) {
      const errorMessage = escapeHtml(String(data?.error || 'Local access failed'))
      return new Response(
        `<!doctype html><html><head><meta charset="utf-8"><title>Local access failed</title></head><body style="background:#050507;color:#fff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;padding:32px"><h1 style="font-size:20px">Local access failed</h1><p style="color:rgba(255,255,255,.65)">${errorMessage}</p><p><a href="/developer/login" style="color:#8ba7ff">Back to login</a></p></body></html>`,
        { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
      )
    }

    const token = String(data.token)
    const next = new NextResponse(null, { status: 302 })
    next.headers.set('Location', '/developer/intake')
    next.cookies.set('vurium_admin_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 60 * 60 * 24,
    })
    // Keep the lightweight localStorage token too as a client-side fallback for existing dev fetch helpers.
    next.cookies.set('vurium_dev_bootstrap', token, {
      httpOnly: false,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 60 * 5,
    })
    return next
  } catch (error) {
    const message = escapeHtml(error instanceof Error ? error.message : 'Local access failed')
    return new Response(
      `<!doctype html><html><head><meta charset="utf-8"><title>Local access failed</title></head><body style="background:#050507;color:#fff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;padding:32px"><h1 style="font-size:20px">Local access failed</h1><p style="color:rgba(255,255,255,.65)">${message}</p><p><a href="/developer/login" style="color:#8ba7ff">Back to login</a></p></body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
    )
  }
}
