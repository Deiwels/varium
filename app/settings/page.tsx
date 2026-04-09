'use client'
import Shell from '@/components/Shell'
import { useEffect, useState, useCallback, useRef } from 'react'

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

// ─── Users Tab — Clean VuriumBook style ──────────────────────────────────────
function UsersTab() {
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

  async function resetPw(uid: string) {
    const pw = prompt('New password (min 8 chars, letter + number):')
    if (!pw || pw.length < 6) return
    try { await apiFetch(`/api/users/${encodeURIComponent(uid)}`, { method: 'PATCH', body: JSON.stringify({ password: pw }) }); setMsg('Password reset'); load() }
    catch (e: any) { alert(e.message) }
  }

  async function toggleActive(uid: string, active: boolean) {
    try { await apiFetch(`/api/users/${encodeURIComponent(uid)}`, { method: 'PATCH', body: JSON.stringify({ active }) }); load() }
    catch (e: any) { alert(e.message) }
  }

  async function deleteUser(uid: string, uname: string) {
    if (!window.confirm(`Permanently delete "${uname}"?\n\nThis removes the account and all access. This action cannot be undone.`)) return
    try { await apiFetch(`/api/users/${encodeURIComponent(uid)}?hard=true`, { method: 'DELETE' }); load() }
    catch (e: any) { alert(e?.message || 'Failed') }
  }

  async function deleteOwnerAccount() {
    const warning = `⚠ DELETE ENTIRE WORKSPACE\n\nThis will PERMANENTLY delete:\n• Your owner account\n• ALL team member accounts you created\n• All bookings, clients, payments, and business data\n• Your active subscription will also be cancelled\n\nThis action is IRREVERSIBLE.\n\nType DELETE to confirm:`
    const confirmation = prompt(warning)
    if (confirmation !== 'DELETE') {
      if (confirmation !== null) alert('Cancelled — you must type DELETE exactly')
      return
    }
    const pw = prompt('Enter your password to confirm:')
    if (!pw) return
    try {
      const r = await apiFetch('/api/auth/delete-account', { method: 'DELETE', body: JSON.stringify({ password: pw }) })
      if (r?.ok) {
        localStorage.removeItem('VURIUMBOOK_TOKEN')
        localStorage.removeItem('VURIUMBOOK_USER')
        window.location.href = '/signin'
      } else {
        alert(r?.error || 'Error deleting account')
      }
    } catch (e: any) { alert(e?.message || 'Error deleting account') }
  }

  const initials = (n: string) => (n || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
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
          }}>{creating ? 'Adding...' : 'Add to team'}</button>
        </div>
      )}

      {/* Team list */}
      {loading ? <div style={{ color: 'rgba(255,255,255,.25)', fontSize: 13, padding: 20, textAlign: 'center' }}>Loading...</div> :
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sortedUsers.map(u => (
            <div key={u.id} style={{
              padding: '14px 16px', borderRadius: 16,
              border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.02)',
              opacity: u.active ? 1 : 0.45, transition: 'opacity .2s',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              {/* Top row: Avatar + Info + Role badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
                    } catch (err: any) { alert(err.message) }
                  }} style={{ ...inpSm, width: 'auto', minWidth: 100, maxWidth: '100%', flex: '0 1 auto' }}>
                    <option value="">No master</option>
                    {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                )}
                <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
                  <SmBtn onClick={() => resetPw(u.id)}>Reset PW</SmBtn>
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
            if (newp.length < 8) { alert('Password must be at least 8 characters'); return }
            if (!/[a-zA-Z]/.test(newp) || !/[0-9]/.test(newp)) { alert('Password must contain at least one letter and one number'); return }
            try {
              const r = await apiFetch('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password: curr, new_password: newp }) })
              if (r?.ok) { alert('Password updated'); (document.getElementById('pw-current') as HTMLInputElement).value = '';  (document.getElementById('pw-new') as HTMLInputElement).value = '' }
              else alert(r?.error || 'Error')
            } catch { alert('Error changing password') }
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
    </div>
  )
}

// ─── Billing Section ────────────────────────────────────────────────────────
function BillingSection() {
  const [billing, setBilling] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    apiFetch('/api/billing/status').then(setBilling).catch(() => {}).finally(() => setLoading(false))
  }, [])

  async function handleCancel() {
    const source = billing?.billing_source
    if (source === 'apple') {
      const ok = confirm('Your subscription was purchased through the Apple App Store.\n\nTo cancel, you must do it in iOS Settings → Apple ID → Subscriptions → Vurium.\n\nWe\'ll open the Apple subscription management page now.')
      if (!ok) return
      setCancelling(true)
      try {
        const r: any = await apiFetch('/api/billing/cancel', { method: 'POST' })
        const updated = await apiFetch('/api/billing/status')
        setBilling(updated)
        const url = r?.manage_url || 'https://apps.apple.com/account/subscriptions'
        window.location.href = url
      } catch (e: any) { alert(e.message || 'Failed to cancel') }
      setCancelling(false)
      return
    }
    if (!confirm('Are you sure you want to cancel? You\'ll keep access until the end of your billing period.')) return
    setCancelling(true)
    try {
      await apiFetch('/api/billing/cancel', { method: 'POST' })
      const updated = await apiFetch('/api/billing/status')
      setBilling(updated)
    } catch (e: any) { alert(e.message || 'Failed to cancel') }
    setCancelling(false)
  }

  async function handlePortal() {
    try {
      const data = await apiFetch('/api/billing/portal', { method: 'POST' })
      if (data.url) window.location.href = data.url
    } catch (e: any) { alert(e.message || 'Failed') }
  }

  const statusStyles: Record<string, { bg: string; color: string; label: string }> = {
    trialing: { bg: 'rgba(130,220,170,.1)', color: 'rgba(130,220,170,.8)', label: 'Free Trial' },
    active: { bg: 'rgba(130,150,220,.1)', color: 'rgba(130,150,220,.8)', label: 'Active' },
    past_due: { bg: 'rgba(220,170,100,.1)', color: 'rgba(220,170,100,.8)', label: 'Past Due' },
    canceled: { bg: 'rgba(220,130,160,.1)', color: 'rgba(220,130,160,.8)', label: 'Canceled' },
    cancelling: { bg: 'rgba(220,170,100,.1)', color: 'rgba(220,170,100,.8)', label: 'Cancelling' },
    inactive: { bg: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.4)', label: 'Inactive' },
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>Loading...</div>

  const s = statusStyles[billing?.subscription_status] || statusStyles.inactive
  const hasSub = !!billing?.stripe_subscription_id
  const canCancel = hasSub && billing?.subscription_status !== 'canceled' && billing?.subscription_status !== 'cancelling'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Current plan */}
      <div style={{ padding: '18px 20px', borderRadius: 16, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.03)' }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.30)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>Current Plan</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: billing?.trial_active ? 8 : 0 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#e8e8ed', textTransform: 'capitalize' }}>{billing?.plan || 'Individual'}</span>
          <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>
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

        {hasSub && (
          <button onClick={handlePortal} style={{
            height: 44, borderRadius: 12, fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
            background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', color: 'rgba(255,255,255,.50)',
          }}>
            Manage Payment Method
          </button>
        )}

        {canCancel && (
          <button onClick={handleCancel} disabled={cancelling} style={{
            height: 44, borderRadius: 12, fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
            background: 'rgba(220,80,80,.04)', border: '1px solid rgba(220,80,80,.12)', color: 'rgba(220,130,130,.7)',
            opacity: cancelling ? 0.5 : 1,
          }}>
            {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
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

function PermissionsTab() {
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

  function resetToDefaults() {
    if (!window.confirm('Reset all permissions to defaults?')) return
    setPerms(DEFAULT_PERMS)
    setSaving(true)
    apiFetch('/api/settings/permissions', { method: 'POST', body: JSON.stringify({ role_permissions: DEFAULT_PERMS }) })
      .catch(() => {})
      .finally(() => setSaving(false))
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>Loading...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)' }}>Configure what each role can see and do</div>
          {saving && <span style={{ fontSize: 10, color: 'rgba(130,220,170,.5)', marginTop: 4, display: 'block' }}>Saving...</span>}
        </div>
        <button onClick={resetToDefaults} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', color: 'rgba(255,255,255,.35)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
          Reset to defaults
        </button>
      </div>

      {/* Role column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3, 80px)', gap: 8, padding: '0 12px', position: 'sticky', top: 0, zIndex: 2, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(10px)', borderRadius: 10, paddingTop: 8, paddingBottom: 8 }}>
        <div />
        {ROLES.map(r => (
          <div key={r.id} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: r.color }}>{r.label}</div>
        ))}
      </div>

      {PERM_SECTIONS.map(section => (
        <div key={section.category} style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.02)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,.06)', background: 'rgba(0,0,0,.12)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)' }}>{section.label}</span>
          </div>
          {section.items.map((item, idx) => (
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
  const { effective_plan: currentPlan } = usePlan()
  const canChangeDesign = currentPlan === 'salon' || currentPlan === 'custom'
  const [tab, setTab] = useState<'shop'|'site'|'fees'|'booking'|'payroll'|'square'|'users'|'permissions'|'billing'>('shop')
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

  // Read tab from URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlTab = params.get('tab')
    if (urlTab && ['shop','site','fees','booking','payroll','square','users','billing'].includes(urlTab)) {
      setTab(urlTab as any)
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
      showToast('Square connected successfully ✓')
      apiFetch('/api/square/oauth/status').then(d => setSquareOAuth(d)).catch(() => {})
      window.history.replaceState({}, '', '/settings?tab=square')
    } else if (params.get('square') === 'error') {
      setTab('square')
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

  async function save() {
    setSaving(true)
    try {
      await apiFetch('/api/settings', { method: 'POST', body: JSON.stringify({ ...settings, fees, charges }) })
      setDirty(false); showToast('Settings saved ✓')
    } catch (e: any) { showToast('Error: ' + e.message) }
    setSaving(false)
  }

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
    if (!window.confirm('Disconnect Square? Payment terminal will stop working until reconnected.')) return
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

  async function cleanup() {
    try { const r = await apiFetch('/api/admin/cleanup-test-payments', { method: 'DELETE' }); showToast(`Cleaned ${r?.deleted || 0} records`) }
    catch (e: any) { showToast('Error: ' + e.message) }
  }

  const [userRole] = useState<string>(() => { try { return JSON.parse(localStorage.getItem('VURIUMBOOK_USER') || '{}').role || 'owner' } catch { return 'owner' } })
  const [geocoding, setGeocoding] = useState(false)

  const s = settings
  const tax = s.tax || {}
  const booking = s.booking || {}
  const display = s.display || {}
  const payroll = s.payroll || {}
  const square = s.square || {}

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
  // Map tab ids to settings_access permission keys
  const TAB_PERM_MAP: Record<string, string> = {
    shop: 'general', booking: 'booking', site: 'site_builder',
    fees: 'fees_tax', square: 'integrations',
  }
  const ALL_TABS = [
    { id: 'shop', label: 'General', ownerOnly: false },
    { id: 'booking', label: 'Booking', ownerOnly: false },
    { id: 'site', label: 'Site Builder', ownerOnly: false },
    { id: 'fees', label: 'Fees & Tax', ownerOnly: true },
    { id: 'payroll', label: 'Payroll', ownerOnly: true },
    { id: 'square', label: 'Integrations', ownerOnly: false },
    { id: 'users', label: 'Accounts', ownerOnly: true },
    { id: 'permissions', label: 'Permissions', ownerOnly: true },
    { id: 'billing', label: 'Billing', ownerOnly: true },
  ] as const
  const TABS = ALL_TABS.filter(t => {
    // Owner sees everything
    if (userRole === 'owner') return true
    // These tabs are always owner-only (no permission toggle)
    if (t.id === 'users' || t.id === 'permissions' || t.id === 'billing' || t.id === 'payroll') return false
    // Check settings_access permission
    const permKey = TAB_PERM_MAP[t.id]
    if (permKey) return settingsHasPerm('settings_access', permKey)
    return false
  })

  return (
    <Shell page="settings">
      <style>{`
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:3px}
        select option{background:#111}
        @media(max-width:768px){
          .page-topbar{padding-left:60px!important;}
          .page-topbar h2{font-size:13px!important;}
          .set-2col{grid-template-columns:1fr!important;}
          .set-tabs{gap:4px!important;}
          .set-tabs button{font-size:10px!important;padding:0 10px!important;height:32px!important;}
          .set-topbar{flex-wrap:wrap!important;gap:8px!important;}
          .set-topbar h2{font-size:13px!important;}
          .set-fee-row{grid-template-columns:1fr 70px 80px 36px!important;}
          .set-fee-col3{display:none!important;}
          .set-user-actions{flex-direction:column!important;align-items:stretch!important;gap:4px!important;}
          .set-user-actions button{width:100%!important;justify-content:center!important;}
          .set-user-card{flex-direction:column!important;align-items:stretch!important;gap:8px!important;}
          .set-create-grid{grid-template-columns:1fr!important;}
        }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'transparent', color: '#e8e8ed', fontFamily: 'Inter,system-ui,sans-serif' }}>

        {/* Tab bar + auto-save indicator */}

        {/* Tab bar */}
        <div className="set-tabs" style={{ display: 'flex', gap: 6, padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,.06)', overflowX: 'auto', flexShrink: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ height: 36, padding: '0 16px', borderRadius: 999, border: `1px solid ${tab===t.id ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.06)'}`, background: tab===t.id ? 'rgba(255,255,255,.08)' : 'transparent', color: tab===t.id ? '#e8e8ed' : 'rgba(255,255,255,.40)', cursor: 'pointer', fontWeight: tab===t.id ? 700 : 500, fontSize: 11, letterSpacing: '.04em', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all .2s' }}>
              {t.label}
            </button>
          ))}
          {/* Auto-save indicator */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {saving && <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>Saving...</span>}
            {!saving && dirty && <span style={{ width: 6, height: 6, borderRadius: 999, background: 'rgba(255,180,100,.5)' }} />}
            {!saving && !dirty && !loading && <span style={{ width: 6, height: 6, borderRadius: 999, background: 'rgba(130,220,170,.4)' }} />}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
          {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.40)' }}>Loading settings…</div> : (<>

            {/* ── GENERAL ── */}
            {tab === 'shop' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 600 }}>
                <SectionCard title="Business">
                  <Field label="Shop name"><input value={s.shop_name || ''} onChange={e => set('shop_name', e.target.value)} placeholder="Your Business Name" style={inp} /></Field>
                  <Field label="Shop address">
                    <input value={s.shop_address || ''} onChange={e => set('shop_address', e.target.value)} placeholder="123 Main St, City, State ZIP" style={inp} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', marginTop: 4 }}>Shown in emails and used for employee clock-in location</div>
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
                  <Field label="Timezone">
                    <select value={s.timezone || 'America/Chicago'} onChange={e => set('timezone', e.target.value)} style={inp}>
                      {getTimezoneList().map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Business Type">
                    <select value={s.business_type || ''} onChange={e => set('business_type', e.target.value)} style={inp}>
                      <option value="">Not set</option>
                      {['Barbershop', 'Hair Salon', 'Nail Studio', 'Beauty Salon', 'Spa & Wellness', 'Tattoo Studio', 'Lash & Brow Bar', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', marginTop: 4 }}>Affects staff terminology across the app (e.g. Barber, Stylist, Master)</div>
                  </Field>
                  <Field label="Currency">
                    <select value={s.currency || 'USD'} onChange={e => set('currency', e.target.value)} style={inp}>
                      <option value="USD">USD — US Dollar</option>
                      <option value="CAD">CAD — Canadian Dollar</option>
                      <option value="EUR">EUR — Euro</option>
                    </select>
                  </Field>
                </SectionCard>

                {/* Attendance & Clock-In — owner only */}
                {userRole === 'owner' && (
                  <SectionCard title="Attendance & Clock-In">
                    <Toggle checked={!!s.clock_in_enabled} onChange={v => set('clock_in_enabled', v)} label="Enable clock-in / clock-out" sub="Staff and admins will see a clock-in widget on their dashboard" />
                    {s.clock_in_enabled && (<>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>Geofence uses the shop address set in the Business section above.</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', marginTop: 4 }}>How far from the shop employees can be to clock in (default: 500m)</div>
                      </Field>
                    </>)}
                  </SectionCard>
                )}
              </div>
            )}

            {/* ── FEES ── */}
            {tab === 'fees' && (
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
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 120px', gap: 8, alignItems: 'center' }}>
                        <input value={tax.label || ''} onChange={e => setNested('tax','label',e.target.value)} placeholder="Tax label" style={{...inpSm,width:'100%'}} />
                        <div style={{ position: 'relative' }}>
                          <input type="number" min={0} max={50} step={0.01} value={tax.rate || ''} onChange={e => setNested('tax','rate',Number(e.target.value))} placeholder="Rate" style={inpSm} />
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>% rate</div>
                        <select value={tax.applies_to || 'all'} onChange={e => setNested('tax','applies_to',e.target.value)} style={inpSm}>
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
                    <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 120px 36px', gap: 8, alignItems: 'center', padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(0,0,0,.14)', marginBottom: 6 }}>
                      <input value={f.label} onChange={e => { const n=[...fees]; n[i]={...n[i],label:e.target.value}; setFees(n); setDirty(true) }} placeholder="e.g. Card surcharge" style={{...inpSm,width:'100%'}} />
                      <select value={f.type} onChange={e => { const n=[...fees]; n[i]={...n[i],type:e.target.value as any}; setFees(n); setDirty(true) }} style={inpSm}>
                        <option value="percent">%</option>
                        <option value="fixed">Fixed $</option>
                      </select>
                      <input type="number" min={0} step={0.01} value={f.value||''} onChange={e => { const n=[...fees]; n[i]={...n[i],value:Number(e.target.value)}; setFees(n); setDirty(true) }} placeholder="Value" style={inpSm} />
                      <select value={f.applies_to} onChange={e => { const n=[...fees]; n[i]={...n[i],applies_to:e.target.value}; setFees(n); setDirty(true) }} style={inpSm}>
                        <option value="all">All payments</option>
                        <option value="terminal">Terminal only</option>
                        <option value="cash">Cash only</option>
                        <option value="zelle">Zelle only</option>
                        <option value="other">Other only</option>
                      </select>
                      <button onClick={() => { setFees(fees.filter((_,j)=>j!==i)); setDirty(true) }} style={{ height: 34, width: 34, borderRadius: 10, border: '1px solid rgba(255,107,107,.35)', background: 'rgba(255,107,107,.08)', color: '#ff6b6b', cursor: 'pointer', fontSize: 15 }}>✕</button>
                    </div>
                  ))}

                  {fees.length === 0 && !tax.enabled && <div style={{ color: 'rgba(255,255,255,.30)', fontSize: 12, padding: '4px 0' }}>No taxes or fees — services charged at face value</div>}
                </SectionCard>

                <SectionCard title="Custom charges & categories"
                  action={<SmBtn onClick={() => { setCharges(c => [...c, { id: 'charge_'+Date.now(), name: '', type: 'percent', value: 0, color: 'rgba(130,150,220,.9)', enabled: true }]); setDirty(true) }}>+ Add</SmBtn>}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.40)' }}>Promotions, membership discounts, product sales</div>
                  {charges.length === 0 ? <div style={{ color: 'rgba(255,255,255,.30)', fontSize: 12 }}>No custom charges</div> :
                    charges.map((c, i) => (
                      <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 80px 36px', gap: 8, alignItems: 'center', padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(0,0,0,.14)' }}>
                        <input value={c.name} onChange={e => { const n=[...charges]; n[i]={...n[i],name:e.target.value}; setCharges(n); setDirty(true) }} placeholder="Name (e.g. Loyalty discount)" style={{...inpSm,width:'100%'}} />
                        <select value={c.type} onChange={e => { const n=[...charges]; n[i]={...n[i],type:e.target.value as any}; setCharges(n); setDirty(true) }} style={inpSm}>
                          <option value="percent">%</option>
                          <option value="fixed">Fixed $</option>
                          <option value="label">Label only</option>
                        </select>
                        <input type="number" min={0} step={0.01} value={c.value||''} disabled={c.type==='label'} onChange={e => { const n=[...charges]; n[i]={...n[i],value:Number(e.target.value)}; setCharges(n); setDirty(true) }} placeholder="Value" style={{...inpSm,opacity:c.type==='label'?.4:1}} />
                        <input type="color" value={c.color||'rgba(130,150,220,.9)'} onChange={e => { const n=[...charges]; n[i]={...n[i],color:e.target.value}; setCharges(n); setDirty(true) }} style={{ height: 34, width: '100%', borderRadius: 8, border: '1px solid rgba(255,255,255,.10)', background: 'none', cursor: 'pointer', padding: 2 }} />
                        <button onClick={() => { setCharges(charges.filter((_,j)=>j!==i)); setDirty(true) }} style={{ height: 34, width: 34, borderRadius: 10, border: '1px solid rgba(255,107,107,.35)', background: 'rgba(255,107,107,.08)', color: '#ff6b6b', cursor: 'pointer', fontSize: 15 }}>✕</button>
                      </div>
                    ))
                  }
                </SectionCard>
              </div>
            )}

            {/* ── BOOKING & SMS ── */}
            {tab === 'booking' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
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
                <SectionCard title="Booking page">
                  <Field label="Cancellation window (hours)">
                    <input type="number" min={0} max={72} value={booking.cancellation_hours ?? 2} onChange={e => setNested('booking','cancellation_hours',Number(e.target.value))} style={inp} />
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 4 }}>Clients can cancel up to X hours before</div>
                  </Field>
                  <Toggle checked={display.show_prices !== false} onChange={v => setNested('display','show_prices',v)} label="Show service prices" sub="On public booking page" />
                  <Toggle checked={!!display.require_phone} onChange={v => setNested('display','require_phone',v)} label="Require phone number" sub="Mandatory for SMS" />
                  <Toggle checked={display.allow_notes !== false} onChange={v => setNested('display','allow_notes',v)} label="Allow booking notes" sub="Client can add notes & reference photo" />
                </SectionCard>
              </div>
            )}

            {/* ── PAYROLL ── */}
            {tab === 'payroll' && (
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
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
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
                        Preview on Terminal: {' '}
                        {(payroll.tip_options || [15,20,25]).map((p: number, i: number) => (
                          <span key={i} style={{ marginRight: 8, padding: '2px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.5)', fontSize: 11 }}>{p}%</span>
                        ))}
                        <span style={{ padding: '2px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.55)', fontSize: 11 }}>No tip</span>
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
              </div>
            )}

            {/* ── SQUARE ── */}
            {tab === 'square' && (
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
                          if (!confirm('Disconnect Stripe? Clients won\'t be able to pay online.')) return
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
                        } catch (e: any) { alert(e.message || 'Failed') }
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
            {tab === 'users' && <UsersTab />}

            {/* ── PERMISSIONS ── */}
            {tab === 'permissions' && <PermissionsTab />}

            {/* ── SITE BUILDER ── */}
            {tab === 'site' && (
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
                {canChangeDesign ? (
                <SectionCard title="Design Template">
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 14 }}>Choose how your booking page looks.</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
                    {[
                      { id: 'classic', label: 'Classic', color: 'rgba(255,255,255,.15)' },
                      { id: 'modern', label: 'Vurium', color: 'rgba(255,255,255,.12)' },
                      { id: 'bold', label: 'Bold', color: 'rgba(255,255,255,.12)' },
                      { id: 'dark-luxury', label: 'Dark Luxury', color: 'rgba(255,255,255,.12)' },
                      { id: 'colorful', label: 'Colorful', color: 'rgba(255,255,255,.12)' },
                      ...(currentPlan === 'custom' ? [{ id: 'custom', label: 'Custom', color: 'rgba(255,255,255,.12)' }] : []),
                    ].map(t => {
                      const sc = s.site_config || {}
                      const selected = (sc.template || 'modern') === t.id
                      return (
                        <button key={t.id} onClick={() => set('site_config', { ...sc, template: t.id })}
                          style={{ padding: '16px 8px', borderRadius: 12, border: `1px solid ${selected ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.06)'}`, background: selected ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.02)', cursor: 'pointer', textAlign: 'center', transition: 'all .2s', fontFamily: 'inherit' }}>
                          <div style={{ fontSize: 12, fontWeight: selected ? 600 : 400, color: selected ? '#fff' : 'rgba(255,255,255,.45)' }}>{t.label}</div>
                        </button>
                      )
                    })}
                  </div>
                </SectionCard>
                ) : (
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
            {tab === 'billing' && <BillingSection />}

          </>)}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: 'rgba(8,8,8,.92)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 999, padding: '10px 20px', boxShadow: '0 20px 60px rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', gap: 10, backdropFilter: 'blur(18px)', fontSize: 13, zIndex: 5000, whiteSpace: 'nowrap', color: '#e8e8ed', fontFamily: 'inherit' }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: toast.includes('Error') || toast.includes('❌') ? '#ff6b6b' : toast.includes('⚠') ? '#ffd18a' : 'rgba(130,220,170,.8)', flexShrink: 0 }} />
          {toast}
        </div>
      )}
    </Shell>
  )
}
