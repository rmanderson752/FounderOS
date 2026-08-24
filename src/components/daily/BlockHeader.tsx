// src/components/daily/BlockHeader.tsx
'use client'

import { Clock, Zap, CalendarDays } from 'lucide-react'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import type { TemplateBlockWithProject } from '@/hooks/useWeekTemplate'

interface BlockHeaderProps {
  blockName: string
  blockColor: string
  totalHoursToday: number
  todayBlocks: TemplateBlockWithProject[]
  currentBlockIndex: number
  onSwitchBlock: (index: number) => void
}

export function BlockHeader({
  blockName,
  blockColor,
  totalHoursToday,
  todayBlocks,
  currentBlockIndex,
  onSwitchBlock,
}: BlockHeaderProps) {
  const today = format(new Date(), 'EEEE, MMMM d')
  const hasMultipleBlocks = todayBlocks.length > 1
  const currentBlock = todayBlocks[currentBlockIndex]
  const blockHours = currentBlock ? Number(currentBlock.hours) : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="relative overflow-hidden rounded-xl border border-line"
    >
      {/* Gradient background */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          background: `linear-gradient(135deg, ${blockColor} 0%, transparent 60%)`,
        }}
      />
      {/* Subtle top glow line */}
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, ${blockColor}, ${blockColor}80, transparent)`,
        }}
      />

      <div className="relative p-5 pt-5">
        {/* Date */}
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="w-3.5 h-3.5 text-ink-4" />
          <p className="text-xs font-medium text-ink-4 tracking-wide uppercase">{today}</p>
        </div>

        {/* Block name */}
        <h1 className="text-2xl font-semibold text-ink tracking-tight mb-3">{blockName}</h1>

        {/* Stats row */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-sm text-ink-3">
            <Clock className="w-4 h-4" />
            <span>{totalHoursToday}h today</span>
          </div>
          {blockHours > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-ink-3">
              <Zap className="w-4 h-4" style={{ color: blockColor }} />
              <span>{blockHours}h this block</span>
            </div>
          )}
          {todayBlocks.length > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-ink-4">
              <span className="w-1 h-1 rounded-full bg-ink-4" />
              <span>{todayBlocks.length} block{todayBlocks.length > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* Block switcher (if multiple blocks) */}
        {hasMultipleBlocks && (
          <div className="flex items-center gap-1.5 mt-4 p-1 bg-ink/15 rounded-lg w-fit">
            {todayBlocks.map((block, i) => {
              const name = block.project_id
                ? (block.projects?.name || 'Project')
                : (block.label || 'Block')
              const color = block.project_id
                ? (block.projects?.color || '#3B82F6')
                : (block.color || '#6B7280')

              return (
                <button
                  key={block.id}
                  onClick={() => onSwitchBlock(i)}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    i === currentBlockIndex
                      ? 'bg-ink/[0.06] text-ink shadow-sm'
                      : 'text-ink-4 hover:text-ink-2'
                  }`}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="truncate max-w-[80px]">{name}</span>
                  <span className="text-ink-4">{block.hours}h</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}
