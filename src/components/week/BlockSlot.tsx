// src/components/week/BlockSlot.tsx
'use client'

import { X } from 'lucide-react'
import { motion } from 'framer-motion'
import type { TemplateBlockWithProject } from '@/hooks/useWeekTemplate'

interface BlockSlotProps {
  block: TemplateBlockWithProject
  onDelete: (id: string) => void
}

export function BlockSlot({ block, onDelete }: BlockSlotProps) {
  const name = block.project_id
    ? (block.projects?.name || 'Unknown Project')
    : (block.label || 'Untitled')

  const blockColor = block.project_id
    ? (block.projects?.color || '#3B82F6')
    : (block.color || '#6B7280')

  const slotLabel = block.slot === 'full' ? '' : block.slot === 'morning' ? 'AM' : 'PM'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className="group relative flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-all duration-150 hover:shadow-sm"
      style={{
        backgroundColor: `${blockColor}12`,
        borderColor: `${blockColor}25`,
      }}
    >
      {/* Color bar */}
      <div
        className="w-[3px] h-full absolute left-0 top-0 rounded-l-lg"
        style={{ backgroundColor: blockColor }}
      />

      {/* Content */}
      <div className="flex-1 min-w-0 pl-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-ink truncate">{name}</span>
          {slotLabel && (
            <span className="text-[10px] text-ink-4 flex-shrink-0">{slotLabel}</span>
          )}
        </div>
        <span className="text-[10px] text-ink-4">{block.hours}h</span>
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete(block.id)
        }}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-ink-4 hover:text-red-400 transition-all flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  )
}
