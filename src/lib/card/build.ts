// src/lib/card/build.ts
//
// The card, end to end:
//
//   calendar → window (code) → ranked outcomes (code) → existing block, or one
//   validated model turn → plan_blocks row → card text
//
// Called by /api/card (hook, web) and by the daily cron (email). Every query
// filters by user_id because the caller may hand us the service-role client.

import { formatInTimeZone } from 'date-fns-tz'
import type { Db } from '@/lib/supabase/types'
import { getConnection } from '@/lib/calendar/google'
import { buildDayCalendar, todayIn } from '@/lib/calendar/day'
import { currentWindow } from '@/lib/planner/window'
import { disagreementLine, scoreOutcomes, type ScoredOutcome } from '@/lib/planner/select'
import { observedPace, paceLine, remainingMinutes } from '@/lib/planner/capacity'
import type { Candidate, CardWindow, PlannerMilestone, PlannerOutcome, PlannerSignal } from '@/lib/planner/types'
import { runCardTurn } from './turn'
import { projectForPath } from '@/lib/signals/attribute'
import { readUsage, overCeiling, recordUsage } from './usage'
import { CARD_MODEL, usdFor } from './anthropic'
import { observedLine, renderCard, type CardData } from './render'
import type { LastBlockSummary } from './context'
import type { DayCalendar } from '@/lib/calendar/types'

export interface BuildInput {
  supabase: Db
  userId: string
  origin: string
  now?: Date
  /** Directory the user's terminal was opened in, for the cwd bonus. */
  cwd?: string | null
  /** A one-line redirect from the user; forces a fresh block. */
  userNote?: string | null
}

export type BuildResult =
  | { status: 'no_calendar' }
  | { status: 'unavailable'; day: DayCalendar }
  | { status: 'no_window'; day: DayCalendar }
  | { status: 'no_outcomes'; day: DayCalendar; window: CardWindow }
  | { status: 'capped'; reason: string; day: DayCalendar; window: CardWindow }
  | {
      status: 'ok'
      text: string
      day: DayCalendar
      window: CardWindow
      block: {
        id: string
        deliverable: string
        rationale: string | null
        startsAt: string
        endsAt: string
        status: string
        startCommand: string | null
        expectedPaths: string[]
      }
      outcome: { id: string; title: string; projectName: string | null }
      milestone: { id: string; title: string; index: number; count: number } | null
      source: 'model' | 'fallback' | 'existing'
      disagreement: string | null
      ranked: { outcomeId: string; title: string; score: number }[]
    }

interface ProjectRow {
  id: string
  name: string
  repo_path: string | null
  folder_paths: string[]
  weight: number
  paused: boolean
}

interface OutcomeRow {
  id: string
  title: string
  definition_of_done: string | null
  target_date: string | null
  status: 'active' | 'paused' | 'done' | 'abandoned'
  weight: number
  project_id: string | null
}

interface MilestoneRow {
  id: string
  outcome_id: string
  title: string
  estimated_minutes: number
  position: number
  status: 'pending' | 'active' | 'done' | 'skipped'
  focus_week: string | null
  candidates: Candidate[] | null
}

interface SignalRow {
  id: string
  project_id: string | null
  source: PlannerSignal['source']
  occurred_at: string
  paths: string[] | null
  summary: string | null
  duration_minutes: number | null
}

interface BlockRow {
  id: string
  outcome_id: string | null
  project_id: string | null
  milestone_id: string | null
  deliverable: string
  rationale: string | null
  starts_at: string
  ends_at: string
  status: string
  confidence: number | null
  evidence_signal_ids: string[] | null
  start_command: string | null
  expected_paths: string[] | null
  resolved_by: string | null
}

/** Monday of the week containing `date` (yyyy-MM-dd), zone-free. */
export function weekStartOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  const day = d.getUTCDay() // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

function toPlannerSignal(s: SignalRow): PlannerSignal {
  return {
    id: s.id,
    projectId: s.project_id,
    source: s.source,
    occurredAt: new Date(s.occurred_at),
    paths: s.paths ?? [],
    summary: s.summary ?? '',
    durationMinutes: s.duration_minutes,
  }
}

function toPlannerMilestone(m: MilestoneRow): PlannerMilestone {
  return {
    id: m.id,
    outcomeId: m.outcome_id,
    title: m.title,
    estimatedMinutes: m.estimated_minutes,
    position: m.position,
    status: m.status,
    focusWeek: m.focus_week,
    candidates: Array.isArray(m.candidates) ? m.candidates : [],
  }
}

function repoLabel(path: string | null): string | null {
  if (!path) return null
  return path.replace(/^\/Users\/[^/]+/, '~')
}

function previousLine(block: BlockRow | null, timeZone: string, signals: PlannerSignal[]): string | null {
  if (!block) return null
  const at = formatInTimeZone(new Date(block.starts_at), timeZone, 'H:mm')
  if (block.status === 'planned' || block.status === 'unobserved') return null
  const evidence = (block.evidence_signal_ids ?? [])
    .map((id) => signals.find((s) => s.id === id))
    .filter((s): s is PlannerSignal => !!s)
  const commits = evidence.filter((s) => s.source === 'git')
  const detail =
    commits.length > 0
      ? `${commits.length} commit${commits.length === 1 ? '' : 's'}${commits[0].paths[0] ? ` on ${commits[0].paths[0].split('/').slice(0, 2).join('/')}` : ''}`
      : block.resolved_by === 'user'
        ? 'you said so'
        : evidence.length > 0
          ? 'session observed'
          : ''
  return `${at} block: ${block.status}${detail ? ` (${detail})` : ''}`
}

export async function buildCard(input: BuildInput): Promise<BuildResult> {
  const { supabase, userId, origin } = input
  const now = input.now ?? new Date()

  const connection = await getConnection(userId, supabase)
  if (!connection) return { status: 'no_calendar' }

  const { available, day } = await buildDayCalendar({ supabase, userId, connection, origin, now })
  if (!available) return { status: 'unavailable', day }

  const window = currentWindow({ now, gaps: day.gaps })
  if (!window) return { status: 'no_window', day }

  const timeZone = day.timeZone
  const today = todayIn(timeZone, now)
  const weekStart = weekStartOf(today)

  // ---- load state -------------------------------------------------------
  const since = new Date(now.getTime() - 28 * 86_400_000).toISOString()
  const [projectsRes, outcomesRes, signalsRes] = await Promise.all([
    supabase.from('projects').select('id, name, repo_path, folder_paths, weight, paused').eq('user_id', userId),
    supabase
      .from('outcomes')
      .select('id, title, definition_of_done, target_date, status, weight, project_id')
      .eq('user_id', userId)
      .eq('status', 'active'),
    supabase
      .from('signals')
      .select('id, project_id, source, occurred_at, paths, summary, duration_minutes')
      .eq('user_id', userId)
      .gte('occurred_at', since)
      .order('occurred_at', { ascending: false })
      .limit(500),
  ])

  const projects = (projectsRes.data ?? []) as ProjectRow[]
  const outcomeRows = ((outcomesRes.data ?? []) as OutcomeRow[]).filter((o) => {
    const p = projects.find((x) => x.id === o.project_id)
    return !p?.paused
  })
  const signals = ((signalsRes.data ?? []) as SignalRow[]).map(toPlannerSignal)

  if (outcomeRows.length === 0) return { status: 'no_outcomes', day, window }

  const { data: milestoneData } = await supabase
    .from('milestones')
    .select('id, outcome_id, title, estimated_minutes, position, status, focus_week, candidates')
    .eq('user_id', userId)
    .in(
      'outcome_id',
      outcomeRows.map((o) => o.id)
    )
  const milestones = ((milestoneData ?? []) as MilestoneRow[]).map(toPlannerMilestone)

  const outcomes: PlannerOutcome[] = outcomeRows.map((o) => {
    const p = projects.find((x) => x.id === o.project_id)
    return {
      id: o.id,
      title: o.title,
      projectId: o.project_id,
      projectName: p?.name ?? null,
      weight: o.weight ?? 2,
      targetDate: o.target_date,
      status: o.status,
    }
  })

  // ---- select (code) ----------------------------------------------------
  const cwdProject = projectForPath(projects, input.cwd)
  const ranked = scoreOutcomes({
    outcomes,
    milestones,
    signals,
    now,
    today,
    cwdProjectId: cwdProject?.id ?? null,
    weekStart,
  })
  const top: ScoredOutcome = ranked[0]
  const outcome = top.outcome
  const outcomeRow = outcomeRows.find((o) => o.id === outcome.id)!
  const project = projects.find((p) => p.id === outcome.projectId) ?? null
  const disagreement = disagreementLine(ranked, cwdProject?.id ?? null)
    ? `${disagreementLine(ranked, cwdProject?.id ?? null)} fos start ${(top.outcome.projectName ?? '').toLowerCase()} to switch.`
    : null

  const outcomeMilestones = milestones
    .filter((m) => m.outcomeId === outcome.id)
    .sort((a, b) => a.position - b.position)
  const milestone = top.activeMilestone
  const milestoneIndex = milestone ? outcomeMilestones.findIndex((m) => m.id === milestone.id) : -1

  const projectSignals = signals.filter((s) => s.projectId === outcome.projectId)
  const pace = observedPace({ signals, now })
  const projectPace = outcome.projectId ? (pace[outcome.projectId] ?? 0) : 0
  const remaining = remainingMinutes(outcomeMilestones)
  const paceText =
    outcomeMilestones.length > 0
      ? paceLine({
          remaining,
          paceMinutesPerWeek: projectPace,
          targetDate: outcome.targetDate,
          now,
          formatDate: (d) => formatInTimeZone(d, timeZone, 'MMM d'),
        })
      : null

  // ---- previous block on this outcome (today or yesterday) ---------------
  const dayStart = new Date(`${today}T00:00:00Z`).getTime() - 36 * 3600 * 1000
  const { data: recentBlocks } = await supabase
    .from('plan_blocks')
    .select(
      'id, outcome_id, project_id, milestone_id, deliverable, rationale, starts_at, ends_at, status, confidence, evidence_signal_ids, start_command, expected_paths, resolved_by'
    )
    .eq('user_id', userId)
    .gte('starts_at', new Date(dayStart).toISOString())
    .order('starts_at', { ascending: false })
    .limit(20)
  const blocks = (recentBlocks ?? []) as BlockRow[]

  // A block already covering this window is reused rather than regenerated.
  const existing = input.userNote
    ? null
    : blocks.find((b) => {
        const s = new Date(b.starts_at).getTime()
        const e = new Date(b.ends_at).getTime()
        const overlaps = s < window.end.getTime() && e > window.start.getTime()
        return overlaps && b.status === 'planned'
      }) ?? null

  const lastResolved = blocks.find((b) => b.outcome_id === outcome.id && b.status !== 'planned') ?? null
  const lastBlock: LastBlockSummary | null = lastResolved
    ? {
        deliverable: lastResolved.deliverable,
        status: lastResolved.status,
        confidence: lastResolved.confidence,
        endedAt: new Date(lastResolved.ends_at),
      }
    : null

  const windowEndsWith = (() => {
    const next = day.events.find((e) => e.busy && Math.abs(e.start.getTime() - window.end.getTime()) < 60_000)
    return next ? next.title : null
  })()

  const base = {
    day,
    window,
    outcome: { id: outcome.id, title: outcome.title, projectName: outcome.projectName },
    milestone: milestone
      ? { id: milestone.id, title: milestone.title, index: milestoneIndex, count: outcomeMilestones.length }
      : null,
    disagreement,
    ranked: ranked.map((r) => ({ outcomeId: r.outcome.id, title: r.outcome.title, score: r.score })),
  }

  const cardData = (block: BlockRow, source: CardData['source']): CardData => ({
    timeZone,
    now,
    window,
    windowEndsWith,
    project: outcome.projectName,
    outcome: outcome.title,
    targetDate: outcome.targetDate,
    milestone: milestone ? { title: milestone.title, index: milestoneIndex, count: outcomeMilestones.length } : null,
    deliverable: block.deliverable,
    rationale: block.rationale,
    observed: observedLine(projectSignals.slice(0, 8), timeZone, repoLabel(project?.repo_path ?? null)),
    paceLine: paceText,
    startCommand: block.start_command,
    disagreement,
    previous: previousLine(
      blocks.find((b) => b.id !== block.id && b.status !== 'planned') ?? null,
      timeZone,
      signals
    ),
    source,
    signalsAsOf: signals[0]?.occurredAt ?? now,
  })

  const finish = (block: BlockRow, source: 'model' | 'fallback' | 'existing'): BuildResult => ({
    status: 'ok',
    text: renderCard(cardData(block, source)),
    block: {
      id: block.id,
      deliverable: block.deliverable,
      rationale: block.rationale,
      startsAt: block.starts_at,
      endsAt: block.ends_at,
      status: block.status,
      startCommand: block.start_command,
      expectedPaths: block.expected_paths ?? [],
    },
    source,
    ...base,
  })

  if (existing) return finish(existing, 'existing')

  // ---- one model turn ----------------------------------------------------
  const usage = await readUsage(supabase, userId, today)
  const capped = overCeiling(usage)
  if (capped) return { status: 'capped', reason: capped, day, window }

  const forbiddenTitles = [
    ...projects.map((p) => p.name),
    ...outcomes.map((o) => o.title),
    ...outcomeMilestones.map((m) => m.title),
  ]

  const turn = await runCardTurn({
    context: {
      timeZone,
      window,
      outcome: { ...outcome, definitionOfDone: outcomeRow.definition_of_done },
      milestone,
      milestoneIndex: Math.max(0, milestoneIndex),
      milestoneCount: outcomeMilestones.length,
      recentSignals: projectSignals.slice(0, 5),
      lastBlock,
      paceLine: paceText ?? 'no ladder yet',
      repoPath: project?.repo_path ?? null,
      userNote: input.userNote ?? null,
    },
    forbiddenTitles,
    existingBlocks: blocks
      .filter((b) => b.status === 'planned')
      .map((b) => ({ start: new Date(b.starts_at), end: new Date(b.ends_at) })),
  })

  // ---- persist -----------------------------------------------------------
  const { data: plan } = await supabase
    .from('daily_plans')
    .upsert(
      { user_id: userId, plan_date: today, timezone: timeZone, calendar_snapshot: day.events, status: 'accepted', origin: 'daily' },
      { onConflict: 'user_id,plan_date' }
    )
    .select('id')
    .single()

  // If a note redirected us, the block it replaces is retired, not deleted.
  if (input.userNote) {
    await supabase
      .from('plan_blocks')
      .update({ status: 'skipped', resolved_by: 'user', resolved_at: now.toISOString() })
      .eq('user_id', userId)
      .eq('status', 'planned')
      .lt('starts_at', window.end.toISOString())
      .gt('ends_at', window.start.toISOString())
  }

  const { data: inserted, error: insertError } = await supabase
    .from('plan_blocks')
    .insert({
      user_id: userId,
      plan_id: plan?.id,
      outcome_id: outcome.id,
      project_id: outcome.projectId,
      milestone_id: milestone?.id ?? null,
      deliverable: turn.proposal.deliverable,
      rationale: turn.proposal.rationale,
      starts_at: turn.startsAt.toISOString(),
      ends_at: turn.endsAt.toISOString(),
      position: blocks.length,
      status: 'planned',
      expected_paths: turn.proposal.expected_paths,
      start_command: turn.proposal.start_command,
      selection: { score: top.score, terms: top.terms, cwdProjectId: cwdProject?.id ?? null, source: turn.source },
    })
    .select(
      'id, outcome_id, project_id, milestone_id, deliverable, rationale, starts_at, ends_at, status, confidence, evidence_signal_ids, start_command, expected_paths, resolved_by'
    )
    .single()

  if (insertError || !inserted) {
    throw new Error(`Failed to save block: ${insertError?.message ?? 'no row returned'}`)
  }

  const usd = usdFor(CARD_MODEL, turn.usage)
  await Promise.all([
    supabase.from('agent_messages').insert(
      turn.messages.map((m) => ({
        user_id: userId,
        role: m.role,
        content: m.content,
        plan_date: today,
        session_kind: 'card',
      }))
    ),
    recordUsage(supabase, userId, today, turn.usage, usd),
    supabase.from('session_events').insert({
      user_id: userId,
      event: 'card_generated',
      event_date: today,
      usd,
      latency_ms: turn.latencyMs,
      metadata: {
        block_id: inserted.id,
        source: turn.source,
        attempts: turn.attempts,
        model: CARD_MODEL,
        input_tokens: turn.usage.input_tokens,
        output_tokens: turn.usage.output_tokens,
        cache_read: turn.usage.cache_read_input_tokens,
        cache_write: turn.usage.cache_creation_input_tokens,
        stop_reason: turn.stopReason,
        window_minutes: window.minutes,
      },
    }),
  ])

  return finish(inserted as BlockRow, turn.source)
}
