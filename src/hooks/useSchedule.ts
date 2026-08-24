// src/hooks/useSchedule.ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { ScheduleConstraint } from '@/types/database'

export function useSchedule() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['schedule'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('schedule_constraints')
        .select('*')
        .eq('user_id', user.id)
        .order('day_of_week', { ascending: true })

      if (error) throw error
      return data as ScheduleConstraint[]
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — schedule rarely changes
  })
}

export function useSaveSchedule() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (constraints: { day_of_week: number; available_hours: number; is_available: boolean; notes?: string }[]) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const rows = constraints.map(c => ({
        user_id: user.id,
        day_of_week: c.day_of_week,
        available_hours: c.available_hours,
        is_available: c.is_available,
        notes: c.notes || null,
      }))

      const { data, error } = await supabase
        .from('schedule_constraints')
        .upsert(rows, { onConflict: 'user_id,day_of_week' })
        .select()

      if (error) throw error
      return data as ScheduleConstraint[]
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] })
    },
  })
}

export function useTotalWeeklyHours() {
  const { data: schedule } = useSchedule()
  return schedule?.reduce((sum, day) =>
    sum + (day.is_available ? Number(day.available_hours) : 0), 0
  ) ?? 0
}
