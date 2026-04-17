import { API } from '@/lib/api'

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

export async function GET(req: Request) {
  const url = new URL(req.url)
  const isLocalRequest = url.hostname === '127.0.0.1' || url.hostname === 'localhost'
  const backendBase = isLocalRequest ? localBackendBase() : API

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

    const token = escapeHtml(String(data.token))
    return new Response(
      `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Cache-Control" content="no-store" />
    <title>Opening Developer Panel…</title>
  </head>
  <body style="background:#050507;color:#fff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;padding:32px">
    <h1 style="font-size:20px;margin:0 0 12px">Opening Developer Panel…</h1>
    <p style="color:rgba(255,255,255,.65);margin:0 0 18px">Storing your local owner token and redirecting you to Owner Intake.</p>
    <script>
      try {
        localStorage.setItem('vurium_dev_token', '${token}');
        window.location.replace('/developer/intake');
      } catch (e) {
        document.body.innerHTML = '<h1 style="font-size:20px">Local access failed</h1><p style="color:rgba(255,255,255,.65)">Could not store the local developer token.</p><p><a href="/developer/login" style="color:#8ba7ff">Back to login</a></p>';
      }
    </script>
  </body>
</html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    const message = escapeHtml(error instanceof Error ? error.message : 'Local access failed')
    return new Response(
      `<!doctype html><html><head><meta charset="utf-8"><title>Local access failed</title></head><body style="background:#050507;color:#fff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;padding:32px"><h1 style="font-size:20px">Local access failed</h1><p style="color:rgba(255,255,255,.65)">${message}</p><p><a href="/developer/login" style="color:#8ba7ff">Back to login</a></p></body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
    )
  }
}
