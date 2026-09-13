// src/app/api/goals/[id]/route.ts
// One goal's ladder, and the few things about a goal the user may change.

import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/request'
import { loadLadder, renderLadder } from '@/lib/goals/ladder'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const view = await loadLadder(caller.supabase, caller.userId, params.id)
  if (!view) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (new URL(request.url).searchParams.get('format') === 'text') {
    return new NextResponse(renderLadder(view) + '\n', { headers: { 'content-type': 'text/plain; charset=utf-8' } })
  }
  return NextResponse.json({ goal: view })
}

const STATUSES = new Set(['active', 'paused', 'done', 'abandoned'])

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as
    | { status?: string; weight?: number; target_date?: string | null; title?: string; definition_of_done?: string }
    | null
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (body.status) {
    if (!STATUSES.has(body.status)) return NextResponse.json({ error: 'invalid status' }, { status: 400 })
    update.status = body.status
  }
  if (body.weight !== undefined) {
    if (![1, 2, 3].includes(body.weight)) return NextResponse.json({ error: 'weight must be 1, 2 or 3' }, { status: 400 })
    update.weight = body.weight
  }
  if (body.target_date !== undefined) {
    if (body.target_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.target_date)) {
      return NextResponse.json({ error: 'target_date must be yyyy-MM-dd' }, { status: 400 })
    }
    update.target_date = body.target_date
  }
  if (body.title?.trim()) update.title = body.title.trim()
  if (body.definition_of_done !== undefined) update.definition_of_done = body.definition_of_done

  const { error } = await caller.supabase
    .from('outcomes')
    .update(update)
    .eq('user_id', caller.userId)
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const view = await loadLadder(caller.supabase, caller.userId, params.id)
  return NextResponse.json({ goal: view })
}
