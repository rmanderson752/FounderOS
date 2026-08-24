// src/app/api/calendar/day/route.ts
//
// Today's calendar and its free gaps, computed on the server.
//
// Gap math never runs in the browser: the client cannot be trusted with the
// work window, and the agent's plan validation has to check blocks against the
// same intervals this returns.

import { NextRequest, NextResponse } from 'next/server'
import { formatInTimeZone } from 'date-fns-tz'
import { createClient } from '@/lib/supabase/server'
import { fetchEvents, freshAccessToken, getConnection } from '@/lib/calendar/google'
import {
  computeFreeGaps,
  computeWorkWindow,
  resolveEvents,
  totalMinutes,
} from '@/lib/calendar/gaps'
import type { DayCalendar } from '@/lib/calendar/types'

export const dynamic = 'force-dynamic'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const { origin } = url

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const connection = await getConnection(user.id)
  if (!connection) {
    return NextResponse.json({ connected: false, day: null })
  }

  const timeZone = connection.timezone
  const requested = url.searchParams.get('date')
  if (requested && !DATE_PATTERN.test(requested)) {
    return NextResponse.json({ error: 'date must be yyyy-MM-dd' }, { status: 400 })
  }

  // "Today" means today where the user is, not where the server is.
  const date = requested ?? formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd')

  // The work window for this weekday, if one is configured.
  //
  // `date` is already a calendar date in the user's zone, so read its weekday
  // straight off the UTC-anchored midnight. Converting it through the timezone
  // again would shift the day for zones far from UTC.
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
  const { data: constraint } = await supabase
    .from('schedule_constraints')
    .select('work_start, work_end, is_available')
    .eq('user_id', user.id)
    .eq('day_of_week', weekday)
    .maybeSingle()

  const workStart = constraint?.work_start ?? null
  const workEnd = constraint?.work_end ?? null
  const workWindow = computeWorkWindow({ date, timeZone, workStart, workEnd })

  // A day marked unavailable has no planning surface at all.
  if (constraint?.is_available === false) {
    const day: DayCalendar = {
      date,
      timeZone,
      workWindow,
      events: [],
      gaps: [],
      freeMinutes: 0,
    }
    return NextResponse.json({ connected: true, available: false, day })
  }

  try {
    const accessToken = await freshAccessToken(connection, origin)

    // Widen the fetch by a day either side so events that straddle midnight in
    // the user's zone are still returned.
    const events = await fetchEvents({
      accessToken,
      origin,
      calendarIds: connection.calendarIds,
      timeMin: new Date(workWindow.start.getTime() - 24 * 3600 * 1000),
      timeMax: new Date(workWindow.end.getTime() + 24 * 3600 * 1000),
    })

    const isToday = date === formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd')
    const gaps = computeFreeGaps({
      date,
      timeZone,
      events,
      workStart,
      workEnd,
      // Only today gets trimmed to "now" — a future day is planned in full.
      notBefore: isToday ? new Date() : undefined,
    })

    const day: DayCalendar = {
      date,
      timeZone,
      workWindow,
      events: resolveEvents(events, timeZone),
      gaps,
      freeMinutes: totalMinutes(gaps),
    }

    return NextResponse.json({ connected: true, available: true, day })
  } catch (error) {
    console.error('Failed to build day calendar:', error)
    return NextResponse.json({ error: 'Failed to read calendar' }, { status: 502 })
  }
}
