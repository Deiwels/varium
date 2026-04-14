# Registration Page — UI/UX Improvement Plan (Claude / AI1)

> [[Home]] > Plans & Process | See also: [[Registration-Improvement-AI2]], [[Onboarding Wizard]], [[App Routes]]

## Scope

**File:** `app/signup/page.tsx`  
**Goal:** Improve visual design and UX of the Step 0 registration form without touching any OAuth, server, or payment logic.

---

## Protected Zones — DO NOT TOUCH

| Area | Location | Reason |
|---|---|---|
| Apple IAP bridge | `window.__VURIUM_IS_NATIVE` + `window.webkit.messageHandlers` | Native iOS |
| `?step=plan` URL param redirect | `useEffect` lines 141–144 | Google/Apple new-user flow |
| `/api/auth/apple-callback` route | `app/api/auth/apple-callback/route.ts` | OAuth flow |
| `/api/auth/google-callback` route | `app/api/auth/google-callback/route.ts` | OAuth flow |
| `handleSignup()` function | lines 193–270 | Server logic — no edits |
| `setAuthCookie`, `localStorage` | post-signup lines 254–262 | Session |
| Step 0.5, 1, 1.5, 2 JSX blocks | `signup/page.tsx` | Only Step 0 UI changes |

---

## Current Problem

```
Step 0: one huge form
  - Business details (name, type, timezone, address)
  - Account info (name, email, phone, password x2)
  - 2 consent checkboxes
  - Submit button
  ↳ no social sign-up on signup page
  ↳ no progress indicator
  ↳ no show/hide password toggle
  ↳ no inline field validation
  ↳ very long scroll on mobile
```

---

## Flow Architecture

```
Step 0a (Business)         Step 0b (Account)
  businessName               ownerName
  businessType               email
  timezone          →        phone
  street                     password + confirm
  city/state/zip             consents
  [Apple / Google]           [Create Workspace]
       ↓ OAuth                      ↓ handleSignup()
  ?step=plan → Step 1        Step 1 (Plan/Payment)
                                     ↓
                             Step 1.5 (SMS)
                                     ↓
                             Step 2 (Success)
```

---

## Changes — Step 0 Only

### 1. Progress Bar

Add a `StepBar` component **above** the form (inline, no new file needed).  
Computed from existing `step` state — no new external state required.

```tsx
function StepBar({ current }: { current: number }) {
  const steps = ['Account', 'Plan', 'SMS', 'Done']
  const idx = current === 0 ? 0 : current === 1 ? 1 : (current as any) === 1.5 ? 2 : 3
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 0, marginBottom: 32, maxWidth: 360, width: '100%', margin: '0 auto 28px' }}>
      {steps.map((s, i) => (
        <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
          {i < steps.length - 1 && (
            <div style={{
              position: 'absolute', top: 13, left: '50%', width: '100%',
              height: 1, background: i < idx ? 'rgba(130,220,170,.25)' : 'rgba(255,255,255,.07)',
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

Place `<StepBar current={step} />` directly inside `<main>`, before the step-conditional blocks.

### 2. Split Step 0 into Sub-Steps 0a / 0b

Add to `SignupPage` state section:
```tsx
const [subStep, setSubStep] = useState<0 | 1>(0)
```

**Sub-step 0a** renders: `businessName`, `businessType`, `timezone`, `street`, `city`, `state`, `zip` + social buttons  
**Sub-step 0b** renders: `ownerName`, `email`, `phone`, `password`, `passwordConfirm`, consents, submit

"Continue →" button on 0a validates required fields before advancing:
```tsx
function handleSubStepContinue() {
  if (!businessName.trim()) { setError('Business name is required.'); return }
  if (!timezone) { setError('Please select your timezone.'); return }
  if (!street.trim() || !city.trim() || !state.trim() || !zip.trim()) {
    setError('Please fill in your business address.'); return
  }
  setError('')
  setSubStep(1)
}
```

"← Back" on 0b calls `setSubStep(0)`.

The outer `step` state never changes from 0 until `handleSignup` succeeds — no existing logic breaks.

### 3. Social Sign-Up Buttons (Web only)

Add before `<form>` inside sub-step 0a, wrapped in `{!isNative && ...}`.  
Uses the same OAuth redirect URLs as `app/signin/page.tsx` — only difference is `state: 'signup'`.

```tsx
{!isNative && (
  <>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, marginTop: 4 }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.06)' }} />
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,.2)' }}>or sign up with</span>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.06)' }} />
    </div>
    <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>

      {/* Apple Sign Up */}
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
      }} style={{
        flex: 1, height: 46, borderRadius: 12, border: '1px solid rgba(255,255,255,.10)',
        background: 'rgba(255,255,255,.04)', color: '#fff', fontSize: 13, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
          <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
        </svg>
        Apple
      </button>

      {/* Google Sign Up */}
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
      }} style={{
        flex: 1, height: 46, borderRadius: 12, border: '1px solid rgba(255,255,255,.10)',
        background: 'rgba(255,255,255,.04)', color: '#fff', fontSize: 13, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#fff"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff"/>
        </svg>
        Google
      </button>
    </div>
  </>
)}
```

**Why this is safe:**  
The callback routes (`/api/auth/apple-callback`, `/api/auth/google-callback`) already handle new users and redirect to `?step=plan` — which the `useEffect` on lines 141–144 picks up, setting `step(1)`. No callback route changes needed.

### 4. Password Show/Hide Toggle

Add state:
```tsx
const [showPw, setShowPw] = useState(false)
const [showPwC, setShowPwC] = useState(false)
```

Wrap each password input in a `position: relative` div. Add an eye-icon button inside:

```tsx
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
  <button
    type="button"
    onClick={() => setShowPw(p => !p)}
    style={{
      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
      background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.3)',
      padding: 4, lineHeight: 1,
    }}
  >
    {showPw ? '🙈' : '👁'}
  </button>
</div>
```

Same pattern for `passwordConfirm` with `showPwC`.

### 5. Inline Email Validation (onBlur)

Add `onBlur` to email input:
```tsx
onBlur={() => {
  if (email && (!email.includes('@') || !email.includes('.'))) {
    setError('Please enter a valid email address.')
  }
}}
```

### 6. Mobile Address Grid Fix

Change the address grid div's `gridTemplateColumns`:
```tsx
// Before:
gridTemplateColumns: '2fr 1fr 1fr'

// After:
gridTemplateColumns: 'clamp(120px, 50%, 2fr) 1fr 1fr'
```

Add a responsive style tag (same pattern as native iOS styles, lines 306–309):
```tsx
<style>{`
  @media (max-width: 480px) {
    .addr-grid { grid-template-columns: 1fr !important; }
  }
`}</style>
```
Add `className="addr-grid"` to the address grid `<div>`.

---

## Verification Checklist

| Check | Expected Result |
|---|---|
| `tsc --noEmit` | 0 new errors |
| Apple button (web) | Redirects to `appleid.apple.com` with `state=signup` |
| Google button (web) | Redirects to `accounts.google.com` with `state=signup` |
| `__VURIUM_IS_NATIVE = true` | Apple + Google buttons not rendered |
| `?step=plan` in URL | Lands directly on step 1 (unchanged) |
| "Continue" without businessName | Error shown, stays on sub-step 0a |
| "Continue" with all fields filled | Advances to sub-step 0b |
| "← Back" on 0b | Returns to sub-step 0a |
| `handleSignup` fires | Sets `step(1)` as before |
| Password show/hide | `type` attribute toggles between `text` and `password` |
| Mobile 375px | No horizontal scroll, address stacks vertically |

---

## Summary of New State Variables

| Variable | Type | Purpose |
|---|---|---|
| `subStep` | `0 \| 1` | Controls which half of step 0 renders |
| `showPw` | `boolean` | Show/hide first password field |
| `showPwC` | `boolean` | Show/hide confirm password field |

All existing state (`step`, `businessName`, `email`, `password`, etc.) unchanged.
