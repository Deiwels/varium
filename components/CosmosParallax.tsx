'use client'
import { useEffect } from 'react'

export default function CosmosParallax() {
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 768px)').matches
      || 'ontouchstart' in window

    let tx = 0, ty = 0, cx = 0, cy = 0
    let scrollY = 0
    let raf: number

    function applyTransform() {
      cx += (tx - cx) * 0.02
      cy += (ty - cy) * 0.02

      const f = document.getElementById('v-stars-far')
      const m = document.getElementById('v-stars-mid')
      const n = document.getElementById('v-stars-near')

      if (f) f.style.transform = `translate(${cx * 8}px, ${cy * 8 + scrollY * 0.03}px)`
      if (m) m.style.transform = `translate(${cx * 20}px, ${cy * 20 + scrollY * 0.08}px)`
      if (n) n.style.transform = `translate(${cx * 35}px, ${cy * 35 + scrollY * 0.15}px)`

      raf = requestAnimationFrame(applyTransform)
    }

    if (isMobile) {
      // Gyroscope parallax on mobile — tilt phone to move stars
      let hasGyro = false

      function onOrientation(e: DeviceOrientationEvent) {
        if (!hasGyro) hasGyro = true
        const gamma = Math.max(-30, Math.min(30, e.gamma || 0)) // left-right tilt
        const beta  = Math.max(-30, Math.min(30, (e.beta || 0) - 45)) // front-back tilt (offset for natural hold angle)
        tx = gamma / 30 * 2
        ty = beta  / 30 * 2
      }

      // iOS 13+ requires permission
      const doe = DeviceOrientationEvent as any
      if (typeof doe.requestPermission === 'function') {
        // Will be triggered on first user tap
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

      raf = requestAnimationFrame(applyTransform)

      return () => {
        window.removeEventListener('deviceorientation', onOrientation)
        cancelAnimationFrame(raf)
      }
    }

    // Desktop — mouse parallax
    function onMouse(e: MouseEvent) {
      tx = (e.clientX / window.innerWidth - 0.5) * 2
      ty = (e.clientY / window.innerHeight - 0.5) * 2
    }

    function onScroll() {
      scrollY = window.scrollY || document.documentElement.scrollTop || 0
      const content = document.querySelector('.content')
      if (content) scrollY = content.scrollTop || 0
    }

    window.addEventListener('mousemove', onMouse, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    const content = document.querySelector('.content')
    if (content) content.addEventListener('scroll', () => {
      scrollY = content.scrollTop || 0
    }, { passive: true })

    raf = requestAnimationFrame(applyTransform)

    return () => {
      window.removeEventListener('mousemove', onMouse)
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  return null
}
