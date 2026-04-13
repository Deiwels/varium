import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'VuriumBook Pricing and Features',
  description: 'Explore VuriumBook for barbershops, salons, and service businesses with booking, payments, team management, and client tools in one place.',
  alternates: { canonical: 'https://vurium.com/vuriumbook' },
  openGraph: {
    title: 'VuriumBook Pricing and Features',
    description: 'Explore VuriumBook for barbershops, salons, and service businesses with booking, payments, team management, and client tools in one place.',
    url: 'https://vurium.com/vuriumbook',
    siteName: 'Vurium',
    images: [{ url: 'https://vurium.com/logo.jpg', alt: 'VuriumBook by Vurium' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VuriumBook Pricing and Features',
    description: 'Explore VuriumBook for barbershops, salons, and service businesses with booking, payments, team management, and client tools in one place.',
    images: ['https://vurium.com/logo.jpg'],
  },
}

export default function VuriumBookLayout({ children }: { children: React.ReactNode }) {
  return children
}
