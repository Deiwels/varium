# Registration Page — UI/UX Improvement Plan (Codex / AI2)

> [[Home]] > Plans & Process | See also: [[Registration-Improvement-AI1]], [[Onboarding Wizard]], [[App Routes]]

## Target File
`app/signup/page.tsx`

## Instruction Style
Diff-based. Apply each CHANGE block in order. Do not modify any logic,
state, or JSX outside the described locations. Do not rename existing variables.

---

## PROTECTED — ZERO CHANGES ALLOWED

```
handleSignup()                         lines 193–270
useEffect for ?step=plan               lines 136–144
useEffect for Apple IAP events         lines 147–153
useEffect for starfield                lines 155–191
Step 0.5 JSX block                     {step === (0.5 as any) && ...}
Step 1 JSX block                       {step === 1 && ...}
Step 1.5 JSX block                     {step === (1.5 as any) && ...}
Step 2 JSX block                       {step === 2 && ...}
app/api/auth/apple-callback/route.ts   NO CHANGES
app/api/auth/google-callback/route.ts  NO CHANGES
lib/auth-cookie.ts                     NO CHANGES
lib/pin.ts                             NO CHANGES
app/signin/page.tsx                    NO CHANGES
```

---

## CHANGE 1 — Add StepBar component

**Location:** Insert before `export default function SignupPage()` (before line 103)

**Insert this entire block:**

```tsx
function StepBar({ current }: { current: number }) {
  const steps = ['Account', 'Plan', 'SMS', 'Done']
  const idx = current === 0 ? 0 : current === 1 ? 1 : (current as any) === 1.5 ? 2 : 3
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', maxWidth: 360, width: '100%', margin: '0 auto 28px' }}>
      {steps.map((s, i) => (
        <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
          {i < steps.length - 1 && (
            <div style={{
              position: 'absolute', top: 13, left: '50%', width: '100%', height: 1,
              background: i < idx ? 'rgba(130,220,170,.25)' : 'rgba(255,255,255,.07)',
            }} />
          )}
          <div style={{
            width: 26, height: 26, borderRadius: 999, zIndex: 1,
            background: i < idx ? 'rgba(130,220,170,.15)' : i === idx ? 'rgba(130,150,220,.12)' : 'rgba(255,255,255,.03)',
            border: `1.5px solid ${i < idx ? 'rgba(130,220,170,.4)' : i === idx ? 'rgba(130,150,220,.35)' : 'rgba(255,255,255,.08)'}`,
            color: i < idx ? 'rgba(130,220,170,.85)' : i === idx ? 'rgba(130,150,220,.85)' : 'rgba(255,255,255,.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
          }}>{i < idx ? '✓' : i + 1}</div>
          <div style={{ fontSize: 10, marginTop: 5, color: i <= idx ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.15)', fontWeight: i === idx ? 600 : 400 }}>{s}</div>
        </div>
      ))}
    </div>
  )
}
```

---

## CHANGE 2 — Add new state variables

**Location:** After line 133 (`const [termsConsent, setTermsConsent] = useState(false)`)

**Insert:**
```tsx
const [subStep, setSubStep] = useState<0 | 1>(0)
const [showPw, setShowPw] = useState(false)
const [showPwC, setShowPwC] = useState(false)
```

---

## CHANGE 3 — Add handleSubStepContinue function

**Location:** After `handleSignup` function ends (after line 270), before `const planLabels`

**Insert:**
```tsx
function handleSubStepContinue() {
  setError('')
  if (!businessName.trim()) { setError('Business name is required.'); return }
  if (!timezone) { setError('Please select your timezone.'); return }
  if (!street.trim() || !city.trim() || !state.trim() || !zip.trim()) {
    setError('Please fill in your complete business address.'); return
  }
  setSubStep(1)
}
```

---

## CHANGE 4 — Add StepBar and mobile style to main JSX

**Location:** Inside `<main ...>` element, before `{/* STEP 0: Registration Form */}` comment

**Insert:**
```tsx
<style>{`
  @media (max-width: 480px) {
    .addr-grid { grid-template-columns: 1fr !important; }
  }
`}</style>
<StepBar current={step} />
```

---

## CHANGE 5 — Replace Step 0 JSX block

**Location:** Entire `{step === 0 && (...)}` block — lines 336–501

**Replace the entire block with:**

```tsx
{step === 0 && (
  <div className="fade-up" style={{ maxWidth: 480, width: '100%' }}>
    <div style={{ textAlign: 'center', marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: planInfo.color, display: 'inline-block' }} />
        <span className="label-glow" style={{ color: planInfo.color }}>{planInfo.label}</span>
      </div>
      <h1 className="shimmer-text" style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 600, letterSpacing: '-.03em' }}>
        {subStep === 0 ? 'Create your workspace' : 'Your account details'}
      </h1>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,.35)', marginTop: 10, lineHeight: 1.5 }}>
        {subStep === 0
          ? 'Set up VuriumBook\u2122 for your business in under a minute.'
          : 'Almost done \u2014 set up your login credentials.'}
      </p>
    </div>

    <div className="glass-card" style={{ padding: '32px 28px' }}>
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: error === 'email_exists' ? 'rgba(255,255,255,.06)' : 'rgba(220,80,80,.1)', border: `1px solid ${error === 'email_exists' ? 'rgba(255,255,255,.12)' : 'rgba(220,80,80,.2)'}`, color: error === 'email_exists' ? '#e8e8ed' : 'rgba(255,160,160,.9)', fontSize: 13, marginBottom: 20 }}>
          {error === 'email_exists' ? (
            <div>
              <div style={{ marginBottom: 8 }}>An account with this email already exists.</div>
              <a href="/signin" style={{ display: 'inline-block', padding: '8px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.08)', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>Sign In →</a>
            </div>
          ) : error}
        </div>
      )}

      {/* ── SUB-STEP 0a: Business ── */}
      {subStep === 0 && (
        <>
          {/* Social sign-up buttons — web only */}
          {!isNative && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.06)' }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,.2)' }}>or sign up with</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.06)' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
                <button type="button" onClick={() => {
                  const params = new URLSearchParams({
                    client_id: 'com.vurium.vuriumbook.web',
                    redirect_uri: `${window.location.origin}/api/auth/apple-callback`,
                    response_type: 'code id_token',
                    response_mode: 'form_post',
                    scope: 'name email',
                    state: 'signup',
                  })
                  window.location.href = `https://appleid.apple.com/auth/authorize?${params}`
                }} style={{ flex: 1, height: 46, borderRadius: 12, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                  Apple
                </button>
                <button type="button" onClick={() => {
                  const params = new URLSearchParams({
                    client_id: '431945333485-vm8jajavm5ndmk0ug0ujqov65ffev96m.apps.googleusercontent.com',
                    redirect_uri: `${window.location.origin}/api/auth/google-callback`,
                    response_type: 'code',
                    scope: 'openid email profile',
                    access_type: 'offline',
                    prompt: 'select_account',
                    state: 'signup',
                  })
                  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
                }} style={{ flex: 1, height: 46, borderRadius: 12, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#fff"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff"/></svg>
                  Google
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.06)' }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,.2)' }}>or fill in manually</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.06)' }} />
              </div>
            </>
          )}

          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(130,150,220,.6)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Your Business</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
            <div>
              <label style={lbl}>Business Name *</label>
              <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="e.g. Studio Glow, The Sharp Edge" required style={inp} />
            </div>
            <div>
              <label style={lbl}>Business Type</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {businessTypes.map(t => (
                  <button key={t} type="button" onClick={() => setBusinessType(t)} style={{
                    padding: '7px 14px', borderRadius: 999, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
                    background: businessType === t ? 'rgba(130,150,220,.15)' : 'rgba(255,255,255,.03)',
                    border: `1px solid ${businessType === t ? 'rgba(130,150,220,.3)' : 'rgba(255,255,255,.07)'}`,
                    color: businessType === t ? 'rgba(130,150,220,.9)' : 'rgba(255,255,255,.4)',
                    transition: 'all .2s',
                  }}>{t}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={lbl}>Timezone *</label>
              <select value={timezone} onChange={e => setTimezone(e.target.value)} required style={inp}>
                <option value="" disabled>Select your timezone</option>
                {getTimezoneList().map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>Business Address *</label>
              <input type="text" value={street} onChange={e => setStreet(e.target.value)} placeholder="Street address" required style={inp} />
            </div>
            <div className="addr-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={lbl}>City *</label>
                <input type="text" value={city} onChange={e => setCity(e.target.value)} required style={inp} />
              </div>
              <div>
                <label style={lbl}>State *</label>
                <input type="text" value={state} onChange={e => setState(e.target.value)} placeholder="IL" maxLength={2} required style={inp} />
              </div>
              <div>
                <label style={lbl}>ZIP *</label>
                <input type="text" value={zip} onChange={e => setZip(e.target.value)} placeholder="60089" required style={inp} />
              </div>
            </div>
          </div>

          <button type="button" onClick={handleSubStepContinue} className="btn-primary" style={{ width: '100%', fontSize: 15, fontFamily: 'inherit' }}>
            Continue →
          </button>
        </>
      )}

      {/* ── SUB-STEP 0b: Account ── */}
      {subStep === 1 && (
        <form onSubmit={handleSignup}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(130,220,170,.6)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Your Account</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
            <div>
              <label style={lbl}>Full Name *</label>
              <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Your full name" required style={inp} />
            </div>
            <div>
              <label style={lbl}>Email *</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onBlur={() => {
                  if (email && (!email.includes('@') || !email.includes('.'))) {
                    setError('Please enter a valid email address.')
                  }
                }}
                placeholder="you@yourbusiness.com"
                required
                style={inp}
              />
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', marginTop: 4 }}>This will be your login</p>
            </div>
            <div>
              <label style={lbl}>Mobile Phone *</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 123-4567" required style={inp} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Password *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min 8 chars"
                    required
                    minLength={8}
                    style={inp}
                  />
                  <button type="button" onClick={() => setShowPw(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.3)', padding: 4, lineHeight: 1, fontSize: 14 }}>
                    {showPw ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              <div>
                <label style={lbl}>Confirm *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPwC ? 'text' : 'password'}
                    value={passwordConfirm}
                    onChange={e => setPasswordConfirm(e.target.value)}
                    placeholder="Repeat"
                    required
                    style={inp}
                  />
                  <button type="button" onClick={() => setShowPwC(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.3)', padding: 4, lineHeight: 1, fontSize: 14 }}>
                    {showPwC ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
            </div>
            {password && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {[
                  { ok: password.length >= 8, label: '8+ chars' },
                  { ok: /[A-Z]/.test(password), label: 'Uppercase' },
                  { ok: /[0-9]/.test(password), label: 'Number' },
                  { ok: /[^a-zA-Z0-9]/.test(password), label: 'Special' },
                ].map((r, i) => (
                  <span key={i} style={{
                    fontSize: 10, padding: '3px 8px', borderRadius: 999,
                    background: r.ok ? 'rgba(130,220,170,.1)' : 'rgba(255,255,255,.03)',
                    border: `1px solid ${r.ok ? 'rgba(130,220,170,.2)' : 'rgba(255,255,255,.06)'}`,
                    color: r.ok ? 'rgba(130,220,170,.8)' : 'rgba(255,255,255,.25)',
                  }}>{r.ok ? '✓' : '○'} {r.label}</span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
            <label htmlFor="terms-consent" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input id="terms-consent" type="checkbox" checked={termsConsent} onChange={e => setTermsConsent(e.target.checked)} style={{ marginTop: 3, width: 16, height: 16, accentColor: 'rgba(130,220,170,.7)', cursor: 'pointer', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', lineHeight: 1.5 }}>
                I confirm I am at least 16 years old and agree to the <a href="/terms" target="_blank" rel="noopener" style={{ color: 'rgba(130,150,220,.6)', textDecoration: 'none' }}>Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener" style={{ color: 'rgba(130,150,220,.6)', textDecoration: 'none' }}>Privacy Policy</a>.
              </span>
            </label>
            <label htmlFor="sms-auth-consent" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input id="sms-auth-consent" type="checkbox" checked={smsConsent} onChange={e => setSmsConsent(e.target.checked)} style={{ marginTop: 3, width: 16, height: 16, accentColor: 'rgba(130,220,170,.7)', cursor: 'pointer', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', lineHeight: 1.5 }}>
                I authorize VuriumBook&trade; to send appointment-related text messages to my clients on my behalf when enabled in my booking settings. I am responsible for using SMS features lawfully and only where my clients have provided consent.
              </span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button type="button" onClick={() => { setSubStep(0); setError('') }} style={{ height: 50, paddingInline: 20, borderRadius: 14, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', color: 'rgba(255,255,255,.4)', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>
              ← Back
            </button>
            <button type="submit" disabled={loading || !termsConsent || !smsConsent} className="btn-primary" style={{
              flex: 1, fontSize: 15, fontFamily: 'inherit',
              opacity: loading || !termsConsent || !smsConsent ? 0.5 : 1,
              cursor: loading || !termsConsent || !smsConsent ? 'not-allowed' : 'pointer',
            }}>
              {loading ? 'Creating workspace...' : 'Create Workspace'}
            </button>
          </div>
        </form>
      )}
    </div>

    <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,.25)' }}>
      Already have an account? <a href="/signin" style={{ color: 'rgba(130,150,220,.7)', textDecoration: 'none' }}>Sign in</a>
    </p>
  </div>
)}
```

---

## Why Social Buttons Are Safe

The Apple/Google OAuth callbacks (`/api/auth/apple-callback`, `/api/auth/google-callback`) already handle new users:
- They create a session and redirect to `/?step=plan` (or similar)
- The existing `useEffect` (lines 141–144) in `SignupPage` reads `?step=plan` and calls `setStep(1)`
- **No changes needed to callback routes**

The only difference from the signin buttons is `state: 'signup'` in the OAuth params — the backend can use this for logging/analytics if needed, but it does not change the flow.

---

## Verification Checklist

```
[ ] tsc --noEmit — zero new TypeScript errors
[ ] Apple button (web) → redirects to appleid.apple.com with state=signup
[ ] Google button (web) → redirects to accounts.google.com with state=signup
[ ] __VURIUM_IS_NATIVE = true → social buttons NOT rendered
[ ] ?step=plan in URL → lands on step 1 directly (unchanged behavior)
[ ] Continue on 0a without businessName → error shown, stays on 0a
[ ] Continue on 0a without address → error shown, stays on 0a
[ ] Continue on 0a with all fields → advances to sub-step 0b
[ ] Back button on 0b → returns to sub-step 0a
[ ] handleSignup fires from 0b form submit → step becomes 1
[ ] Password show/hide toggle → type attribute switches text/password
[ ] Mobile 375px → address grid stacks vertically (1 column)
[ ] StepBar → shows step 1 active on step 0, checkmarks on completed steps
```

---

## Summary of New State Variables

| Variable | Type | Default | Purpose |
|---|---|---|---|
| `subStep` | `0 \| 1` | `0` | Which half of step 0 to render |
| `showPw` | `boolean` | `false` | Show/hide password field |
| `showPwC` | `boolean` | `false` | Show/hide confirm password field |

All other existing state variables remain unchanged.
All existing step 0.5 / 1 / 1.5 / 2 blocks remain completely untouched.
