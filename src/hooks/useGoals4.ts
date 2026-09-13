// src/hooks/useGoals4.ts
// v4 goals: outcomes with their milestone ladders. (useGoals.ts is the v1
// single-active-goal feature, kept for /legacy.)

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { LadderView } from '@/lib/goals/ladder'

export function useLadders() {
  return useQuery({
    queryKey: ['goals-v4'],
    queryFn: async (): Promise<LadderView[]> => {
      const response = await fetch('/api/goals')
      if (!response.ok) throw new Error('Failed to load goals')
      const payload = (await response.json()) as { goals: LadderView[] }
      return payload.goals
    },
    staleTime: 60_000,
  })
}

export function useLadder(id: string) {
  return useQuery({
    queryKey: ['goals-v4', id],
    queryFn: async (): Promise<LadderView> => {
      const response = await fetch(`/api/goals/${id}`)
      if (!response.ok) throw new Error('Failed to load goal')
      const payload = (await response.json()) as { goal: LadderView }
      return payload.goal
    },
    staleTime: 60_000,
  })
}

export interface CreateGoalInput {
  title: string
  target_date: string | null
  project: { name: string; repo_path?: string | null } | null
  weight: number
  docs: string | null
}

export function useCreateGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateGoalInput): Promise<{ goal: LadderView; rejected: string[] }> => {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Failed to create goal')
      return payload
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals-v4'] })
      queryClient.invalidateQueries({ queryKey: ['card'] })
    },
  })
}

export function useUpdateGoal(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (patch: { status?: string; weight?: number; target_date?: string | null }) => {
      const response = await fetch(`/api/goals/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!response.ok) throw new Error('Failed to update goal')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals-v4'] })
      queryClient.invalidateQueries({ queryKey: ['card'] })
    },
  })
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; status?: string; estimated_minutes?: number; title?: string }) => {
      const { id, ...patch } = input
      const response = await fetch(`/api/milestones/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!response.ok) throw new Error('Failed to update milestone')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals-v4'] })
      queryClient.invalidateQueries({ queryKey: ['card'] })
    },
  })
}
