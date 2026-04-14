'use client'
import { useMemo, memo } from 'react'
import type { ChartPoint } from '../_types'

interface MiniChartProps {
  data: ChartPoint[]
  color: string
  gradientId: string
  height?: number
  dots?: boolean
}

export const MiniChart = memo(function MiniChart({ data, color, gradientId, height = 60, dots = false }: MiniChartProps) {
  const { max, points, w, h, px } = useMemo(() => {
    if (!data.length) return { max: 1, points: '', w: 400, h: height, px: 0 }
    const w = 400, h = height
    const max = Math.max(...data.map(d => d.value), 1)
    const px = data.length > 1 ? w / (data.length - 1) : 0
    const points = data.map((d, i) => `${i * px},${h - (d.value / max) * (h - 6)}`).join(' ')
    return { max, points, w, h, px }
  }, [data, height])

  return (
    <svg
      viewBox={`0 0 ${w} ${h + 4}`}
      style={{ width: '100%', height: h + 10 }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h + 4} ${points} ${w},${h + 4}`} fill={`url(#${gradientId})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {dots && data.map((d, i) => (
        <circle
          key={i}
          cx={i * px}
          cy={h - (d.value / max) * (h - 6)}
          r="3"
          fill={color}
          opacity=".7"
        />
      ))}
    </svg>
  )
})
