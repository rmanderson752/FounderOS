// src/lib/agent/types.ts
// Types for the AI agent system

export interface AgentMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface AgentContext {
  projects: Array<{
    id: string
    name: string
    color: string
    weekly_hours: number
    priority: number
    status: string
  }>
  schedule: Array<{
    day_of_week: number
    available_hours: number
    is_available: boolean
    notes: string | null
  }>
  template: Array<{
    id: string
    project_id: string
    day_of_week: number
    slot: string
    hours: number
    position: number
    projects: { name: string; color: string } | null
  }>
  recentLogs: Array<{
    project_id: string | null
    started_at: string
    duration_minutes: number | null
  }>
  recentSnapshots: Array<{
    week_start: string
    planned_hours: Record<string, number>
    actual_hours: Record<string, number>
    blocks_completed: number
    blocks_skipped: number
  }>
  currentDay: number
  currentDate: string
}

export type AgentActionType = 'template_update' | 'task_reorder'

export interface TemplateUpdateAction {
  type: 'template_update'
  blocks: Array<{
    project_id: string
    day_of_week: number
    slot: 'morning' | 'afternoon' | 'full'
    hours: number
  }>
}

export interface TaskReorderAction {
  type: 'task_reorder'
  project_id: string
  task_ids: string[]
}

export type AgentAction = TemplateUpdateAction | TaskReorderAction

export type ContextType = 'general' | 'template_generation' | 'rebalance' | 'review_insights'
