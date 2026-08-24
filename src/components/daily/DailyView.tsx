// src/components/daily/DailyView.tsx
'use client'

import { useState } from 'react'
import { Calendar, ArrowRight, Coffee } from 'lucide-react'
import { getDay } from 'date-fns'
import { useDailyBlock, useBlockTasks } from '@/hooks/useDailyBlock'
import { useWeekTemplate } from '@/hooks/useWeekTemplate'
import { BlockHeader } from './BlockHeader'
import { TaskList } from './TaskList'
import { NextBlockPreview } from './NextBlockPreview'
import { CalendarEvents } from './CalendarEvents'
import { AgentSuggestion } from '@/components/agent'
import { useAgentSettings } from '@/hooks/useAgentSettings'
import Link from 'next/link'
import { format } from 'date-fns'

export function DailyView() {
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0)
  const {
    todayBlocks,
    currentBlock: firstBlock,
    totalHoursToday,
    hasBlocks,
    isLoading: blockLoading,
  } = useDailyBlock()
  const { data: allBlocks = [] } = useWeekTemplate()
  const { data: agentSettings } = useAgentSettings()

  // Use the selected block index
  const currentBlock = todayBlocks[currentBlockIndex] || firstBlock
  const blockName = currentBlock
    ? currentBlock.project_id
      ? (currentBlock.projects?.name || 'Unknown Project')
      : (currentBlock.label || 'Untitled Block')
    : ''
  const blockColor = currentBlock
    ? currentBlock.project_id
      ? (currentBlock.projects?.color || '#3B82F6')
      : (currentBlock.color || '#6B7280')
    : '#3B82F6'
  const isProjectBlock = currentBlock ? !!currentBlock.project_id : false

  // Fetch tasks for the current block's project (only if it's a project block)
  const { data: tasks = [], isLoading: tasksLoading } = useBlockTasks(
    isProjectBlock ? currentBlock?.project_id : undefined
  )

  const today = getDay(new Date())

  if (blockLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-white border border-line rounded-3xl shadow-sm animate-pulse" />
        <div className="h-48 bg-white border border-line rounded-3xl shadow-sm animate-pulse" />
      </div>
    )
  }

  // No blocks today — empty state
  if (!hasBlocks) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-full bg-surface-3 flex items-center justify-center mb-4">
          <Coffee className="w-7 h-7 text-ink-4" />
        </div>
        <h2 className="text-lg font-medium text-ink mb-1">No blocks today</h2>
        <p className="text-sm text-ink-3 mb-6 max-w-sm">
          Nothing scheduled. Build your weekly template to see today's focus.
        </p>
        <Link
          href="/week"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-2 rounded-full transition-colors"
        >
          <Calendar className="w-4 h-4" />
          Build Weekly Template
          <ArrowRight className="w-4 h-4" />
        </Link>

        {/* Still show next block preview */}
        <div className="mt-8 w-full max-w-md">
          <NextBlockPreview
            allBlocks={allBlocks}
            currentDay={today}
            currentBlockIndex={0}
            todayBlocks={[]}
          />
        </div>
      </div>
    )
  }

  // Determine if agent suggestion should show
  const showRebalanceSuggestion = agentSettings?.enabled && agentSettings?.auto_rebalance && !hasBlocks && allBlocks.length > 0

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Agent suggestion — show when no blocks today but template exists */}
      {showRebalanceSuggestion && (
        <AgentSuggestion
          message="No blocks scheduled today, but you have a weekly template. Want me to rebalance your week?"
          actionLabel="Rebalance"
          onAction={() => window.dispatchEvent(new CustomEvent('open-agent', { detail: 'rebalance' }))}
        />
      )}

      {/* Block header */}
      <BlockHeader
        blockName={blockName}
        blockColor={blockColor}
        totalHoursToday={totalHoursToday}
        todayBlocks={todayBlocks}
        currentBlockIndex={currentBlockIndex}
        onSwitchBlock={setCurrentBlockIndex}
      />

      {/* Tasks (only for project blocks) */}
      {isProjectBlock && currentBlock?.project_id && (
        <TaskList
          tasks={tasks}
          projectId={currentBlock.project_id}
          projectName={blockName}
          blockColor={blockColor}
          isLoading={tasksLoading}
        />
      )}

      {/* Life block — just show the block, no tasks */}
      {!isProjectBlock && currentBlock && (
        <div className="p-5 bg-white border border-line rounded-3xl shadow-sm text-center">
          <p className="text-sm text-ink-3">
            {blockName} — {currentBlock.hours}h blocked
          </p>
          <p className="text-xs text-ink-4 mt-1">
            No tasks for this block. It's reserved time.
          </p>
        </div>
      )}

      {/* Google Calendar events */}
      <CalendarEvents date={format(new Date(), 'yyyy-MM-dd')} />

      {/* Next block preview */}
      <NextBlockPreview
        allBlocks={allBlocks}
        currentDay={today}
        currentBlockIndex={currentBlockIndex}
        todayBlocks={todayBlocks}
      />
    </div>
  )
}
