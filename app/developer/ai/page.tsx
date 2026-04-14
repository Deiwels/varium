'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useVisibilityPolling } from '@/lib/useVisibilityPolling'
import { devFetch } from '../_lib/dev-fetch'
import { IssueCard } from '../_components/IssueCard'
import { DevErrorBoundary } from '../_components/DevErrorBoundary'
import { useToast } from '../_components/Toast'
import type { Scan, SeverityFilter, Severity } from '../_types'

const POLL_INTERVAL_MS = 3000

const card: React.CSSProperties = {
  borderRadius: 16, border: '1px solid rgba(255,255,255,.06)',
  background: 'rgba(255,255,255,.03)',
}
const btnPrimary: React.CSSProperties = {
  height: 36, padding: '0 24px', borderRadius: 999, border: 'none', cursor: 'pointer',
  background: 'rgba(130,150,220,.15)', color: 'rgba(130,150,220,.9)', fontSize: 13,
  fontWeight: 600, fontFamily: 'inherit',
}

const SEV_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'rgba(220,100,100,.1)',  text: 'rgba(220,100,100,.7)' },
  warning:  { bg: 'rgba(220,170,100,.1)',  text: 'rgba(220,170,100,.8)' },
  info:     { bg: 'rgba(130,150,220,.1)',  text: 'rgba(130,150,220,.8)' },
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

function AIDiagnosticsInner() {
  const [scans, setScans] = useState<Scan[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [nextScanAt, setNextScanAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedData, setExpandedData] = useState<Record<string, Scan>>({})
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const toast = useToast()

  const loadScans = useCallback(() => {
    devFetch('/api/vurium-dev/ai/scans')
      .then(d => {
        const res = d as { scans?: Scan[]; is_running?: boolean; next_scan_at?: string }
        setScans(res.scans || [])
        setIsRunning(res.is_running || false)
        setNextScanAt(res.next_scan_at || null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadScans() }, [loadScans])

  // Poll only while scan is running AND tab is visible
  const pollWhenRunning = useCallback(() => {
    if (isRunning) loadScans()
  }, [isRunning, loadScans])
  useVisibilityPolling(pollWhenRunning, POLL_INTERVAL_MS, [pollWhenRunning])

  async function triggerScan() {
    setIsRunning(true)
    await devFetch('/api/vurium-dev/ai/scan', { method: 'POST' }).catch(() => {})
    toast.show('AI scan started', 'info')
    setTimeout(loadScans, 1000)
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!expandedData[id]) {
      const data = await devFetch(`/api/vurium-dev/ai/scans/${id}`).catch(() => null)
      if (data) setExpandedData(prev => ({ ...prev, [id]: data as Scan }))
    }
  }

  const latest = scans.find(s => s.status === 'completed')

  const filteredIssues = latest?.issues?.filter(issue =>
    severityFilter === 'all' || issue.severity === severityFilter
  ) ?? []

  const SEVERITY_FILTERS: Array<{ key: SeverityFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'critical', label: 'Critical' },
    { key: 'warning', label: 'Warning' },
    { key: 'info', label: 'Info' },
  ]

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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {latest ? (['critical', 'warning', 'info'] as Severity[]).map(sev => {
              const count = latest.issue_counts?.[sev] || 0
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

      {/* Current issues with severity filter */}
      {latest?.issues && latest.issues.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
              Current Issues
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {SEVERITY_FILTERS.map(f => (
                <button key={f.key} onClick={() => setSeverityFilter(f.key)} style={{
                  padding: '4px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                  background: severityFilter === f.key ? 'rgba(130,150,220,.15)' : 'rgba(255,255,255,.05)',
                  color: severityFilter === f.key ? 'rgba(130,150,220,.9)' : 'rgba(255,255,255,.35)',
                }}>{f.label}</button>
              ))}
            </div>
          </div>
          {filteredIssues.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredIssues.map((issue, i) => (
                <IssueCard key={i} issue={issue} />
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.25)', padding: '20px 0' }}>
              No {severityFilter === 'all' ? '' : severityFilter} issues found
            </div>
          )}
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
          <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,.2)', fontSize: 12 }}>
            No scans yet. Click "Run Scan" to start.
          </div>
        ) : (
          scans.map(scan => (
            <div key={scan.id}>
              <button
                onClick={() => toggleExpand(scan.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', width: '100%',
                  borderBottom: '1px solid rgba(255,255,255,.03)',
                  background: expandedId === scan.id ? 'rgba(255,255,255,.02)' : 'transparent',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  transition: 'background .1s',
                }}
                onMouseEnter={e => { if (expandedId !== scan.id) e.currentTarget.style.background = 'rgba(255,255,255,.02)' }}
                onMouseLeave={e => { if (expandedId !== scan.id) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                  background: scan.status === 'running' ? 'rgba(130,150,220,.7)' :
                    scan.status === 'failed' ? 'rgba(220,100,100,.7)' :
                    scan.health_score && scan.health_score >= 80 ? 'rgba(130,220,170,.7)' :
                    scan.health_score && scan.health_score >= 50 ? 'rgba(220,170,100,.7)' : 'rgba(220,100,100,.7)',
                }} />
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', width: 80, flexShrink: 0 }}>{relTime(scan.started_at)}</span>
                <span style={{
                  fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 600, flexShrink: 0,
                  background: scan.triggered_by === 'manual' ? 'rgba(130,150,220,.1)' : 'rgba(255,255,255,.04)',
                  color: scan.triggered_by === 'manual' ? 'rgba(130,150,220,.7)' : 'rgba(255,255,255,.25)',
                }}>{scan.triggered_by}</span>
                <span style={{
                  fontSize: 14, fontWeight: 600, width: 40, flexShrink: 0, textAlign: 'center',
                  color: scan.status === 'completed' && scan.health_score != null ? scoreColor(scan.health_score) : 'rgba(255,255,255,.15)',
                }}>
                  {scan.status === 'completed' && scan.health_score != null ? scan.health_score : scan.status === 'running' ? '...' : '—'}
                </span>
                <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                  {scan.status === 'completed' && (['critical', 'warning', 'info'] as Severity[]).map(sev => {
                    const count = scan.issue_counts?.[sev] || 0
                    if (!count) return null
                    const c = SEV_COLORS[sev]
                    return <span key={sev} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600, background: c.bg, color: c.text }}>{count}</span>
                  })}
                </div>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)', flexShrink: 0 }}>
                  {scan.duration_ms ? `${(scan.duration_ms / 1000).toFixed(1)}s` : ''}
                </span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, transform: expandedId === scan.id ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
                  <path d="M4 2l4 4-4 4" stroke="rgba(255,255,255,.2)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {expandedId === scan.id && expandedData[scan.id] && (
                <div style={{ padding: '16px 20px 20px 40px', borderBottom: '1px solid rgba(255,255,255,.04)', background: 'rgba(255,255,255,.01)' }}>
                  {expandedData[scan.id].error && (
                    <div style={{ fontSize: 13, color: 'rgba(220,100,100,.7)', marginBottom: 12 }}>Error: {expandedData[scan.id].error}</div>
                  )}
                  {expandedData[scan.id].summary && (
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', margin: '0 0 16px', lineHeight: 1.6 }}>{expandedData[scan.id].summary}</p>
                  )}
                  {expandedData[scan.id].issues && expandedData[scan.id].issues!.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {expandedData[scan.id].issues!.map((issue, i) => (
                        <IssueCard key={i} issue={issue} compact />
                      ))}
                    </div>
                  ) : expandedData[scan.id].status === 'completed' ? (
                    <div style={{ fontSize: 13, color: 'rgba(130,220,170,.6)' }}>No issues found</div>
                  ) : null}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  )
}

export default function AIDiagnosticsPage() {
  return (
    <DevErrorBoundary>
      <AIDiagnosticsInner />
    </DevErrorBoundary>
  )
}
