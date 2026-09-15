// src/hooks/useGoalThread.ts
// The goal conversation: its messages, and sending one.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { LadderView } from '@/lib/goals/ladder'

export interface ThreadLine {
  id: string
  role: 'user' | 'assistant'
  text: string
  created_at: string
}

export function useGoalThread(id: string) {
  return useQuery({
    queryKey: ['goal-thread', id],
    queryFn: async (): Promise<ThreadLine[]> => {
      const response = await fetch(`/api/goals/${id}/chat`)
      if (!response.ok) throw new Error('Failed to load the conversation')
      return ((await response.json()) as { messages: ThreadLine[] }).messages
    },
    staleTime: 30_000,
  })
}

export function useSendGoalMessage(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { message?: string; start?: boolean }): Promise<{ reply: string; tools: string[]; goal: LadderView }> => {
      const response = await fetch(`/api/goals/${id}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'The agent could not reply')
      return body
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['goal-thread', id] })
      queryClient.setQueryData(['goals-v4', id], data.goal)
      queryClient.invalidateQueries({ queryKey: ['goals-v4'] })
      queryClient.invalidateQueries({ queryKey: ['week'] })
      queryClient.invalidateQueries({ queryKey: ['card'] })
    },
  })
}
