const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://vuriumbook-api-431945333485.us-central1.run.app';

export async function apiFetch(path: string, options: RequestInit = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'API error');
  }
  return res.json();
}

export async function getPublicBarbers(workspaceId: string) {
  return apiFetch(`/public/barbers/${workspaceId}`);
}

export async function getPublicServices(workspaceId: string) {
  return apiFetch(`/public/services/${workspaceId}`);
}

export async function getPublicAvailability(workspaceId: string, body: {
  barber_id: string;
  start_at: string;
  end_at: string;
  duration_minutes?: number;
}) {
  return apiFetch(`/public/availability/${workspaceId}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function createPublicBooking(workspaceId: string, body: {
  barber_id: string;
  start_at: string;
  client_name: string;
  client_phone?: string;
  service_id?: string;
  service_name?: string;
  barber_name?: string;
  duration_minutes?: number;
  customer_note?: string;
}) {
  return apiFetch(`/public/bookings/${workspaceId}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getPublicConfig(workspaceId: string) {
  return apiFetch(`/public/config/${workspaceId}`);
}
