// src/app/api/week/route.ts
// The week: seven days of events and gaps, every block by kind, due dates,
// commitments. ?start=yyyy-MM-dd (a Monday) defaults to this week.

import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/request'
import { loadWeek } from '@/lib/week/plan'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const url = new URL(request.url)
  const start = url.searchParams.get('start')
  if (start && !/^\d{4}-\d{2}-\d{2}$/.test(start)) return NextResponse.json({ error: 'start must be yyyy-MM-dd' }, { status: 400 })
  try {
    const week = await loadWeek({ supabase: caller.supabase, userId: caller.userId, origin: url.origin, weekStart: start ?? undefined })
    return NextResponse.json(week)
  } catch (error) {
    console.error('Week load failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Week load failed' }, { status: 500 })
  }
}
