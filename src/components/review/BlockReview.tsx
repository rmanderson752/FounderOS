// src/components/review/BlockReview.tsx
'use client'

import { Check, X } from 'lucide-react'
import { DAY_NAMES_SHORT } from '@/lib/constants'
import type { TemplateBlockWithProject } from '@/hooks/useWeekTemplate'

interface BlockReviewProps {
  blocks: TemplateBlockWithProject[]
  completedBlocks: Set<string>
  onToggle: (blockId: string) => void
}

export function BlockReview({ blocks, completedBlocks, onToggle }: BlockReviewProps) {
  // Group blocks by day
  const blocksByDay: Record<number, TemplateBlockWithProject[]> = {}
  for (const block of blocks) {
    if (!blocksByDay[block.day_of_week]) blocksByDay[block.day_of_week] = []
    blocksByDay[block.day_of_week].push(block)
  }

  const totalBlocks = blocks.length
  const completed = completedBlocks.size
  const skipped = totalBlocks - completed

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Block Review</h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-green-400">{completed} completed</span>
          {skipped > 0 && <span className="text-ink-4">{skipped} skipped</span>}
        </div>
      </div>

      <p className="text-xs text-ink-3">
        Mark the blocks you actually completed this week.
      </p>

      <div className="space-y-3">
        {[0, 1, 2, 3, 4, 5, 6].map((day) => {
          const dayBlocks = blocksByDay[day]
          if (!dayBlocks || dayBlocks.length === 0) return null

          return (
            <div key={day}>
              <span className="text-xs text-ink-4 font-medium mb-1.5 block">
                {DAY_NAMES_SHORT[day]}
              </span>
              <div className="space-y-1.5">
                {dayBlocks.map((block) => {
                  const isComplete = completedBlocks.has(block.id)
                  const name = block.project_id
                    ? (block.projects?.name ?? 'Project')
                    : (block.label ?? 'Block')
                  const color = block.project_id
                    ? (block.projects?.color ?? '#3B82F6')
                    : (block.color ?? '#6B7280')

                  return (
                    <button
                      key={block.id}
                      onClick={() => onToggle(block.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors text-left ${
                        isComplete
                          ? 'bg-green-500/5 border-green-500/20'
                          : 'bg-white border-line hover:bg-surface-3'
                      }`}
                    >
                      {/* Status icon */}
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
                        isComplete ? 'bg-green-500' : 'border border-line-strong'
                      }`}>
                        {isComplete && <Check className="w-3 h-3 text-white" />}
                      </div>

                      {/* Color dot + name */}
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className={`text-sm flex-1 ${
                        isComplete ? 'text-ink-3 line-through' : 'text-ink'
                      }`}>
                        {name}
                      </span>

                      {/* Hours */}
                      <span className="text-xs text-ink-4">
                        {Number(block.hours)}h
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
