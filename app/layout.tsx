import type { Metadata } from 'next'
import { Inter, Julius_Sans_One } from 'next/font/google'
import './globals.css'
import { DialogWrapper } from './DialogWrapper'
import { PlanProvider } from '@/components/PlanProvider'
import { PermissionsProvider } from '@/components/PermissionsProvider'
import CookieBanner from '@/components/CookieBanner'

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
})

const julius = Julius_Sans_One({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-julius',
})

export const metadata: Metadata = {
  title: 'Vurium — Software That Works',
  description: 'We build modern software solutions. Our first product: VuriumBook™ — a powerful booking system for barbershops and salons.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Static starfield — minimal gradients for performance
  const farStars = Array.from({ length: 40 }, (_, i) => {
    const x = ((i * 37 + 13) % 100).toFixed(1)
    const y = ((i * 53 + 7) % 100).toFixed(1)
    return `radial-gradient(.5px .5px at ${x}% ${y}%, rgba(255,255,255,.25) 50%, transparent 50%)`
  }).join(',')

  const midStars = Array.from({ length: 15 }, (_, i) => {
    const x = ((i * 43 + 19) % 100).toFixed(1)
    const y = ((i * 61 + 11) % 100).toFixed(1)
    return `radial-gradient(1px 1px at ${x}% ${y}%, rgba(255,255,255,.35) 50%, transparent 50%)`
  }).join(',')

  const nearStars = Array.from({ length: 6 }, (_, i) => {
    const x = ((i * 67 + 23) % 100).toFixed(1)
    const y = ((i * 41 + 31) % 100).toFixed(1)
    return `radial-gradient(1.5px 1.5px at ${x}% ${y}%, rgba(255,255,255,.4) 50%, transparent 50%)`
  }).join(',')


  return (
    <html lang="en" className={`${inter.variable} ${julius.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </head>
      <body>
        {/* Vurium Analytics — lightweight privacy-friendly tracker */}
        <script src="/va.js" defer />
        {/* ── Global cosmic starfield — lightweight: static stars only, no animations ── */}
        <div id="vurium-cosmos" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: '#010101' }}>
          <div id="v-stars-far" style={{ position: 'absolute', inset: 0, backgroundImage: farStars }} />
          <div id="v-stars-mid" style={{ position: 'absolute', inset: 0, backgroundImage: midStars }} />
          <div id="v-stars-near" style={{ position: 'absolute', inset: 0, backgroundImage: nearStars }} />
        </div>

        <PlanProvider>
          <PermissionsProvider>
            <DialogWrapper>{children}</DialogWrapper>
          </PermissionsProvider>
        </PlanProvider>
        <CookieBanner />
      </body>
    </html>
  )
}
