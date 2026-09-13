// src/app/api/goals/route.ts
//
// State a goal; get a ladder.
//
// POST creates the outcome, decomposes it once, and stores the milestones.
// Two ways to call it:
//   { title, target_date, project, docs, commits, dry_run: true }
//       → returns the ladder without writing anything (the CLI shows it and
//         asks y/n)
//   { title, target_date, project, ladder }
//       → persists a ladder the caller already has (after the y)
//   { title, target_date, project, docs, commits }
//       → decompose and persist in one step (the web form)
//
// GET lists outcomes with their ladder arithmetic.

import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/request'
import { decomposeOutcome } from '@/lib/decompose/decompose'
import { LadderSchema, type Ladder } from '@/lib/decompose/schema'
import { loadLadder, loadSignals } from '@/lib/goals/ladder'
import { observedPace } from '@/lib/planner/capacity'
import { DECOMPOSE_MODEL, usdFor } from '@/lib/card/anthropic'
import { recordUsage } from '@/lib/card/usage'
import { todayIn } from '@/lib/calendar/day'
import type { Db } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

interface GoalBody {
  title?: string
  target_date?: string | null
  project?: { name: string; repo_path?: string | null } | null
  project_id?: string | null
  weight?: number
  docs?: string | null
  commits?: string[]
  dry_run?: boolean
  ladder?: unknown
}

async function ensureProject(
  supabase: Db,
  userId: string,
  body: GoalBody
): Promise<{ id: string; name: string; repo_path: string | null } | null> {
  if (body.project_id) {
    const { data } = await supabase
      .from('projects')
      .select('id, name, repo_path')
      .eq('user_id', userId)
      .eq('id', body.project_id)
      .maybeSingle()
    return data ?? null
  }
  if (!body.project?.name) return null

  const { data: existing } = await supabase
    .from('projects')
    .select('id, name, repo_path')
    .eq('user_id', userId)
    .ilike('name', body.project.name)
    .maybeSingle()
  if (existing) {
    if (body.project.repo_path && !existing.repo_path) {
      await supabase.from('projects').update({ repo_path: body.project.repo_path }).eq('id', existing.id)
      return { ...existing, repo_path: body.project.repo_path }
    }
    return existing
  }

  const { data: created, error } = await supabase
    .from('projects')
    .insert({ user_id: userId, name: body.project.name, repo_path: body.project.repo_path ?? null })
    .select('id, name, repo_path')
    .single()
  if (error) throw new Error(`Failed to create project: ${error.message}`)
  return created
}

export async function GET(request: NextRequest) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: outcomes } = await caller.supabase
    .from('outcomes')
    .select('id, title, target_date, status, weight, project_id, decomposition_version')
    .eq('user_id', caller.userId)
    .order('status')
    .order('target_date', { ascending: true, nullsFirst: false })

  const rows = (outcomes ?? []) as Array<{ id: string; status: string }>
  const ladders = await Promise.all(rows.map((o) => loadLadder(caller.supabase, caller.userId, o.id)))
  return NextResponse.json({ goals: ladders.filter(Boolean) })
}

export async function POST(request: NextRequest) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as GoalBody | null
  const title = body?.title?.trim()
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })
  if (body?.target_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.target_date)) {
    return NextResponse.json({ error: 'target_date must be yyyy-MM-dd' }, { status: 400 })
  }

  const { supabase, userId } = caller
  const today = todayIn('America/New_York')

  try {
    const project = await ensureProject(supabase, userId, body!)

    const { data: allProjects } = await supabase.from('projects').select('name').eq('user_id', userId)
    const { data: allOutcomes } = await supabase.from('outcomes').select('title').eq('user_id', userId)
    const forbidden = [
      ...((allProjects ?? []) as { name: string }[]).map((p) => p.name),
      ...((allOutcomes ?? []) as { title: string }[]).map((o) => o.title),
      title,
    ]

    let ladder: Ladder
    let provenance: { raw: string; usage: ReturnType<typeof usdFor> | null; rejected: string[] } | null = null

    if (body!.ladder) {
      const parsed = LadderSchema.safeParse(body!.ladder)
      if (!parsed.success) {
        return NextResponse.json({ error: 'ladder does not match the schema', issues: parsed.error.issues }, { status: 400 })
      }
      ladder = parsed.data
    } else {
      const signals = await loadSignals(supabase, userId)
      const paceMin = project ? (observedPace({ signals, now: new Date() })[project.id] ?? 0) : 0
      const result = await decomposeOutcome(
        {
          goal: title,
          targetDate: body!.target_date ?? null,
          projectName: project?.name ?? null,
          docs: body!.docs ?? null,
          commits: body!.commits ?? [],
          paceHoursPerWeek: paceMin > 0 ? Math.round((paceMin / 60) * 10) / 10 : null,
          today,
        },
        forbidden
      )
      ladder = result.ladder
      const usd = usdFor(DECOMPOSE_MODEL, result.usage)
      provenance = { raw: result.raw, usage: usd, rejected: result.rejected }
      await Promise.all([
        recordUsage(supabase, userId, today, result.usage, usd),
        supabase.from('session_events').insert({
          user_id: userId,
          event: 'goal_decomposed',
          event_date: today,
          usd,
          latency_ms: result.latencyMs,
          metadata: {
            dry_run: !!body!.dry_run,
            milestones: ladder.milestones.length,
            rejected: result.rejected,
            input_tokens: result.usage.input_tokens,
            output_tokens: result.usage.output_tokens,
            cache_read: result.usage.cache_read_input_tokens,
          },
        }),
      ])
    }

    if (body!.dry_run) {
      return NextResponse.json({ dry_run: true, ladder, project, rejected: provenance?.rejected ?? [] })
    }

    // ---- persist ------------------------------------------------------
    const { data: outcome, error: outcomeError } = await supabase
      .from('outcomes')
      .insert({
        user_id: userId,
        project_id: project?.id ?? null,
        title,
        definition_of_done: ladder.definition_of_done,
        target_date: body!.target_date ?? null,
        status: 'active',
        weight: body!.weight ?? 2,
        decomposition_version: 1,
        assumptions: ladder.assumptions,
      })
      .select('id')
      .single()
    if (outcomeError || !outcome) throw new Error(outcomeError?.message ?? 'Failed to create outcome')

    const firstOpen = ladder.milestones.findIndex((m) => !m.already_done)
    const { error: milestoneError } = await supabase.from('milestones').insert(
      ladder.milestones.map((m, i) => ({
        user_id: userId,
        outcome_id: outcome.id,
        title: m.title,
        definition_of_done: m.definition_of_done,
        estimated_minutes: m.already_done ? 0 : m.estimated_minutes,
        position: i,
        status: m.already_done ? 'done' : i === firstOpen ? 'active' : 'pending',
        candidates: m.candidates,
        already_done_evidence: m.evidence,
        created_by: 'model',
        decomposition_version: 1,
      }))
    )
    if (milestoneError) throw new Error(milestoneError.message)

    if (provenance) {
      await supabase.from('agent_messages').insert({
        user_id: userId,
        role: 'assistant',
        content: { type: 'decomposition', outcome_id: outcome.id, raw: provenance.raw, rejected: provenance.rejected },
        plan_date: today,
        session_kind: 'decompose',
      })
    }

    const view = await loadLadder(supabase, userId, outcome.id)
    return NextResponse.json({ goal: view, rejected: provenance?.rejected ?? [] }, { status: 201 })
  } catch (error) {
    console.error('Goal creation failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Goal creation failed' }, { status: 500 })
  }
}
