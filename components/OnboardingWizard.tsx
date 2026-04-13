'use client'
import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/api'
import { getStaffLabel } from '@/lib/terminology'
import { BUSINESS_TEMPLATES, DEFAULT_TEMPLATES, type ServiceTemplate } from '@/lib/onboarding-templates'

interface Props {
  settings: Record<string, any>
  slug: string
  onComplete: () => void
  onDismiss: () => void
}

const BUSINESS_TYPES = ['Barbershop', 'Hair Salon', 'Nail Studio', 'Beauty Salon', 'Spa & Wellness', 'Tattoo Studio', 'Lash & Brow Bar']

const inp: React.CSSProperties = { width: '100%', height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', color: '#e8e8ed', fontSize: 14, padding: '0 14px', fontFamily: 'inherit', outline: 'none', transition: 'border-color .15s' }
const btnPrimary: React.CSSProperties = { height: 46, borderRadius: 14, border: '1px solid rgba(130,150,220,.35)', background: 'rgba(130,150,220,.12)', color: 'rgba(130,150,220,.9)', cursor: 'pointer', fontWeight: 800, fontSize: 14, fontFamily: 'inherit', transition: 'all .15s', width: '100%' }
const btnSecondary: React.CSSProperties = { height: 46, borderRadius: 14, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', color: 'rgba(255,255,255,.45)', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', transition: 'all .15s', width: '100%' }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function OnboardingWizard({ settings, slug, onComplete, onDismiss }: Props) {
  // Auto-skip step 1 if business info already filled
  const hasBusinessInfo = !!(settings.shop_name && settings.business_type)
  const [step, setStep] = useState(hasBusinessInfo ? 2 : 1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Step 1
  const [shopName, setShopName] = useState(settings.shop_name || '')
  const [businessType, setBusinessType] = useState(settings.business_type || '')
  const [shopAddress, setShopAddress] = useState(settings.shop_address || '')

  // Step 2
  const [staffName, setStaffName] = useState('')
  const [scheduleDays, setScheduleDays] = useState([1, 2, 3, 4, 5, 6])
  const [startHour, setStartHour] = useState(9)
  const [endHour, setEndHour] = useState(18)
  const [createdBarberId, setCreatedBarberId] = useState('')

  // Step 3
  const [services, setServices] = useState<(ServiceTemplate & { selected: boolean })[]>([])

  // Step 4
  const [bookingEnabled, setBookingEnabled] = useState(true)

  // Load templates when business type changes
  useEffect(() => {
    const templates = BUSINESS_TEMPLATES[businessType] || DEFAULT_TEMPLATES
    setServices(templates.map(t => ({ ...t, selected: t.service_type === 'primary' })))
  }, [businessType])

  const staffLabel = getStaffLabel(businessType || settings.business_type)

  async function saveStep1() {
    if (!shopName.trim()) { setError('Enter your business name'); return }
    if (!businessType) { setError('Select your business type'); return }
    setError(''); setSaving(true)
    try {
      await apiFetch('/api/settings', { method: 'POST', body: JSON.stringify({ shop_name: shopName.trim(), business_type: businessType, shop_address: shopAddress.trim() }) })
      setStep(2)
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  async function saveStep2() {
    if (!staffName.trim()) { setError(`Enter ${staffLabel.toLowerCase()} name`); return }
    if (!scheduleDays.length) { setError('Select at least one working day'); return }
    setError(''); setSaving(true)
    try {
      const res = await apiFetch('/api/barbers', { method: 'POST', body: JSON.stringify({ name: staffName.trim(), schedule: { startMin: startHour * 60, endMin: endHour * 60, days: scheduleDays } }) })
      setCreatedBarberId(res.id || res.barber?.id || '')
      setStep(3)
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  async function saveStep3() {
    const selected = services.filter(s => s.selected)
    if (!selected.length) { setError('Select at least one service'); return }
    setError(''); setSaving(true)
    try {
      await Promise.all(selected.map(s =>
        apiFetch('/api/services', { method: 'POST', body: JSON.stringify({ name: s.name, duration_minutes: s.duration_minutes, price_cents: s.price_cents, barber_ids: createdBarberId ? [createdBarberId] : [], service_type: s.service_type }) })
      ))
      setStep(4)
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  async function saveStep4() {
    setError(''); setSaving(true)
    try {
      await apiFetch('/api/settings', { method: 'POST', body: JSON.stringify({ online_booking_enabled: bookingEnabled }) })
      onComplete()
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  function toggleDay(d: number) {
    setScheduleDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort())
  }

  function updateService(idx: number, field: string, value: any) {
    setServices(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  function addCustomService() {
    setServices(prev => [...prev, { name: '', duration_minutes: 30, price_cents: 3000, service_type: 'primary', selected: true }])
  }

  const totalSteps = hasBusinessInfo ? 3 : 4
  const displayStep = hasBusinessInfo ? step - 1 : step

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 60px)', padding: 20 }}>
      <div style={{ width: 'min(520px, 94vw)', borderRadius: 24, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(10,10,20,.94)', backdropFilter: 'saturate(180%) blur(40px)', padding: '28px 24px', boxShadow: '0 30px 80px rgba(0,0,0,.5)', animation: 'dlgPop .25s cubic-bezier(.4,0,.2,1)' }}>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < displayStep ? 'rgba(130,150,220,.7)' : i === displayStep - 1 ? 'rgba(130,150,220,.7)' : 'rgba(255,255,255,.08)', transition: 'background .3s' }} />
          ))}
        </div>

        {/* ── Step 1: Business Info ── */}
        {step === 1 && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#e8e8ed', marginBottom: 4 }}>Set up your business</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginBottom: 24 }}>Tell us about your business to get started</div>

            <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6, display: 'block' }}>Business Name</label>
            <input value={shopName} onChange={e => setShopName(e.target.value)} placeholder="e.g. Prime Cuts" style={inp} />

            <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 18, marginBottom: 10, display: 'block' }}>Business Type</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {BUSINESS_TYPES.map(t => (
                <button key={t} onClick={() => setBusinessType(t)} style={{ height: 36, padding: '0 16px', borderRadius: 999, border: `1px solid ${businessType === t ? 'rgba(130,150,220,.5)' : 'rgba(255,255,255,.08)'}`, background: businessType === t ? 'rgba(130,150,220,.12)' : 'rgba(255,255,255,.03)', color: businessType === t ? 'rgba(130,150,220,.9)' : 'rgba(255,255,255,.5)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                  {t}
                </button>
              ))}
            </div>

            <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 18, marginBottom: 6, display: 'block' }}>Address <span style={{ fontWeight: 400, opacity: .5 }}>(optional)</span></label>
            <input value={shopAddress} onChange={e => setShopAddress(e.target.value)} placeholder="123 Main St, City" style={inp} />

            {error && <div style={{ marginTop: 12, fontSize: 12, color: '#ff6b6b' }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={onDismiss} style={{ ...btnSecondary, flex: 0, width: 'auto', padding: '0 20px' }}>Skip</button>
              <button onClick={saveStep1} disabled={saving} style={{ ...btnPrimary, opacity: saving ? .5 : 1 }}>
                {saving ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Add Staff ── */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#e8e8ed', marginBottom: 4 }}>Add your first {staffLabel}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginBottom: 24 }}>You can add more team members later in Settings</div>

            <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6, display: 'block' }}>Name</label>
            <input value={staffName} onChange={e => setStaffName(e.target.value)} placeholder={`${staffLabel} name`} style={inp} autoFocus />

            <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 18, marginBottom: 10, display: 'block' }}>Working Days</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {DAYS.map((d, i) => (
                <button key={d} onClick={() => toggleDay(i)} style={{ width: 44, height: 38, borderRadius: 10, border: `1px solid ${scheduleDays.includes(i) ? 'rgba(130,150,220,.4)' : 'rgba(255,255,255,.08)'}`, background: scheduleDays.includes(i) ? 'rgba(130,150,220,.10)' : 'rgba(255,255,255,.02)', color: scheduleDays.includes(i) ? 'rgba(130,150,220,.9)' : 'rgba(255,255,255,.35)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                  {d}
                </button>
              ))}
            </div>

            <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 18, marginBottom: 10, display: 'block' }}>Working Hours</label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <select value={startHour} onChange={e => setStartHour(+e.target.value)} style={{ ...inp, width: 'auto', padding: '0 12px', appearance: 'auto' as any }}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
              </select>
              <span style={{ color: 'rgba(255,255,255,.3)' }}>to</span>
              <select value={endHour} onChange={e => setEndHour(+e.target.value)} style={{ ...inp, width: 'auto', padding: '0 12px', appearance: 'auto' as any }}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
              </select>
            </div>

            {error && <div style={{ marginTop: 12, fontSize: 12, color: '#ff6b6b' }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={onDismiss} style={{ ...btnSecondary, flex: 0, width: 'auto', padding: '0 20px' }}>Skip</button>
              <button onClick={saveStep2} disabled={saving} style={{ ...btnPrimary, opacity: saving ? .5 : 1 }}>
                {saving ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Services ── */}
        {step === 3 && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#e8e8ed', marginBottom: 4 }}>Add your services</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginBottom: 20 }}>Select from templates or add custom services. Prices and durations are editable.</div>

            <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4 }}>
              {services.map((s, i) => (
                <div key={i} onClick={() => updateService(i, 'selected', !s.selected)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, border: `1px solid ${s.selected ? 'rgba(130,150,220,.30)' : 'rgba(255,255,255,.06)'}`, background: s.selected ? 'rgba(130,150,220,.06)' : 'rgba(255,255,255,.02)', cursor: 'pointer', transition: 'all .15s' }}>
                  {/* Checkbox */}
                  <div style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${s.selected ? 'rgba(130,150,220,.6)' : 'rgba(255,255,255,.15)'}`, background: s.selected ? 'rgba(130,150,220,.2)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}>
                    {s.selected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(130,150,220,.9)" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>}
                  </div>
                  {/* Name */}
                  <input value={s.name} onClick={e => e.stopPropagation()} onChange={e => updateService(i, 'name', e.target.value)} style={{ flex: 1, background: 'none', border: 'none', color: s.selected ? '#e8e8ed' : 'rgba(255,255,255,.4)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', outline: 'none', minWidth: 0 }} placeholder="Service name" />
                  {/* Duration */}
                  <input value={s.duration_minutes} onClick={e => e.stopPropagation()} onChange={e => updateService(i, 'duration_minutes', Math.max(1, +e.target.value || 0))} type="number" style={{ width: 44, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, color: 'rgba(255,255,255,.5)', fontSize: 12, textAlign: 'center', padding: '4px 2px', fontFamily: 'inherit', outline: 'none' }} />
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', marginLeft: -6 }}>min</span>
                  {/* Price */}
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>$</span>
                  <input value={(s.price_cents / 100).toFixed(0)} onClick={e => e.stopPropagation()} onChange={e => updateService(i, 'price_cents', Math.max(0, (+e.target.value || 0)) * 100)} type="number" style={{ width: 50, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8, color: 'rgba(255,255,255,.5)', fontSize: 12, textAlign: 'center', padding: '4px 2px', fontFamily: 'inherit', outline: 'none', marginLeft: -4 }} />
                </div>
              ))}
            </div>

            <button onClick={addCustomService} style={{ marginTop: 10, height: 38, borderRadius: 10, border: '1px dashed rgba(255,255,255,.10)', background: 'none', color: 'rgba(255,255,255,.35)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', width: '100%', transition: 'all .15s' }}>
              + Add custom service
            </button>

            {error && <div style={{ marginTop: 12, fontSize: 12, color: '#ff6b6b' }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => { setStep(2); setError('') }} style={{ ...btnSecondary, flex: 0, width: 'auto', padding: '0 20px' }}>Back</button>
              <button onClick={saveStep3} disabled={saving} style={{ ...btnPrimary, opacity: saving ? .5 : 1 }}>
                {saving ? 'Creating services...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Enable Booking ── */}
        {step === 4 && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#e8e8ed', marginBottom: 4 }}>You're almost ready!</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginBottom: 24 }}>Enable online booking so clients can book appointments directly.</div>

            {/* Toggle */}
            <div onClick={() => setBookingEnabled(!bookingEnabled)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderRadius: 14, border: `1px solid ${bookingEnabled ? 'rgba(130,220,170,.25)' : 'rgba(255,255,255,.06)'}`, background: bookingEnabled ? 'rgba(130,220,170,.05)' : 'rgba(255,255,255,.02)', cursor: 'pointer', transition: 'all .2s' }}>
              <div style={{ width: 44, height: 24, borderRadius: 12, background: bookingEnabled ? 'rgba(130,220,170,.35)' : 'rgba(255,255,255,.10)', transition: 'background .2s', position: 'relative', flexShrink: 0 }}>
                <div style={{ width: 18, height: 18, borderRadius: 9, background: bookingEnabled ? '#fff' : 'rgba(255,255,255,.4)', position: 'absolute', top: 3, left: bookingEnabled ? 23 : 3, transition: 'all .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#e8e8ed' }}>Online Booking</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>Clients can book from your booking page</div>
              </div>
            </div>

            {/* Booking page preview */}
            {slug && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Your Booking Page</div>
                <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,.08)', overflow: 'hidden', background: '#000' }}>
                  <div style={{ height: 28, background: 'rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 12px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: 'rgba(255,107,107,.4)' }} />
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: 'rgba(255,207,63,.4)' }} />
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: 'rgba(130,220,170,.4)' }} />
                    <div style={{ flex: 1, textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,.3)' }}>vuriumbook.com/book/{slug}</div>
                  </div>
                  <iframe src={`/book/${slug}`} style={{ width: '100%', height: 320, border: 'none', pointerEvents: 'none' }} title="Booking Preview" />
                </div>
              </div>
            )}

            {error && <div style={{ marginTop: 12, fontSize: 12, color: '#ff6b6b' }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => { setStep(3); setError('') }} style={{ ...btnSecondary, flex: 0, width: 'auto', padding: '0 20px' }}>Back</button>
              <button onClick={saveStep4} disabled={saving} style={{ ...btnPrimary, opacity: saving ? .5 : 1 }}>
                {saving ? 'Launching...' : 'Launch'}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes dlgPop { 0% { opacity: 0; transform: scale(.96) translateY(8px) } 100% { opacity: 1; transform: scale(1) translateY(0) } }
      `}</style>
    </div>
  )
}
