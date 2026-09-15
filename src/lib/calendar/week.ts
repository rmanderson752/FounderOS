// src/lib/calendar/week.ts
//
// Seven DayCalendars from one Google fetch. Past days carry their events
// but no gaps (nothing is planned into the past); today's gaps are trimmed
// to now; future days are computed in full. Days switched off in the work
// schedule keep their events and get no gaps.

import type { Db } from '@/lib/supabase/types'
import { fetchEvents, freshAccessToken, type CalendarConnection } from './google'
import { computeFreeGaps, computeWorkWindow, resolveEvents, totalMinutes } from './gaps'
import { todayIn } from './day'
import type { CalendarEvent, DayCalendar } from './types'

export interface WeekInput {
  supabase: Db
  userId: string
  /** Null when no calendar is connected: the work window counts as free. */
  connection: CalendarConnection | null
  timeZone?: string
  /** Monday, `yyyy-MM-dd`. */
  weekStart: string
  origin: string
  now?: Date
}

export interface WeekCalendar {
  weekStart: string
  timeZone: string
  days: (DayCalendar & { weekday: number; available: boolean; isPast: boolean; isToday: boolean })[]
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Does a timed or all-day event touch this date in the user's zone? */
function touchesDate(event: CalendarEvent, date: string, dayStart: Date, dayEnd: Date): boolean {
  if (event.allDay) return event.start <= date && event.end > date
  const s = new Date(event.start).getTime()
  const e = new Date(event.end).getTime()
  return s < dayEnd.getTime() && e > dayStart.getTime()
}

export async function buildWeekCalendar(input: WeekInput): Promise<WeekCalendar> {
  const now = input.now ?? new Date()
  const timeZone = input.connection?.timezone ?? input.timeZone ?? 'America/New_York'
  const today = todayIn(timeZone, now)
  const dates = Array.from({ length: 7 }, (_, i) => addDays(input.weekStart, i))

  const { data: constraintRows } = await input.supabase
    .from('schedule_constraints')
    .select('day_of_week, work_start, work_end, is_available')
    .eq('user_id', input.userId)
  const constraints = (constraintRows ?? []) as { day_of_week: number; work_start: string | null; work_end: string | null; is_available: boolean }[]

  const windows = dates.map((date) => {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
    const c = constraints.find((x) => x.day_of_week === weekday)
    return {
      date,
      weekday,
      workStart: c?.work_start ?? null,
      workEnd: c?.work_end ?? null,
      available: c ? c.is_available !== false : weekday >= 1 && weekday <= 5,
      workWindow: computeWorkWindow({ date, timeZone, workStart: c?.work_start ?? null, workEnd: c?.work_end ?? null }),
    }
  })

  // No connection: no events, so every work window is free time. Connecting
  // a calendar later only subtracts.
  const events: CalendarEvent[] = input.connection
    ? await fetchEvents({
        accessToken: await freshAccessToken(input.connection, input.origin, input.supabase),
        origin: input.origin,
        calendarIds: input.connection.calendarIds,
        timeMin: new Date(windows[0].workWindow.start.getTime() - 24 * 3600_000),
        timeMax: new Date(windows[6].workWindow.end.getTime() + 24 * 3600_000),
      })
    : []

  const days = windows.map((w) => {
    const dayStart = new Date(w.workWindow.start.getTime() - 24 * 3600_000)
    const dayEnd = new Date(w.workWindow.end.getTime() + 24 * 3600_000)
    const dayEvents = events.filter((e) => touchesDate(e, w.date, dayStart, dayEnd))
    const isPast = w.date < today
    const isToday = w.date === today
    const gaps =
      isPast || !w.available
        ? []
        : computeFreeGaps({
            date: w.date,
            timeZone,
            events: dayEvents,
            workStart: w.workStart,
            workEnd: w.workEnd,
            notBefore: isToday ? now : undefined,
          })
    return {
      date: w.date,
      weekday: w.weekday,
      timeZone,
      workWindow: w.workWindow,
      events: resolveEvents(dayEvents, timeZone),
      gaps,
      freeMinutes: totalMinutes(gaps),
      available: w.available,
      isPast,
      isToday,
    }
  })

  return { weekStart: input.weekStart, timeZone, days }
}
