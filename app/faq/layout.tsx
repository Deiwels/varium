import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'VuriumBook FAQ',
  description: 'Answers to common questions about VuriumBook, including setup, billing, booking, and data handling.',
  alternates: { canonical: 'https://vurium.com/faq' },
  openGraph: {
    title: 'VuriumBook FAQ',
    description: 'Answers to common questions about VuriumBook, including setup, billing, booking, and data handling.',
    url: 'https://vurium.com/faq',
    siteName: 'Vurium',
    images: [{ url: 'https://vurium.com/logo.jpg', alt: 'VuriumBook by Vurium' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VuriumBook FAQ',
    description: 'Answers to common questions about VuriumBook, including setup, billing, booking, and data handling.',
    images: ['https://vurium.com/logo.jpg'],
  },
}

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children
}
