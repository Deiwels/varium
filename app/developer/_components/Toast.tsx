'use client'
import { createContext, useCallback, useContext, useRef, useState } from 'react'

interface ToastItem {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

interface ToastContextValue {
  show: (message: string, type?: ToastItem['type']) => void
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const show = useCallback((message: string, type: ToastItem['type'] = 'success') => {
    const id = ++counter.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  const colors: Record<ToastItem['type'], { bg: string; border: string }> = {
    success: { bg: 'rgba(130,220,170,.12)', border: 'rgba(130,220,170,.3)' },
    error:   { bg: 'rgba(220,100,100,.12)', border: 'rgba(220,100,100,.3)' },
    info:    { bg: 'rgba(130,150,220,.12)', border: 'rgba(130,150,220,.3)' },
  }

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '12px 18px', borderRadius: 12,
            background: colors[t.type].bg,
            border: `1px solid ${colors[t.type].border}`,
            fontSize: 13, color: 'rgba(255,255,255,.85)',
            animation: 'devToastIn .2s ease',
          }}>
            {t.message}
          </div>
        ))}
      </div>
      <style>{`@keyframes devToastIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }`}</style>
    </ToastContext.Provider>
  )
}
