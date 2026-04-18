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

interface AiTeamLane {
  id: string
  label: string
  role: string
  mode: 'external_execution' | 'live_workflow' | 'claude_advisory'
  copilotProvider: 'Claude' | 'OpenAI'
  executionProvider?: 'Claude' | 'Codex' | 'OpenAI'
}

interface ExecutionContract {
  status: string
  contract_note_relative_path: string
  contract_note_absolute_path: string
  read_from: string[]
  write_progress_to: string[]
  report_back_to: string[]
  quick_start_prompt: string
  starter_prompt: string
  execution_bridge?: {
    status: string
    bridge_note_relative_path: string
    bridge_note_absolute_path: string
    request_template: string
    last_response_excerpt: string
    reason: string
  } | null
  reason: string
}

interface VerdentExternalBridge {
  status: string
  bridge_note_relative_path: string
  bridge_note_absolute_path: string
  target_plan_relative_path: string
  target_plan_absolute_path: string
  verdent_prompt: string
  return_to_system_prompt: string
  read_from: string[]
  reason: string
}

interface ParallelExecutionBundle {
  status: string
  bundle_note_relative_path: string
  bundle_note_absolute_path: string
  lane_targets: string[]
  combined_quick_start_prompt: string
  launch_prompt: string
  return_to_system_prompt: string
  reason: string
}

interface ExecutionLaneInfo {
  targetAi: string
  sourceLabel: string
  quickStartPrompt: string
  starterPrompt: string
  codexPrompt: string
  claudePrompt: string
  returnToSystemPrompt: string
  executionContract: ExecutionContract | null
  executionBridge: ExecutionContract['execution_bridge']
  fileTargets: string[]
  changeSummary: string[]
  verificationSteps: string[]
}

interface ExecutionBridgeRunResult {
  agent: 'SYSTEM'
  workflow: 'execution_bridge'
  status: string
  project: string
  target_ai: string
  bridge_note_relative_path: string
  bridge_note_absolute_path: string
  request_text: string
  system_reply: string
  referenced_notes: string[]
  reason: string
  next_step: string
}

interface AIExecutionMeta {
  provider?: string
  model?: string
  input_tokens?: number
  output_tokens?: number
}

interface DailyReviewLaneRecommendation {
  ai: string
  status: string
  priority: string
  should_engage: boolean
  summary: string
  next_action: string
}

interface DailyProjectReviewResult {
  agent: 'SYSTEM'
  workflow: 'daily_project_review'
  status: string
  project: string
  review_date: string
  overall_summary: string
  top_blockers: string[]
  owner_actions: string[]
  lane_recommendations: DailyReviewLaneRecommendation[]
  referenced_notes: string[]
  review_note_relative_path: string
  review_note_absolute_path: string
  writeback: { status?: string; relative_path?: string; reason?: string } | null
  owner_notification: { status?: string; reason?: string } | null
  ai_meta: AIExecutionMeta | null
  reason: string
  next_step: string
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

const AI_TEAM_LANES: AiTeamLane[] = [
  { id: 'AI-1', label: 'AI-1 Backend', role: 'Backend + Docs + Infra', mode: 'external_execution', copilotProvider: 'Claude', executionProvider: 'Claude' },
  { id: 'AI-2', label: 'AI-2 Frontend', role: 'Frontend + UI', mode: 'external_execution', copilotProvider: 'Claude', executionProvider: 'Codex' },
  { id: 'AI-3', label: 'AI-3 Verdent', role: 'Planning + QA', mode: 'live_workflow', copilotProvider: 'Claude', executionProvider: 'Claude' },
  { id: 'AI-4', label: 'AI-4 Emergency', role: 'Incidents + quick fixes', mode: 'claude_advisory', copilotProvider: 'Claude' },
  { id: 'AI-5', label: 'AI-5 Research', role: 'External facts + source truth', mode: 'live_workflow', copilotProvider: 'Claude', executionProvider: 'Claude' },
  { id: 'AI-6', label: 'AI-6 Product', role: 'Product strategy', mode: 'claude_advisory', copilotProvider: 'Claude' },
  { id: 'AI-7', label: 'AI-7 Compliance', role: 'Requirements translation', mode: 'claude_advisory', copilotProvider: 'Claude' },
  { id: 'AI-8', label: 'AI-8 Growth', role: 'Growth strategy', mode: 'live_workflow', copilotProvider: 'Claude', executionProvider: 'Claude' },
  { id: 'AI-9', label: 'AI-9 Support', role: 'Support communication', mode: 'live_workflow', copilotProvider: 'Claude', executionProvider: 'Claude' },
  { id: 'AI-10', label: 'AI-10 Video', role: 'Video briefs', mode: 'live_workflow', copilotProvider: 'Claude', executionProvider: 'Claude' },
  { id: 'AI-11', label: 'AI-11 Creative', role: 'Creative variants', mode: 'live_workflow', copilotProvider: 'Claude', executionProvider: 'Claude' },
]

const WORKFLOW_LABELS: Record<string, string> = {
  Owner_Advisory: 'Owner Copilot',
  AI3_Planning_Intake: 'AI-3 Planning Intake (Verdent)',
  Verdent_External_Import: 'External Verdent Plan Import',
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

function preferredExecutionProviderForTarget(value: string) {
  const normalized = String(value || '').trim().toUpperCase()
  if (normalized === 'AI-1') return 'claude'
  if (normalized === 'AI-2') return 'codex'
  return 'claude'
}

function preferredExecutionProviderLabel(value: string) {
  const provider = preferredExecutionProviderForTarget(value)
  return provider === 'codex' ? 'Codex' : 'Claude'
}

function buildExecutionLaneInfoFromRecord(record: Record<string, unknown>, sourceLabel: string): ExecutionLaneInfo | null {
  const targetAi = typeof record?.target_ai === 'string' ? record.target_ai.trim() : ''
  const starterPrompt = typeof record?.starter_prompt === 'string'
    ? record.starter_prompt.trim()
    : typeof record?.ready_to_paste_prompt === 'string'
      ? record.ready_to_paste_prompt.trim()
      : ''
  const quickStartPrompt = typeof record?.quick_start_prompt === 'string'
    ? record.quick_start_prompt.trim()
    : ''
  const codexPrompt = typeof record?.codex_prompt === 'string' ? record.codex_prompt.trim() : starterPrompt
  const claudePrompt = typeof record?.claude_prompt === 'string' ? record.claude_prompt.trim() : starterPrompt
  const returnToSystemPrompt = typeof record?.return_to_system_prompt === 'string'
    ? record.return_to_system_prompt.trim()
    : ''
  const rawExecutionContract = asRecord(record?.execution_contract)
  const executionContract = rawExecutionContract
    ? {
        status: typeof rawExecutionContract.status === 'string' ? rawExecutionContract.status.trim() : '',
        contract_note_relative_path: typeof rawExecutionContract.contract_note_relative_path === 'string' ? rawExecutionContract.contract_note_relative_path.trim() : '',
        contract_note_absolute_path: typeof rawExecutionContract.contract_note_absolute_path === 'string' ? rawExecutionContract.contract_note_absolute_path.trim() : '',
        read_from: toStringList(rawExecutionContract.read_from),
        write_progress_to: toStringList(rawExecutionContract.write_progress_to),
        report_back_to: toStringList(rawExecutionContract.report_back_to),
        quick_start_prompt: typeof rawExecutionContract.quick_start_prompt === 'string' ? rawExecutionContract.quick_start_prompt.trim() : '',
        starter_prompt: typeof rawExecutionContract.starter_prompt === 'string' ? rawExecutionContract.starter_prompt.trim() : '',
        execution_bridge: asRecord(rawExecutionContract.execution_bridge)
          ? {
              status: typeof asRecord(rawExecutionContract.execution_bridge)?.status === 'string' ? String(asRecord(rawExecutionContract.execution_bridge)?.status).trim() : '',
              bridge_note_relative_path: typeof asRecord(rawExecutionContract.execution_bridge)?.bridge_note_relative_path === 'string' ? String(asRecord(rawExecutionContract.execution_bridge)?.bridge_note_relative_path).trim() : '',
              bridge_note_absolute_path: typeof asRecord(rawExecutionContract.execution_bridge)?.bridge_note_absolute_path === 'string' ? String(asRecord(rawExecutionContract.execution_bridge)?.bridge_note_absolute_path).trim() : '',
              request_template: typeof asRecord(rawExecutionContract.execution_bridge)?.request_template === 'string' ? String(asRecord(rawExecutionContract.execution_bridge)?.request_template).trim() : '',
              last_response_excerpt: typeof asRecord(rawExecutionContract.execution_bridge)?.last_response_excerpt === 'string' ? String(asRecord(rawExecutionContract.execution_bridge)?.last_response_excerpt).trim() : '',
              reason: typeof asRecord(rawExecutionContract.execution_bridge)?.reason === 'string' ? String(asRecord(rawExecutionContract.execution_bridge)?.reason).trim() : '',
            }
          : null,
        reason: typeof rawExecutionContract.reason === 'string' ? rawExecutionContract.reason.trim() : '',
      }
    : null

  if (!targetAi && !starterPrompt && !quickStartPrompt && !executionContract) return null

  return {
    targetAi,
    sourceLabel,
    quickStartPrompt: quickStartPrompt || executionContract?.quick_start_prompt || '',
    starterPrompt: starterPrompt || executionContract?.starter_prompt || '',
    codexPrompt,
    claudePrompt,
    returnToSystemPrompt,
    executionContract,
    executionBridge: executionContract?.execution_bridge || null,
    fileTargets: toStringList(record?.file_targets),
    changeSummary: toStringList(record?.change_summary),
    verificationSteps: toStringList(record?.verification_steps),
  }
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
  executionLanes: ExecutionLaneInfo[]
  executionContract: ExecutionContract | null
  parallelExecutionBundle: ParallelExecutionBundle | null
  verdentExternalBridge: VerdentExternalBridge | null
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
  const rawVerdentBridge = asRecord(downstreamRecord?.verdent_external_bridge)
  const verdentExternalBridge: VerdentExternalBridge | null = rawVerdentBridge
    ? {
        status: typeof rawVerdentBridge.status === 'string' ? rawVerdentBridge.status.trim() : '',
        bridge_note_relative_path: typeof rawVerdentBridge.bridge_note_relative_path === 'string' ? rawVerdentBridge.bridge_note_relative_path.trim() : '',
        bridge_note_absolute_path: typeof rawVerdentBridge.bridge_note_absolute_path === 'string' ? rawVerdentBridge.bridge_note_absolute_path.trim() : '',
        target_plan_relative_path: typeof rawVerdentBridge.target_plan_relative_path === 'string' ? rawVerdentBridge.target_plan_relative_path.trim() : '',
        target_plan_absolute_path: typeof rawVerdentBridge.target_plan_absolute_path === 'string' ? rawVerdentBridge.target_plan_absolute_path.trim() : '',
        verdent_prompt: typeof rawVerdentBridge.verdent_prompt === 'string' ? rawVerdentBridge.verdent_prompt.trim() : '',
        return_to_system_prompt: typeof rawVerdentBridge.return_to_system_prompt === 'string' ? rawVerdentBridge.return_to_system_prompt.trim() : '',
        read_from: toStringList(rawVerdentBridge.read_from),
        reason: typeof rawVerdentBridge.reason === 'string' ? rawVerdentBridge.reason.trim() : '',
      }
    : null
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
        quick_start_prompt: typeof rawExecutionContract.quick_start_prompt === 'string' ? rawExecutionContract.quick_start_prompt.trim() : '',
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
  const packetSourceLabel = followOnRecord
    ? workflowLabel(result?.follow_on_workflow || 'Implementation_Packet')
    : workflowLabel(result?.downstream_workflow || 'Implementation_Packet')
  const sourcePacketRecord = followOnRecord && (result?.follow_on_workflow === 'Implementation_Packet' || typeof followOnRecord?.target_ai === 'string' || Array.isArray((followOnRecord as Record<string, unknown>)?.parallel_packets))
    ? followOnRecord
    : downstreamRecord
  const rawParallelPackets = Array.isArray(sourcePacketRecord?.parallel_packets)
    ? sourcePacketRecord.parallel_packets.map((entry) => asRecord(entry)).filter(Boolean)
    : []
  const rawParallelBundle = asRecord(sourcePacketRecord?.parallel_bundle)
  const parallelExecutionBundle = rawParallelBundle
    ? {
        status: typeof rawParallelBundle.status === 'string' ? rawParallelBundle.status.trim() : '',
        bundle_note_relative_path: typeof rawParallelBundle.bundle_note_relative_path === 'string' ? rawParallelBundle.bundle_note_relative_path.trim() : '',
        bundle_note_absolute_path: typeof rawParallelBundle.bundle_note_absolute_path === 'string' ? rawParallelBundle.bundle_note_absolute_path.trim() : '',
        lane_targets: toStringList(rawParallelBundle.lane_targets),
        combined_quick_start_prompt: typeof rawParallelBundle.combined_quick_start_prompt === 'string' ? rawParallelBundle.combined_quick_start_prompt.trim() : '',
        launch_prompt: typeof rawParallelBundle.launch_prompt === 'string' ? rawParallelBundle.launch_prompt.trim() : '',
        return_to_system_prompt: typeof rawParallelBundle.return_to_system_prompt === 'string' ? rawParallelBundle.return_to_system_prompt.trim() : '',
        reason: typeof rawParallelBundle.reason === 'string' ? rawParallelBundle.reason.trim() : '',
      }
    : null
  const executionLanes = (rawParallelPackets.length
    ? rawParallelPackets
    : sourcePacketRecord && (typeof sourcePacketRecord?.target_ai === 'string' || typeof sourcePacketRecord?.starter_prompt === 'string' || typeof sourcePacketRecord?.ready_to_paste_prompt === 'string')
      ? [sourcePacketRecord]
      : []
  )
    .map((record) => buildExecutionLaneInfoFromRecord(record as Record<string, unknown>, packetSourceLabel))
    .filter((entry): entry is ExecutionLaneInfo => Boolean(entry))
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
      const detailedPlan = asRecord(downstreamRecord?.detailed_plan)
      const workstreams = toStringList(plan?.workstreams)
      const missingInputs = toStringList(plan?.missing_inputs)
      const acceptanceCriteria = toStringList(plan?.acceptance_criteria_seed)
      const recommendedSequence = toStringList(downstreamRecord?.recommended_sequence)
      const sourceStack = toStringList(detailedPlan?.canonical_source_of_truth_stack)
      const alreadyExists = toStringList(detailedPlan?.what_already_exists)
      const blockers = toStringList(detailedPlan?.blockers)
      const fileSurfaceMap = toStringList(detailedPlan?.file_surface_map)
      const risksAndVerification = toStringList(detailedPlan?.risks_and_verification)
      const requiredHandoffs = toStringList(detailedPlan?.required_ai_handoffs)
      const executionPhasesRaw = Array.isArray(detailedPlan?.execution_phases) ? detailedPlan.execution_phases : []
      const executionPhases = executionPhasesRaw.flatMap((entry, index) => {
        const phase = asRecord(entry)
        const title = typeof phase?.phase === 'string' && phase.phase.trim()
          ? phase.phase.trim()
          : `Phase ${index + 1}`
        const actions = toStringList(phase?.actions)
        return actions.length ? [`${title}: ${actions.join(' | ')}`] : [title]
      })
      const currentVerdict = typeof detailedPlan?.current_verdict === 'string' ? detailedPlan.current_verdict.trim() : ''

      return {
        header,
        body: currentVerdict
          || (typeof plan?.objective === 'string' && plan.objective.trim())
          || 'Claude created a detailed planning response for this task.',
        modeNote,
        sections: [
          { label: 'Canonical source stack', items: sourceStack },
          { label: 'What already exists', items: alreadyExists },
          { label: 'Workstreams', items: workstreams },
          { label: 'Blockers', items: blockers },
          { label: 'Missing inputs', items: missingInputs },
          { label: 'Acceptance criteria', items: acceptanceCriteria },
          { label: 'Execution phases', items: executionPhases },
          { label: 'File / surface map', items: fileSurfaceMap },
          { label: 'Risks and verification', items: risksAndVerification },
          { label: 'Required AI handoffs', items: requiredHandoffs },
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
      const parallelTargets = toStringList(downstreamRecord?.parallel_targets)
      const rawParallelBundle = asRecord(downstreamRecord?.parallel_bundle)
      const parallelBundlePath = typeof rawParallelBundle?.bundle_note_relative_path === 'string'
        ? rawParallelBundle.bundle_note_relative_path.trim()
        : ''

      return {
        header,
        body: typeof downstreamRecord?.objective === 'string' && downstreamRecord.objective.trim()
          ? downstreamRecord.objective.trim()
          : 'The system prepared an external coding packet for implementation.',
        modeNote,
        sections: [
          { label: 'Target lane', items: targetAi ? [targetAi] : [] },
          { label: 'Parallel lanes', items: parallelTargets.length > 1 ? parallelTargets : [] },
          { label: 'Parallel bundle', items: parallelBundlePath ? [parallelBundlePath] : [] },
          { label: 'Execution mode', items: executionMode ? [executionMode.replace(/_/g, ' ')] : ['external ai'] },
          { label: 'File targets', items: fileTargets.slice(0, 6) },
          { label: 'Required changes', items: changeSummary.slice(0, 6) },
          { label: 'Verification', items: verificationSteps.slice(0, 5) },
        ].filter((section) => section.items.length > 0),
      }
    }

    if (result.downstream_workflow === 'Verdent_External_Import') {
      const importedPath = typeof downstreamRecord?.imported_plan_target_relative_path === 'string'
        ? downstreamRecord.imported_plan_target_relative_path.trim()
        : ''

      return {
        header,
        body: importedPath
          ? `Imported the external Verdent full plan into ${importedPath}.`
          : 'Imported the external Verdent full plan into the canonical planning note.',
        modeNote,
        sections: [
          { label: 'Imported plan', items: importedPath ? [importedPath] : [] },
          { label: 'Next step', items: result.next_step ? [result.next_step] : [] },
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
    executionLanes,
    executionContract,
    parallelExecutionBundle,
    verdentExternalBridge,
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
  const [requestedRouteTarget, setRequestedRouteTarget] = useState('none')
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
  const [isRunningDailyReview, setIsRunningDailyReview] = useState(false)
  const [forkingExecutionKey, setForkingExecutionKey] = useState('')
  const [runningBridgeKey, setRunningBridgeKey] = useState('')
  const [bridgeReplies, setBridgeReplies] = useState<Record<string, ExecutionBridgeRunResult>>({})
  const [latestResult, setLatestResult] = useState<OwnerIntakeResult | null>(null)
  const [latestDailyReview, setLatestDailyReview] = useState<DailyProjectReviewResult | null>(null)
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
    let cancelled = false

    async function loadLatestDailyReview() {
      try {
        const response = await devFetch('/api/vurium-dev/ai/daily-review/latest') as DailyProjectReviewResult
        if (!cancelled) setLatestDailyReview(response)
      } catch {
        if (!cancelled) setLatestDailyReview(null)
      }
    }

    void loadLatestDailyReview()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!conversationEndRef.current) return
    conversationEndRef.current.scrollIntoView({ behavior: history.length > 0 ? 'smooth' : 'auto', block: 'end' })
  }, [history.length, latestResult?.intake_id, isSubmitting])

  async function refreshLatestDailyReview() {
    try {
      const response = await devFetch('/api/vurium-dev/ai/daily-review/latest') as DailyProjectReviewResult
      setLatestDailyReview(response)
      return response
    } catch (error) {
      setLatestDailyReview(null)
      throw error
    }
  }

  async function runDailyReviewNow() {
    setIsRunningDailyReview(true)
    try {
      const response = await devFetch('/api/vurium-dev/ai/daily-review', {
        method: 'POST',
        body: JSON.stringify({
          meta: {
            workflow_name: 'Daily_Project_Review_UI',
            timestamp: new Date().toISOString(),
            trigger_source: 'developer_owner_intake_daily_review',
            risk_level: 'low',
          },
          context: {
            owner_conversation_history: buildConversationContext(history),
            active_focus: deriveActiveFocus(history),
          },
          payload: {
            project: 'VuriumBook',
            triggered_by: 'manual_owner',
            force: true,
          },
        }),
      }) as DailyProjectReviewResult
      setLatestDailyReview(response)
      toast.show('Daily AI review updated.')
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Could not run the daily review.', 'error')
    } finally {
      setIsRunningDailyReview(false)
    }
  }

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
            requested_route_target: requestedRouteTarget,
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

  async function forkExecutionThread(item: IntakeHistoryItem, lane: ExecutionLaneInfo, options?: { silent?: boolean; key?: string }) {
    if (!lane.starterPrompt && !lane.codexPrompt) {
      if (!options?.silent) {
        toast.show('There is no coding prompt to open yet.', 'error')
      }
      return
    }

    const targetAi = lane.targetAi || 'AI-1'
    const followOnBundle = asRecord(item.result.follow_on_result)?.parallel_bundle
    const downstreamBundle = asRecord(item.result.downstream_result)?.parallel_bundle
    const bundleRecord = asRecord(followOnBundle) || asRecord(downstreamBundle)
    const bundlePath = typeof bundleRecord?.bundle_note_relative_path === 'string'
      ? bundleRecord.bundle_note_relative_path.trim()
      : ''
    const payload = {
      source_thread_id: item.result.thread_id || activeThreadId,
      title: `${routeTargetLabel(targetAi)} · ${item.result.title || item.message}`,
      target_ai: targetAi,
      coding_prompt: lane.quickStartPrompt || lane.starterPrompt || lane.codexPrompt,
      source_workflow: item.result.follow_on_workflow !== 'none'
        ? item.result.follow_on_workflow
        : item.result.downstream_workflow,
      source_note_paths: dedupeStrings([
        bundlePath,
        lane.executionContract?.contract_note_relative_path,
        lane.executionBridge?.bridge_note_relative_path,
        item.result.created_note_relative_path,
        item.result.downstream_reference,
        item.result.follow_on_reference,
        item.result.chat_memory?.summary_path,
      ]),
      file_targets: lane.fileTargets,
      change_summary: lane.changeSummary,
      verification_steps: lane.verificationSteps,
    }

    setForkingExecutionKey(options?.key || `${item.id}:${targetAi}`)
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
      if (!options?.silent) {
        toast.show(`Opened ${routeTargetLabel(targetAi)} execution memory thread.`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not open execution thread'
      if (!options?.silent) {
        toast.show(message, 'error')
      }
      throw error
    } finally {
      if ((options?.key || `${item.id}:${targetAi}`) !== `${item.id}:all`) {
        setForkingExecutionKey('')
      }
    }
  }

  async function openParallelExecutionThreads(item: IntakeHistoryItem, lanes: ExecutionLaneInfo[]) {
    const runnableLanes = lanes.filter((lane) => lane.starterPrompt || lane.codexPrompt || lane.claudePrompt)
    if (!runnableLanes.length) {
      toast.show('There are no execution lanes ready to open yet.', 'error')
      return
    }

    setForkingExecutionKey(`${item.id}:all`)
    try {
      for (const lane of runnableLanes) {
        await forkExecutionThread(item, lane, { silent: true, key: `${item.id}:${lane.targetAi}` })
      }
      toast.show(`Opened ${runnableLanes.length} execution memory threads.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not open all execution threads'
      toast.show(message, 'error')
    } finally {
      setForkingExecutionKey('')
    }
  }

  async function runExecutionBridge(lane: ExecutionLaneInfo, item: IntakeHistoryItem) {
    const bridge = lane.executionBridge
    if (!bridge?.bridge_note_relative_path) {
      toast.show('This lane does not have a system bridge note yet.', 'error')
      return
    }

    const bridgeKey = `${item.id}:${lane.targetAi}:bridge`
    setRunningBridgeKey(bridgeKey)
    try {
      const response = await devFetch('/api/vurium-dev/ai/execution-bridge/run', {
        method: 'POST',
        body: JSON.stringify({
          payload: {
            project: 'VuriumBook',
            target_ai: lane.targetAi,
            bridge_note_relative_path: bridge.bridge_note_relative_path,
          },
        }),
      }) as ExecutionBridgeRunResult
      setBridgeReplies((prev) => ({
        ...prev,
        [bridge.bridge_note_relative_path]: response,
      }))
      toast.show(`System replied for ${routeTargetLabel(lane.targetAi)}.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not run the execution bridge'
      toast.show(message, 'error')
    } finally {
      setRunningBridgeKey('')
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
  const selectedLane = AI_TEAM_LANES.find((lane) => lane.id === requestedRouteTarget) || null
  const composerModeHint = intakeKind === 'auto'
    ? selectedLane
      ? `Auto mode with ${selectedLane.label} focus: the system stays conversational first, but answers from that lane's perspective whenever it can.`
      : 'Auto mode: follow-up questions stay conversational. Explicit start / plan / fix requests will open execution lanes.'
    : intakeKind === 'advisory'
      ? selectedLane
        ? `Discuss mode with ${selectedLane.label} focus: Claude will respond as that lane unless you later tell the system to start execution.`
        : 'Discuss mode: the system will answer first and avoid opening tasks unless you later tell it to start.'
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
              Broad questions stay conversational first. Explicit start/build/plan requests open execution lanes automatically. All 11 AI lanes can already answer here through Claude-backed copilot memory while OpenAI is still offline.
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

        <section style={{ ...card, padding: 16, display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ display: 'grid', gap: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.82)' }}>
                Daily AI Review
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.42)', lineHeight: 1.6, maxWidth: 760 }}>
                One shared daily scan of the project brain, current state, checklists, topic brains, and recent threads. This becomes the freshest project snapshot that advisory, planning, and execution lanes can read first.
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                type="button"
                onClick={() => { void refreshLatestDailyReview().then(() => toast.show('Daily AI review refreshed.')).catch((error) => toast.show(error instanceof Error ? error.message : 'Could not refresh daily review.', 'error')) }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 999,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: 'inherit',
                  background: 'rgba(255,255,255,.08)',
                  color: 'rgba(255,255,255,.74)',
                }}
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => { void runDailyReviewNow() }}
                disabled={isRunningDailyReview}
                style={{
                  padding: '8px 12px',
                  borderRadius: 999,
                  border: 'none',
                  cursor: isRunningDailyReview ? 'progress' : 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: 'inherit',
                  background: 'rgba(130,220,170,.18)',
                  color: 'rgba(130,220,170,.96)',
                  opacity: isRunningDailyReview ? 0.7 : 1,
                }}
              >
                {isRunningDailyReview ? 'Running scan…' : 'Run daily scan now'}
              </button>
            </div>
          </div>

          {latestDailyReview ? (
            <div style={{
              padding: 14,
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,.06)',
              background: 'rgba(255,255,255,.03)',
              display: 'grid',
              gap: 12,
            }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <span style={runtimeBadgeStyle(latestDailyReview.status === 'done' ? 'working' : latestDailyReview.status === 'partial' ? 'fallback' : 'blocked')}>
                  {latestDailyReview.status === 'done' ? 'fresh daily scan' : latestDailyReview.status}
                </span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,.42)' }}>
                  {latestDailyReview.review_date || 'today'}
                </span>
                {latestDailyReview.review_note_relative_path && (
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,.28)', wordBreak: 'break-word' }}>
                    {latestDailyReview.review_note_relative_path}
                  </span>
                )}
              </div>

              <div style={{ fontSize: 14, color: 'rgba(255,255,255,.86)', lineHeight: 1.75 }}>
                {latestDailyReview.overall_summary || latestDailyReview.reason}
              </div>

              {latestDailyReview.top_blockers.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.24)', marginBottom: 6 }}>
                    Top blockers
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, color: 'rgba(255,255,255,.72)', fontSize: 12, lineHeight: 1.7 }}>
                    {latestDailyReview.top_blockers.slice(0, 4).map((entry) => (
                      <li key={entry}>{entry}</li>
                    ))}
                  </ul>
                </div>
              )}

              {latestDailyReview.lane_recommendations.length > 0 && (
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.24)' }}>
                    AI lanes to watch today
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {latestDailyReview.lane_recommendations
                      .filter((entry) => entry.should_engage || entry.status === 'active' || entry.status === 'blocked')
                      .slice(0, 6)
                      .map((entry) => (
                        <span key={entry.ai} style={runtimeBadgeStyle(entry.status === 'active' ? 'working' : entry.status === 'blocked' ? 'blocked' : 'fallback')}>
                          {entry.ai} · {entry.priority}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{
              padding: 14,
              borderRadius: 16,
              border: '1px dashed rgba(255,255,255,.08)',
              background: 'rgba(255,255,255,.02)',
              color: 'rgba(255,255,255,.42)',
              fontSize: 12,
              lineHeight: 1.7,
            }}>
              No daily review exists yet. Run the first scan and the system will save one shared project snapshot into the local workspace brain.
            </div>
          )}
        </section>

        <section style={{ ...card, padding: 16, display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.82)' }}>
              AI Team
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.42)', lineHeight: 1.6 }}>
              All 11 AI lanes are available here now. Until OpenAI is connected, every lane answers through Claude inside Owner Copilot. Separate execution providers only matter later when you open coding work.
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              onClick={() => setRequestedRouteTarget('none')}
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'inherit',
                background: requestedRouteTarget === 'none' ? 'rgba(130,150,220,.18)' : 'rgba(255,255,255,.06)',
                color: requestedRouteTarget === 'none' ? 'rgba(130,150,220,.96)' : 'rgba(255,255,255,.6)',
              }}
            >
              No lane focus
            </button>
            {AI_TEAM_LANES.map((lane) => (
              <button
                key={lane.id}
                type="button"
                onClick={() => setRequestedRouteTarget((current) => current === lane.id ? 'none' : lane.id)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 999,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: 'inherit',
                  background: requestedRouteTarget === lane.id ? 'rgba(130,220,170,.18)' : 'rgba(255,255,255,.06)',
                  color: requestedRouteTarget === lane.id ? 'rgba(130,220,170,.96)' : 'rgba(255,255,255,.62)',
                }}
                title={`${lane.role} · ${lane.mode === 'live_workflow' ? 'Live workflow' : lane.mode === 'external_execution' ? 'Execution lane' : 'Claude advisory'} · Copilot: ${lane.copilotProvider}${lane.executionProvider ? ` · Execution: ${lane.executionProvider}` : ''}`}
              >
                {lane.id}
              </button>
            ))}
          </div>
          {selectedLane && (
            <div style={{
              padding: 12,
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,.06)',
              background: 'rgba(255,255,255,.03)',
              display: 'grid',
              gap: 4,
            }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'rgba(255,255,255,.86)' }}>
                {selectedLane.label}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.58)', lineHeight: 1.6 }}>
                {selectedLane.role}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.42)', lineHeight: 1.6 }}>
                {selectedLane.mode === 'live_workflow'
                  ? `Runs here now through a Claude-backed workflow.`
                  : selectedLane.mode === 'external_execution'
                    ? `Claude answers as this lane here in Copilot. If you later open implementation work, execution will hand off to ${selectedLane.executionProvider || 'the configured executor'}.`
                    : `Claude answers as this lane here until a dedicated workflow is connected.`}
              </div>
            </div>
          )}
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
                  const planningTaskNotePath = item.result.downstream_workflow === 'AI3_Planning_Intake'
                    ? (item.result.created_note_relative_path || '').trim()
                    : ''
                  const planningNotePath = item.result.downstream_workflow === 'AI3_Planning_Intake'
                    ? ((item.result.downstream_reference || '').trim()
                      || (planningTaskNotePath ? planningTaskNotePath.replace(/\.md$/, '-Plan.md') : ''))
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

                          {item.result.downstream_workflow === 'AI3_Planning_Intake' && (planningTaskNotePath || planningNotePath) && (
                            <div style={{
                              ...card,
                              marginTop: 14,
                              padding: 14,
                              background: 'rgba(130,220,170,.06)',
                              borderColor: 'rgba(130,220,170,.14)',
                            }}>
                              <div style={{ display: 'grid', gap: 10 }}>
                                <div style={{ display: 'grid', gap: 4 }}>
                                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(130,220,170,.86)' }}>
                                    Claude detailed plan
                                  </div>
                                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.8)', lineHeight: 1.65 }}>
                                    Claude already created the canonical planning note for this thread. You should not need to go hunting through execution details to find the real plan.
                                  </div>
                                </div>

                                {planningTaskNotePath && (
                                  <div style={{ display: 'grid', gap: 6 }}>
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                                      Task note
                                    </div>
                                    <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.74)', wordBreak: 'break-word' }}>
                                      {planningTaskNotePath}
                                    </div>
                                    <div>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            await navigator.clipboard.writeText(planningTaskNotePath)
                                            toast.show('Copied task note path.')
                                          } catch {
                                            toast.show('Could not copy the task note path.', 'error')
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
                                          color: 'rgba(255,255,255,.92)',
                                        }}
                                      >
                                        Copy task path
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {planningNotePath && (
                                  <div style={{ display: 'grid', gap: 6 }}>
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                                      Planning note
                                    </div>
                                    <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.88)', wordBreak: 'break-word' }}>
                                      {planningNotePath}
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            await navigator.clipboard.writeText(planningNotePath)
                                            toast.show('Copied detailed plan path.')
                                          } catch {
                                            toast.show('Could not copy the detailed plan path.', 'error')
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
                                        Copy plan path
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setMessage(`Open this Claude planning note and continue from it: ${planningNotePath}`)
                                          toast.show('Loaded the detailed plan path into the composer.')
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
                                          color: 'rgba(255,255,255,.92)',
                                        }}
                                      >
                                        Use this plan
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {item.result.downstream_workflow === 'AI3_Planning_Intake' && info.verdentExternalBridge?.verdent_prompt && (
                            <div style={{
                              ...card,
                              marginTop: 14,
                              padding: 14,
                              background: 'rgba(173,140,255,.07)',
                              borderColor: 'rgba(173,140,255,.16)',
                            }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'grid', gap: 4 }}>
                                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(188,166,255,.92)' }}>
                                    Optional External Verdent Plan
                                  </div>
                                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.78)', lineHeight: 1.6 }}>
                                    Claude already produced the canonical planning note. Use external Verdent only if you want a second-opinion plan, then paste it back here and the system will import it over the same canonical note.
                                  </div>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        await navigator.clipboard.writeText(info.verdentExternalBridge?.verdent_prompt || '')
                                        toast.show('Copied prompt for external Verdent.')
                                      } catch {
                                        toast.show('Could not copy the Verdent prompt.', 'error')
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
                                      background: 'rgba(173,140,255,.2)',
                                      color: 'rgba(231,224,255,.98)',
                                    }}
                                  >
                                    Copy for Verdent
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        await navigator.clipboard.writeText(info.verdentExternalBridge?.return_to_system_prompt || '')
                                        toast.show('Copied the Verdent import format.')
                                      } catch {
                                        toast.show('Could not copy the Verdent import format.', 'error')
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
                                      color: 'rgba(255,255,255,.92)',
                                    }}
                                  >
                                    Copy import prompt
                                  </button>
                                </div>
                              </div>

                              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                                <div>
                                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                                    Canonical target
                                  </div>
                                  <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.88)', wordBreak: 'break-word' }}>
                                    {info.verdentExternalBridge.target_plan_relative_path}
                                  </div>
                                  {info.verdentExternalBridge.target_plan_absolute_path && (
                                    <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.46)', wordBreak: 'break-word', marginTop: 4 }}>
                                      {info.verdentExternalBridge.target_plan_absolute_path}
                                    </div>
                                  )}
                                </div>

                                {info.verdentExternalBridge.bridge_note_relative_path && (
                                  <div>
                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                                      Bridge note
                                    </div>
                                    <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.74)', wordBreak: 'break-word' }}>
                                      {info.verdentExternalBridge.bridge_note_relative_path}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <details style={{ marginTop: 12 }}>
                                <summary style={{ cursor: 'pointer', fontSize: 12, color: 'rgba(188,166,255,.92)' }}>
                                  Preview Verdent prompt
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
                                }}>{info.verdentExternalBridge.verdent_prompt}</pre>
                              </details>
                            </div>
                          )}

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

                          {info.executionLanes.length > 0 && (
                            <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
                              {info.parallelExecutionBundle && info.executionLanes.length > 1 && (
                                <div style={{
                                  ...card,
                                  padding: 14,
                                  background: 'rgba(255,205,120,.08)',
                                  borderColor: 'rgba(255,205,120,.18)',
                                }}>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'grid', gap: 4 }}>
                                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,205,120,.9)' }}>
                                        Parallel Execution Bundle
                                      </div>
                                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,.82)', lineHeight: 1.6 }}>
                                        {`Run ${info.parallelExecutionBundle.lane_targets.join(' + ')} at the same time. The shared bundle note keeps the launch order and unified return flow in one place.`}
                                      </div>
                                      {info.parallelExecutionBundle.combined_quick_start_prompt && (
                                        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.72)', lineHeight: 1.7 }}>
                                          1. Send the AI-1 quick start to Claude. 2. Send the AI-2 quick start to Codex. 3. Paste one combined return back into Owner Copilot.
                                        </div>
                                      )}
                                      {info.parallelExecutionBundle.bundle_note_absolute_path && (
                                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.52)', wordBreak: 'break-word' }}>
                                          {info.parallelExecutionBundle.bundle_note_absolute_path}
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          await navigator.clipboard.writeText(info.parallelExecutionBundle?.combined_quick_start_prompt || '')
                                          toast.show('Copied both quick starts.')
                                        } catch {
                                          toast.show('Could not copy both quick starts.', 'error')
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
                                        background: 'rgba(255,205,120,.18)',
                                        color: 'rgba(255,205,120,.98)',
                                      }}
                                    >
                                      Copy both quick starts
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          await navigator.clipboard.writeText(info.parallelExecutionBundle?.launch_prompt || '')
                                          toast.show('Copied parallel launch bundle.')
                                        } catch {
                                          toast.show('Could not copy the launch bundle.', 'error')
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
                                        background: 'rgba(255,205,120,.18)',
                                        color: 'rgba(255,205,120,.98)',
                                      }}
                                    >
                                      Copy launch bundle
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          await navigator.clipboard.writeText(info.parallelExecutionBundle?.return_to_system_prompt || '')
                                          toast.show('Copied combined return prompt.')
                                        } catch {
                                          toast.show('Could not copy the combined return prompt.', 'error')
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
                                      Copy combined return prompt
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { void openParallelExecutionThreads(item, info.executionLanes) }}
                                      disabled={forkingExecutionKey === `${item.id}:all`}
                                      style={{
                                        padding: '8px 12px',
                                        borderRadius: 999,
                                        border: 'none',
                                        cursor: forkingExecutionKey === `${item.id}:all` ? 'wait' : 'pointer',
                                        fontSize: 12,
                                        fontWeight: 700,
                                        fontFamily: 'inherit',
                                        background: 'rgba(255,255,255,.08)',
                                        color: 'rgba(255,255,255,.9)',
                                        opacity: forkingExecutionKey === `${item.id}:all` ? 0.72 : 1,
                                      }}
                                    >
                                      {forkingExecutionKey === `${item.id}:all` ? 'Opening…' : 'Open all execution memories'}
                                    </button>
                                  </div>

                                  <details style={{ marginTop: 12 }}>
                                    <summary style={{ cursor: 'pointer', fontSize: 12, color: 'rgba(255,205,120,.92)' }}>
                                      Preview parallel launch instructions
                                    </summary>
                                    {info.parallelExecutionBundle.combined_quick_start_prompt && (
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
                                      }}>{info.parallelExecutionBundle.combined_quick_start_prompt}</pre>
                                    )}
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
                                    }}>{info.parallelExecutionBundle.launch_prompt}</pre>
                                  </details>
                                </div>
                              )}

                              {info.executionLanes.map((lane) => {
                                const preferredProvider = preferredExecutionProviderForTarget(lane.targetAi)
                                const quickStartPrompt = lane.quickStartPrompt || (preferredProvider === 'codex'
                                  ? (lane.codexPrompt || lane.starterPrompt)
                                  : (lane.claudePrompt || lane.starterPrompt))
                                const primaryPrompt = preferredProvider === 'codex'
                                  ? (lane.codexPrompt || lane.starterPrompt)
                                  : (lane.claudePrompt || lane.starterPrompt)
                                const alternatePrompt = preferredProvider === 'codex'
                                  ? (lane.claudePrompt || lane.starterPrompt)
                                  : (lane.codexPrompt || lane.starterPrompt)
                                const laneExecutionKey = `${item.id}:${lane.targetAi}`
                                const laneBusy = forkingExecutionKey === laneExecutionKey || forkingExecutionKey === `${item.id}:all`
                                const bridge = lane.executionBridge
                                const bridgeBusy = runningBridgeKey === `${item.id}:${lane.targetAi}:bridge`
                                const bridgeReply = bridge?.bridge_note_relative_path
                                  ? bridgeReplies[bridge.bridge_note_relative_path]
                                  : null

                                return (
                                  <div key={`${item.id}-${lane.targetAi}`} style={{
                                    ...card,
                                    padding: 14,
                                    background: 'rgba(130,220,170,.07)',
                                    borderColor: 'rgba(130,220,170,.16)',
                                  }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
                                      <div style={{ display: 'grid', gap: 4 }}>
                                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(130,220,170,.86)' }}>
                                          {`Execution Contract · ${routeTargetLabel(lane.targetAi)}`}
                                        </div>
                                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.78)', lineHeight: 1.6 }}>
                                          {`Preferred executor: ${preferredExecutionProviderLabel(lane.targetAi)}. Source: ${lane.sourceLabel}.`}
                                        </div>
                                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.48)', lineHeight: 1.6 }}>
                                          {`${routeTargetLabel(lane.targetAi)} already gets an AI dependency protocol. If it needs AI-3/4/5/6/7/8/9/10/11, it should write the exact lane and reason into memory instead of making you decide manually.`}
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            await navigator.clipboard.writeText(quickStartPrompt)
                                            toast.show(`Copied ${routeTargetLabel(lane.targetAi)} quick start.`)
                                          } catch {
                                            toast.show('Could not copy the quick start prompt.', 'error')
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
                                        {`Copy quick start for ${preferredExecutionProviderLabel(lane.targetAi)}`}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            await navigator.clipboard.writeText(alternatePrompt)
                                            toast.show(`Copied ${preferredProvider === 'codex' ? 'Claude' : 'Codex'} alternate prompt.`)
                                          } catch {
                                            toast.show('Could not copy the alternate prompt.', 'error')
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
                                        {`Copy ${preferredProvider === 'codex' ? 'Claude' : 'Codex'} variant`}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            await navigator.clipboard.writeText(lane.returnToSystemPrompt || 'Paste the implementation result back into Owner Copilot with changed files, checks run, blockers, and next step.')
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
                                        onClick={() => { void forkExecutionThread(item, lane) }}
                                        disabled={laneBusy}
                                        style={{
                                          padding: '8px 12px',
                                          borderRadius: 999,
                                          border: 'none',
                                          cursor: laneBusy ? 'wait' : 'pointer',
                                          fontSize: 12,
                                          fontWeight: 700,
                                          fontFamily: 'inherit',
                                          background: 'rgba(255,255,255,.08)',
                                          color: 'rgba(255,255,255,.9)',
                                          opacity: laneBusy ? 0.72 : 1,
                                        }}
                                      >
                                        {laneBusy ? 'Opening…' : 'Open execution memory'}
                                      </button>
                                    </div>

                                    {lane.executionContract && (
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
                                              {lane.executionContract.read_from.map((entry) => (
                                                <li key={entry} style={{ wordBreak: 'break-word' }}>{entry}</li>
                                              ))}
                                            </ul>
                                          </div>
                                          <div>
                                            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(130,220,170,.72)', marginBottom: 6 }}>
                                              Write progress to
                                            </div>
                                            <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6, color: 'rgba(255,255,255,.78)', fontSize: 12.5, lineHeight: 1.6 }}>
                                              {lane.executionContract.write_progress_to.map((entry) => (
                                                <li key={entry} style={{ wordBreak: 'break-word' }}>{entry}</li>
                                              ))}
                                            </ul>
                                          </div>
                                          <div>
                                            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(130,220,170,.72)', marginBottom: 6 }}>
                                              Report back to
                                            </div>
                                            <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6, color: 'rgba(255,255,255,.78)', fontSize: 12.5, lineHeight: 1.6 }}>
                                              {lane.executionContract.report_back_to.map((entry) => (
                                                <li key={entry} style={{ wordBreak: 'break-word' }}>{entry}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {bridge && (
                                      <div style={{
                                        marginTop: 12,
                                        padding: 12,
                                        borderRadius: 12,
                                        background: 'rgba(120,170,255,.08)',
                                        border: '1px solid rgba(120,170,255,.16)',
                                        display: 'grid',
                                        gap: 10,
                                      }}>
                                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(120,170,255,.92)' }}>
                                          System bridge librarian
                                        </div>
                                        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.76)', lineHeight: 1.65 }}>
                                          {`If ${routeTargetLabel(lane.targetAi)} gets blocked or needs the system to answer a direct question, find where something lives, or confirm the canonical note or file, it can write an EXECUTION_BRIDGE_REQUEST into this note and the system librarian will answer back into the same note.`}
                                        </div>
                                        {bridge.bridge_note_absolute_path && (
                                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.54)', wordBreak: 'break-word' }}>
                                            {bridge.bridge_note_absolute_path}
                                          </div>
                                        )}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              try {
                                                await navigator.clipboard.writeText(bridge.request_template || '')
                                                toast.show('Copied execution bridge request template.')
                                              } catch {
                                                toast.show('Could not copy the bridge request template.', 'error')
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
                                            Copy bridge request template
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => { void runExecutionBridge(lane, item) }}
                                            disabled={bridgeBusy}
                                            style={{
                                              padding: '8px 12px',
                                              borderRadius: 999,
                                              border: 'none',
                                              cursor: bridgeBusy ? 'wait' : 'pointer',
                                              fontSize: 12,
                                              fontWeight: 700,
                                              fontFamily: 'inherit',
                                              background: 'rgba(255,255,255,.08)',
                                              color: 'rgba(255,255,255,.9)',
                                              opacity: bridgeBusy ? 0.72 : 1,
                                            }}
                                          >
                                            {bridgeBusy ? 'Answering…' : 'Run system reply'}
                                          </button>
                                        </div>
                                        {bridgeReply?.system_reply && (
                                          <div style={{
                                            padding: 12,
                                            borderRadius: 12,
                                            background: 'rgba(255,255,255,.04)',
                                            border: '1px solid rgba(255,255,255,.06)',
                                            display: 'grid',
                                            gap: 8,
                                          }}>
                                            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(120,170,255,.92)' }}>
                                              Latest bridge reply
                                            </div>
                                            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.82)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                                              {bridgeReply.system_reply}
                                            </div>
                                            {bridgeReply.next_step && (
                                              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.62)', lineHeight: 1.6 }}>
                                                {`Next step: ${bridgeReply.next_step}`}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                      <details style={{ marginTop: 12 }}>
                                        <summary style={{ cursor: 'pointer', fontSize: 12, color: 'rgba(130,220,170,.92)' }}>
                                          Preview contract + provider variants
                                        </summary>
                                      <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                                        <div>
                                          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(130,220,170,.72)', marginBottom: 6 }}>
                                            Quick start
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
                                          }}>{quickStartPrompt}</pre>
                                        </div>
                                        <div>
                                          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(130,220,170,.72)', marginBottom: 6 }}>
                                            {`Preferred starter (${preferredExecutionProviderLabel(lane.targetAi)})`}
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
                                          }}>{primaryPrompt}</pre>
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
                                          }}>{lane.codexPrompt || lane.starterPrompt}</pre>
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
                                          }}>{lane.claudePrompt || lane.starterPrompt}</pre>
                                        </div>
                                        {lane.returnToSystemPrompt && (
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
                                            }}>{lane.returnToSystemPrompt}</pre>
                                          </div>
                                        )}
                                      </div>
                                    </details>
                                  </div>
                                )
                              })}
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
