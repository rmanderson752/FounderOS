// src/app/api/chains/route.ts
// The day template: chains and their links. GET returns it (seeding the
// default four on first use); POST adds a chain.

import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/request'
import { ensureDefaultChains, loadDayTemplate } from '@/lib/chains'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  await ensureDefaultChains(caller.supabase, caller.userId)
  const template = await loadDayTemplate(caller.supabase, caller.userId)
  return NextResponse.json(template)
}

const ANCHORS = new Set(['trigger', 'after_previous', 'clock', 'before_bed'])
const ROLES = new Set(['rise', 'work', 'live', 'winddown', 'custom'])

export async function POST(request: NextRequest) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { name?: string; role?: string; anchor_kind?: string; anchor_time?: string | null; target_minutes?: number | null; days_of_week?: number[]; plannable?: boolean; protected?: boolean } | null
  const name = body?.name?.trim()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (body?.anchor_kind && !ANCHORS.has(body.anchor_kind)) return NextResponse.json({ error: 'invalid anchor_kind' }, { status: 400 })
  if (body?.role && !ROLES.has(body.role)) return NextResponse.json({ error: 'invalid role' }, { status: 400 })
  const { count } = await caller.supabase.from('chains').select('id', { count: 'exact', head: true }).eq('user_id', caller.userId)
  const { data, error } = await caller.supabase
    .from('chains')
    .insert({ user_id: caller.userId, name, role: body?.role ?? 'custom', position: count ?? 0, anchor_kind: body?.anchor_kind ?? 'after_previous', anchor_time: body?.anchor_time ?? null, target_minutes: body?.target_minutes ?? null, days_of_week: body?.days_of_week ?? [0, 1, 2, 3, 4, 5, 6], plannable: body?.plannable ?? false, protected: body?.protected ?? false })
    .select('id')
    .single()
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed' }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
