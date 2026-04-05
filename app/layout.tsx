import type { Metadata } from 'next'
import { Inter, Julius_Sans_One } from 'next/font/google'
import './globals.css'
import { DialogWrapper } from './DialogWrapper'
import CosmosParallax from '@/components/CosmosParallax'
import { PlanProvider } from '@/components/PlanProvider'
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
  // Generate many star positions for dense starfield
  const farStars = Array.from({ length: 80 }, (_, i) => {
    const x = ((i * 37 + 13) % 100).toFixed(1)
    const y = ((i * 53 + 7) % 100).toFixed(1)
    const s = (0.6 + (i % 3) * 0.3).toFixed(1)
    const o = (0.2 + (i % 5) * 0.08).toFixed(2)
    return `radial-gradient(${s}px ${s}px at ${x}% ${y}%, rgba(255,255,255,${o}) 50%, transparent 50%)`
  }).join(',')

  const midStars = Array.from({ length: 30 }, (_, i) => {
    const x = ((i * 43 + 19) % 100).toFixed(1)
    const y = ((i * 61 + 11) % 100).toFixed(1)
    const s = (1.0 + (i % 3) * 0.5).toFixed(1)
    const o = (0.3 + (i % 4) * 0.1).toFixed(2)
    return `radial-gradient(${s}px ${s}px at ${x}% ${y}%, rgba(255,255,255,${o}) 50%, transparent 50%)`
  }).join(',')

  const nearStars = Array.from({ length: 12 }, (_, i) => {
    const x = ((i * 67 + 23) % 100).toFixed(1)
    const y = ((i * 41 + 31) % 100).toFixed(1)
    const s = (1.5 + (i % 3) * 0.5).toFixed(1)
    return `radial-gradient(${s}px ${s}px at ${x}% ${y}%, rgba(255,255,255,.4) 50%, transparent 50%)`
  }).join(',')

  // Breathing glow stars — individual divs with CSS animation
  const glowStars = [
    { x: 15, y: 12, size: 3, dur: 3.5, delay: 0 },
    { x: 45, y: 8, size: 2.5, dur: 4.2, delay: 0.8 },
    { x: 72, y: 18, size: 3.5, dur: 3.8, delay: 1.5 },
    { x: 88, y: 35, size: 2, dur: 5.0, delay: 0.3 },
    { x: 25, y: 55, size: 3, dur: 4.5, delay: 2.0 },
    { x: 60, y: 42, size: 2.5, dur: 3.2, delay: 1.2 },
    { x: 8, y: 78, size: 2, dur: 4.8, delay: 0.6 },
    { x: 92, y: 65, size: 3, dur: 3.6, delay: 1.8 },
    { x: 38, y: 85, size: 2.5, dur: 4.0, delay: 0.4 },
    { x: 55, y: 72, size: 2, dur: 5.2, delay: 2.5 },
    { x: 78, y: 88, size: 3, dur: 3.4, delay: 1.0 },
    { x: 18, y: 38, size: 2.5, dur: 4.6, delay: 1.7 },
  ]

  return (
    <html lang="en" className={`${inter.variable} ${julius.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes starBreathe {
            0%, 100% { opacity: 0.25; transform: scale(0.8); }
            50% { opacity: 0.85; transform: scale(1.4); }
          }
          @keyframes slowDrift {
            0% { transform: translate(0,0); }
            25% { transform: translate(2px,-1px); }
            50% { transform: translate(-1px,2px); }
            75% { transform: translate(-2px,-1px); }
            100% { transform: translate(0,0); }
          }
          /* Mobile: lighter breathing stars */
          @media (max-width: 768px) {
            #vurium-cosmos .nebula-glow { display: none !important; }
            #vurium-cosmos .glow-star { display: none !important; }
            #vurium-cosmos .glow-star:nth-child(-n+6) {
              display: block !important;
              width: 4px !important; height: 4px !important;
              animation-duration: 6s !important;
              box-shadow: 0 0 6px 2px rgba(200,220,255,.15) !important;
            }
            #v-stars-mid { opacity: .6 !important; }
            #v-stars-near { opacity: .5 !important; }
          }
        ` }} />
      </head>
      <body>
        {/* ── Global cosmic starfield ── */}
        <div id="vurium-cosmos" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: '#010101' }}>

          {/* Far stars — tiny, many, slow parallax */}
          <div id="v-stars-far" style={{
            position: 'absolute', inset: '-5%', width: '110%', height: '110%', opacity: 1,
            backgroundImage: farStars,
          }} />

          {/* Mid stars — medium, fewer, faster parallax */}
          <div id="v-stars-mid" style={{
            position: 'absolute', inset: '-3%', width: '106%', height: '106%', opacity: 1,
            backgroundImage: midStars,
          }} />

          {/* Near stars — large, sparse, fastest parallax */}
          <div id="v-stars-near" style={{
            position: 'absolute', inset: 0, opacity: 1,
            backgroundImage: nearStars,
          }} />

          {/* Breathing glow stars */}
          {glowStars.map((s, i) => (
            <div key={i} className="glow-star" style={{
              position: 'absolute', left: `${s.x}%`, top: `${s.y}%`,
              width: s.size, height: s.size, borderRadius: '50%',
              background: 'rgba(220,230,255,.9)',
              boxShadow: '0 0 6px 2px rgba(200,220,255,.18)',
              animation: `starBreathe ${s.dur}s ease-in-out ${s.delay}s infinite`,
            }} />
          ))}

          {/* Nebula glow effects — use will-change to promote to GPU layer, contain to isolate repaints */}
          <div className="nebula-glow nebula-layer" style={{ position: 'absolute', width: 800, height: 450, top: '0%', left: '-12%', background: 'rgba(30,45,110,.05)', borderRadius: '50%', filter: 'blur(140px)', willChange: 'transform', contain: 'strict' }} />
          <div className="nebula-glow nebula-layer" style={{ position: 'absolute', width: 600, height: 350, bottom: '5%', right: '-8%', background: 'rgba(55,35,100,.04)', borderRadius: '50%', filter: 'blur(140px)', willChange: 'transform', contain: 'strict' }} />
          <div className="nebula-glow nebula-layer" style={{ position: 'absolute', width: 400, height: 280, top: '40%', left: '20%', background: 'rgba(40,30,80,.025)', borderRadius: '50%', filter: 'blur(120px)', willChange: 'transform', contain: 'strict' }} />
          <div className="nebula-glow nebula-layer" style={{ position: 'absolute', width: 300, height: 200, top: '15%', right: '15%', background: 'rgba(25,50,100,.02)', borderRadius: '50%', filter: 'blur(100px)', willChange: 'transform', contain: 'strict' }} />
        </div>

        <CosmosParallax />
        <PlanProvider>
          <DialogWrapper>{children}</DialogWrapper>
        </PlanProvider>
        <CookieBanner />
      </body>
    </html>
  )
}
