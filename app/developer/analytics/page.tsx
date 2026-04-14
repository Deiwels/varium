'use client'
import { useEffect, useState, useMemo } from 'react'
import { devFetch } from '../_lib/dev-fetch'
import { MiniChart } from '../_components/MiniChart'
import { StatCard } from '../_components/StatCard'
import { DevErrorBoundary } from '../_components/DevErrorBoundary'
import type { AnalyticsData } from '../_types'

const card: React.CSSProperties = {
  borderRadius: 16, border: '1px solid rgba(255,255,255,.06)',
  background: 'rgba(255,255,255,.03)', padding: '20px 24px',
}

function AdminDashboardInner() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [range, setRange] = useState('7d')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    devFetch(`/api/vurium-dev/analytics?range=${range}`)
      .then(d => setData(d as AnalyticsData))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [range])

  const chartData = useMemo(() => data?.by_day
    ? Object.entries(data.by_day).sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value }))
    : [], [data])

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
            <StatCard label="Pageviews" value={data.total_pageviews?.toLocaleString()} color="rgba(130,150,220,.9)" />
            <StatCard label="Visitors"  value={data.unique_visitors?.toLocaleString()} color="rgba(130,220,170,.9)" />
            <StatCard label="Sessions"  value={data.unique_sessions?.toLocaleString()} color="rgba(220,170,100,.9)" />
            <StatCard
              label="Pages/Session"
              value={data.unique_sessions ? (data.total_pageviews / data.unique_sessions).toFixed(1) : '0'}
              color="rgba(255,255,255,.6)"
            />
            {data.bounce_rate != null && (
              <StatCard label="Bounce Rate" value={`${data.bounce_rate.toFixed(1)}%`} color="rgba(220,170,100,.7)" />
            )}
            {data.avg_session_duration != null && (
              <StatCard label="Avg Session" value={`${Math.round(data.avg_session_duration)}s`} color="rgba(130,150,220,.7)" />
            )}
          </div>

          {/* Chart */}
          <div style={{ ...card, marginBottom: 20 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
              Pageviews over time
            </span>
            <div style={{ marginTop: 12 }}>
              <MiniChart data={chartData} color="rgba(130,150,220,.8)" gradientId="analytics-pageviews" height={100} dots />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              {chartData.length > 0 && <span style={{ fontSize: 10, color: 'rgba(255,255,255,.2)' }}>{chartData[0].label}</span>}
              {chartData.length > 1 && <span style={{ fontSize: 10, color: 'rgba(255,255,255,.2)' }}>{chartData[chartData.length - 1].label}</span>}
            </div>
          </div>

          {/* Top pages + Referrers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div style={card}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: 12 }}>Top Pages</span>
              {(data.top_pages || []).map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.04)', gap: 8 }}>
                  <span
                    title={p.url}
                    style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}
                  >
                    {p.url}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(130,150,220,.7)', flexShrink: 0 }}>{p.count}</span>
                </div>
              ))}
              {!data.top_pages?.length && <span style={{ fontSize: 12, color: 'rgba(255,255,255,.2)' }}>No data</span>}
            </div>

            <div style={card}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: 12 }}>Top Referrers</span>
              {(data.top_referrers || []).map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>{r.source}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(130,220,170,.7)' }}>{r.count}</span>
                </div>
              ))}
              {!data.top_referrers?.length && <span style={{ fontSize: 12, color: 'rgba(255,255,255,.2)' }}>No data</span>}
            </div>
          </div>

          {/* Devices + Funnel */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div style={card}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: 12 }}>Devices</span>
              {data.devices && Object.entries(data.devices).map(([device, count]) => {
                const total = Object.values(data.devices).reduce((a, b) => a + b, 0)
                const pct = total ? Math.round((count / total) * 100) : 0
                const devColor = device === 'desktop' ? 'rgba(130,150,220,.6)' : device === 'mobile' ? 'rgba(130,220,170,.6)' : 'rgba(220,170,100,.6)'
                return (
                  <div key={device} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,.5)', marginBottom: 4 }}>
                      <span style={{ textTransform: 'capitalize' }}>{device}</span>
                      <span>{pct}% ({count})</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,.06)' }}>
                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: devColor }} />
                    </div>
                  </div>
                )
              })}
            </div>

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

          {/* Country breakdown (optional) */}
          {data.by_country && data.by_country.length > 0 && (
            <div style={card}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: 12 }}>Top Countries</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                {data.by_country.slice(0, 10).map((c, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(255,255,255,.5)', padding: '4px 0' }}>
                    <span>{c.country || 'Unknown'}</span>
                    <span style={{ fontWeight: 600, color: 'rgba(130,150,220,.7)' }}>{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}

export default function AdminDashboard() {
  return (
    <DevErrorBoundary>
      <AdminDashboardInner />
    </DevErrorBoundary>
  )
}
