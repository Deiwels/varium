'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { devFetch } from '../_lib/dev-fetch'
import { DevErrorBoundary } from '../_components/DevErrorBoundary'
import { useToast } from '../_components/Toast'
import type { Workspace } from '../_types'

const card: CSSProperties = {
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,.06)',
  background: 'rgba(255,255,255,.03)',
  padding: '20px 24px',
}
const tbl: CSSProperties = { width: '100%', borderCollapse: 'collapse' }
const th: CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: 'rgba(255,255,255,.3)',
  textTransform: 'uppercase',
  letterSpacing: '.1em',
  textAlign: 'left',
  padding: '8px 12px',
  borderBottom: '1px solid rgba(255,255,255,.06)',
}
const td: CSSProperties = {
  fontSize: 13,
  color: 'rgba(255,255,255,.55)',
  padding: '12px 12px',
  borderBottom: '1px solid rgba(255,255,255,.03)',
}

const ACTIVE_WORKSPACE_STATUSES = new Set(['active', 'trialing'])
const LEGACY_MANUAL_STATUSES = new Set([
  'pending_otp',
  'verified',
  'brand_created',
  'pending_campaign',
  'pending_number',
  'pending_approval',
  'pending_vetting',
])

interface ProtectedLegacyWorkspace {
  slug?: string
  name?: string
}

interface SMSPlatformData {
  workspaces: Workspace[]
  default_path?: string
  manual_path_enabled?: boolean
  verify_profile_configured?: boolean
  rollout_gate?: string
  protected_legacy_workspace?: ProtectedLegacyWorkspace
}

function sortByName(a: Workspace, b: Workspace) {
  return (a.name || a.id).localeCompare(b.name || b.id)
}

function isProtectedLegacyWorkspace(workspace: Workspace, protectedLegacy?: ProtectedLegacyWorkspace | null) {
  const slug = (workspace.slug || '').trim().toLowerCase()
  const name = (workspace.name || '').trim().toLowerCase()
  return slug === (protectedLegacy?.slug || '').trim().toLowerCase()
    || name === (protectedLegacy?.name || '').trim().toLowerCase()
}

function isLegacyManualWorkspace(workspace: Workspace, protectedLegacy?: ProtectedLegacyWorkspace | null) {
  return workspace.sms_number_type === '10dlc'
    || LEGACY_MANUAL_STATUSES.has(workspace.sms_status || '')
    || isProtectedLegacyWorkspace(workspace, protectedLegacy)
}

function formatSmsStatus(status?: string) {
  const normalized = (status || 'none').trim()
  switch (normalized) {
    case 'none': return 'Not enabled'
    case 'active': return 'Configured'
    case 'failed': return 'Failed'
    case 'rejected': return 'Rejected'
    case 'provisioning': return 'Provisioning'
    case 'pending_otp': return 'Pending OTP'
    case 'pending_vetting': return 'Pending vetting'
    case 'pending_campaign': return 'Pending campaign'
    case 'pending_number': return 'Pending number'
    case 'pending_approval': return 'Pending approval'
    case 'brand_created': return 'Brand created'
    default:
      return normalized.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
}

function formatSenderType(workspace: Workspace, protectedLegacy?: ProtectedLegacyWorkspace | null) {
  if (workspace.sms_number_type === 'toll-free') return 'Toll-free'
  if (workspace.sms_number_type === '10dlc') return '10DLC'
  if (isLegacyManualWorkspace(workspace, protectedLegacy)) return 'Manual legacy'
  if (workspace.sms_number) return 'Configured'
  return 'Email only'
}

function SMSPageInner() {
  const [data, setData] = useState<SMSPlatformData | null>(null)
  const [loading, setLoading] = useState(true)
  const [provisioning, setProvisioning] = useState<string | null>(null)
  const toast = useToast()

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      devFetch('/api/vurium-dev/platform') as Promise<{ workspaces?: Workspace[] }>,
      devFetch('/api/vurium-dev/sms/status').catch(() => ({})) as Promise<Partial<SMSPlatformData>>,
    ]).then(([platform, sms]) => {
      setData({
        workspaces: platform.workspaces || [],
        ...sms,
      })
    }).catch((error) => {
      console.error(error)
      setData({ workspaces: [] })
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function provision(workspaceId: string, workspaceName: string) {
    setProvisioning(workspaceId)
    try {
      const result = await devFetch('/api/vurium-dev/sms/provision', {
        method: 'POST',
        body: JSON.stringify({ workspace_id: workspaceId }),
      }) as { already_active?: boolean }

      toast.show(result?.already_active
        ? `${workspaceName} already has a configured toll-free sender`
        : `Provisioning started for ${workspaceName}`)
      load()
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to provision SMS for ${workspaceName}`
      toast.show(message, 'error')
    } finally {
      setProvisioning(null)
    }
  }

  const summary = useMemo(() => {
    const workspaces = data?.workspaces || []
    const protectedLegacy = data?.protected_legacy_workspace

    const configured = workspaces.filter((workspace) => !!workspace.sms_number).sort(sortByName)
    const tollFreeConfigured = configured.filter((workspace) => workspace.sms_number_type === 'toll-free')
    const legacyConfigured = configured.filter((workspace) => isLegacyManualWorkspace(workspace, protectedLegacy))
    const pendingLegacy = workspaces.filter((workspace) => !workspace.sms_number && isLegacyManualWorkspace(workspace, protectedLegacy)).sort(sortByName)
    const provisioningTollFree = workspaces.filter((workspace) => {
      return !workspace.sms_number
        && workspace.sms_status === 'provisioning'
        && !isLegacyManualWorkspace(workspace, protectedLegacy)
    }).sort(sortByName)
    const needsProvisioning = workspaces.filter((workspace) => {
      return !workspace.sms_number
        && !isLegacyManualWorkspace(workspace, protectedLegacy)
        && workspace.sms_status !== 'provisioning'
        && ACTIVE_WORKSPACE_STATUSES.has(workspace.status || '')
    }).sort(sortByName)
    const emailOnlyFallback = workspaces.filter((workspace) => {
      return !workspace.sms_number && ACTIVE_WORKSPACE_STATUSES.has(workspace.status || '')
    })
    const pendingAny = [...provisioningTollFree, ...pendingLegacy].sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id))

    return {
      workspaces,
      configured,
      tollFreeConfigured,
      legacyConfigured,
      pendingLegacy,
      provisioningTollFree,
      needsProvisioning,
      emailOnlyFallback,
      pendingAny,
    }
  }, [data])

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'rgba(255,255,255,.3)', fontSize: 13 }}>
        Loading developer SMS…
      </div>
    )
  }

  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,.85)', margin: 0 }}>SMS Operations</h1>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginTop: 4 }}>
          Launch model: toll-free first for new workspaces, grandfathered manual 10DLC for legacy or pending cases.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 18 }}>
        <div style={card}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>Default Reminder Path</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(130,220,170,.8)' }}>
            {data?.default_path === 'toll-free' ? 'Toll-free first' : 'Manual'}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 4 }}>Email-only fallback while SMS is unavailable</div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>OTP Verify Profile</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: data?.verify_profile_configured ? 'rgba(130,220,170,.8)' : 'rgba(220,170,100,.8)' }}>
            {data?.verify_profile_configured ? 'Configured' : 'Missing'}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 4 }}>Public OTP routes stay stable on Telnyx Verify</div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>Configured Senders</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'rgba(130,220,170,.8)' }}>{summary.configured.length}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 4 }}>
            {summary.tollFreeConfigured.length} toll-free • {summary.legacyConfigured.length} manual legacy
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>Email-Only Fallback</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: summary.emailOnlyFallback.length > 0 ? 'rgba(220,170,100,.8)' : 'rgba(130,220,170,.8)' }}>
            {summary.emailOnlyFallback.length}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 4 }}>Active or trialing workspaces without a configured sender</div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>Legacy / Manual Path</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: summary.pendingLegacy.length > 0 || summary.legacyConfigured.length > 0 ? 'rgba(130,150,220,.8)' : 'rgba(255,255,255,.35)' }}>
            {summary.pendingLegacy.length + summary.legacyConfigured.length}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 4 }}>
            Grandfathered 10DLC stays alive for protected or in-review businesses
          </div>
        </div>
      </div>

      {data?.protected_legacy_workspace?.name && (
        <div style={{ ...card, marginBottom: 20, padding: '16px 20px' }}>
          <div style={{ fontSize: 10, color: 'rgba(130,150,220,.7)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>Protected Legacy Case</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,.8)' }}>{data.protected_legacy_workspace.name}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginTop: 4 }}>
            Keep this workspace on the current manual / 10DLC review path. Do not auto-provision toll-free here while review is pending.
          </div>
        </div>
      )}

      {summary.needsProvisioning.length > 0 && (
        <div style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'rgba(220,170,100,.7)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600 }}>
              Needs Toll-Free Setup ({summary.needsProvisioning.length})
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.2)' }}>Eligible workspaces currently fall back to email only</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead>
                <tr>
                  <th style={th}>Business</th>
                  <th style={th}>Plan</th>
                  <th style={th}>Workspace Status</th>
                  <th style={th}>Current Messaging</th>
                  <th style={th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {summary.needsProvisioning.map((workspace) => (
                  <tr key={workspace.id} style={{ transition: 'background .15s' }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: 'rgba(255,255,255,.7)' }}>{workspace.name || workspace.id}</div>
                      {workspace.slug && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 2 }}>/{workspace.slug}</div>}
                    </td>
                    <td style={td}>
                      <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'capitalize', color: 'rgba(130,150,220,.7)' }}>
                        {workspace.plan}
                      </span>
                    </td>
                    <td style={td}>{workspace.status}</td>
                    <td style={td}>
                      <span style={{ fontSize: 11, color: 'rgba(220,170,100,.7)' }}>Email-only fallback</span>
                    </td>
                    <td style={td}>
                      <button
                        onClick={() => provision(workspace.id, workspace.name || workspace.id)}
                        disabled={provisioning === workspace.id}
                        style={{
                          height: 30,
                          padding: '0 14px',
                          borderRadius: 8,
                          border: 'none',
                          cursor: 'pointer',
                          background: provisioning === workspace.id ? 'rgba(255,255,255,.06)' : 'rgba(130,220,170,.12)',
                          color: provisioning === workspace.id ? 'rgba(255,255,255,.3)' : 'rgba(130,220,170,.8)',
                          fontSize: 12,
                          fontWeight: 600,
                          fontFamily: 'inherit',
                          opacity: provisioning === workspace.id ? 0.7 : 1,
                        }}
                      >
                        {provisioning === workspace.id ? 'Provisioning…' : 'Provision Toll-Free'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {summary.pendingAny.length > 0 && (
        <div style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
            <span style={{ fontSize: 11, color: 'rgba(130,150,220,.7)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600 }}>
              Pending / In Progress ({summary.pendingAny.length})
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead>
                <tr>
                  <th style={th}>Business</th>
                  <th style={th}>Path</th>
                  <th style={th}>SMS Status</th>
                  <th style={th}>Note</th>
                </tr>
              </thead>
              <tbody>
                {summary.pendingAny.map((workspace) => {
                  const isLegacy = isLegacyManualWorkspace(workspace, data?.protected_legacy_workspace)
                  const isProtected = isProtectedLegacyWorkspace(workspace, data?.protected_legacy_workspace)
                  return (
                    <tr key={workspace.id} style={{ transition: 'background .15s' }}>
                      <td style={td}>
                        <div style={{ fontWeight: 600, color: 'rgba(255,255,255,.7)' }}>{workspace.name || workspace.id}</div>
                        {workspace.slug && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 2 }}>/{workspace.slug}</div>}
                      </td>
                      <td style={td}>
                        <span style={{ fontSize: 11, color: isLegacy ? 'rgba(130,150,220,.8)' : 'rgba(130,220,170,.8)', fontWeight: 600 }}>
                          {isLegacy ? 'Grandfathered manual' : 'Toll-free default'}
                        </span>
                      </td>
                      <td style={td}>{formatSmsStatus(workspace.sms_status)}</td>
                      <td style={td}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>
                          {isProtected
                            ? 'Protected legacy case — keep current manual review path'
                            : isLegacy
                              ? 'Manual 10DLC state should stay intact'
                              : 'Keep on email fallback until sender is configured'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600 }}>
            Configured Senders ({summary.configured.length})
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={tbl}>
            <thead>
              <tr>
                <th style={th}>Business</th>
                <th style={th}>Path</th>
                <th style={th}>Sender Type</th>
                <th style={th}>Workspace Status</th>
                <th style={th}>SMS Number</th>
              </tr>
            </thead>
            <tbody>
              {summary.configured.map((workspace) => {
                const isLegacy = isLegacyManualWorkspace(workspace, data?.protected_legacy_workspace)
                return (
                  <tr key={workspace.id} style={{ transition: 'background .15s' }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: 'rgba(255,255,255,.7)' }}>{workspace.name || workspace.id}</div>
                      {workspace.slug && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 2 }}>/{workspace.slug}</div>}
                    </td>
                    <td style={td}>
                      <span style={{ fontSize: 11, color: isLegacy ? 'rgba(130,150,220,.8)' : 'rgba(130,220,170,.8)', fontWeight: 600 }}>
                        {isLegacy ? 'Grandfathered manual' : 'Toll-free default'}
                      </span>
                    </td>
                    <td style={td}>{formatSenderType(workspace, data?.protected_legacy_workspace)}</td>
                    <td style={td}>{formatSmsStatus(workspace.sms_status)}</td>
                    <td style={td}>
                      <span style={{ fontSize: 13, color: 'rgba(130,220,170,.7)', fontFamily: 'monospace' }}>{workspace.sms_number}</span>
                    </td>
                  </tr>
                )
              })}
              {summary.configured.length === 0 && (
                <tr>
                  <td style={{ ...td, color: 'rgba(255,255,255,.35)' }} colSpan={5}>
                    No workspace senders are configured yet.
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

export default function SMSPage() {
  return (
    <DevErrorBoundary>
      <SMSPageInner />
    </DevErrorBoundary>
  )
}
