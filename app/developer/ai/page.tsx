'use client'
import { useEffect, useState, useCallback } from 'react'
import { API } from '@/lib/api'

const card: React.CSSProperties = {
  borderRadius: 16, border: '1px solid rgba(255,255,255,.06)',
  background: 'rgba(255,255,255,.03)',
}
const btnPrimary: React.CSSProperties = {
  height: 36, padding: '0 24px', borderRadius: 999, border: 'none', cursor: 'pointer',
  background: 'rgba(130,150,220,.15)', color: 'rgba(130,150,220,.9)', fontSize: 13,
  fontWeight: 600, fontFamily: 'inherit',
}

function devFetch(path: string, opts?: RequestInit) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('vurium_dev_token') || '' : ''
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts?.headers as Record<string, string> || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(`${API}${path}`, { credentials: 'include', ...opts, headers }).then(r => r.json())
}

interface Issue {
  severity: 'critical' | 'warning' | 'info'
  category: string
  title: string
  description: string
  recommendation: string
}

interface Scan {
  id: string
  status: 'running' | 'completed' | 'failed'
  triggered_by: 'auto' | 'manual'
  started_at: string
  completed_at: string | null
  health_score: number | null
  summary: string
  issue_counts: { critical: number; warning: number; info: number }
  duration_ms: number | null
  issues?: Issue[]
  error?: string
}

const SEV_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'rgba(220,100,100,.1)', text: 'rgba(220,100,100,.7)' },
  warning: { bg: 'rgba(220,170,100,.1)', text: 'rgba(220,170,100,.8)' },
  info: { bg: 'rgba(130,150,220,.1)', text: 'rgba(130,150,220,.8)' },
}

const CAT_LABELS: Record<string, string> = {
  errors: 'Errors',
  data_integrity: 'Data',
  security: 'Security',
  performance: 'Performance',
  user_experience: 'UX',
}

function scoreColor(score: number) {
  if (score >= 80) return 'rgba(130,220,170,.8)'
  if (score >= 50) return 'rgba(220,170,100,.8)'
  return 'rgba(220,100,100,.8)'
}

function relTime(iso: string) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function AIDiagnosticsPage() {
  const [scans, setScans] = useState<Scan[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [nextScanAt, setNextScanAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedData, setExpandedData] = useState<Record<string, Scan>>({})

  const loadScans = useCallback(() => {
    devFetch('/api/vurium-dev/ai/scans')
      .then(d => {
        setScans(d.scans || [])
        setIsRunning(d.is_running || false)
        setNextScanAt(d.next_scan_at || null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadScans() }, [loadScans])

  // Poll while scan is running
  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(loadScans, 3000)
    return () => clearInterval(interval)
  }, [isRunning, loadScans])

  async function triggerScan() {
    setIsRunning(true)
    await devFetch('/api/vurium-dev/ai/scan', { method: 'POST' }).catch(() => {})
    setTimeout(loadScans, 1000)
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!expandedData[id]) {
      const data = await devFetch(`/api/vurium-dev/ai/scans/${id}`).catch(() => null)
      if (data) setExpandedData(prev => ({ ...prev, [id]: data }))
    }
  }

  const latest = scans.find(s => s.status === 'completed')

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,.85)', margin: 0 }}>AI Diagnostics</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginTop: 4 }}>Claude-powered platform health monitoring</p>
        </div>
        <button onClick={triggerScan} disabled={isRunning} style={{
          ...btnPrimary, opacity: isRunning ? 0.5 : 1,
        }}>{isRunning ? 'Scanning...' : 'Run Scan'}</button>
      </div>

      {/* Status cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <div style={{ ...card, padding: '16px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>Health Score</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: latest ? scoreColor(latest.health_score || 0) : 'rgba(255,255,255,.15)' }}>
            {latest ? latest.health_score : '—'}
          </div>
        </div>
        <div style={{ ...card, padding: '16px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>Last Scan</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,.6)' }}>
            {latest ? relTime(latest.started_at) : '—'}
          </div>
          {isRunning && <div style={{ fontSize: 11, color: 'rgba(130,150,220,.7)', marginTop: 4 }}>Scan in progress...</div>}
        </div>
        <div style={{ ...card, padding: '16px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>Next Scan</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,.6)' }}>
            {nextScanAt ? relTime(nextScanAt) : '—'}
          </div>
        </div>
        <div style={{ ...card, padding: '16px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>Issues</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {latest ? ['critical', 'warning', 'info'].map(sev => {
              const count = latest.issue_counts?.[sev as keyof typeof latest.issue_counts] || 0
              if (!count) return null
              const c = SEV_COLORS[sev]
              return <span key={sev} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, fontWeight: 600, background: c.bg, color: c.text }}>{count} {sev}</span>
            }) : <span style={{ fontSize: 15, color: 'rgba(255,255,255,.15)' }}>—</span>}
          </div>
        </div>
      </div>

      {/* Latest scan summary */}
      {latest?.summary && (
        <div style={{ ...card, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>AI Summary</div>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,.6)', margin: 0, lineHeight: 1.6 }}>{latest.summary}</p>
        </div>
      )}

      {/* Current issues */}
      {latest?.issues && latest.issues.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 12 }}>Current Issues</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {latest.issues.map((issue, i) => (
              <IssueCard key={i} issue={issue} />
            ))}
          </div>
        </div>
      )}

      {/* Scan history */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Scan History</span>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.2)', fontSize: 12 }}>Loading...</div>
        ) : scans.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.2)', fontSize: 12 }}>No scans yet. Click "Run Scan" to start.</div>
        ) : (
          scans.map(scan => (
            <div key={scan.id}>
              <button onClick={() => toggleExpand(scan.id)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', width: '100%',
                borderBottom: '1px solid rgba(255,255,255,.03)', background: expandedId === scan.id ? 'rgba(255,255,255,.02)' : 'transparent',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                transition: 'background .1s',
              }}
                onMouseEnter={e => { if (expandedId !== scan.id) e.currentTarget.style.background = 'rgba(255,255,255,.02)' }}
                onMouseLeave={e => { if (expandedId !== scan.id) e.currentTarget.style.background = 'transparent' }}
              >
                {/* Status dot */}
                <div style={{
                  width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                  background: scan.status === 'running' ? 'rgba(130,150,220,.7)' :
                    scan.status === 'failed' ? 'rgba(220,100,100,.7)' :
                    scan.health_score && scan.health_score >= 80 ? 'rgba(130,220,170,.7)' :
                    scan.health_score && scan.health_score >= 50 ? 'rgba(220,170,100,.7)' : 'rgba(220,100,100,.7)',
                }} />

                {/* Time */}
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', width: 80, flexShrink: 0 }}>
                  {relTime(scan.started_at)}
                </span>

                {/* Trigger */}
                <span style={{
                  fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 600, flexShrink: 0,
                  background: scan.triggered_by === 'manual' ? 'rgba(130,150,220,.1)' : 'rgba(255,255,255,.04)',
                  color: scan.triggered_by === 'manual' ? 'rgba(130,150,220,.7)' : 'rgba(255,255,255,.25)',
                }}>{scan.triggered_by}</span>

                {/* Score */}
                <span style={{
                  fontSize: 14, fontWeight: 600, width: 40, flexShrink: 0, textAlign: 'center',
                  color: scan.status === 'completed' && scan.health_score != null ? scoreColor(scan.health_score) : 'rgba(255,255,255,.15)',
                }}>{scan.status === 'completed' && scan.health_score != null ? scan.health_score : scan.status === 'running' ? '...' : '—'}</span>

                {/* Issues */}
                <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                  {scan.status === 'completed' && ['critical', 'warning', 'info'].map(sev => {
                    const count = scan.issue_counts?.[sev as keyof typeof scan.issue_counts] || 0
                    if (!count) return null
                    const c = SEV_COLORS[sev]
                    return <span key={sev} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600, background: c.bg, color: c.text }}>{count}</span>
                  })}
                </div>

                {/* Duration */}
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', flexShrink: 0 }}>
                  {scan.duration_ms ? `${(scan.duration_ms / 1000).toFixed(1)}s` : ''}
                </span>

                {/* Expand arrow */}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, transform: expandedId === scan.id ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
                  <path d="M4 2l4 4-4 4" stroke="rgba(255,255,255,.2)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Expanded details */}
              {expandedId === scan.id && expandedData[scan.id] && (
                <div style={{ padding: '16px 20px 20px 40px', borderBottom: '1px solid rgba(255,255,255,.04)', background: 'rgba(255,255,255,.01)' }}>
                  {expandedData[scan.id].error && (
                    <div style={{ fontSize: 13, color: 'rgba(220,100,100,.7)', marginBottom: 12 }}>Error: {expandedData[scan.id].error}</div>
                  )}
                  {expandedData[scan.id].summary && (
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', margin: '0 0 16px', lineHeight: 1.6 }}>{expandedData[scan.id].summary}</p>
                  )}
                  {expandedData[scan.id].issues && expandedData[scan.id].issues!.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {expandedData[scan.id].issues!.map((issue, i) => (
                        <IssueCard key={i} issue={issue} compact />
                      ))}
                    </div>
                  )}
                  {expandedData[scan.id].issues?.length === 0 && expandedData[scan.id].status === 'completed' && (
                    <div style={{ fontSize: 13, color: 'rgba(130,220,170,.6)' }}>No issues found</div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  )
}

function IssueCard({ issue, compact }: { issue: Issue; compact?: boolean }) {
  const c = SEV_COLORS[issue.severity] || SEV_COLORS.info
  return (
    <div style={{
      ...card, padding: compact ? '12px 16px' : '16px 20px',
      borderLeft: `3px solid ${c.text}`,
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase', background: c.bg, color: c.text }}>{issue.severity}</span>
        <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.3)' }}>{CAT_LABELS[issue.category] || issue.category}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,.7)', marginBottom: 4 }}>{issue.title}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', lineHeight: 1.5, marginBottom: 8 }}>{issue.description}</div>
      <div style={{ fontSize: 12, color: 'rgba(130,150,220,.6)', lineHeight: 1.5 }}>
        <span style={{ fontWeight: 600, marginRight: 4 }}>Recommendation:</span>{issue.recommendation}
      </div>
    </div>
  )
}

function AutoLoad({ id, onLoad }: { id: string; onLoad: (data: Scan) => void }) {
  useEffect(() => {
    devFetch(`/api/vurium-dev/ai/scans/${id}`)
      .then(data => { if (data && data.id) onLoad(data) })
      .catch(() => {})
  }, [id, onLoad])
  return null
}
