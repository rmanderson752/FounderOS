// src/components/daily/NextBlockPreview.tsx
'use client'

import { ChevronRight } from 'lucide-react'
import { DAY_NAMES } from '@/lib/constants'
import type { TemplateBlockWithProject } from '@/hooks/useWeekTemplate'

interface NextBlockPreviewProps {
  /** All template blocks (all days) */
  allBlocks: TemplateBlockWithProject[]
  /** Current day of week (0-6) */
  currentDay: number
  /** Index of current block within today */
  currentBlockIndex: number
  /** All blocks for today */
  todayBlocks: TemplateBlockWithProject[]
}

export function NextBlockPreview({
  allBlocks,
  currentDay,
  currentBlockIndex,
  todayBlocks,
}: NextBlockPreviewProps) {
  // Check if there's another block today
  const nextTodayBlock = todayBlocks[currentBlockIndex + 1]
  
  if (nextTodayBlock) {
    const name = nextTodayBlock.project_id
      ? (nextTodayBlock.projects?.name || 'Project')
      : (nextTodayBlock.label || 'Block')
    const color = nextTodayBlock.project_id
      ? (nextTodayBlock.projects?.color || '#3B82F6')
      : (nextTodayBlock.color || '#6B7280')

    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-canvas border border-line rounded-lg">
        <span className="text-xs text-ink-4">Up next today</span>
        <ChevronRight className="w-3 h-3 text-ink-4" />
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm text-ink-2">{name}</span>
        <span className="text-xs text-ink-4">{nextTodayBlock.hours}h</span>
      </div>
    )
  }

  // Find next day with blocks
  for (let offset = 1; offset <= 7; offset++) {
    const nextDay = (currentDay + offset) % 7
    const nextDayBlocks = allBlocks.filter(b => b.day_of_week === nextDay)
    
    if (nextDayBlocks.length > 0) {
      const firstBlock = nextDayBlocks[0]
      const name = firstBlock.project_id
        ? (firstBlock.projects?.name || 'Project')
        : (firstBlock.label || 'Block')
      const color = firstBlock.project_id
        ? (firstBlock.projects?.color || '#3B82F6')
        : (firstBlock.color || '#6B7280')
      const totalHours = nextDayBlocks.reduce((sum, b) => sum + Number(b.hours), 0)

      return (
        <div className="flex items-center gap-3 px-4 py-3 bg-canvas border border-line rounded-lg">
          <span className="text-xs text-ink-4">{DAY_NAMES[nextDay]}</span>
          <ChevronRight className="w-3 h-3 text-ink-4" />
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="text-sm text-ink-2">{name}</span>
          {nextDayBlocks.length > 1 && (
            <span className="text-xs text-ink-4">+{nextDayBlocks.length - 1} more</span>
          )}
          <span className="text-xs text-ink-4 ml-auto">{totalHours}h</span>
        </div>
      )
    }
  }

  return null // No upcoming blocks at all
}
