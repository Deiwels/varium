'use client'

interface UpgradeGateProps {
  feature: string
  requiredPlan?: string
  currentPlan?: string
}

export default function UpgradeGate({ feature, requiredPlan = 'salon', currentPlan = 'individual' }: UpgradeGateProps) {
  const planLabels: Record<string, string> = {
    individual: 'Individual',
    salon: 'Salon',
    custom: 'Custom',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center', minHeight: '50vh' }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16, margin: '0 auto 20px',
        background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.5" strokeLinecap="round">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 600, color: '#e8e8ed', marginBottom: 8 }}>
        {feature}
      </h2>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,.35)', maxWidth: 380, lineHeight: 1.6, marginBottom: 28 }}>
        This feature is available on the <strong style={{ color: 'rgba(255,255,255,.6)' }}>{planLabels[requiredPlan] || requiredPlan}</strong> plan.
        {currentPlan !== requiredPlan && ` You're currently on ${planLabels[currentPlan] || currentPlan}.`}
      </p>

      <a href="/billing" style={{
        padding: '12px 28px', borderRadius: 12, fontSize: 14, textDecoration: 'none',
        background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)',
        color: 'rgba(255,255,255,.7)', fontWeight: 500, transition: 'all .2s',
      }}>
        Upgrade Plan →
      </a>
    </div>
  )
}
