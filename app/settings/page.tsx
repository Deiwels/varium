'use client'
import Shell from '@/components/Shell'
import { useEffect, useState, useCallback } from 'react'

import { apiFetch } from '@/lib/api'
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
      <button onClick={() => onChange(!checked)} style={{ width: 44, height: 26, borderRadius: 999, border: 'none', background: checked ? 'rgba(10,132,255,.65)' : 'rgba(255,255,255,.14)', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background .2s' }}>
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
  const [users, setUsers] = useState<UserAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin'|'barber'>('barber')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { const ud = await apiFetch('/api/users'); setUsers(ud?.users || []) }
    catch (e: any) { setMsg('Error: ' + e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createUser() {
    if (!name.trim() || !email.trim() || !password) { setMsg('All fields required'); return }
    if (password.length < 6) { setMsg('Password min 6 characters'); return }
    setCreating(true); setMsg('')
    try {
      await apiFetch('/api/users', { method: 'POST', body: JSON.stringify({ name: name.trim(), username: email.trim().toLowerCase(), password, role }) })
      setName(''); setEmail(''); setPassword(''); setShowForm(false)
      setMsg('Team member added'); load()
    } catch (e: any) { setMsg('Error: ' + e.message) }
    setCreating(false)
  }

  async function resetPw(uid: string) {
    const pw = prompt('New password (min 6 chars):')
    if (!pw || pw.length < 6) return
    try { await apiFetch(`/api/users/${encodeURIComponent(uid)}`, { method: 'PATCH', body: JSON.stringify({ password: pw }) }); setMsg('Password reset'); load() }
    catch (e: any) { alert(e.message) }
  }

  async function toggleActive(uid: string, active: boolean) {
    try { await apiFetch(`/api/users/${encodeURIComponent(uid)}`, { method: 'PATCH', body: JSON.stringify({ active }) }); load() }
    catch (e: any) { alert(e.message) }
  }

  async function deleteUser(uid: string, uname: string) {
    if (!window.confirm(`Remove "${uname}" from your team?`)) return
    try { await apiFetch(`/api/users/${encodeURIComponent(uid)}?hard=true`, { method: 'DELETE' }); load() }
    catch (e: any) { alert(e?.message || 'Failed') }
  }

  const initials = (n: string) => (n || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header + Add button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>{users.length} team member{users.length !== 1 ? 's' : ''}</div>
        <button onClick={() => setShowForm(!showForm)} style={{
          padding: '8px 18px', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
          background: showForm ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.06)',
          border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.7)',
        }}>{showForm ? 'Cancel' : '+ Add member'}</button>
      </div>

      {msg && <div style={{ fontSize: 12, padding: '8px 14px', borderRadius: 10, color: msg.includes('Error') ? 'rgba(255,160,160,.8)' : 'rgba(130,220,170,.7)', background: msg.includes('Error') ? 'rgba(220,80,80,.06)' : 'rgba(130,220,170,.06)', border: `1px solid ${msg.includes('Error') ? 'rgba(220,80,80,.12)' : 'rgba(130,220,170,.12)'}` }}>{msg}</div>}

      {/* Create form */}
      {showForm && (
        <div style={{ padding: 20, borderRadius: 16, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.02)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Full name"><input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" style={inp} /></Field>
            <Field label="Email (login)"><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@business.com" style={inp} /></Field>
            <Field label="Password"><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" style={inp} /></Field>
            <Field label="Role">
              <select value={role} onChange={e => setRole(e.target.value as any)} style={inp}>
                <option value="admin">Admin — manage everything</option>
                <option value="barber">Team member — own bookings</option>
              </select>
            </Field>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users.map(u => (
            <div key={u.id} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 14,
              border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.02)',
              opacity: u.active ? 1 : 0.45, transition: 'opacity .2s',
            }}>
              {/* Avatar */}
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.5)', flexShrink: 0 }}>
                {initials(u.name || u.username)}
              </div>
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8ed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.name || u.username}
                  {!u.active && <span style={{ fontSize: 10, color: 'rgba(255,100,100,.6)', marginLeft: 8 }}>inactive</span>}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginTop: 2 }}>{u.username}</div>
              </div>
              {/* Role badge */}
              <span style={{
                fontSize: 10, fontWeight: 500, letterSpacing: '.04em', padding: '4px 10px', borderRadius: 999,
                background: u.role === 'owner' ? 'rgba(220,190,100,.08)' : u.role === 'admin' ? 'rgba(130,220,170,.06)' : 'rgba(255,255,255,.04)',
                border: `1px solid ${u.role === 'owner' ? 'rgba(220,190,100,.15)' : u.role === 'admin' ? 'rgba(130,220,170,.12)' : 'rgba(255,255,255,.08)'}`,
                color: u.role === 'owner' ? 'rgba(220,190,100,.7)' : u.role === 'admin' ? 'rgba(130,220,170,.6)' : 'rgba(255,255,255,.4)',
                textTransform: 'capitalize', flexShrink: 0,
              }}>{u.role === 'barber' ? 'member' : u.role}</span>
              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <SmBtn onClick={() => resetPw(u.id)}>Reset PW</SmBtn>
                {u.role !== 'owner' && <SmBtn danger onClick={() => toggleActive(u.id, !u.active)}>{u.active ? 'Disable' : 'Enable'}</SmBtn>}
                {u.role !== 'owner' && <SmBtn danger onClick={() => deleteUser(u.id, u.name || u.username)}>Remove</SmBtn>}
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  )
}

// ─── Main Settings Page ───────────────────────────────────────────────────────
export default function SettingsPage() {
  const [tab, setTab] = useState<'shop'|'site'|'fees'|'booking'|'payroll'|'square'|'users'|'features'|'billing'>('shop')
  const [settings, setSettings] = useState<any>({})
  const [fees, setFees] = useState<Fee[]>([])
  const [charges, setCharges] = useState<Charge[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [toast, setToast] = useState('')
  const [squareOAuth, setSquareOAuth] = useState<{ connected: boolean; merchant_id?: string; expires_at?: string; connected_at?: string }>({ connected: false })
  const [squareConnecting, setSquareConnecting] = useState(false)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const s = await apiFetch('/api/settings')
      setSettings(s || {})
      setFees(Array.isArray(s?.fees) ? s.fees : [])
      setCharges(Array.isArray(s?.charges) ? s.charges : [])
      setDirty(false)
    } catch (e: any) { showToast('Error: ' + e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Load Square OAuth status & handle callback redirect
  useEffect(() => {
    apiFetch('/api/square/oauth/status').then(d => setSquareOAuth(d)).catch(() => {})
    const params = new URLSearchParams(window.location.search)
    if (params.get('square') === 'connected') {
      showToast('Square connected successfully ✓')
      apiFetch('/api/square/oauth/status').then(d => setSquareOAuth(d)).catch(() => {})
      window.history.replaceState({}, '', '/settings')
    } else if (params.get('square') === 'error') {
      showToast('❌ Square connection failed: ' + (params.get('msg') || 'unknown error'))
      window.history.replaceState({}, '', '/settings')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function set(key: string, val: any) { setSettings((s: any) => ({ ...s, [key]: val })); setDirty(true) }
  function setNested(parent: string, key: string, val: any) { setSettings((s: any) => ({ ...s, [parent]: { ...(s[parent] || {}), [key]: val } })); setDirty(true) }

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

  async function testSquare() {
    try {
      const d = await apiFetch('/api/payments/terminal/devices')
      const devices = d?.devices || []
      showToast(devices.length ? `✓ ${devices.length} device(s): ${devices.map((x: any) => x.name).join(', ')}` : '⚠ Connected, no devices')
    } catch (e: any) { showToast('❌ ' + e.message) }
  }

  async function cleanup() {
    try { const r = await apiFetch('/api/admin/cleanup-test-payments', { method: 'DELETE' }); showToast(`Cleaned ${r?.deleted || 0} records`) }
    catch (e: any) { showToast('Error: ' + e.message) }
  }

  const s = settings
  const tax = s.tax || {}
  const booking = s.booking || {}
  const display = s.display || {}
  const payroll = s.payroll || {}
  const square = s.square || {}

  const TABS = [
    { id: 'shop', label: 'General' },
    { id: 'site', label: 'Site Builder' },
    { id: 'features', label: 'Features' },
    { id: 'fees', label: 'Fees & Charges' },
    { id: 'booking', label: 'Booking & SMS' },
    { id: 'payroll', label: 'Payroll' },
    { id: 'square', label: 'Square' },
    { id: 'users', label: 'Accounts' },
    { id: 'billing', label: 'Billing' },
  ] as const

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

        {/* Topbar */}
        <div style={{ padding: '12px 20px', background: 'rgba(0,0,0,.80)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(255,255,255,.08)', position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 className="page-title" style={{ margin: 0, fontFamily: '"Inter",sans-serif', letterSpacing: '.18em', textTransform: 'uppercase', fontSize: 15 }}>Settings</h2>
            <p style={{ margin: '3px 0 0', color: 'rgba(255,255,255,.40)', fontSize: 11, letterSpacing: '.08em' }}>
              {loading ? 'Loading…' : s.updated_at ? `Last saved ${new Date(s.updated_at).toLocaleString()}` : 'Not saved yet'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {dirty && <span style={{ fontSize: 11, padding: '4px 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,.30)', background: 'rgba(255,255,255,.08)', color: '#fff', fontWeight: 900 }}>Unsaved</span>}
            <SmBtn onClick={load}>↻</SmBtn>
            <button onClick={save} disabled={saving || loading}
              style={{ height: 40, padding: '0 20px', borderRadius: 999, border: '1px solid rgba(10,132,255,.75)', background: 'rgba(0,0,0,.75)', color: 'rgba(130,150,220,.6)', cursor: 'pointer', fontWeight: 900, fontSize: 13, fontFamily: 'inherit', boxShadow: '0 0 18px rgba(10,132,255,.25)', opacity: saving ? .5 : 1 }}>
              {saving ? 'Saving…' : 'Save all'}
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 6, padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(0,0,0,.30)', overflowX: 'auto', flexShrink: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ height: 36, padding: '0 16px', borderRadius: 999, border: `1px solid ${tab===t.id ? 'rgba(10,132,255,.55)' : 'rgba(255,255,255,.10)'}`, background: tab===t.id ? 'rgba(10,132,255,.14)' : 'rgba(255,255,255,.04)', color: tab===t.id ? 'rgba(130,150,220,.6)' : 'rgba(255,255,255,.65)', cursor: 'pointer', fontWeight: 900, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
          {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.40)' }}>Loading settings…</div> : (<>

            {/* ── SHOP ── */}
            {tab === 'shop' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
                <SectionCard title="Booking Page">
                  <Field label="Your public booking URL">
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <code style={{ flex: 1, fontSize: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.08)', color: 'rgba(255,255,255,.5)', wordBreak: 'break-all' }}>
                        vurium.com/book/{s.slug || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('VURIUMBOOK_USER') || '{}').workspace_id || '' : '')}
                      </code>
                      <button onClick={() => { const slug = s.slug || JSON.parse(localStorage.getItem('VURIUMBOOK_USER') || '{}').workspace_id || ''; navigator.clipboard.writeText(`https://vurium.com/book/${slug}`); }} style={{
                        padding: '10px 14px', borderRadius: 10, fontSize: 11, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit',
                        background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', color: 'rgba(255,255,255,.5)',
                      }}>Copy</button>
                    </div>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 6 }}>Edit your URL in Site Builder tab. Share on social media or Google Business.</p>
                  </Field>
                </SectionCard>
                <SectionCard title="Shop info">
                  <Field label="Shop name"><input value={s.shop_name || ''} onChange={e => set('shop_name', e.target.value)} placeholder="Your Business Name" style={inp} /></Field>
                  <Field label="Timezone">
                    <select value={s.timezone || 'America/Chicago'} onChange={e => set('timezone', e.target.value)} style={inp}>
                      {['America/Chicago','America/New_York','America/Los_Angeles','America/Denver','America/Phoenix'].map(tz => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  </Field>
                  <Field label="Currency">
                    <select value={s.currency || 'USD'} onChange={e => set('currency', e.target.value)} style={inp}>
                      <option value="USD">USD — US Dollar</option>
                      <option value="CAD">CAD — Canadian Dollar</option>
                      <option value="EUR">EUR — Euro</option>
                    </select>
                  </Field>
                </SectionCard>

                <SectionCard title="Tax">
                  <Toggle checked={!!tax.enabled} onChange={v => setNested('tax','enabled',v)} label="Enable tax on services" sub="Added to invoice total" />
                  {tax.enabled && <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
                      <Field label="Tax label"><input value={tax.label || ''} onChange={e => setNested('tax','label',e.target.value)} placeholder="Sales Tax" style={inp} /></Field>
                      <Field label="Tax rate %"><input type="number" min={0} max={50} step={0.01} value={tax.rate || ''} onChange={e => setNested('tax','rate',Number(e.target.value))} placeholder="8.75" style={inp} /></Field>
                    </div>
                    <Toggle checked={!!tax.included_in_price} onChange={v => setNested('tax','included_in_price',v)} label="Price includes tax" sub="Tax already built into service price" />
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', lineHeight: 1.5 }}>Example: $59.99 + 8.75% tax → client pays $65.24</div>
                  </>}
                </SectionCard>
              </div>
            )}

            {/* ── FEES ── */}
            {tab === 'fees' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <SectionCard title="Processing fees & surcharges"
                  action={<SmBtn onClick={() => { setFees(f => [...f, { id: 'fee_'+Date.now(), label: '', type: 'percent', value: 0, applies_to: 'all', enabled: true }]); setDirty(true) }}>+ Add fee</SmBtn>}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.40)' }}>Card surcharges, booking fees, processing fees</div>
                  {fees.length === 0 ? <div style={{ color: 'rgba(255,255,255,.30)', fontSize: 12, padding: '8px 0' }}>No fees — services charged at face value</div> :
                    fees.map((f, i) => (
                      <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 100px 36px', gap: 8, alignItems: 'center', padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(0,0,0,.14)' }}>
                        <input value={f.label} onChange={e => { const n=[...fees]; n[i]={...n[i],label:e.target.value}; setFees(n); setDirty(true) }} placeholder="e.g. Card surcharge" style={{...inpSm,width:'100%'}} />
                        <select value={f.type} onChange={e => { const n=[...fees]; n[i]={...n[i],type:e.target.value as any}; setFees(n); setDirty(true) }} style={inpSm}>
                          <option value="percent">%</option>
                          <option value="fixed">Fixed $</option>
                        </select>
                        <input type="number" min={0} step={0.01} value={f.value||''} onChange={e => { const n=[...fees]; n[i]={...n[i],value:Number(e.target.value)}; setFees(n); setDirty(true) }} placeholder="Value" style={inpSm} />
                        <select value={f.applies_to} onChange={e => { const n=[...fees]; n[i]={...n[i],applies_to:e.target.value}; setFees(n); setDirty(true) }} style={inpSm}>
                          <option value="all">All</option>
                          <option value="services">Services</option>
                          <option value="tips">Tips</option>
                        </select>
                        <button onClick={() => { setFees(fees.filter((_,j)=>j!==i)); setDirty(true) }} style={{ height: 34, width: 34, borderRadius: 10, border: '1px solid rgba(255,107,107,.35)', background: 'rgba(255,107,107,.08)', color: '#ff6b6b', cursor: 'pointer', fontSize: 15 }}>✕</button>
                      </div>
                    ))
                  }
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
                  <Toggle checked={booking.push_confirm !== false} onChange={v => setNested('booking','push_confirm',v)} label="Booking confirmation" sub="Push when appointment is booked" />
                  <Toggle checked={booking.push_reminder_24 !== false} onChange={v => setNested('booking','push_reminder_24',v)} label="24h reminder push" sub="Day before appointment" />
                  <Toggle checked={booking.push_reminder_2 !== false} onChange={v => setNested('booking','push_reminder_2',v)} label="2h reminder push" sub="2 hours before" />
                  <Toggle checked={booking.push_reschedule !== false} onChange={v => setNested('booking','push_reschedule',v)} label="Reschedule push" sub="When time changes" />
                  <Toggle checked={booking.push_cancel !== false} onChange={v => setNested('booking','push_cancel',v)} label="Cancellation push" sub="When appointment cancelled" />
                  <Toggle checked={booking.push_waitlist !== false} onChange={v => setNested('booking','push_waitlist',v)} label="Waitlist push" sub="When spot opens up" />
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
                          <span key={i} style={{ marginRight: 8, padding: '2px 10px', borderRadius: 999, border: '1px solid rgba(10,132,255,.40)', background: 'rgba(10,132,255,.10)', color: 'rgba(130,150,220,.6)', fontSize: 11 }}>{p}%</span>
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
                        style={{ height: 38, padding: '0 20px', borderRadius: 999, border: 'none', background: 'rgba(10,132,255,.75)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit', whiteSpace: 'nowrap', opacity: squareConnecting ? .5 : 1, transition: 'opacity .2s' }}>
                        {squareConnecting ? 'Connecting…' : 'Connect Square'}
                      </button>
                    </div>
                  )}
                </SectionCard>
              </div>
            )}

            {/* ── USERS ── */}
            {tab === 'users' && <UsersTab />}

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

                {/* Template selector */}
                <SectionCard title="Design Template">
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 14 }}>Choose how your booking page looks. Available on Custom plan.</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
                    {[
                      { id: 'classic', label: 'Classic', color: 'rgba(255,255,255,.15)' },
                      { id: 'modern', label: 'Modern', color: 'rgba(255,255,255,.12)' },
                      { id: 'bold', label: 'Bold', color: 'rgba(255,255,255,.12)' },
                      { id: 'dark-luxury', label: 'Dark Luxury', color: 'rgba(255,255,255,.12)' },
                      { id: 'colorful', label: 'Colorful', color: 'rgba(255,255,255,.12)' },
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
                    <Field label="Hero image URL">
                      <input value={(s.site_config || {}).hero_image || s.hero_media_url || ''} onChange={e => { set('site_config', { ...(s.site_config || {}), hero_image: e.target.value }); set('hero_media_url', e.target.value) }} placeholder="https://..." style={inp} />
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

                {/* Preview */}
                <div style={{ textAlign: 'center' }}>
                  <a href={`/book/${typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('VURIUMBOOK_USER') || '{}').workspace_id || '' : ''}`} target="_blank" rel="noopener" style={{
                    display: 'inline-block', padding: '10px 24px', borderRadius: 10, fontSize: 13, textDecoration: 'none',
                    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.6)',
                  }}>Preview Booking Page →</a>
                </div>
              </div>
            )}

            {/* ── FEATURES ── */}
            {tab === 'features' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Dashboard shortcuts */}
                <SectionCard title="Dashboard Shortcuts">
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 14, lineHeight: 1.5 }}>Choose which tools appear on your dashboard. Locked features require a plan upgrade.</p>
                  {[
                    { key: 'dash_calendar', label: 'Calendar', desc: 'Bookings & schedule', plan: null },
                    { key: 'dash_clients', label: 'Clients', desc: 'Your client base', plan: null },
                    { key: 'dash_payments', label: 'Payments', desc: 'Transactions', plan: null },
                    { key: 'dash_waitlist', label: 'Waitlist', desc: 'Queue & notifications', plan: 'salon' },
                    { key: 'dash_portfolio', label: 'Portfolio', desc: 'Work gallery', plan: 'salon' },
                    { key: 'dash_cash', label: 'Cash Register', desc: 'Daily reconciliation', plan: 'salon' },
                    { key: 'dash_membership', label: 'Membership', desc: 'Recurring clients', plan: 'salon' },
                    { key: 'dash_attendance', label: 'Attendance', desc: 'Clock in / out', plan: 'salon' },
                    { key: 'dash_expenses', label: 'Expenses', desc: 'Track costs', plan: 'custom' },
                    { key: 'dash_payroll', label: 'Payroll', desc: 'Commission + tips', plan: 'custom' },
                  ].map(f => {
                    const planLabels: Record<string, string> = { salon: 'SALON', custom: 'CUSTOM' }
                    const locked = f.plan !== null // For now show plan badge; real gating via usePlan on dashboard
                    const enabled = s[f.key] !== false // default on
                    return (
                      <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: locked ? 'rgba(255,255,255,.7)' : '#e8e8ed', display: 'flex', alignItems: 'center', gap: 8 }}>
                            {f.label}
                            {f.plan && <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 999, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)', color: 'rgba(255,255,255,.3)', letterSpacing: '.04em' }}>{planLabels[f.plan]}</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 2 }}>{f.desc}</div>
                        </div>
                        <button onClick={() => set(f.key, !enabled)}
                          style={{ width: 40, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', padding: 2, transition: 'background .2s', background: enabled ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.04)', position: 'relative', flexShrink: 0 }}>
                          <div style={{ width: 20, height: 20, borderRadius: 999, background: enabled ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.15)', transition: 'transform .2s, background .2s', transform: enabled ? 'translateX(16px)' : 'translateX(0)' }} />
                        </button>
                      </div>
                    )
                  })}
                </SectionCard>

                {/* Feature toggles */}
                <SectionCard title="Workspace Features">
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 14, lineHeight: 1.5 }}>Enable additional capabilities for your workspace.</p>
                  {[
                    { key: 'clock_in_enabled', label: 'Clock In / Attendance', desc: 'Team members can clock in and out.', plan: 'salon' },
                    { key: 'waitlist_enabled', label: 'Waitlist', desc: 'Clients join waitlist when no slots.', plan: 'salon' },
                    { key: 'portfolio_enabled', label: 'Portfolio', desc: 'Work gallery for team members.', plan: null },
                    { key: 'membership_enabled', label: 'Membership', desc: 'Recurring appointment subscriptions.', plan: 'salon' },
                    { key: 'cash_register_enabled', label: 'Cash Register', desc: 'Daily cash reconciliation.', plan: 'salon' },
                  ].map(f => {
                    const planLabels: Record<string, string> = { salon: 'SALON', custom: 'CUSTOM' }
                    return (
                      <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#e8e8ed', display: 'flex', alignItems: 'center', gap: 8 }}>
                            {f.label}
                            {f.plan && <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 999, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)', color: 'rgba(255,255,255,.3)', letterSpacing: '.04em' }}>{planLabels[f.plan]}</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 2 }}>{f.desc}</div>
                        </div>
                        <button onClick={() => set(f.key, !s[f.key])}
                          style={{ width: 40, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', padding: 2, transition: 'background .2s', background: s[f.key] ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.04)', position: 'relative', flexShrink: 0 }}>
                          <div style={{ width: 20, height: 20, borderRadius: 999, background: s[f.key] ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.15)', transition: 'transform .2s, background .2s', transform: s[f.key] ? 'translateX(16px)' : 'translateX(0)' }} />
                        </button>
                      </div>
                    )
                  })}
                </SectionCard>
              </div>
            )}

            {/* ── BILLING ── */}
            {tab === 'billing' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center', padding: '40px 0' }}>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,.4)' }}>Manage your subscription and payment details</p>
                <a href="/billing" style={{ display: 'inline-block', padding: '12px 28px', borderRadius: 12, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.7)', fontSize: 14, textDecoration: 'none', margin: '0 auto' }}>
                  Open Billing & Plan →
                </a>
              </div>
            )}

            {/* ── PIN RESET (visible on all tabs) ── */}
            <div style={{ marginTop: 24, padding: '14px 16px', borderRadius: 16, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#e8e8ed' }}>Quick PIN</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>{hasPinSetup() ? 'PIN is set up for fast login' : 'No PIN set — login with password each time'}</div>
                </div>
                {hasPinSetup() && (
                  <button onClick={() => { clearPin(); showToast('PIN reset — you will set a new one on next login') }}
                    style={{ height: 32, padding: '0 14px', borderRadius: 10, border: '1px solid rgba(255,107,107,.30)', background: 'rgba(255,107,107,.06)', color: 'rgba(220,130,160,.5)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    Reset PIN
                  </button>
                )}
              </div>
            </div>

          </>)}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'rgba(8,8,8,.92)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 999, padding: '10px 20px', boxShadow: '0 20px 60px rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', gap: 10, backdropFilter: 'blur(18px)', fontSize: 13, zIndex: 5000, whiteSpace: 'nowrap', color: '#e8e8ed', fontFamily: 'inherit' }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: toast.includes('Error') || toast.includes('❌') ? '#ff6b6b' : toast.includes('⚠') ? '#ffd18a' : 'rgba(130,220,170,.8)', flexShrink: 0 }} />
          {toast}
        </div>
      )}
    </Shell>
  )
}
