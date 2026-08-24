// src/components/review/ReviewFlow.tsx
'use client'

import { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Check, Save, ArrowLeft } from 'lucide-react'
import { startOfWeek, subWeeks, format, addWeeks, isSameWeek } from 'date-fns'
import { useWeekTemplate } from '@/hooks/useWeekTemplate'
import {
  useWeeklySnapshot,
  useSaveSnapshot,
  useActualHoursForWeek,
  getPlannedHoursFromTemplate,
} from '@/hooks/useReview'
import { TimeAudit } from './TimeAudit'
import { BlockReview } from './BlockReview'
import { ReviewNotes } from './ReviewNotes'

const STEPS = ['Time Audit', 'Block Review', 'Reflection', 'Save'] as const

export function ReviewFlow() {
  // Default to reviewing last week (most common use case)
  const [reviewWeek, setReviewWeek] = useState(() =>
    startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 0 })
  )
  const [step, setStep] = useState(0)
  const [completedBlocks, setCompletedBlocks] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState(false)

  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 0 })
  const isCurrentWeek = isSameWeek(reviewWeek, new Date(), { weekStartsOn: 0 })

  // Data fetching
  const { data: template = [] } = useWeekTemplate()
  const { data: existingSnapshot } = useWeeklySnapshot(reviewWeek)
  const { data: actualHours = {} } = useActualHoursForWeek(reviewWeek)
  const saveSnapshot = useSaveSnapshot()

  // Load existing snapshot data if available
  useEffect(() => {
    if (existingSnapshot) {
      setNotes(existingSnapshot.notes ?? '')
      // Reconstruct completed blocks set from the count
      // (We don't store individual block IDs, so default to empty on re-edit)
    }
  }, [existingSnapshot])

  // Compute planned hours from template
  const planned = useMemo(() => getPlannedHoursFromTemplate(template), [template])

  // Build project list for TimeAudit
  const projectRows = useMemo(() => {
    const keys = new Set([...Object.keys(planned), ...Object.keys(actualHours)])
    return Array.from(keys).map((key) => ({
      key,
      name: planned[key]?.name ?? key.replace('life:', ''),
      color: planned[key]?.color ?? '#6B7280',
      planned: planned[key]?.hours ?? 0,
      actual: actualHours[key] ?? 0,
    })).sort((a, b) => b.planned - a.planned) // Sort by most planned hours first
  }, [planned, actualHours])

  // Block toggle handler
  const toggleBlock = (blockId: string) => {
    setCompletedBlocks((prev) => {
      const next = new Set(prev)
      if (next.has(blockId)) next.delete(blockId)
      else next.add(blockId)
      return next
    })
  }

  // Save handler
  const handleSave = async () => {
    const weekStr = format(reviewWeek, 'yyyy-MM-dd')

    // Build planned/actual maps
    const plannedMap: Record<string, number> = {}
    const actualMap: Record<string, number> = {}
    for (const row of projectRows) {
      plannedMap[row.key] = row.planned
      actualMap[row.key] = row.actual
    }

    await saveSnapshot.mutateAsync({
      week_start: weekStr,
      planned_hours: plannedMap,
      actual_hours: actualMap,
      blocks_completed: completedBlocks.size,
      blocks_skipped: template.length - completedBlocks.size,
      notes: notes || null,
    })

    setSaved(true)
  }

  // Week navigation
  const goToPreviousWeek = () => {
    setReviewWeek((w) => subWeeks(w, 1))
    resetReview()
  }
  const goToNextWeek = () => {
    const next = addWeeks(reviewWeek, 1)
    if (next <= thisWeekStart) {
      setReviewWeek(next)
      resetReview()
    }
  }
  const resetReview = () => {
    setStep(0)
    setCompletedBlocks(new Set())
    setNotes('')
    setSaved(false)
  }

  const canGoNext = step < STEPS.length - 1
  const canGoPrev = step > 0

  return (
    <div className="max-w-2xl mx-auto">
      {/* Week selector */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-ink">Weekly Review</h1>
          <p className="text-sm text-ink-3 mt-1">
            Review your week and log what happened.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousWeek}
            className="p-1.5 rounded-lg hover:bg-surface-3 text-ink-3 hover:text-ink transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-ink font-medium px-2">
            Week of {format(reviewWeek, 'MMM d')}
          </span>
          <button
            onClick={goToNextWeek}
            disabled={isCurrentWeek || addWeeks(reviewWeek, 1) > thisWeekStart}
            className="p-1.5 rounded-lg hover:bg-surface-3 text-ink-3 hover:text-ink transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Already reviewed badge */}
      {existingSnapshot && !saved && (
        <div className="mb-4 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-xs text-blue-400">
            You already reviewed this week. Saving again will update your existing review.
          </p>
        </div>
      )}

      {/* Step indicators */}
      <div className="flex items-center gap-1 mb-6">
        {STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => !saved && setStep(i)}
            className={`flex-1 h-1.5 rounded-full transition-colors ${
              i <= step ? 'bg-blue-500' : 'bg-surface-3'
            } ${!saved ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between mb-6">
        <span className="text-xs text-ink-4">
          Step {step + 1} of {STEPS.length}
        </span>
        <span className="text-xs text-ink-3 font-medium">
          {STEPS[step]}
        </span>
      </div>

      {/* Step content */}
      <div className="bg-white border border-line rounded-3xl shadow-sm p-5 mb-6">
        {saved ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-ink mb-1">Review Saved</h3>
            <p className="text-sm text-ink-3 mb-4">
              Week of {format(reviewWeek, 'MMM d, yyyy')} has been logged.
            </p>
            <button
              onClick={resetReview}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Review another week
            </button>
          </div>
        ) : (
          <>
            {step === 0 && (
              <TimeAudit projects={projectRows} />
            )}
            {step === 1 && (
              <BlockReview
                blocks={template}
                completedBlocks={completedBlocks}
                onToggle={toggleBlock}
              />
            )}
            {step === 2 && (
              <ReviewNotes value={notes} onChange={setNotes} />
            )}
            {step === 3 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-ink">Summary</h3>

                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-canvas rounded-lg p-3 text-center">
                    <div className="text-2xl font-semibold text-ink">
                      {projectRows.reduce((s, p) => s + p.actual, 0).toFixed(1)}h
                    </div>
                    <div className="text-xs text-ink-4 mt-1">Total Hours</div>
                  </div>
                  <div className="bg-canvas rounded-lg p-3 text-center">
                    <div className="text-2xl font-semibold text-ink">
                      {completedBlocks.size}/{template.length}
                    </div>
                    <div className="text-xs text-ink-4 mt-1">Blocks Done</div>
                  </div>
                  <div className="bg-canvas rounded-lg p-3 text-center">
                    <div className="text-2xl font-semibold text-ink">
                      {projectRows.reduce((s, p) => s + p.planned, 0) > 0
                        ? Math.round(
                            (projectRows.reduce((s, p) => s + p.actual, 0) /
                              projectRows.reduce((s, p) => s + p.planned, 0)) *
                              100
                          )
                        : 0}%
                    </div>
                    <div className="text-xs text-ink-4 mt-1">Completion</div>
                  </div>
                </div>

                {/* Notes preview */}
                {notes && (
                  <div className="bg-canvas rounded-lg p-3">
                    <span className="text-xs text-ink-4 block mb-1">Notes</span>
                    <p className="text-sm text-ink-2 line-clamp-3">{notes}</p>
                  </div>
                )}

                {/* Save button */}
                <button
                  onClick={handleSave}
                  disabled={saveSnapshot.isPending}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-sm px-4 py-2.5 rounded-full transition-colors flex items-center justify-center gap-2"
                >
                  {saveSnapshot.isPending ? (
                    <>Saving...</>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Weekly Review
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Navigation */}
      {!saved && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={!canGoPrev}
            className="flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          {canGoNext && (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="bg-surface-3 hover:bg-surface-3 text-ink font-medium text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
