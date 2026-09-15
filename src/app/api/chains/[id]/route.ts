// src/app/api/chains/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/request'

const ANCHORS = new Set(['trigger', 'after_previous', 'clock', 'before_bed'])
const TIME = /^\d{2}:\d{2}(:\d{2})?$/

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const patch: Record<string, unknown> = {}
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim()
  if (typeof body.anchor_kind === 'string') {
    if (!ANCHORS.has(body.anchor_kind)) return NextResponse.json({ error: 'invalid anchor_kind' }, { status: 400 })
    patch.anchor_kind = body.anchor_kind
  }
  if (body.anchor_time !== undefined) {
    if (body.anchor_time !== null && !(typeof body.anchor_time === 'string' && TIME.test(body.anchor_time))) return NextResponse.json({ error: 'anchor_time must be HH:mm' }, { status: 400 })
    patch.anchor_time = body.anchor_time
  }
  if (body.target_minutes !== undefined) patch.target_minutes = body.target_minutes === null ? null : Math.max(15, Math.min(16 * 60, Number(body.target_minutes)))
  if (Array.isArray(body.days_of_week)) patch.days_of_week = body.days_of_week.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  if (typeof body.plannable === 'boolean') patch.plannable = body.plannable
  if (typeof body.protected === 'boolean') patch.protected = body.protected
  if (typeof body.active === 'boolean') patch.active = body.active
  if (Number.isInteger(body.position)) patch.position = body.position
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'nothing to change' }, { status: 400 })
  const { error } = await caller.supabase.from('chains').update(patch).eq('id', params.id).eq('user_id', caller.userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { error } = await caller.supabase.from('chains').delete().eq('id', params.id).eq('user_id', caller.userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
