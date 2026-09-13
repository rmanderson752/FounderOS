// src/lib/planner/rechain.ts
//
// Re-date the ladder from observed pace. Pure.
//
// Milestones are an ordered list. Walking forward from now, each open
// milestone's expected_by is when its cumulative remaining minutes are worked
// off at the observed pace. Nothing is ever red: if the last date is past the
// target, the caller shows the projected date in grey next to the target and
// offers the three levers (move the date, cut a milestone, raise the share).

import { addDays, format } from 'date-fns'
import type { PlannerMilestone } from './types'

export interface RechainInput {
  milestones: PlannerMilestone[]
  paceMinutesPerWeek: number
  now: Date
}

export interface RechainedMilestone {
  id: string
  /** `yyyy-MM-dd`, or null when there is no pace to project from. */
  expectedBy: string | null
}

export function rechainDates(input: RechainInput): RechainedMilestone[] {
  const ordered = [...input.milestones].sort((a, b) => a.position - b.position)
  const out: RechainedMilestone[] = []
  let cumulative = 0

  for (const m of ordered) {
    if (m.status === 'done' || m.status === 'skipped') {
      out.push({ id: m.id, expectedBy: null })
      continue
    }
    if (input.paceMinutesPerWeek <= 0) {
      out.push({ id: m.id, expectedBy: null })
      continue
    }
    cumulative += m.estimatedMinutes
    const days = Math.ceil((cumulative / input.paceMinutesPerWeek) * 7)
    out.push({ id: m.id, expectedBy: format(addDays(input.now, days), 'yyyy-MM-dd') })
  }

  return out
}

/**
 * Pick this week's rocks: the first open milestone of each of the top-scored
 * outcomes, at most `max`. Called on Sunday with outcomes already ranked.
 */
export function pickRocks(
  rankedOutcomeIds: string[],
  milestones: PlannerMilestone[],
  max = 3
): string[] {
  const rocks: string[] = []
  for (const outcomeId of rankedOutcomeIds) {
    if (rocks.length >= max) break
    const first = milestones
      .filter((m) => m.outcomeId === outcomeId && m.status !== 'done' && m.status !== 'skipped')
      .sort((a, b) => a.position - b.position)[0]
    if (first) rocks.push(first.id)
  }
  return rocks
}
