// src/components/week/DayColumn.tsx
'use client'

import { Plus, Coffee } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { BlockSlot } from './BlockSlot'
import { DAY_NAMES_SHORT } from '@/lib/constants'
import type { TemplateBlockWithProject } from '@/hooks/useWeekTemplate'

interface DayColumnProps {
  dayOfWeek: number
  blocks: TemplateBlockWithProject[]
  availableHours: number
  isAvailable: boolean
  onAddBlock: (dayOfWeek: number) => void
  onDeleteBlock: (id: string) => void
  isToday: boolean
}

export function DayColumn({
  dayOfWeek,
  blocks,
  availableHours,
  isAvailable,
  onAddBlock,
  onDeleteBlock,
  isToday,
}: DayColumnProps) {
  const allocatedHours = blocks.reduce((sum, b) => sum + Number(b.hours), 0)
  const isOver = allocatedHours > availableHours
  const remaining = availableHours - allocatedHours

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: dayOfWeek * 0.04 }}
      className={`flex flex-col rounded-xl border transition-all duration-200 ${
        isToday
          ? 'border-blue-500/30 bg-blue-500/[0.04] ring-1 ring-blue-500/10'
          : isAvailable
            ? 'border-line bg-white'
            : 'border-line bg-canvas opacity-40'
      }`}
    >
      {/* Day header */}
      <div className="px-3 py-2.5 border-b border-line">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {isToday && (
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            )}
            <span className={`text-xs font-semibold ${isToday ? 'text-blue-400' : 'text-ink'}`}>
              {DAY_NAMES_SHORT[dayOfWeek]}
            </span>
          </div>
          <span className={`text-[10px] font-medium tabular-nums ${
            isOver ? 'text-red-400' : 'text-ink-4'
          }`}>
            {allocatedHours}/{availableHours}h
          </span>
        </div>
        {/* Mini progress bar */}
        {isAvailable && availableHours > 0 && (
          <div className="mt-1.5 h-1 bg-ink/[0.03] rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${isOver ? 'bg-red-500' : 'bg-blue-500'}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (allocatedHours / availableHours) * 100)}%` }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            />
          </div>
        )}
      </div>

      {/* Blocks */}
      <div className="flex-1 p-2 space-y-1.5 min-h-[80px]">
        <AnimatePresence mode="popLayout">
          {blocks.map((block) => (
            <BlockSlot
              key={block.id}
              block={block}
              onDelete={onDeleteBlock}
            />
          ))}
        </AnimatePresence>

        {/* Empty day placeholder */}
        {isAvailable && blocks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <Coffee className="w-4 h-4 text-gray-700 mb-1" />
            <span className="text-[10px] text-ink-4">No blocks</span>
          </div>
        )}

        {/* Add block button */}
        {isAvailable && (
          <button
            onClick={() => onAddBlock(dayOfWeek)}
            className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-dashed border-line text-ink-4 hover:text-ink-2 hover:border-line-strong hover:bg-ink/[0.02] transition-all text-[11px]"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        )}
      </div>

      {/* Remaining hours */}
      {isAvailable && blocks.length > 0 && remaining > 0 && (
        <div className="px-3 py-1.5 border-t border-line">
          <span className="text-[10px] text-ink-4">{remaining}h free</span>
        </div>
      )}
      {isOver && (
        <div className="px-3 py-1.5 border-t border-red-500/20">
          <span className="text-[10px] text-red-400">{Math.abs(remaining)}h over</span>
        </div>
      )}
    </motion.div>
  )
}
