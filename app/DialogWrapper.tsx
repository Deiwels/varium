'use client'
import { DialogProvider } from '@/components/StyledDialog'
import ErrorBoundary from '@/components/ErrorBoundary'

export function DialogWrapper({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary><DialogProvider>{children}</DialogProvider></ErrorBoundary>
}
