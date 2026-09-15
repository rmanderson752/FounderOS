/** plan_blocks.status. 'unobserved' means no evidence arrived; it is never 'skipped' by default. */
export type BlockStatus = 'planned' | 'done' | 'partial' | 'skipped' | 'unobserved'
/** plan_blocks.kind. 'goal' is work toward a milestone; the rest come from commitments. */
export type BlockKind = 'goal' | 'flexible' | 'fixed' | 'habit' | 'chore' | 'free'
export type BlockSource = 'planner' | 'card' | 'user' | 'agent'
/** outcomes.status. 'draft' exists from the first message of a goal thread until the ladder is accepted. */
export type OutcomeStatus = 'draft' | 'active' | 'paused' | 'done' | 'abandoned'
export type CommitmentKind = 'flexible' | 'fixed' | 'habit' | 'chore'
export type ChainRole = 'rise' | 'work' | 'live' | 'winddown' | 'custom'
export type ChainAnchor = 'trigger' | 'after_previous' | 'clock' | 'before_bed'
export type ChainLinkKind = 'habit' | 'fixed' | 'flexible' | 'goal' | 'chore' | 'free'
export type ChainRunStatus = 'planned' | 'active' | 'done' | 'abandoned'

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
          // v4 (migration 005)
          /** SHA-256 of the CLI/hook bearer token. Plaintext is never stored. */
          hook_token_hash: string | null
          /** IANA zone. Falls back to the calendar connection's zone, then America/New_York. */
          timezone: string | null
          wake_time: string | null
          bed_time: string | null
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
          hook_token_hash?: string | null
          timezone?: string | null
          wake_time?: string | null
          bed_time?: string | null
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
          hook_token_hash?: string | null
          timezone?: string | null
          wake_time?: string | null
          bed_time?: string | null
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
          // v4 (migration 005)
          /** Absolute path of the git repo on the user's machine, for signal attribution. */
          repo_path: string | null
          folder_paths: string[]
          kind: 'code' | 'docs' | 'life'
          weight: number
          paused: boolean
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
          repo_path?: string | null
          folder_paths?: string[]
          kind?: 'code' | 'docs' | 'life'
          weight?: number
          paused?: boolean
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
          repo_path?: string | null
          folder_paths?: string[]
          kind?: 'code' | 'docs' | 'life'
          weight?: number
          paused?: boolean
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
          status: OutcomeStatus
          created_at: string
          updated_at: string
          // v4 (migration 005)
          /** 1–3. The only prioritisation input the user ever sets. */
          weight: number
          decomposition_version: number
          assumptions: string[]
        }
        Insert: {
          id?: string
          user_id: string
          project_id?: string | null
          title: string
          definition_of_done?: string | null
          target_date?: string | null
          status?: OutcomeStatus
          weight?: number
          decomposition_version?: number
          assumptions?: string[]
        }
        Update: {
          project_id?: string | null
          title?: string
          definition_of_done?: string | null
          target_date?: string | null
          status?: OutcomeStatus
          weight?: number
          decomposition_version?: number
          assumptions?: string[]
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
          status: BlockStatus
          resolved_at: string | null
          created_at: string
          // v4 (migration 005)
          milestone_id: string | null
          expected_paths: string[]
          resolved_by: 'observed' | 'user' | 'cron' | null
          confidence: number | null
          evidence_signal_ids: string[]
          /** The selection terms that chose this outcome, so the card can explain itself. */
          selection: Json
          start_command: string | null
          // v4 second pass (migration 006)
          kind: BlockKind
          commitment_id: string | null
          locked: boolean
          source: BlockSource
          chain_run_id: string | null
          chain_link_id: string | null
          link_position: number | null
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
          status?: BlockStatus
          resolved_at?: string | null
          milestone_id?: string | null
          expected_paths?: string[]
          resolved_by?: 'observed' | 'user' | 'cron' | null
          confidence?: number | null
          evidence_signal_ids?: string[]
          selection?: Json
          start_command?: string | null
          kind?: BlockKind
          commitment_id?: string | null
          locked?: boolean
          source?: BlockSource
          chain_run_id?: string | null
          chain_link_id?: string | null
          link_position?: number | null
        }
        Update: {
          outcome_id?: string | null
          project_id?: string | null
          deliverable?: string
          rationale?: string | null
          starts_at?: string
          ends_at?: string
          position?: number
          status?: BlockStatus
          resolved_at?: string | null
          milestone_id?: string | null
          expected_paths?: string[]
          resolved_by?: 'observed' | 'user' | 'cron' | null
          confidence?: number | null
          evidence_signal_ids?: string[]
          selection?: Json
          start_command?: string | null
          kind?: BlockKind
          commitment_id?: string | null
          locked?: boolean
          source?: BlockSource
          chain_run_id?: string | null
          chain_link_id?: string | null
          link_position?: number | null
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
          outcome_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role: 'user' | 'assistant'
          content: Json
          plan_date?: string | null
          outcome_id?: string | null
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
          cache_read_tokens: number
          cache_write_tokens: number
          usd: number
        }
        Insert: {
          id?: string
          user_id: string
          usage_date: string
          turns?: number
          input_tokens?: number
          output_tokens?: number
          cache_read_tokens?: number
          cache_write_tokens?: number
          usd?: number
        }
        Update: {
          turns?: number
          input_tokens?: number
          output_tokens?: number
          cache_read_tokens?: number
          cache_write_tokens?: number
          usd?: number
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
          trace_id: string | null
          usd: number | null
          latency_ms: number | null
        }
        Insert: {
          id?: string
          user_id: string
          event: string
          event_date: string
          metadata?: Json
          trace_id?: string | null
          usd?: number | null
          latency_ms?: number | null
        }
        Update: {
          metadata?: Json
        }
      }
      // ---------------------------------------------------------------
      // v4 — the Start Card (migration 005)
      // ---------------------------------------------------------------
      milestones: {
        Row: {
          id: string
          user_id: string
          outcome_id: string
          title: string
          definition_of_done: string | null
          estimated_minutes: number
          position: number
          status: 'pending' | 'active' | 'done' | 'skipped'
          expected_by: string | null
          focus_week: string | null
          /** [{ deliverable, estimated_minutes, expected_paths }] */
          candidates: Json
          /** Commit hashes / notes showing this was done before the goal was stated. */
          already_done_evidence: Json
          created_by: 'model' | 'user'
          decomposition_version: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          outcome_id: string
          title: string
          definition_of_done?: string | null
          estimated_minutes?: number
          position?: number
          status?: 'pending' | 'active' | 'done' | 'skipped'
          expected_by?: string | null
          focus_week?: string | null
          candidates?: Json
          already_done_evidence?: Json
          created_by?: 'model' | 'user'
          decomposition_version?: number
        }
        Update: {
          title?: string
          definition_of_done?: string | null
          estimated_minutes?: number
          position?: number
          status?: 'pending' | 'active' | 'done' | 'skipped'
          expected_by?: string | null
          focus_week?: string | null
          candidates?: Json
          already_done_evidence?: Json
          decomposition_version?: number
        }
      }
      signals: {
        Row: {
          id: string
          user_id: string
          project_id: string | null
          source: 'git' | 'session' | 'fs' | 'manual' | 'deploy' | 'crm'
          kind: string
          summary: string
          paths: string[]
          occurred_at: string
          duration_minutes: number | null
          external_id: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id?: string | null
          source: 'git' | 'session' | 'fs' | 'manual' | 'deploy' | 'crm'
          kind: string
          summary?: string
          paths?: string[]
          occurred_at: string
          duration_minutes?: number | null
          external_id?: string | null
          metadata?: Json
        }
        Update: {
          project_id?: string | null
          summary?: string
          metadata?: Json
        }
      }
      commitments: {
        Row: {
          id: string
          user_id: string
          project_id: string | null
          outcome_id: string | null
          title: string
          kind: CommitmentKind
          /** 0 = Sunday … 6 = Saturday. Empty for chores. */
          days_of_week: number[]
          duration_minutes: number
          fixed_start: string | null
          fixed_end: string | null
          due_date: string | null
          active: boolean
          notes: string | null
          created_at: string
          updated_at: string
          external_id: string | null
          integration_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          project_id?: string | null
          outcome_id?: string | null
          title: string
          kind: CommitmentKind
          external_id?: string | null
          integration_id?: string | null
          days_of_week?: number[]
          duration_minutes?: number
          fixed_start?: string | null
          fixed_end?: string | null
          due_date?: string | null
          active?: boolean
          notes?: string | null
        }
        Update: {
          project_id?: string | null
          outcome_id?: string | null
          title?: string
          kind?: CommitmentKind
          days_of_week?: number[]
          duration_minutes?: number
          fixed_start?: string | null
          fixed_end?: string | null
          due_date?: string | null
          active?: boolean
          notes?: string | null
        }
      }
      chains: {
        Row: {
          id: string
          user_id: string
          name: string
          role: ChainRole
          position: number
          anchor_kind: ChainAnchor
          anchor_time: string | null
          target_minutes: number | null
          days_of_week: number[]
          plannable: boolean
          protected: boolean
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          role?: ChainRole
          position?: number
          anchor_kind?: ChainAnchor
          anchor_time?: string | null
          target_minutes?: number | null
          days_of_week?: number[]
          plannable?: boolean
          protected?: boolean
          active?: boolean
        }
        Update: {
          name?: string
          role?: ChainRole
          position?: number
          anchor_kind?: ChainAnchor
          anchor_time?: string | null
          target_minutes?: number | null
          days_of_week?: number[]
          plannable?: boolean
          protected?: boolean
          active?: boolean
        }
      }
      chain_links: {
        Row: {
          id: string
          user_id: string
          chain_id: string
          position: number
          title: string
          kind: ChainLinkKind
          duration_minutes: number
          commitment_id: string | null
          days_of_week: number[] | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          chain_id: string
          position?: number
          title: string
          kind?: ChainLinkKind
          duration_minutes?: number
          commitment_id?: string | null
          days_of_week?: number[] | null
          active?: boolean
        }
        Update: {
          position?: number
          title?: string
          kind?: ChainLinkKind
          duration_minutes?: number
          commitment_id?: string | null
          days_of_week?: number[] | null
          active?: boolean
        }
      }
      chain_runs: {
        Row: {
          id: string
          user_id: string
          chain_id: string
          run_date: string
          anchor_at: string
          started_at: string | null
          completed_at: string | null
          current_position: number
          status: ChainRunStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          chain_id: string
          run_date: string
          anchor_at: string
          started_at?: string | null
          completed_at?: string | null
          current_position?: number
          status?: ChainRunStatus
        }
        Update: {
          anchor_at?: string
          started_at?: string | null
          completed_at?: string | null
          current_position?: number
          status?: ChainRunStatus
        }
      }
      integrations: {
        Row: {
          id: string
          user_id: string
          kind: 'webhook' | 'hubspot' | 'attio' | 'pipedrive' | 'notion' | 'zapier'
          name: string
          /** SHA-256 of the URL token; plaintext shown once. */
          token_hash: string
          project_id: string | null
          config: Json
          active: boolean
          events_received: number
          last_event_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          kind?: 'webhook' | 'hubspot' | 'attio' | 'pipedrive' | 'notion' | 'zapier'
          name: string
          token_hash: string
          project_id?: string | null
          config?: Json
          active?: boolean
        }
        Update: {
          name?: string
          project_id?: string | null
          config?: Json
          active?: boolean
          events_received?: number
          last_event_at?: string | null
        }
      }
      resolution_corrections: {
        Row: {
          id: string
          user_id: string
          block_id: string
          from_status: string
          to_status: string
          from_confidence: number | null
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          block_id: string
          from_status: string
          to_status: string
          from_confidence?: number | null
          note?: string | null
        }
        Update: {
          note?: string | null
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

// v4 convenience types
export type Milestone = Database['public']['Tables']['milestones']['Row']
export type Signal = Database['public']['Tables']['signals']['Row']
export type ResolutionCorrection = Database['public']['Tables']['resolution_corrections']['Row']
export type Commitment = Database['public']['Tables']['commitments']['Row']
export type Integration = Database['public']['Tables']['integrations']['Row']
export type Chain = Database['public']['Tables']['chains']['Row']
export type ChainLink = Database['public']['Tables']['chain_links']['Row']
export type ChainRun = Database['public']['Tables']['chain_runs']['Row']
