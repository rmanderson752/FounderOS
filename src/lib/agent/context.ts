// src/lib/agent/context.ts
// Build context from user data for the agent

import { createClient } from '@/lib/supabase/server'
import { subDays, format, getDay } from 'date-fns'
import type { AgentContext } from './types'

/**
 * Fetch all relevant user data to build the agent context.
 * Used by all agent API routes.
 */
export async function buildAgentContext(userId: string): Promise<AgentContext> {
  const supabase = await createClient()

  const fourteenDaysAgo = subDays(new Date(), 14).toISOString()

  const [projects, schedule, template, recentLogs, recentSnapshots] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, color, weekly_hours, priority, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('priority', { ascending: true }),
    supabase
      .from('schedule_constraints')
      .select('day_of_week, available_hours, is_available, notes')
      .eq('user_id', userId)
      .order('day_of_week', { ascending: true }),
    supabase
      .from('template_blocks')
      .select('id, project_id, day_of_week, slot, hours, position, projects(name, color)')
      .eq('user_id', userId)
      .order('day_of_week', { ascending: true }),
    supabase
      .from('time_logs')
      .select('project_id, started_at, duration_minutes')
      .eq('user_id', userId)
      .gte('started_at', fourteenDaysAgo)
      .order('started_at', { ascending: false })
      .limit(50),
    supabase
      .from('weekly_snapshots')
      .select('week_start, planned_hours, actual_hours, blocks_completed, blocks_skipped')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(4),
  ])

  return {
    projects: (projects.data ?? []) as AgentContext['projects'],
    schedule: (schedule.data ?? []) as AgentContext['schedule'],
    template: (template.data ?? []) as unknown as AgentContext['template'],
    recentLogs: (recentLogs.data ?? []) as AgentContext['recentLogs'],
    recentSnapshots: (recentSnapshots.data ?? []) as unknown as AgentContext['recentSnapshots'],
    currentDay: getDay(new Date()),
    currentDate: format(new Date(), 'yyyy-MM-dd'),
  }
}
