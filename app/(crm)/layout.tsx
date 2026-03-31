'use client'
import Shell from '@/components/Shell'
import CosmicBackground from '@/components/CosmicBackground'
import { usePathname } from 'next/navigation'
import { DialogProvider } from '@/components/StyledDialog'

const PAGE_MAP: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/calendar': 'Calendar',
  '/messages': 'Messages',
  '/waitlist': 'Waitlist',
  '/portfolio': 'Portfolio',
  '/clients': 'Clients',
  '/payments': 'Payments',
  '/attendance': 'Attendance',
  '/cash': 'Cash',
  '/membership': 'Membership',
  '/expenses': 'Expenses',
  '/payroll': 'Payroll',
  '/settings': 'Settings',
}

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const page = PAGE_MAP[pathname] || 'Dashboard'

  return (
    <DialogProvider>
      <CosmicBackground />
      <Shell page={page}>{children}</Shell>
    </DialogProvider>
  )
}
