// src/hooks/useGoals.ts
// Hooks for goal CRUD operations

'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Goal } from '@/types/database'

export function useGoals() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['goals'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Goal[]
    },
  })
}

export function useActiveGoal() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['goals', 'active'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data as Goal | null
    },
  })
}

export function useCreateGoal() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (goal: Omit<Goal, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Deactivate other active goals first
      if (goal.status === 'active') {
        await supabase
          .from('goals')
          .update({ status: 'paused' })
          .eq('user_id', user.id)
          .eq('status', 'active')
      }

      const { data, error } = await supabase
        .from('goals')
        .insert({
          ...goal,
          user_id: user.id,
        })
        .select()
        .single()

      if (error) throw error
      return data as Goal
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
  })
}

export function useUpdateGoal() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Goal> & { id: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // If setting this goal to active, deactivate others
      if (updates.status === 'active') {
        await supabase
          .from('goals')
          .update({ status: 'paused' })
          .eq('user_id', user.id)
          .eq('status', 'active')
          .neq('id', id)
      }

      const { data, error } = await supabase
        .from('goals')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Goal
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
  })
}

export function useDeleteGoal() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}