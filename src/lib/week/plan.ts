// src/lib/week/plan.ts
//
// The week, loaded and (re)planned. Two entry points:
//
//   loadWeek       everything the calendar page draws: seven days of events
//                  and gaps, every block in the week by kind, the due dates
//                  landing this week, the commitments
//   replanWeek     subtract what stays (locked, resolved, past), delete the
//                  rest of the planner's provisional blocks, run the pure
//                  planner, write the new blocks
//
// Every query filters by user_id; callers may hold the admin client.

import { formatInTimeZone } from 'date-fns-tz'
import type { Db } from '@/lib/supabase/types'
import { getConnection } from '@/lib/calendar/google'
import { buildWeekCalendar, addDays, type WeekCalendar } from '@/lib/calendar/week'
import { todayIn } from '@/lib/calendar/day'
import { planWeek, type KeptBlock, type PlannerCommitment } from '@/lib/planner/week'
import type { PlannerMilestone, PlannerOutcome } from '@/lib/planner/types'
import { loadSignals } from '@/lib/goals/ladder'
import { weekStartOf } from '@/lib/card/build'

export interface WeekBlock {
  id: string
  date: string
  kind: 'goal' | 'flexible' | 'fixed' | 'habit' | 'chore'
  title: string
  rationale: string | null
  starts_at: string
  ends_at: string
  status: string
  locked: boolean
  source: string
  outcome_id: string | null
  milestone_id: string | null
  commitment_id: string | null
  project_id: string | null
  start_command: string | null
}

export interface DueChip {
  date: string
  label: string
  kind: 'target' | 'milestone'
  outcome_id: string
}

export interface CommitmentRow {
  id: string
  title: string
  kind: 'flexible' | 'fixed' | 'habit' | 'chore'
  days_of_week: number[]
  duration_minutes: number
  fixed_start: string | null
  fixed_end: string | null
  due_date: string | null
  active: boolean
  project_id: string | null
  outcome_id: string | null
}

export interface WeekView {
  weekStart: string
  timeZone: string
  today: string
  calendar: WeekCalendar['days']
  connected: boolean
  blocks: WeekBlock[]
  due: DueChip[]
  commitments: CommitmentRow[]
  outcomes: { id: string; title: string; projectName: string | null; status: string }[]
  notes: string[]
}

interface BlockRow extends WeekBlock {
  deliverable: string
}

function toWeekBlock(b: BlockRow, timeZone: string): WeekBlock {
  return {
    id: b.id,
    date: formatInTimeZone(new Date(b.starts_at), timeZone, 'yyyy-MM-dd'),
    kind: b.kind ?? 'goal',
    title: b.deliverable,
    rationale: b.rationale,
    starts_at: b.starts_at,
    ends_at: b.ends_at,
    status: b.status,
    locked: b.locked ?? false,
    source: b.source ?? 'planner',
    outcome_id: b.outcome_id,
    milestone_id: b.milestone_id,
    commitment_id: b.commitment_id,
    project_id: b.project_id,
    start_command: b.start_command,
  }
}

const BLOCK_COLUMNS =
  'id, deliverable, rationale, starts_at, ends_at, status, locked, source, kind, outcome_id, milestone_id, commitment_id, project_id, start_command'

async function loadBlocks(supabase: Db, userId: string, from: Date, to: Date, timeZone: string): Promise<WeekBlock[]> {
  const { data } = await supabase
    .from('plan_blocks')
    .select(BLOCK_COLUMNS)
    .eq('user_id', userId)
    .gte('starts_at', from.toISOString())
    .lt('starts_at', to.toISOString())
    .order('starts_at')
  return ((data ?? []) as BlockRow[]).map((b) => toWeekBlock(b, timeZone))
}

export async function loadWeek(input: { supabase: Db; userId: string; origin: string; weekStart?: string; now?: Date; notes?: string[] }): Promise<WeekView> {
  const { supabase, userId, origin } = input
  const now = input.now ?? new Date()
  const connection = await getConnection(userId, supabase)
  const timeZone = connection?.timezone ?? 'America/New_York'
  const today = todayIn(timeZone, now)
  const weekStart = input.weekStart ?? weekStartOf(today)

  const calendar = await buildWeekCalendar({ supabase, userId, connection, timeZone, weekStart, origin, now })

  const from = calendar.days[0].workWindow.start
  const to = new Date(calendar.days[6].workWindow.end.getTime() + 12 * 3600_000)
  const weekEnd = addDays(weekStart, 6)

  const [blocks, commitmentsRes, outcomesRes, milestonesRes, projectsRes] = await Promise.all([
    loadBlocks(supabase, userId, new Date(from.getTime() - 12 * 3600_000), to, timeZone),
    supabase.from('commitments').select('id, title, kind, days_of_week, duration_minutes, fixed_start, fixed_end, due_date, active, project_id, outcome_id').eq('user_id', userId).eq('active', true).order('created_at'),
    supabase.from('outcomes').select('id, title, target_date, status, project_id').eq('user_id', userId).in('status', ['active', 'draft']),
    supabase.from('milestones').select('id, outcome_id, title, expected_by, status').eq('user_id', userId).not('expected_by', 'is', null).gte('expected_by', weekStart).lte('expected_by', weekEnd),
    supabase.from('projects').select('id, name').eq('user_id', userId),
  ])

  const projects = (projectsRes.data ?? []) as { id: string; name: string }[]
  const outcomes = (outcomesRes.data ?? []) as { id: string; title: string; target_date: string | null; status: string; project_id: string | null }[]
  const due: DueChip[] = []
  for (const o of outcomes) {
    if (o.target_date && o.target_date >= weekStart && o.target_date <= weekEnd) {
      due.push({ date: o.target_date, label: o.title, kind: 'target', outcome_id: o.id })
    }
  }
  for (const m of (milestonesRes.data ?? []) as { id: string; outcome_id: string; title: string; expected_by: string; status: string }[]) {
    if (m.status !== 'done') due.push({ date: m.expected_by, label: m.title, kind: 'milestone', outcome_id: m.outcome_id })
  }

  return {
    weekStart,
    timeZone,
    today,
    calendar: calendar.days,
    connected: !!connection,
    blocks,
    due,
    commitments: (commitmentsRes.data ?? []) as CommitmentRow[],
    outcomes: outcomes.map((o) => ({ id: o.id, title: o.title, status: o.status, projectName: projects.find((p) => p.id === o.project_id)?.name ?? null })),
    notes: input.notes ?? [],
  }
}

/**
 * Re-plan the provisional part of the week. Kept: anything locked, anything
 * already resolved, anything that already started. Everything else the
 * planner wrote is replaced.
 */
export async function replanWeek(input: { supabase: Db; userId: string; origin: string; weekStart?: string; now?: Date }): Promise<WeekView> {
  const { supabase, userId, origin } = input
  const now = input.now ?? new Date()
  const connection = await getConnection(userId, supabase)
  const timeZone = connection?.timezone ?? 'America/New_York'
  const today = todayIn(timeZone, now)
  const weekStart = input.weekStart ?? weekStartOf(today)

  const calendar = await buildWeekCalendar({ supabase, userId, connection, timeZone, weekStart, origin, now })
  const from = new Date(calendar.days[0].workWindow.start.getTime() - 12 * 3600_000)
  const to = new Date(calendar.days[6].workWindow.end.getTime() + 12 * 3600_000)

  const [existing, commitmentsRes, outcomesRes, projectsRes, signals] = await Promise.all([
    loadBlocks(supabase, userId, from, to, timeZone),
    supabase.from('commitments').select('id, title, kind, days_of_week, duration_minutes, fixed_start, fixed_end, due_date, active, project_id, outcome_id').eq('user_id', userId).eq('active', true),
    supabase.from('outcomes').select('id, title, project_id, weight, target_date, status').eq('user_id', userId).eq('status', 'active'),
    supabase.from('projects').select('id, name, paused').eq('user_id', userId),
    loadSignals(supabase, userId),
  ])

  const projects = (projectsRes.data ?? []) as { id: string; name: string; paused: boolean }[]
  const outcomes: PlannerOutcome[] = ((outcomesRes.data ?? []) as Array<{ id: string; title: string; project_id: string | null; weight: number; target_date: string | null; status: PlannerOutcome['status'] }>)
    .filter((o) => !projects.find((p) => p.id === o.project_id)?.paused)
    .map((o) => ({ id: o.id, title: o.title, projectId: o.project_id, projectName: projects.find((p) => p.id === o.project_id)?.name ?? null, weight: o.weight ?? 2, targetDate: o.target_date, status: o.status }))

  const { data: milestoneRows } = outcomes.length
    ? await supabase.from('milestones').select('id, outcome_id, title, estimated_minutes, position, status, focus_week, candidates').eq('user_id', userId).in('outcome_id', outcomes.map((o) => o.id))
    : { data: [] }
  const milestones: PlannerMilestone[] = ((milestoneRows ?? []) as Array<{ id: string; outcome_id: string; title: string; estimated_minutes: number; position: number; status: PlannerMilestone['status']; focus_week: string | null; candidates: unknown }>).map((m) => ({
    id: m.id, outcomeId: m.outcome_id, title: m.title, estimatedMinutes: m.estimated_minutes, position: m.position, status: m.status, focusWeek: m.focus_week,
    candidates: Array.isArray(m.candidates) ? (m.candidates as PlannerMilestone['candidates']) : [],
  }))

  const commitments: PlannerCommitment[] = ((commitmentsRes.data ?? []) as CommitmentRow[]).map((c) => ({
    id: c.id, title: c.title, kind: c.kind, daysOfWeek: c.days_of_week ?? [], durationMinutes: c.duration_minutes, fixedStart: c.fixed_start?.slice(0, 5) ?? null, fixedEnd: c.fixed_end?.slice(0, 5) ?? null, dueDate: c.due_date, projectId: c.project_id, outcomeId: c.outcome_id,
  }))

  // What stays vs. what the planner may replace.
  const keep = (b: WeekBlock) => b.locked || b.status !== 'planned' || new Date(b.starts_at) <= now || b.source === 'user' || b.source === 'agent'
  const kept: KeptBlock[] = existing.filter(keep).map((b) => ({ id: b.id, date: b.date, kind: b.kind, commitmentId: b.commitment_id, outcomeId: b.outcome_id, title: b.title, start: new Date(b.starts_at), end: new Date(b.ends_at) }))
  const replaceIds = existing.filter((b) => !keep(b)).map((b) => b.id)

  const plan = planWeek({
    days: calendar.days.filter((d) => !d.isPast).map((d) => ({ date: d.date, weekday: d.weekday, workWindow: d.workWindow, gaps: d.gaps, available: d.available })),
    timeZone, today, now, commitments, outcomes, milestones, signals, kept,
  })

  if (replaceIds.length > 0) {
    await supabase.from('plan_blocks').delete().in('id', replaceIds).eq('user_id', userId)
  }

  // One daily_plans row per date that gets a block.
  const dates = Array.from(new Set(plan.blocks.map((b) => b.date)))
  const planIds: Record<string, string> = {}
  for (const date of dates) {
    const { data } = await supabase
      .from('daily_plans')
      .upsert({ user_id: userId, plan_date: date, timezone: timeZone, origin: date === today ? 'daily' : 'week_draft', week_start: weekStart, status: 'accepted' }, { onConflict: 'user_id,plan_date' })
      .select('id')
      .single()
    if (data?.id) planIds[date] = data.id
  }

  if (plan.blocks.length > 0) {
    const { error } = await supabase.from('plan_blocks').insert(
      plan.blocks.map((b, i) => ({
        user_id: userId,
        plan_id: planIds[b.date],
        outcome_id: b.outcomeId,
        project_id: b.projectId,
        milestone_id: b.milestoneId,
        commitment_id: b.commitmentId,
        deliverable: b.title,
        rationale: b.rationale,
        starts_at: b.start.toISOString(),
        ends_at: b.end.toISOString(),
        position: i,
        status: 'planned',
        kind: b.kind,
        source: 'planner',
        locked: false,
        expected_paths: b.expectedPaths,
      }))
    )
    if (error) throw new Error(`Failed to write week plan: ${error.message}`)
  }

  await supabase.from('session_events').insert({
    user_id: userId,
    event: 'week_planned',
    event_date: today,
    metadata: { week_start: weekStart, blocks: plan.blocks.length, replaced: replaceIds.length, kept: kept.length, notes: plan.notes },
  })

  const notes = connection ? plan.notes : ['No calendar connected: the whole work window counted as free. Connect Google Calendar in Settings to plan around real events.', ...plan.notes]
  return loadWeek({ supabase, userId, origin, weekStart, now, notes })
}
