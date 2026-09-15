// src/lib/chains/index.ts
//
// Chains on top of the database: load the day template, seed the default
// four from what the user already has, plan a week as chains, and advance a
// run as its links complete. The layout itself is pure (lib/planner/chain);
// this is the glue. Every query filters by user_id.

import { formatInTimeZone } from 'date-fns-tz'
import type { Db } from '@/lib/supabase/types'
import { layDay, defaultChains, type ChainTemplate, type LinkTemplate, type RunState, type GoalFill, type Extra, type LaidChain } from '@/lib/planner/chain'
import { scoreOutcomes } from '@/lib/planner/select'
import { MAX_WINDOW_MINUTES, MIN_WINDOW_MINUTES } from '@/lib/planner/window'
import type { PlannerMilestone, PlannerOutcome, PlannerSignal } from '@/lib/planner/types'
import type { TimeInterval } from '@/lib/calendar/types'
import type { WeekCalendar } from '@/lib/calendar/week'
import { loadSignals } from '@/lib/goals/ladder'

// ---------------------------------------------------------------------------
// templates
// ---------------------------------------------------------------------------

export interface DayTemplate {
  chains: ChainTemplate[]
  links: LinkTemplate[]
  wakeTime: string | null
  bedTime: string | null
}

interface ChainRow {
  id: string
  name: string
  role: ChainTemplate['role']
  position: number
  anchor_kind: ChainTemplate['anchorKind']
  anchor_time: string | null
  target_minutes: number | null
  days_of_week: number[]
  plannable: boolean
  protected: boolean
  active: boolean
}

interface LinkRow {
  id: string
  chain_id: string
  position: number
  title: string
  kind: LinkTemplate['kind']
  duration_minutes: number
  commitment_id: string | null
  days_of_week: number[] | null
  active: boolean
}

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null)

export async function loadDayTemplate(supabase: Db, userId: string): Promise<DayTemplate> {
  const [{ data: chainRows }, { data: linkRows }, { data: user }] = await Promise.all([
    supabase.from('chains').select('id, name, role, position, anchor_kind, anchor_time, target_minutes, days_of_week, plannable, protected, active').eq('user_id', userId).eq('active', true).order('position'),
    supabase.from('chain_links').select('id, chain_id, position, title, kind, duration_minutes, commitment_id, days_of_week, active').eq('user_id', userId).eq('active', true).order('position'),
    supabase.from('users').select('wake_time, bed_time').eq('id', userId).maybeSingle(),
  ])
  return {
    chains: ((chainRows ?? []) as ChainRow[]).map((c) => ({
      id: c.id, name: c.name, role: c.role, position: c.position, anchorKind: c.anchor_kind, anchorTime: hhmm(c.anchor_time), targetMinutes: c.target_minutes, daysOfWeek: c.days_of_week ?? [], plannable: c.plannable, protected: c.protected,
    })),
    links: ((linkRows ?? []) as LinkRow[]).map((l) => ({
      id: l.id, chainId: l.chain_id, position: l.position, title: l.title, kind: l.kind, durationMinutes: l.duration_minutes, commitmentId: l.commitment_id, daysOfWeek: l.days_of_week,
    })),
    wakeTime: hhmm((user?.wake_time as string | null) ?? null),
    bedTime: hhmm((user?.bed_time as string | null) ?? null),
  }
}

interface CommitmentRow {
  id: string
  title: string
  kind: 'flexible' | 'fixed' | 'habit' | 'chore'
  days_of_week: number[]
  duration_minutes: number
  fixed_start: string | null
  fixed_end: string | null
  due_date: string | null
}

/**
 * First run: create Rise / Work / Live / Wind down. Existing fixed and habit
 * commitments that happen before the work day become Rise links, in time
 * order; flexible ones and chores stay as commitments the planner adds to
 * Work. Returns true when something was seeded.
 */
export async function ensureDefaultChains(supabase: Db, userId: string): Promise<boolean> {
  const { count } = await supabase.from('chains').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  if ((count ?? 0) > 0) return false

  const { data: commitmentRows } = await supabase
    .from('commitments')
    .select('id, title, kind, days_of_week, duration_minutes, fixed_start, fixed_end, due_date')
    .eq('user_id', userId)
    .eq('active', true)
  const commitments = (commitmentRows ?? []) as CommitmentRow[]

  const morning = commitments
    .filter((c) => (c.kind === 'fixed' && c.fixed_start && c.fixed_start < '09:00') || c.kind === 'habit')
    .sort((a, b) => (a.fixed_start ?? '08:59').localeCompare(b.fixed_start ?? '08:59'))

  for (const tpl of defaultChains(userId)) {
    const { links, user_id, ...chain } = tpl
    const { data: created, error } = await supabase
      .from('chains')
      .insert({ user_id, name: chain.name, role: chain.role, position: chain.position, anchor_kind: chain.anchorKind, anchor_time: chain.anchorTime, target_minutes: chain.targetMinutes, days_of_week: chain.daysOfWeek, plannable: chain.plannable, protected: chain.protected })
      .select('id')
      .single()
    if (error || !created) throw new Error(error?.message ?? 'Failed to seed chains')

    const rows = links.map((l) => ({ user_id: userId, chain_id: created.id, position: l.position, title: l.title, kind: l.kind, duration_minutes: l.durationMinutes, commitment_id: null as string | null, days_of_week: l.daysOfWeek }))
    if (chain.role === 'rise') {
      // Earliest fixed commitment first (gym at 7 leads), then habits.
      morning.forEach((c, i) => rows.push({ user_id: userId, chain_id: created.id, position: i, title: c.title, kind: c.kind === 'fixed' ? 'fixed' : 'habit', duration_minutes: c.duration_minutes, commitment_id: c.id, days_of_week: c.days_of_week.length ? c.days_of_week : null }))
      // The Rise anchor follows the earliest fixed link (gym at 7:00 means Rise starts at 7:00).
      const earliest = morning.find((c) => c.kind === 'fixed' && c.fixed_start)
      if (earliest?.fixed_start) await supabase.from('chains').update({ anchor_time: earliest.fixed_start.slice(0, 5) }).eq('id', created.id)
    }
    if (rows.length > 0) await supabase.from('chain_links').insert(rows)
  }
  return true
}

// ---------------------------------------------------------------------------
// goal picking (rotation across the week, from accepted candidates only)
// ---------------------------------------------------------------------------

export function makeGoalPicker(input: {
  outcomes: PlannerOutcome[]
  milestones: PlannerMilestone[]
  signals: PlannerSignal[]
  now: Date
  today: string
  alreadyScheduled: string[]
  weekStart?: string | null
}) {
  const ranked = scoreOutcomes({ outcomes: input.outcomes, milestones: input.milestones, signals: input.signals, now: input.now, today: input.today, weekStart: input.weekStart ?? null })
  const used = new Set(input.alreadyScheduled.map((t) => t.trim().toLowerCase()))
  const assigned: Record<string, number> = {}
  const norm = (s: string) => s.trim().toLowerCase()

  return (slot: { maxMinutes: number; index: number }): GoalFill | null => {
    const rotated = ranked
      .map((r) => ({ r, score: r.score * Math.pow(0.7, assigned[r.outcome.id] ?? 0) }))
      .sort((a, b) => b.score - a.score || a.r.outcome.title.localeCompare(b.r.outcome.title))
    const max = Math.min(slot.maxMinutes, MAX_WINDOW_MINUTES)
    for (const { r } of rotated) {
      const m = r.activeMilestone
      if (!m) continue
      const candidate = m.candidates.find((c) => !used.has(norm(c.deliverable)) && c.estimated_minutes <= max) ?? m.candidates.find((c) => !used.has(norm(c.deliverable)))
      if (!candidate) continue
      used.add(norm(candidate.deliverable))
      assigned[r.outcome.id] = (assigned[r.outcome.id] ?? 0) + 1
      return {
        outcomeId: r.outcome.id,
        milestoneId: m.id,
        projectId: r.outcome.projectId,
        deliverable: candidate.deliverable,
        expectedPaths: candidate.expected_paths,
        rationale: `${r.outcome.title} → ${m.title}`,
        minutes: Math.max(MIN_WINDOW_MINUTES, Math.min(max, candidate.estimated_minutes)),
      }
    }
    return null
  }
}

// ---------------------------------------------------------------------------
// planning a week as chains
// ---------------------------------------------------------------------------

export interface ExistingBlock {
  id: string
  date: string
  kind: string
  status: string
  locked: boolean
  source: string
  starts_at: string
  ends_at: string
  deliverable: string
  commitment_id: string | null
  chain_run_id: string | null
  chain_link_id: string | null
  link_position: number | null
  outcome_id: string | null
}

interface RunRow {
  id: string
  chain_id: string
  run_date: string
  anchor_at: string
  started_at: string | null
  current_position: number
  status: string
}

export interface PlannedDay {
  date: string
  chains: LaidChain[]
  notes: string[]
}

/**
 * Plan the given days as chains and persist: chain_runs upserted with their
 * planned anchor, provisional blocks replaced, kept blocks left alone.
 * `keep` decides which existing blocks stay (locked, resolved, started, user-made).
 */
export async function planDaysAsChains(input: {
  supabase: Db
  userId: string
  timeZone: string
  now: Date
  today: string
  weekStart: string
  days: WeekCalendar['days']
  existing: ExistingBlock[]
  keep: (b: ExistingBlock) => boolean
  outcomes: PlannerOutcome[]
  milestones: PlannerMilestone[]
  commitments: CommitmentRow[]
}): Promise<{ days: PlannedDay[]; notes: string[]; written: number; replaced: number }> {
  const { supabase, userId, timeZone, now, today } = input
  const template = await loadDayTemplate(supabase, userId)
  const signals = await loadSignals(supabase, userId)

  const dates = input.days.map((d) => d.date)
  const { data: runRows } = await supabase
    .from('chain_runs')
    .select('id, chain_id, run_date, anchor_at, started_at, current_position, status')
    .eq('user_id', userId)
    .in('run_date', dates)
  const runs = (runRows ?? []) as RunRow[]

  const kept = input.existing.filter(input.keep)
  const replaceIds = input.existing.filter((b) => !input.keep(b)).map((b) => b.id)
  const alreadyScheduled = kept.filter((b) => b.kind === 'goal').map((b) => b.deliverable)
  const fillGoal = makeGoalPicker({ outcomes: input.outcomes, milestones: input.milestones, signals, now, today, alreadyScheduled, weekStart: input.weekStart })

  // Template links already mirror some commitments; the rest are extras for Work.
  const linkedCommitmentIds = new Set(template.links.map((l) => l.commitmentId).filter(Boolean))
  const chores = input.commitments.filter((c) => c.kind === 'chore' && c.due_date).sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
  const placedChores = new Set(kept.filter((b) => b.kind === 'chore' && b.commitment_id).map((b) => b.commitment_id as string))

  const planned: PlannedDay[] = []
  const allNotes: string[] = []
  const inserts: Record<string, unknown>[] = []
  const runUpserts: Array<{ chainId: string; date: string; anchorAt: Date; existing?: RunRow }> = []

  for (const day of input.days) {
    if (day.isPast) continue
    const keptToday = kept.filter((b) => b.date === day.date)
    const busy: TimeInterval[] = [
      ...day.events.filter((e) => e.busy && !e.allDay).map((e) => ({ start: e.start, end: e.end })),
      ...keptToday.map((b) => ({ start: new Date(b.starts_at), end: new Date(b.ends_at) })),
    ]

    const runStates: RunState[] = runs
      .filter((r) => r.run_date === day.date)
      .map((r) => {
        const doneBlocks = keptToday.filter((b) => b.chain_run_id === r.id && b.link_position !== null)
        const lastDone = doneBlocks.filter((b) => b.status !== 'planned').sort((a, b) => b.ends_at.localeCompare(a.ends_at))[0]
        const resumeAt = r.started_at ? new Date(Math.max(now.getTime(), lastDone ? new Date(lastDone.ends_at).getTime() : 0)) : null
        return { chainId: r.chain_id, startedAt: r.started_at ? new Date(r.started_at) : null, donePositions: doneBlocks.map((b) => b.link_position as number), resumeAt }
      })

    const weekday = day.weekday
    const extras: Extra[] = []
    for (const c of chores) {
      if (placedChores.has(c.id)) continue
      if (c.due_date && c.due_date < day.date && day.date !== today) continue
      if (c.due_date && c.due_date > input.days[input.days.length - 1].date) continue
      extras.push({ title: c.title, kind: 'chore', minutes: Math.min(180, c.duration_minutes), commitmentId: c.id, rationale: c.due_date ? `due ${c.due_date}` : null })
    }
    for (const c of input.commitments) {
      if (c.kind !== 'flexible' || linkedCommitmentIds.has(c.id) || !c.days_of_week.includes(weekday)) continue
      if (keptToday.some((b) => b.commitment_id === c.id)) continue
      extras.push({ title: c.title, kind: 'flexible', minutes: c.duration_minutes, commitmentId: c.id })
    }

    const laid = layDay({
      date: day.date, weekday, timeZone, now, busy,
      chains: template.chains, links: template.links, runs: runStates,
      fillGoal, extras, wakeTime: template.wakeTime, bedTime: template.bedTime,
    })
    // Chores placed today should not be placed again tomorrow.
    for (const c of laid.chains) for (const l of c.links) if (l.kind === 'chore' && l.commitmentId) placedChores.add(l.commitmentId)

    planned.push({ date: day.date, chains: laid.chains, notes: laid.notes })
    allNotes.push(...laid.notes.map((n) => `${formatInTimeZone(new Date(`${day.date}T12:00:00Z`), 'UTC', 'EEE')}: ${n}`))
    for (const c of laid.chains) runUpserts.push({ chainId: c.chainId, date: day.date, anchorAt: c.anchorAt, existing: runs.find((r) => r.chain_id === c.chainId && r.run_date === day.date) })
  }

  // ---- persist ------------------------------------------------------------
  if (replaceIds.length > 0) await supabase.from('plan_blocks').delete().in('id', replaceIds).eq('user_id', userId)

  const runIds: Record<string, string> = {}
  for (const u of runUpserts) {
    const key = `${u.chainId}|${u.date}`
    if (u.existing) {
      if (!u.existing.started_at) await supabase.from('chain_runs').update({ anchor_at: u.anchorAt.toISOString() }).eq('id', u.existing.id)
      runIds[key] = u.existing.id
      continue
    }
    const { data } = await supabase
      .from('chain_runs')
      .upsert({ user_id: userId, chain_id: u.chainId, run_date: u.date, anchor_at: u.anchorAt.toISOString() }, { onConflict: 'user_id,chain_id,run_date' })
      .select('id')
      .single()
    if (data?.id) runIds[key] = data.id
  }

  const planIds: Record<string, string> = {}
  for (const d of planned) {
    if (d.chains.every((c) => c.links.length === 0)) continue
    const { data } = await supabase
      .from('daily_plans')
      .upsert({ user_id: userId, plan_date: d.date, timezone: timeZone, origin: d.date === today ? 'daily' : 'week_draft', week_start: input.weekStart, status: 'accepted' }, { onConflict: 'user_id,plan_date' })
      .select('id')
      .single()
    if (data?.id) planIds[d.date] = data.id
  }

  for (const d of planned) {
    for (const c of d.chains) {
      for (const l of c.links) {
        inserts.push({
          user_id: userId,
          plan_id: planIds[d.date],
          outcome_id: l.goal?.outcomeId ?? null,
          project_id: l.goal?.projectId ?? null,
          milestone_id: l.goal?.milestoneId ?? null,
          commitment_id: l.commitmentId,
          deliverable: l.title,
          rationale: l.rationale,
          starts_at: l.start.toISOString(),
          ends_at: l.end.toISOString(),
          position: l.position,
          status: 'planned',
          kind: l.kind,
          source: 'planner',
          locked: false,
          expected_paths: l.goal?.expectedPaths ?? [],
          chain_run_id: runIds[`${c.chainId}|${d.date}`] ?? null,
          chain_link_id: l.linkId,
          link_position: l.position,
        })
      }
    }
  }
  if (inserts.length > 0) {
    const { error } = await supabase.from('plan_blocks').insert(inserts)
    if (error) throw new Error(`Failed to write chain plan: ${error.message}`)
  }

  return { days: planned, notes: allNotes, written: inserts.length, replaced: replaceIds.length }
}

// ---------------------------------------------------------------------------
// runs
// ---------------------------------------------------------------------------

/** Start a chain now (trigger tapped, hook fired, first link done). */
export async function startRun(supabase: Db, userId: string, runId: string, at = new Date()): Promise<void> {
  await supabase
    .from('chain_runs')
    .update({ started_at: at.toISOString(), status: 'active' })
    .eq('id', runId)
    .eq('user_id', userId)
    .is('started_at', null)
}

/**
 * A block in a run was resolved. Advance the run past it; start the run if
 * this was its first movement; close it when nothing planned remains.
 */
export async function advanceRunForBlock(supabase: Db, userId: string, blockId: string, at = new Date()): Promise<{ runId: string; done: boolean } | null> {
  const { data: block } = await supabase.from('plan_blocks').select('chain_run_id, link_position, status').eq('id', blockId).eq('user_id', userId).maybeSingle()
  if (!block?.chain_run_id) return null
  const runId = block.chain_run_id as string

  const { data: run } = await supabase.from('chain_runs').select('id, started_at, current_position').eq('id', runId).maybeSingle()
  if (!run) return null

  const { data: remaining } = await supabase
    .from('plan_blocks')
    .select('id, link_position')
    .eq('user_id', userId)
    .eq('chain_run_id', runId)
    .eq('status', 'planned')
    .order('link_position')
  const next = (remaining ?? []) as { id: string; link_position: number | null }[]
  const done = next.length === 0

  await supabase
    .from('chain_runs')
    .update({
      started_at: run.started_at ?? at.toISOString(),
      current_position: next[0]?.link_position ?? (block.link_position as number) + 1,
      status: done ? 'done' : 'active',
      completed_at: done ? at.toISOString() : null,
    })
    .eq('id', runId)
    .eq('user_id', userId)
  return { runId, done }
}
