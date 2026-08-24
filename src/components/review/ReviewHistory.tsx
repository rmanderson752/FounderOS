// src/components/review/ReviewHistory.tsx
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Calendar } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { WeeklySnapshot } from '@/hooks/useReview'

interface ReviewHistoryProps {
  snapshots: WeeklySnapshot[]
  projectMap: Record<string, { name: string; color: string }>
}

export function ReviewHistory({ snapshots, projectMap }: ReviewHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (snapshots.length === 0) {
    return (
      <div className="text-center py-8">
        <Calendar className="w-8 h-8 text-ink-4 mx-auto mb-2" />
        <p className="text-sm text-ink-3">No past reviews yet.</p>
        <p className="text-xs text-ink-4 mt-1">Complete your first weekly review to see it here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {snapshots.map((snapshot) => {
        const isExpanded = expandedId === snapshot.id
        const weekDate = parseISO(snapshot.week_start)
        const totalPlanned = Object.values(snapshot.planned_hours).reduce((s, h) => s + h, 0)
        const totalActual = Object.values(snapshot.actual_hours).reduce((s, h) => s + h, 0)
        const pct = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0

        return (
          <div
            key={snapshot.id}
            className="bg-white border border-line rounded-3xl shadow-sm overflow-hidden"
          >
            {/* Header */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : snapshot.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-3 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                {isExpanded
                  ? <ChevronDown className="w-4 h-4 text-ink-4" />
                  : <ChevronRight className="w-4 h-4 text-ink-4" />
                }
                <span className="text-sm font-medium text-ink">
                  Week of {format(weekDate, 'MMM d, yyyy')}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-ink-4">
                  {totalActual.toFixed(1)}h / {totalPlanned.toFixed(1)}h
                </span>
                <span className={`font-medium ${
                  pct >= 90 ? 'text-green-400' :
                  pct >= 70 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {pct}%
                </span>
                <span className="text-ink-4">
                  {snapshot.blocks_completed}/{snapshot.blocks_completed + snapshot.blocks_skipped} blocks
                </span>
              </div>
            </button>

            {/* Expanded details */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-1 border-t border-line">
                {/* Per-project breakdown */}
                <div className="space-y-2 mb-3">
                  {Object.entries(snapshot.planned_hours).map(([key, planned]) => {
                    const actual = snapshot.actual_hours[key] ?? 0
                    const info = projectMap[key]
                    const name = info?.name ?? key.replace('life:', '')
                    const color = info?.color ?? '#6B7280'

                    return (
                      <div key={key} className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs text-ink-2 flex-1">{name}</span>
                        <span className="text-xs text-ink-4">{planned.toFixed(1)}h →</span>
                        <span className="text-xs text-ink font-medium">{actual.toFixed(1)}h</span>
                      </div>
                    )
                  })}
                </div>

                {/* Notes */}
                {snapshot.notes && (
                  <div className="mt-3 pt-3 border-t border-line">
                    <p className="text-xs text-ink-3 whitespace-pre-wrap">{snapshot.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
