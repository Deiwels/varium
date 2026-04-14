interface StatCardProps {
  label: string
  value: React.ReactNode
  sub?: string
  color?: string
  delta?: { value: number; pct: number } | null
}

export function StatCard({ label, value, sub, color = 'rgba(255,255,255,.7)', delta }: StatCardProps) {
  const deltaPositive = delta && delta.value >= 0
  return (
    <div style={{
      borderRadius: 16,
      border: '1px solid rgba(255,255,255,.06)',
      background: 'rgba(255,255,255,.03)',
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      minWidth: 140,
    }}>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
        {label}
      </span>
      <span style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1.1 }}>
        {value}
      </span>
      {delta != null && (
        <span style={{ fontSize: 11, color: deltaPositive ? 'rgba(130,220,170,.7)' : 'rgba(220,100,100,.7)', marginTop: 2 }}>
          {deltaPositive ? '+' : ''}{delta.value} ({deltaPositive ? '+' : ''}{delta.pct.toFixed(1)}%)
        </span>
      )}
      {sub && (
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.25)' }}>{sub}</span>
      )}
    </div>
  )
}
