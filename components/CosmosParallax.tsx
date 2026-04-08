'use client'
import { useEffect } from 'react'

export default function CosmosParallax() {
  useEffect(() => {
    // Disable parallax entirely in native iOS app — saves battery
    if ((window as any).__VURIUM_IS_NATIVE) return

    const isMobile = window.matchMedia('(max-width: 768px)').matches
      || 'ontouchstart' in window

    let tx = 0, ty = 0, cx = 0, cy = 0
    let scrollY = 0
    let raf = 0
    let running = false
    let idleTimer: ReturnType<typeof setTimeout> | null = null

    const f = document.getElementById('v-stars-far')
    const m = document.getElementById('v-stars-mid')
    const n = document.getElementById('v-stars-near')

    function applyTransform() {
      if (!running) return

      cx += (tx - cx) * 0.02
      cy += (ty - cy) * 0.02

      // Stop loop when parallax has settled (delta < 0.001px)
      if (Math.abs(tx - cx) < 0.001 && Math.abs(ty - cy) < 0.001) {
        running = false
        return
      }

      if (f) f.style.transform = `translate(${cx * 8}px, ${cy * 8 + scrollY * 0.03}px)`
      if (m) m.style.transform = `translate(${cx * 20}px, ${cy * 20 + scrollY * 0.08}px)`
      if (n) n.style.transform = `translate(${cx * 35}px, ${cy * 35 + scrollY * 0.15}px)`

      raf = requestAnimationFrame(applyTransform)
    }

    function startLoop() {
      if (!running) {
        running = true
        raf = requestAnimationFrame(applyTransform)
      }
    }

    // Pause when tab is hidden
    function onVisibility() {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(raf)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    if (isMobile) {
      function onOrientation(e: DeviceOrientationEvent) {
        const gamma = Math.max(-15, Math.min(15, e.gamma || 0))
        const beta  = Math.max(-15, Math.min(15, (e.beta || 0) - 45))
        tx = gamma / 15 * 4
        ty = beta  / 15 * 4
        startLoop()
      }

      const doe = DeviceOrientationEvent as any
      if (typeof doe.requestPermission === 'function') {
        function requestGyro() {
          doe.requestPermission().then((state: string) => {
            if (state === 'granted') {
              window.addEventListener('deviceorientation', onOrientation, { passive: true })
            }
          }).catch(() => {})
          document.removeEventListener('click', requestGyro)
        }
        document.addEventListener('click', requestGyro, { once: true })
      } else {
        window.addEventListener('deviceorientation', onOrientation, { passive: true })
      }

      return () => {
        window.removeEventListener('deviceorientation', onOrientation)
        document.removeEventListener('visibilitychange', onVisibility)
        cancelAnimationFrame(raf)
      }
    }

    // Desktop — mouse parallax (only animate while mouse moves)
    function onMouse(e: MouseEvent) {
      tx = (e.clientX / window.innerWidth - 0.5) * 2
      ty = (e.clientY / window.innerHeight - 0.5) * 2
      startLoop()

      // Auto-stop after 2s of no mouse movement
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => { running = false }, 2000)
    }

    function onScroll() {
      scrollY = window.scrollY || document.documentElement.scrollTop || 0
      const content = document.querySelector('.content')
      if (content) scrollY = content.scrollTop || 0
      startLoop()
    }

    window.addEventListener('mousemove', onMouse, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    const content = document.querySelector('.content')
    if (content) content.addEventListener('scroll', () => {
      scrollY = content.scrollTop || 0
      startLoop()
    }, { passive: true })

    return () => {
      window.removeEventListener('mousemove', onMouse)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibility)
      cancelAnimationFrame(raf)
      if (idleTimer) clearTimeout(idleTimer)
    }
  }, [])

  return null
}
