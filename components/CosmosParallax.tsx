'use client'
import { useEffect } from 'react'

export default function CosmosParallax() {
  useEffect(() => {
    let tx = 0, ty = 0, cx = 0, cy = 0
    let scrollY = 0
    let raf: number

    function onMouse(e: MouseEvent) {
      tx = (e.clientX / window.innerWidth - 0.5) * 2
      ty = (e.clientY / window.innerHeight - 0.5) * 2
    }

    function onScroll() {
      scrollY = window.scrollY || document.documentElement.scrollTop || 0
      // Also check for scroll inside .content divs (CRM pages)
      const content = document.querySelector('.content')
      if (content) scrollY = content.scrollTop || 0
    }

    function tick() {
      cx += (tx - cx) * 0.02
      cy += (ty - cy) * 0.02

      const f = document.getElementById('v-stars-far')
      const m = document.getElementById('v-stars-mid')
      const n = document.getElementById('v-stars-near')

      const sy = scrollY * 0.0003 // subtle scroll parallax

      if (f) f.style.transform = `translate(${cx * 4}px, ${cy * 4 + scrollY * 0.02}px)`
      if (m) m.style.transform = `translate(${cx * 10}px, ${cy * 10 + scrollY * 0.05}px)`
      if (n) n.style.transform = `translate(${cx * 18}px, ${cy * 18 + scrollY * 0.1}px)`

      raf = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', onMouse, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    // Listen for scroll on .content elements too (CRM uses overflow:auto)
    const content = document.querySelector('.content')
    if (content) content.addEventListener('scroll', () => {
      scrollY = content.scrollTop || 0
    }, { passive: true })

    raf = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('mousemove', onMouse)
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  return null
}
