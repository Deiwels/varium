// ─── Platform / Overview ──────────────────────────────────────────────────────

export interface Workspace {
  id: string
  name: string
  slug: string
  plan: 'individual' | 'salon' | 'custom' | string
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'inactive' | string
  bookings: number
  clients: number
  staff: number
  sms_number: string | null
  sms_status: string
  created_at: string | null
}

export interface PlatformData {
  total_workspaces: number
  paid_count: number
  trial_count: number
  trial_conversion_rate: number
  signups_7d: number
  signups_30d: number
  signups_by_day: Record<string, number>
  by_plan: Record<string, number>
  by_status: Record<string, number>
  workspaces: Workspace[]
  // Revenue (optional — added by AI-2 backend work)
  mrr?: number
  arr?: number
  churn_30d?: number
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface AnalyticsData {
  total_pageviews: number
  unique_visitors: number
  unique_sessions: number
  by_day: Record<string, number>
  top_pages: Array<{ url: string; count: number }>
  top_referrers: Array<{ source: string; count: number }>
  devices: Record<string, number>
  funnel: {
    landing: number
    signup: number
    completed: number
  }
  // Optional extended fields
  bounce_rate?: number
  avg_session_duration?: number
  by_country?: Array<{ country: string; count: number }>
}

// ─── AI Diagnostics ───────────────────────────────────────────────────────────

export type Severity = 'critical' | 'warning' | 'info'
export type SeverityFilter = 'all' | Severity

export type IssueCategory =
  | 'bug' | 'improvement' | 'new_feature' | 'user_behavior'
  | 'growth' | 'security' | 'performance' | 'errors'
  | 'data_integrity' | 'user_experience'

export interface Issue {
  severity: Severity
  category: IssueCategory | string
  title: string
  description: string
  recommendation: string
}

export interface Scan {
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

// ─── Email ────────────────────────────────────────────────────────────────────

export interface GmailMessage {
  id: string
  threadId: string
  snippet: string
  from: string
  to: string
  subject: string
  date: string
  labelIds: string[]
  isUnread: boolean
}

export interface GmailMessageFull extends GmailMessage {
  messageId: string
  body_html: string
  body_text: string
}

export interface SentEmail {
  id: string
  direction: string
  from: string
  to: string
  subject: string
  body_html: string
  body_text: string
  status: string
  read: boolean
  created_at: string
}

// ─── Chart helpers ────────────────────────────────────────────────────────────

export interface ChartPoint {
  label: string
  value: number
}
