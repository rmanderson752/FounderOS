// src/lib/planner/select.ts
//
// Which outcome gets the card. Pure and deterministic: the model is told the
// project, it never chooses it. Every term is returned so the card can print
// why, and so a disagreement with the directory the user opened can be stated
// in one line.
//
//   score = weight × urgency × momentum × staleness × rock × cwd
//
// weight     1–3, set by the user on the outcome. The only manual input.
// urgency    1 + pressure, where pressure is remaining minutes per day left
//            until the target against a two-hour-a-day baseline, capped at 2.
//            A target date can only raise priority, never lower it; an undated
//            outcome sits at 1.
// momentum   signals on the project in the last 3 days. Bursts are rewarded,
//            not penalised — that is how this user works.
// staleness  a mild boost after 5 quiet days so nothing silently drops out.
// rock       a milestone flagged for this week.
// cwd        the terminal was opened in this project's repo.

import type { PlannerMilestone, PlannerOutcome, PlannerSignal } from './types'

export interface SelectionTerms {
  weight: number
  urgency: number
  momentum: number
  staleness: number
  rock: number
  cwd: number
  remainingMinutes: number
  daysLeft: number | null
  signalsLast3Days: number
  daysSinceLastSignal: number | null
}

export interface ScoredOutcome {
  outcome: PlannerOutcome
  score: number
  terms: SelectionTerms
  /** The first not-done milestone, in position order, if any. */
  activeMilestone: PlannerMilestone | null
}

export interface SelectInput {
  outcomes: PlannerOutcome[]
  milestones: PlannerMilestone[]
  signals: PlannerSignal[]
  now: Date
  /**
   * Today as `yyyy-MM-dd` in the user's timezone. Passed in rather than
   * derived so the planner never depends on the server's clock or zone.
   */
  today: string
  /** Project id the user's terminal was opened in, if known. */
  cwdProjectId?: string | null
  /** Monday of the current week, `yyyy-MM-dd`, for rock detection. */
  weekStart?: string | null
}

const BASELINE_MINUTES_PER_DAY = 120
const DEFAULT_REMAINING_MINUTES = 120

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}

/** Whole days from `today` to `target`, both `yyyy-MM-dd`; zone-free. */
export function daysBetween(today: string, target: string): number {
  return Math.round((Date.parse(`${target}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
}

export function activeMilestoneFor(
  outcomeId: string,
  milestones: PlannerMilestone[]
): PlannerMilestone | null {
  return (
    milestones
      .filter((m) => m.outcomeId === outcomeId && m.status !== 'done' && m.status !== 'skipped')
      .sort((a, b) => a.position - b.position)[0] ?? null
  )
}

export function remainingMinutesFor(outcomeId: string, milestones: PlannerMilestone[]): number {
  const open = milestones.filter(
    (m) => m.outcomeId === outcomeId && m.status !== 'done' && m.status !== 'skipped'
  )
  if (open.length === 0) return DEFAULT_REMAINING_MINUTES
  return open.reduce((sum, m) => sum + m.estimatedMinutes, 0)
}

export function scoreOutcomes(input: SelectInput): ScoredOutcome[] {
  const now = input.now.getTime()
  const threeDaysAgo = now - 3 * 86_400_000

  const scored = input.outcomes
    .filter((o) => o.status === 'active')
    .map((outcome) => {
      const projectSignals = outcome.projectId
        ? input.signals.filter((s) => s.projectId === outcome.projectId)
        : []

      const remainingMinutes = remainingMinutesFor(outcome.id, input.milestones)

      let daysLeft: number | null = null
      let urgency = 1
      if (outcome.targetDate) {
        daysLeft = Math.max(1, daysBetween(input.today, outcome.targetDate))
        const needPerDay = remainingMinutes / daysLeft
        urgency = 1 + Math.min(2, needPerDay / BASELINE_MINUTES_PER_DAY)
      }

      const signalsLast3Days = projectSignals.filter((s) => s.occurredAt.getTime() >= threeDaysAgo).length
      const momentum = signalsLast3Days === 0 ? 0.8 : signalsLast3Days < 3 ? 1 : 1.2

      const last = projectSignals.reduce<number | null>(
        (acc, s) => (acc === null || s.occurredAt.getTime() > acc ? s.occurredAt.getTime() : acc),
        null
      )
      const daysSinceLastSignal = last === null ? null : Math.floor((now - last) / 86_400_000)
      const staleness = daysSinceLastSignal === null ? 1.05 : daysSinceLastSignal > 5 ? 1.15 : 1

      const activeMilestone = activeMilestoneFor(outcome.id, input.milestones)
      const isRock =
        !!input.weekStart &&
        input.milestones.some(
          (m) => m.outcomeId === outcome.id && m.focusWeek === input.weekStart && m.status !== 'done'
        )
      const rock = isRock ? 1.5 : 1

      const cwd = input.cwdProjectId && outcome.projectId === input.cwdProjectId ? 1.3 : 1

      const score = outcome.weight * urgency * momentum * staleness * rock * cwd

      return {
        outcome,
        score: round(score),
        activeMilestone,
        terms: {
          weight: outcome.weight,
          urgency: round(urgency),
          momentum,
          staleness,
          rock,
          cwd,
          remainingMinutes,
          daysLeft,
          signalsLast3Days,
          daysSinceLastSignal,
        },
      }
    })

  // Ties break on title so the order is stable across runs.
  return scored.sort((a, b) => b.score - a.score || a.outcome.title.localeCompare(b.outcome.title))
}

/**
 * One line explaining why the top outcome beat the one the user opened, or
 * null when they agree (or there is nothing to compare).
 */
export function disagreementLine(
  ranked: ScoredOutcome[],
  cwdProjectId: string | null | undefined
): string | null {
  if (!cwdProjectId || ranked.length < 2) return null
  const top = ranked[0]
  if (top.outcome.projectId === cwdProjectId) return null

  const reasons: string[] = []
  if (top.terms.rock > 1) reasons.push('rock this week')
  if (top.terms.staleness > 1) reasons.push(`${top.terms.daysSinceLastSignal} days stale`)
  if (top.terms.urgency > 1.2 && top.terms.daysLeft !== null) reasons.push(`${top.terms.daysLeft} days to target`)
  const why = reasons.length ? ` (${reasons.join(', ')})` : ''
  return `${top.outcome.projectName ?? top.outcome.title} scores higher today${why}.`
}
