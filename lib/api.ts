const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export { API }

export async function apiFetch(path: string, opts?: RequestInit) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('VURIUMBOOK_TOKEN') || '' : ''
  const res = await fetch(API + path, {
    credentials: 'include',
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts?.headers || {}),
    },
  })
  if (res.status === 401) {
    if (typeof window !== 'undefined' && !path.includes('/auth/login')) {
      localStorage.removeItem('VURIUMBOOK_TOKEN')
      if (localStorage.getItem('VURIUMBOOK_PIN_HASH')) {
        window.dispatchEvent(new CustomEvent('vuriumbook-pin-required'))
      } else {
        localStorage.removeItem('VURIUMBOOK_USER')
        window.location.href = '/signin'
      }
    }
  }
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status)
  return data
}
