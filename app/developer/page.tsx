'use client'
import { useEffect, useState } from 'react'
import { API } from '@/lib/api'

const card: React.CSSProperties = {
  borderRadius: 16, border: '1px solid rgba(255,255,255,.06)',
  background: 'rgba(255,255,255,.03)', backdropFilter: 'blur(12px)', padding: '20px 24px',
}
const statCard: React.CSSProperties = {
  ...card, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140,
}
const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' }
const th: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.1em', textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,.06)' }
const td: React.CSSProperties = { fontSize: 13, color: 'rgba(255,255,255,.55)', padding: '10px 10px', borderBottom: '1px solid rgba(255,255,255,.03)' }

function devFetch(path: string) {
  return fetch(`${API}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' } }).then(r => r.json())
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    active: { bg: 'rgba(130,220,170,.1)', text: 'rgba(130,220,170,.8)' },
    trialing: { bg: 'rgba(130,150,220,.1)', text: 'rgba(130,150,220,.8)' },
    past_due: { bg: 'rgba(220,170,100,.1)', text: 'rgba(220,170,100,.8)' },
    canceled: { bg: 'rgba(220,100,100,.1)', text: 'rgba(220,100,100,.7)' },
    inactive: { bg: 'rgba(255,255,255,.04)', text: 'rgba(255,255,255,.3)' },
  }
  const c = colors[status] || colors.inactive
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: c.bg, color: c.text, textTransform: 'uppercase', letterSpacing: '.05em' }}>
      {status}
    </span>
  )
}

function MiniChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.value), 1)
  const w = 300, h = 60, px = data.length > 1 ? w / (data.length - 1) : 0
  const points = data.map((d, i) => `${i * px},${h - (d.value / max) * (h - 6)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h + 4}`} style={{ width: '100%', height: 70 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h + 4} ${points} ${w},${h + 4}`} fill="url(#sg)" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function DeveloperOverview() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    devFetch('/api/vurium-dev/platform')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'rgba(255,255,255,.3)', fontSize: 13 }}>Loading platform data...</div>
  if (!data) return <div style={{ padding: 60, textAlign: 'center', color: 'rgba(255,255,255,.3)', fontSize: 13 }}>Failed to load</div>

  const signupChart = data.signups_by_day
    ? Object.entries(data.signups_by_day).sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value: value as number }))
    : []

  const totalBookings = (data.workspaces || []).reduce((a: number, w: any) => a + (w.bookings || 0), 0)
  const totalClients = (data.workspaces || []).reduce((a: number, w: any) => a + (w.clients || 0), 0)
  const totalStaff = (data.workspaces || []).reduce((a: number, w: any) => a + (w.staff || 0), 0)

  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,.85)', margin: 0 }}>Overview</h1>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginTop: 4 }}>VuriumBook platform metrics</p>
      </div>

      {/* Top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div style={statCard}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Workspaces</span>
          <span style={{ fontSize: 32, fontWeight: 700, color: 'rgba(130,150,220,.9)' }}>{data.total_workspaces}</span>
        </div>
        <div style={statCard}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Paid</span>
          <span style={{ fontSize: 32, fontWeight: 700, color: 'rgba(130,220,170,.9)' }}>{data.paid_count}</span>
        </div>
        <div style={statCard}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Trialing</span>
          <span style={{ fontSize: 32, fontWeight: 700, color: 'rgba(220,170,100,.9)' }}>{data.trial_count}</span>
        </div>
        <div style={statCard}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Conversion</span>
          <span style={{ fontSize: 32, fontWeight: 700, color: 'rgba(255,255,255,.6)' }}>{data.trial_conversion_rate}%</span>
        </div>
        <div style={statCard}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Signups (7d)</span>
          <span style={{ fontSize: 32, fontWeight: 700, color: 'rgba(130,150,220,.7)' }}>{data.signups_7d}</span>
        </div>
        <div style={statCard}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Signups (30d)</span>
          <span style={{ fontSize: 32, fontWeight: 700, color: 'rgba(130,150,220,.5)' }}>{data.signups_30d}</span>
        </div>
      </div>

      {/* Row: Signup chart + Plan breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={card}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Signups (last 30 days)</span>
          <div style={{ marginTop: 8 }}>
            {signupChart.length > 0 ? <MiniChart data={signupChart} color="rgba(130,220,170,.7)" /> : <p style={{ fontSize: 12, color: 'rgba(255,255,255,.2)', margin: '20px 0' }}>No signups yet</p>}
          </div>
        </div>

        <div style={card}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: 14 }}>Plans</span>
          {data.by_plan && Object.entries(data.by_plan).map(([plan, count]: any) => {
            const total = data.total_workspaces || 1
            const pct = Math.round((count / total) * 100)
            const colors: Record<string, string> = { individual: 'rgba(130,150,220,.6)', salon: 'rgba(130,220,170,.6)', custom: 'rgba(220,170,100,.6)' }
            return (
              <div key={plan} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,.5)', marginBottom: 4 }}>
                  <span style={{ textTransform: 'capitalize' }}>{plan}</span>
                  <span>{count} ({pct}%)</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,.06)' }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: colors[plan] || 'rgba(255,255,255,.2)', minWidth: count > 0 ? 4 : 0 }} />
                </div>
              </div>
            )
          })}

          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: 10 }}>Status</span>
            {data.by_status && Object.entries(data.by_status).filter(([,c]: any) => c > 0).map(([status, count]: any) => (
              <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                <StatusBadge status={status} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.5)' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Platform totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <div style={statCard}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Total Bookings</span>
          <span style={{ fontSize: 24, fontWeight: 700, color: 'rgba(130,150,220,.7)' }}>{totalBookings.toLocaleString()}</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.25)' }}>across all workspaces</span>
        </div>
        <div style={statCard}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Total Clients</span>
          <span style={{ fontSize: 24, fontWeight: 700, color: 'rgba(130,220,170,.7)' }}>{totalClients.toLocaleString()}</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.25)' }}>across all workspaces</span>
        </div>
        <div style={statCard}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Total Staff</span>
          <span style={{ fontSize: 24, fontWeight: 700, color: 'rgba(220,170,100,.7)' }}>{totalStaff.toLocaleString()}</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.25)' }}>active barbers/stylists</span>
        </div>
      </div>

      {/* Workspaces table */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em' }}>All Workspaces</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={tbl}>
            <thead>
              <tr>
                <th style={th}>Business</th>
                <th style={th}>Plan</th>
                <th style={th}>Status</th>
                <th style={th}>Bookings</th>
                <th style={th}>Clients</th>
                <th style={th}>Staff</th>
                <th style={th}>SMS</th>
                <th style={th}>Created</th>
              </tr>
            </thead>
            <tbody>
              {(data.workspaces || []).map((ws: any) => (
                <tr key={ws.id} style={{ transition: 'background .15s' }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.02)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={td}>
                    <div style={{ fontWeight: 600, color: 'rgba(255,255,255,.7)' }}>{ws.name || ws.id}</div>
                    {ws.slug && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 2 }}>/{ws.slug}</div>}
                  </td>
                  <td style={td}>
                    <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'capitalize', color: ws.plan === 'salon' ? 'rgba(130,220,170,.7)' : ws.plan === 'custom' ? 'rgba(220,170,100,.7)' : 'rgba(130,150,220,.7)' }}>{ws.plan}</span>
                  </td>
                  <td style={td}><StatusBadge status={ws.status} /></td>
                  <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{ws.bookings?.toLocaleString()}</td>
                  <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{ws.clients?.toLocaleString()}</td>
                  <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{ws.staff}</td>
                  <td style={td}>
                    {ws.sms_number ? (
                      <span style={{ fontSize: 11, color: 'rgba(130,220,170,.6)' }}>{ws.sms_number}</span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>{ws.sms_status === 'none' ? '--' : ws.sms_status}</span>
                    )}
                  </td>
                  <td style={{ ...td, fontSize: 11, color: 'rgba(255,255,255,.3)' }}>
                    {ws.created_at ? new Date(ws.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--'}
                  </td>
                </tr>
              ))}
              {(!data.workspaces || data.workspaces.length === 0) && (
                <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: 'rgba(255,255,255,.2)' }}>No workspaces yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
