'use client'
import { useEffect, useState, useCallback } from 'react'
import Shell from '@/components/Shell'
import { apiFetch } from '@/lib/api'
import { loadStripe, Appearance } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

// ─── Stripe setup ───────────────────────────────────────────────────────────
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
const stripePromise = STRIPE_PK ? loadStripe(STRIPE_PK) : null

const stripeAppearance: Appearance = {
  theme: 'night',
  variables: {
    colorPrimary: 'rgba(255,255,255,.85)',
    colorBackground: '#0d0d0d',
    colorText: '#e8e8ed',
    colorTextSecondary: 'rgba(255,255,255,.45)',
    colorDanger: 'rgba(220,130,160,.8)',
    borderRadius: '12px',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    fontSizeBase: '14px',
    spacingUnit: '4px',
    colorTextPlaceholder: 'rgba(255,255,255,.25)',
  },
  rules: {
    '.Input': {
      border: '1px solid rgba(255,255,255,.10)',
      backgroundColor: 'rgba(255,255,255,.04)',
      boxShadow: 'none',
      transition: 'border-color .2s',
    },
    '.Input:focus': {
      border: '1px solid rgba(255,255,255,.25)',
      boxShadow: '0 0 0 1px rgba(255,255,255,.08)',
    },
    '.Label': {
      color: 'rgba(255,255,255,.45)',
      fontSize: '12px',
      fontWeight: '500',
      letterSpacing: '.03em',
    },
    '.Tab': {
      border: '1px solid rgba(255,255,255,.08)',
      backgroundColor: 'rgba(255,255,255,.03)',
      color: 'rgba(255,255,255,.50)',
    },
    '.Tab--selected': {
      border: '1px solid rgba(255,255,255,.18)',
      backgroundColor: 'rgba(255,255,255,.06)',
      color: '#e8e8ed',
    },
    '.Tab:hover': {
      backgroundColor: 'rgba(255,255,255,.05)',
    },
    '.Block': {
      backgroundColor: 'transparent',
      borderColor: 'rgba(255,255,255,.06)',
    },
    '.Error': {
      color: 'rgba(220,130,160,.8)',
    },
  },
}

// ─── Native iOS detection ───────────────────────────────────────────────────
declare global {
  interface Window {
    __VURIUM_IS_NATIVE?: boolean
    webkit?: { messageHandlers?: { purchase?: { postMessage: (msg: any) => void } } }
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────
interface BillingStatus {
  plan: string
  trial_active: boolean
  trial_ends_at: string | null
  trial_days_left: number
  subscription_status: string
  stripe_subscription_id: string | null
}

interface PlanDef {
  id: string; name: string; price: number; period: string
  features: string[]; color: string; featured?: boolean
}

const PLANS: PlanDef[] = [
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

// ─── Checkout Form (inside Elements provider) ───────────────────────────────
function CheckoutForm({ plan, onSuccess, onCancel }: { plan: PlanDef; onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setProcessing(true)
    setError('')

    const { error: submitError } = await elements.submit()
    if (submitError) {
      setError(submitError.message || 'Validation failed')
      setProcessing(false)
      return
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/dashboard?billing=success` },
      redirect: 'if_required',
    })

    if (confirmError) {
      // Try setup intent for trial subscriptions
      if (confirmError.type === 'invalid_request_error') {
        const { error: setupError } = await stripe.confirmSetup({
          elements,
          confirmParams: { return_url: `${window.location.origin}/dashboard?billing=success` },
          redirect: 'if_required',
        })
        if (setupError) {
          setError(setupError.message || 'Payment failed')
          setProcessing(false)
          return
        }
      } else {
        setError(confirmError.message || 'Payment failed')
        setProcessing(false)
        return
      }
    }

    // Success
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Plan summary — compact */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e8e8ed' }}>{plan.name}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.30)' }}>Monthly subscription</div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#e8e8ed' }}>${plan.price}<span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,.25)' }}>/mo</span></div>
      </div>

      {/* Stripe Payment Element — accordion is more compact on mobile */}
      <div style={{ marginBottom: 16 }}>
        <PaymentElement options={{
          layout: { type: 'accordion', defaultCollapsed: false, radios: false, spacedAccordionItems: false },
          defaultValues: { billingDetails: { address: { country: 'US' } } },
          business: { name: 'Vurium' },
        }} />
      </div>

      {error && (
        <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(220,130,160,.08)', border: '1px solid rgba(220,130,160,.15)', color: 'rgba(220,130,160,.8)', fontSize: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Submit */}
      <button type="submit" disabled={!stripe || processing} style={{
        width: '100%', height: 46, borderRadius: 999, border: '1px solid rgba(255,255,255,.15)',
        background: '#000', color: 'rgba(255,255,255,.85)', fontSize: 14, fontWeight: 600,
        cursor: processing ? 'wait' : 'pointer', fontFamily: 'inherit',
        opacity: processing ? 0.5 : 1, transition: 'all .2s',
      }}>
        {processing ? 'Processing...' : `Start 14-Day Free Trial — $${plan.price}/mo`}
      </button>

      {/* Cancel */}
      <button type="button" onClick={onCancel} style={{
        width: '100%', height: 36, marginTop: 8, borderRadius: 999,
        border: '1px solid rgba(255,255,255,.06)', background: 'transparent',
        color: 'rgba(255,255,255,.30)', fontSize: 12, fontWeight: 500,
        cursor: 'pointer', fontFamily: 'inherit',
      }}>
        Cancel
      </button>

      <div style={{ textAlign: 'center', marginTop: 10, fontSize: 10, color: 'rgba(255,255,255,.12)' }}>
        No charge for 14 days · Cancel anytime · Secured by Stripe
      </div>
    </form>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function BillingPage() {
  const [billing, setBilling] = useState<BillingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutPlan, setCheckoutPlan] = useState<PlanDef | null>(null)
  const [clientSecret, setClientSecret] = useState('')
  const [intentType, setIntentType] = useState<'payment' | 'setup'>('payment')
  const [checkoutLoading, setCheckoutLoading] = useState('')

  const loadBilling = useCallback(() => {
    apiFetch('/api/billing/status').then(setBilling).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadBilling() }, [loadBilling])

  // Listen for Apple IAP purchase success/error from native app
  useEffect(() => {
    const onSuccess = () => { setCheckoutLoading(''); setTimeout(loadBilling, 1500) }
    const onError = () => { setCheckoutLoading('') }
    window.addEventListener('vuriumPurchaseSuccess', onSuccess)
    window.addEventListener('vuriumPurchaseError', onError)
    return () => {
      window.removeEventListener('vuriumPurchaseSuccess', onSuccess)
      window.removeEventListener('vuriumPurchaseError', onError)
    }
  }, [loadBilling])

  async function startCheckout(plan: PlanDef) {
    // Native iOS → trigger Apple In-App Purchase
    if (window.__VURIUM_IS_NATIVE && window.webkit?.messageHandlers?.purchase) {
      setCheckoutLoading(plan.id)
      window.webkit.messageHandlers.purchase.postMessage({ plan: plan.id })
      return
    }

    if (!stripePromise) {
      // Fallback to hosted checkout if no publishable key
      setCheckoutLoading(plan.id)
      try {
        const data = await apiFetch('/api/billing/checkout', { method: 'POST', body: JSON.stringify({ plan: plan.id }) })
        if (data.url) window.location.href = data.url
      } catch (e: any) { alert(e.message || 'Failed') }
      setCheckoutLoading('')
      return
    }

    setCheckoutLoading(plan.id)
    try {
      // Try custom Elements checkout first
      const data = await apiFetch('/api/billing/create-subscription', {
        method: 'POST',
        body: JSON.stringify({ plan: plan.id }),
      })
      if (data.clientSecret) {
        setClientSecret(data.clientSecret)
        setIntentType(data.type === 'setup' ? 'setup' : 'payment')
        setCheckoutPlan(plan)
        setCheckoutLoading('')
        return
      }
    } catch { /* fall through to hosted checkout */ }
    // Fallback: hosted Stripe Checkout
    try {
      const data = await apiFetch('/api/billing/checkout', { method: 'POST', body: JSON.stringify({ plan: plan.id }) })
      if (data.url) { window.location.href = data.url; return }
    } catch (e2: any) { alert(e2.message || 'Failed to start checkout') }
    setCheckoutLoading('')
  }

  function onCheckoutSuccess() {
    setCheckoutPlan(null)
    setClientSecret('')
    // Refresh billing after a short delay for webhook processing
    setTimeout(loadBilling, 2000)
  }

  async function handlePortal() {
    try {
      const data = await apiFetch('/api/billing/portal', { method: 'POST' })
      if (data.url) window.location.href = data.url
    } catch (e: any) { alert(e.message || 'Failed to open billing portal') }
  }

  async function handleCancel() {
    if (!confirm('Are you sure you want to cancel your subscription? You will lose access at the end of the billing period.')) return
    try {
      await apiFetch('/api/billing/cancel', { method: 'POST' })
      loadBilling()
    } catch (e: any) { alert(e.message || 'Failed to cancel') }
  }

  const card: React.CSSProperties = {
    borderRadius: 20, padding: '28px 24px', position: 'relative',
    border: '1px solid rgba(255,255,255,.06)',
    background: 'linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015))',
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
                        onClick={() => startCheckout(p)}
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
                      <a href="mailto:support@vurium.com?subject=VuriumBook Enterprise" style={{
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
                You&apos;re on a free trial with full access to all features. Subscribe before the trial ends to keep your data and settings.
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Fullscreen Checkout Page (like /book style) ──────────────── */}
      {checkoutPlan && clientSecret && stripePromise && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
          overflowY: 'auto', background: '#0a0a0a',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        }}>
          {/* Hide Shell completely */}
          <style>{`
            .top-bar,.pill-bar{display:none!important;}.content{overflow:visible!important;}
            @keyframes checkoutStarBreathe {
              0%, 100% { opacity: 0.15; transform: scale(0.8); box-shadow: 0 0 3px 1px rgba(200,220,255,.08); }
              50% { opacity: 0.6; transform: scale(1.3); box-shadow: 0 0 8px 3px rgba(200,220,255,.15); }
            }
          `}</style>

          {/* Cosmic background — matches /book dark template */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            {/* Static stars */}
            {Array.from({ length: 80 }, (_, i) => (
              <div key={`s${i}`} style={{
                position: 'absolute',
                left: `${(i * 13.7 + 3) % 100}%`,
                top: `${(i * 19.3 + 7) % 100}%`,
                width: i % 8 === 0 ? 1.5 : i % 3 === 0 ? 1 : 0.5,
                height: i % 8 === 0 ? 1.5 : i % 3 === 0 ? 1 : 0.5,
                borderRadius: 999,
                background: '#fff',
                opacity: 0.1 + (i % 5) * 0.08,
              }} />
            ))}
            {/* Breathing glow stars */}
            {Array.from({ length: 5 }, (_, i) => (
              <div key={`g${i}`} style={{
                position: 'absolute',
                left: `${15 + i * 18}%`,
                top: `${10 + i * 17}%`,
                width: 3, height: 3, borderRadius: 999,
                background: 'rgba(200,220,255,.5)',
                animation: `checkoutStarBreathe ${3.5 + i * 0.4}s ease-in-out ${i * 0.8}s infinite`,
              }} />
            ))}
          </div>

          {/* Content */}
          <div style={{ position: 'relative', zIndex: 2, maxWidth: 440, margin: '0 auto', padding: 'calc(var(--sat, 16px) + 12px) 24px calc(var(--sab, 16px) + 24px)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

            {/* Header row: back + title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
              <button onClick={() => { setCheckoutPlan(null); setClientSecret('') }} style={{
                width: 36, height: 36, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)',
                color: 'rgba(255,255,255,.45)', cursor: 'pointer', flexShrink: 0,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              </button>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#e8e8ed', letterSpacing: '-.02em' }}>VuriumBook {checkoutPlan.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.30)' }}>Monthly subscription</div>
              </div>
            </div>

            {/* Stripe Elements */}
            <Elements stripe={stripePromise} options={{
              clientSecret,
              appearance: stripeAppearance,
              loader: 'auto',
            }}>
              <CheckoutForm
                plan={checkoutPlan}
                onSuccess={onCheckoutSuccess}
                onCancel={() => { setCheckoutPlan(null); setClientSecret('') }}
              />
            </Elements>
          </div>
        </div>
      )}
    </Shell>
  )
}
