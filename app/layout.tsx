import type { Metadata } from 'next'
import './globals.css'
import { DialogWrapper } from './DialogWrapper'

export const metadata: Metadata = {
  title: 'Vurium — Software That Works',
  description: 'We build modern software solutions. Our first product: VuriumBook — a powerful booking system for barbershops and salons.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600;700;800&family=Julius+Sans+One&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body><DialogWrapper>{children}</DialogWrapper></body>
    </html>
  )
}
