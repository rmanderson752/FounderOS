// src/app/api/chains/runs/[id]/start/route.ts
// "I'm up." Start a chain now: its links are re-laid from this moment.

import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/request'
import { startRun } from '@/lib/chains'
import { replanWeek } from '@/lib/week/plan'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data: run } = await caller.supabase.from('chain_runs').select('id, started_at').eq('id', params.id).eq('user_id', caller.userId).maybeSingle()
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!run.started_at) await startRun(caller.supabase, caller.userId, run.id)
  const week = await replanWeek({ supabase: caller.supabase, userId: caller.userId, origin: new URL(request.url).origin })
  return NextResponse.json({ ok: true, week })
}
