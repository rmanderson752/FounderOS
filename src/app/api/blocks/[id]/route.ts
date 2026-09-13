// src/app/api/blocks/[id]/route.ts
//
// Flip a block's status. Every flip is a correction: it records what the
// system believed (from_status, from_confidence) next to what the user said.
// That table is the ground truth the resolver thresholds are tuned against.

import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/request'
import { todayIn } from '@/lib/calendar/day'

const STATUSES = new Set(['planned', 'done', 'partial', 'skipped', 'unobserved'])

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { status?: string; note?: string } | null
  if (!body?.status || !STATUSES.has(body.status)) {
    return NextResponse.json({ error: 'status must be one of planned, done, partial, skipped, unobserved' }, { status: 400 })
  }

  const { data: block } = await caller.supabase
    .from('plan_blocks')
    .select('id, status, confidence')
    .eq('id', params.id)
    .eq('user_id', caller.userId)
    .maybeSingle()
  if (!block) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const now = new Date().toISOString()
  const [{ error }] = await Promise.all([
    caller.supabase
      .from('plan_blocks')
      .update({ status: body.status, resolved_by: 'user', resolved_at: now })
      .eq('id', block.id)
      .eq('user_id', caller.userId),
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
    }),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: block.id, status: body.status })
}
