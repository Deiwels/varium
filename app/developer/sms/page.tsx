'use client'
import { useEffect, useState, useCallback } from 'react'
import { devFetch } from '../_lib/dev-fetch'
import { StatusBadge } from '../_components/StatusBadge'
import { DevErrorBoundary } from '../_components/DevErrorBoundary'
import { useToast } from '../_components/Toast'
import type { Workspace } from '../_types'

const card: React.CSSProperties = {
  borderRadius: 16, border: '1px solid rgba(255,255,255,.06)',
  background: 'rgba(255,255,255,.03)', padding: '20px 24px',
}
const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' }
const th: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.3)',
  textTransform: 'uppercase', letterSpacing: '.1em', textAlign: 'left',
  padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,.06)',
}
const td: React.CSSProperties = {
  fontSize: 13, color: 'rgba(255,255,255,.55)',
  padding: '12px 12px', borderBottom: '1px solid rgba(255,255,255,.03)',
}

interface SMSPlatformData {
  workspaces: Workspace[]
  campaign_status?: string
  campaign_id?: string
  toll_free_number?: string
}

function SMSPageInner() {
  const [data, setData] = useState<SMSPlatformData | null>(null)
  const [loading, setLoading] = useState(true)
  const [provisioning, setProvisioning] = useState<string | null>(null)
  const toast = useToast()

  const load = useCallback(() => {
    setLoading(true)
    // Re-use platform endpoint to get workspaces; SMS-specific data also fetched if available
    Promise.all([
      devFetch('/api/vurium-dev/platform') as Promise<{ workspaces?: Workspace[] }>,
      devFetch('/api/vurium-dev/sms/status').catch(() => ({})) as Promise<{ campaign_status?: string; campaign_id?: string; toll_free_number?: string }>,
    ]).then(([platform, sms]) => {
      setData({
        workspaces: platform.workspaces || [],
        ...sms,
      })
    }).catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function provision(workspaceId: string, workspaceName: string) {
    setProvisioning(workspaceId)
    try {
      await devFetch('/api/vurium-dev/sms/provision', {
        method: 'POST',
        body: JSON.stringify({ workspace_id: workspaceId }),
      })
      toast.show(`SMS number provisioned for ${workspaceName}`)
      load()
    } catch {
      toast.show(`Failed to provision number for ${workspaceName}`, 'error')
    } finally {
      setProvisioning(null)
    }
  }

  if (loading) return (
    <div style={{ padding: 60, textAlign: 'center', color: 'rgba(255,255,255,.3)', fontSize: 13 }}>Loading SMS data...</div>
  )

  const withSMS    = (data?.workspaces || []).filter(w => w.sms_number)
  const withoutSMS = (data?.workspaces || []).filter(w => !w.sms_number && w.status === 'active')
  const pending    = (data?.workspaces || []).filter(w => !w.sms_number && w.sms_status && w.sms_status !== 'none' && w.sms_status !== '')

  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,.85)', margin: 0 }}>SMS Provisioning</h1>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginTop: 4 }}>Manage Telnyx numbers and 10DLC campaign status</p>
      </div>

      {/* Platform-level 10DLC status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 28 }}>
        <div style={card}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>10DLC Campaign</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: data?.campaign_status === 'active' ? 'rgba(130,220,170,.8)' : 'rgba(220,170,100,.8)' }}>
            {data?.campaign_status || 'Unknown'}
          </div>
          {data?.campaign_id && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 4, fontFamily: 'monospace' }}>{data.campaign_id}</div>
          )}
        </div>
        <div style={card}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>Toll-Free Number</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: data?.toll_free_number ? 'rgba(130,220,170,.8)' : 'rgba(255,255,255,.3)' }}>
            {data?.toll_free_number || '—'}
          </div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>With SMS Number</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'rgba(130,220,170,.8)' }}>{withSMS.length}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>Needs Provisioning</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: withoutSMS.length > 0 ? 'rgba(220,170,100,.8)' : 'rgba(130,220,170,.8)' }}>
            {withoutSMS.length}
          </div>
        </div>
      </div>

      {/* Workspaces needing SMS */}
      {withoutSMS.length > 0 && (
        <div style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'rgba(220,170,100,.7)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600 }}>
              ⚡ Needs SMS Number ({withoutSMS.length})
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>— active workspaces without a number</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead>
                <tr>
                  <th style={th}>Business</th>
                  <th style={th}>Plan</th>
                  <th style={th}>Clients</th>
                  <th style={th}>Bookings</th>
                  <th style={th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {withoutSMS.map(ws => (
                  <tr key={ws.id}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    style={{ transition: 'background .15s' }}
                  >
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: 'rgba(255,255,255,.7)' }}>{ws.name || ws.id}</div>
                      {ws.slug && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 2 }}>/{ws.slug}</div>}
                    </td>
                    <td style={td}>
                      <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'capitalize', color: ws.plan === 'salon' ? 'rgba(130,220,170,.7)' : 'rgba(130,150,220,.7)' }}>
                        {ws.plan}
                      </span>
                    </td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{ws.clients?.toLocaleString()}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{ws.bookings?.toLocaleString()}</td>
                    <td style={td}>
                      <button
                        onClick={() => provision(ws.id, ws.name || ws.id)}
                        disabled={provisioning === ws.id}
                        style={{
                          height: 30, padding: '0 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                          background: provisioning === ws.id ? 'rgba(255,255,255,.06)' : 'rgba(130,220,170,.12)',
                          color: provisioning === ws.id ? 'rgba(255,255,255,.3)' : 'rgba(130,220,170,.8)',
                          fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                          opacity: provisioning === ws.id ? 0.7 : 1,
                        }}
                      >
                        {provisioning === ws.id ? 'Provisioning…' : 'Provision Number'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pending status */}
      {pending.length > 0 && (
        <div style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
            <span style={{ fontSize: 11, color: 'rgba(130,150,220,.7)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600 }}>
              Pending / In-Progress ({pending.length})
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead>
                <tr>
                  <th style={th}>Business</th>
                  <th style={th}>Plan</th>
                  <th style={th}>SMS Status</th>
                </tr>
              </thead>
              <tbody>
                {pending.map(ws => (
                  <tr key={ws.id}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    style={{ transition: 'background .15s' }}
                  >
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: 'rgba(255,255,255,.7)' }}>{ws.name || ws.id}</div>
                      {ws.slug && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 2 }}>/{ws.slug}</div>}
                    </td>
                    <td style={td}>
                      <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'capitalize', color: 'rgba(130,150,220,.7)' }}>{ws.plan}</span>
                    </td>
                    <td style={td}>
                      <span style={{ fontSize: 11, color: 'rgba(220,170,100,.7)' }}>{ws.sms_status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active numbers */}
      {withSMS.length > 0 && (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600 }}>
              Active Numbers ({withSMS.length})
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead>
                <tr>
                  <th style={th}>Business</th>
                  <th style={th}>Plan</th>
                  <th style={th}>Status</th>
                  <th style={th}>SMS Number</th>
                </tr>
              </thead>
              <tbody>
                {withSMS.map(ws => (
                  <tr key={ws.id}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    style={{ transition: 'background .15s' }}
                  >
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: 'rgba(255,255,255,.7)' }}>{ws.name || ws.id}</div>
                      {ws.slug && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 2 }}>/{ws.slug}</div>}
                    </td>
                    <td style={td}>
                      <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'capitalize', color: ws.plan === 'salon' ? 'rgba(130,220,170,.7)' : 'rgba(130,150,220,.7)' }}>{ws.plan}</span>
                    </td>
                    <td style={td}><StatusBadge status={ws.status} /></td>
                    <td style={td}>
                      <span style={{ fontSize: 13, color: 'rgba(130,220,170,.7)', fontFamily: 'monospace' }}>{ws.sms_number}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!withSMS.length && !withoutSMS.length && !pending.length && (
        <div style={{ ...card, textAlign: 'center', padding: 60, color: 'rgba(255,255,255,.25)', fontSize: 13 }}>
          No workspaces found.
        </div>
      )}
    </>
  )
}

export default function SMSPage() {
  return (
    <DevErrorBoundary>
      <SMSPageInner />
    </DevErrorBoundary>
  )
}
