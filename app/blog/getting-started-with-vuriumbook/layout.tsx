import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Getting Started with VuriumBook',
  description: 'A practical setup guide for getting your VuriumBook workspace, services, payments, and booking page ready.',
  alternates: { canonical: 'https://vurium.com/blog/getting-started-with-vuriumbook' },
  openGraph: {
    title: 'Getting Started with VuriumBook',
    description: 'A practical setup guide for getting your VuriumBook workspace, services, payments, and booking page ready.',
    url: 'https://vurium.com/blog/getting-started-with-vuriumbook',
    siteName: 'Vurium',
    images: [{ url: 'https://vurium.com/logo.jpg', alt: 'VuriumBook guide' }],
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Getting Started with VuriumBook',
    description: 'A practical setup guide for getting your VuriumBook workspace, services, payments, and booking page ready.',
    images: ['https://vurium.com/logo.jpg'],
  },
}

export default function BlogPostLayout({ children }: { children: React.ReactNode }) {
  return children
}
