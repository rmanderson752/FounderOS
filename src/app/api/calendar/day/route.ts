// src/app/api/calendar/day/route.ts
//
// Today's calendar and its free gaps, computed on the server.
//
// Gap math never runs in the browser: the client cannot be trusted with the
// work window, and the card's block validation has to check against the same
// intervals this returns. The computation itself lives in lib/calendar/day.ts
// so the card builder and the daily cron share it.

import { NextRequest, NextResponse } from 'next/server'
import { getConnection } from '@/lib/calendar/google'
import { buildDayCalendar } from '@/lib/calendar/day'
import { resolveCaller } from '@/lib/auth/request'

export const dynamic = 'force-dynamic'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const { origin } = url

  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const connection = await getConnection(caller.userId, caller.supabase)
  if (!connection) {
    return NextResponse.json({ connected: false, day: null })
  }

  const requested = url.searchParams.get('date')
  if (requested && !DATE_PATTERN.test(requested)) {
    return NextResponse.json({ error: 'date must be yyyy-MM-dd' }, { status: 400 })
  }

  try {
    const result = await buildDayCalendar({
      supabase: caller.supabase,
      userId: caller.userId,
      connection,
      date: requested ?? undefined,
      origin,
    })
    return NextResponse.json({ connected: true, ...result })
  } catch (error) {
    console.error('Failed to build day calendar:', error)
    return NextResponse.json({ error: 'Failed to read calendar' }, { status: 502 })
  }
}
