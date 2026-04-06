'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import Shell from '@/components/Shell'
import { apiFetch } from '@/lib/api'

// ─── Types ──────────────────────────────────────────────────────────────────
interface DayData { day: string; count: number }
interface HourData { hour: number; count: number }
interface AnalyticsData {
  total: number
  days: number
  by_source: Record<string, number>
  by_day: DayData[]
  by_hour: HourData[]
  by_referrer: Record<string, number>
  trend: { previous: number; current: number }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const SOURCE_ICONS: Record<string, string> = {
  instagram: '📸', google: '🔍', facebook: '📘', tiktok: '🎵',
  twitter: '𝕏', direct: '🔗', other: '🌐', email: '📧', yelp: '⭐',
}
const SOURCE_COLORS: Record<string, string> = {
  instagram: 'rgba(220,130,200,.7)', google: 'rgba(100,180,255,.7)',
  facebook: 'rgba(100,140,230,.7)', tiktok: 'rgba(255,100,150,.7)',
  twitter: 'rgba(200,200,200,.5)', direct: 'rgba(130,220,170,.5)',
  other: 'rgba(255,255,255,.3)', email: 'rgba(220,190,100,.7)',
  yelp: 'rgba(255,60,60,.6)',
}
const fmtDay = (iso: string) => {
  try { return new Date(iso + 'T12:00').toLocaleDateString([], { month: 'short', day: 'numeric' }) } catch { return iso }
}
const fmtWeekday = (iso: string) => {
  try { return new Date(iso + 'T12:00').toLocaleDateString([], { weekday: 'short' }) } catch { return '' }
}
const pct = (a: number, b: number) => b === 0 ? 0 : Math.round((a / b) * 100)
const avg = (total: number, days: number) => days === 0 ? '0' : (total / days).toFixed(1)

// ─── Period Tabs ────────────────────────────────────────────────────────────
type Period = '7d' | '14d' | '30d' | '90d'
const PERIODS: { key: Period; label: string; days: number }[] = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '14d', label: '14 days', days: 14 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
]

// ─── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, trend }: { label: string; value: string; sub?: string; trend?: number }) {
  return (
    <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.025)', padding: '16px 18px', flex: '1 1 0', minWidth: 140 }}>
      <div style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-.02em', lineHeight: 1, color: '#e8e8ed' }}>{value}</div>
      {(sub || trend !== undefined) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,.35)' }}>
          {trend !== undefined && trend !== 0 && (
            <span style={{ fontSize: 10, fontWeight: 600, color: trend > 0 ? 'rgba(130,220,170,.7)' : 'rgba(255,107,107,.7)' }}>
              {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
          )}
          {trend === 0 && <span style={{ fontSize: 10, color: 'rgba(255,255,255,.25)' }}>—</span>}
          {sub && <span>{sub}</span>}
        </div>
      )}
    </div>
  )
}

// ─── Bar Chart ──────────────────────────────────────────────────────────────
function BarChart({ data, labelFn, height = 120 }: { data: { label: string; value: number }[]; labelFn?: (d: { label: string; value: number }) => string; height?: number }) {
  const max = Math.max(...data.map(d => d.value), 1)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  return (
    <div style={{ position: 'relative' }}>
      {/* Y axis guides */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
        {[max, Math.round(max / 2), 0].map((v, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,.2)', width: 24, textAlign: 'right', flexShrink: 0 }}>{v}</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.04)' }} />
          </div>
        ))}
      </div>
      {/* Bars */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: data.length > 30 ? 1 : 3, height, paddingLeft: 32 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'default', minWidth: 0 }}
            onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}>
            <div style={{
              width: '100%', borderRadius: data.length > 30 ? 1 : 3, minHeight: 1,
              background: hoverIdx === i ? 'rgba(255,255,255,.4)' : (i === data.length - 1 ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.12)'),
              height: `${Math.max(1, (d.value / max) * (height - 16))}px`,
              transition: 'background .15s',
            }} />
          </div>
        ))}
      </div>
      {/* X axis labels */}
      <div style={{ display: 'flex', gap: data.length > 30 ? 1 : 3, paddingLeft: 32, marginTop: 4 }}>
        {data.map((d, i) => {
          const showLabel = data.length <= 14 || i % Math.ceil(data.length / 10) === 0 || i === data.length - 1
          return (
            <div key={i} style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
              {showLabel && <span style={{ fontSize: 7, color: 'rgba(255,255,255,.2)' }}>{labelFn ? labelFn(d) : d.label}</span>}
            </div>
          )
        })}
      </div>
      {/* Hover tooltip */}
      {hoverIdx !== null && (
        <div style={{ position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)', background: 'rgba(20,20,25,.95)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '4px 10px', fontSize: 10, color: '#e8e8ed', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {data[hoverIdx].label}: <b>{data[hoverIdx].value}</b>
        </div>
      )}
    </div>
  )
}

// ─── Horizontal Bar (for sources/referrers) ─────────────────────────────────
function HBarList({ items, colorMap }: { items: [string, number][]; colorMap?: Record<string, string> }) {
  const max = Math.max(...items.map(i => i[1]), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(([name, count]) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, width: 20, textAlign: 'center', flexShrink: 0 }}>{SOURCE_ICONS[name] || '🌐'}</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', width: 90, textTransform: 'capitalize', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
          <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,.04)', overflow: 'hidden' }}>
            <div style={{ height: 8, borderRadius: 4, background: colorMap?.[name] || 'rgba(255,255,255,.18)', width: `${(count / max) * 100}%`, transition: 'width .3s' }} />
          </div>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', width: 40, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', width: 36, textAlign: 'right', flexShrink: 0 }}>{pct(count, items.reduce((s, i) => s + i[1], 0))}%</span>
        </div>
      ))}
      {items.length === 0 && <div style={{ fontSize: 12, color: 'rgba(255,255,255,.2)', padding: 12 }}>No data yet</div>}
    </div>
  )
}

// ─── Section Card ───────────────────────────────────────────────────────────
function Section({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.02)', padding: '20px 22px', ...style }}>
      <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)', marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Main Page
// ═════════════════════════════════════════════════════════════════════════════
export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('30d')
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    abortRef.current?.abort()
    const ac = new AbortController(); abortRef.current = ac
    setLoading(true)
    try {
      const days = PERIODS.find(p => p.key === period)!.days
      const d = await apiFetch(`/api/analytics/detailed?days=${days}`)
      if (ac.signal.aborted) return
      if (d && !d.error) setData(d)
    } catch {}
    setLoading(false)
  }, [period])

  useEffect(() => { load() }, [load])

  // Derived
  const sources = data ? Object.entries(data.by_source).sort((a, b) => b[1] - a[1]) : []
  const referrers = data ? Object.entries(data.by_referrer).sort((a, b) => b[1] - a[1]).slice(0, 10) : []
  const dayChart = (data?.by_day || []).map(d => ({ label: fmtDay(d.day), value: d.count }))
  const hourChart = (data?.by_hour || []).map(d => ({ label: `${String(d.hour).padStart(2, '0')}:00`, value: d.count }))
  const trendPct = data?.trend ? (data.trend.previous === 0 ? (data.trend.current > 0 ? 100 : 0) : Math.round(((data.trend.current - data.trend.previous) / data.trend.previous) * 100)) : 0
  const peakHour = data?.by_hour ? data.by_hour.reduce((best, h) => h.count > best.count ? h : best, { hour: 0, count: 0 }) : null
  const peakDay = data?.by_day ? data.by_day.reduce((best, d) => d.count > best.count ? d : best, { day: '', count: 0 }) : null
  const avgDaily = data ? avg(data.total, data.days) : '0'

  const panelStyle: React.CSSProperties = { fontSize: 13, color: 'rgba(255,255,255,.7)', lineHeight: 1.5 }

  return (
    <Shell>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 80px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: '#e8e8ed', margin: 0, letterSpacing: '-.01em' }}>Analytics</h1>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginTop: 4 }}>Booking page traffic & sources</div>
          </div>
          {/* Period tabs */}
          <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: 2 }}>
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 11, fontWeight: 500, letterSpacing: '.02em', transition: 'all .15s',
                  background: period === p.key ? 'rgba(255,255,255,.1)' : 'transparent',
                  color: period === p.key ? '#e8e8ed' : 'rgba(255,255,255,.35)',
                }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {loading && !data && (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,.25)', fontSize: 13 }}>Loading analytics...</div>
        )}

        {data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: loading ? 0.5 : 1, transition: 'opacity .2s' }}>
            {/* KPI row */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <StatCard label="Total Visits" value={String(data.total)} trend={trendPct} sub="vs previous period" />
              <StatCard label="Daily Average" value={avgDaily} sub="visits / day" />
              <StatCard label="Peak Hour" value={peakHour && peakHour.count > 0 ? `${String(peakHour.hour).padStart(2, '0')}:00` : '—'} sub={peakHour && peakHour.count > 0 ? `${peakHour.count} visits` : 'No data'} />
              <StatCard label="Top Source" value={sources.length > 0 ? sources[0][0] : '—'} sub={sources.length > 0 ? `${sources[0][1]} visits` : 'No data'} />
            </div>

            {/* Visits over time */}
            <Section title="Visits over time">
              <BarChart data={dayChart} height={140} />
              {peakDay && peakDay.count > 0 && (
                <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,.3)' }}>
                  Best day: {fmtDay(peakDay.day)} ({fmtWeekday(peakDay.day)}) — {peakDay.count} visits
                </div>
              )}
            </Section>

            {/* Two columns: Sources + Hourly */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              <Section title="Traffic Sources">
                <HBarList items={sources} colorMap={SOURCE_COLORS} />
              </Section>

              <Section title="Visits by Hour">
                <BarChart data={hourChart} height={100} />
                <div style={{ marginTop: 8, fontSize: 10, color: 'rgba(255,255,255,.2)' }}>Hour of day (local time)</div>
              </Section>
            </div>

            {/* Referrers */}
            {referrers.length > 0 && (
              <Section title="Top Referrers">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {referrers.map(([domain, count]) => (
                    <div key={domain} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{domain}</span>
                      <div style={{ width: 120, height: 6, borderRadius: 3, background: 'rgba(255,255,255,.04)', overflow: 'hidden', flexShrink: 0 }}>
                        <div style={{ height: 6, borderRadius: 3, background: 'rgba(100,180,255,.4)', width: `${pct(count, referrers[0][1])}%` }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', width: 36, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Day of week heatmap */}
            <Section title="Day of Week Breakdown">
              {(() => {
                const byDow: Record<string, number> = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 }
                const dowOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
                ;(data.by_day || []).forEach(d => {
                  try {
                    const dow = new Date(d.day + 'T12:00').toLocaleDateString('en-US', { weekday: 'short' })
                    if (byDow[dow] !== undefined) byDow[dow] += d.count
                  } catch {}
                })
                const maxDow = Math.max(...Object.values(byDow), 1)
                return (
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                    {dowOrder.map(d => (
                      <div key={d} style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginBottom: 6 }}>{d}</div>
                        <div style={{
                          height: 40, borderRadius: 8,
                          background: `rgba(100,180,255,${0.05 + (byDow[d] / maxDow) * 0.35})`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 600, color: byDow[d] > 0 ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.15)',
                          border: '1px solid rgba(255,255,255,.04)',
                        }}>
                          {byDow[d]}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </Section>

            {/* Empty state */}
            {data.total === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,.25)' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
                <div style={{ fontSize: 14, marginBottom: 6 }}>No visits recorded yet</div>
                <div style={{ fontSize: 12 }}>Share your booking page to start tracking traffic</div>
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  )
}
