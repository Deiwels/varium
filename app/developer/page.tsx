'use client'
import { useEffect, useState, useMemo } from 'react'
import { devFetch } from './_lib/dev-fetch'
import { exportToCSV } from './_lib/export'
import { MiniChart } from './_components/MiniChart'
import { StatCard } from './_components/StatCard'
import { StatusBadge } from './_components/StatusBadge'
import { DevErrorBoundary } from './_components/DevErrorBoundary'
import { useToast } from './_components/Toast'
import type { PlatformData, Workspace } from './_types'

const card: React.CSSProperties = {
  borderRadius: 16, border: '1px solid rgba(255,255,255,.06)',
  background: 'rgba(255,255,255,.03)', padding: '20px 24px',
}
const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' }
const th: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.3)',
  textTransform: 'uppercase', letterSpacing: '.1em', textAlign: 'left',
  padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,.06)',
  cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
}
const td: React.CSSProperties = {
  fontSize: 13, color: 'rgba(255,255,255,.55)',
  padding: '10px 10px', borderBottom: '1px solid rgba(255,255,255,.03)',
}

type SortCol = keyof Pick<Workspace, 'name' | 'plan' | 'status' | 'bookings' | 'clients' | 'staff' | 'created_at'>
type SortDir = 'asc' | 'desc'

function relTime(date: Date) {
  const diff = Date.now() - date.getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  return `${Math.floor(diff / 3600000)}h ago`
}

function SortArrow({ col, sortCol, sortDir }: { col: string; sortCol: string; sortDir: SortDir }) {
  if (col !== sortCol) return <span style={{ color: 'rgba(255,255,255,.15)', marginLeft: 4 }}>↕</span>
  return <span style={{ color: 'rgba(130,150,220,.8)', marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
}

function DeveloperOverviewInner() {
  const [data, setData] = useState<PlatformData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<SortCol>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const toast = useToast()

  function load() {
    setLoading(true)
    devFetch('/api/vurium-dev/platform')
      .then(d => { setData(d as PlatformData); setLastFetched(new Date()) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const filteredWorkspaces = useMemo(() => {
    if (!data?.workspaces) return []
    const q = search.toLowerCase()
    let ws = q
      ? data.workspaces.filter(w =>
          (w.name || '').toLowerCase().includes(q) ||
          (w.slug || '').toLowerCase().includes(q) ||
          w.plan.toLowerCase().includes(q) ||
          w.status.toLowerCase().includes(q)
        )
      : [...data.workspaces]

    ws.sort((a, b) => {
      let av: string | number = a[sortCol] ?? ''
      let bv: string | number = b[sortCol] ?? ''
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
    return ws
  }, [data, search, sortCol, sortDir])

  function handleExportCSV() {
    if (!filteredWorkspaces.length) return
    const rows = filteredWorkspaces.map(w => ({
      id: w.id, name: w.name, slug: w.slug, plan: w.plan, status: w.status,
      bookings: w.bookings, clients: w.clients, staff: w.staff,
      sms_number: w.sms_number ?? '', created_at: w.created_at ?? '',
    }))
    exportToCSV(rows, `workspaces-${new Date().toISOString().split('T')[0]}.csv`)
    toast.show('CSV exported')
  }

  if (loading && !data) return (
    <div style={{ padding: 60, textAlign: 'center', color: 'rgba(255,255,255,.3)', fontSize: 13 }}>
      Loading platform data...
    </div>
  )
  if (!data) return (
    <div style={{ padding: 60, textAlign: 'center', color: 'rgba(255,255,255,.3)', fontSize: 13 }}>
      Failed to load. <button onClick={load} style={{ color: 'rgba(130,150,220,.8)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>Retry</button>
    </div>
  )

  const signupChart = useMemo(() => data?.signups_by_day
    ? Object.entries(data.signups_by_day).sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value }))
    : [], [data])

  const { totalBookings, totalClients, totalStaff } = useMemo(() => ({
    totalBookings: (data?.workspaces || []).reduce((a, w) => a + (w.bookings || 0), 0),
    totalClients:  (data?.workspaces || []).reduce((a, w) => a + (w.clients  || 0), 0),
    totalStaff:    (data?.workspaces || []).reduce((a, w) => a + (w.staff    || 0), 0),
  }), [data])

  const thProps = (col: SortCol) => ({
    style: th,
    onClick: () => toggleSort(col),
  })

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,.85)', margin: 0 }}>Overview</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginTop: 4 }}>
            VuriumBook platform metrics
            {lastFetched && <span style={{ marginLeft: 8 }}>· updated {relTime(lastFetched)}</span>}
          </p>
        </div>
        <button onClick={load} disabled={loading} style={{
          height: 34, padding: '0 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
          background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.5)',
          fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
          opacity: loading ? 0.5 : 1,
        }}>
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {/* Top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard label="Workspaces" value={data.total_workspaces} color="rgba(130,150,220,.9)" />
        <StatCard label="Paid" value={data.paid_count} color="rgba(130,220,170,.9)" />
        <StatCard label="Trialing" value={data.trial_count} color="rgba(220,170,100,.9)" />
        <StatCard label="Conversion" value={`${data.trial_conversion_rate}%`} color="rgba(255,255,255,.6)" />
        <StatCard label="Signups (7d)" value={data.signups_7d} color="rgba(130,150,220,.7)" />
        <StatCard label="Signups (30d)" value={data.signups_30d} color="rgba(130,150,220,.5)" />
        {data.mrr != null && (
          <StatCard label="MRR" value={`$${data.mrr.toLocaleString()}`} color="rgba(130,220,170,.85)" />
        )}
        {data.arr != null && (
          <StatCard label="ARR" value={`$${data.arr.toLocaleString()}`} color="rgba(130,220,170,.7)" />
        )}
        {data.churn_30d != null && (
          <StatCard label="Churn (30d)" value={`${data.churn_30d}%`} color="rgba(220,100,100,.8)" />
        )}
      </div>

      {/* Signup chart + Plan breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={card}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Signups (last 30 days)</span>
          <div style={{ marginTop: 8 }}>
            {signupChart.length > 0
              ? <MiniChart data={signupChart} color="rgba(130,220,170,.7)" gradientId="overview-signup" />
              : <p style={{ fontSize: 12, color: 'rgba(255,255,255,.2)', margin: '20px 0' }}>No signups yet</p>
            }
          </div>
        </div>

        <div style={card}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', display: 'block', marginBottom: 14 }}>Plans</span>
          {data.by_plan && Object.entries(data.by_plan).map(([plan, count]) => {
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
            {data.by_status && Object.entries(data.by_status).filter(([, c]) => c > 0).map(([status, count]) => (
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
        <StatCard label="Total Bookings" value={totalBookings.toLocaleString()} sub="across all workspaces" color="rgba(130,150,220,.7)" />
        <StatCard label="Total Clients"  value={totalClients.toLocaleString()}  sub="across all workspaces" color="rgba(130,220,170,.7)" />
        <StatCard label="Total Staff"    value={totalStaff.toLocaleString()}    sub="active barbers/stylists" color="rgba(220,170,100,.7)" />
      </div>

      {/* Workspaces table */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', flex: 1 }}>
            All Workspaces
            {search && <span style={{ color: 'rgba(255,255,255,.2)', marginLeft: 8 }}>({filteredWorkspaces.length} results)</span>}
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search workspaces…"
            style={{
              height: 32, padding: '0 12px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,.1)', background: 'rgba(0,0,0,.3)',
              color: '#fff', fontSize: 12, fontFamily: 'inherit', outline: 'none', width: 200,
            }}
          />
          <button onClick={handleExportCSV} style={{
            height: 32, padding: '0 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.4)',
            fontSize: 12, fontWeight: 600, fontFamily: 'inherit', flexShrink: 0,
          }}>
            Export CSV
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={tbl}>
            <thead>
              <tr>
                <th {...thProps('name')}>Business <SortArrow col="name" sortCol={sortCol} sortDir={sortDir} /></th>
                <th {...thProps('plan')}>Plan <SortArrow col="plan" sortCol={sortCol} sortDir={sortDir} /></th>
                <th {...thProps('status')}>Status <SortArrow col="status" sortCol={sortCol} sortDir={sortDir} /></th>
                <th {...thProps('bookings')}>Bookings <SortArrow col="bookings" sortCol={sortCol} sortDir={sortDir} /></th>
                <th {...thProps('clients')}>Clients <SortArrow col="clients" sortCol={sortCol} sortDir={sortDir} /></th>
                <th {...thProps('staff')}>Staff <SortArrow col="staff" sortCol={sortCol} sortDir={sortDir} /></th>
                <th style={th}>SMS</th>
                <th {...thProps('created_at')}>Created <SortArrow col="created_at" sortCol={sortCol} sortDir={sortDir} /></th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkspaces.map(ws => (
                <tr
                  key={ws.id}
                  style={{ transition: 'background .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={td}>
                    <div style={{ fontWeight: 600, color: 'rgba(255,255,255,.7)' }}>{ws.name || ws.id}</div>
                    {ws.slug && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 2 }}>/{ws.slug}</div>}
                  </td>
                  <td style={td}>
                    <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'capitalize', color: ws.plan === 'salon' ? 'rgba(130,220,170,.7)' : ws.plan === 'custom' ? 'rgba(220,170,100,.7)' : 'rgba(130,150,220,.7)' }}>
                      {ws.plan}
                    </span>
                  </td>
                  <td style={td}><StatusBadge status={ws.status} /></td>
                  <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{ws.bookings?.toLocaleString()}</td>
                  <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{ws.clients?.toLocaleString()}</td>
                  <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{ws.staff}</td>
                  <td style={td}>
                    {ws.sms_number
                      ? <span style={{ fontSize: 11, color: 'rgba(130,220,170,.6)' }}>{ws.sms_number}</span>
                      : <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>{ws.sms_status === 'none' ? '--' : ws.sms_status}</span>
                    }
                  </td>
                  <td style={{ ...td, fontSize: 11, color: 'rgba(255,255,255,.3)' }}>
                    {ws.created_at
                      ? new Date(ws.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '--'}
                  </td>
                </tr>
              ))}
              {filteredWorkspaces.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ ...td, textAlign: 'center', color: 'rgba(255,255,255,.2)', padding: 40 }}>
                    {search ? `No workspaces matching "${search}"` : 'No workspaces yet'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export default function DeveloperOverview() {
  return (
    <DevErrorBoundary>
      <DeveloperOverviewInner />
    </DevErrorBoundary>
  )
}
