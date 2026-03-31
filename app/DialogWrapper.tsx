'use client'
import { DialogProvider } from '@/components/StyledDialog'

export function DialogWrapper({ children }: { children: React.ReactNode }) {
  return <DialogProvider>{children}</DialogProvider>
}
