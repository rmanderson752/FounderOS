// src/components/review/ReviewPrompt.tsx
'use client'

import { ClipboardCheck, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { startOfWeek, subWeeks, getDay, format } from 'date-fns'
import { useWeeklySnapshot } from '@/hooks/useReview'

interface ReviewPromptProps {
  /** The user's configured review day (0=Sunday, default) */
  reviewDay?: number
}

export function ReviewPrompt({ reviewDay = 0 }: ReviewPromptProps) {
  const today = getDay(new Date())

  // Check if there's a snapshot for last week
  const lastWeekStart = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 0 })
  const { data: snapshot, isLoading } = useWeeklySnapshot(lastWeekStart)

  // Only show if it's review day (or 1 day after) and no review exists
  const isReviewDay = today === reviewDay || today === (reviewDay + 1) % 7
  const hasReview = !!snapshot
  const shouldShow = isReviewDay && !hasReview && !isLoading

  if (!shouldShow) return null

  return (
    <Link
      href="/review"
      className="block mb-6 px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-xl hover:bg-blue-500/15 transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
          <ClipboardCheck className="w-4 h-4 text-blue-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-ink">
            Time for your weekly review
          </p>
          <p className="text-xs text-ink-3">
            Review your week of {format(lastWeekStart, 'MMM d')} — planned vs. actual hours, block completion, and reflections.
          </p>
        </div>
        <ArrowRight className="w-4 h-4 text-ink-4 group-hover:text-blue-400 transition-colors" />
      </div>
    </Link>
  )
}
