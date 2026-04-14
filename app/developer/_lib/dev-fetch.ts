import { API } from '@/lib/api'

export function getDevToken(): string {
  try { return localStorage.getItem('vurium_dev_token') || '' } catch { return '' }
}

export function devHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getDevToken()
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...extra }
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

export function devFetch(path: string, opts?: RequestInit): Promise<unknown> {
  const headers = devHeaders(opts?.headers as Record<string, string> | undefined)
  return fetch(`${API}${path}`, { credentials: 'include', ...opts, headers }).then(async (response) => {
    const raw = await response.text()
    let data: unknown = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = raw
    }

    if (!response.ok) {
      const message = typeof data === 'object' && data && 'error' in data
        ? String((data as { error?: unknown }).error || `Developer request failed (${response.status})`)
        : `Developer request failed (${response.status})`
      const error = new Error(message) as Error & { status?: number; data?: unknown }
      error.status = response.status
      error.data = data
      throw error
    }

    return data
  })
}
