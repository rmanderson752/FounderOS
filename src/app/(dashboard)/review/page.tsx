// src/app/(dashboard)/review/page.tsx
'use client'

import { useState } from 'react'
import { ReviewFlow } from '@/components/review/ReviewFlow'
import { ReviewHistory } from '@/components/review/ReviewHistory'
import { ReviewInsights } from '@/components/review/ReviewInsights'
import { PageTransition } from '@/components/ui'
import { useSnapshotHistory } from '@/hooks/useReview'
import { useWeekTemplate } from '@/hooks/useWeekTemplate'
import { getPlannedHoursFromTemplate } from '@/hooks/useReview'

export default function ReviewPage() {
  const [tab, setTab] = useState<'review' | 'history'>('review')
  const { data: snapshots = [] } = useSnapshotHistory()
  const { data: template = [] } = useWeekTemplate()

  // Build project map for history display
  const planned = getPlannedHoursFromTemplate(template)
  const projectMap: Record<string, { name: string; color: string }> = {}
  for (const [key, info] of Object.entries(planned)) {
    projectMap[key] = { name: info.name, color: info.color }
  }

  return (
    <PageTransition>
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-6 bg-canvas rounded-lg p-1 max-w-xs">
        <button
          onClick={() => setTab('review')}
          className={`flex-1 text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
            tab === 'review'
              ? 'bg-surface-3 text-ink'
              : 'text-ink-3 hover:text-ink-2'
          }`}
        >
          Review
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex-1 text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
            tab === 'history'
              ? 'bg-surface-3 text-ink'
              : 'text-ink-3 hover:text-ink-2'
          }`}
        >
          History
          {snapshots.length > 0 && (
            <span className="ml-1.5 text-xs text-ink-4">({snapshots.length})</span>
          )}
        </button>
      </div>

      {tab === 'review' && (
        <>
          <ReviewFlow />
          <ReviewInsights />
        </>
      )}
      {tab === 'history' && (
        <div className="max-w-2xl mx-auto">
          <div className="mb-4">
            <h1 className="text-xl font-semibold text-ink">Review History</h1>
            <p className="text-sm text-ink-3 mt-1">
              Your past weekly reviews and reflections.
            </p>
          </div>
          <ReviewHistory snapshots={snapshots} projectMap={projectMap} />
        </div>
      )}
    </div>
    </PageTransition>
  )
}
