const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://vuriumbook-api-431945333485.us-central1.run.app'

const API_KEY = ''

export { API, API_KEY }

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
        window.location.replace('/signin')
      }
    }
  }
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status)
  return data
}

// Public API helpers (no auth needed)
export async function getPublicBarbers(workspaceId: string) {
  return apiFetch(`/public/barbers/${workspaceId}`)
}

export async function getPublicServices(workspaceId: string) {
  return apiFetch(`/public/services/${workspaceId}`)
}

export async function getPublicAvailability(workspaceId: string, body: {
  barber_id: string; start_at: string; end_at: string; duration_minutes?: number;
}) {
  return apiFetch(`/public/availability/${workspaceId}`, { method: 'POST', body: JSON.stringify(body) })
}

export async function createPublicBooking(workspaceId: string, body: Record<string, unknown>) {
  return apiFetch(`/public/bookings/${workspaceId}`, { method: 'POST', body: JSON.stringify(body) })
}
