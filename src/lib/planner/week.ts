// src/lib/planner/week.ts
//
// Lay the week out. Pure: every input is passed in, nothing is sampled.
//
// Per day, in order:
//   1. fixed commitments      placed exactly at their time, like events
//   2. habits                 at the start of the first gap that fits, so
//                             they never eat the main block
//   3. chores                 once, on the earliest day before the due date
//   4. the goal block         one per day: the top-ranked outcome (rotating
//                             so second-ranked goals still get days), its
//                             active milestone's next unused candidate, in
//                             the largest remaining gap, capped at 180 min
//   5. flexible commitments   in the largest remaining gap that fits
//
// Whitespace is deliberate: optional blocks stop once ~60% of a day's free
// time is planned. Blocks the user moved (locked) and blocks already
// resolved are subtracted first and never touched.
//
// Deliverables come from candidates the user accepted in the goal
// conversation — the week draft never invents work; it only schedules it.

import { fromZonedTime } from 'date-fns-tz'
import type { TimeInterval } from '@/lib/calendar/types'
import { MAX_WINDOW_MINUTES, MIN_WINDOW_MINUTES } from './window'
import { scoreOutcomes } from './select'
import type { PlannerMilestone, PlannerOutcome, PlannerSignal } from './types'

export type CommitmentKind = 'flexible' | 'fixed' | 'habit' | 'chore'

export interface PlannerCommitment {
  id: string
  title: string
  kind: CommitmentKind
  daysOfWeek: number[]
  durationMinutes: number
  /** `HH:mm`, fixed only. */
  fixedStart: string | null
  fixedEnd: string | null
  /** `yyyy-MM-dd`, chores only. */
  dueDate: string | null
  projectId: string | null
  outcomeId: string | null
}

export interface WeekDay {
  /** `yyyy-MM-dd` in the user's zone. */
  date: string
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number
  workWindow: TimeInterval
  /** Free gaps after calendar events; today's are already trimmed to now. */
  gaps: TimeInterval[]
}

export interface KeptBlock extends TimeInterval {
  id: string
  date: string
  kind: 'goal' | CommitmentKind
  commitmentId: string | null
  outcomeId?: string | null
  /** Deliverable text, used to avoid scheduling the same candidate twice. */
  title: string
}

export interface PlannedBlock extends TimeInterval {
  date: string
  kind: 'goal' | CommitmentKind
  title: string
  commitmentId: string | null
  outcomeId: string | null
  milestoneId: string | null
  projectId: string | null
  rationale: string | null
  expectedPaths: string[]
}

export interface WeekPlanInput {
  days: WeekDay[]
  timeZone: string
  today: string
  now: Date
  commitments: PlannerCommitment[]
  outcomes: PlannerOutcome[]
  milestones: PlannerMilestone[]
  signals: PlannerSignal[]
  /** Blocks that stay: locked, resolved, or in the past. Subtracted, never moved. */
  kept: KeptBlock[]
  /** Fraction of free time optional blocks may fill. Goal blocks ignore it. */
  fillRatio?: number
}

export interface WeekPlan {
  blocks: PlannedBlock[]
  notes: string[]
}

const DEFAULT_FILL_RATIO = 0.6
const ROTATION_DECAY = 0.7

function minutes(i: TimeInterval): number {
  return (i.end.getTime() - i.start.getTime()) / 60_000
}

/** Remove `busy` from `free`. Both lists are half-open intervals. */
export function subtractIntervals(free: TimeInterval[], busy: TimeInterval[]): TimeInterval[] {
  let out = free.map((g) => ({ start: new Date(g.start), end: new Date(g.end) }))
  for (const b of busy) {
    const next: TimeInterval[] = []
    for (const g of out) {
      if (b.end <= g.start || b.start >= g.end) {
        next.push(g)
        continue
      }
      if (b.start > g.start) next.push({ start: g.start, end: new Date(b.start) })
      if (b.end < g.end) next.push({ start: new Date(b.end), end: g.end })
    }
    out = next
  }
  return out.filter((g) => minutes(g) >= 1).sort((a, b) => a.start.getTime() - b.start.getTime())
}

function largestGap(gaps: TimeInterval[], atLeast: number): TimeInterval | null {
  const fitting = gaps.filter((g) => minutes(g) >= atLeast)
  if (fitting.length === 0) return null
  return fitting.reduce((best, g) => (minutes(g) > minutes(best) ? g : best))
}

function firstGap(gaps: TimeInterval[], atLeast: number): TimeInterval | null {
  return gaps.find((g) => minutes(g) >= atLeast) ?? null
}

function place(gap: TimeInterval, mins: number): TimeInterval {
  return { start: new Date(gap.start), end: new Date(gap.start.getTime() + mins * 60_000) }
}

function zoned(date: string, time: string, timeZone: string): Date {
  const t = time.length === 5 ? `${time}:00` : time
  return fromZonedTime(`${date}T${t}`, timeZone)
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

export function planWeek(input: WeekPlanInput): WeekPlan {
  const fillRatio = input.fillRatio ?? DEFAULT_FILL_RATIO
  const blocks: PlannedBlock[] = []
  const notes: string[] = []

  const used = new Set(input.kept.filter((k) => k.kind === 'goal').map((k) => norm(k.title)))
  const choresPlaced = new Set(
    input.kept.filter((k) => k.kind === 'chore' && k.commitmentId).map((k) => k.commitmentId as string)
  )
  // Goal blocks already on the week (kept) count toward rotation, so an
  // outcome that owns today's block does not also win tomorrow by default.
  const assignedCount: Record<string, number> = {}
  for (const k of input.kept) {
    if (k.kind === 'goal' && k.outcomeId) assignedCount[k.outcomeId] = (assignedCount[k.outcomeId] ?? 0) + 1
  }

  // A commitment's weekly quota is its number of days. Kept blocks (moved by
  // the user, or already resolved) count toward it, wherever they landed —
  // moving Tuesday's outreach to Thursday must not conjure a second one.
  const quota: Record<string, number> = {}
  for (const c of input.commitments) {
    if (c.kind === 'chore') continue
    const keptForIt = input.kept.filter((k) => k.commitmentId === c.id).length
    quota[c.id] = Math.max(0, c.daysOfWeek.length - keptForIt)
  }
  const canPlace = (c: PlannerCommitment, keptToday: KeptBlock[]) =>
    (quota[c.id] ?? 0) > 0 && !keptToday.some((k) => k.commitmentId === c.id)
  const placed = (c: PlannerCommitment) => {
    quota[c.id] = (quota[c.id] ?? 1) - 1
  }

  const ranked = scoreOutcomes({
    outcomes: input.outcomes,
    milestones: input.milestones,
    signals: input.signals,
    now: input.now,
    today: input.today,
  })

  const lastDate = input.days[input.days.length - 1]?.date ?? input.today

  for (const day of input.days) {
    const keptToday = input.kept.filter((k) => k.date === day.date)
    let free = subtractIntervals(day.gaps, keptToday)
    const freeBudget = free.reduce((s, g) => s + minutes(g), 0)
    let planned = 0
    if (free.length === 0 && keptToday.length === 0) continue

    const take = (interval: TimeInterval) => {
      free = subtractIntervals(free, [interval])
      planned += minutes(interval)
    }
    const optionalRoomLeft = () => planned < freeBudget * fillRatio

    // 1. fixed commitments — exact times, regardless of gaps
    for (const c of input.commitments) {
      if (c.kind !== 'fixed' || !c.daysOfWeek.includes(day.weekday) || !c.fixedStart || !c.fixedEnd) continue
      if (!canPlace(c, keptToday)) continue
      const interval = { start: zoned(day.date, c.fixedStart, input.timeZone), end: zoned(day.date, c.fixedEnd, input.timeZone) }
      if (interval.end <= interval.start) continue
      if (day.date === input.today && interval.end <= input.now) {
        placed(c) // this occurrence is in the past; it still consumes the day's slot
        continue
      }
      blocks.push({ ...interval, date: day.date, kind: 'fixed', title: c.title, commitmentId: c.id, outcomeId: c.outcomeId, milestoneId: null, projectId: c.projectId, rationale: null, expectedPaths: [] })
      placed(c)
      free = subtractIntervals(free, [interval])
    }

    // 2. habits — start of the first gap that fits
    for (const c of input.commitments) {
      if (c.kind !== 'habit' || !c.daysOfWeek.includes(day.weekday)) continue
      if (!canPlace(c, keptToday)) continue
      const gap = firstGap(free, c.durationMinutes)
      if (!gap) {
        notes.push(`${day.date}: no room for habit "${c.title}"`)
        continue
      }
      const interval = place(gap, c.durationMinutes)
      blocks.push({ ...interval, date: day.date, kind: 'habit', title: c.title, commitmentId: c.id, outcomeId: c.outcomeId, milestoneId: null, projectId: c.projectId, rationale: null, expectedPaths: [] })
      placed(c)
      take(interval)
    }

    // 3. chores — once, on the earliest day on or before the due date
    for (const c of input.commitments) {
      if (c.kind !== 'chore' || choresPlaced.has(c.id)) continue
      if (c.dueDate && c.dueDate < day.date) {
        // Overdue: still place it, today.
      } else if (c.dueDate && c.dueDate > lastDate) {
        continue
      }
      const gap = firstGap(free, c.durationMinutes)
      if (!gap) continue
      const interval = place(gap, c.durationMinutes)
      blocks.push({ ...interval, date: day.date, kind: 'chore', title: c.title, commitmentId: c.id, outcomeId: c.outcomeId, milestoneId: null, projectId: c.projectId, rationale: c.dueDate ? `due ${c.dueDate}` : null, expectedPaths: [] })
      choresPlaced.add(c.id)
      take(interval)
    }

    // 4. the goal block — one per day, rotating across outcomes
    const hasGoalKept = keptToday.some((k) => k.kind === 'goal')
    if (!hasGoalKept && ranked.length > 0) {
      const gap = largestGap(free, MIN_WINDOW_MINUTES)
      if (!gap) {
        notes.push(`${day.date}: no gap of ${MIN_WINDOW_MINUTES}+ minutes for goal work`)
      } else {
        const rotated = ranked
          .map((r) => ({ r, score: r.score * Math.pow(ROTATION_DECAY, assignedCount[r.outcome.id] ?? 0) }))
          .sort((a, b) => b.score - a.score || a.r.outcome.title.localeCompare(b.r.outcome.title))
        const gapMinutes = minutes(gap)
        const fits = (c: { estimated_minutes: number }) => c.estimated_minutes <= Math.min(gapMinutes, MAX_WINDOW_MINUTES)
        const unused = (c: { deliverable: string }) => !used.has(norm(c.deliverable))

        // First outcome in rotation that still has an unused candidate; an
        // outcome whose candidates are all scheduled this week yields its day
        // to the next one rather than repeating itself.
        let pick = rotated[0].r
        let candidate =
          pick.activeMilestone?.candidates.find((c) => unused(c) && fits(c)) ??
          pick.activeMilestone?.candidates.find(unused) ??
          null
        if (!candidate) {
          for (const { r } of rotated.slice(1)) {
            const alt = r.activeMilestone?.candidates.find((c) => unused(c) && fits(c)) ?? r.activeMilestone?.candidates.find(unused)
            if (alt) {
              pick = r
              candidate = alt
              break
            }
          }
        }
        if (!candidate && rotated[0].r.activeMilestone?.candidates[0]) {
          // Everything is scheduled once already; repeat the top outcome's first
          // candidate and say so.
          candidate = rotated[0].r.activeMilestone.candidates[0]
          notes.push(`${day.date}: all candidates scheduled this week; repeating "${candidate.deliverable.slice(0, 40)}…"`)
        }
        const milestone = pick.activeMilestone

        if (!candidate) {
          notes.push(`${day.date}: "${pick.outcome.title}" has no candidates yet — open its conversation`)
        } else {
          const mins = Math.max(MIN_WINDOW_MINUTES, Math.min(MAX_WINDOW_MINUTES, candidate.estimated_minutes, gapMinutes))
          const interval = place(gap, mins)
          blocks.push({
            ...interval,
            date: day.date,
            kind: 'goal',
            title: candidate.deliverable,
            commitmentId: null,
            outcomeId: pick.outcome.id,
            milestoneId: milestone?.id ?? null,
            projectId: pick.outcome.projectId,
            rationale: milestone ? `${pick.outcome.title} → ${milestone.title}` : pick.outcome.title,
            expectedPaths: candidate.expected_paths,
          })
          used.add(norm(candidate.deliverable))
          assignedCount[pick.outcome.id] = (assignedCount[pick.outcome.id] ?? 0) + 1
          take(interval)
        }
      }
    }

    // 5. flexible commitments — largest remaining gap, while whitespace allows
    for (const c of input.commitments) {
      if (c.kind !== 'flexible' || !c.daysOfWeek.includes(day.weekday)) continue
      if (!canPlace(c, keptToday)) continue
      if (!optionalRoomLeft()) {
        notes.push(`${day.date}: left "${c.title}" unplanned to keep whitespace`)
        continue
      }
      const gap = largestGap(free, Math.min(c.durationMinutes, MIN_WINDOW_MINUTES))
      if (!gap) {
        notes.push(`${day.date}: no room for "${c.title}"`)
        continue
      }
      const interval = place(gap, Math.min(c.durationMinutes, minutes(gap)))
      blocks.push({ ...interval, date: day.date, kind: 'flexible', title: c.title, commitmentId: c.id, outcomeId: c.outcomeId, milestoneId: null, projectId: c.projectId, rationale: null, expectedPaths: [] })
      placed(c)
      take(interval)
    }
  }

  return { blocks, notes }
}
