'use client'
import CosmicBackground from '@/components/CosmicBackground'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CosmicBackground />
      <div style={{
        position: 'relative', zIndex: 1,
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        fontFamily: 'Inter, -apple-system, sans-serif',
      }}>
        {children}
      </div>
    </>
  )
}
