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
import type { PlannerMilestone, PlannerOutcome } from '@/lib/planner/types'
import { ensureDefaultChains, planDaysAsChains, type ExistingBlock } from '@/lib/chains'
import { weekStartOf } from '@/lib/card/build'

export interface WeekBlock {
  id: string
  date: string
  kind: 'goal' | 'flexible' | 'fixed' | 'habit' | 'chore' | 'free'
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
  chain_run_id: string | null
  chain_link_id: string | null
  link_position: number | null
}

export interface ChainRunView {
  id: string
  chain_id: string
  name: string
  role: 'rise' | 'work' | 'live' | 'winddown' | 'custom'
  date: string
  anchor_at: string
  started_at: string | null
  completed_at: string | null
  current_position: number
  status: 'planned' | 'active' | 'done' | 'abandoned'
  /** Derived: end of the last block in the run, or the anchor when empty. */
  end_at: string
}

export interface ChainView {
  id: string
  name: string
  role: 'rise' | 'work' | 'live' | 'winddown' | 'custom'
  position: number
  anchor_kind: 'trigger' | 'after_previous' | 'clock' | 'before_bed'
  anchor_time: string | null
  target_minutes: number | null
  days_of_week: number[]
  plannable: boolean
  protected: boolean
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
  runs: ChainRunView[]
  chains: ChainView[]
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
    chain_run_id: b.chain_run_id ?? null,
    chain_link_id: b.chain_link_id ?? null,
    link_position: b.link_position ?? null,
  }
}

const BLOCK_COLUMNS =
  'id, deliverable, rationale, starts_at, ends_at, status, locked, source, kind, outcome_id, milestone_id, commitment_id, project_id, start_command, chain_run_id, chain_link_id, link_position'

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

  const [blocks, commitmentsRes, outcomesRes, milestonesRes, projectsRes, runsRes, chainsRes] = await Promise.all([
    loadBlocks(supabase, userId, new Date(from.getTime() - 12 * 3600_000), to, timeZone),
    supabase.from('commitments').select('id, title, kind, days_of_week, duration_minutes, fixed_start, fixed_end, due_date, active, project_id, outcome_id').eq('user_id', userId).eq('active', true).order('created_at'),
    supabase.from('outcomes').select('id, title, target_date, status, project_id').eq('user_id', userId).in('status', ['active', 'draft']),
    supabase.from('milestones').select('id, outcome_id, title, expected_by, status').eq('user_id', userId).not('expected_by', 'is', null).gte('expected_by', weekStart).lte('expected_by', weekEnd),
    supabase.from('projects').select('id, name').eq('user_id', userId),
    supabase.from('chain_runs').select('id, chain_id, run_date, anchor_at, started_at, completed_at, current_position, status').eq('user_id', userId).gte('run_date', weekStart).lte('run_date', weekEnd),
    supabase.from('chains').select('id, name, role, position, anchor_kind, anchor_time, target_minutes, days_of_week, plannable, protected').eq('user_id', userId).eq('active', true).order('position'),
  ])

  const projects = (projectsRes.data ?? []) as { id: string; name: string }[]
  const chains = ((chainsRes.data ?? []) as Array<Omit<ChainView, 'anchor_time'> & { anchor_time: string | null }>).map((c) => ({ ...c, anchor_time: c.anchor_time ? c.anchor_time.slice(0, 5) : null }))
  const runs: ChainRunView[] = ((runsRes.data ?? []) as Array<{ id: string; chain_id: string; run_date: string; anchor_at: string; started_at: string | null; completed_at: string | null; current_position: number; status: ChainRunView['status'] }>).map((r) => {
    const chain = chains.find((c) => c.id === r.chain_id)
    const own = blocks.filter((b) => b.chain_run_id === r.id)
    const end = own.length ? own.reduce((m, b) => (b.ends_at > m ? b.ends_at : m), own[0].ends_at) : r.anchor_at
    return { id: r.id, chain_id: r.chain_id, name: chain?.name ?? 'Chain', role: chain?.role ?? 'custom', date: r.run_date, anchor_at: r.anchor_at, started_at: r.started_at, completed_at: r.completed_at, current_position: r.current_position, status: r.status, end_at: end }
  })
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
    runs,
    chains,
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

  const [existing, commitmentsRes, outcomesRes, projectsRes] = await Promise.all([
    loadBlocks(supabase, userId, from, to, timeZone),
    supabase.from('commitments').select('id, title, kind, days_of_week, duration_minutes, fixed_start, fixed_end, due_date, active, project_id, outcome_id').eq('user_id', userId).eq('active', true),
    supabase.from('outcomes').select('id, title, project_id, weight, target_date, status').eq('user_id', userId).eq('status', 'active'),
    supabase.from('projects').select('id, name, paused').eq('user_id', userId),
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

  await ensureDefaultChains(supabase, userId)

  // What stays vs. what the planner may replace.
  const keep = (b: ExistingBlock) => b.locked || b.status !== 'planned' || new Date(b.starts_at) <= now || b.source === 'user' || b.source === 'agent'
  const existingRows: ExistingBlock[] = existing.map((b) => ({
    id: b.id, date: b.date, kind: b.kind, status: b.status, locked: b.locked, source: b.source, starts_at: b.starts_at, ends_at: b.ends_at, deliverable: b.title, commitment_id: b.commitment_id, chain_run_id: b.chain_run_id, chain_link_id: b.chain_link_id, link_position: b.link_position, outcome_id: b.outcome_id,
  }))

  const plan = await planDaysAsChains({
    supabase, userId, timeZone, now, today, weekStart,
    days: calendar.days,
    existing: existingRows,
    keep,
    outcomes,
    milestones,
    commitments: (commitmentsRes.data ?? []) as CommitmentRow[],
  })

  await supabase.from('session_events').insert({
    user_id: userId,
    event: 'week_planned',
    event_date: today,
    metadata: { week_start: weekStart, blocks: plan.written, replaced: plan.replaced, notes: plan.notes },
  })

  const notes = connection ? plan.notes : ['No calendar connected: the whole work window counted as free. Connect Google Calendar in Settings to plan around real events.', ...plan.notes]
  return loadWeek({ supabase, userId, origin, weekStart, now, notes })
}
