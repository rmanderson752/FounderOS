// src/hooks/useReview.ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { startOfWeek, endOfWeek, format } from 'date-fns'
import type { TemplateBlockWithProject } from './useWeekTemplate'

// ── Types ────────────────────────────────────────────────────────

export interface WeeklySnapshot {
  id: string
  user_id: string
  week_start: string
  planned_hours: Record<string, number> // project_id or label → hours
  actual_hours: Record<string, number>
  blocks_completed: number
  blocks_skipped: number
  notes: string | null
  created_at: string
}

export interface CreateSnapshotInput {
  week_start: string
  planned_hours: Record<string, number>
  actual_hours: Record<string, number>
  blocks_completed: number
  blocks_skipped: number
  notes?: string | null
}

// ── Hooks ────────────────────────────────────────────────────────

/**
 * Get snapshot for a specific week
 */
export function useWeeklySnapshot(weekStart: Date) {
  const supabase = createClient()
  const weekStr = format(startOfWeek(weekStart, { weekStartsOn: 0 }), 'yyyy-MM-dd')

  return useQuery({
    queryKey: ['snapshot', weekStr],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('weekly_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start', weekStr)
        .single()

      if (error && error.code !== 'PGRST116') throw error // PGRST116 = not found
      return (data as WeeklySnapshot) ?? null
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — snapshots are weekly
  })
}

/**
 * Save or update a weekly snapshot
 */
export function useSaveSnapshot() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateSnapshotInput) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('weekly_snapshots')
        .upsert(
          { ...input, user_id: user.id },
          { onConflict: 'user_id,week_start' }
        )
        .select()
        .single()

      if (error) throw error
      return data as WeeklySnapshot
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['snapshot', data.week_start] })
      queryClient.invalidateQueries({ queryKey: ['snapshots'] })
    },
  })
}

/**
 * Get history of past snapshots
 */
export function useSnapshotHistory(limit = 12) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['snapshots', limit],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('weekly_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .order('week_start', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data as WeeklySnapshot[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ── Utility: Planned hours from template ─────────────────────────

/**
 * Calculate planned hours per project from the weekly template.
 * Groups by project_id for project blocks, or by label for life blocks.
 */
export function getPlannedHoursFromTemplate(
  blocks: TemplateBlockWithProject[]
): Record<string, { hours: number; name: string; color: string }> {
  const result: Record<string, { hours: number; name: string; color: string }> = {}

  for (const block of blocks) {
    const key = block.project_id ?? `life:${block.label ?? 'Other'}`
    const name = block.project_id
      ? (block.projects?.name ?? 'Unknown Project')
      : (block.label ?? 'Life Block')
    const color = block.project_id
      ? (block.projects?.color ?? '#3B82F6')
      : (block.color ?? '#6B7280')

    if (!result[key]) {
      result[key] = { hours: 0, name, color }
    }
    result[key].hours += Number(block.hours)
  }

  return result
}

// ── Utility: Actual hours from time_logs ─────────────────────────

/**
 * Fetch actual hours per project for a given week from time_logs
 */
export function useActualHoursForWeek(weekStart: Date) {
  const supabase = createClient()
  const start = startOfWeek(weekStart, { weekStartsOn: 0 })
  const end = endOfWeek(weekStart, { weekStartsOn: 0 })
  const startStr = format(start, 'yyyy-MM-dd')
  const endStr = format(end, 'yyyy-MM-dd')

  return useQuery({
    queryKey: ['actual-hours', startStr],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('time_logs')
        .select('project_id, duration_minutes')
        .eq('user_id', user.id)
        .gte('started_at', startStr)
        .lte('started_at', endStr + 'T23:59:59')

      if (error) throw error

      // Aggregate by project_id
      const hours: Record<string, number> = {}
      for (const log of data ?? []) {
        const key = log.project_id ?? 'unassigned'
        hours[key] = (hours[key] ?? 0) + (Number(log.duration_minutes ?? 0) / 60)
      }

      return hours
    },
    staleTime: 2 * 60 * 1000, // 2 minutes — actual hours change during the day
  })
}
