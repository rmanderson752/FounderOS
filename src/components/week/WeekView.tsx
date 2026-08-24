// src/components/week/WeekView.tsx
'use client'

import { useState } from 'react'
import { Settings2, Sparkles } from 'lucide-react'
import { getDay } from 'date-fns'
import { useWeekTemplate, useAddBlock, useDeleteBlock } from '@/hooks/useWeekTemplate'
import { useSchedule } from '@/hooks/useSchedule'
import { useProjects } from '@/hooks/useProjects'
import { DayColumn } from './DayColumn'
import { HourBudget } from './HourBudget'
import { AddBlockModal } from './AddBlockModal'
import { ScheduleEditor } from './ScheduleEditor'
import { DAY_NAMES } from '@/lib/constants'

export function WeekView() {
  const { data: blocks = [], isLoading: blocksLoading } = useWeekTemplate()
  const { data: schedule = [], isLoading: scheduleLoading } = useSchedule()
  const { data: projects = [] } = useProjects()
  const addBlock = useAddBlock()
  const deleteBlock = useDeleteBlock()

  const [addingForDay, setAddingForDay] = useState<number | null>(null)
  const [showScheduleEditor, setShowScheduleEditor] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)

  const today = getDay(new Date()) // 0=Sunday

  // Get available hours for a day
  const getAvailableHours = (dayOfWeek: number) => {
    const constraint = schedule.find(s => s.day_of_week === dayOfWeek)
    if (!constraint) return 8 // Default
    return constraint.is_available ? Number(constraint.available_hours) : 0
  }

  const isDayAvailable = (dayOfWeek: number) => {
    const constraint = schedule.find(s => s.day_of_week === dayOfWeek)
    if (!constraint) return true // Default to available
    return constraint.is_available
  }

  const totalAvailable = schedule.length > 0
    ? schedule.reduce((sum, s) => sum + (s.is_available ? Number(s.available_hours) : 0), 0)
    : 56 // Default 8h * 7 days

  const handleAddBlock = async (data: {
    project_id?: string | null
    label?: string | null
    color?: string | null
    hours: number
    slot: 'morning' | 'afternoon' | 'full'
  }) => {
    if (addingForDay === null) return

    const dayBlocks = blocks.filter(b => b.day_of_week === addingForDay)
    const nextPosition = dayBlocks.length

    await addBlock.mutateAsync({
      project_id: data.project_id,
      day_of_week: addingForDay,
      slot: data.slot,
      hours: data.hours,
      position: nextPosition,
      label: data.label,
      color: data.color,
    })

    setAddingForDay(null)
  }

  const handleDeleteBlock = async (id: string) => {
    await deleteBlock.mutateAsync(id)
  }

  const isLoading = blocksLoading || scheduleLoading

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="h-7 bg-surface-3 rounded w-40 relative overflow-hidden">
            <div className="shimmer-wave absolute inset-0" />
          </div>
          <div className="h-8 bg-surface-3 rounded w-24 relative overflow-hidden">
            <div className="shimmer-wave absolute inset-0" />
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {[0, 1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-48 bg-white border border-line rounded-3xl shadow-sm relative overflow-hidden">
              <div className="shimmer-wave absolute inset-0" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-ink tracking-tight">Weekly Template</h1>
          <p className="text-sm text-ink-3 mt-1">
            Assign projects to days. One block = one focus.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => {
              // Open agent chat with generate-template action
              // We dispatch a custom event that the layout can listen to
              window.dispatchEvent(new CustomEvent('open-agent', { detail: 'generate-template' }))
            }}
            disabled={aiGenerating}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            AI Generate
          </button>
          <button
            onClick={() => setShowScheduleEditor(!showScheduleEditor)}
            className="flex items-center gap-2 bg-transparent border border-line-strong hover:bg-surface-3 text-ink font-medium text-sm px-3 py-1.5 rounded-lg transition-colors"
          >
            <Settings2 className="w-4 h-4" />
            Schedule
          </button>
        </div>
      </div>

      {/* Schedule Editor (collapsible) */}
      {showScheduleEditor && (
        <div className="mb-6 p-5 bg-white border border-line rounded-3xl shadow-sm">
          <ScheduleEditor />
        </div>
      )}

      {/* 7-day grid — horizontally scrollable on mobile */}
      <div className="overflow-x-auto -mx-2 px-2 pb-2 md:overflow-visible md:mx-0 md:px-0 mb-4">
        <div className="grid grid-cols-7 gap-2" style={{ minWidth: '640px' }}>
        {[0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => {
          const dayBlocks = blocks.filter(b => b.day_of_week === dayOfWeek)
          return (
            <DayColumn
              key={dayOfWeek}
              dayOfWeek={dayOfWeek}
              blocks={dayBlocks}
              availableHours={getAvailableHours(dayOfWeek)}
              isAvailable={isDayAvailable(dayOfWeek)}
              onAddBlock={setAddingForDay}
              onDeleteBlock={handleDeleteBlock}
              isToday={dayOfWeek === today}
            />
          )
        })}
        </div>
      </div>

      {/* Hour budget */}
      <HourBudget
        blocks={blocks}
        totalAvailable={totalAvailable}
        projects={projects}
      />

      {/* Add block modal */}
      <AddBlockModal
        isOpen={addingForDay !== null}
        onClose={() => setAddingForDay(null)}
        onSubmit={handleAddBlock}
        projects={projects}
        dayName={addingForDay !== null ? DAY_NAMES[addingForDay] : ''}
        isLoading={addBlock.isPending}
      />
    </div>
  )
}
