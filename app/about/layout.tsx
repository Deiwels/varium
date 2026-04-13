import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About Vurium',
  description: 'Learn what Vurium is building for service businesses and how VuriumBook is designed to simplify daily operations.',
  alternates: { canonical: 'https://vurium.com/about' },
  openGraph: {
    title: 'About Vurium',
    description: 'Learn what Vurium is building for service businesses and how VuriumBook is designed to simplify daily operations.',
    url: 'https://vurium.com/about',
    siteName: 'Vurium',
    images: [{ url: 'https://vurium.com/logo.jpg', alt: 'Vurium logo' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About Vurium',
    description: 'Learn what Vurium is building for service businesses and how VuriumBook is designed to simplify daily operations.',
    images: ['https://vurium.com/logo.jpg'],
  },
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children
}
