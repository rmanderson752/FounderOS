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
