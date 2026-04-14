import type { Issue } from '../_types'

const SEV_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'rgba(220,100,100,.1)',  text: 'rgba(220,100,100,.7)' },
  warning:  { bg: 'rgba(220,170,100,.1)',  text: 'rgba(220,170,100,.8)' },
  info:     { bg: 'rgba(130,150,220,.1)',  text: 'rgba(130,150,220,.8)' },
}

const CAT_LABELS: Record<string, string> = {
  bug: 'Bug', improvement: 'Improve', new_feature: 'Feature',
  user_behavior: 'Behavior', growth: 'Growth', security: 'Security',
  performance: 'Perf', errors: 'Errors', data_integrity: 'Data',
  user_experience: 'UX',
}

const card: React.CSSProperties = {
  borderRadius: 16, border: '1px solid rgba(255,255,255,.06)',
  background: 'rgba(255,255,255,.03)',
}

interface IssueCardProps {
  issue: Issue
  compact?: boolean
}

export function IssueCard({ issue, compact }: IssueCardProps) {
  const c = SEV_COLORS[issue.severity] || SEV_COLORS.info
  return (
    <div style={{
      ...card,
      padding: compact ? '12px 16px' : '16px 20px',
      borderLeft: `3px solid ${c.text}`,
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase', background: c.bg, color: c.text }}>
          {issue.severity}
        </span>
        <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.3)' }}>
          {CAT_LABELS[issue.category] || issue.category}
        </span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,.7)', marginBottom: 4 }}>{issue.title}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', lineHeight: 1.5, marginBottom: 8 }}>{issue.description}</div>
      <div style={{ fontSize: 12, color: 'rgba(130,150,220,.6)', lineHeight: 1.5 }}>
        <span style={{ fontWeight: 600, marginRight: 4 }}>Recommendation:</span>
        {issue.recommendation}
      </div>
    </div>
  )
}
