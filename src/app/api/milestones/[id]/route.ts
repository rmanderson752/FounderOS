// src/app/api/milestones/[id]/route.ts
// Advance or edit one rung of the ladder. Marking a milestone done activates
// the next pending one so the card keeps moving without a Sunday pass.

import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/request'
import { todayIn } from '@/lib/calendar/day'

const STATUSES = new Set(['pending', 'active', 'done', 'skipped'])

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as
    | { status?: string; title?: string; estimated_minutes?: number; definition_of_done?: string }
    | null
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { data: milestone } = await caller.supabase
    .from('milestones')
    .select('id, outcome_id, position, status')
    .eq('user_id', caller.userId)
    .eq('id', params.id)
    .maybeSingle()
  if (!milestone) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const update: Record<string, unknown> = {}
  if (body.status) {
    if (!STATUSES.has(body.status)) return NextResponse.json({ error: 'invalid status' }, { status: 400 })
    update.status = body.status
  }
  if (body.title?.trim()) update.title = body.title.trim()
  if (body.definition_of_done !== undefined) update.definition_of_done = body.definition_of_done
  if (body.estimated_minutes !== undefined) {
    if (!Number.isInteger(body.estimated_minutes) || body.estimated_minutes < 0) {
      return NextResponse.json({ error: 'estimated_minutes must be a non-negative integer' }, { status: 400 })
    }
    update.estimated_minutes = body.estimated_minutes
  }

  const { error } = await caller.supabase
    .from('milestones')
    .update(update)
    .eq('user_id', caller.userId)
    .eq('id', milestone.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Done (or skipped) → the next pending rung becomes active.
  if (body.status === 'done' || body.status === 'skipped') {
    const { data: next } = await caller.supabase
      .from('milestones')
      .select('id')
      .eq('user_id', caller.userId)
      .eq('outcome_id', milestone.outcome_id)
      .eq('status', 'pending')
      .gt('position', milestone.position)
      .order('position')
      .limit(1)
      .maybeSingle()
    if (next) {
      await caller.supabase.from('milestones').update({ status: 'active' }).eq('id', next.id)
    } else if (body.status === 'done') {
      // Nothing left: propose outcome completion by marking it, the user can revert.
      const { data: remaining } = await caller.supabase
        .from('milestones')
        .select('id')
        .eq('outcome_id', milestone.outcome_id)
        .in('status', ['pending', 'active'])
      if ((remaining ?? []).length === 0) {
        await caller.supabase.from('outcomes').update({ status: 'done' }).eq('id', milestone.outcome_id).eq('user_id', caller.userId)
      }
    }
    await caller.supabase.from('session_events').insert({
      user_id: caller.userId,
      event: 'milestone_resolved',
      event_date: todayIn('America/New_York'),
      metadata: { milestone_id: milestone.id, status: body.status, outcome_id: milestone.outcome_id },
    })
  }

  return NextResponse.json({ ok: true, id: milestone.id })
}
