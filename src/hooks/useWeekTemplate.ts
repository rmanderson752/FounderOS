// src/hooks/useWeekTemplate.ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface TemplateBlockWithProject {
  id: string
  user_id: string
  project_id: string | null
  day_of_week: number
  slot: 'morning' | 'afternoon' | 'full'
  hours: number
  position: number
  gcal_event_id: string | null
  label: string | null
  color: string | null
  created_at: string
  // Joined project data (null for non-project blocks)
  projects: { name: string; color: string } | null
}

export function useWeekTemplate() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['template'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('template_blocks')
        .select('*, projects(name, color)')
        .eq('user_id', user.id)
        .order('day_of_week', { ascending: true })
        .order('position', { ascending: true })

      if (error) throw error
      return data as TemplateBlockWithProject[]
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — template rarely changes
  })
}

export interface SaveBlockInput {
  project_id?: string | null
  day_of_week: number
  slot: 'morning' | 'afternoon' | 'full'
  hours: number
  position: number
  label?: string | null
  color?: string | null
}

export function useSaveTemplate() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (blocks: SaveBlockInput[]) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Delete existing template and replace
      const { error: deleteError } = await supabase
        .from('template_blocks')
        .delete()
        .eq('user_id', user.id)

      if (deleteError) throw deleteError

      if (blocks.length > 0) {
        const rows = blocks
          .filter(b => b.project_id) // Only project blocks (project_id is NOT NULL in DB)
          .map(b => ({
            user_id: user.id,
            project_id: b.project_id!,
            day_of_week: b.day_of_week,
            slot: b.slot,
            hours: b.hours,
            position: b.position,
          }))

        const { error: insertError } = await supabase
          .from('template_blocks')
          .insert(rows)

        if (insertError) throw insertError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template'] })
      // Auto-sync to Google Calendar if connected (fire-and-forget)
      fetch('/api/google/calendar/sync', { method: 'POST' }).catch(() => {})
    },
  })
}

export function useAddBlock() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (block: SaveBlockInput) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      if (!block.project_id) throw new Error('project_id is required')

      const { data, error } = await supabase
        .from('template_blocks')
        .insert({
          user_id: user.id,
          project_id: block.project_id,
          day_of_week: block.day_of_week,
          slot: block.slot,
          hours: block.hours,
          position: block.position,
        })
        .select('*, projects(name, color)')
        .single()

      if (error) throw error
      return data as TemplateBlockWithProject
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template'] })
    },
  })
}

export function useUpdateBlock() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<SaveBlockInput>) => {
      const { label, color, ...dbUpdates } = updates as Record<string, unknown>
      const { data, error } = await supabase
        .from('template_blocks')
        .update(dbUpdates)
        .eq('id', id)
        .select('*, projects(name, color)')
        .single()

      if (error) throw error
      return data as TemplateBlockWithProject
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template'] })
    },
  })
}

export function useDeleteBlock() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('template_blocks')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template'] })
    },
  })
}
