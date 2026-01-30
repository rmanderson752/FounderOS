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
      tasks: {
        Row: {
          id: string
          user_id: string
          goal_id: string | null
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
          started_at: string
          ended_at: string | null
          duration_minutes: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          task_id: string
          started_at: string
          ended_at?: string | null
          duration_minutes?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          task_id?: string
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
    }
  }
}

// Convenience types
export type User = Database['public']['Tables']['users']['Row']
export type Goal = Database['public']['Tables']['goals']['Row']
export type Task = Database['public']['Tables']['tasks']['Row']
export type TimeLog = Database['public']['Tables']['time_logs']['Row']
export type DailyCompletion = Database['public']['Tables']['daily_completions']['Row']
