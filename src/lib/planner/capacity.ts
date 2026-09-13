// src/lib/planner/capacity.ts
//
// Feasibility is arithmetic, not vibes. Pure.
//
// Observed pace is minutes of work per week per project, read from session
// signals (which carry a duration). Where a project has commits but no
// session data yet, each commit is worth a conservative 30 minutes so a
// git-only week still registers. Calendar free minutes are an upper bound,
// never the rate — a free afternoon is not a worked afternoon.

import { addDays } from 'date-fns'
import type { PlannerMilestone, PlannerSignal } from './types'

export const MINUTES_PER_COMMIT_FALLBACK = 30

export interface PaceInput {
  signals: PlannerSignal[]
  now: Date
  weeks?: number
}

/** Minutes per week, per project id. Projects with no signals are absent. */
export function observedPace(input: PaceInput): Record<string, number> {
  const weeks = input.weeks ?? 4
  const since = input.now.getTime() - weeks * 7 * 86_400_000

  const sessionMinutes: Record<string, number> = {}
  const commitCounts: Record<string, number> = {}

  for (const s of input.signals) {
    if (!s.projectId || s.occurredAt.getTime() < since) continue
    if (s.source === 'session' && s.durationMinutes) {
      sessionMinutes[s.projectId] = (sessionMinutes[s.projectId] ?? 0) + s.durationMinutes
    } else if (s.source === 'git') {
      commitCounts[s.projectId] = (commitCounts[s.projectId] ?? 0) + 1
    }
  }

  const pace: Record<string, number> = {}
  const projectIds = new Set([...Object.keys(sessionMinutes), ...Object.keys(commitCounts)])
  for (const id of Array.from(projectIds)) {
    const minutes = sessionMinutes[id] ?? (commitCounts[id] ?? 0) * MINUTES_PER_COMMIT_FALLBACK
    pace[id] = Math.round(minutes / weeks)
  }
  return pace
}

/** Minutes still to do across the open milestones of an outcome. */
export function remainingMinutes(milestones: PlannerMilestone[]): number {
  return milestones
    .filter((m) => m.status !== 'done' && m.status !== 'skipped')
    .reduce((sum, m) => sum + m.estimatedMinutes, 0)
}

/**
 * When the remaining work lands at the observed pace, or null if there is no
 * pace to project from. Never red: a slipping goal is a grey projected date.
 */
export function projectedCompletion(
  remaining: number,
  paceMinutesPerWeek: number,
  from: Date
): Date | null {
  if (paceMinutesPerWeek <= 0) return null
  if (remaining <= 0) return from
  const weeks = remaining / paceMinutesPerWeek
  return addDays(from, Math.ceil(weeks * 7))
}

export interface PaceLineInput {
  remaining: number
  paceMinutesPerWeek: number
  targetDate: string | null
  now: Date
  formatDate: (d: Date) => string
}

/**
 * The card's "Pace" line. Examples:
 *   needs ~22h; at ~5h/wk that lands Oct 30, target Oct 24.
 *   needs ~22h; no pace observed yet.
 */
export function paceLine(input: PaceLineInput): string {
  const hours = Math.round(input.remaining / 60)
  const need = `needs ~${hours}h`
  if (input.paceMinutesPerWeek <= 0) return `${need}; no pace observed yet.`

  const paceHours = Math.round((input.paceMinutesPerWeek / 60) * 10) / 10
  const lands = projectedCompletion(input.remaining, input.paceMinutesPerWeek, input.now)
  const landsText = lands ? input.formatDate(lands) : '?'

  if (!input.targetDate) return `${need}; at ~${paceHours}h/wk that lands ${landsText}.`

  const target = input.formatDate(new Date(`${input.targetDate}T12:00:00Z`))
  return `${need}; at ~${paceHours}h/wk that lands ${landsText}, target ${target}.`
}
