// src/lib/goals/ladder.ts
//
// Read a goal's ladder with the arithmetic the page and the CLI both show:
// remaining minutes, observed pace, projected completion, expected-by dates.
// Every query filters by user_id because callers may hold the admin client.

import { formatInTimeZone } from 'date-fns-tz'
import type { Db } from '@/lib/supabase/types'
import { observedPace, paceLine, projectedCompletion, remainingMinutes } from '@/lib/planner/capacity'
import { rechainDates } from '@/lib/planner/rechain'
import type { Candidate, PlannerMilestone, PlannerSignal } from '@/lib/planner/types'

export interface LadderView {
  outcome: {
    id: string
    title: string
    definition_of_done: string | null
    target_date: string | null
    status: string
    weight: number
    assumptions: string[]
    decomposition_version: number
    project: { id: string; name: string; repo_path: string | null } | null
  }
  milestones: Array<{
    id: string
    title: string
    definition_of_done: string | null
    estimated_minutes: number
    position: number
    status: string
    expected_by: string | null
    projected_by: string | null
    focus_week: string | null
    candidates: Candidate[]
    already_done_evidence: unknown[]
  }>
  remaining_minutes: number
  pace_minutes_per_week: number
  projected_completion: string | null
  pace_line: string
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

export async function loadSignals(supabase: Db, userId: string, days = 28): Promise<PlannerSignal[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data } = await supabase
    .from('signals')
    .select('id, project_id, source, occurred_at, paths, summary, duration_minutes')
    .eq('user_id', userId)
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: false })
    .limit(1000)
  return ((data ?? []) as SignalRow[]).map((s) => ({
    id: s.id,
    projectId: s.project_id,
    source: s.source,
    occurredAt: new Date(s.occurred_at),
    paths: s.paths ?? [],
    summary: s.summary ?? '',
    durationMinutes: s.duration_minutes,
  }))
}

export async function loadLadder(
  supabase: Db,
  userId: string,
  outcomeId: string,
  timeZone = 'America/New_York'
): Promise<LadderView | null> {
  const { data: outcome } = await supabase
    .from('outcomes')
    .select('id, title, definition_of_done, target_date, status, weight, assumptions, decomposition_version, project_id')
    .eq('user_id', userId)
    .eq('id', outcomeId)
    .maybeSingle()
  if (!outcome) return null

  const [{ data: milestoneRows }, projectRes, signals] = await Promise.all([
    supabase
      .from('milestones')
      .select(
        'id, title, definition_of_done, estimated_minutes, position, status, expected_by, focus_week, candidates, already_done_evidence'
      )
      .eq('user_id', userId)
      .eq('outcome_id', outcomeId)
      .order('position'),
    outcome.project_id
      ? supabase.from('projects').select('id, name, repo_path').eq('id', outcome.project_id).maybeSingle()
      : Promise.resolve({ data: null }),
    loadSignals(supabase, userId),
  ])
  const project = projectRes.data as { id: string; name: string; repo_path: string | null } | null

  const milestones = (milestoneRows ?? []) as LadderView['milestones']
  const planner: PlannerMilestone[] = milestones.map((m) => ({
    id: m.id,
    outcomeId,
    title: m.title,
    estimatedMinutes: m.estimated_minutes,
    position: m.position,
    status: m.status as PlannerMilestone['status'],
    focusWeek: m.focus_week,
    candidates: Array.isArray(m.candidates) ? m.candidates : [],
  }))

  const now = new Date()
  const pace = outcome.project_id ? (observedPace({ signals, now })[outcome.project_id] ?? 0) : 0
  const remaining = remainingMinutes(planner)
  const projected = projectedCompletion(remaining, pace, now)
  const rechained = rechainDates({ milestones: planner, paceMinutesPerWeek: pace, now })

  return {
    outcome: {
      id: outcome.id,
      title: outcome.title,
      definition_of_done: outcome.definition_of_done,
      target_date: outcome.target_date,
      status: outcome.status,
      weight: outcome.weight ?? 2,
      assumptions: outcome.assumptions ?? [],
      decomposition_version: outcome.decomposition_version ?? 0,
      project,
    },
    milestones: milestones.map((m) => ({
      ...m,
      candidates: Array.isArray(m.candidates) ? m.candidates : [],
      already_done_evidence: Array.isArray(m.already_done_evidence) ? m.already_done_evidence : [],
      projected_by: rechained.find((r) => r.id === m.id)?.expectedBy ?? null,
    })),
    remaining_minutes: remaining,
    pace_minutes_per_week: pace,
    projected_completion: projected ? formatInTimeZone(projected, timeZone, 'yyyy-MM-dd') : null,
    pace_line: paceLine({
      remaining,
      paceMinutesPerWeek: pace,
      targetDate: outcome.target_date,
      now,
      formatDate: (d) => formatInTimeZone(d, timeZone, 'MMM d'),
    }),
  }
}

/** Plain-text ladder for the terminal. */
export function renderLadder(view: LadderView): string {
  const lines: string[] = []
  const head = [view.outcome.project?.name, view.outcome.title].filter(Boolean).join(' → ')
  lines.push(`${head}${view.outcome.target_date ? ` by ${view.outcome.target_date}` : ''}`)
  if (view.outcome.definition_of_done) lines.push(`Done when: ${view.outcome.definition_of_done}`)
  lines.push('')
  view.milestones.forEach((m, i) => {
    const mark = m.status === 'done' ? '✓' : m.status === 'active' ? '▶' : m.status === 'skipped' ? '–' : '○'
    const hours = Math.round((m.estimated_minutes / 60) * 10) / 10
    const when = m.status === 'done' ? '' : m.projected_by ? `  ~${m.projected_by}` : ''
    lines.push(`${mark} ${i + 1}. ${m.title}  (${hours}h)${when}`)
    for (const c of m.candidates.slice(0, 4)) {
      lines.push(`     · ${c.deliverable} (${c.estimated_minutes}m)`)
    }
  })
  lines.push('')
  lines.push(`Pace: ${view.pace_line}`)
  if (view.outcome.assumptions.length) {
    lines.push(`Assumed: ${view.outcome.assumptions.join('; ')}`)
  }
  return lines.join('\n')
}
