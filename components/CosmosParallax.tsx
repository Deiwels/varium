'use client'
import { useEffect } from 'react'

export default function CosmosParallax() {
  useEffect(() => {
    // Skip parallax entirely on mobile/tablet — no mouse, saves CPU/GPU
    const isMobile = window.matchMedia('(max-width: 768px)').matches
      || 'ontouchstart' in window
    if (isMobile) return

    let tx = 0, ty = 0, cx = 0, cy = 0
    let scrollY = 0
    let raf: number

    function onMouse(e: MouseEvent) {
      tx = (e.clientX / window.innerWidth - 0.5) * 2
      ty = (e.clientY / window.innerHeight - 0.5) * 2
    }

    function onScroll() {
      scrollY = window.scrollY || document.documentElement.scrollTop || 0
      const content = document.querySelector('.content')
      if (content) scrollY = content.scrollTop || 0
    }

    function tick() {
      cx += (tx - cx) * 0.02
      cy += (ty - cy) * 0.02

      const f = document.getElementById('v-stars-far')
      const m = document.getElementById('v-stars-mid')
      const n = document.getElementById('v-stars-near')

      if (f) f.style.transform = `translate(${cx * 8}px, ${cy * 8 + scrollY * 0.03}px)`
      if (m) m.style.transform = `translate(${cx * 20}px, ${cy * 20 + scrollY * 0.08}px)`
      if (n) n.style.transform = `translate(${cx * 35}px, ${cy * 35 + scrollY * 0.15}px)`

      raf = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', onMouse, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
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
