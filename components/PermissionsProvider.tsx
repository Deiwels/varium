'use client'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/api'

// Default permissions per role — used when workspace has no custom config
const DEFAULT_PERMS: Record<string, RolePerms> = {
  admin: {
    pages: { dashboard: true, calendar: true, history: true, clients: true, messages: true, waitlist: true, portfolio: true, payments: true, attendance: true, cash: true, membership: true, analytics: true },
    bookings: { create: true, edit: true, delete: true, block_time: true, view_all: true },
    calendar_settings: { open_settings: true, manage_team: true, manage_services: true, edit_schedule: true, edit_own_profile: true },
    clients: { view: true, add: true, edit: true, view_phone: true, call_client: true, message_client: true, delete: false, view_all: true },
    schedule: { change_own: true, change_others: true, needs_approval: false },
    settings_access: { general: true, booking: true, site_builder: true, fees_tax: false, integrations: true, change_password: true, view_pin: true },
    financial: { mark_paid: true, checkout_client: true, refund: false, access_terminal: true, pay_cash: true, pay_zelle: true, pay_other: true, view_earnings: true, view_all_earnings: true },
  },
  barber: {
    pages: { dashboard: false, calendar: true, history: true, clients: false, messages: true, waitlist: true, portfolio: true, payments: false, attendance: false, cash: false, membership: false, analytics: false },
    bookings: { create: true, edit: true, delete: false, block_time: true, view_all: false },
    calendar_settings: { open_settings: true, manage_team: false, manage_services: false, edit_schedule: false, edit_own_profile: true },
    clients: { view: true, add: true, edit: false, view_phone: false, call_client: false, message_client: false, delete: false, view_all: false },
    schedule: { change_own: true, change_others: false, needs_approval: true },
    settings_access: { general: false, booking: false, site_builder: false, fees_tax: false, integrations: false, change_password: true, view_pin: true },
    financial: { mark_paid: false, checkout_client: false, refund: false, access_terminal: false, pay_cash: false, pay_zelle: false, pay_other: false, view_earnings: true, view_all_earnings: false },
  },
  guest: {
    pages: { dashboard: false, calendar: true, history: false, clients: true, messages: false, waitlist: false, portfolio: false, payments: false, attendance: false, cash: false, membership: false, analytics: false },
    bookings: { create: true, edit: true, delete: false, block_time: false, view_all: true },
    calendar_settings: { open_settings: false, manage_team: false, manage_services: false, edit_schedule: false, edit_own_profile: false },
    clients: { view: true, add: true, edit: false, view_phone: false, call_client: false, message_client: false, delete: false, view_all: true },
    schedule: { change_own: false, change_others: false, needs_approval: false },
    settings_access: { general: false, booking: false, site_builder: false, fees_tax: false, integrations: false, change_password: true, view_pin: false },
    financial: { mark_paid: false, checkout_client: false, refund: false, access_terminal: false, pay_cash: false, pay_zelle: false, pay_other: false, view_earnings: false, view_all_earnings: false },
  },
  student: {
    pages: { dashboard: false, calendar: true, history: false, clients: false, messages: true, waitlist: false, portfolio: false, payments: false, attendance: false, cash: false, membership: false, analytics: false },
    bookings: { create: false, edit: false, delete: false, block_time: false, view_all: false },
    calendar_settings: { open_settings: true, manage_team: false, manage_services: false, edit_schedule: false, edit_own_profile: false },
    clients: { view: false, add: false, edit: false, view_phone: false, call_client: false, message_client: false, delete: false, view_all: false },
    schedule: { change_own: false, change_others: false, needs_approval: false },
    settings_access: { general: false, booking: false, site_builder: false, fees_tax: false, integrations: false, change_password: true, view_pin: false },
    financial: { mark_paid: false, checkout_client: false, refund: false, access_terminal: false, pay_cash: false, pay_zelle: false, pay_other: false, view_earnings: false, view_all_earnings: false },
  },
}

export interface RolePerms {
  pages: Record<string, boolean>
  bookings: Record<string, boolean>
  calendar_settings: Record<string, boolean>
  clients: Record<string, boolean>
  schedule: Record<string, boolean>
  settings_access: Record<string, boolean>
  financial: Record<string, boolean>
}

export type PermCategory = keyof RolePerms

interface PermissionsContextType {
  perms: Record<string, RolePerms>
  hasPerm: (category: PermCategory, action: string) => boolean
  loading: boolean
  refresh: () => void
}

const PermissionsContext = createContext<PermissionsContextType>({
  perms: DEFAULT_PERMS,
  hasPerm: () => false,
  loading: true,
  refresh: () => {},
})

export { DEFAULT_PERMS }

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [perms, setPerms] = useState<Record<string, RolePerms>>(DEFAULT_PERMS)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('VURIUMBOOK_TOKEN') : null
    if (!token) { setLoading(false); return }

    apiFetch('/api/settings/permissions')
      .then((d: any) => {
        if (d?.role_permissions) {
          // Merge with defaults so new permissions get default values
          const merged: Record<string, RolePerms> = {}
          for (const role of Object.keys(DEFAULT_PERMS)) {
            const saved = d.role_permissions[role] || {}
            merged[role] = {
              pages: { ...DEFAULT_PERMS[role].pages, ...(saved.pages || {}) },
              bookings: { ...DEFAULT_PERMS[role].bookings, ...(saved.bookings || {}) },
              calendar_settings: { ...DEFAULT_PERMS[role].calendar_settings, ...(saved.calendar_settings || {}) },
              clients: { ...DEFAULT_PERMS[role].clients, ...(saved.clients || {}) },
              schedule: { ...DEFAULT_PERMS[role].schedule, ...(saved.schedule || {}) },
              settings_access: { ...DEFAULT_PERMS[role].settings_access, ...(saved.settings_access || {}) },
              financial: { ...DEFAULT_PERMS[role].financial, ...(saved.financial || {}) },
            }
          }
          setPerms(merged)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const hasPerm = useCallback(
    (category: PermCategory, action: string) => {
      // Get current user role
      let role = 'barber'
      try { role = JSON.parse(localStorage.getItem('VURIUMBOOK_USER') || '{}').role || 'barber' } catch {}
      // Owner always has all permissions
      if (role === 'owner') return true
      return !!perms[role]?.[category]?.[action]
    },
    [perms]
  )

  return (
    <PermissionsContext.Provider value={{ perms, hasPerm, loading, refresh: load }}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions() {
  return useContext(PermissionsContext)
}
