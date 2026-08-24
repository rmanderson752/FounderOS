export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          avatar_id: string | null
          onboarded: boolean
          daily_hours_available: number
          work_days: number[]
          review_day: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          avatar_id?: string | null
          onboarded?: boolean
          daily_hours_available?: number
          work_days?: number[]
          review_day?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          avatar_id?: string | null
          onboarded?: boolean
          daily_hours_available?: number
          work_days?: number[]
          review_day?: number
          created_at?: string
          updated_at?: string
        }
      }
      goals: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          deadline: string
          status: 'active' | 'completed' | 'paused'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          deadline: string
          status?: 'active' | 'completed' | 'paused'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          deadline?: string
          status?: 'active' | 'completed' | 'paused'
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string
          weekly_hours: number
          priority: number
          status: 'active' | 'paused' | 'completed'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color?: string
          weekly_hours?: number
          priority?: number
          status?: 'active' | 'paused' | 'completed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          color?: string
          weekly_hours?: number
          priority?: number
          status?: 'active' | 'paused' | 'completed'
          created_at?: string
          updated_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          user_id: string
          goal_id: string | null
          project_id: string | null
          title: string
          description: string | null
          estimated_minutes: number
          actual_minutes: number
          status: 'todo' | 'in_progress' | 'completed'
          priority: number
          is_recurring: boolean
          recurrence_pattern: string | null
          due_date: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          goal_id?: string | null
          project_id?: string | null
          title: string
          description?: string | null
          estimated_minutes: number
          actual_minutes?: number
          status?: 'todo' | 'in_progress' | 'completed'
          priority?: number
          is_recurring?: boolean
          recurrence_pattern?: string | null
          due_date?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          goal_id?: string | null
          project_id?: string | null
          title?: string
          description?: string | null
          estimated_minutes?: number
          actual_minutes?: number
          status?: 'todo' | 'in_progress' | 'completed'
          priority?: number
          is_recurring?: boolean
          recurrence_pattern?: string | null
          due_date?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      time_logs: {
        Row: {
          id: string
          user_id: string
          task_id: string
          project_id: string | null
          started_at: string
          ended_at: string | null
          duration_minutes: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          task_id: string
          project_id?: string | null
          started_at: string
          ended_at?: string | null
          duration_minutes?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          task_id?: string
          project_id?: string | null
          started_at?: string
          ended_at?: string | null
          duration_minutes?: number | null
          created_at?: string
        }
      }
      daily_completions: {
        Row: {
          id: string
          user_id: string
          task_id: string
          date: string
          completed_at: string
          actual_minutes: number
        }
        Insert: {
          id?: string
          user_id: string
          task_id: string
          date: string
          completed_at?: string
          actual_minutes?: number
        }
        Update: {
          id?: string
          user_id?: string
          task_id?: string
          date?: string
          completed_at?: string
          actual_minutes?: number
        }
      }
      schedule_constraints: {
        Row: {
          id: string
          user_id: string
          day_of_week: number
          available_hours: number
          is_available: boolean
          notes: string | null
          /** Work window start; null falls back to 09:00 in gap computation. */
          work_start: string | null
          /** Work window end; null falls back to 19:00 in gap computation. */
          work_end: string | null
        }
        Insert: {
          id?: string
          user_id: string
          day_of_week: number
          available_hours?: number
          is_available?: boolean
          notes?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          day_of_week?: number
          available_hours?: number
          is_available?: boolean
          notes?: string | null
        }
      }
      template_blocks: {
        Row: {
          id: string
          user_id: string
          project_id: string
          day_of_week: number
          slot: 'morning' | 'afternoon' | 'full'
          hours: number
          position: number
          gcal_event_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id: string
          day_of_week: number
          slot?: 'morning' | 'afternoon' | 'full'
          hours: number
          position?: number
          gcal_event_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string
          day_of_week?: number
          slot?: 'morning' | 'afternoon' | 'full'
          hours?: number
          position?: number
          gcal_event_id?: string | null
          created_at?: string
        }
      }
      weekly_snapshots: {
        Row: {
          id: string
          user_id: string
          week_start: string
          planned_hours: Record<string, number>
          actual_hours: Record<string, number>
          blocks_completed: number
          blocks_skipped: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          week_start: string
          planned_hours?: Record<string, number>
          actual_hours?: Record<string, number>
          blocks_completed?: number
          blocks_skipped?: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          week_start?: string
          planned_hours?: Record<string, number>
          actual_hours?: Record<string, number>
          blocks_completed?: number
          blocks_skipped?: number
          notes?: string | null
          created_at?: string
        }
      }
      project_metrics: {
        Row: {
          id: string
          user_id: string
          project_id: string
          name: string
          type: 'currency' | 'number' | 'percentage'
          goal: number | null
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id: string
          name: string
          type?: 'currency' | 'number' | 'percentage'
          goal?: number | null
          position?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string
          name?: string
          type?: 'currency' | 'number' | 'percentage'
          goal?: number | null
          position?: number
          created_at?: string
        }
      }
      project_metric_entries: {
        Row: {
          id: string
          user_id: string
          metric_id: string
          value: number
          week_start: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          metric_id: string
          value: number
          week_start: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          metric_id?: string
          value?: number
          week_start?: string
          created_at?: string
        }
      }
      agent_conversations: {
        Row: {
          id: string
          user_id: string
          messages: Array<{ role: string; content: string; timestamp: string }>
          context_type: 'general' | 'template_generation' | 'rebalance' | 'review_insights'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          messages?: Array<{ role: string; content: string; timestamp: string }>
          context_type?: 'general' | 'template_generation' | 'rebalance' | 'review_insights'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          messages?: Array<{ role: string; content: string; timestamp: string }>
          context_type?: 'general' | 'template_generation' | 'rebalance' | 'review_insights'
          created_at?: string
          updated_at?: string
        }
      }
      agent_settings: {
        Row: {
          id: string
          user_id: string
          enabled: boolean
          auto_rebalance: boolean
          weekly_digest: boolean
          personality: 'concise' | 'balanced' | 'detailed'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          enabled?: boolean
          auto_rebalance?: boolean
          weekly_digest?: boolean
          personality?: 'concise' | 'balanced' | 'detailed'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          enabled?: boolean
          auto_rebalance?: boolean
          weekly_digest?: boolean
          personality?: 'concise' | 'balanced' | 'detailed'
          created_at?: string
        }
      }
      google_calendar_tokens: {
        Row: {
          id: string
          user_id: string
          access_token: string
          refresh_token: string
          expires_at: string
          calendar_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          access_token: string
          refresh_token: string
          expires_at: string
          calendar_id?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          access_token?: string
          refresh_token?: string
          expires_at?: string
          calendar_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      // ---------------------------------------------------------------
      // v3 — calendar-driven daily planning (migration 004)
      // ---------------------------------------------------------------
      calendar_connections: {
        Row: {
          id: string
          user_id: string
          provider: string
          /** AES-256-GCM ciphertext, never plaintext. See lib/calendar/crypto.ts */
          access_token: string
          /** AES-256-GCM ciphertext, never plaintext. See lib/calendar/crypto.ts */
          refresh_token: string
          expires_at: string
          calendar_ids: string[]
          timezone: string
          last_synced_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          provider?: string
          access_token: string
          refresh_token: string
          expires_at: string
          calendar_ids?: string[]
          timezone?: string
          last_synced_at?: string | null
        }
        Update: {
          access_token?: string
          refresh_token?: string
          expires_at?: string
          calendar_ids?: string[]
          timezone?: string
          last_synced_at?: string | null
        }
      }
      outcomes: {
        Row: {
          id: string
          user_id: string
          project_id: string | null
          title: string
          definition_of_done: string | null
          target_date: string | null
          status: 'active' | 'paused' | 'done' | 'abandoned'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id?: string | null
          title: string
          definition_of_done?: string | null
          target_date?: string | null
          status?: 'active' | 'paused' | 'done' | 'abandoned'
        }
        Update: {
          project_id?: string | null
          title?: string
          definition_of_done?: string | null
          target_date?: string | null
          status?: 'active' | 'paused' | 'done' | 'abandoned'
        }
      }
      daily_plans: {
        Row: {
          id: string
          user_id: string
          plan_date: string
          timezone: string
          calendar_snapshot: Json
          status: 'proposed' | 'accepted' | 'abandoned'
          /** 'week_draft' rows come from a Sunday planning pass and stay
           *  provisional until that morning's conversation accepts them. */
          origin: 'daily' | 'week_draft'
          /** Monday of the drafted week; set only on week_draft rows. */
          week_start: string | null
          accepted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan_date: string
          timezone: string
          calendar_snapshot?: Json
          status?: 'proposed' | 'accepted' | 'abandoned'
          origin?: 'daily' | 'week_draft'
          week_start?: string | null
          accepted_at?: string | null
        }
        Update: {
          calendar_snapshot?: Json
          status?: 'proposed' | 'accepted' | 'abandoned'
          origin?: 'daily' | 'week_draft'
          week_start?: string | null
          accepted_at?: string | null
        }
      }
      plan_blocks: {
        Row: {
          id: string
          user_id: string
          plan_id: string
          outcome_id: string | null
          project_id: string | null
          /** A finished artifact, never a project label. */
          deliverable: string
          rationale: string | null
          starts_at: string
          ends_at: string
          position: number
          status: 'planned' | 'done' | 'partial' | 'skipped'
          resolved_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan_id: string
          outcome_id?: string | null
          project_id?: string | null
          deliverable: string
          rationale?: string | null
          starts_at: string
          ends_at: string
          position?: number
          status?: 'planned' | 'done' | 'partial' | 'skipped'
          resolved_at?: string | null
        }
        Update: {
          outcome_id?: string | null
          project_id?: string | null
          deliverable?: string
          rationale?: string | null
          starts_at?: string
          ends_at?: string
          position?: number
          status?: 'planned' | 'done' | 'partial' | 'skipped'
          resolved_at?: string | null
        }
      }
      agent_messages: {
        Row: {
          id: string
          user_id: string
          role: 'user' | 'assistant'
          /** Anthropic content blocks (text / tool_use / tool_result),
           *  stored verbatim so the thread can be replayed exactly. */
          content: Json
          plan_date: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role: 'user' | 'assistant'
          content: Json
          plan_date?: string | null
        }
        Update: {
          content?: Json
          plan_date?: string | null
        }
      }
      agent_usage: {
        Row: {
          id: string
          user_id: string
          usage_date: string
          turns: number
          input_tokens: number
          output_tokens: number
        }
        Insert: {
          id?: string
          user_id: string
          usage_date: string
          turns?: number
          input_tokens?: number
          output_tokens?: number
        }
        Update: {
          turns?: number
          input_tokens?: number
          output_tokens?: number
        }
      }
      session_events: {
        Row: {
          id: string
          user_id: string
          event: string
          event_date: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          event: string
          event_date: string
          metadata?: Json
        }
        Update: {
          metadata?: Json
        }
      }
    }
  }
}

// Convenience types
export type User = Database['public']['Tables']['users']['Row']
export type Goal = Database['public']['Tables']['goals']['Row']
export type Project = Database['public']['Tables']['projects']['Row']
export type Task = Database['public']['Tables']['tasks']['Row']
export type TimeLog = Database['public']['Tables']['time_logs']['Row']
export type DailyCompletion = Database['public']['Tables']['daily_completions']['Row']
export type ScheduleConstraint = Database['public']['Tables']['schedule_constraints']['Row']
export type TemplateBlock = Database['public']['Tables']['template_blocks']['Row']
export type WeeklySnapshot = Database['public']['Tables']['weekly_snapshots']['Row']
export type ProjectMetric = Database['public']['Tables']['project_metrics']['Row']
export type ProjectMetricEntry = Database['public']['Tables']['project_metric_entries']['Row']
export type GoogleCalendarToken = Database['public']['Tables']['google_calendar_tokens']['Row']
export type AgentConversation = Database['public']['Tables']['agent_conversations']['Row']
export type AgentSettings = Database['public']['Tables']['agent_settings']['Row']

// v3 convenience types
export type CalendarConnection = Database['public']['Tables']['calendar_connections']['Row']
export type Outcome = Database['public']['Tables']['outcomes']['Row']
export type DailyPlan = Database['public']['Tables']['daily_plans']['Row']
export type PlanBlock = Database['public']['Tables']['plan_blocks']['Row']
export type AgentMessage = Database['public']['Tables']['agent_messages']['Row']
export type AgentUsage = Database['public']['Tables']['agent_usage']['Row']
export type SessionEvent = Database['public']['Tables']['session_events']['Row']
