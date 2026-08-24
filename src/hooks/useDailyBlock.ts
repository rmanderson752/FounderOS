// src/hooks/useDailyBlock.ts
'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDay } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useWeekTemplate, type TemplateBlockWithProject } from './useWeekTemplate'

export interface DailyBlockInfo {
  /** All blocks scheduled for today */
  todayBlocks: TemplateBlockWithProject[]
  /** The currently active block (first one, or time-based) */
  currentBlock: TemplateBlockWithProject | null
  /** Display name for the current block */
  blockName: string
  /** Color for the current block */
  blockColor: string
  /** Whether this is a project block (has tasks) or a life block */
  isProjectBlock: boolean
  /** Total hours scheduled today */
  totalHoursToday: number
  /** Whether today has any blocks at all */
  hasBlocks: boolean
  /** Whether it's a rest day (no availability) */
  isRestDay: boolean
}

export function useDailyBlock(): DailyBlockInfo & { isLoading: boolean } {
  const { data: allBlocks = [], isLoading } = useWeekTemplate()
  const today = getDay(new Date()) // 0=Sunday

  const result = useMemo(() => {
    const todayBlocks = allBlocks.filter(b => b.day_of_week === today)
    
    // Pick current block — for now just first block; could be time-based later
    const currentBlock = todayBlocks.length > 0 ? todayBlocks[0] : null

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

    const totalHoursToday = todayBlocks.reduce((sum, b) => sum + Number(b.hours), 0)

    return {
      todayBlocks,
      currentBlock,
      blockName,
      blockColor,
      isProjectBlock,
      totalHoursToday,
      hasBlocks: todayBlocks.length > 0,
      isRestDay: todayBlocks.length === 0, // Could also check schedule_constraints
    }
  }, [allBlocks, today])

  return { ...result, isLoading }
}

/**
 * Fetch all tasks for a specific project (TaskList handles completed/incomplete filtering)
 */
export function useBlockTasks(projectId: string | null | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['block-tasks', projectId],
    queryFn: async () => {
      if (!projectId) return []

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('project_id', projectId)
        .order('status', { ascending: true }) // todo/in_progress before completed
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      return data
    },
    enabled: !!projectId,
    staleTime: 2 * 60 * 1000, // 2 minutes — tasks change during the day
  })
}
