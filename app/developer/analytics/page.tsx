'use client'
import { useEffect, useState } from 'react'
import { API } from '@/lib/api'

const card: React.CSSProperties = {
  borderRadius: 16, border: '1px solid rgba(255,255,255,.06)',
  background: 'rgba(255,255,255,.03)', padding: '20px 24px',
}
const statCard: React.CSSProperties = {
  ...card, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160,
}

function adminFetch(path: string) {
  return fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  }).then(r => r.json())
}

function MiniChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.value), 1)
  const w = 400, h = 100, px = data.length > 1 ? w / (data.length - 1) : 0
  const points = data.map((d, i) => `${i * px},${h - (d.value / max) * (h - 10)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h + 10}`} style={{ width: '100%', height: 120 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h + 10} ${points} ${w},${h + 10}`} fill="url(#cg)" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => (
        <circle key={i} cx={i * px} cy={h - (d.value / max) * (h - 10)} r="3" fill={color} opacity=".6" />
      ))}
    </svg>
  )
}

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null)
  const [range, setRange] = useState('7d')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    adminFetch(`/api/vurium-dev/analytics?range=${range}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [range])

  const chartData = data?.by_day
    ? Object.entries(data.by_day).sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value: value as number }))
    : []

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,.85)', margin: 0 }}>Analytics</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginTop: 4 }}>vurium.com site statistics</p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['7d', '30d', '90d'].map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              padding: '6px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
              background: range === r ? 'rgba(130,150,220,.15)' : 'rgba(255,255,255,.04)',
              color: range === r ? 'rgba(130,150,220,.9)' : 'rgba(255,255,255,.4)',
            }}>{r}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'rgba(255,255,255,.3)', fontSize: 13 }}>Loading analytics...</div>
      ) : !data ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'rgba(255,255,255,.3)', fontSize: 13 }}>No data yet</div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 24 }}>
            <div style={statCard}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Pageviews</span>
              <span style={{ fontSize: 28, fontWeight: 700, color: 'rgba(130,150,220,.9)' }}>{data.total_pageviews?.toLocaleString()}</span>
            </div>
            <div style={statCard}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Visitors</span>
              <span style={{ fontSize: 28, fontWeight: 700, color: 'rgba(130,220,170,.9)' }}>{data.unique_visitors?.toLocaleString()}</span>
            </div>
            <div style={statCard}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Sessions</span>
              <span style={{ fontSize: 28, fontWeight: 700, color: 'rgba(220,170,100,.9)' }}>{data.unique_sessions?.toLocaleString()}</span>
            </div>
            <div style={statCard}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Pages/Session</span>
              <span style={{ fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,.6)' }}>
                {data.unique_sessions ? (data.total_pageviews / data.unique_sessions).toFixed(1) : '0'}
              </span>
            </div>
          </div>

          {/* Chart */}
          <div style={{ ...card, marginBottom: 20 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Pageviews over time</span>
            <div style={{ marginTop: 12 }}>
              <MiniChart data={chartData} color="rgba(130,150,220,.8)" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              {chartData.length > 0 && <span style={{ fontSize: 10, color: 'rgba(255,255,255,.2)' }}>{chartData[0].label}</span>}
              {chartData.length > 1 && <span style={{ fontSize: 10, color: 'rgba(255,255,255,.2)' }}>{chartData[chartData.length - 1].label}</span>}
            </div>
          </div>

          {/* Grid: Top pages + Referrers + Devices */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {/* Top Pages */}
            <div style={card}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: 12 }}>Top Pages</span>
              {(data.top_pages || []).map((p: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{p.url}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(130,150,220,.7)' }}>{p.count}</span>
                </div>
              ))}
              {!data.top_pages?.length && <span style={{ fontSize: 12, color: 'rgba(255,255,255,.2)' }}>No data</span>}
            </div>

            {/* Referrers */}
            <div style={card}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: 12 }}>Top Referrers</span>
              {(data.top_referrers || []).map((r: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>{r.source}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(130,220,170,.7)' }}>{r.count}</span>
                </div>
              ))}
              {!data.top_referrers?.length && <span style={{ fontSize: 12, color: 'rgba(255,255,255,.2)' }}>No data</span>}
            </div>
          </div>

          {/* Devices + Funnel */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Device breakdown */}
            <div style={card}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: 12 }}>Devices</span>
              {data.devices && Object.entries(data.devices).map(([device, count]: any) => {
                const total = Object.values(data.devices).reduce((a: number, b: any) => a + b, 0) as number
                const pct = total ? Math.round((count / total) * 100) : 0
                return (
                  <div key={device} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,.5)', marginBottom: 4 }}>
                      <span style={{ textTransform: 'capitalize' }}>{device}</span>
                      <span>{pct}% ({count})</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,.06)' }}>
                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: device === 'desktop' ? 'rgba(130,150,220,.6)' : device === 'mobile' ? 'rgba(130,220,170,.6)' : 'rgba(220,170,100,.6)' }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Conversion funnel */}
            <div style={card}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: 12 }}>Conversion Funnel</span>
              {data.funnel && (() => {
                const max = Math.max(data.funnel.landing, 1)
                const steps = [
                  { label: 'Landing /', value: data.funnel.landing, color: 'rgba(130,150,220,.6)' },
                  { label: 'Signup page', value: data.funnel.signup, color: 'rgba(220,170,100,.6)' },
                  { label: 'Completed', value: data.funnel.completed, color: 'rgba(130,220,170,.6)' },
                ]
                return steps.map((s, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,.5)', marginBottom: 4 }}>
                      <span>{s.label}</span>
                      <span>{s.value}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.06)' }}>
                      <div style={{ height: '100%', width: `${(s.value / max) * 100}%`, borderRadius: 3, background: s.color, transition: 'width .3s' }} />
                    </div>
                  </div>
                ))
              })()}
            </div>
          </div>
        </>
      )}
    </>
  )
}
