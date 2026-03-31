'use client'
import { useEffect, useRef } from 'react'

// ─── Cosmic Background ──────────────────────────────────────────────────────
// Renders: stars-container with 3 layers, black-hole, galaxy, shooting stars,
// comets, glow orbs, nebulae. Includes scroll-based parallax effect.
// Used in both marketing pages and CRM layout.

export default function CosmicBackground() {
  const containerRef = useRef<HTMLDivElement>(null)

  // Scroll-based parallax
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const layers = el.querySelectorAll<HTMLDivElement>('.stars-layer')
    let ticking = false

    function onScroll() {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const scrollY = window.scrollY
        layers.forEach((layer, i) => {
          const speed = (i + 1) * 0.08
          layer.style.transform = `translateY(${scrollY * speed}px)`
        })
        ticking = false
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div ref={containerRef} className="cosmic-bg" aria-hidden="true">
      {/* Star layers */}
      <div className="stars-layer stars-1" />
      <div className="stars-layer stars-2" />
      <div className="stars-layer stars-3" />

      {/* Black hole */}
      <div className="black-hole" />

      {/* Galaxy swirl */}
      <div className="galaxy" />

      {/* Shooting stars */}
      <div className="shooting-star ss-1" />
      <div className="shooting-star ss-2" />
      <div className="shooting-star ss-3" />

      {/* Comets */}
      <div className="comet comet-1" />
      <div className="comet comet-2" />

      {/* Glow orbs */}
      <div className="glow-orb orb-1" />
      <div className="glow-orb orb-2" />
      <div className="glow-orb orb-3" />

      {/* Nebulae */}
      <div className="nebula nebula-1" />
      <div className="nebula nebula-2" />

      <style>{`
        .cosmic-bg {
          position: fixed;
          inset: 0;
          z-index: 0;
          overflow: hidden;
          pointer-events: none;
          background: #000;
        }

        /* ── Stars ── */
        .stars-layer {
          position: absolute;
          inset: -20%;
          will-change: transform;
        }
        .stars-1 {
          background-image:
            radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,.8) 0%, transparent 100%),
            radial-gradient(1px 1px at 30% 65%, rgba(255,255,255,.6) 0%, transparent 100%),
            radial-gradient(1px 1px at 55% 10%, rgba(255,255,255,.7) 0%, transparent 100%),
            radial-gradient(1px 1px at 70% 40%, rgba(255,255,255,.5) 0%, transparent 100%),
            radial-gradient(1px 1px at 90% 80%, rgba(255,255,255,.6) 0%, transparent 100%),
            radial-gradient(1.2px 1.2px at 15% 85%, rgba(139,154,255,.9) 0%, transparent 100%),
            radial-gradient(1px 1px at 45% 50%, rgba(255,255,255,.4) 0%, transparent 100%),
            radial-gradient(1px 1px at 80% 15%, rgba(255,255,255,.7) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 25% 35%, rgba(139,154,255,.7) 0%, transparent 100%),
            radial-gradient(1px 1px at 60% 90%, rgba(255,255,255,.5) 0%, transparent 100%);
        }
        .stars-2 {
          background-image:
            radial-gradient(0.8px 0.8px at 5% 45%, rgba(255,255,255,.5) 0%, transparent 100%),
            radial-gradient(0.8px 0.8px at 20% 75%, rgba(255,255,255,.4) 0%, transparent 100%),
            radial-gradient(0.8px 0.8px at 40% 25%, rgba(255,255,255,.6) 0%, transparent 100%),
            radial-gradient(0.8px 0.8px at 65% 55%, rgba(255,255,255,.3) 0%, transparent 100%),
            radial-gradient(0.8px 0.8px at 85% 35%, rgba(255,255,255,.5) 0%, transparent 100%),
            radial-gradient(1px 1px at 50% 80%, rgba(139,154,255,.6) 0%, transparent 100%),
            radial-gradient(0.8px 0.8px at 95% 60%, rgba(255,255,255,.4) 0%, transparent 100%),
            radial-gradient(0.8px 0.8px at 35% 95%, rgba(255,255,255,.3) 0%, transparent 100%);
        }
        .stars-3 {
          background-image:
            radial-gradient(0.5px 0.5px at 8% 30%, rgba(255,255,255,.3) 0%, transparent 100%),
            radial-gradient(0.5px 0.5px at 25% 55%, rgba(255,255,255,.2) 0%, transparent 100%),
            radial-gradient(0.5px 0.5px at 50% 15%, rgba(255,255,255,.35) 0%, transparent 100%),
            radial-gradient(0.5px 0.5px at 72% 70%, rgba(255,255,255,.25) 0%, transparent 100%),
            radial-gradient(0.5px 0.5px at 88% 45%, rgba(255,255,255,.3) 0%, transparent 100%),
            radial-gradient(0.5px 0.5px at 42% 88%, rgba(255,255,255,.2) 0%, transparent 100%);
        }

        /* ── Black hole ── */
        .black-hole {
          position: absolute;
          top: 20%;
          left: 50%;
          width: 300px;
          height: 300px;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          background: radial-gradient(circle, #000 30%, transparent 70%);
          box-shadow:
            0 0 80px 20px rgba(139,154,255,.08),
            0 0 160px 60px rgba(139,154,255,.04);
          opacity: 0.6;
        }

        /* ── Galaxy ── */
        .galaxy {
          position: absolute;
          top: 18%;
          left: 48%;
          width: 500px;
          height: 500px;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          background: conic-gradient(
            from 0deg,
            transparent 0deg,
            rgba(139,154,255,.06) 30deg,
            transparent 60deg,
            rgba(139,154,255,.04) 120deg,
            transparent 180deg,
            rgba(139,154,255,.05) 240deg,
            transparent 300deg,
            rgba(139,154,255,.03) 340deg,
            transparent 360deg
          );
          animation: galaxySpin 120s linear infinite;
          opacity: 0.5;
        }
        @keyframes galaxySpin {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg); }
        }

        /* ── Shooting stars ── */
        .shooting-star {
          position: absolute;
          width: 80px;
          height: 1px;
          background: linear-gradient(90deg, rgba(139,154,255,.8), transparent);
          border-radius: 1px;
          opacity: 0;
        }
        .ss-1 {
          top: 15%;
          left: 20%;
          transform: rotate(-35deg);
          animation: shoot 4s ease-in-out 2s infinite;
        }
        .ss-2 {
          top: 35%;
          left: 60%;
          transform: rotate(-25deg);
          animation: shoot 5s ease-in-out 6s infinite;
        }
        .ss-3 {
          top: 55%;
          left: 40%;
          transform: rotate(-40deg);
          animation: shoot 4.5s ease-in-out 10s infinite;
        }
        @keyframes shoot {
          0% { opacity: 0; transform: rotate(-35deg) translateX(0); }
          5% { opacity: 1; }
          15% { opacity: 0; transform: rotate(-35deg) translateX(200px); }
          100% { opacity: 0; }
        }

        /* ── Comets ── */
        .comet {
          position: absolute;
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: rgba(139,154,255,.9);
          box-shadow: 0 0 6px 2px rgba(139,154,255,.4);
          opacity: 0;
        }
        .comet::after {
          content: '';
          position: absolute;
          top: 0;
          left: 3px;
          width: 60px;
          height: 1px;
          background: linear-gradient(90deg, rgba(139,154,255,.5), transparent);
        }
        .comet-1 {
          top: 25%;
          left: 80%;
          animation: cometMove 8s ease-in 3s infinite;
        }
        .comet-2 {
          top: 70%;
          left: 90%;
          animation: cometMove 10s ease-in 8s infinite;
        }
        @keyframes cometMove {
          0% { opacity: 0; transform: translate(0, 0); }
          5% { opacity: 1; }
          30% { opacity: 0; transform: translate(-300px, 150px); }
          100% { opacity: 0; }
        }

        /* ── Glow orbs ── */
        .glow-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(60px);
          opacity: 0.12;
          animation: orbFloat 20s ease-in-out infinite;
        }
        .orb-1 {
          top: 10%;
          left: 15%;
          width: 200px;
          height: 200px;
          background: rgba(139,154,255,.5);
          animation-delay: 0s;
        }
        .orb-2 {
          top: 60%;
          right: 10%;
          width: 160px;
          height: 160px;
          background: rgba(180,139,255,.4);
          animation-delay: -7s;
        }
        .orb-3 {
          bottom: 20%;
          left: 40%;
          width: 180px;
          height: 180px;
          background: rgba(139,200,255,.3);
          animation-delay: -14s;
        }
        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(20px, -15px) scale(1.05); }
          66% { transform: translate(-10px, 10px) scale(0.95); }
        }

        /* ── Nebulae ── */
        .nebula {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.06;
        }
        .nebula-1 {
          top: 30%;
          left: 20%;
          width: 400px;
          height: 250px;
          background: linear-gradient(135deg, rgba(139,154,255,.4), rgba(180,120,255,.2));
          animation: nebulaShift 30s ease-in-out infinite;
        }
        .nebula-2 {
          bottom: 15%;
          right: 15%;
          width: 350px;
          height: 200px;
          background: linear-gradient(225deg, rgba(100,180,255,.3), rgba(139,154,255,.2));
          animation: nebulaShift 35s ease-in-out infinite reverse;
        }
        @keyframes nebulaShift {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.06; }
          50% { transform: scale(1.1) rotate(5deg); opacity: 0.09; }
        }
      `}</style>
    </div>
  )
}
