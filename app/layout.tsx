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
      <body>
        {/* Global cosmic star background */}
        <div id="vurium-stars" style={{
          position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
          background: '#010101',
        }}>
          <div id="v-stars-far" style={{
            position: 'absolute', inset: 0, opacity: 0.35,
            backgroundImage: `
              radial-gradient(1px 1px at 8% 12%, rgba(255,255,255,.4) 50%, transparent 50%),
              radial-gradient(1px 1px at 22% 5%, rgba(255,255,255,.3) 50%, transparent 50%),
              radial-gradient(1.2px 1.2px at 35% 18%, rgba(255,255,255,.45) 50%, transparent 50%),
              radial-gradient(1px 1px at 48% 8%, rgba(255,255,255,.35) 50%, transparent 50%),
              radial-gradient(1px 1px at 55% 25%, rgba(255,255,255,.3) 50%, transparent 50%),
              radial-gradient(1.2px 1.2px at 65% 14%, rgba(255,255,255,.4) 50%, transparent 50%),
              radial-gradient(1px 1px at 78% 22%, rgba(255,255,255,.3) 50%, transparent 50%),
              radial-gradient(1px 1px at 88% 6%, rgba(255,255,255,.4) 50%, transparent 50%),
              radial-gradient(1px 1px at 12% 35%, rgba(255,255,255,.35) 50%, transparent 50%),
              radial-gradient(1.2px 1.2px at 28% 42%, rgba(255,255,255,.3) 50%, transparent 50%),
              radial-gradient(1px 1px at 42% 38%, rgba(255,255,255,.4) 50%, transparent 50%),
              radial-gradient(1px 1px at 58% 45%, rgba(255,255,255,.3) 50%, transparent 50%),
              radial-gradient(1px 1px at 72% 40%, rgba(255,255,255,.35) 50%, transparent 50%),
              radial-gradient(1.2px 1.2px at 85% 48%, rgba(255,255,255,.3) 50%, transparent 50%),
              radial-gradient(1px 1px at 5% 55%, rgba(255,255,255,.4) 50%, transparent 50%),
              radial-gradient(1px 1px at 18% 60%, rgba(255,255,255,.3) 50%, transparent 50%),
              radial-gradient(1.2px 1.2px at 32% 52%, rgba(255,255,255,.35) 50%, transparent 50%),
              radial-gradient(1px 1px at 62% 55%, rgba(255,255,255,.4) 50%, transparent 50%),
              radial-gradient(1px 1px at 75% 62%, rgba(255,255,255,.3) 50%, transparent 50%),
              radial-gradient(1px 1px at 90% 58%, rgba(255,255,255,.35) 50%, transparent 50%),
              radial-gradient(1px 1px at 15% 72%, rgba(255,255,255,.3) 50%, transparent 50%),
              radial-gradient(1.2px 1.2px at 38% 68%, rgba(255,255,255,.4) 50%, transparent 50%),
              radial-gradient(1px 1px at 52% 75%, rgba(255,255,255,.3) 50%, transparent 50%),
              radial-gradient(1px 1px at 68% 70%, rgba(255,255,255,.35) 50%, transparent 50%),
              radial-gradient(1px 1px at 82% 78%, rgba(255,255,255,.3) 50%, transparent 50%),
              radial-gradient(1px 1px at 3% 82%, rgba(255,255,255,.45) 50%, transparent 50%),
              radial-gradient(1px 1px at 25% 85%, rgba(255,255,255,.3) 50%, transparent 50%),
              radial-gradient(1px 1px at 58% 88%, rgba(255,255,255,.35) 50%, transparent 50%),
              radial-gradient(1px 1px at 45% 92%, rgba(255,255,255,.3) 50%, transparent 50%),
              radial-gradient(1.2px 1.2px at 95% 30%, rgba(255,255,255,.4) 50%, transparent 50%)
            `,
          }} />
          <div id="v-stars-mid" style={{
            position: 'absolute', inset: 0, opacity: 0.2,
            backgroundImage: `
              radial-gradient(1.5px 1.5px at 12% 22%, rgba(255,255,255,.5) 50%, transparent 50%),
              radial-gradient(2px 2px at 38% 48%, rgba(255,255,255,.45) 50%, transparent 50%),
              radial-gradient(1.5px 1.5px at 62% 15%, rgba(255,255,255,.55) 50%, transparent 50%),
              radial-gradient(2px 2px at 78% 65%, rgba(255,255,255,.4) 50%, transparent 50%),
              radial-gradient(1.5px 1.5px at 22% 78%, rgba(255,255,255,.5) 50%, transparent 50%),
              radial-gradient(2px 2px at 88% 35%, rgba(255,255,255,.5) 50%, transparent 50%),
              radial-gradient(1.5px 1.5px at 48% 88%, rgba(255,255,255,.45) 50%, transparent 50%),
              radial-gradient(2px 2px at 5% 55%, rgba(255,255,255,.5) 50%, transparent 50%),
              radial-gradient(1.5px 1.5px at 72% 42%, rgba(255,255,255,.55) 50%, transparent 50%),
              radial-gradient(2px 2px at 55% 5%, rgba(255,255,255,.45) 50%, transparent 50%),
              radial-gradient(1.5px 1.5px at 30% 30%, rgba(255,255,255,.5) 50%, transparent 50%),
              radial-gradient(2px 2px at 85% 80%, rgba(255,255,255,.4) 50%, transparent 50%)
            `,
          }} />
          {/* Nebula glow effects */}
          <div style={{ position: 'absolute', width: 700, height: 400, top: '2%', left: '-10%', background: 'rgba(30,45,110,.04)', borderRadius: '50%', filter: 'blur(120px)' }} />
          <div style={{ position: 'absolute', width: 500, height: 300, bottom: '8%', right: '-5%', background: 'rgba(55,35,100,.03)', borderRadius: '50%', filter: 'blur(120px)' }} />
          <div style={{ position: 'absolute', width: 350, height: 250, top: '45%', left: '25%', background: 'rgba(40,30,80,.02)', borderRadius: '50%', filter: 'blur(100px)' }} />
        </div>

        <DialogWrapper>{children}</DialogWrapper>

        {/* Parallax mouse tracking script */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var cx=0,cy=0,tx=0,ty=0;
            document.addEventListener('mousemove',function(e){
              tx=(e.clientX/window.innerWidth-0.5)*2;
              ty=(e.clientY/window.innerHeight-0.5)*2;
            },{passive:true});
            function tick(){
              cx+=(tx-cx)*0.03;cy+=(ty-cy)*0.03;
              var f=document.getElementById('v-stars-far');
              var m=document.getElementById('v-stars-mid');
              if(f)f.style.transform='translate('+cx*4+'px,'+cy*4+'px)';
              if(m)m.style.transform='translate('+cx*8+'px,'+cy*8+'px)';
              requestAnimationFrame(tick);
            }
            requestAnimationFrame(tick);
          })();
        ` }} />
      </body>
    </html>
  )
}
