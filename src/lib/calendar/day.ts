// src/lib/calendar/day.ts
//
// Build a DayCalendar for one date: the work window, resolved events, and
// free gaps. Extracted from /api/calendar/day so the card builder and the
// daily cron compute gaps through exactly the same path as the timeline.

import { formatInTimeZone } from 'date-fns-tz'
import type { Db } from '@/lib/supabase/types'
import { fetchEvents, freshAccessToken, type CalendarConnection } from './google'
import { computeFreeGaps, computeWorkWindow, resolveEvents, totalMinutes } from './gaps'
import type { DayCalendar } from './types'

export interface DayInput {
  supabase: Db
  userId: string
  connection: CalendarConnection
  /** `yyyy-MM-dd` in the user's zone. Defaults to today. */
  date?: string
  origin: string
  now?: Date
}

export interface DayResult {
  available: boolean
  day: DayCalendar
}

export function todayIn(timeZone: string, now = new Date()): string {
  return formatInTimeZone(now, timeZone, 'yyyy-MM-dd')
}

export async function buildDayCalendar(input: DayInput): Promise<DayResult> {
  const now = input.now ?? new Date()
  const timeZone = input.connection.timezone
  const date = input.date ?? todayIn(timeZone, now)

  // `date` is a calendar date in the user's zone; read its weekday straight
  // off the UTC-anchored midnight so zones far from UTC do not shift the day.
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
  const { data: constraint } = await input.supabase
    .from('schedule_constraints')
    .select('work_start, work_end, is_available')
    .eq('user_id', input.userId)
    .eq('day_of_week', weekday)
    .maybeSingle()

  const workStart = constraint?.work_start ?? null
  const workEnd = constraint?.work_end ?? null
  const workWindow = computeWorkWindow({ date, timeZone, workStart, workEnd })

  if (constraint?.is_available === false) {
    return {
      available: false,
      day: { date, timeZone, workWindow, events: [], gaps: [], freeMinutes: 0 },
    }
  }

  const accessToken = await freshAccessToken(input.connection, input.origin, input.supabase)

  // Widen by a day either side so events straddling midnight still appear.
  const events = await fetchEvents({
    accessToken,
    origin: input.origin,
    calendarIds: input.connection.calendarIds,
    timeMin: new Date(workWindow.start.getTime() - 24 * 3600 * 1000),
    timeMax: new Date(workWindow.end.getTime() + 24 * 3600 * 1000),
  })

  const isToday = date === todayIn(timeZone, now)
  const gaps = computeFreeGaps({
    date,
    timeZone,
    events,
    workStart,
    workEnd,
    // Only today is trimmed to now; a future day is planned in full.
    notBefore: isToday ? now : undefined,
  })

  return {
    available: true,
    day: {
      date,
      timeZone,
      workWindow,
      events: resolveEvents(events, timeZone),
      gaps,
      freeMinutes: totalMinutes(gaps),
    },
  }
}
