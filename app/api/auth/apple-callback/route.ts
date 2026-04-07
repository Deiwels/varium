import { NextRequest, NextResponse } from 'next/server'

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://vuriumbook-api-431945333485.us-central1.run.app'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const idToken = formData.get('id_token') as string
    const code = formData.get('code') as string
    const userStr = formData.get('user') as string // Apple sends user info as JSON string on first sign-in

    if (!idToken) {
      return NextResponse.redirect(new URL('/signin?error=no_token', req.url))
    }

    // Parse user info if available (first sign-in only)
    let fullName: { givenName?: string; familyName?: string } | undefined
    let email: string | undefined
    if (userStr) {
      try {
        const user = JSON.parse(userStr)
        fullName = user.name
        email = user.email
      } catch {}
    }

    // Send to backend for verification
    const res = await fetch(`${API}/auth/apple-signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identityToken: idToken,
        userIdentifier: '',
        fullName,
        email,
      }),
    })

    const data = await res.json()

    if (!data.ok || !data.token) {
      return NextResponse.redirect(new URL('/signin?error=apple_failed', req.url))
    }

    // Return an HTML page that stores token in localStorage and redirects
    const role = data.user?.role || 'owner'
    const dest = (role === 'barber' || role === 'student') ? '/calendar' : '/dashboard'
    const tokenEsc = data.token.replace(/'/g, "\\'")
    const userEsc = JSON.stringify(data.user).replace(/'/g, "\\'")

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>
      localStorage.setItem('VURIUMBOOK_TOKEN','${tokenEsc}');
      localStorage.setItem('VURIUMBOOK_USER','${userEsc}');
      document.cookie='vuriumbook_auth=${role}:${data.user?.uid || ""};path=/;max-age=${7*24*60*60}';
      window.location.replace('${dest}');
    </script></body></html>`

    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })
  } catch (e) {
    console.error('Apple callback error:', e)
    return NextResponse.redirect(new URL('/signin?error=callback_failed', req.url))
  }
}
