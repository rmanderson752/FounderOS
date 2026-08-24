// src/hooks/useMetrics.ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { ProjectMetric, ProjectMetricEntry } from '@/types/database'

// ── Metrics CRUD ────────────────────────────────────────────────

export function useProjectMetrics(projectId: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['metrics', projectId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('project_metrics')
        .select('*')
        .eq('user_id', user.id)
        .eq('project_id', projectId!)
        .order('position', { ascending: true })

      if (error) throw error
      return data as ProjectMetric[]
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000, // 5 minutes — metrics definitions rarely change
  })
}

export function useAllMetrics() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['metrics', 'all'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('project_metrics')
        .select('*')
        .eq('user_id', user.id)
        .order('position', { ascending: true })

      if (error) throw error
      return data as ProjectMetric[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateMetric() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (metric: {
      project_id: string
      name: string
      type: 'currency' | 'number' | 'percentage'
      goal?: number | null
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Get next position
      const { data: existing } = await supabase
        .from('project_metrics')
        .select('position')
        .eq('user_id', user.id)
        .eq('project_id', metric.project_id)
        .order('position', { ascending: false })
        .limit(1)

      const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0

      const { data, error } = await supabase
        .from('project_metrics')
        .insert({
          user_id: user.id,
          project_id: metric.project_id,
          name: metric.name,
          type: metric.type,
          goal: metric.goal ?? null,
          position: nextPosition,
        })
        .select()
        .single()

      if (error) throw error
      return data as ProjectMetric
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['metrics'] })
    },
  })
}

export function useDeleteMetric() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('project_metrics')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metrics'] })
      queryClient.invalidateQueries({ queryKey: ['metric-entries'] })
    },
  })
}

// ── Metric Entries ──────────────────────────────────────────────

export function useMetricEntries(metricId: string | undefined, limit = 12) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['metric-entries', metricId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_metric_entries')
        .select('*')
        .eq('metric_id', metricId!)
        .order('week_start', { ascending: false })
        .limit(limit)

      if (error) throw error
      // Reverse so oldest is first (for sparkline left-to-right)
      return (data as ProjectMetricEntry[]).reverse()
    },
    enabled: !!metricId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useAllMetricEntries(metricIds: string[], limit = 12) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['metric-entries', 'all', metricIds.join(','), limit],
    queryFn: async () => {
      if (metricIds.length === 0) return {}

      const { data, error } = await supabase
        .from('project_metric_entries')
        .select('*')
        .in('metric_id', metricIds)
        .order('week_start', { ascending: false })
        .limit(limit * metricIds.length)

      if (error) throw error

      // Group by metric_id, reverse each group for sparkline order
      const grouped: Record<string, ProjectMetricEntry[]> = {}
      for (const entry of data as ProjectMetricEntry[]) {
        if (!grouped[entry.metric_id]) grouped[entry.metric_id] = []
        grouped[entry.metric_id].push(entry)
      }
      // Reverse each group so oldest first
      for (const key of Object.keys(grouped)) {
        grouped[key].reverse()
      }
      return grouped
    },
    enabled: metricIds.length > 0,
    staleTime: 5 * 60 * 1000,
  })
}

export function useSaveMetricEntry() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (entry: {
      metric_id: string
      value: number
      week_start: string
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('project_metric_entries')
        .upsert(
          { ...entry, user_id: user.id },
          { onConflict: 'metric_id,week_start' }
        )
        .select()
        .single()

      if (error) throw error
      return data as ProjectMetricEntry
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metric-entries'] })
    },
  })
}
