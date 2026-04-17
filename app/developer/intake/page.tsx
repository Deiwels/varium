'use client'
import { useEffect, useRef, useState } from 'react'
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
  thread_id: string
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
  chat_memory: { status?: string; thread_id?: string; transcript_path?: string; summary_path?: string; reason?: string } | null
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

interface ConversationContextItem {
  id: string
  createdAt: string
  message: string
  intake_kind: IntakeKind
  route_target: string
  workflow: string
  status: string
  operator_reply: string
  next_step: string
  created_note_relative_path: string
}

interface OwnerThread {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

interface OwnerThreadSnapshot {
  thread_id: string
  project: string
  title: string
  updated: string
  workflow: string
  route_target: string
  next_step: string
  reason: string
  summary_path: string
  transcript_path: string
  transcript_preview: string
}

interface ExecutionThreadForkResult {
  agent: 'SYSTEM'
  workflow: 'fork_execution_thread'
  status: string
  thread_id: string
  title: string
  target_ai: string
  source_workflow: string
  operator_reply: string
  reason: string
  next_step: string
  referenced_notes: string[]
  chat_memory: { status?: string; thread_id?: string; transcript_path?: string; summary_path?: string; reason?: string } | null
}

interface ExecutionContract {
  status: string
  contract_note_relative_path: string
  contract_note_absolute_path: string
  read_from: string[]
  write_progress_to: string[]
  report_back_to: string[]
  starter_prompt: string
  reason: string
}

interface AIExecutionMeta {
  provider?: string
  model?: string
  input_tokens?: number
  output_tokens?: number
}

const HISTORY_KEY = 'vurium_owner_intake_history'
const THREADS_KEY = 'vurium_owner_threads'
const ACTIVE_THREAD_KEY = 'vurium_owner_active_thread'
const DEFAULT_THREAD_ID = 'copilot-01'

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
  Implementation_Packet: 'AI-3 → AI-1 / AI-2 Implementation Packet',
  Growth_Asset_Flow: 'AI-8 → AI-11 / AI-10 Growth Asset Flow',
  Research_Brief: 'AI-5 Research Brief',
  research_brief: 'AI-5 Research Brief',
  none: 'No downstream workflow',
}

function historyStorageKey(threadId: string) {
  return `${HISTORY_KEY}:${threadId}`
}

function buildThreadId() {
  return `copilot-${Date.now()}`
}

function buildThreadTitle(message: string, fallback = 'New chat') {
  const normalized = message
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 72)
  return normalized || fallback
}

function mergeThreads(localThreads: OwnerThread[], remoteThreads: OwnerThread[]) {
  const merged = new Map<string, OwnerThread>();
  for (const thread of [...localThreads, ...remoteThreads]) {
    const existing = merged.get(thread.id);
    if (!existing) {
      merged.set(thread.id, thread);
      continue;
    }
    merged.set(thread.id, {
      ...existing,
      title: existing.title === 'New chat' || existing.title === 'VuriumBook Copilot'
        ? thread.title || existing.title
        : existing.title,
      createdAt: existing.createdAt || thread.createdAt,
      updatedAt: new Date(existing.updatedAt).getTime() >= new Date(thread.updatedAt).getTime()
        ? existing.updatedAt
        : thread.updatedAt,
    });
  }
  return Array.from(merged.values()).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function buildHistoryItemFromThreadSnapshot(snapshot: OwnerThreadSnapshot): IntakeHistoryItem {
  const operatorReply = snapshot.reason
    ? `${snapshot.reason}\n\n${snapshot.next_step ? `Next step: ${snapshot.next_step}` : ''}`.trim()
    : snapshot.next_step || 'Thread restored from workspace brain memory.'

  return {
    id: `restored-${snapshot.thread_id}`,
    createdAt: snapshot.updated || new Date().toISOString(),
    message: `Restored thread: ${snapshot.title}`,
    result: {
      agent: 'SYSTEM',
      workflow: 'owner_intake',
      status: 'done',
      intake_id: `restored-${snapshot.thread_id}`,
      intake_kind: 'advisory',
      thread_id: snapshot.thread_id,
      title: snapshot.title,
      queue_stage: 'Context Restored',
      route_target: snapshot.route_target || 'none',
      created_note_relative_path: snapshot.summary_path || '',
      downstream_workflow: snapshot.workflow || 'Owner_Advisory',
      downstream_status: 'done',
      downstream_reference: snapshot.summary_path || '',
      downstream_result: {
        reply: operatorReply,
        referenced_notes: [snapshot.summary_path, snapshot.transcript_path].filter(Boolean),
      },
      escalate_to: 'none',
      reason: snapshot.reason || 'Restored from workspace brain thread memory.',
      writeback_targets: [],
      writeback: null,
      owner_notification: null,
      operator_reply: operatorReply,
      chat_memory: {
        status: 'done',
        thread_id: snapshot.thread_id,
        transcript_path: snapshot.transcript_path,
        summary_path: snapshot.summary_path,
        reason: 'Thread restored from workspace brain.',
      },
      follow_on_workflow: 'none',
      follow_on_status: 'none',
      follow_on_reference: '',
      follow_on_result: null,
      next_step: snapshot.next_step || 'Continue this thread or start a new execution request.',
    },
  }
}

function buildHistoryItemFromExecutionThreadFork(result: ExecutionThreadForkResult): IntakeHistoryItem {
  return {
    id: `fork-${result.thread_id}`,
    createdAt: new Date().toISOString(),
    message: `Opened execution thread for ${routeTargetLabel(result.target_ai)}.`,
    result: {
      agent: 'SYSTEM',
      workflow: 'owner_intake',
      status: result.status,
      intake_id: `fork-${result.thread_id}`,
      intake_kind: 'task',
      thread_id: result.thread_id,
      title: result.title,
      queue_stage: 'Execution Thread',
      route_target: result.target_ai,
      created_note_relative_path: result.chat_memory?.transcript_path || '',
      downstream_workflow: 'Implementation_Packet',
      downstream_status: result.status,
      downstream_reference: result.chat_memory?.summary_path || '',
      downstream_result: {
        target_ai: result.target_ai,
        ready_to_paste_prompt: result.operator_reply,
        referenced_notes: result.referenced_notes,
      },
      escalate_to: 'none',
      reason: result.reason,
      writeback_targets: result.referenced_notes,
      writeback: null,
      owner_notification: null,
      operator_reply: result.operator_reply,
      chat_memory: result.chat_memory,
      follow_on_workflow: 'none',
      follow_on_status: 'none',
      follow_on_reference: '',
      follow_on_result: null,
      next_step: result.next_step,
    },
  }
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

function dedupeStrings(values: Array<string | undefined | null>) {
  return [...new Set(values.map((entry) => String(entry || '').trim()).filter(Boolean))]
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

function roleLabelFromResult(result?: { route_target?: string; downstream_workflow?: string }) {
  if (!result) return 'None'
  if (result.downstream_workflow === 'Owner_Advisory') return 'Owner Copilot'
  return routeTargetLabel(result.route_target || 'none')
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

function buildConversationContext(history: IntakeHistoryItem[]): ConversationContextItem[] {
  return history
    .slice(0, 6)
    .reverse()
    .map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      message: item.message,
      intake_kind: item.result.intake_kind,
      route_target: item.result.route_target,
      workflow: item.result.downstream_workflow,
      status: item.result.status,
      operator_reply: item.result.operator_reply,
      next_step: item.result.next_step,
      created_note_relative_path: item.result.created_note_relative_path,
    }))
}

function deriveActiveFocus(history: IntakeHistoryItem[]) {
  const latestRelevant = history.find((item) => item.result.intake_kind !== 'advisory') || history[0]
  if (!latestRelevant) return null

  return {
    intake_id: latestRelevant.result.intake_id,
    title: latestRelevant.result.title,
    intake_kind: latestRelevant.result.intake_kind,
    route_target: latestRelevant.result.route_target,
    downstream_workflow: latestRelevant.result.downstream_workflow,
    created_note_relative_path: latestRelevant.result.created_note_relative_path,
    next_step: latestRelevant.result.next_step,
  }
}

function renderRichText(text: string) {
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)

  return blocks.map((block, index) => {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
    const bulletLines = lines.filter((line) => /^[-•*]\s+/.test(line))
    const isBulletBlock = bulletLines.length === lines.length && lines.length > 0

    if (isBulletBlock) {
      return (
        <ul key={`${block}-${index}`} style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>
          {lines.map((line) => (
            <li key={line} style={{ color: 'inherit' }}>{line.replace(/^[-•*]\s+/, '')}</li>
          ))}
        </ul>
      )
    }

    return (
      <p key={`${block}-${index}`} style={{ margin: 0, color: 'inherit' }}>
        {lines.join(' ')}
      </p>
    )
  })
}

type RuntimeBadgeState = 'active' | 'working' | 'fallback' | 'blocked' | 'idle' | 'standby'

interface ReplyCardData {
  header: string
  body: string
  modeNote: string
  sections: Array<{ label: string; items: string[] }>
}

interface IntakeRuntimeInfo {
  latestDownstream: string
  latestFollowOn: string
  downstreamRecord: Record<string, unknown> | null
  followOnRecord: Record<string, unknown> | null
  downstreamAiMeta: AIExecutionMeta | null
  followOnAiMeta: AIExecutionMeta | null
  effectiveReason: string
  activeProvider: string
  activeModel: string
  hasRealAIResponse: boolean
  isProviderFallback: boolean
  systemWritebackOk: boolean
  systemWorking: boolean
  executionModeLabel: string
  anthropicState: RuntimeBadgeState
  openaiState: RuntimeBadgeState
  verdentState: 'active' | 'idle'
  operatorSummary: string
  replyCard: ReplyCardData | null
  deepResearchPrompt: string
  deepResearchPromptSource: string
  deepResearchProvider: string
  externalExecutionMode: string
  executionContract: ExecutionContract | null
  starterPrompt: string
  codingPrompt: string
  codexPrompt: string
  claudePrompt: string
  returnToSystemPrompt: string
  codingPromptSource: string
  codingPromptTarget: string
}

function deriveRuntimeInfo(result: OwnerIntakeResult | null): IntakeRuntimeInfo {
  const latestDownstream = result?.downstream_result ? prettyJson(result.downstream_result) : ''
  const downstreamRecord = asRecord(result?.downstream_result)
  const downstreamAiMeta = asRecord(downstreamRecord?.ai_meta) as AIExecutionMeta | null
  const latestFollowOn = result?.follow_on_result ? prettyJson(result.follow_on_result) : ''
  const followOnRecord = asRecord(result?.follow_on_result)
  const followOnAiMeta = asRecord(followOnRecord?.ai_meta) as AIExecutionMeta | null
  const effectiveReason = String(
    (typeof downstreamRecord?.reason === 'string' && downstreamRecord.reason)
      || result?.reason
      || ''
  )
  const activeProvider = typeof downstreamAiMeta?.provider === 'string' ? downstreamAiMeta.provider : ''
  const activeModel = typeof downstreamAiMeta?.model === 'string' ? downstreamAiMeta.model : ''
  const hasRealAIResponse = Boolean(activeProvider)
  const isProviderFallback = !hasRealAIResponse && /AI provider error|AI not configured/i.test(effectiveReason)
  const systemWritebackOk = result?.intake_kind === 'advisory'
    ? true
    : result?.writeback?.status === 'done'
  const systemWorking = Boolean(result && (result.intake_kind === 'advisory'
    ? (hasRealAIResponse || result.status === 'done')
    : (systemWritebackOk && result.created_note_relative_path)))
  const executionModeLabel = hasRealAIResponse
    ? 'Real AI response'
    : isProviderFallback
      ? 'Fallback / draft mode'
      : 'Structured routing only'
  const anthropicState: RuntimeBadgeState =
    activeProvider === 'anthropic'
      ? 'active'
      : /anthropic: .*credit balance is too low|anthropic: Anthropic API key not configured/i.test(effectiveReason)
        ? 'blocked'
        : 'standby'
  const openaiState: RuntimeBadgeState =
    activeProvider === 'openai'
      ? 'active'
      : /openai: OpenAI API key not configured/i.test(effectiveReason)
        ? 'blocked'
        : 'standby'
  const verdentState: 'active' | 'idle' =
    result?.route_target === 'AI-3' || result?.downstream_workflow === 'AI3_Planning_Intake' || result?.downstream_workflow === 'AI3_QA_Scan'
      ? 'active'
      : 'idle'
  const operatorSummary = !result
    ? ''
    : result.downstream_workflow === 'Owner_Advisory'
      ? hasRealAIResponse
        ? `Owner Copilot answered through ${providerLabel(activeProvider)}.`
        : 'Owner Copilot responded in advisory mode without opening execution yet.'
      : hasRealAIResponse
        ? `${roleLabelFromResult(result)} answered through ${providerLabel(activeProvider)}.`
        : isProviderFallback
          ? `${roleLabelFromResult(result)} was routed correctly, but this run fell back because the configured AI provider chain did not complete.`
          : `${roleLabelFromResult(result)} was routed and queued without a direct AI answer yet.`

  const downstreamResearchPrompt = typeof downstreamRecord?.deep_research_prompt === 'string'
    ? downstreamRecord.deep_research_prompt.trim()
    : ''
  const followOnResearchPrompt = typeof followOnRecord?.deep_research_prompt === 'string'
    ? followOnRecord.deep_research_prompt.trim()
    : ''
  const deepResearchProvider = typeof followOnRecord?.deep_research_provider === 'string'
    ? followOnRecord.deep_research_provider.trim()
    : typeof downstreamRecord?.deep_research_provider === 'string'
      ? downstreamRecord.deep_research_provider.trim()
      : ''
  const deepResearchPrompt = followOnResearchPrompt || downstreamResearchPrompt
  const deepResearchPromptSource = followOnResearchPrompt
    ? workflowLabel(result?.follow_on_workflow || 'Research_Brief')
    : downstreamResearchPrompt
      ? workflowLabel(result?.downstream_workflow || 'Research_Brief')
      : ''
  const followOnCodingPrompt = typeof followOnRecord?.ready_to_paste_prompt === 'string'
    ? followOnRecord.ready_to_paste_prompt.trim()
    : ''
  const downstreamCodingPrompt = typeof downstreamRecord?.ready_to_paste_prompt === 'string'
    ? downstreamRecord.ready_to_paste_prompt.trim()
    : ''
  const codingPrompt = followOnCodingPrompt || downstreamCodingPrompt
  const followOnCodexPrompt = typeof followOnRecord?.codex_prompt === 'string'
    ? followOnRecord.codex_prompt.trim()
    : ''
  const downstreamCodexPrompt = typeof downstreamRecord?.codex_prompt === 'string'
    ? downstreamRecord.codex_prompt.trim()
    : ''
  const codexPrompt = followOnCodexPrompt || downstreamCodexPrompt || codingPrompt
  const followOnClaudePrompt = typeof followOnRecord?.claude_prompt === 'string'
    ? followOnRecord.claude_prompt.trim()
    : ''
  const downstreamClaudePrompt = typeof downstreamRecord?.claude_prompt === 'string'
    ? downstreamRecord.claude_prompt.trim()
    : ''
  const claudePrompt = followOnClaudePrompt || downstreamClaudePrompt || codingPrompt
  const followOnReturnPrompt = typeof followOnRecord?.return_to_system_prompt === 'string'
    ? followOnRecord.return_to_system_prompt.trim()
    : ''
  const downstreamReturnPrompt = typeof downstreamRecord?.return_to_system_prompt === 'string'
    ? downstreamRecord.return_to_system_prompt.trim()
    : ''
  const returnToSystemPrompt = followOnReturnPrompt || downstreamReturnPrompt
  const followOnExecutionContract = asRecord(followOnRecord?.execution_contract)
  const downstreamExecutionContract = asRecord(downstreamRecord?.execution_contract)
  const rawExecutionContract = followOnExecutionContract || downstreamExecutionContract
  const executionContract = rawExecutionContract
    ? {
        status: typeof rawExecutionContract.status === 'string' ? rawExecutionContract.status.trim() : '',
        contract_note_relative_path: typeof rawExecutionContract.contract_note_relative_path === 'string' ? rawExecutionContract.contract_note_relative_path.trim() : '',
        contract_note_absolute_path: typeof rawExecutionContract.contract_note_absolute_path === 'string' ? rawExecutionContract.contract_note_absolute_path.trim() : '',
        read_from: toStringList(rawExecutionContract.read_from),
        write_progress_to: toStringList(rawExecutionContract.write_progress_to),
        report_back_to: toStringList(rawExecutionContract.report_back_to),
        starter_prompt: typeof rawExecutionContract.starter_prompt === 'string' ? rawExecutionContract.starter_prompt.trim() : '',
        reason: typeof rawExecutionContract.reason === 'string' ? rawExecutionContract.reason.trim() : '',
      }
    : null
  const followOnStarterPrompt = typeof followOnRecord?.starter_prompt === 'string'
    ? followOnRecord.starter_prompt.trim()
    : ''
  const downstreamStarterPrompt = typeof downstreamRecord?.starter_prompt === 'string'
    ? downstreamRecord.starter_prompt.trim()
    : ''
  const starterPrompt = followOnStarterPrompt || downstreamStarterPrompt || executionContract?.starter_prompt || ''
  const codingPromptSource = followOnCodingPrompt
    ? workflowLabel(result?.follow_on_workflow || 'Implementation_Packet')
    : downstreamCodingPrompt
      ? workflowLabel(result?.downstream_workflow || 'Implementation_Packet')
      : ''
  const codingPromptTarget = typeof followOnRecord?.target_ai === 'string'
    ? followOnRecord.target_ai.trim()
    : typeof downstreamRecord?.target_ai === 'string'
      ? downstreamRecord.target_ai.trim()
      : ''
  const externalExecutionMode = typeof followOnRecord?.execution_mode === 'string'
    ? followOnRecord.execution_mode.trim()
    : typeof downstreamRecord?.execution_mode === 'string'
      ? downstreamRecord.execution_mode.trim()
      : ''

  const replyCard = (() => {
    if (!result) return null

    const header = result.downstream_workflow === 'Owner_Advisory'
      ? hasRealAIResponse
        ? 'Owner Copilot replied'
        : 'Owner Copilot prepared a draft reply'
      : hasRealAIResponse
        ? `${roleLabelFromResult(result)} replied`
        : `${roleLabelFromResult(result)} prepared a draft reply`
    const modeNote = hasRealAIResponse
      ? `Role lane: ${roleLabelFromResult(result)}. Model provider: ${providerLabel(activeProvider)}.${activeModel ? ` Model: ${activeModel}.` : ''}`
      : isProviderFallback
        ? `Role lane: ${roleLabelFromResult(result)}. This run fell back to a draft/structured result because the live AI provider chain did not complete.`
        : `Role lane: ${roleLabelFromResult(result)}. The system routed the request and prepared the next lane, but no direct AI answer is attached yet.`

    if (result.downstream_workflow === 'AI3_Planning_Intake') {
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

    if (result.downstream_workflow === 'Owner_Advisory') {
      const advisoryReply = typeof downstreamRecord?.reply === 'string' ? downstreamRecord.reply.trim() : ''
      const suggestedMode = typeof downstreamRecord?.suggested_mode === 'string' ? downstreamRecord.suggested_mode.trim() : ''
      const referencedNotes = toStringList(downstreamRecord?.referenced_notes)

      return {
        header,
        body: advisoryReply || 'The owner copilot responded without opening a delivery task yet.',
        modeNote,
        sections: [
          { label: 'Suggested next mode', items: suggestedMode && suggestedMode !== 'none' ? [suggestedMode] : [] },
          { label: 'Relevant docs', items: referencedNotes.slice(0, 8) },
        ].filter((section) => section.items.length > 0),
      }
    }

    if (result.downstream_workflow === 'Growth_Asset_Flow') {
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

    if (result.downstream_workflow === 'Research_Brief') {
      const facts = toStringList(downstreamRecord?.facts)
      const inferences = toStringList(downstreamRecord?.inferences)
      const openQuestions = toStringList(downstreamRecord?.open_questions)
      const deepResearchPrompt = typeof downstreamRecord?.deep_research_prompt === 'string'
        ? downstreamRecord.deep_research_prompt.trim()
        : ''

      return {
        header,
        body: facts[0] || inferences[0] || 'The research lane created a source-backed brief shell.',
        modeNote,
        sections: [
          { label: 'Facts', items: facts.slice(0, 4) },
          { label: 'Inferences', items: inferences.slice(0, 3) },
          { label: 'Open questions', items: openQuestions.slice(0, 4) },
          { label: 'AI-5 Deep Research', items: deepResearchPrompt ? [`Ready-to-paste prompt prepared${deepResearchProvider ? ` for ${providerLabel(deepResearchProvider)}` : ''}.`] : [] },
        ].filter((section) => section.items.length > 0),
      }
    }

    if (result.downstream_workflow === 'Implementation_Packet') {
      const fileTargets = toStringList(downstreamRecord?.file_targets)
      const changeSummary = toStringList(downstreamRecord?.change_summary)
      const verificationSteps = toStringList(downstreamRecord?.verification_steps)
      const targetAi = typeof downstreamRecord?.target_ai === 'string' ? downstreamRecord.target_ai.trim() : ''
      const executionMode = typeof downstreamRecord?.execution_mode === 'string' ? downstreamRecord.execution_mode.trim() : ''

      return {
        header,
        body: typeof downstreamRecord?.objective === 'string' && downstreamRecord.objective.trim()
          ? downstreamRecord.objective.trim()
          : 'The system prepared an external coding packet for implementation.',
        modeNote,
        sections: [
          { label: 'Target lane', items: targetAi ? [targetAi] : [] },
          { label: 'Execution mode', items: executionMode ? [executionMode.replace(/_/g, ' ')] : ['external ai'] },
          { label: 'File targets', items: fileTargets.slice(0, 6) },
          { label: 'Required changes', items: changeSummary.slice(0, 6) },
          { label: 'Verification', items: verificationSteps.slice(0, 5) },
        ].filter((section) => section.items.length > 0),
      }
    }

    if (result.intake_kind === 'handoff') {
      return {
        header,
        body: 'The system created a handoff note and queued it for the next owner.',
        modeNote,
        sections: [],
      }
    }

    if (result.intake_kind === 'truth_update_draft') {
      return {
        header,
        body: 'The system created a truth-update draft for review instead of mutating canonical docs directly.',
        modeNote,
        sections: [],
      }
    }

    return {
      header,
      body: result.next_step || result.reason || 'The system routed this request successfully.',
      modeNote,
      sections: [],
    }
  })()

  return {
    latestDownstream,
    latestFollowOn,
    downstreamRecord,
    followOnRecord,
    downstreamAiMeta,
    followOnAiMeta,
    effectiveReason,
    activeProvider,
    activeModel,
    hasRealAIResponse,
    isProviderFallback,
    systemWritebackOk,
    systemWorking,
    executionModeLabel,
    anthropicState,
    openaiState,
    verdentState,
    operatorSummary,
    replyCard,
    deepResearchPrompt,
    deepResearchPromptSource,
    deepResearchProvider,
    externalExecutionMode,
    executionContract,
    starterPrompt,
    codingPrompt,
    codexPrompt,
    claudePrompt,
    returnToSystemPrompt,
    codingPromptSource,
    codingPromptTarget,
  }
}

function OwnerIntakePageInner() {
  const toast = useToast()
  const conversationEndRef = useRef<HTMLDivElement | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
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
  const [forkingThreadId, setForkingThreadId] = useState('')
  const [latestResult, setLatestResult] = useState<OwnerIntakeResult | null>(null)
  const [threads, setThreads] = useState<OwnerThread[]>([])
  const [activeThreadId, setActiveThreadId] = useState(DEFAULT_THREAD_ID)
  const [hydratedThreadId, setHydratedThreadId] = useState('')
  const [history, setHistory] = useState<IntakeHistoryItem[]>([])
  const [remoteThreadsLoaded, setRemoteThreadsLoaded] = useState(false)

  useEffect(() => {
    try {
      const rawThreads = localStorage.getItem(THREADS_KEY)
      const parsedThreads = rawThreads ? JSON.parse(rawThreads) as OwnerThread[] : []
      const initialThreads = Array.isArray(parsedThreads) && parsedThreads.length
        ? parsedThreads
        : [{
            id: DEFAULT_THREAD_ID,
            title: 'VuriumBook Copilot',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }]
      setThreads(initialThreads)

      const storedActive = localStorage.getItem(ACTIVE_THREAD_KEY)
      const nextActive = initialThreads.some((thread) => thread.id === storedActive)
        ? String(storedActive)
        : initialThreads[0].id
      setActiveThreadId(nextActive)
    } catch {}
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadRemoteThreads() {
      try {
        const response = await devFetch('/api/vurium-dev/ai/owner-threads') as { project?: string; threads?: Array<{ thread_id: string; title: string; updated: string }> }
        if (cancelled) return
        const remoteThreads = Array.isArray(response?.threads)
          ? response.threads
            .map((thread) => ({
              id: String(thread.thread_id || '').trim(),
              title: String(thread.title || '').trim() || 'Recovered chat',
              createdAt: String(thread.updated || new Date().toISOString()),
              updatedAt: String(thread.updated || new Date().toISOString()),
            }))
            .filter((thread) => thread.id)
          : []
        if (remoteThreads.length) {
          setThreads((prev) => mergeThreads(prev, remoteThreads))
        }
      } catch {
      } finally {
        if (!cancelled) setRemoteThreadsLoaded(true)
      }
    }

    void loadRemoteThreads()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    try {
      if (!threads.length) return
      localStorage.setItem(THREADS_KEY, JSON.stringify(threads))
      localStorage.setItem(ACTIVE_THREAD_KEY, activeThreadId)
    } catch {}
  }, [threads, activeThreadId])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(historyStorageKey(activeThreadId))
      const parsed = raw ? JSON.parse(raw) as IntakeHistoryItem[] : []
      const safeHistory = Array.isArray(parsed) ? parsed : []
      setHistory(safeHistory)
      setLatestResult(safeHistory[0]?.result || null)
      setHydratedThreadId(activeThreadId)
    } catch {
      setHistory([])
      setLatestResult(null)
      setHydratedThreadId(activeThreadId)
    }
  }, [activeThreadId])

  useEffect(() => {
    let cancelled = false
    if (!remoteThreadsLoaded || !activeThreadId || history.length > 0) return

    async function hydrateThreadFromBrain() {
      try {
        const snapshot = await devFetch(`/api/vurium-dev/ai/owner-threads/${encodeURIComponent(activeThreadId)}`) as OwnerThreadSnapshot
        if (cancelled || !snapshot?.thread_id) return
        const restored = [buildHistoryItemFromThreadSnapshot(snapshot)]
        setHistory(restored)
        setLatestResult(restored[0].result)
      } catch {
      }
    }

    void hydrateThreadFromBrain()
    return () => {
      cancelled = true
    }
  }, [activeThreadId, history.length, remoteThreadsLoaded])

  useEffect(() => {
    try {
      if (!activeThreadId || hydratedThreadId !== activeThreadId) return
      localStorage.setItem(historyStorageKey(activeThreadId), JSON.stringify(history.slice(0, 20)))
    } catch {}
  }, [history, activeThreadId, hydratedThreadId])

  useEffect(() => {
    if (!conversationEndRef.current) return
    conversationEndRef.current.scrollIntoView({ behavior: history.length > 0 ? 'smooth' : 'auto', block: 'end' })
  }, [history.length, latestResult?.intake_id, isSubmitting])

  async function sendIntake(overrides?: { message?: string; intakeKind?: IntakeKind }) {
    const nextMessage = overrides?.message ?? message
    const nextKind = overrides?.intakeKind ?? intakeKind
    if (!nextMessage.trim()) {
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
            owner_conversation_history: buildConversationContext(history),
            active_focus: deriveActiveFocus(history),
          },
          payload: {
            message: nextMessage.trim(),
            title: title.trim(),
            intake_kind: nextKind,
            thread_id: activeThreadId,
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
          message: nextMessage.trim(),
          result: response,
        },
        ...prev.filter((item) => item.id !== response.intake_id),
      ].slice(0, 12))
      setThreads((prev) => {
        const nextTitle = buildThreadTitle(title.trim() || response.title || nextMessage.trim(), 'New chat')
        const nowIso = new Date().toISOString()
        const exists = prev.some((thread) => thread.id === activeThreadId)
        if (!exists) {
          return [{ id: activeThreadId, title: nextTitle, createdAt: nowIso, updatedAt: nowIso }, ...prev]
        }
        return prev.map((thread) => (
          thread.id === activeThreadId
            ? {
                ...thread,
                title: thread.title === 'New chat' || thread.title === 'VuriumBook Copilot'
                  ? nextTitle
                  : thread.title,
                updatedAt: nowIso,
              }
            : thread
        )).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      })
      toast.show(
        response.intake_kind === 'advisory'
          ? 'Owner Copilot replied.'
          : `Created ${response.intake_kind} and routed it to ${response.route_target}.`
      )
      setMessage('')
      setTitle('')
      setRelatedTaskId('')
      setSourceUrls('')
      setQuestions('')
      setTargetSources('')
      setRelatedLinks('')
      setAudience('')
      setChannel('')
      setIntakeKind('auto')
      setPriority('medium')
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

  async function submitIntake(event: React.FormEvent) {
    event.preventDefault()
    await sendIntake()
  }

  function loadHistoryItem(item: IntakeHistoryItem) {
    setLatestResult(item.result)
    setMessage(item.message)
    setTitle(item.result.title)
    setIntakeKind('auto')
    setPriority('medium')
    toast.show('Loaded into composer in Auto mode for a follow-up.')
  }

  function stageQuickAction(nextMessage: string, nextKind: IntakeKind = 'auto') {
    setMessage(nextMessage)
    setIntakeKind(nextKind)
    composerRef.current?.focus()
    toast.show('Prepared the next step in the composer.')
  }

  function createNewThread() {
    const id = buildThreadId()
    const nowIso = new Date().toISOString()
    const nextThread: OwnerThread = {
      id,
      title: 'New chat',
      createdAt: nowIso,
      updatedAt: nowIso,
    }
    setThreads((prev) => [nextThread, ...prev])
    setActiveThreadId(id)
    setHistory([])
    setLatestResult(null)
    setMessage('')
    setTitle('')
    setIntakeKind('auto')
    toast.show('Started a new chat thread.')
  }

  async function forkExecutionThread(item: IntakeHistoryItem, info: IntakeRuntimeInfo) {
    if (!info.starterPrompt && !info.codexPrompt && !info.codingPrompt) {
      toast.show('There is no coding prompt to open yet.', 'error')
      return
    }

    const targetAi = info.codingPromptTarget || 'AI-1'
    const sourceRecord = info.followOnRecord || info.downstreamRecord
    const payload = {
      source_thread_id: item.result.thread_id || activeThreadId,
      title: `${routeTargetLabel(targetAi)} · ${item.result.title || item.message}`,
      target_ai: targetAi,
      coding_prompt: info.starterPrompt || info.codexPrompt || info.codingPrompt,
      source_workflow: item.result.follow_on_workflow !== 'none'
        ? item.result.follow_on_workflow
        : item.result.downstream_workflow,
      source_note_paths: dedupeStrings([
        info.executionContract?.contract_note_relative_path,
        item.result.created_note_relative_path,
        item.result.downstream_reference,
        item.result.follow_on_reference,
        item.result.chat_memory?.summary_path,
      ]),
      file_targets: toStringList(sourceRecord?.file_targets),
      change_summary: toStringList(sourceRecord?.change_summary),
      verification_steps: toStringList(sourceRecord?.verification_steps),
    }

    setForkingThreadId(item.id)
    try {
      const response = await devFetch('/api/vurium-dev/ai/owner-threads/fork-execution', {
        method: 'POST',
        body: JSON.stringify({ payload }),
      }) as ExecutionThreadForkResult
      const nowIso = new Date().toISOString()
      const nextThread: OwnerThread = {
        id: response.thread_id,
        title: response.title,
        createdAt: nowIso,
        updatedAt: nowIso,
      }
      const seededHistory = [buildHistoryItemFromExecutionThreadFork(response)]
      try {
        localStorage.setItem(historyStorageKey(response.thread_id), JSON.stringify(seededHistory))
        localStorage.setItem(ACTIVE_THREAD_KEY, response.thread_id)
      } catch {}
      setThreads((prev) => mergeThreads([nextThread], prev))
      setActiveThreadId(response.thread_id)
      setHistory(seededHistory)
      setLatestResult(seededHistory[0].result)
      setHydratedThreadId(response.thread_id)
      setMessage('')
      setTitle('')
      setIntakeKind('auto')
      toast.show(`Opened ${routeTargetLabel(targetAi)} execution memory thread.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not open execution thread'
      toast.show(message, 'error')
    } finally {
      setForkingThreadId('')
    }
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    if (!isSubmitting) {
      void sendIntake()
    }
  }

  const latestInfo = deriveRuntimeInfo(latestResult)
  const displayHistory = [...history].reverse()
  const activeFocus = deriveActiveFocus(history)
  const submitLabel = isSubmitting
    ? 'Thinking…'
    : intakeKind === 'task' || intakeKind === 'growth' || intakeKind === 'research'
      ? 'Start workflow'
      : 'Ask system'
  const composerModeHint = intakeKind === 'auto'
    ? 'Auto mode: follow-up questions stay conversational. Explicit start / plan / fix requests will open execution lanes.'
    : intakeKind === 'advisory'
      ? 'Discuss mode: the system will answer first and avoid opening tasks unless you later tell it to start.'
      : `${kindPresets.find((preset) => preset.kind === intakeKind)?.label || intakeKind} mode: the next send will open that lane directly.`

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,.85)', margin: 0 }}>Owner Intake</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.32)', margin: '6px 0 0', maxWidth: 720, lineHeight: 1.6 }}>
            One box for the whole operating system. Ask broad questions, think through ideas, or start work. The system answers in a chat flow first, then only opens tasks and lanes when your request clearly moves into execution.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <section style={{ ...card, padding: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {threads.map((thread) => {
            const active = thread.id === activeThreadId
            return (
              <button
                key={thread.id}
                type="button"
                onClick={() => setActiveThreadId(thread.id)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 999,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: 'inherit',
                  background: active ? 'rgba(130,150,220,.18)' : 'rgba(255,255,255,.06)',
                  color: active ? 'rgba(130,150,220,.96)' : 'rgba(255,255,255,.54)',
                  maxWidth: 220,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={thread.title}
              >
                {thread.title}
              </button>
            )
          })}
          <button
            type="button"
            onClick={createNewThread}
            style={{
              marginLeft: 'auto',
              padding: '8px 12px',
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'inherit',
              background: 'rgba(130,220,170,.14)',
              color: 'rgba(130,220,170,.94)',
            }}
          >
            + New chat
          </button>
        </section>

        <section style={{ ...card, padding: 16, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.82)' }}>
              Owner Copilot is live
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.42)', lineHeight: 1.6 }}>
              Broad questions stay conversational first. Explicit start/build/plan requests open execution lanes automatically. Recent turns and current focus are now carried forward automatically.
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.28)', lineHeight: 1.6 }}>
              Active thread: {threads.find((thread) => thread.id === activeThreadId)?.title || activeThreadId}
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span style={runtimeBadgeStyle(latestInfo.verdentState)}>Verdent · {latestInfo.verdentState}</span>
            <span style={runtimeBadgeStyle(latestInfo.anthropicState)}>
              {latestInfo.activeProvider === 'anthropic' ? 'Claude · active' : latestInfo.anthropicState === 'blocked' ? 'Claude · blocked' : 'Claude · standby'}
            </span>
            <span style={runtimeBadgeStyle(latestInfo.openaiState)}>
              {latestInfo.activeProvider === 'openai' ? 'OpenAI · active' : latestInfo.openaiState === 'blocked' ? 'OpenAI · blocked' : 'OpenAI · standby'}
            </span>
          </div>
        </section>

        <section style={{ ...card, minHeight: 'calc(100vh - 260px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px clamp(16px, 4vw, 40px)', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {displayHistory.length === 0 && !isSubmitting ? (
              <div style={{ display: 'grid', gap: 16, maxWidth: 860, margin: 'auto 0' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,.84)' }}>
                  Start with a question or a command
                </div>
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                  {[
                    'Скажи коротко, де ми зараз по VuriumBook і що краще робити далі.',
                    'Починаємо проект: сплануй safer booking confirmation flow для reminder SMS і запусти Verdent.',
                    'Знайди офіційні вимоги для SMS consent wording і підготуй research.',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setMessage(suggestion)}
                      style={{
                        ...card,
                        padding: 14,
                        textAlign: 'left',
                        cursor: 'pointer',
                        background: 'rgba(255,255,255,.035)',
                        color: 'rgba(255,255,255,.72)',
                        fontSize: 13,
                        lineHeight: 1.6,
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {displayHistory.map((item) => {
                  const info = deriveRuntimeInfo(item.result)
                  const primaryAssistantText = item.result.operator_reply || info.replyCard?.body || item.result.next_step || item.result.reason
                  const secondaryReply = info.replyCard?.body && info.replyCard.body !== primaryAssistantText
                    ? info.replyCard.body
                    : ''
                  return (
                    <div key={item.id} style={{ display: 'grid', gap: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => loadHistoryItem(item)}
                          style={{
                            maxWidth: 'min(760px, 92%)',
                            border: 'none',
                            cursor: 'pointer',
                            borderRadius: '22px 22px 8px 22px',
                            background: 'linear-gradient(180deg, rgba(143,164,255,.18), rgba(112,133,255,.11))',
                            color: 'rgba(255,255,255,.92)',
                            padding: '16px 18px',
                            textAlign: 'left',
                            boxShadow: '0 10px 30px rgba(0,0,0,.16)',
                          }}
                        >
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.46)', marginBottom: 8 }}>
                            You · {relTime(item.createdAt)}
                          </div>
                          <div style={{ fontSize: 14, lineHeight: 1.75 }}>{item.message}</div>
                        </button>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div
                          style={{
                            maxWidth: 'min(940px, 98%)',
                            borderRadius: '22px 22px 22px 8px',
                            background: 'rgba(255,255,255,.04)',
                            border: '1px solid rgba(255,255,255,.06)',
                            padding: '18px 18px 16px',
                          }}
                        >
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.82)' }}>
                              {workflowLabel(item.result.downstream_workflow)}
                            </span>
                            <span style={runtimeBadgeStyle(info.systemWorking ? 'working' : info.isProviderFallback ? 'fallback' : 'blocked')}>
                              {info.executionModeLabel}
                            </span>
                            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.38)' }}>
                              {info.operatorSummary}
                            </span>
                          </div>

                          <div style={{ fontSize: 15, color: 'rgba(255,255,255,.9)', lineHeight: 1.78, display: 'grid', gap: 12 }}>
                            {renderRichText(primaryAssistantText)}
                          </div>

                          {secondaryReply && (
                            <div style={{
                              ...card,
                              marginTop: 14,
                              padding: 14,
                              background: 'rgba(130,150,220,.06)',
                              borderColor: 'rgba(130,150,220,.12)',
                            }}>
                              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(130,150,220,.8)', marginBottom: 6 }}>
                                AI detail
                              </div>
                              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.8)', lineHeight: 1.7, display: 'grid', gap: 10 }}>
                                {renderRichText(secondaryReply)}
                              </div>
                            </div>
                          )}

                          {info.replyCard?.sections.length ? (
                            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                              {info.replyCard.sections.map((section) => (
                                <div key={section.label}>
                                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.24)', marginBottom: 6 }}>
                                    {section.label}
                                  </div>
                                  <ul style={{ margin: 0, paddingLeft: 18, color: 'rgba(255,255,255,.72)', fontSize: 12, lineHeight: 1.7 }}>
                                    {section.items.map((entry) => (
                                      <li key={entry}>{entry}</li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {item.result.follow_on_workflow && item.result.follow_on_workflow !== 'none' && (
                            <div style={{
                              ...card,
                              marginTop: 14,
                              padding: 12,
                              background: 'rgba(130,220,170,.05)',
                              borderColor: 'rgba(130,220,170,.12)',
                            }}>
                              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(130,220,170,.8)', marginBottom: 6 }}>
                                Automatic continuation
                              </div>
                              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.82)', lineHeight: 1.65 }}>
                                {workflowLabel(item.result.follow_on_workflow)} · {item.result.follow_on_status}
                                {info.followOnAiMeta?.provider
                                  ? ` · ${providerLabel(String(info.followOnAiMeta.provider))}${info.followOnAiMeta?.model ? ` (${String(info.followOnAiMeta.model)})` : ''}`
                                  : ''}
                              </div>
                              {item.result.follow_on_reference && (
                                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.38)', marginTop: 6, wordBreak: 'break-word' }}>
                                  {item.result.follow_on_reference}
                                </div>
                              )}
                            </div>
                          )}

                          {info.deepResearchPrompt && (
                            <div style={{
                              ...card,
                              marginTop: 14,
                              padding: 14,
                              background: 'rgba(120,170,255,.07)',
                              borderColor: 'rgba(120,170,255,.16)',
                            }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'grid', gap: 4 }}>
                                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(120,170,255,.86)' }}>
                                    AI-5 Deep Research Prompt
                                  </div>
                                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.78)', lineHeight: 1.6 }}>
                                    Ready for AI-5 Deep Research{info.deepResearchProvider ? ` via ${providerLabel(info.deepResearchProvider)}` : ''}. Source: {info.deepResearchPromptSource || 'AI-5 Research'}.
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(info.deepResearchPrompt)
                                      toast.show('Copied AI-5 Deep Research prompt.')
                                    } catch {
                                      toast.show('Could not copy the AI-5 prompt.', 'error')
                                    }
                                  }}
                                  style={{
                                    padding: '8px 12px',
                                    borderRadius: 999,
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    fontFamily: 'inherit',
                                    background: 'rgba(120,170,255,.18)',
                                    color: 'rgba(120,170,255,.98)',
                                  }}
                                >
                                  Copy AI-5 prompt
                                </button>
                              </div>

                              <details style={{ marginTop: 12 }}>
                                <summary style={{ cursor: 'pointer', fontSize: 12, color: 'rgba(120,170,255,.92)' }}>
                                  Preview prompt
                                </summary>
                                <pre style={{
                                  margin: '10px 0 0',
                                  padding: 12,
                                  borderRadius: 12,
                                  overflow: 'auto',
                                  background: 'rgba(0,0,0,.22)',
                                  border: '1px solid rgba(255,255,255,.06)',
                                  color: 'rgba(255,255,255,.78)',
                                  fontSize: 11,
                                  lineHeight: 1.65,
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                }}>{info.deepResearchPrompt}</pre>
                              </details>
                            </div>
                          )}

                          {(info.starterPrompt || info.codingPrompt) && (
                            <div style={{
                              ...card,
                              marginTop: 14,
                              padding: 14,
                              background: 'rgba(130,220,170,.07)',
                              borderColor: 'rgba(130,220,170,.16)',
                            }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'grid', gap: 4 }}>
                                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(130,220,170,.86)' }}>
                                    Execution Contract
                                  </div>
                                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.78)', lineHeight: 1.6 }}>
                                    Ready for {info.codingPromptTarget ? routeTargetLabel(info.codingPromptTarget) : 'the implementation lane'} through one shared memory contract. Source: {info.codingPromptSource || 'Implementation Packet'}.
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(info.starterPrompt || info.codexPrompt || info.codingPrompt)
                                      toast.show('Copied starter prompt.')
                                    } catch {
                                      toast.show('Could not copy the starter prompt.', 'error')
                                    }
                                  }}
                                  style={{
                                    padding: '8px 12px',
                                    borderRadius: 999,
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    fontFamily: 'inherit',
                                    background: 'rgba(130,220,170,.18)',
                                    color: 'rgba(130,220,170,.98)',
                                  }}
                                >
                                  Copy starter prompt
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(info.claudePrompt || info.codingPrompt)
                                      toast.show('Copied Claude prompt.')
                                    } catch {
                                      toast.show('Could not copy the Claude prompt.', 'error')
                                    }
                                  }}
                                  style={{
                                    padding: '8px 12px',
                                    borderRadius: 999,
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    fontFamily: 'inherit',
                                    background: 'rgba(130,150,220,.16)',
                                    color: 'rgba(130,150,220,.98)',
                                  }}
                                >
                                  Copy Claude variant
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(info.returnToSystemPrompt || 'Paste the implementation result back into Owner Copilot with changed files, checks run, blockers, and next step.')
                                      toast.show('Copied return prompt.')
                                    } catch {
                                      toast.show('Could not copy the return prompt.', 'error')
                                    }
                                  }}
                                  style={{
                                    padding: '8px 12px',
                                    borderRadius: 999,
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    fontFamily: 'inherit',
                                    background: 'rgba(255,255,255,.08)',
                                    color: 'rgba(255,255,255,.9)',
                                  }}
                                >
                                  Copy return prompt
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { void forkExecutionThread(item, info) }}
                                  disabled={forkingThreadId === item.id}
                                  style={{
                                    padding: '8px 12px',
                                    borderRadius: 999,
                                    border: 'none',
                                    cursor: forkingThreadId === item.id ? 'wait' : 'pointer',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    fontFamily: 'inherit',
                                    background: 'rgba(255,255,255,.08)',
                                    color: 'rgba(255,255,255,.9)',
                                    opacity: forkingThreadId === item.id ? 0.72 : 1,
                                  }}
                                >
                                  {forkingThreadId === item.id ? 'Opening…' : 'Open execution memory'}
                                </button>
                              </div>

                              {info.executionContract && (
                                <div style={{
                                  marginTop: 12,
                                  padding: 12,
                                  borderRadius: 12,
                                  background: 'rgba(255,255,255,.04)',
                                  border: '1px solid rgba(255,255,255,.06)',
                                  display: 'grid',
                                  gap: 12,
                                }}>
                                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,.62)' }}>
                                    Memory contract
                                  </div>
                                  <div style={{ display: 'grid', gap: 10 }}>
                                    <div>
                                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(130,220,170,.72)', marginBottom: 6 }}>
                                        Read from
                                      </div>
                                      <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6, color: 'rgba(255,255,255,.78)', fontSize: 12.5, lineHeight: 1.6 }}>
                                        {info.executionContract.read_from.map((entry) => (
                                          <li key={entry} style={{ wordBreak: 'break-word' }}>{entry}</li>
                                        ))}
                                      </ul>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(130,220,170,.72)', marginBottom: 6 }}>
                                        Write progress to
                                      </div>
                                      <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6, color: 'rgba(255,255,255,.78)', fontSize: 12.5, lineHeight: 1.6 }}>
                                        {info.executionContract.write_progress_to.map((entry) => (
                                          <li key={entry} style={{ wordBreak: 'break-word' }}>{entry}</li>
                                        ))}
                                      </ul>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(130,220,170,.72)', marginBottom: 6 }}>
                                        Report back to
                                      </div>
                                      <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6, color: 'rgba(255,255,255,.78)', fontSize: 12.5, lineHeight: 1.6 }}>
                                        {info.executionContract.report_back_to.map((entry) => (
                                          <li key={entry} style={{ wordBreak: 'break-word' }}>{entry}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                </div>
                              )}

                              <details style={{ marginTop: 12 }}>
                                <summary style={{ cursor: 'pointer', fontSize: 12, color: 'rgba(130,220,170,.92)' }}>
                                  Preview contract + provider variants
                                </summary>
                                <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                                  <div>
                                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(130,220,170,.72)', marginBottom: 6 }}>
                                      Starter prompt
                                    </div>
                                    <pre style={{
                                      margin: 0,
                                      padding: 12,
                                      borderRadius: 12,
                                      overflow: 'auto',
                                      background: 'rgba(0,0,0,.22)',
                                      border: '1px solid rgba(255,255,255,.06)',
                                      color: 'rgba(255,255,255,.78)',
                                      fontSize: 11,
                                      lineHeight: 1.65,
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word',
                                    }}>{info.starterPrompt || info.codexPrompt || info.codingPrompt}</pre>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(130,220,170,.72)', marginBottom: 6 }}>
                                      Codex
                                    </div>
                                    <pre style={{
                                      margin: 0,
                                      padding: 12,
                                      borderRadius: 12,
                                      overflow: 'auto',
                                      background: 'rgba(0,0,0,.22)',
                                      border: '1px solid rgba(255,255,255,.06)',
                                      color: 'rgba(255,255,255,.78)',
                                      fontSize: 11,
                                      lineHeight: 1.65,
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word',
                                    }}>{info.codexPrompt || info.starterPrompt || info.codingPrompt}</pre>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(130,150,220,.72)', marginBottom: 6 }}>
                                      Claude
                                    </div>
                                    <pre style={{
                                      margin: 0,
                                      padding: 12,
                                      borderRadius: 12,
                                      overflow: 'auto',
                                      background: 'rgba(0,0,0,.22)',
                                      border: '1px solid rgba(255,255,255,.06)',
                                      color: 'rgba(255,255,255,.78)',
                                      fontSize: 11,
                                      lineHeight: 1.65,
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word',
                                    }}>{info.claudePrompt || info.starterPrompt || info.codingPrompt}</pre>
                                  </div>
                                  {info.returnToSystemPrompt && (
                                    <div>
                                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,.62)', marginBottom: 6 }}>
                                        Return to system
                                      </div>
                                      <pre style={{
                                        margin: 0,
                                        padding: 12,
                                        borderRadius: 12,
                                        overflow: 'auto',
                                        background: 'rgba(0,0,0,.22)',
                                        border: '1px solid rgba(255,255,255,.06)',
                                        color: 'rgba(255,255,255,.78)',
                                        fontSize: 11,
                                        lineHeight: 1.65,
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                      }}>{info.returnToSystemPrompt}</pre>
                                    </div>
                                  )}
                                </div>
                              </details>
                            </div>
                          )}

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                            {item.result.next_step && (
                              <button
                                type="button"
                                onClick={() => stageQuickAction(item.result.next_step, item.result.intake_kind === 'advisory' ? 'auto' : item.result.intake_kind)}
                                style={{
                                  padding: '8px 12px',
                                  borderRadius: 999,
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  fontFamily: 'inherit',
                                  background: 'rgba(130,150,220,.16)',
                                  color: 'rgba(130,150,220,.95)',
                                }}
                              >
                                Use next step
                              </button>
                            )}
                            {item.result.intake_kind === 'advisory' && info.replyCard?.sections.some((section) => section.label === 'Suggested next mode' && section.items[0]) && (
                              <button
                                type="button"
                                onClick={() => {
                                  const suggested = info.replyCard?.sections.find((section) => section.label === 'Suggested next mode')?.items[0] as IntakeKind | undefined
                                  stageQuickAction(item.result.next_step || item.message, suggested || 'auto')
                                }}
                                style={{
                                  padding: '8px 12px',
                                  borderRadius: 999,
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  fontFamily: 'inherit',
                                  background: 'rgba(130,220,170,.14)',
                                  color: 'rgba(130,220,170,.94)',
                                }}
                              >
                                Continue in suggested mode
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => stageQuickAction(item.message, 'auto')}
                              style={{
                                padding: '8px 12px',
                                borderRadius: 999,
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 700,
                                fontFamily: 'inherit',
                                background: 'rgba(255,255,255,.06)',
                                color: 'rgba(255,255,255,.62)',
                              }}
                            >
                              Edit and resend
                            </button>
                          </div>

                          <details style={{ marginTop: 14 }}>
                            <summary style={{ cursor: 'pointer', fontSize: 12, color: 'rgba(130,150,220,.88)' }}>
                              Show execution details
                            </summary>
                            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                              <div className="owner-intake-result-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div style={{ ...card, padding: 12 }}>
                                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.22)', marginBottom: 4 }}>Kind</div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.72)' }}>{item.result.intake_kind}</div>
                                </div>
                                <div style={{ ...card, padding: 12 }}>
                                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.22)', marginBottom: 4 }}>Status</div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: item.result.status === 'done' ? 'rgba(130,220,170,.85)' : item.result.status === 'partial' ? 'rgba(255,210,120,.9)' : 'rgba(255,255,255,.72)' }}>{item.result.status}</div>
                                </div>
                                <div style={{ ...card, padding: 12 }}>
                                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.22)', marginBottom: 4 }}>AI role</div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.72)' }}>{roleLabelFromResult(item.result)}</div>
                                </div>
                                <div style={{ ...card, padding: 12 }}>
                                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.22)', marginBottom: 4 }}>Queue stage</div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.72)' }}>{item.result.queue_stage}</div>
                                </div>
                              </div>

                              <div className="owner-intake-result-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div style={{ ...card, padding: 12 }}>
                                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.22)', marginBottom: 4 }}>Execution lane</div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.78)' }}>
                                    {workflowLabel(item.result.downstream_workflow)}
                                  </div>
                                </div>
                                <div style={{ ...card, padding: 12 }}>
                                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.22)', marginBottom: 4 }}>Model provider</div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.78)' }}>
                                    {info.hasRealAIResponse ? `${providerLabel(info.activeProvider)}${info.activeModel ? ` · ${info.activeModel}` : ''}` : 'No live provider response'}
                                  </div>
                                </div>
                              </div>

                              <div className="owner-intake-result-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div style={{ ...card, padding: 12 }}>
                                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.22)', marginBottom: 4 }}>Created note</div>
                                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.72)', wordBreak: 'break-word' }}>
                                    {item.result.created_note_relative_path || 'No durable note created yet.'}
                                  </div>
                                </div>
                                <div style={{ ...card, padding: 12 }}>
                                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.22)', marginBottom: 4 }}>Role vs provider</div>
                                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.72)', lineHeight: 1.6 }}>
                                    Verdent is the AI-3 planning role. Claude / OpenAI are the model providers underneath that role.
                                  </div>
                                </div>
                              </div>

                              {item.result.chat_memory && (
                                <div style={{ ...card, padding: 12 }}>
                                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.22)', marginBottom: 6 }}>Chat memory</div>
                                  <div style={{ display: 'grid', gap: 4, fontSize: 13, color: 'rgba(255,255,255,.72)' }}>
                                    <div>Status: {item.result.chat_memory.status || 'unknown'}</div>
                                    <div>Thread: {item.result.chat_memory.thread_id || item.result.thread_id || activeThreadId}</div>
                                    {item.result.chat_memory.transcript_path && <div style={{ wordBreak: 'break-word' }}>Transcript: {item.result.chat_memory.transcript_path}</div>}
                                    {item.result.chat_memory.summary_path && <div style={{ wordBreak: 'break-word' }}>Summary: {item.result.chat_memory.summary_path}</div>}
                                  </div>
                                </div>
                              )}

                              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.84)', lineHeight: 1.7 }}>
                                <strong style={{ color: 'rgba(255,255,255,.92)' }}>Next step:</strong> {item.result.next_step}
                              </div>

                              {info.latestDownstream && (
                                <details>
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
                                  }}>{info.latestDownstream}</pre>
                                </details>
                              )}

                              {info.latestFollowOn && item.result.follow_on_workflow !== 'none' && (
                                <details>
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
                                  }}>{info.latestFollowOn}</pre>
                                </details>
                              )}
                            </div>
                          </details>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {isSubmitting && message.trim() && (
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{
                        maxWidth: 'min(720px, 92%)',
                        borderRadius: '22px 22px 8px 22px',
                        background: 'linear-gradient(180deg, rgba(143,164,255,.18), rgba(112,133,255,.11))',
                        color: 'rgba(255,255,255,.92)',
                        padding: '16px 18px',
                        boxShadow: '0 10px 30px rgba(0,0,0,.16)',
                      }}>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.46)', marginBottom: 8 }}>
                          You · now
                        </div>
                        <div style={{ fontSize: 14, lineHeight: 1.75 }}>{message}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <div style={{
                        maxWidth: 'min(520px, 96%)',
                        borderRadius: '22px 22px 22px 8px',
                        background: 'rgba(255,255,255,.04)',
                        border: '1px solid rgba(255,255,255,.06)',
                        padding: '16px 18px',
                        color: 'rgba(255,255,255,.72)',
                        fontSize: 14,
                      }}>
                        System is thinking and routing this through the right lane…
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={conversationEndRef} />
          </div>

          <form onSubmit={submitIntake} style={{ borderTop: '1px solid rgba(255,255,255,.06)', padding: '16px clamp(16px, 4vw, 40px)', background: 'linear-gradient(180deg, rgba(8,8,12,.72), rgba(8,8,12,.96))', position: 'sticky', bottom: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {kindPresets.map((preset) => {
                const active = intakeKind === preset.kind
                return (
                  <button
                    key={preset.kind}
                    type="button"
                    onClick={() => setIntakeKind(preset.kind)}
                    title={preset.helper}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 999,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      background: active ? 'rgba(130,150,220,.18)' : 'rgba(255,255,255,.06)',
                      color: active ? 'rgba(130,150,220,.95)' : 'rgba(255,255,255,.46)',
                    }}
                  >
                    {preset.label}
                  </button>
                )
              })}

              <div style={{ marginLeft: 'auto', minWidth: 130 }}>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  style={{ ...inputBase, height: 38, padding: '0 12px' }}
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                  <option value="critical">critical</option>
                </select>
              </div>
            </div>

            <div style={{ ...card, padding: 12, background: 'rgba(255,255,255,.025)' }}>
              <textarea
                ref={composerRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder="Ask about project status, think through an idea, or say clearly when you want to start work."
                style={{ ...inputBase, minHeight: 104, padding: '14px 16px', resize: 'vertical', lineHeight: 1.7, border: 'none', background: 'transparent' }}
              />

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
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
                      color: 'rgba(255,255,255,.48)',
                    }}
                  >
                    {advancedOpen ? 'Hide details' : 'Show details'}
                  </button>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>
                    Auto is best most of the time. Press `Enter` to send, `Shift + Enter` for a new line.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    minWidth: 160,
                    height: 42,
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
                  {submitLabel}
                </button>
              </div>

              <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.42)', lineHeight: 1.6 }}>
                  {composerModeHint}
                </div>
                {activeFocus?.title && (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.28)', lineHeight: 1.6 }}>
                    Current thread focus: {activeFocus.title}
                  </div>
                )}
              </div>
            </div>

            {advancedOpen && (
              <div className="owner-intake-advanced" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional title. If empty, the system derives one." style={{ ...inputBase, height: 42, padding: '0 14px' }} />
                <input value={relatedTaskId} onChange={(e) => setRelatedTaskId(e.target.value)} placeholder="Related task ID" style={{ ...inputBase, height: 42, padding: '0 14px' }} />
                <textarea value={productContextLinks} onChange={(e) => setProductContextLinks(e.target.value)} placeholder="Product/context links, one per line" style={{ ...inputBase, minHeight: 92, padding: 12, resize: 'vertical' }} />
                <textarea value={knownConstraints} onChange={(e) => setKnownConstraints(e.target.value)} placeholder="Constraints, one per line" style={{ ...inputBase, minHeight: 92, padding: 12, resize: 'vertical' }} />
                <textarea value={sourceUrls} onChange={(e) => setSourceUrls(e.target.value)} placeholder="Official source URLs, one per line" style={{ ...inputBase, minHeight: 92, padding: 12, resize: 'vertical' }} />
                <textarea value={questions} onChange={(e) => setQuestions(e.target.value)} placeholder="Research questions, one per line" style={{ ...inputBase, minHeight: 92, padding: 12, resize: 'vertical' }} />
                <textarea value={targetSources} onChange={(e) => setTargetSources(e.target.value)} placeholder="Target source types, one per line" style={{ ...inputBase, minHeight: 92, padding: 12, resize: 'vertical' }} />
                <textarea value={relatedLinks} onChange={(e) => setRelatedLinks(e.target.value)} placeholder="Related links, one per line" style={{ ...inputBase, minHeight: 92, padding: 12, resize: 'vertical' }} />
                <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Growth audience" style={{ ...inputBase, height: 42, padding: '0 14px' }} />
                <input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="Growth channels" style={{ ...inputBase, height: 42, padding: '0 14px' }} />
                <input value={approvedClaimsLink} onChange={(e) => setApprovedClaimsLink(e.target.value)} placeholder="Approved claims link" style={{ ...inputBase, height: 42, padding: '0 14px' }} />
                <input value={currentOfferLink} onChange={(e) => setCurrentOfferLink(e.target.value)} placeholder="Current offer link" style={{ ...inputBase, height: 42, padding: '0 14px' }} />
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
          </form>
        </section>
      </div>
      <style>{`
        @media (max-width: 720px) {
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
