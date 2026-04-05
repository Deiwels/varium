'use client'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/api'

interface PlanData {
  plan_type: string
  billing_status: string
  effective_plan: string
  features: string[]
  member_limit: number | null
  staff_limit: number | null
  is_unlimited: boolean
  trial_active: boolean
  trial_ends_at: string | null
  trial_days_left: number
  loading: boolean
  expired: boolean // true if trial ended and no active subscription
}

const defaultPlan: PlanData = {
  plan_type: 'individual',
  billing_status: 'inactive',
  effective_plan: 'expired',
  features: [],
  member_limit: 1,
  staff_limit: 0,
  is_unlimited: false,
  trial_active: false,
  trial_ends_at: null,
  trial_days_left: 0,
  loading: true,
  expired: false,
}

interface PlanContextType extends PlanData {
  hasFeature: (key: string) => boolean
  refresh: () => void
}

const PlanContext = createContext<PlanContextType>({
  ...defaultPlan,
  hasFeature: () => false,
  refresh: () => {},
})

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<PlanData>(defaultPlan)

  const load = useCallback(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('VURIUMBOOK_TOKEN') : null
    if (!token) { setData(prev => ({ ...prev, loading: false })); return }

    apiFetch('/api/account/limits')
      .then((d: any) => {
        const bs = d.billing_status || 'inactive'
        const isExpired = !d.trial_active && !['active', 'trialing'].includes(bs)
        setData({
          plan_type: d.plan_type || 'individual',
          billing_status: bs,
          effective_plan: d.effective_plan || 'expired',
          features: d.features || defaultPlan.features,
          member_limit: d.member_limit ?? 1,
          staff_limit: d.staff_limit ?? 0,
          is_unlimited: !!d.is_unlimited,
          trial_active: !!d.trial_active,
          trial_ends_at: d.trial_ends_at || null,
          trial_days_left: d.trial_days_left || 0,
          loading: false,
          expired: isExpired,
        })
      })
      .catch(() => {
        setData(prev => ({ ...prev, loading: false }))
      })
  }, [])

  useEffect(() => { load() }, [load])

  const hasFeature = useCallback(
    (key: string) => data.features.includes(key),
    [data.features]
  )

  return (
    <PlanContext.Provider value={{ ...data, hasFeature, refresh: load }}>
      {children}
    </PlanContext.Provider>
  )
}

export function usePlan() {
  return useContext(PlanContext)
}
