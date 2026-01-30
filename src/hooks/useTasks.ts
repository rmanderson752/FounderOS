'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Task } from '@/types/database'

export function useTasks(goalId?: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['tasks', goalId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      let query = supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('priority', { ascending: true })

      if (goalId) {
        query = query.eq('goal_id', goalId)
      }

      const { data, error } = await query

      if (error) throw error
      return data as Task[]
    },
  })
}

// Tasks for active goal only
export function useActiveGoalTasks() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['tasks', 'active-goal'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // First get active goal
      const { data: activeGoal } = await supabase
        .from('goals')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()

      if (!activeGoal) return []

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('goal_id', activeGoal.id)
        .order('priority', { ascending: true })

      if (error) throw error
      return data as Task[]
    },
  })
}

// All tasks from all goals (for Week view and Progress "All Goals" mode)
export function useAllTasks() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['tasks', 'all'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('priority', { ascending: true })

      if (error) throw error
      return data as Task[]
    },
  })
}

// Tasks from all active/paused goals (excludes completed goals)
export function useTasksFromAllGoals() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['tasks', 'all-goals'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Get all non-completed goals
      const { data: goals } = await supabase
        .from('goals')
        .select('id')
        .eq('user_id', user.id)
        .in('status', ['active', 'paused'])

      if (!goals || goals.length === 0) return []

      const goalIds = goals.map(g => g.id)

      const { data, error } = await supabase
        .from('tasks')
        .select('*, goals(title, status)')
        .eq('user_id', user.id)
        .in('goal_id', goalIds)
        .order('priority', { ascending: true })

      if (error) throw error
      return data as (Task & { goals: { title: string; status: string } | null })[]
    },
  })
}

export function useCreateTask() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          ...task,
          user_id: user.id,
        })
        .select()
        .single()

      if (error) throw error
      return data as Task
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useUpdateTask() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Task> & { id: string }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Task
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useDeleteTask() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}