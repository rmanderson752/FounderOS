// src/app/api/blocks/[id]/route.ts
//
// Two kinds of change to a block:
//   status  — a correction. Records what the system believed (from_status,
//             from_confidence) next to what the user said; that table is the
//             ground truth the resolver is tuned against.
//   time    — a move (drag on the calendar, or "push it to Thursday"). Sets
//             locked so the planner leaves it alone from then on.
// DELETE removes a block the user does not want this week.

import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/request'
import { todayIn } from '@/lib/calendar/day'

const STATUSES = new Set(['planned', 'done', 'partial', 'skipped', 'unobserved'])

interface Body {
  status?: string
  note?: string
  starts_at?: string
  ends_at?: string
  locked?: boolean
  deliverable?: string
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as Body | null
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { data: block } = await caller.supabase
    .from('plan_blocks')
    .select('id, status, confidence, starts_at, ends_at, kind')
    .eq('id', params.id)
    .eq('user_id', caller.userId)
    .maybeSingle()
  if (!block) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const now = new Date().toISOString()
  const update: Record<string, unknown> = {}
  const writes: PromiseLike<unknown>[] = []

  if (body.status) {
    if (!STATUSES.has(body.status)) return NextResponse.json({ error: 'invalid status' }, { status: 400 })
    update.status = body.status
    update.resolved_by = 'user'
    update.resolved_at = now
    writes.push(
      caller.supabase.from('resolution_corrections').insert({
        user_id: caller.userId,
        block_id: block.id,
        from_status: block.status,
        to_status: body.status,
        from_confidence: block.confidence,
        note: body.note ?? null,
      }),
      caller.supabase.from('session_events').insert({
        user_id: caller.userId,
        event: 'block_resolved',
        event_date: todayIn('America/New_York'),
        metadata: { block_id: block.id, status: body.status, by: 'user', from: block.status },
      })
    )
  }

  if (body.starts_at || body.ends_at) {
    const starts = new Date(body.starts_at ?? block.starts_at)
    const ends = new Date(body.ends_at ?? block.ends_at)
    if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) return NextResponse.json({ error: 'invalid timestamps' }, { status: 400 })
    const minutes = (ends.getTime() - starts.getTime()) / 60_000
    if (minutes < 5) return NextResponse.json({ error: 'a block must be at least 5 minutes' }, { status: 400 })
    if (block.kind === 'goal' && minutes > 240) return NextResponse.json({ error: 'a goal block is at most 4 hours' }, { status: 400 })
    update.starts_at = starts.toISOString()
    update.ends_at = ends.toISOString()
    update.locked = body.locked ?? true
    writes.push(
      caller.supabase.from('session_events').insert({
        user_id: caller.userId,
        event: 'block_moved',
        event_date: todayIn('America/New_York'),
        metadata: { block_id: block.id, from: [block.starts_at, block.ends_at], to: [update.starts_at, update.ends_at] },
      })
    )
  } else if (body.locked !== undefined) {
    update.locked = body.locked
  }

  if (body.deliverable?.trim()) update.deliverable = body.deliverable.trim()

  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'nothing to change' }, { status: 400 })

  const [{ error }] = await Promise.all([
    caller.supabase.from('plan_blocks').update(update).eq('id', block.id).eq('user_id', caller.userId),
    ...writes,
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: block.id, ...update })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { error } = await caller.supabase.from('plan_blocks').delete().eq('id', params.id).eq('user_id', caller.userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
