const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active:   { bg: 'rgba(130,220,170,.1)', text: 'rgba(130,220,170,.8)' },
  trialing: { bg: 'rgba(130,150,220,.1)', text: 'rgba(130,150,220,.8)' },
  past_due: { bg: 'rgba(220,170,100,.1)', text: 'rgba(220,170,100,.8)' },
  canceled: { bg: 'rgba(220,100,100,.1)', text: 'rgba(220,100,100,.7)' },
  inactive: { bg: 'rgba(255,255,255,.04)', text: 'rgba(255,255,255,.3)' },
}

export function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.inactive
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
      background: c.bg, color: c.text,
      textTransform: 'uppercase', letterSpacing: '.05em',
    }}>
      {status}
    </span>
  )
}
