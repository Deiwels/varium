'use client'
import { useEffect, useState } from 'react'
import { DevErrorBoundary } from '../_components/DevErrorBoundary'
import { useToast } from '../_components/Toast'
import { devFetch } from '../_lib/dev-fetch'

type IntakeKind = 'auto' | 'advisory' | 'task' | 'growth' | 'research' | 'handoff' | 'truth_update_draft'

interface OwnerIntakeResult {
  agent: 'SYSTEM'
  workflow: 'owner_intake'
  status: string
  intake_id: string
  intake_kind: IntakeKind
  title: string
  queue_stage: string
  route_target: string
  created_note_relative_path: string
  downstream_workflow: string
  downstream_status: string
  downstream_reference: string
  downstream_result: unknown
  escalate_to: string
  reason: string
  writeback_targets: string[]
  writeback: { status?: string; relative_path?: string; reason?: string } | null
  owner_notification: { status?: string; reason?: string } | null
  operator_reply: string
  follow_on_workflow: string
  follow_on_status: string
  follow_on_reference: string
  follow_on_result: unknown
  next_step: string
}

interface IntakeHistoryItem {
  id: string
  createdAt: string
  message: string
  result: OwnerIntakeResult
}

interface AIExecutionMeta {
  provider?: string
  model?: string
  input_tokens?: number
  output_tokens?: number
}

const HISTORY_KEY = 'vurium_owner_intake_history'

const ROUTE_TARGET_LABELS: Record<string, string> = {
  'AI-1': 'AI-1 Backend',
  'AI-2': 'AI-2 Frontend',
  'AI-3': 'AI-3 (Verdent)',
  'AI-4': 'AI-4 Emergency',
  'AI-5': 'AI-5 Research',
  'AI-6': 'AI-6 Product',
  'AI-7': 'AI-7 Compliance',
  'AI-8': 'AI-8 Growth',
  'AI-9': 'AI-9 Support',
  'AI-10': 'AI-10 Video',
  'AI-11': 'AI-11 Creative',
  Owner: 'Owner',
  none: 'None',
}

const WORKFLOW_LABELS: Record<string, string> = {
  Owner_Advisory: 'Owner Copilot',
  AI3_Planning_Intake: 'AI-3 Planning Intake (Verdent)',
  AI3_QA_Scan: 'AI-3 QA Scan (Verdent)',
  Growth_Asset_Flow: 'AI-8 → AI-11 / AI-10 Growth Asset Flow',
  Research_Brief: 'AI-5 Research Brief',
  research_brief: 'AI-5 Research Brief',
  none: 'No downstream workflow',
}

const card: React.CSSProperties = {
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,.06)',
  background: 'rgba(255,255,255,.03)',
}

const inputBase: React.CSSProperties = {
  width: '100%',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,.1)',
  background: 'rgba(0,0,0,.25)',
  color: '#fff',
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
}

const kindPresets: Array<{ kind: IntakeKind; label: string; helper: string }> = [
  { kind: 'auto', label: 'Auto', helper: 'Let the system classify it.' },
  { kind: 'advisory', label: 'Discuss', helper: 'Think first, answer like a copilot, do not start execution yet.' },
  { kind: 'task', label: 'Task', helper: 'Product work that should route to Verdent planning.' },
  { kind: 'growth', label: 'Growth', helper: 'Campaigns, landing pages, creatives, promo assets.' },
  { kind: 'research', label: 'Research', helper: 'External facts, policy, vendor, official sources.' },
  { kind: 'handoff', label: 'Handoff', helper: 'Structured transfer to the next owner.' },
  { kind: 'truth_update_draft', label: 'Truth Draft', helper: 'Draft change for system/product truth, never direct canon.' },
]

function parseLines(value: string) {
  return value
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function toStringList(value: unknown) {
  return Array.isArray(value)
    ? value
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
    : []
}

function routeTargetLabel(value: string) {
  return ROUTE_TARGET_LABELS[value] || value
}

function workflowLabel(value: string) {
  return WORKFLOW_LABELS[value] || value
}

function providerLabel(value: string) {
  if (value === 'anthropic') return 'Claude'
  if (value === 'openai') return 'OpenAI'
  return value || 'None'
}

function runtimeBadgeStyle(state: 'active' | 'working' | 'fallback' | 'blocked' | 'idle' | 'standby') {
  const palette = {
    active: { bg: 'rgba(130,220,170,.14)', fg: 'rgba(130,220,170,.92)' },
    working: { bg: 'rgba(130,220,170,.14)', fg: 'rgba(130,220,170,.92)' },
    fallback: { bg: 'rgba(255,210,120,.14)', fg: 'rgba(255,210,120,.92)' },
    blocked: { bg: 'rgba(255,120,120,.14)', fg: 'rgba(255,140,140,.92)' },
    idle: { bg: 'rgba(255,255,255,.06)', fg: 'rgba(255,255,255,.56)' },
    standby: { bg: 'rgba(130,150,220,.12)', fg: 'rgba(130,150,220,.92)' },
  }[state]

  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    borderRadius: 999,
    background: palette.bg,
    color: palette.fg,
    fontSize: 12,
    fontWeight: 700,
  } satisfies React.CSSProperties
}

function OwnerIntakePageInner() {
  const toast = useToast()
  const [message, setMessage] = useState('')
  const [title, setTitle] = useState('')
  const [intakeKind, setIntakeKind] = useState<IntakeKind>('auto')
  const [priority, setPriority] = useState('medium')
  const [audience, setAudience] = useState('')
  const [channel, setChannel] = useState('')
  const [productContextLinks, setProductContextLinks] = useState('')
  const [knownConstraints, setKnownConstraints] = useState('')
  const [sourceUrls, setSourceUrls] = useState('')
  const [questions, setQuestions] = useState('')
  const [targetSources, setTargetSources] = useState('')
  const [relatedLinks, setRelatedLinks] = useState('')
  const [relatedTaskId, setRelatedTaskId] = useState('')
  const [approvedClaimsLink, setApprovedClaimsLink] = useState('')
  const [currentOfferLink, setCurrentOfferLink] = useState('')
  const [needStaticCreatives, setNeedStaticCreatives] = useState(false)
  const [needVideoBrief, setNeedVideoBrief] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [latestResult, setLatestResult] = useState<OwnerIntakeResult | null>(null)
  const [history, setHistory] = useState<IntakeHistoryItem[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as IntakeHistoryItem[]
      setHistory(Array.isArray(parsed) ? parsed : [])
      if (Array.isArray(parsed) && parsed[0]?.result) setLatestResult(parsed[0].result)
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 12)))
    } catch {}
  }, [history])

  async function submitIntake(event: React.FormEvent) {
    event.preventDefault()
    if (!message.trim()) {
      toast.show('Write the request first.', 'error')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await devFetch('/api/vurium-dev/ai/owner-intake', {
        method: 'POST',
        body: JSON.stringify({
          meta: {
            workflow_name: 'Owner_Intake_UI',
            timestamp: new Date().toISOString(),
            trigger_source: 'developer_owner_intake',
            risk_level: 'medium',
          },
          context: {
            canonical_links: parseLines(productContextLinks),
            constraints: parseLines(knownConstraints),
          },
          payload: {
            message: message.trim(),
            title: title.trim(),
            intake_kind: intakeKind,
            requested_by: 'Owner',
            priority,
            product_context_links: parseLines(productContextLinks),
            known_constraints: parseLines(knownConstraints),
            source_urls: parseLines(sourceUrls),
            questions: parseLines(questions),
            target_sources: parseLines(targetSources),
            related_links: parseLines(relatedLinks),
            related_task_id: relatedTaskId.trim(),
            audience: audience.trim(),
            channel: channel.trim(),
            approved_claims_link: approvedClaimsLink.trim(),
            current_offer_link: currentOfferLink.trim(),
            need_static_creatives: needStaticCreatives || undefined,
            need_video_brief: needVideoBrief || undefined,
          },
        }),
      }) as OwnerIntakeResult

      setLatestResult(response)
      setHistory((prev) => [
        {
          id: response.intake_id,
          createdAt: new Date().toISOString(),
          message: message.trim(),
          result: response,
        },
        ...prev.filter((item) => item.id !== response.intake_id),
      ].slice(0, 12))
      toast.show(`Created ${response.intake_kind} and routed it to ${response.route_target}.`)
      setMessage('')
      setTitle('')
      setRelatedTaskId('')
      setSourceUrls('')
      setQuestions('')
      setTargetSources('')
      setRelatedLinks('')
      setAudience('')
      setChannel('')
      setApprovedClaimsLink('')
      setCurrentOfferLink('')
      setNeedStaticCreatives(false)
      setNeedVideoBrief(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Owner intake failed'
      toast.show(message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  function loadHistoryItem(item: IntakeHistoryItem) {
    setLatestResult(item.result)
    setMessage(item.message)
    setTitle(item.result.title)
    setIntakeKind(item.result.intake_kind)
  }

  const latestDownstream = latestResult?.downstream_result ? prettyJson(latestResult.downstream_result) : ''
  const downstreamRecord = asRecord(latestResult?.downstream_result)
  const downstreamAiMeta = asRecord(downstreamRecord?.ai_meta) as AIExecutionMeta | null
  const latestFollowOn = latestResult?.follow_on_result ? prettyJson(latestResult.follow_on_result) : ''
  const followOnRecord = asRecord(latestResult?.follow_on_result)
  const followOnAiMeta = asRecord(followOnRecord?.ai_meta) as AIExecutionMeta | null
  const effectiveReason = String(
    (typeof downstreamRecord?.reason === 'string' && downstreamRecord.reason)
      || latestResult?.reason
      || ''
  )
  const activeProvider = typeof downstreamAiMeta?.provider === 'string' ? downstreamAiMeta.provider : ''
  const activeModel = typeof downstreamAiMeta?.model === 'string' ? downstreamAiMeta.model : ''
  const hasRealAIResponse = Boolean(activeProvider)
  const isProviderFallback = !hasRealAIResponse && /AI provider error|AI not configured/i.test(effectiveReason)
  const systemWritebackOk = latestResult?.intake_kind === 'advisory'
    ? true
    : latestResult?.writeback?.status === 'done'
  const systemWorking = Boolean(latestResult && (latestResult.intake_kind === 'advisory'
    ? (hasRealAIResponse || latestResult.status === 'done')
    : (systemWritebackOk && latestResult.created_note_relative_path)))
  const executionModeLabel = hasRealAIResponse
    ? 'Real AI response'
    : isProviderFallback
      ? 'Fallback / draft mode'
      : 'Structured routing only'
  const anthropicState: 'active' | 'blocked' | 'standby' =
    activeProvider === 'anthropic'
      ? 'active'
      : /anthropic: .*credit balance is too low|anthropic: Anthropic API key not configured/i.test(effectiveReason)
        ? 'blocked'
        : 'standby'
  const openaiState: 'active' | 'blocked' | 'standby' =
    activeProvider === 'openai'
      ? 'active'
      : /openai: OpenAI API key not configured/i.test(effectiveReason)
        ? 'blocked'
        : 'standby'
  const verdentState: 'active' | 'idle' =
    latestResult?.route_target === 'AI-3' || latestResult?.downstream_workflow === 'AI3_Planning_Intake' || latestResult?.downstream_workflow === 'AI3_QA_Scan'
      ? 'active'
      : 'idle'
  const operatorSummary = !latestResult
    ? ''
    : latestResult.downstream_workflow === 'Owner_Advisory'
      ? hasRealAIResponse
        ? `Owner Copilot answered through ${providerLabel(activeProvider)}.`
        : 'Owner Copilot responded in advisory mode without opening execution yet.'
    : hasRealAIResponse
      ? `${routeTargetLabel(latestResult.route_target)} answered through ${providerLabel(activeProvider)}.`
      : isProviderFallback
      ? `${routeTargetLabel(latestResult.route_target)} was routed correctly, but this run fell back because the configured AI provider chain did not complete.`
        : `${routeTargetLabel(latestResult.route_target)} was routed and queued without a direct AI answer yet.`
  const replyCard = (() => {
    if (!latestResult) return null

    const header = latestResult.downstream_workflow === 'Owner_Advisory'
      ? hasRealAIResponse
        ? 'Owner Copilot replied'
        : 'Owner Copilot prepared a draft reply'
      : hasRealAIResponse
        ? `${routeTargetLabel(latestResult.route_target)} replied`
        : `${routeTargetLabel(latestResult.route_target)} prepared a draft reply`
    const modeNote = hasRealAIResponse
      ? `${providerLabel(activeProvider)} answered this run.${activeModel ? ` Model: ${activeModel}.` : ''}`
      : isProviderFallback
        ? 'This run fell back to a draft/structured result because the live AI provider chain did not complete.'
        : 'The system routed the request and prepared the next lane, but no direct AI answer is attached yet.'

    if (latestResult.downstream_workflow === 'AI3_Planning_Intake') {
      const plan = asRecord(downstreamRecord?.plan_skeleton)
      const workstreams = toStringList(plan?.workstreams)
      const missingInputs = toStringList(plan?.missing_inputs)
      const acceptanceCriteria = toStringList(plan?.acceptance_criteria_seed)
      const recommendedSequence = toStringList(downstreamRecord?.recommended_sequence)

      return {
        header,
        body: (typeof plan?.objective === 'string' && plan.objective.trim())
          || 'Verdent created a planning shell for this task.',
        modeNote,
        sections: [
          { label: 'Workstreams', items: workstreams },
          { label: 'Missing inputs', items: missingInputs },
          { label: 'Acceptance criteria', items: acceptanceCriteria },
          { label: 'Recommended sequence', items: recommendedSequence },
        ].filter((section) => section.items.length > 0),
      }
    }

    if (latestResult.downstream_workflow === 'Owner_Advisory') {
      const advisoryReply = typeof downstreamRecord?.reply === 'string' ? downstreamRecord.reply.trim() : ''
      const suggestedMode = typeof downstreamRecord?.suggested_mode === 'string' ? downstreamRecord.suggested_mode.trim() : ''

      return {
        header,
        body: advisoryReply || 'The owner copilot responded without opening a delivery task yet.',
        modeNote,
        sections: [
          { label: 'Suggested next mode', items: suggestedMode && suggestedMode !== 'none' ? [suggestedMode] : [] },
        ].filter((section) => section.items.length > 0),
      }
    }

    if (latestResult.downstream_workflow === 'Growth_Asset_Flow') {
      const growthOutput = asRecord(downstreamRecord?.growth_brief)
      const growthBrief = asRecord(growthOutput?.growth_brief)
      const hook = typeof growthBrief?.hook === 'string' ? growthBrief.hook.trim() : ''
      const cta = typeof growthBrief?.cta === 'string' ? growthBrief.cta.trim() : ''
      const channels = toStringList(growthBrief?.channels)
      const assetRequests = toStringList(growthBrief?.asset_requests)
      const riskNotes = toStringList(growthBrief?.risk_notes)

      return {
        header,
        body: hook || 'The growth lane produced a campaign brief and asset direction.',
        modeNote,
        sections: [
          { label: 'CTA', items: cta ? [cta] : [] },
          { label: 'Channels', items: channels },
          { label: 'Asset requests', items: assetRequests },
          { label: 'Risk notes', items: riskNotes },
        ].filter((section) => section.items.length > 0),
      }
    }

    if (latestResult.downstream_workflow === 'Research_Brief') {
      const facts = toStringList(downstreamRecord?.facts)
      const inferences = toStringList(downstreamRecord?.inferences)
      const openQuestions = toStringList(downstreamRecord?.open_questions)

      return {
        header,
        body: facts[0] || inferences[0] || 'The research lane created a source-backed brief shell.',
        modeNote,
        sections: [
          { label: 'Facts', items: facts.slice(0, 4) },
          { label: 'Inferences', items: inferences.slice(0, 3) },
          { label: 'Open questions', items: openQuestions.slice(0, 4) },
        ].filter((section) => section.items.length > 0),
      }
    }

    if (latestResult.intake_kind === 'handoff') {
      return {
        header,
        body: 'The system created a handoff note and queued it for the next owner.',
        modeNote,
        sections: [],
      }
    }

    if (latestResult.intake_kind === 'truth_update_draft') {
      return {
        header,
        body: 'The system created a truth-update draft for review instead of mutating canonical docs directly.',
        modeNote,
        sections: [],
      }
    }

    return {
      header,
      body: latestResult.next_step || latestResult.reason || 'The system routed this request successfully.',
      modeNote,
      sections: [],
    }
  })()

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,.85)', margin: 0 }}>Owner Intake</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.32)', margin: '6px 0 0', maxWidth: 720, lineHeight: 1.6 }}>
            One box for the whole operating system. Ask broad questions, think through ideas, or start work. The system will answer like a copilot first when appropriate, and only create notes/tasks when the request clearly moves into execution.
          </p>
        </div>
      </div>

      <div className="owner-intake-shell" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(320px, .9fr)', gap: 16, alignItems: 'start' }}>
        <form onSubmit={submitIntake} style={{ ...card, padding: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {kindPresets.map((preset) => {
              const active = intakeKind === preset.kind
              return (
                <button
                  key={preset.kind}
                  type="button"
                  onClick={() => setIntakeKind(preset.kind)}
                  title={preset.helper}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 999,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    background: active ? 'rgba(130,150,220,.16)' : 'rgba(255,255,255,.06)',
                    color: active ? 'rgba(130,150,220,.95)' : 'rgba(255,255,255,.42)',
                  }}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>

          <div className="owner-intake-topline" style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: 12, marginBottom: 12 }}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional title. If empty, the system derives one."
              style={{ ...inputBase, height: 42, padding: '0 14px' }}
            />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              style={{ ...inputBase, height: 42, padding: '0 12px' }}
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write what you need. Example: What is the current state of VuriumBook? Or: Start planning a safer onboarding confirmation flow for booking reminders."
            style={{ ...inputBase, minHeight: 220, padding: '14px 16px', resize: 'vertical', lineHeight: 1.65, marginBottom: 14 }}
          />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
            <button
              type="button"
              onClick={() => setAdvancedOpen((prev) => !prev)}
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'inherit',
                background: 'rgba(255,255,255,.06)',
                color: 'rgba(255,255,255,.45)',
              }}
            >
              {advancedOpen ? 'Hide advanced fields' : 'Show advanced fields'}
            </button>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.28)' }}>
              Best default: keep `Auto`. Broad questions stay conversational first; explicit “start / build / plan” requests move into execution lanes.
            </span>
          </div>

          {advancedOpen && (
            <div className="owner-intake-advanced" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <textarea value={productContextLinks} onChange={(e) => setProductContextLinks(e.target.value)} placeholder="Product/context links, one per line" style={{ ...inputBase, minHeight: 100, padding: 12, resize: 'vertical' }} />
              <textarea value={knownConstraints} onChange={(e) => setKnownConstraints(e.target.value)} placeholder="Constraints, one per line" style={{ ...inputBase, minHeight: 100, padding: 12, resize: 'vertical' }} />
              <textarea value={sourceUrls} onChange={(e) => setSourceUrls(e.target.value)} placeholder="Official source URLs, one per line" style={{ ...inputBase, minHeight: 100, padding: 12, resize: 'vertical' }} />
              <textarea value={questions} onChange={(e) => setQuestions(e.target.value)} placeholder="Research questions, one per line" style={{ ...inputBase, minHeight: 100, padding: 12, resize: 'vertical' }} />
              <textarea value={targetSources} onChange={(e) => setTargetSources(e.target.value)} placeholder="Target source types, one per line" style={{ ...inputBase, minHeight: 100, padding: 12, resize: 'vertical' }} />
              <textarea value={relatedLinks} onChange={(e) => setRelatedLinks(e.target.value)} placeholder="Related links, one per line" style={{ ...inputBase, minHeight: 100, padding: 12, resize: 'vertical' }} />
              <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Growth audience" style={{ ...inputBase, height: 42, padding: '0 14px' }} />
              <input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="Growth channels" style={{ ...inputBase, height: 42, padding: '0 14px' }} />
              <input value={approvedClaimsLink} onChange={(e) => setApprovedClaimsLink(e.target.value)} placeholder="Approved claims link" style={{ ...inputBase, height: 42, padding: '0 14px' }} />
              <input value={currentOfferLink} onChange={(e) => setCurrentOfferLink(e.target.value)} placeholder="Current offer link" style={{ ...inputBase, height: 42, padding: '0 14px' }} />
              <input value={relatedTaskId} onChange={(e) => setRelatedTaskId(e.target.value)} placeholder="Related task ID" style={{ ...inputBase, height: 42, padding: '0 14px' }} />
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '0 6px' }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'rgba(255,255,255,.45)' }}>
                  <input type="checkbox" checked={needStaticCreatives} onChange={(e) => setNeedStaticCreatives(e.target.checked)} />
                  Static creatives
                </label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'rgba(255,255,255,.45)' }}>
                  <input type="checkbox" checked={needVideoBrief} onChange={(e) => setNeedVideoBrief(e.target.checked)} />
                  Video brief
                </label>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.28)' }}>
              One submit can create the note, assign queue stage, and trigger Verdent, Growth, or Research automatically.
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                minWidth: 170,
                height: 40,
                padding: '0 18px',
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 700,
                fontFamily: 'inherit',
                background: 'rgba(130,150,220,.18)',
                color: 'rgba(130,150,220,.95)',
                opacity: isSubmitting ? 0.5 : 1,
              }}
            >
              {isSubmitting ? 'Routing…' : 'Route through system'}
            </button>
          </div>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section style={{ ...card, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,.78)', margin: 0 }}>Latest result</h2>
              {latestResult && <span style={{ fontSize: 11, color: 'rgba(255,255,255,.28)' }}>{latestResult.intake_id}</span>}
            </div>

            {!latestResult ? (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.32)', margin: 0, lineHeight: 1.6 }}>
                Submit the first intake and the system will show the created note, assigned lane, downstream workflow, and next step here.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{
                  ...card,
                  padding: 14,
                  background: systemWorking ? 'rgba(130,220,170,.06)' : 'rgba(255,210,120,.06)',
                  borderColor: systemWorking ? 'rgba(130,220,170,.12)' : 'rgba(255,210,120,.12)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.84)' }}>
                      {systemWorking ? 'System worked' : 'System needs attention'}
                    </div>
                    <span style={runtimeBadgeStyle(systemWorking ? 'working' : isProviderFallback ? 'fallback' : 'blocked')}>
                      {executionModeLabel}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.58)', lineHeight: 1.6 }}>
                    {operatorSummary}
                  </div>
                </div>

                {replyCard && (
                  <div style={{
                    ...card,
                    padding: 16,
                    background: 'rgba(130,150,220,.06)',
                    borderColor: 'rgba(130,150,220,.12)',
                  }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(130,150,220,.75)', marginBottom: 8 }}>
                      AI reply
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,.88)', marginBottom: 8 }}>
                      {replyCard.header}
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,.82)', lineHeight: 1.65, marginBottom: 8 }}>
                      {replyCard.body}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.48)', lineHeight: 1.6, marginBottom: replyCard.sections.length ? 12 : 0 }}>
                      {replyCard.modeNote}
                    </div>
                    {replyCard.sections.length > 0 && (
                      <div style={{ display: 'grid', gap: 10 }}>
                        {replyCard.sections.map((section) => (
                          <div key={section.label}>
                            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.22)', marginBottom: 6 }}>
                              {section.label}
                            </div>
                            <ul style={{ margin: 0, paddingLeft: 18, color: 'rgba(255,255,255,.72)', fontSize: 12, lineHeight: 1.65 }}>
                              {section.items.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {latestResult.operator_reply && (
                  <div style={{
                    ...card,
                    padding: 16,
                    background: 'rgba(130,220,170,.05)',
                    borderColor: 'rgba(130,220,170,.12)',
                  }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(130,220,170,.8)', marginBottom: 8 }}>
                      System reply
                    </div>
                    <div style={{ fontSize: 14, color: 'rgba(255,255,255,.86)', lineHeight: 1.75 }}>
                      {latestResult.operator_reply}
                    </div>
                  </div>
                )}

                <div className="owner-intake-result-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ ...card, padding: 12 }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.22)', marginBottom: 4 }}>Kind</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.72)' }}>{latestResult.intake_kind}</div>
                  </div>
                  <div style={{ ...card, padding: 12 }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.22)', marginBottom: 4 }}>Status</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: latestResult.status === 'done' ? 'rgba(130,220,170,.85)' : latestResult.status === 'partial' ? 'rgba(255,210,120,.9)' : 'rgba(255,255,255,.72)' }}>{latestResult.status}</div>
                  </div>
                  <div style={{ ...card, padding: 12 }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.22)', marginBottom: 4 }}>Route target</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.72)' }}>{routeTargetLabel(latestResult.route_target)}</div>
                  </div>
                  <div style={{ ...card, padding: 12 }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.22)', marginBottom: 4 }}>Queue stage</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.72)' }}>{latestResult.queue_stage}</div>
                  </div>
                </div>

                <div className="owner-intake-result-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ ...card, padding: 12 }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.22)', marginBottom: 4 }}>Who answered</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.78)' }}>
                      {workflowLabel(latestResult.downstream_workflow)}
                    </div>
                  </div>
                  <div style={{ ...card, padding: 12 }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.22)', marginBottom: 4 }}>Provider</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.78)' }}>
                      {hasRealAIResponse ? `${providerLabel(activeProvider)}${activeModel ? ` · ${activeModel}` : ''}` : 'No live provider response'}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.22)', marginBottom: 8 }}>AI runtime</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <span style={runtimeBadgeStyle(verdentState)}>Verdent · {verdentState}</span>
                    <span style={runtimeBadgeStyle(anthropicState)}>{activeProvider === 'anthropic' ? 'Claude · active' : anthropicState === 'blocked' ? 'Claude · blocked' : 'Claude · standby'}</span>
                    <span style={runtimeBadgeStyle(openaiState)}>{activeProvider === 'openai' ? 'OpenAI · active' : openaiState === 'blocked' ? 'OpenAI · blocked' : 'OpenAI · standby'}</span>
                    <span style={runtimeBadgeStyle(systemWritebackOk ? 'working' : 'blocked')}>Writeback · {systemWritebackOk ? 'done' : (latestResult.writeback?.status || 'unknown')}</span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.22)', marginBottom: 4 }}>Created note</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', wordBreak: 'break-word' }}>
                    {latestResult.created_note_relative_path || 'No durable note created yet.'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.22)', marginBottom: 4 }}>Downstream</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>
                    {workflowLabel(latestResult.downstream_workflow)} · {latestResult.downstream_status}
                  </div>
                  {latestResult.downstream_reference && (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.38)', marginTop: 4, wordBreak: 'break-word' }}>
                      {latestResult.downstream_reference}
                    </div>
                  )}
                </div>

                {latestResult.follow_on_workflow && latestResult.follow_on_workflow !== 'none' && (
                  <div>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.22)', marginBottom: 4 }}>Automatic continuation</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,.78)', lineHeight: 1.6 }}>
                      {workflowLabel(latestResult.follow_on_workflow)} · {latestResult.follow_on_status}
                      {followOnAiMeta?.provider
                        ? ` · ${providerLabel(String(followOnAiMeta.provider))}${followOnAiMeta?.model ? ` (${String(followOnAiMeta.model)})` : ''}`
                        : ''}
                    </div>
                    {latestResult.follow_on_reference && (
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,.38)', marginTop: 4, wordBreak: 'break-word' }}>
                        {latestResult.follow_on_reference}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.22)', marginBottom: 4 }}>Reason</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', lineHeight: 1.6 }}>{latestResult.reason}</div>
                </div>

                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.22)', marginBottom: 4 }}>Next step</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.84)', lineHeight: 1.6 }}>{latestResult.next_step}</div>
                </div>

                {latestDownstream && (
                  <details style={{ marginTop: 2 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 12, color: 'rgba(130,150,220,.88)' }}>Show downstream payload</summary>
                    <pre style={{
                      margin: '10px 0 0',
                      padding: 12,
                      borderRadius: 12,
                      overflow: 'auto',
                      background: 'rgba(0,0,0,.25)',
                      border: '1px solid rgba(255,255,255,.06)',
                      color: 'rgba(255,255,255,.72)',
                      fontSize: 11,
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}>{latestDownstream}</pre>
                  </details>
                )}

                {latestFollowOn && latestResult.follow_on_workflow !== 'none' && (
                  <details style={{ marginTop: 2 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 12, color: 'rgba(130,220,170,.88)' }}>Show follow-on payload</summary>
                    <pre style={{
                      margin: '10px 0 0',
                      padding: 12,
                      borderRadius: 12,
                      overflow: 'auto',
                      background: 'rgba(0,0,0,.25)',
                      border: '1px solid rgba(255,255,255,.06)',
                      color: 'rgba(255,255,255,.72)',
                      fontSize: 11,
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}>{latestFollowOn}</pre>
                  </details>
                )}
              </div>
            )}
          </section>

          <section style={{ ...card, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,.78)', margin: 0 }}>Recent intake</h2>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setHistory([]); try { localStorage.removeItem(HISTORY_KEY) } catch {} }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'rgba(255,255,255,.28)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontFamily: 'inherit',
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.32)', margin: 0 }}>Recent submissions will appear here like a lightweight operator chat history.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => loadHistoryItem(item)}
                    style={{
                      ...card,
                      padding: 12,
                      textAlign: 'left',
                      cursor: 'pointer',
                      background: latestResult?.intake_id === item.id ? 'rgba(130,150,220,.08)' : 'rgba(255,255,255,.03)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.78)' }}>{item.result.title}</span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.28)', flexShrink: 0 }}>{relTime(item.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.42)', marginBottom: 6 }}>
                      {item.result.intake_kind} → {routeTargetLabel(item.result.route_target)} · {item.result.status}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.message}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
      <style>{`
        @media (max-width: 1100px) {
          .owner-intake-shell {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 720px) {
          .owner-intake-topline,
          .owner-intake-advanced,
          .owner-intake-result-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  )
}

export default function OwnerIntakePage() {
  return (
    <DevErrorBoundary>
      <OwnerIntakePageInner />
    </DevErrorBoundary>
  )
}
