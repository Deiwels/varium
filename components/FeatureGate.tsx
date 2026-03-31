'use client'
import { usePlan } from '@/components/PlanProvider'
import UpgradeGate from '@/components/UpgradeGate'

export default function FeatureGate({ feature, label, requiredPlan = 'salon', children }: {
  feature: string
  label: string
  requiredPlan?: string
  children: React.ReactNode
}) {
  const { hasFeature, effective_plan, loading } = usePlan()

  if (loading) return null
  if (!hasFeature(feature)) {
    return <UpgradeGate feature={label} requiredPlan={requiredPlan} currentPlan={effective_plan} />
  }
  return <>{children}</>
}
