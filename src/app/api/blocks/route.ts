// src/app/api/blocks/route.ts
// Create a block by hand: the "Add" button, or a click on an empty slot.
// User-made blocks are locked so the planner leaves them where you put them.

import { NextRequest, NextResponse } from 'next/server'
import { formatInTimeZone } from 'date-fns-tz'
import { resolveCaller } from '@/lib/auth/request'
import { getConnection } from '@/lib/calendar/google'
import { todayIn } from '@/lib/calendar/day'

const KINDS = new Set(['goal', 'flexible', 'fixed', 'habit', 'chore', 'free'])

interface Body {
  title?: string
  kind?: string
  starts_at?: string
  ends_at?: string
  outcome_id?: string | null
  milestone_id?: string | null
  project_id?: string | null
  rationale?: string | null
}

export async function POST(request: NextRequest) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as Body | null
  const title = body?.title?.trim()
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })
  const kind = body?.kind ?? 'chore'
  if (!KINDS.has(kind)) return NextResponse.json({ error: 'invalid kind' }, { status: 400 })
  const starts = new Date(body?.starts_at ?? '')
  const ends = new Date(body?.ends_at ?? '')
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) return NextResponse.json({ error: 'starts_at and ends_at are required ISO timestamps' }, { status: 400 })
  const minutes = (ends.getTime() - starts.getTime()) / 60_000
  if (minutes < 5 || minutes > 480) return NextResponse.json({ error: 'a block is 5 minutes to 8 hours' }, { status: 400 })

  const { supabase, userId } = caller
  const connection = await getConnection(userId, supabase)
  const timeZone = connection?.timezone ?? 'America/New_York'
  const date = formatInTimeZone(starts, timeZone, 'yyyy-MM-dd')
  const today = todayIn(timeZone)

  const { data: plan } = await supabase
    .from('daily_plans')
    .upsert({ user_id: userId, plan_date: date, timezone: timeZone, origin: date === today ? 'daily' : 'week_draft', status: 'accepted' }, { onConflict: 'user_id,plan_date' })
    .select('id')
    .single()

  const { data, error } = await supabase
    .from('plan_blocks')
    .insert({
      user_id: userId,
      plan_id: plan?.id,
      deliverable: title,
      rationale: body?.rationale ?? null,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      status: 'planned',
      kind,
      source: 'user',
      locked: true,
      outcome_id: body?.outcome_id ?? null,
      milestone_id: body?.milestone_id ?? null,
      project_id: body?.project_id ?? null,
    })
    .select('id')
    .single()
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed to create block' }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
}
