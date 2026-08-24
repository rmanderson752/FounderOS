// src/components/metrics/TrendSparkline.tsx
'use client'

import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import type { ProjectMetricEntry } from '@/types/database'

interface TrendSparklineProps {
  entries: ProjectMetricEntry[]
  trend: 'up' | 'down' | 'flat'
}

const TREND_COLORS = {
  up: '#22C55E',
  flat: '#F59E0B',
  down: '#EF4444',
}

export function TrendSparkline({ entries, trend }: TrendSparklineProps) {
  const color = TREND_COLORS[trend]
  const data = entries.map((e) => ({ value: Number(e.value) }))

  if (data.length < 2) {
    return (
      <div className="h-10 flex items-center justify-center">
        <span className="text-[10px] text-ink-4">Not enough data</span>
      </div>
    )
  }

  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`sparkGrad-${trend}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#sparkGrad-${trend})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Compute trend direction from entries
 */
export function computeTrend(entries: ProjectMetricEntry[]): 'up' | 'down' | 'flat' {
  if (entries.length < 2) return 'flat'

  const recent = Number(entries[entries.length - 1].value)
  const previous = Number(entries[entries.length - 2].value)

  if (previous === 0) return recent > 0 ? 'up' : 'flat'

  const change = ((recent - previous) / Math.abs(previous)) * 100

  if (change > 2) return 'up'
  if (change < -2) return 'down'
  return 'flat'
}
