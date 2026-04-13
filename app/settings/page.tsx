'use client'
import Shell from '@/components/Shell'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useDialog } from '@/components/StyledDialog'

import { apiFetch } from '@/lib/api'
import { getTimezoneList } from '@/lib/timezones'
import { getStaffLabel } from '@/lib/terminology'
import { usePlan } from '@/components/PlanProvider'
import { DEFAULT_PERMS, usePermissions, type RolePerms, type PermCategory } from '@/components/PermissionsProvider'
import { hasPinSetup, clearPin } from '@/lib/pin'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Fee { id: string; label: string; type: 'percent'|'fixed'; value: number; applies_to: string; enabled: boolean }
interface Charge { id: string; name: string; type: 'percent'|'fixed'|'label'; value: number; color: string; enabled: boolean }
interface UserAccount { id: string; username: string; name: string; role: string; active: boolean; barber_id?: string; last_login?: string }
interface Barber { id: string; name: string }

// ─── Shared styles ────────────────────────────────────────────────────────────
const inp: React.CSSProperties = { width: '100%', height: 42, borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(0,0,0,.22)', color: '#fff', padding: '0 12px', outline: 'none', fontSize: 13, fontFamily: 'inherit' }
const inpSm: React.CSSProperties = { height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(0,0,0,.22)', color: '#fff', padding: '0 10px', outline: 'none', fontSize: 12, fontFamily: 'inherit' }
const lbl: React.CSSProperties = { fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.50)', display: 'block', marginBottom: 5 }
const card: React.CSSProperties = { borderRadius: 18, border: '1px solid rgba(255,255,255,.10)', background: 'linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02))', backdropFilter: 'blur(14px)', overflow: 'hidden' }
const cardHead: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(0,0,0,.12)' }
const headLbl: React.CSSProperties = { fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.70)' }

function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(0,0,0,.14)' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', marginTop: 2 }}>{sub}</div>}
      </div>
      <button onClick={() => onChange(!checked)} style={{ width: 44, height: 26, borderRadius: 999, border: 'none', background: checked ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.14)', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background .2s' }}>
        <span style={{ position: 'absolute', top: 4, left: checked ? 22 : 4, width: 18, height: 18, borderRadius: 999, background: '#fff', transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.4)' }} />
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={lbl}>{label}</label>{children}</div>
}

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={card}>
      <div style={cardHead}><span style={headLbl}>{title}</span>{action}</div>
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  )
}

function SmBtn({ onClick, children, danger, disabled }: { onClick: () => void; children: React.ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ height: 36, padding: '0 14px', borderRadius: 999, border: `1px solid ${danger ? 'rgba(255,107,107,.45)' : 'rgba(255,255,255,.14)'}`, background: danger ? 'rgba(255,107,107,.10)' : 'rgba(255,255,255,.05)', color: danger ? 'rgba(220,130,160,.5)' : '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', opacity: disabled ? .5 : 1 }}>
      {children}
    </button>
  )
}

// ─── Toll-Free SMS Enable (Individual plan) ─────────────────────────────────
function TollFreeEnableButton({ settings, onDone }: { settings: any; onDone: (data: any) => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleEnable() {
    setLoading(true); setError('')
    try {
      const res = await fetch(`${(window as any).__API || 'https://vuriumbook-api-431945333485.us-central1.run.app'}/api/sms/enable-tollfree`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to enable SMS')
      onDone({
        sms_registration_status: 'active',
        sms_from_number: data.phone_number,
        sms_number_type: 'toll-free',
        sms_brand_name: settings.shop_name || '',
      })
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', textAlign: 'center' }}>
      <div style={{ fontSize: 32 }}>&#128172;</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,.6)' }}>SMS Appointment Reminders</div>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', lineHeight: 1.5, maxWidth: 340 }}>
        Enable SMS to automatically send appointment confirmations and reminders to your clients. No setup required — just click the button below.
      </p>
      {error && <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(220,80,80,.1)', border: '1px solid rgba(220,80,80,.2)', color: 'rgba(255,160,160,.9)', fontSize: 12, width: '100%' }}>{error}</div>}
      <button onClick={handleEnable} disabled={loading} style={{
        height: 42, padding: '0 28px', borderRadius: 999, border: 'none',
        background: 'rgba(130,220,170,.15)', color: 'rgba(130,220,170,.9)',
        cursor: loading ? 'wait' : 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
        opacity: loading ? 0.5 : 1,
      }}>
        {loading ? 'Setting up…' : 'Enable SMS Reminders'}
      </button>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,.12)', lineHeight: 1.5, maxWidth: 300 }}>
        Included in your plan. Msg &amp; data rates may apply to recipients. <a href="/privacy" style={{ color: 'rgba(130,150,220,.3)', textDecoration: 'none' }}>Privacy Policy</a>
      </p>
    </div>
  )
}

// ─── SMS Registration Form ──────────────────────────────────────────────────
function SmsRegistrationForm({ wsId, settings, onDone }: { wsId: string; settings: any; onDone: (data: any) => void }) {
  const resumeOtpStep = settings.sms_registration_status === 'pending_otp'
  const [form, setForm] = useState({
    company_name: settings.shop_name || '',
    display_name: settings.sms_brand_name || settings.shop_name || '',
    ein: '',
    entity_type: 'PRIVATE_PROFIT',
    vertical: 'PROFESSIONAL',
    website: `https://vurium.com/book/${wsId}`,
    phone: settings.shop_phone || '',
    email: settings.shop_email || '',
    street: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'US',
    // Sole proprietor fields
    first_name: '',
    last_name: '',
    date_of_birth: '',
    mobile_phone: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [otpStep, setOtpStep] = useState(resumeOtpStep)
  const [otpPin, setOtpPin] = useState('')
  const [otpBrandId, setOtpBrandId] = useState(settings.telnyx_brand_id || '')
  const [wizardStep, setWizardStep] = useState(0)

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 10,
    border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)',
    color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit',
  }
  const lbl: React.CSSProperties = { fontSize: 11, color: 'rgba(255,255,255,.35)', display: 'block', marginBottom: 4 }

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }))
  const isSoleProp = form.entity_type === 'SOLE_PROPRIETOR'
  const steps = isSoleProp
    ? ['Business profile', 'Contact details', 'Owner verification']
    : ['Business profile', 'Contact details']
  const canContinueBusiness = !!form.company_name.trim() && (isSoleProp || !!form.ein.trim())
  const canContinueContact = !!form.phone.trim() && !!form.email.trim() && !!form.street.trim() && !!form.city.trim() && !!form.state.trim() && !!form.postal_code.trim()
  const canSubmitRegistration = isSoleProp
    ? canContinueBusiness && canContinueContact && !!form.first_name.trim() && !!form.last_name.trim() && !!form.mobile_phone.trim()
    : canContinueBusiness && canContinueContact

  async function handleRegister() {
    setLoading(true); setError('')
    try {
      const res = await fetch(`${(window as any).__API || 'https://vuriumbook-api-431945333485.us-central1.run.app'}/api/sms/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed')
      if (data.step === 'otp_sent') {
        // Sole proprietor — need OTP verification
        setOtpStep(true)
        setOtpBrandId(data.brand_id)
        onDone({ sms_registration_status: 'pending_otp', telnyx_brand_id: data.brand_id, sms_brand_name: form.display_name })
      } else {
        onDone({
          sms_registration_status: data.status || 'pending_approval',
          telnyx_brand_id: data.brand_id,
          telnyx_campaign_id: data.campaign_id,
          sms_from_number: data.phone_number,
          sms_brand_name: form.display_name,
        })
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // OTP verification step for Sole Proprietors
  async function handleVerifyOtp() {
    setLoading(true); setError('')
    try {
      const res = await fetch(`${(window as any).__API || 'https://vuriumbook-api-431945333485.us-central1.run.app'}/api/sms/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pin: otpPin }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Verification failed')
      onDone({
        sms_registration_status: data.status || 'active',
        telnyx_brand_id: data.brand_id,
        telnyx_campaign_id: data.campaign_id,
        sms_from_number: data.phone_number,
        sms_brand_name: form.display_name,
      })
    } catch (e: any) {
      setError(e.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  if (otpStep) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 4 }}>&#128241;</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,.6)' }}>Verify your identity</div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', lineHeight: 1.5 }}>
          We sent a 6-digit code to your mobile phone. Enter it below to complete registration.
        </p>
        {error && <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(220,80,80,.1)', border: '1px solid rgba(220,80,80,.2)', color: 'rgba(255,160,160,.9)', fontSize: 12, width: '100%' }}>{error}</div>}
        <input
          type="text" inputMode="numeric" maxLength={6}
          value={otpPin} onChange={e => setOtpPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          style={{ ...inp, textAlign: 'center', fontSize: 24, fontWeight: 700, letterSpacing: '.3em', maxWidth: 200 }}
        />
        <button onClick={handleVerifyOtp} disabled={otpPin.length !== 6 || loading} style={{
          height: 38, borderRadius: 999, border: 'none', background: 'rgba(130,150,220,.2)',
          color: 'rgba(130,150,220,.9)', cursor: loading ? 'wait' : 'pointer', fontWeight: 700,
          fontSize: 13, fontFamily: 'inherit', opacity: (otpPin.length !== 6 || loading) ? 0.5 : 1, width: '100%', maxWidth: 200,
        }}>
          {loading ? 'Verifying…' : 'Verify & Activate'}
        </button>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,.15)', marginTop: 4 }}>Code expires in 24 hours</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginBottom: 4, lineHeight: 1.5 }}>
        Set up a dedicated SMS number for appointment confirmations, reminders, reschedules, and cancellations. We&apos;ll guide you step by step.
      </p>

      {error && <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(220,80,80,.1)', border: '1px solid rgba(220,80,80,.2)', color: 'rgba(255,160,160,.9)', fontSize: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
        {steps.map((stepLabel, index) => {
          const isDone = index < wizardStep
          const isActive = index === wizardStep
          return (
            <div key={stepLabel} style={{
              padding: '6px 10px',
              borderRadius: 999,
              border: `1px solid ${isActive ? 'rgba(130,150,220,.25)' : isDone ? 'rgba(130,220,170,.2)' : 'rgba(255,255,255,.08)'}`,
              background: isActive ? 'rgba(130,150,220,.08)' : isDone ? 'rgba(130,220,170,.06)' : 'rgba(255,255,255,.03)',
              color: isActive ? 'rgba(195,205,255,.92)' : isDone ? 'rgba(130,220,170,.82)' : 'rgba(255,255,255,.35)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '.02em',
            }}>
              {index + 1}. {stepLabel}
            </div>
          )
        })}
      </div>

      <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(0,0,0,.12)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.68)', marginBottom: 6 }}>{steps[wizardStep]}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.28)', lineHeight: 1.5 }}>
          {wizardStep === 0 && 'Tell carriers which business is sending these appointment messages and how that business should appear to clients.'}
          {wizardStep === 1 && 'Add the business contact details carriers use to verify the sender and match it to your booking page.'}
          {wizardStep === 2 && 'Because this is a sole proprietor registration, Telnyx needs the owner details and OTP phone number before activation.'}
        </div>
      </div>

      {wizardStep === 0 && (
        <>
          <div className="set-sms-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label style={lbl}>Legal Business Name *</label><input style={inp} value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Element Barbershop Co" /></div>
            <div><label style={lbl}>Display Name (DBA)</label><input style={inp} value={form.display_name} onChange={e => set('display_name', e.target.value)} placeholder="Element Barbershop" /></div>
          </div>

          <div className="set-sms-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={lbl}>Entity Type *</label>
              <select style={inp} value={form.entity_type} onChange={e => set('entity_type', e.target.value)}>
                <option value="PRIVATE_PROFIT">Private Company</option>
                <option value="SOLE_PROPRIETOR">Sole Proprietor</option>
                <option value="PUBLIC_PROFIT">Public Company</option>
                <option value="NON_PROFIT">Non-Profit</option>
                <option value="GOVERNMENT">Government</option>
              </select>
            </div>
            <div><label style={lbl}>EIN / Tax ID {form.entity_type === 'SOLE_PROPRIETOR' ? '(optional)' : '*'}</label><input style={inp} value={form.ein} onChange={e => set('ein', e.target.value)} placeholder="XX-XXXXXXX" /></div>
          </div>

          <div className="set-sms-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={lbl}>Industry *</label>
              <select style={inp} value={form.vertical} onChange={e => set('vertical', e.target.value)}>
                <option value="PROFESSIONAL">Professional Services</option>
                <option value="RETAIL">Retail</option>
                <option value="HEALTHCARE">Healthcare</option>
                <option value="HOSPITALITY">Hospitality</option>
                <option value="ENTERTAINMENT">Entertainment</option>
                <option value="EDUCATION">Education</option>
                <option value="REAL_ESTATE">Real Estate</option>
                <option value="TECHNOLOGY">Technology</option>
              </select>
            </div>
            <div><label style={lbl}>Website</label><input style={inp} value={form.website} onChange={e => set('website', e.target.value)} /></div>
          </div>

          <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(130,150,220,.12)', background: 'rgba(130,150,220,.04)', fontSize: 11, color: 'rgba(195,205,255,.72)', lineHeight: 1.55 }}>
            Use the real legal sender name carriers should approve. If you operate under a shorter public name, add that as the display name clients recognize.
          </div>
        </>
      )}

      {wizardStep === 1 && (
        <>
          <div className="set-sms-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label style={lbl}>Business Phone *</label><input style={inp} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 (555) 123-4567" /></div>
            <div><label style={lbl}>Business Email *</label><input style={inp} value={form.email} onChange={e => set('email', e.target.value)} placeholder="info@business.com" /></div>
          </div>

          <div><label style={lbl}>Street Address *</label><input style={inp} value={form.street} onChange={e => set('street', e.target.value)} placeholder="123 Main St" /></div>

          <div className="set-sms-city-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
            <div><label style={lbl}>City *</label><input style={inp} value={form.city} onChange={e => set('city', e.target.value)} /></div>
            <div><label style={lbl}>State *</label><input style={inp} value={form.state} onChange={e => set('state', e.target.value)} placeholder="IL" maxLength={2} /></div>
            <div><label style={lbl}>ZIP *</label><input style={inp} value={form.postal_code} onChange={e => set('postal_code', e.target.value)} placeholder="60089" /></div>
          </div>

          <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.03)', fontSize: 11, color: 'rgba(255,255,255,.28)', lineHeight: 1.55 }}>
            Match the public booking page and business records as closely as possible here. The website is prefilled with your booking URL so carrier reviewers can verify the opt-in flow.
          </div>
        </>
      )}

      {wizardStep === 2 && isSoleProp && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,180,80,.5)', letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 2 }}>Owner Verification (Sole Proprietor)</div>
          <div className="set-sms-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label style={lbl}>First Name *</label><input style={inp} value={form.first_name} onChange={e => set('first_name', e.target.value)} /></div>
            <div><label style={lbl}>Last Name *</label><input style={inp} value={form.last_name} onChange={e => set('last_name', e.target.value)} /></div>
          </div>
          <div className="set-sms-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label style={lbl}>Date of Birth</label><input type="date" style={inp} value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} /></div>
            <div><label style={lbl}>Mobile Phone (for OTP) *</label><input style={inp} value={form.mobile_phone} onChange={e => set('mobile_phone', e.target.value)} placeholder="+1 (555) 987-6543" /></div>
          </div>
          <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,180,80,.15)', background: 'rgba(255,180,80,.05)', fontSize: 11, color: 'rgba(255,190,120,.7)', lineHeight: 1.55 }}>
            Telnyx will text a one-time code to the owner phone above. After you verify that code, the campaign can move into carrier review.
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {wizardStep > 0 && (
          <button onClick={() => setWizardStep(prev => Math.max(0, prev - 1))} disabled={loading} style={{
            height: 40, borderRadius: 999, border: '1px solid rgba(255,255,255,.1)',
            background: 'transparent', color: 'rgba(255,255,255,.5)',
            cursor: loading ? 'wait' : 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
            opacity: loading ? 0.5 : 1, padding: '0 16px',
          }}>
            Back
          </button>
        )}
        {wizardStep < steps.length - 1 ? (
          <button
            onClick={() => setWizardStep(prev => Math.min(steps.length - 1, prev + 1))}
            disabled={loading || (wizardStep === 0 ? !canContinueBusiness : !canContinueContact)}
            style={{
              marginTop: 0, height: 40, borderRadius: 999, border: 'none',
              background: 'rgba(130,150,220,.2)', color: 'rgba(130,150,220,.9)',
              cursor: loading ? 'wait' : 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
              opacity: (loading || (wizardStep === 0 ? !canContinueBusiness : !canContinueContact)) ? 0.5 : 1,
              width: wizardStep > 0 ? 'auto' : '100%',
              flex: 1,
            }}
          >
            Continue
          </button>
        ) : (
          <button onClick={handleRegister} disabled={loading || !canSubmitRegistration} style={{
            marginTop: 0, height: 40, borderRadius: 999, border: 'none',
            background: 'rgba(130,150,220,.2)', color: 'rgba(130,150,220,.9)',
            cursor: loading ? 'wait' : 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
            opacity: (loading || !canSubmitRegistration) ? 0.5 : 1, width: '100%', flex: 1,
          }}>
            {loading ? 'Registering…' : isSoleProp ? 'Submit & Send OTP' : 'Register for SMS'}
          </button>
        )}
      </div>

      <p style={{ fontSize: 10, color: 'rgba(255,255,255,.15)', lineHeight: 1.5, marginTop: 4 }}>
        Registration costs: ~$4.50 brand fee + $15 campaign review + ~$1.50/mo for number. Approval takes 5-10 business days.
      </p>
    </div>
  )
}

// ─── Users Tab — Clean VuriumBook style ──────────────────────────────────────
function UsersTab() {
  const { showAlert, showConfirm, showError } = useDialog()
  const { effective_plan } = usePlan()
  const canAddMembers = effective_plan === 'salon' || effective_plan === 'custom'
  const [users, setUsers] = useState<UserAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin'|'barber'|'guest'>('barber')
  const [barberId, setBarberId] = useState('')
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [creating, setCreating] = useState(false)
  const [resetPasswordUserId, setResetPasswordUserId] = useState('')
  const [resetPasswordValue, setResetPasswordValue] = useState('')
  const [resetPasswordError, setResetPasswordError] = useState('')
  const [resetPasswordSaving, setResetPasswordSaving] = useState(false)
  const [deleteOwnerOpen, setDeleteOwnerOpen] = useState(false)
  const [deleteOwnerText, setDeleteOwnerText] = useState('')
  const [deleteOwnerPassword, setDeleteOwnerPassword] = useState('')
  const [deleteOwnerError, setDeleteOwnerError] = useState('')
  const [deleteOwnerSaving, setDeleteOwnerSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ud, bd] = await Promise.all([apiFetch('/api/users'), apiFetch('/api/barbers')])
      setUsers(Array.isArray(ud) ? ud : ud?.users || [])
      setBarbers(Array.isArray(bd) ? bd : bd?.barbers || [])
    }
    catch (e: any) { setMsg('Error: ' + e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createUser() {
    if (!name.trim() || !email.trim() || !password) { setMsg('All fields required'); return }
    if (password.length < 8) { setMsg('Password min 8 characters with letter + number'); return }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) { setMsg('Password must contain a letter and a number'); return }
    setCreating(true); setMsg('')
    try {
      await apiFetch('/api/users', { method: 'POST', body: JSON.stringify({ name: name.trim(), username: email.trim().toLowerCase(), email: email.trim().toLowerCase(), password, role, ...(role === 'barber' && barberId ? { barber_id: barberId } : {}) }) })
      setName(''); setEmail(''); setPassword(''); setBarberId(''); setShowForm(false)
      setMsg('Team member added'); load()
    } catch (e: any) { setMsg('Error: ' + e.message) }
    setCreating(false)
  }

  async function submitResetPw() {
    if (!resetPasswordUserId) return
    if (resetPasswordValue.length < 8) { setResetPasswordError('Password must be at least 8 characters'); return }
    if (!/[a-zA-Z]/.test(resetPasswordValue) || !/[0-9]/.test(resetPasswordValue)) {
      setResetPasswordError('Password must contain at least one letter and one number')
      return
    }
    setResetPasswordSaving(true)
    setResetPasswordError('')
    try {
      await apiFetch(`/api/users/${encodeURIComponent(resetPasswordUserId)}`, { method: 'PATCH', body: JSON.stringify({ password: resetPasswordValue }) })
      setMsg('Password reset')
      setResetPasswordUserId('')
      setResetPasswordValue('')
      load()
    } catch (e: any) {
      setResetPasswordError(e.message || 'Failed to reset password')
    } finally {
      setResetPasswordSaving(false)
    }
  }

  async function toggleActive(uid: string, active: boolean) {
    try { await apiFetch(`/api/users/${encodeURIComponent(uid)}`, { method: 'PATCH', body: JSON.stringify({ active }) }); load() }
    catch (e: any) { await showError(e.message) }
  }

  async function deleteUser(uid: string, uname: string) {
    const ok = await showConfirm(
      `Permanently delete "${uname}"?\n\nThis removes the account and all access. This action cannot be undone.`,
      'Delete Team Member'
    )
    if (!ok) return
    try { await apiFetch(`/api/users/${encodeURIComponent(uid)}?hard=true`, { method: 'DELETE' }); load() }
    catch (e: any) { await showError(e?.message || 'Failed') }
  }

  async function deleteOwnerAccount() {
    setDeleteOwnerText('')
    setDeleteOwnerPassword('')
    setDeleteOwnerError('')
    setDeleteOwnerOpen(true)
  }

  async function submitDeleteOwnerAccount() {
    if (deleteOwnerText !== 'DELETE') {
      setDeleteOwnerError('Type DELETE exactly to continue')
      return
    }
    if (!deleteOwnerPassword) {
      setDeleteOwnerError('Enter your password to confirm')
      return
    }
    setDeleteOwnerSaving(true)
    setDeleteOwnerError('')
    try {
      const r = await apiFetch('/api/auth/delete-account', { method: 'DELETE', body: JSON.stringify({ password: deleteOwnerPassword }) })
      if (r?.ok) {
        localStorage.removeItem('VURIUMBOOK_TOKEN')
        localStorage.removeItem('VURIUMBOOK_USER')
        window.location.href = '/signin'
      } else {
        setDeleteOwnerError(r?.error || 'Error deleting account')
      }
    } catch (e: any) {
      setDeleteOwnerError(e?.message || 'Error deleting account')
    } finally {
      setDeleteOwnerSaving(false)
    }
  }

  const initials = (n: string) => (n || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const resetPasswordUser = resetPasswordUserId ? users.find(u => u.id === resetPasswordUserId) || null : null
  const sortedUsers = [...users].sort((a, b) => {
    const order = (r: string) => r === 'owner' ? 0 : r === 'admin' ? 1 : 2
    const d = order(a.role) - order(b.role)
    if (d !== 0) return d
    return (a.name || a.username || '').localeCompare(b.name || b.username || '')
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header + Add button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>{users.length} team member{users.length !== 1 ? 's' : ''}</div>
        {canAddMembers ? (
          <button onClick={() => setShowForm(!showForm)} style={{
            padding: '8px 18px', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
            background: showForm ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.06)',
            border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.7)',
          }}>{showForm ? 'Cancel' : '+ Add member'}</button>
        ) : (
          <a href="/billing" style={{ padding: '8px 18px', borderRadius: 10, fontSize: 12, textDecoration: 'none', border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', color: 'rgba(255,255,255,.4)' }}>Upgrade to add team</a>
        )}
      </div>

      {msg && <div style={{ fontSize: 12, padding: '8px 14px', borderRadius: 10, color: msg.includes('Error') ? 'rgba(255,160,160,.8)' : 'rgba(130,220,170,.7)', background: msg.includes('Error') ? 'rgba(220,80,80,.06)' : 'rgba(130,220,170,.06)', border: `1px solid ${msg.includes('Error') ? 'rgba(220,80,80,.12)' : 'rgba(130,220,170,.12)'}` }}>{msg}</div>}

      {/* Create form */}
      {showForm && (
        <div style={{ padding: 20, borderRadius: 16, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.02)' }}>
          <div className="set-create-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <Field label="Full name"><input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" style={inp} /></Field>
            <Field label="Email (login)"><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@business.com" style={inp} /></Field>
            <Field label="Password"><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 chars, letter + number" style={inp} /></Field>
            <Field label="Role">
              <select value={role} onChange={e => { setRole(e.target.value as any); if (e.target.value !== 'barber') setBarberId('') }} style={inp}>
                <option value="admin">Admin — manage everything</option>
                <option value="barber">Team member — own bookings</option>
                <option value="guest">Guest — calendar & clients only</option>
              </select>
            </Field>
            {role === 'barber' && barbers.length > 0 && (
              <Field label="Link to master profile">
                <select value={barberId} onChange={e => setBarberId(e.target.value)} style={inp}>
                  <option value="">— No master profile —</option>
                  {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
            )}
          </div>
          <button onClick={createUser} disabled={creating} style={{
            marginTop: 14, width: '100%', padding: '12px', borderRadius: 12, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
            background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', color: '#fff', fontWeight: 600,
            opacity: creating ? 0.5 : 1,
          }}>{creating ? 'Adding…' : 'Add to team'}</button>
        </div>
      )}

      {/* Team list */}
      {loading ? <div style={{ color: 'rgba(255,255,255,.25)', fontSize: 13, padding: 20, textAlign: 'center' }}>Loading team members…</div> :
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sortedUsers.map(u => (
            <div key={u.id} style={{
              padding: '14px 16px', borderRadius: 16,
              border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.02)',
              opacity: u.active ? 1 : 0.45, transition: 'opacity .2s',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              {/* Top row: Avatar + Info + Role badge */}
              <div className="set-user-card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.5)', flexShrink: 0 }}>
                  {initials(u.name || u.username)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e8ed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.name || u.username}
                    </span>
                    {!u.active && <span style={{ fontSize: 9, color: 'rgba(255,100,100,.6)', flexShrink: 0 }}>inactive</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.username}
                  </div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 500, letterSpacing: '.04em', padding: '4px 10px', borderRadius: 999,
                  background: u.role === 'owner' ? 'rgba(220,190,100,.08)' : u.role === 'admin' ? 'rgba(130,220,170,.06)' : 'rgba(255,255,255,.04)',
                  border: `1px solid ${u.role === 'owner' ? 'rgba(220,190,100,.15)' : u.role === 'admin' ? 'rgba(130,220,170,.12)' : 'rgba(255,255,255,.08)'}`,
                  color: u.role === 'owner' ? 'rgba(220,190,100,.7)' : u.role === 'admin' ? 'rgba(130,220,170,.6)' : 'rgba(255,255,255,.4)',
                  textTransform: 'capitalize', flexShrink: 0, whiteSpace: 'nowrap',
                }}>{u.role === 'barber' ? 'Team' : u.role}</span>
              </div>
              {/* Master link (if barber) */}
              {u.barber_id && barbers.find(b => b.id === u.barber_id) && (
                <div style={{ fontSize: 11, color: 'rgba(130,150,220,.6)', paddingLeft: 52 }}>
                  Linked to {barbers.find(b => b.id === u.barber_id)!.name}
                </div>
              )}
              {/* Bottom row: Master select + Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingLeft: 52 }}>
                {u.role === 'barber' && barbers.length > 0 && (
                  <select value={u.barber_id || ''} onChange={async (e) => {
                    const val = e.target.value || null
                    try {
                      await apiFetch(`/api/users/${encodeURIComponent(u.id)}`, { method: 'PATCH', body: JSON.stringify({ barber_id: val }) })
                      load()
                    } catch (err: any) { await showError(err.message) }
                  }} style={{ ...inpSm, width: 'auto', minWidth: 100, maxWidth: '100%', flex: '0 1 auto' }}>
                    <option value="">No master</option>
                    {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                )}
                <div className="set-user-actions" style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
                  <SmBtn onClick={() => {
                    setResetPasswordUserId(u.id)
                    setResetPasswordValue('')
                    setResetPasswordError('')
                  }}>Reset PW</SmBtn>
                  {u.role !== 'owner' && <SmBtn danger onClick={() => toggleActive(u.id, !u.active)}>{u.active ? 'Disable' : 'Enable'}</SmBtn>}
                  {u.role !== 'owner' && <SmBtn danger onClick={() => deleteUser(u.id, u.name || u.username)}>Remove</SmBtn>}
                  {u.role === 'owner' && <SmBtn danger onClick={deleteOwnerAccount}>Delete Account</SmBtn>}
                </div>
              </div>
            </div>
          ))}
        </div>
      }

      {/* ── CHANGE PASSWORD ── */}
      <div style={{ marginTop: 12, padding: '14px 16px', borderRadius: 16, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.02)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e8e8ed', marginBottom: 10 }}>Change Password</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input type="password" placeholder="Current password" id="pw-current" style={{ height: 38, borderRadius: 10, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(0,0,0,.22)', color: '#fff', padding: '0 12px', outline: 'none', fontSize: 12, fontFamily: 'inherit' }} />
          <input type="password" placeholder="Min 8 chars, letter + number" id="pw-new" style={{ height: 38, borderRadius: 10, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(0,0,0,.22)', color: '#fff', padding: '0 12px', outline: 'none', fontSize: 12, fontFamily: 'inherit' }} />
          <button onClick={async () => {
            const curr = (document.getElementById('pw-current') as HTMLInputElement)?.value
            const newp = (document.getElementById('pw-new') as HTMLInputElement)?.value
            if (!curr || !newp) return
            if (newp.length < 8) { await showAlert('Password must be at least 8 characters', 'Change Password'); return }
            if (!/[a-zA-Z]/.test(newp) || !/[0-9]/.test(newp)) { await showAlert('Password must contain at least one letter and one number', 'Change Password'); return }
            try {
              const r = await apiFetch('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password: curr, new_password: newp }) })
              if (r?.ok) {
                await showAlert('Password updated', 'Change Password')
                ;(document.getElementById('pw-current') as HTMLInputElement).value = ''
                ;(document.getElementById('pw-new') as HTMLInputElement).value = ''
              } else {
                await showError(r?.error || 'Error')
              }
            } catch {
              await showError('Error changing password')
            }
          }}
            style={{ height: 34, borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.6)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Update password
          </button>
        </div>
      </div>

      {/* ── QUICK PIN ── */}
      <div style={{ marginTop: 12, padding: '14px 16px', borderRadius: 16, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e8e8ed' }}>Quick PIN</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>{hasPinSetup() ? 'PIN is set up for fast login' : 'No PIN set — login with password each time'}</div>
          </div>
          {hasPinSetup() && (
            <button onClick={() => { clearPin() }}
              style={{ height: 32, padding: '0 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.5)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              Reset PIN
            </button>
          )}
        </div>
      </div>

      {/* ── DELETE ACCOUNT ── */}
      <div style={{ marginTop: 12, padding: '14px 16px', borderRadius: 16, border: '1px solid rgba(255,107,107,.12)', background: 'rgba(255,107,107,.03)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,107,107,.8)' }}>Delete Account</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', marginTop: 4, lineHeight: 1.5 }}>
              Permanently deletes your account, cancels your subscription, and removes <b>all team members you created</b> along with all bookings, clients, payments and business data. This cannot be undone.
            </div>
          </div>
          <button onClick={deleteOwnerAccount}
            style={{ height: 32, padding: '0 14px', borderRadius: 10, border: '1px solid rgba(255,107,107,.30)', background: 'rgba(255,107,107,.08)', color: 'rgba(255,107,107,.7)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            Delete Account
          </button>
        </div>
      </div>

      {resetPasswordUser && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget && !resetPasswordSaving) setResetPasswordUserId('') }}
          style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div style={{ width: 'min(420px, 92vw)', borderRadius: 22, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(10,10,20,.94)', boxShadow: '0 30px 80px rgba(0,0,0,.55)', padding: '24px 22px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(130,150,220,.55)', marginBottom: 10 }}>
              Team Password
            </div>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#e8e8ed', letterSpacing: '-.02em', marginBottom: 8 }}>
              Reset password
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', lineHeight: 1.6, marginBottom: 18 }}>
              Set a new password for {resetPasswordUser.name || resetPasswordUser.username}. It must be at least 8 characters and include a letter and a number.
            </p>
            <input
              type="password"
              autoFocus
              placeholder="New password"
              value={resetPasswordValue}
              onChange={e => setResetPasswordValue(e.target.value)}
              style={inp}
            />
            {resetPasswordError && (
              <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,107,107,.20)', background: 'rgba(255,107,107,.08)', color: 'rgba(255,180,180,.92)', fontSize: 12 }}>
                {resetPasswordError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button
                type="button"
                onClick={() => setResetPasswordUserId('')}
                disabled={resetPasswordSaving}
                style={{ flex: 1, height: 44, borderRadius: 999, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.55)', cursor: resetPasswordSaving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', opacity: resetPasswordSaving ? 0.5 : 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitResetPw}
                disabled={resetPasswordSaving}
                style={{ flex: 1, height: 44, borderRadius: 999, border: '1px solid rgba(130,150,220,.28)', background: 'rgba(130,150,220,.14)', color: 'rgba(210,220,255,.92)', cursor: resetPasswordSaving ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', opacity: resetPasswordSaving ? 0.6 : 1 }}
              >
                {resetPasswordSaving ? 'Saving…' : 'Update password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteOwnerOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget && !deleteOwnerSaving) setDeleteOwnerOpen(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div style={{ width: 'min(460px, 92vw)', borderRadius: 22, border: '1px solid rgba(255,107,107,.16)', background: 'rgba(18,10,14,.96)', boxShadow: '0 30px 90px rgba(0,0,0,.6)', padding: '24px 22px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,140,160,.55)', marginBottom: 10 }}>
              Delete Workspace
            </div>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#f6d7de', letterSpacing: '-.02em', marginBottom: 8 }}>
              Permanently delete everything
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', lineHeight: 1.7, marginBottom: 18 }}>
              This deletes your owner account, all team members, bookings, clients, payments, and business data. Your active subscription will also be cancelled. This cannot be undone.
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.40)', marginBottom: 6 }}>
              Type DELETE to confirm
            </div>
            <input
              type="text"
              autoFocus
              placeholder="DELETE"
              value={deleteOwnerText}
              onChange={e => setDeleteOwnerText(e.target.value)}
              style={inp}
            />
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.40)', marginTop: 14, marginBottom: 6 }}>
              Enter your password
            </div>
            <input
              type="password"
              placeholder="Current password"
              value={deleteOwnerPassword}
              onChange={e => setDeleteOwnerPassword(e.target.value)}
              style={inp}
            />
            {deleteOwnerError && (
              <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,107,107,.20)', background: 'rgba(255,107,107,.08)', color: 'rgba(255,180,180,.92)', fontSize: 12 }}>
                {deleteOwnerError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button
                type="button"
                onClick={() => setDeleteOwnerOpen(false)}
                disabled={deleteOwnerSaving}
                style={{ flex: 1, height: 44, borderRadius: 999, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.55)', cursor: deleteOwnerSaving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', opacity: deleteOwnerSaving ? 0.5 : 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitDeleteOwnerAccount}
                disabled={deleteOwnerSaving}
                style={{ flex: 1, height: 44, borderRadius: 999, border: '1px solid rgba(255,107,107,.28)', background: 'rgba(255,107,107,.14)', color: 'rgba(255,210,220,.94)', cursor: deleteOwnerSaving ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', opacity: deleteOwnerSaving ? 0.6 : 1 }}
              >
                {deleteOwnerSaving ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Billing Section ────────────────────────────────────────────────────────
function BillingSection() {
  const { showAlert, showConfirm, showError } = useDialog()
  const [billing, setBilling] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    apiFetch('/api/billing/status').then(setBilling).catch(() => {}).finally(() => setLoading(false))
  }, [])

  async function handleCancel() {
    const source = billing?.billing_source
    if (source === 'apple') {
      const ok = await showConfirm(
        'Your subscription was purchased through the Apple App Store.\n\nTo change or cancel it, you need to manage it in Apple Subscriptions. We\'ll open the Apple management page now.',
        'Manage Apple Subscription'
      )
      if (!ok) return
      setCancelling(true)
      try {
        const r: any = await apiFetch('/api/billing/cancel', { method: 'POST' })
        const updated = await apiFetch('/api/billing/status')
        setBilling(updated)
        const url = r?.manage_url || 'https://apps.apple.com/account/subscriptions'
        window.location.href = url
      } catch (e: any) { await showError(e.message || 'Failed to cancel') }
      setCancelling(false)
      return
    }
    const ok = await showConfirm(
      'Are you sure you want to cancel? You\'ll keep access until the end of your billing period.',
      'Cancel Subscription'
    )
    if (!ok) return
    setCancelling(true)
    try {
      await apiFetch('/api/billing/cancel', { method: 'POST' })
      const updated = await apiFetch('/api/billing/status')
      setBilling(updated)
      await showAlert('Your subscription will stay active until the current billing period ends.', 'Subscription Updated')
    } catch (e: any) { await showError(e.message || 'Failed to cancel') }
    setCancelling(false)
  }

  async function handlePortal() {
    setPortalLoading(true)
    try {
      const data = await apiFetch('/api/billing/portal', { method: 'POST' })
      if (data.url) window.location.href = data.url
    } catch (e: any) { await showError(e.message || 'Failed') }
    setPortalLoading(false)
  }

  const statusStyles: Record<string, { bg: string; color: string; label: string }> = {
    trialing: { bg: 'rgba(130,220,170,.1)', color: 'rgba(130,220,170,.8)', label: 'Free Trial' },
    active: { bg: 'rgba(130,150,220,.1)', color: 'rgba(130,150,220,.8)', label: 'Active' },
    past_due: { bg: 'rgba(220,170,100,.1)', color: 'rgba(220,170,100,.8)', label: 'Past Due' },
    canceled: { bg: 'rgba(220,130,160,.1)', color: 'rgba(220,130,160,.8)', label: 'Canceled' },
    cancelling: { bg: 'rgba(220,170,100,.1)', color: 'rgba(220,170,100,.8)', label: 'Cancelling' },
    inactive: { bg: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.4)', label: 'Inactive' },
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>Loading billing details…</div>

  const s = statusStyles[billing?.subscription_status] || statusStyles.inactive
  const hasStripeSub = !!billing?.stripe_subscription_id
  const hasManagedSubscription = !!billing?.billing_source
  const canCancel = hasManagedSubscription && billing?.subscription_status !== 'canceled' && billing?.subscription_status !== 'cancelling'
  const billingSource = billing?.billing_source || ''
  const isAppleManaged = billingSource === 'apple'
  const planLabel = billing?.plan
    ? String(billing.plan).charAt(0).toUpperCase() + String(billing.plan).slice(1)
    : (billing?.trial_active ? 'Trial Access' : 'Choose a Plan')
  const sourceSummary = isAppleManaged
    ? 'Managed through Apple App Store subscriptions.'
    : hasStripeSub
      ? 'Managed through VuriumBook billing on the web.'
      : billing?.trial_active
        ? 'Trial active. Choose how you want to continue before the trial ends.'
        : 'No paid subscription is connected yet. Open billing when you are ready to subscribe.'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Current plan */}
      <div style={{ padding: '18px 20px', borderRadius: 16, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.03)' }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.30)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>Current Plan</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: billing?.trial_active ? 8 : 0 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#e8e8ed' }}>{planLabel}</span>
          <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.32)', lineHeight: 1.55, marginBottom: billing?.trial_active ? 8 : 0 }}>
          {sourceSummary}
        </div>
        {billing?.trial_active && (
          <div style={{ fontSize: 12, color: 'rgba(130,220,170,.6)' }}>
            {billing.trial_days_left} days left in trial
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <a href="/billing" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: 12,
          background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.10)',
          color: 'rgba(255,255,255,.65)', fontSize: 13, fontWeight: 500, textDecoration: 'none',
        }}>
          Change Plan
        </a>

        {hasStripeSub && (
          <button onClick={handlePortal} disabled={portalLoading || cancelling} style={{
            height: 44, borderRadius: 12, fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: portalLoading || cancelling ? 'default' : 'pointer',
            background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', color: 'rgba(255,255,255,.50)',
            opacity: portalLoading || cancelling ? 0.55 : 1,
          }}>
            {portalLoading ? 'Opening billing…' : 'Manage Billing Details'}
          </button>
        )}

        {canCancel && (
          <button onClick={handleCancel} disabled={cancelling || portalLoading} style={{
            height: 44, borderRadius: 12, fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: cancelling || portalLoading ? 'default' : 'pointer',
            background: 'rgba(220,80,80,.04)', border: '1px solid rgba(220,80,80,.12)', color: 'rgba(220,130,130,.7)',
            opacity: cancelling || portalLoading ? 0.5 : 1,
          }}>
            {cancelling ? (isAppleManaged ? 'Opening Apple subscriptions…' : 'Cancelling subscription…') : (isAppleManaged ? 'Manage in Apple' : 'Cancel Subscription')}
          </button>
        )}

        {billing?.subscription_status === 'cancelling' && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(220,170,100,.06)', border: '1px solid rgba(220,170,100,.12)', fontSize: 12, color: 'rgba(220,170,100,.7)' }}>
            Your subscription will end at the end of the current billing period.
          </div>
        )}

        {billing?.subscription_status === 'canceled' && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(220,130,160,.06)', border: '1px solid rgba(220,130,160,.12)', fontSize: 12, color: 'rgba(220,130,160,.7)' }}>
            Subscription canceled. <a href="/billing" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Resubscribe →</a>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Permissions Tab ─────────────────────────────────────────────────────────
const PERM_SECTIONS: { category: PermCategory; label: string; items: { key: string; label: string }[] }[] = [
  { category: 'pages', label: 'Pages & Navigation', items: [
    { key: 'dashboard', label: 'Dashboard' }, { key: 'calendar', label: 'Calendar' },
    { key: 'history', label: 'History' }, { key: 'clients', label: 'Clients' },
    { key: 'messages', label: 'Messages' }, { key: 'waitlist', label: 'Waitlist' },
    { key: 'portfolio', label: 'Portfolio' }, { key: 'payments', label: 'Payments' },
    { key: 'attendance', label: 'Attendance' }, { key: 'cash', label: 'Cash Register' },
    { key: 'membership', label: 'Membership' }, { key: 'analytics', label: 'Analytics' },
  ]},
  { category: 'bookings', label: 'Bookings', items: [
    { key: 'create', label: 'Create bookings' }, { key: 'edit', label: 'Edit bookings' },
    { key: 'delete', label: 'Delete / cancel' }, { key: 'block_time', label: 'Block time slots' },
    { key: 'view_all', label: 'View all team members' },
  ]},
  { category: 'calendar_settings', label: 'Calendar Settings', items: [
    { key: 'open_settings', label: 'Open settings panel' },
    { key: 'manage_team', label: 'Add / edit team members' },
    { key: 'manage_services', label: 'Add / edit services' },
    { key: 'edit_schedule', label: 'Edit team schedules' },
    { key: 'edit_own_profile', label: 'Edit own profile' },
  ]},
  { category: 'clients', label: 'Clients', items: [
    { key: 'view', label: 'View clients' }, { key: 'add', label: 'Add clients' },
    { key: 'edit', label: 'Edit client info' }, { key: 'view_phone', label: 'View phone number' },
    { key: 'call_client', label: 'Call client (phone)' }, { key: 'message_client', label: 'Message client (SMS)' },
    { key: 'delete', label: 'Delete clients' }, { key: 'view_all', label: 'View all clients' },
  ]},
  { category: 'schedule', label: 'Schedule & Approvals', items: [
    { key: 'change_own', label: 'Change own schedule' }, { key: 'change_others', label: 'Change others\' schedule' },
    { key: 'needs_approval', label: 'Needs owner approval' },
  ]},
  { category: 'settings_access', label: 'Settings Access', items: [
    { key: 'general', label: 'General settings' },
    { key: 'booking', label: 'Booking settings' },
    { key: 'site_builder', label: 'Site Builder' },
    { key: 'fees_tax', label: 'Fees & Tax' },
    { key: 'integrations', label: 'Integrations' },
    { key: 'change_password', label: 'Change own password' },
    { key: 'view_pin', label: 'Quick PIN setup' },
  ]},
  { category: 'waitlist', label: 'Waitlist', items: [
    { key: 'view_ghost', label: 'See waitlist on calendar' }, { key: 'confirm', label: 'Confirm / book from waitlist' },
    { key: 'view_phone', label: 'View waitlist client phone' }, { key: 'call_client', label: 'Call waitlist client' },
  ]},
  { category: 'financial', label: 'Financial', items: [
    { key: 'mark_paid', label: 'Mark as paid' }, { key: 'checkout_client', label: 'Checkout / charge client' },
    { key: 'refund', label: 'Issue refund' }, { key: 'access_terminal', label: 'Access payment terminal' },
    { key: 'pay_cash', label: 'Accept cash payments' }, { key: 'pay_zelle', label: 'Accept Zelle payments' },
    { key: 'pay_other', label: 'Accept other payments' },
    { key: 'view_earnings', label: 'View own earnings' }, { key: 'view_all_earnings', label: 'View all earnings' },
  ]},
]

const ROLES = [
  { id: 'admin', label: 'Admin', color: 'rgba(130,220,170,.6)' },
  { id: 'barber', label: 'Team Member', color: 'rgba(130,150,220,.6)' },
  { id: 'guest', label: 'Guest', color: 'rgba(220,190,130,.6)' },
] as const

type SettingsTabId = 'shop' | 'site' | 'fees' | 'booking' | 'payroll' | 'square' | 'users' | 'permissions' | 'billing'

const SETTINGS_NAV_GROUPS: {
  id: string
  label: string
  items: { id: SettingsTabId; label: string; description: string; ownerOnly?: boolean }[]
}[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      { id: 'shop', label: 'Business Profile', description: 'Brand, contact info, timezone, and daily operations' },
      { id: 'booking', label: 'Client Booking', description: 'Online booking rules, reminders, waitlist, and reviews' },
      { id: 'site', label: 'Booking Site', description: 'Public URL, page design, content, and sections' },
    ],
  },
  {
    id: 'finance',
    label: 'Payments & Finance',
    items: [
      { id: 'fees', label: 'Taxes & Fees', description: 'Sales tax, surcharges, and custom line items', ownerOnly: true },
      { id: 'square', label: 'Payments & Integrations', description: 'Square terminal, Stripe Connect, and payout setup' },
      { id: 'payroll', label: 'Payroll Defaults', description: 'Commissions, tips, and pay periods', ownerOnly: true },
      { id: 'billing', label: 'Subscription', description: 'Plan status, billing source, and cancellation', ownerOnly: true },
    ],
  },
  {
    id: 'team',
    label: 'Team & Access',
    items: [
      { id: 'users', label: 'Team Accounts', description: 'Logins, passwords, owner controls, and account lifecycle', ownerOnly: true },
      { id: 'permissions', label: 'Roles & Permissions', description: 'What admins, team members, and guests can access', ownerOnly: true },
    ],
  },
]

const SETTINGS_URL_TABS: SettingsTabId[] = ['shop', 'site', 'fees', 'booking', 'payroll', 'square', 'users', 'permissions', 'billing']

const TAB_PERM_MAP: Record<string, string> = {
  shop: 'general',
  booking: 'booking',
  site: 'site_builder',
  fees: 'fees_tax',
  square: 'integrations',
}

function normalizeColorValue(value?: string) {
  const color = String(value || '').trim()
  if (/^#[0-9a-f]{6}$/i.test(color)) return color
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
  }
  return '#8296dc'
}

function PermissionsTab({ compact = false }: { compact?: boolean }) {
  const { showConfirm } = useDialog()
  const [perms, setPerms] = useState<Record<string, RolePerms>>(DEFAULT_PERMS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    apiFetch('/api/settings/permissions')
      .then((d: any) => {
        if (d?.role_permissions) {
          const merged: Record<string, RolePerms> = {}
          let needsMigration = false
          for (const role of Object.keys(DEFAULT_PERMS)) {
            const saved = d.role_permissions[role] || {}
            // Check if any categories are missing (need migration)
            if (!saved.settings_access || !saved.calendar_settings) needsMigration = true
            merged[role] = {
              pages: { ...DEFAULT_PERMS[role].pages, ...(saved.pages || {}) },
              bookings: { ...DEFAULT_PERMS[role].bookings, ...(saved.bookings || {}) },
              calendar_settings: { ...DEFAULT_PERMS[role].calendar_settings, ...(saved.calendar_settings || {}) },
              clients: { ...DEFAULT_PERMS[role].clients, ...(saved.clients || {}) },
              schedule: { ...DEFAULT_PERMS[role].schedule, ...(saved.schedule || {}) },
              settings_access: { ...DEFAULT_PERMS[role].settings_access, ...(saved.settings_access || {}) },
              financial: { ...DEFAULT_PERMS[role].financial, ...(saved.financial || {}) },
              waitlist: { ...DEFAULT_PERMS[role].waitlist, ...(saved.waitlist || {}) },
            }
          }
          setPerms(merged)
          // Auto-save merged permissions if new categories were added
          if (needsMigration) {
            apiFetch('/api/settings/permissions', { method: 'POST', body: JSON.stringify({ role_permissions: merged }) }).catch(() => {})
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const latestPerms = useRef(perms)
  latestPerms.current = perms

  function toggle(role: string, category: PermCategory, key: string) {
    setPerms(prev => {
      const updated = { ...prev }
      updated[role] = { ...updated[role], [category]: { ...updated[role][category], [key]: !updated[role][category][key] } }
      return updated
    })
    // Auto-save with debounce — always saves latest state
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      setSaving(true)
      apiFetch('/api/settings/permissions', { method: 'POST', body: JSON.stringify({ role_permissions: latestPerms.current }) })
        .catch(() => {})
        .finally(() => setSaving(false))
    }, 800)
  }

  async function resetToDefaults() {
    const ok = await showConfirm('Reset all permissions to defaults?', 'Reset Permissions')
    if (!ok) return
    setPerms(DEFAULT_PERMS)
    setSaving(true)
    apiFetch('/api/settings/permissions', { method: 'POST', body: JSON.stringify({ role_permissions: DEFAULT_PERMS }) })
      .catch(() => {})
      .finally(() => setSaving(false))
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>Loading role permissions…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: compact ? 'stretch' : 'center', justifyContent: 'space-between', flexDirection: compact ? 'column' : 'row', gap: compact ? 12 : 0 }}>
        <div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)' }}>Configure what each role can see and do</div>
          {saving && <span style={{ fontSize: 10, color: 'rgba(130,220,170,.5)', marginTop: 4, display: 'block' }}>Saving permissions…</span>}
        </div>
        <button onClick={resetToDefaults} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', color: 'rgba(255,255,255,.35)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', alignSelf: compact ? 'stretch' : 'auto' }}>
          Reset to defaults
        </button>
      </div>

      {!compact && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3, 80px)', gap: 8, padding: '0 12px', position: 'sticky', top: 0, zIndex: 2, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(10px)', borderRadius: 10, paddingTop: 8, paddingBottom: 8 }}>
          <div />
          {ROLES.map(r => (
            <div key={r.id} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: r.color }}>{r.label}</div>
          ))}
        </div>
      )}

      {PERM_SECTIONS.map(section => (
        <div key={section.category} style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.02)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,.06)', background: 'rgba(0,0,0,.12)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)' }}>{section.label}</span>
          </div>
          {section.items.map((item, idx) => compact ? (
            <div key={item.key} style={{ padding: '12px 14px', borderBottom: idx < section.items.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.72)', marginBottom: 10 }}>{item.label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ROLES.map(r => {
                  const checked = !!perms[r.id]?.[section.category]?.[item.key]
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '9px 10px', borderRadius: 12, border: '1px solid rgba(255,255,255,.05)', background: 'rgba(255,255,255,.025)' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: r.color }}>{r.label}</span>
                      <button onClick={() => toggle(r.id, section.category, item.key)}
                        style={{
                          width: 38, height: 22, borderRadius: 999, border: 'none',
                          background: checked ? 'rgba(130,150,220,.35)' : 'rgba(255,255,255,.08)',
                          cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0,
                        }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: '50%',
                          background: checked ? '#fff' : 'rgba(255,255,255,.25)',
                          position: 'absolute', top: 3,
                          left: checked ? 19 : 3,
                          transition: 'left .2s, background .2s',
                        }} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div key={item.key} style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3, 80px)', gap: 8, alignItems: 'center', padding: '8px 16px', borderBottom: idx < section.items.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none' }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>{item.label}</span>
              {ROLES.map(r => {
                const checked = !!perms[r.id]?.[section.category]?.[item.key]
                return (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'center' }}>
                    <button onClick={() => toggle(r.id, section.category, item.key)}
                      style={{
                        width: 38, height: 22, borderRadius: 999, border: 'none',
                        background: checked ? 'rgba(130,150,220,.35)' : 'rgba(255,255,255,.08)',
                        cursor: 'pointer', position: 'relative', transition: 'background .2s',
                      }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: '50%',
                        background: checked ? '#fff' : 'rgba(255,255,255,.25)',
                        position: 'absolute', top: 3,
                        left: checked ? 19 : 3,
                        transition: 'left .2s, background .2s',
                      }} />
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Main Settings Page ───────────────────────────────────────────────────────
export default function SettingsPage() {
  const { showConfirm, showError } = useDialog()
  const { effective_plan: currentPlan } = usePlan()
  const canChangeDesign = currentPlan === 'salon' || currentPlan === 'custom'
  const [tab, setTab] = useState<SettingsTabId>('shop')
  const [mobileDetailTab, setMobileDetailTab] = useState<SettingsTabId | null>(null)
  const [isPhoneLayout, setIsPhoneLayout] = useState(false)
  const [settings, setSettings] = useState<any>({})
  const [fees, setFees] = useState<Fee[]>([])
  const [charges, setCharges] = useState<Charge[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [toast, setToast] = useState('')
  const [squareOAuth, setSquareOAuth] = useState<{ connected: boolean; merchant_id?: string; expires_at?: string; connected_at?: string }>({ connected: false })
  const [squareConnecting, setSquareConnecting] = useState(false)
  const [stripeConnect, setStripeConnect] = useState<{ connected: boolean; account_id?: string; connected_at?: string; charges_enabled?: boolean; payouts_enabled?: boolean }>({ connected: false })
  const [stripeConnecting, setStripeConnecting] = useState(false)
  const [squareDevices, setSquareDevices] = useState<any[]>([])
  const [squareLocations, setSquareLocations] = useState<any[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [loadingDevices, setLoadingDevices] = useState(false)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, limits] = await Promise.all([
        apiFetch('/api/settings'),
        apiFetch('/api/account/limits').catch(() => ({})),
      ])
      // Merge slug and site_config from workspace into settings
      const merged = { ...(s || {}), slug: limits?.slug || '', site_config: limits?.site_config || (s || {}).site_config || {} }
      setSettings(merged)
      setFees(Array.isArray(s?.fees) ? s.fees : [])
      setCharges(Array.isArray(s?.charges) ? s.charges : [])
      setDirty(false)
    } catch (e: any) { showToast('Error: ' + e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const syncViewport = () => {
      const mobile = window.innerWidth <= 768
      setIsPhoneLayout(mobile)
      if (!mobile) setMobileDetailTab(null)
    }
    syncViewport()
    window.addEventListener('resize', syncViewport)
    return () => window.removeEventListener('resize', syncViewport)
  }, [])

  const updateSettingsUrl = useCallback((nextTab: SettingsTabId) => {
    if (typeof window === 'undefined') return
    const nextUrl = new URL(window.location.href)
    nextUrl.searchParams.set('tab', nextTab)
    window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}`)
  }, [])

  const openTab = useCallback((nextTab: SettingsTabId) => {
    setTab(nextTab)
    updateSettingsUrl(nextTab)
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setMobileDetailTab(nextTab)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [updateSettingsUrl])

  const closeMobileDetail = useCallback(() => {
    setMobileDetailTab(null)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [])

  // Read tab from URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlTab = params.get('tab')
    if (urlTab && SETTINGS_URL_TABS.includes(urlTab as SettingsTabId)) {
      setTab(urlTab as SettingsTabId)
      if (window.innerWidth <= 768) setMobileDetailTab(urlTab as SettingsTabId)
    }
  }, [])

  // Load saved terminal device from settings
  useEffect(() => {
    if (settings?.square?.terminal_device_id) setSelectedDeviceId(settings.square.terminal_device_id)
    if (settings?.square?.location_id) setSelectedLocationId(settings.square.location_id)
  }, [settings])

  // Load Square & Stripe Connect status on mount
  useEffect(() => {
    apiFetch('/api/square/oauth/status').then(d => {
      setSquareOAuth(d)
      if (d?.connected) loadSquareDevices()
    }).catch(() => {})
    apiFetch('/api/stripe-connect/status').then(d => setStripeConnect(d)).catch(() => {})
    const params = new URLSearchParams(window.location.search)
    if (params.get('square') === 'connected') {
      setTab('square')
      if (window.innerWidth <= 768) setMobileDetailTab('square')
      showToast('Square connected successfully ✓')
      apiFetch('/api/square/oauth/status').then(d => setSquareOAuth(d)).catch(() => {})
      window.history.replaceState({}, '', '/settings?tab=square')
    } else if (params.get('square') === 'error') {
      setTab('square')
      if (window.innerWidth <= 768) setMobileDetailTab('square')
      const errMsg = params.get('msg') || 'unknown error'
      showToast('❌ Square connection failed: ' + errMsg)
      window.history.replaceState({}, '', '/settings?tab=square')
    }
    if (params.get('stripe') === 'connected') {
      showToast('Stripe connected successfully ✓')
      apiFetch('/api/stripe-connect/status').then(d => setStripeConnect(d)).catch(() => {})
      window.history.replaceState({}, '', '/settings?tab=square')
    } else if (params.get('stripe') === 'refresh') {
      showToast('Please complete Stripe onboarding')
      window.history.replaceState({}, '', '/settings?tab=square')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function set(key: string, val: any) { setSettings((s: any) => ({ ...s, [key]: val })); setDirty(true) }
  function setNested(parent: string, key: string, val: any) { setSettings((s: any) => ({ ...s, [parent]: { ...(s[parent] || {}), [key]: val } })); setDirty(true) }

  // Auto-save with 1.5s debounce
  useEffect(() => {
    if (!dirty) return
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    autoSaveRef.current = setTimeout(async () => {
      setSaving(true)
      try {
        await apiFetch('/api/settings', { method: 'POST', body: JSON.stringify({ ...settings, fees, charges }) })
        setDirty(false)
      } catch { showToast('Failed to save — check connection') }
      setSaving(false)
    }, 1500)
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current) }
  }, [dirty, settings, fees, charges])

  // Warn before closing tab with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  async function connectSquare() {
    setSquareConnecting(true)
    try {
      const r = await apiFetch('/api/square/oauth/url')
      if (r?.url) window.location.href = r.url
      else showToast('❌ Failed to get Square auth URL')
    } catch (e: any) { showToast('❌ ' + e.message) }
    setSquareConnecting(false)
  }

  async function disconnectSquare() {
    const ok = await showConfirm(
      'Disconnect Square? Payment terminal will stop working until reconnected.',
      'Disconnect Square'
    )
    if (!ok) return
    try {
      await apiFetch('/api/square/oauth/disconnect', { method: 'POST' })
      setSquareOAuth({ connected: false })
      showToast('Square disconnected')
    } catch (e: any) { showToast('❌ ' + e.message) }
  }

  async function loadSquareDevices() {
    setLoadingDevices(true)
    try {
      const [devRes, locRes] = await Promise.all([
        apiFetch('/api/payments/terminal/devices').catch(() => ({ devices: [] })),
        apiFetch('/api/square/locations').catch(() => ({ locations: [] })),
      ])
      setSquareDevices(devRes?.devices || [])
      setSquareLocations(locRes?.locations || [])
      if (!(devRes?.devices?.length)) showToast('⚠ No terminal devices found')
    } catch (e: any) { showToast('❌ ' + e.message) }
    setLoadingDevices(false)
  }

  async function saveSquareSetting(key: string, value: string) {
    try {
      const sq = { ...settings.square, [key]: value }
      await apiFetch('/api/settings', { method: 'POST', body: JSON.stringify({ ...settings, square: sq }) })
      showToast('Saved ✓')
    } catch (e: any) { showToast('❌ ' + e.message) }
  }

  async function saveTerminalDevice(deviceId: string) {
    setSelectedDeviceId(deviceId)
    await saveSquareSetting('terminal_device_id', deviceId)
  }

  async function saveLocation(locationId: string) {
    setSelectedLocationId(locationId)
    await saveSquareSetting('location_id', locationId)
  }

  const [userRole] = useState<string>(() => { try { return JSON.parse(localStorage.getItem('VURIUMBOOK_USER') || '{}').role || 'owner' } catch { return 'owner' } })
  const [geocoding, setGeocoding] = useState(false)

  const s = settings
  const tax = s.tax || {}
  const booking = s.booking || {}
  const display = s.display || {}
  const payroll = s.payroll || {}

  async function geocodeAddress() {
    const addr = s.shop_address
    if (!addr) { showToast('Enter a shop address first'); return }
    setGeocoding(true)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=1`, { headers: { 'User-Agent': 'VuriumBook/1.0' } })
      const data = await res.json()
      if (!data.length) { showToast('Address not found — try a more specific address'); setGeocoding(false); return }
      const lat = parseFloat(data[0].lat)
      const lng = parseFloat(data[0].lon)
      set('geofence_lat', lat)
      set('geofence_lng', lng)
      if (!s.geofence_radius_m) set('geofence_radius_m', 500)
      showToast(`Location set: ${lat.toFixed(5)}, ${lng.toFixed(5)}`)
    } catch { showToast('Geocoding failed — check internet connection') }
    setGeocoding(false)
  }

  const { hasPerm: settingsHasPerm } = usePermissions()
  const TABS = SETTINGS_NAV_GROUPS
    .flatMap(group => group.items)
    .filter(t => {
    // Owner sees everything
      if (userRole === 'owner') return true
    // These tabs are always owner-only (no permission toggle)
      if (t.id === 'users' || t.id === 'permissions' || t.id === 'billing' || t.id === 'payroll') return false
    // Check settings_access permission
      const permKey = TAB_PERM_MAP[t.id]
      if (permKey) return settingsHasPerm('settings_access', permKey)
      return false
    })
  const visibleTabIds = TABS.map(item => item.id)
  const visibleTabGroups = SETTINGS_NAV_GROUPS
    .map(group => ({ ...group, items: group.items.filter(item => visibleTabIds.includes(item.id)) }))
    .filter(group => group.items.length > 0)
  const hasVisibleSettings = TABS.length > 0
  const safeTab = visibleTabIds.includes(tab) ? tab : (visibleTabIds[0] || tab)
  const activeTab = mobileDetailTab || safeTab
  const currentTabMeta = TABS.find(item => item.id === activeTab) || TABS[0] || null
  const currentTabGroup = currentTabMeta ? visibleTabGroups.find(group => group.items.some(item => item.id === currentTabMeta.id)) : null

  useEffect(() => {
    if (!visibleTabIds.includes(tab) && visibleTabIds[0]) {
      setTab(visibleTabIds[0])
      updateSettingsUrl(visibleTabIds[0])
    }
    if (mobileDetailTab && !visibleTabIds.includes(mobileDetailTab)) {
      setMobileDetailTab(null)
    }
  }, [tab, visibleTabIds, mobileDetailTab, updateSettingsUrl])

  return (
    <Shell page="settings">
      <style>{`
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:3px}
        select option{background:#111}
        .settings-layout{display:grid;grid-template-columns:minmax(240px,280px) minmax(0,1fr);gap:18px;align-items:start;padding:18px 20px 24px;}
        .settings-sidebar{position:sticky;top:18px;display:flex;flex-direction:column;gap:14px}
        .settings-nav-grid{display:flex;flex-direction:column;gap:12px}
        .settings-nav-group{border-radius:18px;border:1px solid rgba(255,255,255,.06);background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.02));padding:14px}
        .settings-nav-item{width:100%;display:flex;flex-direction:column;gap:3px;padding:12px 14px;border-radius:14px;border:1px solid transparent;background:transparent;text-align:left;cursor:pointer;transition:all .2s;font-family:inherit}
        .settings-nav-item:hover{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.06)}
        .settings-content{min-width:0;border-radius:22px;border:1px solid rgba(255,255,255,.06);background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015));overflow:hidden}
        .settings-content-body{padding:20px}
        .settings-mobile-back{display:none}
        @media(max-width:1024px){
          .settings-layout{grid-template-columns:1fr}
          .settings-sidebar{position:static}
          .settings-nav-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
        }
        @media(max-width:768px){
          .page-topbar{padding-left:60px!important;}
          .page-topbar h2{font-size:13px!important;}
          .set-2col{grid-template-columns:1fr!important;}
          .set-sms-grid,.set-sms-city-grid{grid-template-columns:1fr!important;}
          .set-topbar{flex-wrap:wrap!important;gap:8px!important;}
          .set-topbar h2{font-size:13px!important;}
          .set-tax-row,.set-fee-row,.set-charge-row{grid-template-columns:repeat(2,minmax(0,1fr))!important;}
          .set-tax-wide,.set-fee-wide,.set-charge-wide{grid-column:1 / -1!important;}
          .set-tip-grid{grid-template-columns:1fr!important;}
          .set-fee-col3{display:none!important;}
          .set-fee-remove,.set-charge-remove{grid-column:1 / -1!important;width:100%!important;}
          .set-user-actions{flex-direction:column!important;align-items:stretch!important;gap:4px!important;}
          .set-user-actions button{width:100%!important;justify-content:center!important;}
          .set-user-card{flex-direction:column!important;align-items:stretch!important;gap:8px!important;}
          .set-create-grid{grid-template-columns:1fr!important;}
          .settings-layout{padding:14px 14px 24px}
          .settings-nav-grid{grid-template-columns:1fr}
          .settings-content-body{padding:16px}
          .settings-mobile-back{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);color:rgba(255,255,255,.72);font-size:12px;font-weight:600;font-family:inherit;cursor:pointer}
        }
        @media(max-width:560px){
          .set-tax-row,.set-fee-row,.set-charge-row{grid-template-columns:1fr!important;}
        }
      `}</style>
      <div style={{ minHeight: '100vh', background: 'transparent', color: '#e8e8ed', fontFamily: 'Inter,system-ui,sans-serif' }}>
        <div className="settings-layout">
          {(!isPhoneLayout || !mobileDetailTab) && (
          <aside className="settings-sidebar">
            <div style={{ borderRadius: 20, border: '1px solid rgba(255,255,255,.06)', background: 'linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02))', padding: '18px 18px 16px' }}>
              <div style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.38)', marginBottom: 8 }}>Settings</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#f3f4f6', letterSpacing: '-.03em', marginBottom: 8 }}>Professional control center</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', lineHeight: 1.6, marginBottom: 14 }}>
                {isPhoneLayout
                  ? 'Open a category to move into its own settings screen. No more hidden sections below the fold.'
                  : 'Everything is grouped by workspace, finance, and team access so the setup feels predictable and client-ready.'}
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,.08)', background: saving ? 'rgba(255,255,255,.05)' : dirty ? 'rgba(255,180,100,.08)' : 'rgba(130,220,170,.08)' }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: saving ? 'rgba(255,255,255,.45)' : dirty ? 'rgba(255,180,100,.75)' : 'rgba(130,220,170,.9)' }} />
                <span style={{ fontSize: 12, color: saving ? 'rgba(255,255,255,.58)' : dirty ? 'rgba(255,210,150,.92)' : 'rgba(170,240,195,.92)' }}>
                  {saving ? 'Saving changes…' : dirty ? 'Unsaved changes' : loading ? 'Loading settings…' : 'All changes saved'}
                </span>
              </div>
            </div>

            <div className="settings-nav-grid">
              {visibleTabGroups.length > 0 ? visibleTabGroups.map(group => (
                <div key={group.id} className="settings-nav-group">
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.34)', marginBottom: 10 }}>
                    {group.label}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {group.items.map(item => {
                      const active = item.id === safeTab
                      return (
                        <button
                          key={item.id}
                          className="settings-nav-item"
                          onClick={() => openTab(item.id)}
                          style={{
                            borderColor: active ? 'rgba(130,150,220,.22)' : 'transparent',
                            background: active ? 'rgba(130,150,220,.08)' : 'transparent',
                          }}
                        >
                          <span style={{ fontSize: 13, fontWeight: active ? 700 : 600, color: active ? '#e8e8ed' : 'rgba(255,255,255,.62)' }}>
                            {item.label}
                          </span>
                          <span style={{ fontSize: 11, color: active ? 'rgba(195,205,255,.72)' : 'rgba(255,255,255,.30)', lineHeight: 1.45 }}>
                            {item.description}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )) : (
                <div style={{ padding: '14px 16px', borderRadius: 16, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', fontSize: 12, color: 'rgba(255,255,255,.42)', lineHeight: 1.6 }}>
                  Your role does not currently have access to any settings categories in this workspace.
                </div>
              )}
            </div>
          </aside>
          )}

          {(!isPhoneLayout || !!mobileDetailTab || !hasVisibleSettings) && (
          <section className="settings-content">
            <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,.06)', background: 'rgba(0,0,0,.12)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                {isPhoneLayout && mobileDetailTab && (
                  <button className="settings-mobile-back" onClick={closeMobileDetail} style={{ marginBottom: 12 }}>
                    <span style={{ fontSize: 16, lineHeight: 1 }}>‹</span>
                    All Settings
                  </button>
                )}
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.32)', marginBottom: 8 }}>
                  {currentTabGroup?.label || 'Settings'}
                </div>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-.03em', color: '#eef2f7' }}>{currentTabMeta?.label || 'Workspace Settings'}</h2>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.42)', marginTop: 6, maxWidth: 560, lineHeight: 1.6 }}>
                  {currentTabMeta?.description || 'You do not currently have permission to edit settings in this workspace.'}
                </div>
              </div>
              <div style={{ padding: '10px 12px', borderRadius: 14, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', minWidth: 180 }}>
                <div style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.30)', marginBottom: 4 }}>Sync status</div>
                <div style={{ fontSize: 12, color: saving ? 'rgba(255,255,255,.6)' : dirty ? 'rgba(255,210,150,.95)' : 'rgba(170,240,195,.92)' }}>
                  {saving ? 'Changes are being saved automatically.' : dirty ? 'Waiting to sync your latest edits.' : 'Changes are synced to the workspace.'}
                </div>
              </div>
            </div>

            <div className="settings-content-body">
          {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.40)' }}>Loading settings…</div> : !hasVisibleSettings ? (
            <div style={{ maxWidth: 620, padding: '22px 24px', borderRadius: 20, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', color: 'rgba(255,255,255,.52)', lineHeight: 1.7 }}>
              You do not currently have access to edit settings in this workspace. Ask the owner to enable the appropriate role permissions if you need access.
            </div>
          ) : (<>

            {/* ── GENERAL ── */}
            {safeTab === 'shop' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760 }}>
                <SectionCard title="Brand & Contact">
                  <Field label="Shop name"><input value={s.shop_name || ''} onChange={e => set('shop_name', e.target.value)} placeholder="Your Business Name" style={inp} /></Field>
                  <Field label="Shop address">
                    <input value={s.shop_address || ''} onChange={e => set('shop_address', e.target.value)} placeholder="123 Main St, City, State ZIP" style={inp} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', marginTop: 4 }}>Shown in emails and used for employee clock-in location</div>
                  </Field>
                  <Field label="Shop email">
                    <input type="email" value={s.shop_email || ''} onChange={e => set('shop_email', e.target.value)} placeholder="hello@yourbusiness.com" style={inp} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', marginTop: 4 }}>Primary contact address for email receipts, support, and reminders</div>
                  </Field>
                  <Field label="Shop phone">
                    <input type="tel" value={s.shop_phone || ''} onChange={e => set('shop_phone', e.target.value)} placeholder="(555) 123-4567" style={inp} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', marginTop: 4 }}>Shown in emails so clients can contact you</div>
                  </Field>
                  <Field label="Logo">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {s.logo_url ? (
                        <img src={s.logo_url} alt="" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', border: '1px solid rgba(255,255,255,.08)' }} />
                      ) : (
                        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,.3)' }}>{(s.shop_name || 'V')[0]?.toUpperCase()}</div>
                      )}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                          {s.logo_url ? 'Change logo' : 'Upload logo'}
                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            if (file.size > 5 * 1024 * 1024) { showToast('Max 5MB'); return }
                            const dataUrl: string = await new Promise((resolve, reject) => {
                              const reader = new FileReader()
                              reader.onload = () => {
                                const img = new Image()
                                img.onload = () => {
                                  const MAX = 256
                                  let w = img.width, h = img.height
                                  if (w > MAX || h > MAX) { if (w > h) { h = Math.round(h * MAX / w); w = MAX } else { w = Math.round(w * MAX / h); h = MAX } }
                                  const canvas = document.createElement('canvas')
                                  canvas.width = w; canvas.height = h
                                  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
                                  resolve(canvas.toDataURL('image/png', 0.9))
                                }
                                img.onerror = reject
                                img.src = reader.result as string
                              }
                              reader.onerror = reject
                              reader.readAsDataURL(file)
                            })
                            set('logo_url', dataUrl)
                            e.target.value = ''
                          }} />
                        </label>
                        {s.logo_url && (
                          <button onClick={() => set('logo_url', '')} style={{ height: 28, borderRadius: 8, border: '1px solid rgba(255,107,107,.2)', background: 'rgba(255,107,107,.04)', color: 'rgba(255,107,107,.6)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', marginTop: 6 }}>Used in emails and booking page. Max 5MB.</div>
                  </Field>
                </SectionCard>

                <div className="set-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <SectionCard title="Regional Settings">
                    <Field label="Timezone">
                      <select value={s.timezone || 'America/Chicago'} onChange={e => set('timezone', e.target.value)} style={inp}>
                        {getTimezoneList().map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Currency">
                      <select value={s.currency || 'USD'} onChange={e => set('currency', e.target.value)} style={inp}>
                        <option value="USD">USD — US Dollar</option>
                        <option value="CAD">CAD — Canadian Dollar</option>
                        <option value="EUR">EUR — Euro</option>
                      </select>
                    </Field>
                    <Field label="Business Type">
                      <select value={s.business_type || ''} onChange={e => set('business_type', e.target.value)} style={inp}>
                        <option value="">Not set</option>
                        {['Barbershop', 'Hair Salon', 'Nail Studio', 'Beauty Salon', 'Spa & Wellness', 'Tattoo Studio', 'Lash & Brow Bar', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', marginTop: 4 }}>Affects staff terminology across the app, onboarding templates, and client-facing language</div>
                    </Field>
                  </SectionCard>

                  <SectionCard title="Workspace Operations">
                    <Toggle checked={s.online_booking_enabled !== false} onChange={v => set('online_booking_enabled', v)} label="Accept online bookings" sub="Turn the public booking flow on or off without changing your public page URL" />
                    <Toggle checked={!!s.clock_in_enabled} onChange={v => set('clock_in_enabled', v)} label="Enable clock-in / clock-out" sub="Show attendance tools on the dashboard for staff and admins" />
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', lineHeight: 1.6 }}>
                      Keep online booking on when you want clients to self-book. Turn it off temporarily if the team is fully booked or you only want manual confirmation.
                    </div>
                  </SectionCard>
                </div>

                {userRole === 'owner' && s.clock_in_enabled && (
                  <SectionCard title="Attendance Geofence">
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', lineHeight: 1.6 }}>
                      Geofence uses the business address above to decide whether team members are physically close enough to clock in.
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={geocodeAddress} disabled={geocoding || !s.shop_address} style={{ height: 36, padding: '0 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.06)', color: '#fff', cursor: geocoding || !s.shop_address ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'inherit', opacity: geocoding || !s.shop_address ? .5 : 1 }}>
                        {geocoding ? 'Finding location…' : 'Set location from address'}
                      </button>
                      {s.geofence_lat && s.geofence_lng && (
                        <span style={{ fontSize: 11, color: 'rgba(130,220,170,.6)' }}>
                          {Number(s.geofence_lat).toFixed(4)}, {Number(s.geofence_lng).toFixed(4)}
                        </span>
                      )}
                    </div>
                    <Field label="Allowed radius (meters)">
                      <input type="number" min={50} max={5000} step={50} value={s.geofence_radius_m || 500} onChange={e => set('geofence_radius_m', Number(e.target.value))} style={inp} />
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', marginTop: 4 }}>How far from the shop employees can be to clock in. Default is 500 meters.</div>
                    </Field>
                  </SectionCard>
                )}
              </div>
            )}

            {/* ── FEES ── */}
            {safeTab === 'fees' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <SectionCard title="Taxes & Fees"
                  action={<SmBtn onClick={() => { setFees(f => [...f, { id: 'fee_'+Date.now(), label: '', type: 'percent', value: 0, applies_to: 'all', enabled: true }]); setDirty(true) }}>+ Add</SmBtn>}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.40)', marginBottom: 6 }}>Add taxes, card surcharges, booking fees. Each can apply to specific payment methods.</div>

                  {/* Tax row */}
                  <div style={{ padding: '10px 12px', borderRadius: 12, border: `1px solid ${tax.enabled ? 'rgba(255,207,63,.20)' : 'rgba(255,255,255,.08)'}`, background: tax.enabled ? 'rgba(255,207,63,.04)' : 'rgba(0,0,0,.14)', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: tax.enabled ? 8 : 0 }}>
                      <Toggle checked={!!tax.enabled} onChange={v => setNested('tax','enabled',v)} label="Sales Tax" sub="" />
                    </div>
                    {tax.enabled && (
                      <div className="set-tax-row" style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 120px', gap: 8, alignItems: 'center' }}>
                        <input className="set-tax-wide" value={tax.label || ''} onChange={e => setNested('tax','label',e.target.value)} placeholder="Tax label" style={{...inpSm,width:'100%'}} />
                        <div style={{ position: 'relative' }}>
                          <input type="number" min={0} max={50} step={0.01} value={tax.rate || ''} onChange={e => setNested('tax','rate',Number(e.target.value))} placeholder="Rate" style={inpSm} />
                        </div>
                        <div className="set-fee-col3" style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>% rate</div>
                        <select className="set-tax-wide" value={tax.applies_to || 'all'} onChange={e => setNested('tax','applies_to',e.target.value)} style={inpSm}>
                          <option value="all">All payments</option>
                          <option value="terminal">Terminal only</option>
                          <option value="cash">Cash only</option>
                          <option value="zelle">Zelle only</option>
                          <option value="other">Other only</option>
                        </select>
                      </div>
                    )}
                    {tax.enabled && (
                      <div style={{ marginTop: 6 }}>
                        <Toggle checked={!!tax.included_in_price} onChange={v => setNested('tax','included_in_price',v)} label="Price includes tax" sub="" />
                      </div>
                    )}
                  </div>

                  {/* Fee rows */}
                  {fees.map((f, i) => (
                    <div key={f.id} className="set-fee-row" style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 120px 36px', gap: 8, alignItems: 'center', padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(0,0,0,.14)', marginBottom: 6 }}>
                      <input className="set-fee-wide" value={f.label} onChange={e => { const n=[...fees]; n[i]={...n[i],label:e.target.value}; setFees(n); setDirty(true) }} placeholder="e.g. Card surcharge" style={{...inpSm,width:'100%'}} />
                      <select value={f.type} onChange={e => { const n=[...fees]; n[i]={...n[i],type:e.target.value as any}; setFees(n); setDirty(true) }} style={inpSm}>
                        <option value="percent">%</option>
                        <option value="fixed">Fixed $</option>
                      </select>
                      <input type="number" min={0} step={0.01} value={f.value||''} onChange={e => { const n=[...fees]; n[i]={...n[i],value:Number(e.target.value)}; setFees(n); setDirty(true) }} placeholder="Value" style={inpSm} />
                      <select className="set-fee-wide" value={f.applies_to} onChange={e => { const n=[...fees]; n[i]={...n[i],applies_to:e.target.value}; setFees(n); setDirty(true) }} style={inpSm}>
                        <option value="all">All payments</option>
                        <option value="terminal">Terminal only</option>
                        <option value="cash">Cash only</option>
                        <option value="zelle">Zelle only</option>
                        <option value="other">Other only</option>
                      </select>
                      <button className="set-fee-remove" onClick={() => { setFees(fees.filter((_,j)=>j!==i)); setDirty(true) }} style={{ height: 34, width: 34, borderRadius: 10, border: '1px solid rgba(255,107,107,.35)', background: 'rgba(255,107,107,.08)', color: '#ff6b6b', cursor: 'pointer', fontSize: 15 }}>✕</button>
                    </div>
                  ))}

                  {fees.length === 0 && !tax.enabled && <div style={{ color: 'rgba(255,255,255,.30)', fontSize: 12, padding: '4px 0' }}>No taxes or fees — services charged at face value</div>}
                </SectionCard>

                <SectionCard title="Custom charges & categories"
                  action={<SmBtn onClick={() => { setCharges(c => [...c, { id: 'charge_'+Date.now(), name: '', type: 'percent', value: 0, color: '#8296dc', enabled: true }]); setDirty(true) }}>+ Add</SmBtn>}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.40)' }}>Promotions, membership discounts, product sales</div>
                  {charges.length === 0 ? <div style={{ color: 'rgba(255,255,255,.30)', fontSize: 12 }}>No custom charges</div> :
                    charges.map((c, i) => (
                      <div key={c.id} className="set-charge-row" style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 80px 36px', gap: 8, alignItems: 'center', padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(0,0,0,.14)' }}>
                        <input className="set-charge-wide" value={c.name} onChange={e => { const n=[...charges]; n[i]={...n[i],name:e.target.value}; setCharges(n); setDirty(true) }} placeholder="Name (e.g. Loyalty discount)" style={{...inpSm,width:'100%'}} />
                        <select value={c.type} onChange={e => { const n=[...charges]; n[i]={...n[i],type:e.target.value as any}; setCharges(n); setDirty(true) }} style={inpSm}>
                          <option value="percent">%</option>
                          <option value="fixed">Fixed $</option>
                          <option value="label">Label only</option>
                        </select>
                        <input type="number" min={0} step={0.01} value={c.value||''} disabled={c.type==='label'} onChange={e => { const n=[...charges]; n[i]={...n[i],value:Number(e.target.value)}; setCharges(n); setDirty(true) }} placeholder="Value" style={{...inpSm,opacity: c.type === 'label' ? 0.4 : 1}} />
                        <input type="color" value={normalizeColorValue(c.color)} onChange={e => { const n=[...charges]; n[i]={...n[i],color:e.target.value}; setCharges(n); setDirty(true) }} style={{ height: 34, width: '100%', borderRadius: 8, border: '1px solid rgba(255,255,255,.10)', background: 'none', cursor: 'pointer', padding: 2 }} />
                        <button className="set-charge-remove" onClick={() => { setCharges(charges.filter((_,j)=>j!==i)); setDirty(true) }} style={{ height: 34, width: 34, borderRadius: 10, border: '1px solid rgba(255,107,107,.35)', background: 'rgba(255,107,107,.08)', color: '#ff6b6b', cursor: 'pointer', fontSize: 15 }}>✕</button>
                      </div>
                    ))
                  }
                </SectionCard>
              </div>
            )}

            {/* ── BOOKING & SMS ── */}
            {safeTab === 'booking' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
                <SectionCard title="Booking Access & Client Flow">
                  <Toggle checked={s.online_booking_enabled !== false} onChange={v => set('online_booking_enabled', v)} label="Online booking enabled" sub="When off, clients can still view your page but new bookings are blocked" />
                  <Toggle checked={!!s.waitlist_enabled} onChange={v => set('waitlist_enabled', v)} label="Waitlist enabled" sub="Let clients join a waitlist when no slots are available" />
                  <Field label="Cancellation window (hours)">
                    <input type="number" min={0} max={72} value={booking.cancellation_hours ?? 2} onChange={e => setNested('booking','cancellation_hours',Number(e.target.value))} style={inp} />
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 4 }}>Applies to client self-service cancel and reschedule links</div>
                  </Field>
                  <Toggle checked={display.show_prices !== false} onChange={v => setNested('display','show_prices',v)} label="Show service prices" sub="Control whether prices appear on the public booking experience" />
                  <Toggle checked={!!display.require_phone} onChange={v => setNested('display','require_phone',v)} label="Require phone number" sub="Make phone mandatory before clients can confirm a booking" />
                  <Toggle checked={display.allow_notes !== false} onChange={v => setNested('display','allow_notes',v)} label="Allow notes & reference photos" sub="Let clients send notes and style references with their booking" />
                </SectionCard>

                <SectionCard title="SMS notifications">
                  <Toggle checked={booking.sms_confirm !== false} onChange={v => setNested('booking','sms_confirm',v)} label="Confirmation SMS" sub="Sent when booking is created" />
                  <Toggle checked={!!booking.reminder_hours_24} onChange={v => setNested('booking','reminder_hours_24',v)} label="24h reminder" sub="Day before appointment" />
                  <Toggle checked={!!booking.reminder_hours_2} onChange={v => setNested('booking','reminder_hours_2',v)} label="2h reminder" sub="2 hours before" />
                  <Toggle checked={!!booking.sms_on_reschedule} onChange={v => setNested('booking','sms_on_reschedule',v)} label="Reschedule notification" sub="When appointment time changes" />
                  <Toggle checked={!!booking.sms_on_cancel} onChange={v => setNested('booking','sms_on_cancel',v)} label="Cancellation notification" sub="When appointment is cancelled" />
                </SectionCard>

                <SectionCard title="Push notifications">
                  <Toggle checked={booking.push_confirm !== false} onChange={v => setNested('booking','push_confirm',v)} label="Booking confirmation" sub="Push to barber when appointment is booked" />
                  <Toggle checked={booking.push_reschedule !== false} onChange={v => setNested('booking','push_reschedule',v)} label="Reschedule push" sub="Push to barber when time changes" />
                  <Toggle checked={booking.push_cancel !== false} onChange={v => setNested('booking','push_cancel',v)} label="Cancellation push" sub="Push to barber when appointment cancelled" />
                  <Toggle checked={booking.push_waitlist !== false} onChange={v => setNested('booking','push_waitlist',v)} label="Waitlist push" sub="Push when spot opens up" />
                </SectionCard>

                <SectionCard title="Review follow-up">
                  <Toggle checked={s.satisfaction_sms_enabled !== false} onChange={v => set('satisfaction_sms_enabled', v)} label="Post-visit review requests" sub="Send follow-up messages that ask happy clients to leave a review" />
                  <Field label="Google review URL">
                    <input value={s.google_review_url || ''} onChange={e => set('google_review_url', e.target.value)} placeholder="https://g.page/r/.../review" style={inp} />
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 4 }}>Used in automated review follow-ups and reminder links</div>
                  </Field>
                </SectionCard>
              </div>
            )}

            {/* ── PAYROLL ── */}
            {safeTab === 'payroll' && (
              <div style={{ maxWidth: 600 }}>
                <SectionCard title="Payroll defaults">
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.40)' }}>Default rates for new team members. Override per-member in Payroll → Commission rules.</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
                    <Field label="Default commission %">
                      <input type="number" min={0} max={100} value={payroll.default_barber_pct ?? 60} onChange={e => { const v = Number(e.target.value); setNested('payroll','default_barber_pct',v) }} style={inp} />
                    </Field>
                    <Field label="Owner share % (auto)">
                      <input type="number" value={100 - (payroll.default_barber_pct ?? 60)} disabled style={{...inp,opacity:.45,cursor:'not-allowed'}} />
                    </Field>
                    <Field label="Tips go to">
                      <select value={String(payroll.tips_pct ?? 100)} onChange={e => setNested('payroll','tips_pct',Number(e.target.value))} style={inp}>
                        <option value="100">100% to team member</option>
                        <option value="50">50/50 split</option>
                        <option value="0">100% to owner</option>
                      </select>
                    </Field>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={lbl}>Tip options shown on Terminal screen</label>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginBottom: 8 }}>3 preset percentages + "No tip" button shown on Square Terminal</div>
                      <div className="set-tip-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                        {[0,1,2].map(i => (
                          <div key={i}>
                            <label style={{ ...lbl, marginBottom: 4 }}>Option {i+1} (%)</label>
                            <input type="number" min={0} max={100} step={1}
                              value={(payroll.tip_options?.[i]) ?? [15,20,25][i]}
                              onChange={e => {
                                const opts = [...(payroll.tip_options || [15,20,25])]
                                opts[i] = Number(e.target.value)
                                setNested('payroll','tip_options',opts)
                              }}
                              style={inp} />
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(0,0,0,.14)', fontSize: 12, color: 'rgba(255,255,255,.55)' }}>
                        <div style={{ marginBottom: 8 }}>Preview on Terminal:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {(payroll.tip_options || [15,20,25]).map((p: number, i: number) => (
                            <span key={i} style={{ padding: '2px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.5)', fontSize: 11 }}>{p}%</span>
                          ))}
                          <span style={{ padding: '2px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.55)', fontSize: 11 }}>No tip</span>
                        </div>
                      </div>
                    </div>
                    <Field label="Pay period">
                      <select value={payroll.period || 'weekly'} onChange={e => setNested('payroll','period',e.target.value)} style={inp}>
                        <option value="daily">Daily closeout</option>
                        <option value="weekly">Weekly (Mon–Sun)</option>
                        <option value="biweekly">Bi-weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </Field>
                  </div>
                </SectionCard>

                {/* SMS Status — per-business toll-free number */}
                <SectionCard title="SMS Notifications" action={null}>
                  {(() => {
                    const smsStatus = settings.sms_registration_status || 'not_registered'
                    const hasNumber = !!settings.sms_from_number
                    const needsSetup = smsStatus === 'none' || smsStatus === 'not_registered'
                    const needsOtp = smsStatus === 'pending_otp'

                    if (hasNumber) {
                      const isVerified = smsStatus === 'active' || smsStatus === 'verified'
                      const isPending = smsStatus === 'pending_verification' || smsStatus === 'pending_approval'
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 999, background: isVerified ? 'rgba(130,220,170,.8)' : isPending ? 'rgba(255,180,80,.7)' : 'rgba(255,255,255,.3)' }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: isVerified ? 'rgba(130,220,170,.8)' : isPending ? 'rgba(255,180,80,.7)' : 'rgba(255,255,255,.4)' }}>
                              {isVerified ? 'Active — SMS Enabled' : isPending ? 'Pending — Awaiting Carrier Approval (~5 business days)' : 'SMS Number Assigned'}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.25)' }}>Your number: <span style={{ color: 'rgba(255,255,255,.5)', fontFamily: 'monospace' }}>{settings.sms_from_number}</span></div>
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', lineHeight: 1.5 }}>
                            {isPending
                              ? 'Your number is awaiting carrier verification. SMS will be enabled once approved (typically 3-7 business days). To speed up approval, provide your EIN below.'
                              : 'Appointment confirmations and reminders are sent from your dedicated number.'}
                          </p>
                          {isPending && !settings.telnyx_brand_ein && (
                            <div style={{ marginTop: 8, padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,180,80,.15)', background: 'rgba(255,180,80,.04)' }}>
                              <p style={{ fontSize: 12, color: 'rgba(255,180,80,.6)', marginBottom: 8 }}>Complete verification by providing your business EIN (required by carriers):</p>
                              <SmsRegistrationForm wsId={s.slug || ''} settings={settings} onDone={(data: any) => {
                                setSettings((prev: any) => ({ ...prev, ...data }))
                              }} />
                            </div>
                          )}
                        </div>
                      )
                    }

                    if (needsSetup || needsOtp) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 999, background: needsOtp ? 'rgba(255,180,80,.7)' : 'rgba(130,150,220,.75)' }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: needsOtp ? 'rgba(255,180,80,.7)' : 'rgba(195,205,255,.86)' }}>
                              {needsOtp ? 'Finish owner verification' : 'Set up SMS for this business'}
                            </span>
                          </div>
                          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', lineHeight: 1.6 }}>
                            {needsOtp
                              ? 'Your registration is waiting on the one-time code Telnyx sent to the owner phone. Enter it below to continue.'
                              : 'SMS is no longer auto-provisioned. Start registration here when you want a dedicated business number for appointment notifications.'}
                          </p>
                          <div style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(130,150,220,.12)', background: 'rgba(130,150,220,.04)' }}>
                            <SmsRegistrationForm wsId={s.slug || ''} settings={settings} onDone={(data: any) => {
                              setSettings((prev: any) => ({ ...prev, ...data }))
                            }} />
                          </div>
                        </div>
                      )
                    }

                    // Registration submitted, waiting on carrier review or number assignment
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 999, background: 'rgba(255,180,80,.7)' }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,180,80,.7)' }}>Registration submitted</span>
                        </div>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', lineHeight: 1.5 }}>
                          Your SMS registration is in review. Carrier approval and number assignment can take a few business days depending on the registration type.
                        </p>
                      </div>
                    )
                  })()}
                </SectionCard>
              </div>
            )}

            {/* ── SQUARE ── */}
            {safeTab === 'square' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 680 }}>
                <SectionCard title="Square Connection">
                  {squareOAuth.connected ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(143,240,177,.25)', background: 'rgba(143,240,177,.06)' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(130,220,170,.8)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 999, background: 'rgba(130,220,170,.8)', display: 'inline-block' }} />
                          Connected to Square
                        </div>
                        {squareOAuth.merchant_id && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', marginTop: 3 }}>Merchant: {squareOAuth.merchant_id}</div>}
                        {squareOAuth.connected_at && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 1 }}>Since {new Date(squareOAuth.connected_at).toLocaleDateString()}</div>}
                      </div>
                      <SmBtn danger onClick={disconnectSquare}>Disconnect</SmBtn>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(0,0,0,.14)' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Connect your Square account</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', marginTop: 2 }}>Required for terminal payments, refunds and payment tracking</div>
                      </div>
                      <button onClick={connectSquare} disabled={squareConnecting}
                        style={{ height: 38, padding: '0 20px', borderRadius: 999, border: 'none', background: 'rgba(255,255,255,.15)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', whiteSpace: 'nowrap', opacity: squareConnecting ? .5 : 1, transition: 'opacity .2s' }}>
                        {squareConnecting ? 'Connecting…' : 'Connect Square'}
                      </button>
                    </div>
                  )}
                </SectionCard>

                {/* ── LOCATION ── */}
                {squareOAuth.connected && squareLocations.length > 0 && (
                  <SectionCard title="Square Location">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', marginBottom: 4 }}>Select the location for terminal payments</div>
                      {squareLocations.map((loc: any) => (
                        <button key={loc.id} onClick={() => saveLocation(loc.id)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                            border: `1px solid ${selectedLocationId === loc.id ? 'rgba(143,240,177,.25)' : 'rgba(255,255,255,.08)'}`,
                            background: selectedLocationId === loc.id ? 'rgba(143,240,177,.06)' : 'rgba(0,0,0,.14)',
                            color: '#e8e8ed', transition: 'all .2s',
                          }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{loc.name || 'Location'}</div>
                            {loc.address && <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>{[loc.address.address_line_1, loc.address.locality, loc.address.administrative_district_level_1].filter(Boolean).join(', ')}</div>}
                          </div>
                          {selectedLocationId === loc.id && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(130,220,170,.8)' }}>Active ✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </SectionCard>
                )}

                {/* ── TERMINAL DEVICE ── */}
                {squareOAuth.connected && (
                  <SectionCard title="Terminal Device">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)' }}>Select the Square Terminal device for card payments</div>
                      {squareDevices.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {squareDevices.map((dev: any) => {
                            const codeId = dev.serial_number || dev.device_code_id || dev.id
                            return (
                            <button key={dev.id} onClick={() => saveTerminalDevice(codeId)}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '10px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                                border: `1px solid ${selectedDeviceId === codeId ? 'rgba(143,240,177,.25)' : 'rgba(255,255,255,.08)'}`,
                                background: selectedDeviceId === codeId ? 'rgba(143,240,177,.06)' : 'rgba(0,0,0,.14)',
                                color: '#e8e8ed', transition: 'all .2s',
                              }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{dev.name || 'Square Terminal'}</div>
                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>{dev.id}</div>
                              </div>
                              {selectedDeviceId === codeId && (
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(130,220,170,.8)' }}>Active ✓</span>
                              )}
                            </button>
                          )})}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', padding: '8px 0' }}>
                          {loadingDevices ? 'Loading devices…' : 'No terminal devices found. Make sure your Square Terminal is powered on and connected.'}
                        </div>
                      )}
                      <button onClick={loadSquareDevices} disabled={loadingDevices}
                        style={{ height: 32, borderRadius: 999, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.55)', cursor: 'pointer', fontWeight: 600, fontSize: 11, fontFamily: 'inherit', opacity: loadingDevices ? .5 : 1 }}>
                        {loadingDevices ? 'Scanning…' : '↻ Refresh devices'}
                      </button>
                    </div>
                  </SectionCard>
                )}

                {/* ── STRIPE CONNECT ── */}
                <SectionCard title="Stripe Connect">
                  {stripeConnect.connected ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(130,150,220,.25)', background: 'rgba(130,150,220,.06)' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(130,150,220,.8)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 999, background: stripeConnect.charges_enabled ? 'rgba(130,220,170,.8)' : 'rgba(220,190,130,.8)', display: 'inline-block' }} />
                            {stripeConnect.charges_enabled ? 'Stripe Connected' : 'Onboarding Incomplete'}
                          </div>
                          {stripeConnect.account_id && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', marginTop: 3 }}>Account: {stripeConnect.account_id}</div>}
                          {stripeConnect.connected_at && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 1 }}>Since {new Date(stripeConnect.connected_at).toLocaleDateString()}</div>}
                        </div>
                        <SmBtn danger onClick={async () => {
                          const ok = await showConfirm(
                            'Disconnect Stripe? Clients won\'t be able to pay online.',
                            'Disconnect Stripe'
                          )
                          if (!ok) return
                          await apiFetch('/api/stripe-connect/disconnect', { method: 'POST' })
                          setStripeConnect({ connected: false })
                        }}>Disconnect</SmBtn>
                      </div>
                      {!stripeConnect.charges_enabled && (
                        <button onClick={async () => {
                          const r = await apiFetch('/api/stripe-connect/onboarding-url')
                          if (r.url) window.location.href = r.url
                        }} style={{ marginTop: 10, height: 38, width: '100%', borderRadius: 999, border: '1px solid rgba(220,190,130,.3)', background: 'rgba(220,190,130,.08)', color: 'rgba(220,190,130,.8)', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>
                          Complete Onboarding →
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(0,0,0,.14)' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Connect Stripe</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', marginTop: 2 }}>Accept online payments from clients, Apple Pay, Google Pay</div>
                      </div>
                      <button onClick={async () => {
                        setStripeConnecting(true)
                        try {
                          const r = await apiFetch('/api/stripe-connect/oauth/url')
                          if (r.url) window.location.href = r.url
                        } catch (e: any) { await showError(e.message || 'Failed') }
                        setStripeConnecting(false)
                      }} disabled={stripeConnecting}
                        style={{ height: 38, padding: '0 20px', borderRadius: 999, border: 'none', background: 'rgba(130,150,220,.2)', color: 'rgba(130,150,220,.9)', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', whiteSpace: 'nowrap', opacity: stripeConnecting ? .5 : 1 }}>
                        {stripeConnecting ? 'Connecting…' : 'Connect Stripe'}
                      </button>
                    </div>
                  )}
                </SectionCard>
              </div>
            )}

            {/* ── USERS ── */}
            {safeTab === 'users' && <UsersTab />}

            {/* ── PERMISSIONS ── */}
            {safeTab === 'permissions' && <PermissionsTab compact={isPhoneLayout} />}

            {/* ── SITE BUILDER ── */}
            {safeTab === 'site' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Slug / URL */}
                <SectionCard title="Booking URL">
                  <Field label="Your custom URL">
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', flexShrink: 0 }}>vurium.com/book/</span>
                      <input value={s.slug || ''} onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60))} placeholder="your-business" style={inp} />
                    </div>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 4 }}>Letters, numbers, and dashes only. This is your public booking link.</p>
                  </Field>
                </SectionCard>

                {/* Template selector — salon + custom only */}
                <SectionCard title="Design Template">
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 14 }}>Choose how your booking page looks.</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
                    {[
                      ...(canChangeDesign ? [
                        { id: 'classic', label: 'Classic', color: 'rgba(255,255,255,.15)' },
                        { id: 'modern', label: 'Vurium', color: 'rgba(255,255,255,.12)' },
                        { id: 'bold', label: 'Bold', color: 'rgba(255,255,255,.12)' },
                        { id: 'dark-luxury', label: 'Dark Luxury', color: 'rgba(255,255,255,.12)' },
                        { id: 'colorful', label: 'Colorful', color: 'rgba(255,255,255,.12)' },
                      ] : [
                        { id: 'modern', label: 'Vurium', color: 'rgba(255,255,255,.12)' },
                      ]),
                      { id: 'ai', label: 'AI Style', color: 'rgba(130,150,220,.15)' },
                      ...(currentPlan === 'custom' ? [{ id: 'custom', label: 'Custom', color: 'rgba(255,255,255,.12)' }] : []),
                    ].map(t => {
                      const sc = s.site_config || {}
                      const selected = (sc.template || 'modern') === t.id
                      return (
                        <button key={t.id} onClick={() => set('site_config', { ...sc, template: t.id })}
                          style={{ padding: '16px 8px', borderRadius: 12, border: `1px solid ${selected ? (t.id === 'ai' ? 'rgba(130,150,220,.3)' : 'rgba(255,255,255,.2)') : 'rgba(255,255,255,.06)'}`, background: selected ? (t.id === 'ai' ? 'rgba(130,150,220,.08)' : 'rgba(255,255,255,.06)') : 'rgba(255,255,255,.02)', cursor: 'pointer', textAlign: 'center', transition: 'all .2s', fontFamily: 'inherit' }}>
                          <div style={{ fontSize: 12, fontWeight: selected ? 600 : 400, color: selected ? (t.id === 'ai' ? 'rgba(130,150,220,.9)' : '#fff') : 'rgba(255,255,255,.45)' }}>{t.label}</div>
                        </button>
                      )
                    })}
                  </div>
                  {!canChangeDesign && (s.site_config?.template || 'modern') !== 'ai' && (
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 8 }}>More templates on Salon and Custom plans. <a href="/billing" style={{ color: 'rgba(130,150,220,.6)' }}>Upgrade →</a></p>
                  )}
                  {/* AI Style Generator */}
                  {(s.site_config?.template === 'ai') && <AIStyleGenerator siteConfig={s.site_config || {}} onGenerated={(css: string, prompt: string) => set('site_config', { ...(s.site_config || {}), template: 'ai', ai_css: css, ai_prompt: prompt })} />}
                </SectionCard>
                {false && ( /* removed old non-design fallback */
                <div style={{ padding: '16px 20px', borderRadius: 14, border: '1px solid rgba(255,255,255,.05)', background: 'rgba(255,255,255,.02)' }}>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 4 }}>Design templates available on Salon and Custom plans</div>
                  <a href="/billing" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>Upgrade →</a>
                </div>
                )}

                {/* Page content */}
                <SectionCard title="Page Content">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Field label="Hero title">
                      <input value={(s.site_config || {}).hero_title || ''} onChange={e => set('site_config', { ...(s.site_config || {}), hero_title: e.target.value })} placeholder="Welcome to our studio" style={inp} />
                    </Field>
                    <Field label="Hero subtitle">
                      <input value={(s.site_config || {}).hero_subtitle || ''} onChange={e => set('site_config', { ...(s.site_config || {}), hero_subtitle: e.target.value })} placeholder="Premium beauty & wellness" style={inp} />
                    </Field>
                    <Field label="About text">
                      <textarea value={(s.site_config || {}).about_text || ''} onChange={e => set('site_config', { ...(s.site_config || {}), about_text: e.target.value })} placeholder="Tell your clients about your business..." rows={3} style={{ ...inp, height: 'auto', padding: '10px 12px', resize: 'vertical' as const }} />
                    </Field>
                    <Field label="Hero image">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {((s.site_config || {}).hero_image || s.hero_media_url) && (
                          <div style={{ position: 'relative', width: '100%', height: 120, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,.08)' }}>
                            <img src={(s.site_config || {}).hero_image || s.hero_media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button onClick={() => { set('site_config', { ...(s.site_config || {}), hero_image: '' }); set('hero_media_url', '') }}
                              style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 8, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(0,0,0,.6)', color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>✕</button>
                          </div>
                        )}
                        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 42, borderRadius: 12, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                          {(s.site_config || {}).hero_image || s.hero_media_url ? 'Change photo' : 'Upload photo'}
                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            if (file.size > 10 * 1024 * 1024) { showToast('Max 10MB'); return }
                            const dataUrl: string = await new Promise((resolve, reject) => {
                              const reader = new FileReader()
                              reader.onload = () => {
                                const img = new Image()
                                img.onload = () => {
                                  const MAX = 1200
                                  let w = img.width, h = img.height
                                  if (w > MAX || h > MAX) {
                                    if (w > h) { h = Math.round(h * MAX / w); w = MAX }
                                    else { w = Math.round(w * MAX / h); h = MAX }
                                  }
                                  const canvas = document.createElement('canvas')
                                  canvas.width = w; canvas.height = h
                                  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
                                  let q = 0.78, out = canvas.toDataURL('image/jpeg', q)
                                  while (out.length > 600000 && q > 0.3) { q -= 0.08; out = canvas.toDataURL('image/jpeg', q) }
                                  resolve(out)
                                }
                                img.onerror = reject
                                img.src = reader.result as string
                              }
                              reader.onerror = reject
                              reader.readAsDataURL(file)
                            })
                            set('site_config', { ...(s.site_config || {}), hero_image: dataUrl })
                            set('hero_media_url', dataUrl)
                            e.target.value = ''
                          }} />
                        </label>
                      </div>
                    </Field>
                  </div>
                </SectionCard>

                {/* Sections toggle */}
                <SectionCard title="Visible Sections">
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 12 }}>Show or hide sections on your booking page.</p>
                  {[
                    { key: 'hero', label: 'Hero Banner' },
                    { key: 'about', label: 'About' },
                    { key: 'services', label: 'Services' },
                    { key: 'team', label: 'Team Members' },
                    { key: 'reviews', label: 'Reviews' },
                  ].map(sec => {
                    const sc = s.site_config || {}
                    const sections = sc.sections_enabled || { hero: true, about: true, services: true, team: true, reviews: true }
                    const enabled = sections[sec.key] !== false
                    return (
                      <div key={sec.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                        <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>{sec.label}</span>
                        <button onClick={() => set('site_config', { ...sc, sections_enabled: { ...sections, [sec.key]: !enabled } })}
                          style={{ width: 40, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', padding: 2, background: enabled ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.04)', position: 'relative', flexShrink: 0 }}>
                          <div style={{ width: 20, height: 20, borderRadius: 999, background: enabled ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.15)', transition: 'transform .2s', transform: enabled ? 'translateX(16px)' : 'translateX(0)' }} />
                        </button>
                      </div>
                    )
                  })}
                </SectionCard>

                {/* Custom Code — custom plan only */}
                {currentPlan === 'custom' ? (
                <SectionCard title="Custom Code">
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 14 }}>Add custom HTML and CSS to your booking page. Use template variables to inject dynamic data.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Field label="Custom CSS">
                      <textarea
                        value={(s.site_config || {}).custom_css || ''}
                        onChange={e => set('site_config', { ...(s.site_config || {}), custom_css: e.target.value })}
                        placeholder={`.my-card { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: 18px; padding: 20px; }`}
                        rows={6}
                        spellCheck={false}
                        style={{ ...inp, height: 'auto', padding: '10px 12px', resize: 'vertical' as const, fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre', overflowWrap: 'normal', overflowX: 'auto' }}
                      />
                    </Field>
                    <Field label="Custom HTML">
                      <textarea
                        value={(s.site_config || {}).custom_html || ''}
                        onChange={e => set('site_config', { ...(s.site_config || {}), custom_html: e.target.value })}
                        placeholder={`<div class="my-grid">\n  {{#each barbers}}\n  <div class="my-card">\n    <img src="{{photo_url}}" alt="{{name}}">\n    <h2>{{name}}</h2>\n    <span>{{level}}</span>\n    <button data-action="book" data-barber-id="{{id}}">Book Now</button>\n  </div>\n  {{/each}}\n</div>`}
                        rows={10}
                        spellCheck={false}
                        style={{ ...inp, height: 'auto', padding: '10px 12px', resize: 'vertical' as const, fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre', overflowWrap: 'normal', overflowX: 'auto' }}
                      />
                    </Field>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', lineHeight: 1.7 }}>
                      <div style={{ color: 'rgba(255,255,255,.4)', marginBottom: 4 }}>Template Variables</div>
                      <div><code style={{ color: 'rgba(255,255,255,.35)' }}>{'{{shop_name}}'}</code> &mdash; business name &nbsp; <code style={{ color: 'rgba(255,255,255,.35)' }}>{'{{barber_count}}'}</code> &mdash; number of team members</div>
                      <div style={{ marginTop: 4 }}><code style={{ color: 'rgba(255,255,255,.35)' }}>{'{{#each barbers}}...{{/each}}'}</code> &mdash; loop over team members</div>
                      <div style={{ paddingLeft: 12 }}>
                        <code style={{ color: 'rgba(255,255,255,.35)' }}>{'{{name}}'}</code>, <code style={{ color: 'rgba(255,255,255,.35)' }}>{'{{photo_url}}'}</code>, <code style={{ color: 'rgba(255,255,255,.35)' }}>{'{{level}}'}</code>, <code style={{ color: 'rgba(255,255,255,.35)' }}>{'{{id}}'}</code>, <code style={{ color: 'rgba(255,255,255,.35)' }}>{'{{initials}}'}</code>
                      </div>
                      <div style={{ marginTop: 4 }}><code style={{ color: 'rgba(255,255,255,.35)' }}>{'{{#each reviews}}...{{/each}}'}</code> &mdash; loop over reviews</div>
                      <div style={{ paddingLeft: 12 }}>
                        <code style={{ color: 'rgba(255,255,255,.35)' }}>{'{{reviewer_name}}'}</code>, <code style={{ color: 'rgba(255,255,255,.35)' }}>{'{{rating}}'}</code>, <code style={{ color: 'rgba(255,255,255,.35)' }}>{'{{stars}}'}</code>, <code style={{ color: 'rgba(255,255,255,.35)' }}>{'{{review_text}}'}</code>
                      </div>
                      <div style={{ marginTop: 6 }}><code style={{ color: 'rgba(255,255,255,.35)' }}>data-action=&quot;book&quot;</code> on a button opens booking flow</div>
                      <div><code style={{ color: 'rgba(255,255,255,.35)' }}>data-barber-id=&quot;{'{{id}}'}&quot;</code> pre-selects a specific team member</div>
                      <div style={{ marginTop: 6, color: 'rgba(255,255,255,.18)' }}>Scripts are not allowed for security. Use data-action attributes for interactivity.</div>
                    </div>
                  </div>
                </SectionCard>
                ) : currentPlan === 'salon' ? (
                <div style={{ padding: '16px 20px', borderRadius: 14, border: '1px solid rgba(255,255,255,.05)', background: 'rgba(255,255,255,.02)' }}>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 4 }}>Custom HTML & CSS available on Custom plan</div>
                  <a href="/billing" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>Upgrade →</a>
                </div>
                ) : null}

                {/* Preview */}
                <div style={{ textAlign: 'center' }}>
                  <a href={`/book/${s.slug || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('VURIUMBOOK_USER') || '{}').workspace_id || '' : '')}`} target="_blank" rel="noopener" style={{
                    display: 'inline-block', padding: '10px 24px', borderRadius: 10, fontSize: 13, textDecoration: 'none',
                    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.6)',
                  }}>Preview Booking Page →</a>
                </div>
              </div>
            )}

            {/* ── FEATURES ── */}

            {/* ── BILLING ── */}
            {safeTab === 'billing' && <BillingSection />}

          </>)}
            </div>
          </section>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: 'rgba(8,8,8,.92)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 999, padding: '10px 20px', boxShadow: '0 20px 60px rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', gap: 10, backdropFilter: 'blur(18px)', fontSize: 13, zIndex: 5000, whiteSpace: 'nowrap', color: '#e8e8ed', fontFamily: 'inherit' }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: toast.includes('Error') || toast.includes('❌') ? '#ff6b6b' : toast.includes('⚠') ? '#ffd18a' : 'rgba(130,220,170,.8)', flexShrink: 0 }} />
            {toast}
          </div>
        )}
      </div>
    </Shell>
  )
}

function AIStyleGenerator({ siteConfig, onGenerated }: { siteConfig: any; onGenerated: (css: string, prompt: string) => void }) {
  const [prompt, setPrompt] = useState(siteConfig.ai_prompt || '')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(!!siteConfig.ai_css)
  const [error, setError] = useState('')

  async function handleGenerate() {
    if (!prompt.trim() || generating) return
    setGenerating(true)
    setError('')
    try {
      const res = await apiFetch('/api/ai/generate-style', {
        method: 'POST',
        body: JSON.stringify({ prompt: prompt.trim() }),
      })
      if (res.error) throw new Error(res.error)
      onGenerated(res.css, prompt.trim())
      setGenerated(true)
    } catch (e: any) {
      setError(e.message || 'Failed to generate style')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ marginTop: 16, padding: '20px 24px', borderRadius: 14, border: '1px solid rgba(130,150,220,.12)', background: 'rgba(130,150,220,.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2" stroke="rgba(130,150,220,.7)" strokeWidth="1.3"/><path d="M8 1v3M8 12v3M1 8h3M12 8h3M3.05 3.05l2.12 2.12M10.83 10.83l2.12 2.12M3.05 12.95l2.12-2.12M10.83 5.17l2.12-2.12" stroke="rgba(130,150,220,.7)" strokeWidth="1.3" strokeLinecap="round"/></svg>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(130,150,220,.9)' }}>AI Style Generator</span>
      </div>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginBottom: 12, lineHeight: 1.5 }}>
        Describe your desired style in natural language. AI will generate custom CSS for your booking page.
      </p>
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="e.g. Dark minimalist with gold accents, luxury feel, elegant serif fonts, rounded cards with soft shadows..."
        rows={3}
        maxLength={500}
        style={{ width: '100%', borderRadius: 10, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(0,0,0,.25)', color: '#fff', padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5, outline: 'none' }}
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
        <button onClick={handleGenerate} disabled={generating || !prompt.trim()}
          style={{ height: 36, padding: '0 20px', borderRadius: 999, border: 'none', cursor: 'pointer', background: 'rgba(130,150,220,.15)', color: 'rgba(130,150,220,.9)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', opacity: generating || !prompt.trim() ? 0.5 : 1, transition: 'opacity .2s' }}>
          {generating ? 'Generating…' : generated ? 'Regenerate' : 'Generate Style'}
        </button>
        {generated && !generating && (
          <span style={{ fontSize: 12, color: 'rgba(130,220,170,.7)' }}>Style applied to your booking page</span>
        )}
        {error && <span style={{ fontSize: 12, color: 'rgba(220,100,100,.7)' }}>{error}</span>}
      </div>
      {siteConfig.ai_css && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', cursor: 'pointer' }}>View generated CSS</summary>
          <pre style={{ marginTop: 8, padding: 12, borderRadius: 8, background: 'rgba(0,0,0,.3)', fontSize: 11, color: 'rgba(255,255,255,.4)', overflow: 'auto', maxHeight: 200, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{siteConfig.ai_css}</pre>
        </details>
      )}
    </div>
  )
}
