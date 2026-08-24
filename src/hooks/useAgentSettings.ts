// src/hooks/useAgentSettings.ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

interface AgentSettingsData {
  enabled: boolean
  auto_rebalance: boolean
  weekly_digest: boolean
  personality: 'concise' | 'balanced' | 'detailed'
}

const DEFAULT_SETTINGS: AgentSettingsData = {
  enabled: true,
  auto_rebalance: false,
  weekly_digest: true,
  personality: 'balanced',
}

export function useAgentSettings() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['agent-settings'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('agent_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code === 'PGRST116') {
        // No settings row yet — return defaults
        return DEFAULT_SETTINGS
      }

      if (error) throw error

      return {
        enabled: data.enabled,
        auto_rebalance: data.auto_rebalance,
        weekly_digest: data.weekly_digest,
        personality: data.personality,
      } as AgentSettingsData
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — settings rarely change
  })
}

export function useUpdateAgentSettings() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: Partial<AgentSettingsData>) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Upsert: create if not exists, update if exists
      const { error } = await supabase
        .from('agent_settings')
        .upsert(
          {
            user_id: user.id,
            ...updates,
          },
          { onConflict: 'user_id' }
        )

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-settings'] })
    },
  })
}
