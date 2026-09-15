// src/lib/card/chain.ts
//
// The Start Card as the next link. When today is laid out as chains, the
// card is not a model turn: it is the first planned link of the chain you are
// in, with what came before it ticked and what follows in view.
//
//   Rise · Gym ✓ → Coffee + LeetCode ✓ → NOW Wire Supabase sign-in on SignInScreen.tsx (2h)
//   HNRY → Auth + onboarding
//   then: Outreach block (1h30) · after Work: Live at 5:00 PM
//   Observed: 6 commits on ~/hnry Tue–Wed. Session Wed 4:10pm.
//   Start: cd ~/hnry && claude "…"
//   Signals as of 9:04.  fos done · fos skip · fos no "…"

import { formatInTimeZone } from 'date-fns-tz'
import type { Db } from '@/lib/supabase/types'
import type { PlannerSignal } from '@/lib/planner/types'
import { formatMinutes, observedLine } from './render'

export interface ChainCard {
  text: string
  block: {
    id: string
    deliverable: string
    rationale: string | null
    startsAt: string
    endsAt: string
    status: string
    startCommand: string | null
    expectedPaths: string[]
    kind: string
  }
  run: { id: string; chainName: string; role: string; started: boolean; position: number; count: number }
  outcome: { id: string; title: string; projectName: string | null } | null
  milestone: { id: string; title: string } | null
}

interface RunRow {
  id: string
  chain_id: string
  anchor_at: string
  started_at: string | null
  status: string
  current_position: number
}
interface BlockRow {
  id: string
  chain_run_id: string | null
  link_position: number | null
  deliverable: string
  rationale: string | null
  starts_at: string
  ends_at: string
  status: string
  kind: string
  outcome_id: string | null
  milestone_id: string | null
  project_id: string | null
  expected_paths: string[] | null
  start_command: string | null
}

const clock12 = (d: Date, tz: string) => formatInTimeZone(d, tz, 'h:mm a')

export async function chainCard(input: {
  supabase: Db
  userId: string
  today: string
  timeZone: string
  now: Date
  signals: PlannerSignal[]
  projects: { id: string; name: string; repo_path: string | null }[]
}): Promise<ChainCard | null> {
  const { supabase, userId, today, timeZone, now } = input

  const { data: runRows } = await supabase
    .from('chain_runs')
    .select('id, chain_id, anchor_at, started_at, status, current_position')
    .eq('user_id', userId)
    .eq('run_date', today)
    .order('anchor_at')
  const runs = (runRows ?? []) as RunRow[]
  if (runs.length === 0) return null

  const [{ data: chainRows }, { data: blockRows }] = await Promise.all([
    supabase.from('chains').select('id, name, role').eq('user_id', userId),
    supabase
      .from('plan_blocks')
      .select('id, chain_run_id, link_position, deliverable, rationale, starts_at, ends_at, status, kind, outcome_id, milestone_id, project_id, expected_paths, start_command')
      .eq('user_id', userId)
      .in('chain_run_id', runs.map((r) => r.id))
      .order('link_position'),
  ])
  const chains = (chainRows ?? []) as { id: string; name: string; role: string }[]
  const blocks = (blockRows ?? []) as BlockRow[]

  // The run you are in: the first, by anchor, that still has a planned link.
  const withNext = runs
    .map((r) => ({ run: r, own: blocks.filter((b) => b.chain_run_id === r.id).sort((a, b) => (a.link_position ?? 0) - (b.link_position ?? 0)) }))
    .map((x) => ({ ...x, next: x.own.find((b) => b.status === 'planned') ?? null }))
  const current = withNext.find((x) => x.next && x.run.status !== 'done') ?? null
  if (!current || !current.next) return null

  const chain = chains.find((c) => c.id === current.run.chain_id)
  const next = current.next
  const before = current.own.filter((b) => (b.link_position ?? 0) < (next.link_position ?? 0))
  const after = current.own.filter((b) => (b.link_position ?? 0) > (next.link_position ?? 0))
  const following = withNext.find((x) => x.run.anchor_at > current.run.anchor_at)
  const followingChain = following ? chains.find((c) => c.id === following.run.chain_id) : null

  const minutes = Math.round((new Date(next.ends_at).getTime() - new Date(next.starts_at).getTime()) / 60_000)
  const startsInFuture = new Date(next.starts_at).getTime() > now.getTime() + 5 * 60_000
  const label = startsInFuture ? `NEXT ${clock12(new Date(next.starts_at), timeZone)}` : 'NOW'

  let outcome: ChainCard['outcome'] = null
  let milestone: ChainCard['milestone'] = null
  let project: { id: string; name: string; repo_path: string | null } | null = null
  if (next.outcome_id) {
    const [{ data: o }, { data: m }] = await Promise.all([
      supabase.from('outcomes').select('id, title, project_id').eq('id', next.outcome_id).maybeSingle(),
      next.milestone_id ? supabase.from('milestones').select('id, title').eq('id', next.milestone_id).maybeSingle() : Promise.resolve({ data: null }),
    ])
    project = input.projects.find((p) => p.id === (o?.project_id ?? next.project_id)) ?? null
    if (o) outcome = { id: o.id, title: o.title, projectName: project?.name ?? null }
    if (m) milestone = { id: m.id, title: m.title }
  }

  const startCommand =
    next.start_command ??
    (next.kind === 'goal' && project?.repo_path ? `cd ${project.repo_path} && claude "${next.deliverable.replace(/"/g, '\\"').slice(0, 140)}"` : null)

  const tick = (b: BlockRow) => (b.status === 'done' ? '✓' : b.status === 'partial' ? '◐' : b.status === 'skipped' || b.status === 'unobserved' ? '–' : '·')
  const head = [
    `${chain?.name ?? 'Chain'}${current.run.started_at ? '' : ' (not started)'}`,
    ...before.map((b) => `${b.deliverable.slice(0, 28)} ${tick(b)}`),
    `${label} ${next.deliverable} (${formatMinutes(minutes)})`,
  ].join(' → ')

  const lines: string[] = [head]
  if (outcome) lines.push(`${outcome.projectName ? outcome.projectName + ' → ' : ''}${outcome.title}${milestone ? ` → ${milestone.title}` : ''}`)
  else if (next.rationale) lines.push(next.rationale)

  const thenParts = after.slice(0, 3).map((b) => `${b.deliverable.slice(0, 40)} (${formatMinutes(Math.round((new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60_000))})`)
  const afterChain = followingChain ? `after ${chain?.name ?? 'this'}: ${followingChain.name} at ${clock12(new Date(following!.run.anchor_at), timeZone)}` : null
  if (thenParts.length || afterChain) lines.push(`then: ${[...thenParts, afterChain].filter(Boolean).join(' · ')}`)

  if (next.kind === 'goal') {
    const projectSignals = input.signals.filter((s) => s.projectId === (project?.id ?? next.project_id))
    lines.push(`Observed: ${observedLine(projectSignals.slice(0, 8), timeZone, project?.repo_path ? project.repo_path.replace(/^\/Users\/[^/]+/, '~') : null)}`)
  }
  if (startCommand) lines.push(`Start: ${startCommand}`)
  lines.push(`Signals as of ${clock12(input.signals[0]?.occurredAt ?? now, timeZone)}.  fos done · fos skip · fos no "…" to redirect`)

  return {
    text: lines.join('\n'),
    block: {
      id: next.id,
      deliverable: next.deliverable,
      rationale: next.rationale,
      startsAt: next.starts_at,
      endsAt: next.ends_at,
      status: next.status,
      startCommand,
      expectedPaths: next.expected_paths ?? [],
      kind: next.kind,
    },
    run: { id: current.run.id, chainName: chain?.name ?? 'Chain', role: chain?.role ?? 'custom', started: !!current.run.started_at, position: (next.link_position ?? 0) + 1, count: current.own.length },
    outcome,
    milestone,
  }
}
