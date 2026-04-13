import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact Vurium',
  description: 'Contact Vurium for product questions, demos, billing help, or support with VuriumBook.',
  alternates: { canonical: 'https://vurium.com/contact' },
  openGraph: {
    title: 'Contact Vurium',
    description: 'Contact Vurium for product questions, demos, billing help, or support with VuriumBook.',
    url: 'https://vurium.com/contact',
    siteName: 'Vurium',
    images: [{ url: 'https://vurium.com/logo.jpg', alt: 'Vurium logo' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact Vurium',
    description: 'Contact Vurium for product questions, demos, billing help, or support with VuriumBook.',
    images: ['https://vurium.com/logo.jpg'],
  },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
