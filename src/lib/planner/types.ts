// src/lib/planner/types.ts
//
// Shapes the pure planner functions operate on. They are deliberately
// decoupled from the Database row types so the planner can be unit tested
// with hand-built fixtures and never imports Supabase.

import type { TimeInterval } from '@/lib/calendar/types'

export interface PlannerProject {
  id: string
  name: string
  weight: number
  paused: boolean
}

export interface PlannerOutcome {
  id: string
  title: string
  projectId: string | null
  projectName: string | null
  /** 1–3. The only prioritisation input the user sets. */
  weight: number
  /** `yyyy-MM-dd` or null. */
  targetDate: string | null
  status: 'active' | 'paused' | 'done' | 'abandoned'
}

export interface Candidate {
  deliverable: string
  estimated_minutes: number
  expected_paths: string[]
}

export interface PlannerMilestone {
  id: string
  outcomeId: string
  title: string
  estimatedMinutes: number
  position: number
  status: 'pending' | 'active' | 'done' | 'skipped'
  /** Monday (`yyyy-MM-dd`) of the week this is a rock for, or null. */
  focusWeek: string | null
  candidates: Candidate[]
}

export interface PlannerSignal {
  id: string
  projectId: string | null
  source: 'git' | 'session' | 'fs' | 'manual' | 'deploy'
  occurredAt: Date
  paths: string[]
  summary: string
  /** Sessions carry a duration; commits do not. */
  durationMinutes: number | null
}

export interface PlannerBlock {
  id: string
  projectId: string | null
  startsAt: Date
  endsAt: Date
  deliverable: string
  expectedPaths: string[]
}

/** The window a card is sized to: [start, end) and whether it is now or next. */
export interface CardWindow extends TimeInterval {
  kind: 'now' | 'next'
  minutes: number
}

export type BlockResolution = 'done' | 'partial' | 'unobserved'
