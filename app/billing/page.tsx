'use client'
import { useEffect, useState } from 'react'
import Shell from '@/components/Shell'
import { apiFetch } from '@/lib/api'

interface BillingStatus {
  plan: string
  trial_active: boolean
  trial_ends_at: string | null
  trial_days_left: number
  subscription_status: string
  stripe_subscription_id: string | null
}

const PLANS = [
  {
    id: 'individual', name: 'Individual', price: 29, period: '/mo',
    features: ['1 user (owner only)', 'Calendar & Bookings', 'Client management', 'Payments', 'Basic analytics', '1 booking page'],
    color: 'rgba(255,255,255,.4)',
  },
  {
    id: 'salon', name: 'Salon', price: 79, period: '/mo', featured: true,
    features: ['Everything in Individual', 'Up to 10 team members', 'Team management & roles', 'Waitlist & Messages', 'Portfolio & Membership', 'Cash register', 'Attendance tracking', 'Advanced analytics'],
    color: 'rgba(255,255,255,.5)',
  },
  {
    id: 'custom', name: 'Custom', price: 99, period: '/mo',
    features: ['Everything in Salon', 'Custom booking site', '5 design templates', 'Unlimited team members', 'Expenses & Payroll', 'Dedicated support'],
    color: 'rgba(255,255,255,.35)',
  },
]

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState('')

  useEffect(() => {
    apiFetch('/api/billing/status')
      .then(setBilling)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleCheckout(plan: string) {
    setCheckoutLoading(plan)
    try {
      const data = await apiFetch('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan }),
      })
      if (data.url) window.location.href = data.url
    } catch (e: any) {
      alert(e.message || 'Failed to start checkout')
    } finally {
      setCheckoutLoading('')
    }
  }

  async function handlePortal() {
    try {
      const data = await apiFetch('/api/billing/portal', { method: 'POST' })
      if (data.url) window.location.href = data.url
    } catch (e: any) {
      alert(e.message || 'Failed to open billing portal')
    }
  }

  async function handleCancel() {
    if (!confirm('Are you sure you want to cancel your subscription? You will lose access at the end of the billing period.')) return
    try {
      await apiFetch('/api/billing/cancel', { method: 'POST' })
      const updated = await apiFetch('/api/billing/status')
      setBilling(updated)
    } catch (e: any) {
      alert(e.message || 'Failed to cancel')
    }
  }

  const card: React.CSSProperties = {
    borderRadius: 20, padding: '28px 24px', position: 'relative',
    border: '1px solid rgba(255,255,255,.06)',
    background: 'linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015))',
    backdropFilter: 'blur(12px)',
  }

  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    trialing: { bg: 'rgba(130,220,170,.1)', text: 'rgba(130,220,170,.8)', label: 'Free Trial' },
    active: { bg: 'rgba(130,150,220,.1)', text: 'rgba(130,150,220,.8)', label: 'Active' },
    past_due: { bg: 'rgba(220,170,100,.1)', text: 'rgba(220,170,100,.8)', label: 'Past Due' },
    canceled: { bg: 'rgba(220,130,160,.1)', text: 'rgba(220,130,160,.8)', label: 'Canceled' },
    cancelling: { bg: 'rgba(220,170,100,.1)', text: 'rgba(220,170,100,.8)', label: 'Cancelling' },
    inactive: { bg: 'rgba(255,255,255,.05)', text: 'rgba(255,255,255,.4)', label: 'Inactive' },
  }

  return (
    <Shell page="Billing">
      <div style={{ padding: 'clamp(20px,3vw,32px)', maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8ed', marginBottom: 8 }}>Billing & Plan</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', marginBottom: 32 }}>Manage your subscription and payment details</p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,.3)' }}>Loading...</div>
        ) : (
          <>
            {/* Current status */}
            {billing && (
              <div style={{ ...card, marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>Current Plan</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 22, fontWeight: 700, color: '#e8e8ed', textTransform: 'capitalize' }}>{billing.plan}</span>
                    <span style={{
                      padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                      background: (statusColors[billing.subscription_status] || statusColors.inactive).bg,
                      color: (statusColors[billing.subscription_status] || statusColors.inactive).text,
                    }}>
                      {(statusColors[billing.subscription_status] || statusColors.inactive).label}
                    </span>
                  </div>
                  {billing.trial_active && (
                    <p style={{ fontSize: 13, color: 'rgba(130,220,170,.6)', marginTop: 8 }}>
                      {billing.trial_days_left} days left in free trial
                      {billing.trial_ends_at && <span style={{ color: 'rgba(255,255,255,.25)' }}> · expires {new Date(billing.trial_ends_at).toLocaleDateString()}</span>}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {billing.stripe_subscription_id && (
                    <>
                      <button onClick={handlePortal} style={{
                        padding: '10px 20px', borderRadius: 12, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
                        background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.6)',
                      }}>Manage Payment</button>
                      {billing.subscription_status !== 'cancelling' && billing.subscription_status !== 'canceled' && (
                        <button onClick={handleCancel} style={{
                          padding: '10px 20px', borderRadius: 12, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
                          background: 'rgba(220,80,80,.06)', border: '1px solid rgba(220,80,80,.15)', color: 'rgba(220,130,130,.7)',
                        }}>Cancel</button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Plans */}
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 16 }}>
              {billing?.stripe_subscription_id ? 'Change Plan' : 'Choose a Plan'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              {PLANS.map(p => {
                const isCurrent = billing?.plan === p.id
                return (
                  <div key={p.id} style={{
                    ...card,
                    borderColor: p.featured ? 'rgba(130,220,170,.15)' : isCurrent ? 'rgba(130,150,220,.15)' : undefined,
                    background: p.featured ? 'linear-gradient(180deg,rgba(130,220,170,.04),rgba(255,255,255,.015))' : card.background,
                  }}>
                    {p.featured && (
                      <div style={{ position: 'absolute', top: 14, right: 16, fontSize: 9, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(130,220,170,.7)', background: 'rgba(130,220,170,.1)', padding: '3px 10px', borderRadius: 999 }}>Popular</div>
                    )}
                    {isCurrent && (
                      <div style={{ position: 'absolute', top: 14, right: 16, fontSize: 9, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(130,150,220,.7)', background: 'rgba(130,150,220,.1)', padding: '3px 10px', borderRadius: 999 }}>Current</div>
                    )}
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,.5)', marginBottom: 8 }}>{p.name}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 18 }}>
                      <span style={{ fontSize: 32, fontWeight: 700, color: '#e8e8ed' }}>{p.price ? `$${p.price}` : 'Custom'}</span>
                      {p.period && <span style={{ fontSize: 13, color: 'rgba(255,255,255,.25)' }}>{p.period}</span>}
                    </div>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 22 }}>
                      {p.features.map((f, j) => (
                        <li key={j} style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ color: p.color, fontSize: 13 }}>&#10003;</span> {f}
                        </li>
                      ))}
                    </ul>
                    {p.id !== 'custom' ? (
                      <button
                        onClick={() => handleCheckout(p.id)}
                        disabled={isCurrent || !!checkoutLoading}
                        style={{
                          width: '100%', padding: '12px', borderRadius: 12, fontSize: 13, fontFamily: 'inherit', cursor: isCurrent ? 'default' : 'pointer',
                          background: isCurrent ? 'rgba(255,255,255,.03)' : p.featured ? 'rgba(130,220,170,.12)' : 'rgba(255,255,255,.05)',
                          border: `1px solid ${isCurrent ? 'rgba(255,255,255,.06)' : p.featured ? 'rgba(130,220,170,.2)' : 'rgba(255,255,255,.1)'}`,
                          color: isCurrent ? 'rgba(255,255,255,.3)' : p.featured ? 'rgba(130,220,170,.8)' : 'rgba(255,255,255,.6)',
                          opacity: checkoutLoading ? 0.5 : 1,
                        }}
                      >
                        {checkoutLoading === p.id ? 'Loading...' : isCurrent ? 'Current Plan' : 'Subscribe'}
                      </button>
                    ) : (
                      <a href="mailto:hello@vurium.com?subject=VuriumBook Enterprise" style={{
                        display: 'block', width: '100%', padding: '12px', borderRadius: 12, fontSize: 13, textAlign: 'center', textDecoration: 'none',
                        background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.6)',
                      }}>Contact Sales</a>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Trial info */}
            {billing?.trial_active && !billing.stripe_subscription_id && (
              <div style={{ marginTop: 28, padding: '16px 20px', borderRadius: 14, background: 'rgba(130,150,220,.04)', border: '1px solid rgba(130,150,220,.1)', fontSize: 13, color: 'rgba(130,150,220,.6)', lineHeight: 1.6 }}>
                You&apos;re on a 14-day free trial with full access to all features. Subscribe before the trial ends to keep your data and settings.
              </div>
            )}
          </>
        )}
      </div>
    </Shell>
  )
}
