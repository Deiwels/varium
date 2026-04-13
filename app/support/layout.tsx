import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Vurium Support',
  description: 'Find support contact details, privacy request guidance, SMS help, and product assistance for Vurium and VuriumBook.',
  alternates: { canonical: 'https://vurium.com/support' },
  openGraph: {
    title: 'Vurium Support',
    description: 'Find support contact details, privacy request guidance, SMS help, and product assistance for Vurium and VuriumBook.',
    url: 'https://vurium.com/support',
    siteName: 'Vurium',
    images: [{ url: 'https://vurium.com/logo.jpg', alt: 'Vurium support' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vurium Support',
    description: 'Find support contact details, privacy request guidance, SMS help, and product assistance for Vurium and VuriumBook.',
    images: ['https://vurium.com/logo.jpg'],
  },
}

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return children
}
