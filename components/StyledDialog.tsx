'use client'
import { useState, useEffect, useCallback, createContext, useContext } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────
interface DialogOptions {
  title?: string
  message: string
  type?: 'info' | 'warning' | 'error' | 'confirm'
  confirmLabel?: string
  cancelLabel?: string
}

interface DialogState extends DialogOptions {
  resolve: (value: boolean) => void
}

interface DialogCtx {
  showAlert: (message: string, title?: string) => Promise<void>
  showError: (message: string) => Promise<void>
  showConfirm: (message: string, title?: string) => Promise<boolean>
}

// ─── Context ─────────────────────────────────────────────────────────────────
const DialogContext = createContext<DialogCtx>({
  showAlert: async () => {},
  showError: async () => {},
  showConfirm: async () => false,
})

export function useDialog() { return useContext(DialogContext) }

// ─── Provider ────────────────────────────────────────────────────────────────
export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [queue, setQueue] = useState<DialogState[]>([])

  // Override window.alert globally — all alert() calls become styled
  useEffect(() => {
    const origAlert = window.alert
    window.alert = (message: string) => {
      setDialog({ message: String(message), title: 'Notice', type: 'info', resolve: () => {} })
    }
    return () => { window.alert = origAlert }
  }, [])

  // Override window.confirm — show styled overlay behind native dialog
  useEffect(() => {
    const origConfirm = window.confirm
    window.confirm = (message: string): boolean => {
      // Add dark backdrop behind native confirm
      const backdrop = document.createElement('div')
      backdrop.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.65);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)'
      document.body.appendChild(backdrop)
      const result = origConfirm(message)
      backdrop.remove()
      return result
    }
    return () => { window.confirm = origConfirm }
  }, [])

  const showAlert = useCallback((message: string, title?: string) => {
    return new Promise<void>((resolve) => {
      setDialog({ message, title: title || 'Notice', type: 'info', resolve: () => resolve() })
    })
  }, [])

  const showError = useCallback((message: string) => {
    return new Promise<void>((resolve) => {
      setDialog({ message, title: 'Error', type: 'error', resolve: () => resolve() })
    })
  }, [])

  const showConfirm = useCallback((message: string, title?: string) => {
    return new Promise<boolean>((resolve) => {
      setDialog({ message, title: title || 'Confirm', type: 'confirm', resolve })
    })
  }, [])

  const close = (result: boolean) => {
    dialog?.resolve(result)
    setDialog(null)
  }

  // ESC key
  useEffect(() => {
    if (!dialog) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [dialog])

  const isConfirm = dialog?.type === 'confirm'
  const isError = dialog?.type === 'error'
  const iconColor = isError ? '#ff6b6b' : isConfirm ? '#ffcf3f' : '#8b9aff'
  const iconBg = isError ? 'rgba(255,107,107,.12)' : isConfirm ? 'rgba(255,207,63,.12)' : 'rgba(139,154,255,.12)'
  const iconBorder = isError ? 'rgba(255,107,107,.25)' : isConfirm ? 'rgba(255,207,63,.25)' : 'rgba(139,154,255,.25)'
  const titleColor = isError ? '#ffd0d0' : isConfirm ? '#ffe9a3' : '#c8d0ff'

  return (
    <DialogContext.Provider value={{ showAlert, showError, showConfirm }}>
      {children}
      {dialog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'dlgFade .15s ease' }}
          onClick={e => { if (e.target === e.currentTarget) close(false) }}>
          <div style={{ width: 'min(380px,92vw)', borderRadius: 20, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(10,10,20,.94)', backdropFilter: 'saturate(180%) blur(40px)', padding: '22px', boxShadow: '0 30px 80px rgba(0,0,0,.6)', animation: 'dlgPop .2s cubic-bezier(.4,0,.2,1)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: iconBg, border: `1px solid ${iconBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {isError ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                ) : isConfirm ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: titleColor, marginBottom: 4 }}>{dialog.title}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', lineHeight: 1.5 }}>{dialog.message}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {isConfirm && (
                <button onClick={() => close(false)} style={{ flex: 1, height: 42, borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.60)', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', transition: 'all .15s' }}>
                  {dialog.cancelLabel || 'Cancel'}
                </button>
              )}
              <button onClick={() => close(true)} style={{ flex: 1, height: 42, borderRadius: 12, border: `1px solid ${isConfirm ? 'rgba(255,207,63,.40)' : isError ? 'rgba(255,107,107,.40)' : 'rgba(139,154,255,.50)'}`, background: isConfirm ? 'rgba(255,207,63,.10)' : isError ? 'rgba(255,107,107,.10)' : 'rgba(139,154,255,.12)', color: titleColor, cursor: 'pointer', fontWeight: 900, fontSize: 13, fontFamily: 'inherit', transition: 'all .15s' }}>
                {dialog.confirmLabel || (isConfirm ? 'Confirm' : 'OK')}
              </button>
            </div>
          </div>
          <style>{`
            @keyframes dlgFade { 0% { opacity: 0 } 100% { opacity: 1 } }
            @keyframes dlgPop { 0% { opacity: 0; transform: scale(.96) translateY(6px) } 100% { opacity: 1; transform: scale(1) translateY(0) } }
          `}</style>
        </div>
      )}
    </DialogContext.Provider>
  )
}
