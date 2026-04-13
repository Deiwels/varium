import type { Metadata } from 'next'

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://vuriumbook-api-431945333485.us-central1.run.app'
const SITE_URL = 'https://vurium.com'
const FALLBACK_IMAGE = `${SITE_URL}/logo.jpg`
type BookingLayoutProps = { children: React.ReactNode; params: Promise<{ id: string }> }

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: BookingLayoutProps): Promise<Metadata> {
  const { id } = await params
  const slugOrId = encodeURIComponent(id)
  const resolved = await fetchJson<any>(`/public/resolve/${slugOrId}`)
  const resolvedWsId = resolved?.workspace_id ? encodeURIComponent(resolved.workspace_id) : ''
  const config = resolvedWsId ? await fetchJson<any>(`/public/config/${resolvedWsId}`) : null
  const shopName = String(resolved?.name || config?.shop_name || 'VuriumBook').trim()
  const description = `Book an appointment with ${shopName} online. Choose services, pick a time, and confirm your visit in a few steps.`
  const imageUrl = String(config?.hero_media_url || FALLBACK_IMAGE)
  const canonical = `${SITE_URL}/book/${encodeURIComponent(id)}`

  return {
    title: `Book with ${shopName}`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `Book with ${shopName}`,
      description,
      url: canonical,
      siteName: 'Vurium',
      images: [{ url: imageUrl, alt: `${shopName} booking page` }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Book with ${shopName}`,
      description,
      images: [imageUrl],
    },
  }
}

export default async function PublicBookingLayout({ children, params }: BookingLayoutProps) {
  await params
  return children
}
