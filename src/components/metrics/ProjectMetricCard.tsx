// src/components/metrics/ProjectMetricCard.tsx
'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Trash2 } from 'lucide-react'
import { formatMetricValue } from '@/lib/utils/formatting'
import { TrendSparkline, computeTrend } from './TrendSparkline'
import type { ProjectMetric, ProjectMetricEntry } from '@/types/database'

interface ProjectMetricCardProps {
  metric: ProjectMetric
  entries: ProjectMetricEntry[]
  onDelete: (id: string) => void
}

const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'flat' }) => {
  if (trend === 'up') return <TrendingUp className="w-3.5 h-3.5 text-green-400" />
  if (trend === 'down') return <TrendingDown className="w-3.5 h-3.5 text-red-400" />
  return <Minus className="w-3.5 h-3.5 text-amber-400" />
}

export function ProjectMetricCard({ metric, entries, onDelete }: ProjectMetricCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  const trend = computeTrend(entries)
  const currentValue = entries.length > 0 ? Number(entries[entries.length - 1].value) : null
  const formattedValue = currentValue !== null
    ? formatMetricValue(currentValue, metric.type)
    : '—'

  const goalProgress = metric.goal && currentValue !== null
    ? Math.min(100, Math.round((currentValue / metric.goal) * 100))
    : null

  return (
    <div className="bg-canvas border border-line rounded-xl p-4 group">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-ink-3">{metric.name}</span>
          <TrendIcon trend={trend} />
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          {confirmDelete ? (
            <button
              onClick={() => {
                onDelete(metric.id)
                setConfirmDelete(false)
              }}
              className="text-[10px] font-medium text-red-400 hover:text-red-300 px-1.5 py-0.5 bg-red-500/10 rounded"
            >
              Confirm
            </button>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              onBlur={() => setTimeout(() => setConfirmDelete(false), 200)}
              className="p-1 rounded text-ink-4 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Current value */}
      <div className="text-2xl font-semibold text-ink mb-1">
        {formattedValue}
      </div>

      {/* Goal progress */}
      {metric.goal && goalProgress !== null && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                goalProgress >= 100 ? 'bg-green-500' :
                goalProgress >= 70 ? 'bg-blue-500' : 'bg-amber-500'
              }`}
              style={{ width: `${goalProgress}%` }}
            />
          </div>
          <span className="text-[10px] text-ink-4">
            {goalProgress}% of {formatMetricValue(metric.goal, metric.type)}
          </span>
        </div>
      )}

      {/* Sparkline */}
      <TrendSparkline entries={entries} trend={trend} />
    </div>
  )
}
