// src/lib/signals/ingest.ts
//
// Accept what the hooks observed, attribute it to a project, and re-resolve
// any block the observation might have completed. The resolver is pure
// (lib/planner/resolve); this module is the glue that loads the candidate
// blocks and writes the verdict back with its evidence.

import { resolveBlock, SLACK_MINUTES } from '@/lib/planner/resolve'
import type { PlannerSignal } from '@/lib/planner/types'
import type { Db } from '@/lib/supabase/types'
import { todayIn } from '@/lib/calendar/day'
import { projectForPath } from './attribute'
import { advanceRunForBlock } from '@/lib/chains'

export interface IncomingSignal {
  source: 'git' | 'session' | 'fs' | 'manual' | 'deploy' | 'crm'
  kind: string
  summary?: string
  paths?: string[]
  occurred_at: string
  duration_minutes?: number | null
  external_id?: string | null
  /** Directory the signal came from; used for attribution when project is not named. */
  cwd?: string | null
  project?: string | null
  metadata?: Record<string, unknown>
  integration_id?: string | null
}

export interface IngestResult {
  inserted: number
  duplicates: number
  resolved: Array<{ blockId: string; status: string; confidence: number }>
}

interface ProjectRow {
  id: string
  name: string
  repo_path: string | null
  folder_paths: string[] | null
}

interface BlockRow {
  id: string
  project_id: string | null
  starts_at: string
  ends_at: string
  deliverable: string
  expected_paths: string[] | null
  status: string
}

const MAX_SUMMARY = 600

function clean(text: string | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_SUMMARY)
}

export async function ingestSignals(supabase: Db, userId: string, incoming: IncomingSignal[]): Promise<IngestResult> {
  const { data: projectRows } = await supabase
    .from('projects')
    .select('id, name, repo_path, folder_paths')
    .eq('user_id', userId)
  const projects = (projectRows ?? []) as ProjectRow[]

  const rows = incoming
    .filter((s) => s.occurred_at && !Number.isNaN(Date.parse(s.occurred_at)))
    .map((s) => {
      const byName = s.project ? projects.find((p) => p.name.toLowerCase() === s.project!.toLowerCase()) : null
      const project = byName ?? projectForPath(projects, s.cwd)
      return {
        user_id: userId,
        project_id: project?.id ?? null,
        source: s.source,
        kind: s.kind.slice(0, 40),
        summary: clean(s.summary),
        paths: (s.paths ?? []).slice(0, 50),
        occurred_at: new Date(s.occurred_at).toISOString(),
        duration_minutes: s.duration_minutes ?? null,
        external_id: s.external_id ?? null,
        integration_id: s.integration_id ?? null,
        metadata: { ...(s.metadata ?? {}), cwd: s.cwd ?? null },
      }
    })

  if (rows.length === 0) return { inserted: 0, duplicates: 0, resolved: [] }

  // Dedupe on external_id per user (a queue flush after a retry must not
  // double-count a commit). The unique index is partial (external_id IS NOT
  // NULL), which ON CONFLICT cannot target through PostgREST, so check first
  // and insert only what is new.
  const externalIds = rows.map((r) => r.external_id).filter((id): id is string => !!id)
  let known = new Set<string>()
  if (externalIds.length > 0) {
    const { data: existingRows } = await supabase
      .from('signals')
      .select('external_id')
      .eq('user_id', userId)
      .in('external_id', externalIds)
    known = new Set(((existingRows ?? []) as { external_id: string }[]).map((r) => r.external_id))
  }
  const seen = new Set<string>()
  const fresh = rows.filter((r) => {
    if (!r.external_id) return true
    if (known.has(r.external_id) || seen.has(r.external_id)) return false
    seen.add(r.external_id)
    return true
  })
  if (fresh.length === 0) return { inserted: 0, duplicates: rows.length, resolved: [] }

  const { data: inserted, error } = await supabase
    .from('signals')
    .insert(fresh)
    .select('id, project_id, source, occurred_at, paths, summary, duration_minutes')
  if (error) throw new Error(`Failed to store signals: ${error.message}`)

  const stored = (inserted ?? []) as Array<{
    id: string
    project_id: string | null
    source: PlannerSignal['source']
    occurred_at: string
    paths: string[] | null
    summary: string | null
    duration_minutes: number | null
  }>

  const resolved = await resolveAffectedBlocks(supabase, userId, stored.map((s) => ({ projectId: s.project_id, occurredAt: new Date(s.occurred_at) })))

  return { inserted: stored.length, duplicates: rows.length - stored.length, resolved }
}

/**
 * For every planned block on the same project whose window (± slack) touches
 * a new signal, run the resolver over all signals in that window and write
 * the verdict. Only 'planned' blocks change here; the cron owns 'unobserved'.
 */
export async function resolveAffectedBlocks(
  supabase: Db,
  userId: string,
  touches: Array<{ projectId: string | null; occurredAt: Date }>
): Promise<IngestResult['resolved']> {
  if (touches.length === 0) return []
  const slackMs = SLACK_MINUTES * 60_000
  const earliest = new Date(Math.min(...touches.map((t) => t.occurredAt.getTime())) - 24 * 3600_000)

  const { data: blockRows } = await supabase
    .from('plan_blocks')
    .select('id, project_id, starts_at, ends_at, deliverable, expected_paths, status')
    .eq('user_id', userId)
    .eq('status', 'planned')
    .gte('ends_at', earliest.toISOString())
  const blocks = (blockRows ?? []) as BlockRow[]
  if (blocks.length === 0) return []

  const affected = blocks.filter((b) =>
    touches.some((t) => {
      if (b.project_id && t.projectId !== b.project_id) return false
      const s = new Date(b.starts_at).getTime() - slackMs
      const e = new Date(b.ends_at).getTime() + slackMs
      return t.occurredAt.getTime() >= s && t.occurredAt.getTime() <= e
    })
  )
  if (affected.length === 0) return []

  const from = new Date(Math.min(...affected.map((b) => new Date(b.starts_at).getTime())) - 2 * slackMs)
  const to = new Date(Math.max(...affected.map((b) => new Date(b.ends_at).getTime())) + 2 * slackMs)
  const { data: signalRows } = await supabase
    .from('signals')
    .select('id, project_id, source, occurred_at, paths, summary, duration_minutes')
    .eq('user_id', userId)
    .gte('occurred_at', from.toISOString())
    .lte('occurred_at', to.toISOString())
  const signals: PlannerSignal[] = ((signalRows ?? []) as Array<{
    id: string
    project_id: string | null
    source: PlannerSignal['source']
    occurred_at: string
    paths: string[] | null
    summary: string | null
    duration_minutes: number | null
  }>).map((s) => ({
    id: s.id,
    projectId: s.project_id,
    source: s.source,
    occurredAt: new Date(s.occurred_at),
    paths: s.paths ?? [],
    summary: s.summary ?? '',
    durationMinutes: s.duration_minutes,
  }))

  const results: IngestResult['resolved'] = []
  for (const block of affected) {
    const verdict = resolveBlock({
      block: {
        id: block.id,
        projectId: block.project_id,
        startsAt: new Date(block.starts_at),
        endsAt: new Date(block.ends_at),
        deliverable: block.deliverable,
        expectedPaths: block.expected_paths ?? [],
      },
      signals,
    })
    if (verdict.status === 'unobserved') continue

    await supabase
      .from('plan_blocks')
      .update({
        status: verdict.status,
        confidence: verdict.confidence,
        evidence_signal_ids: verdict.evidenceIds,
        resolved_by: 'observed',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', block.id)
      .eq('user_id', userId)
      .eq('status', 'planned')

    await supabase.from('session_events').insert({
      user_id: userId,
      event: 'block_resolved',
      event_date: todayIn('America/New_York'),
      metadata: { block_id: block.id, status: verdict.status, by: 'observed', confidence: verdict.confidence, evidence: verdict.evidenceIds.length },
    })
    await advanceRunForBlock(supabase, userId, block.id)
    results.push({ blockId: block.id, status: verdict.status, confidence: verdict.confidence })
  }
  return results
}
