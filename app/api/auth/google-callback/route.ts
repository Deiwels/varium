import { NextRequest, NextResponse } from 'next/server'

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://vuriumbook-api-431945333485.us-central1.run.app'

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code')
    const error = req.nextUrl.searchParams.get('error')

    if (error || !code) {
      return NextResponse.redirect(new URL('/signin?error=google_cancelled', req.url))
    }

    // Send code to backend — it will exchange for tokens and verify
    const res = await fetch(`${API}/auth/google-signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })

    const data = await res.json()
    console.log('[Google Callback] Backend response:', res.status, JSON.stringify(data).substring(0, 200))

    if (!data.ok || !data.token) {
      const errorMsg = encodeURIComponent(data.error || 'google_failed')
      return NextResponse.redirect(new URL(`/signin?error=${errorMsg}`, req.url))
    }

    // Return HTML page that stores token in localStorage and redirects (same as Apple)
    const role = data.user?.role || 'owner'
    const dest = (role === 'barber' || role === 'student') ? '/calendar' : '/dashboard'
    const tokenEsc = data.token.replace(/'/g, "\\'")
    const userEsc = JSON.stringify(data.user).replace(/'/g, "\\'")

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>
      localStorage.setItem('VURIUMBOOK_TOKEN','${tokenEsc}');
      localStorage.setItem('VURIUMBOOK_USER','${userEsc}');
      document.cookie='VURIUMBOOK_TOKEN=${role}:${data.user?.uid || ""};path=/;max-age=${7 * 24 * 60 * 60}';
      document.cookie='vuriumbook_auth=${role}:${data.user?.uid || ""};path=/;max-age=${7 * 24 * 60 * 60}';
      window.location.replace('${dest}');
    </script></body></html>`

    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })
  } catch (e) {
    console.error('Google callback error:', e)
    return NextResponse.redirect(new URL('/signin?error=google_callback_failed', req.url))
  }
}
