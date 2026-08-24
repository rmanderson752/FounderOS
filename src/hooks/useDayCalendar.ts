// src/hooks/useDayCalendar.ts
// Today's events and free gaps, computed server-side.

import { useQuery } from '@tanstack/react-query'
import type { DayCalendar } from '@/lib/calendar/types'

export interface DayCalendarResponse {
  connected: boolean
  available?: boolean
  day: DayCalendar | null
}

/** JSON carries instants as strings; revive the ones we treat as Dates. */
function reviveDay(day: DayCalendar | null): DayCalendar | null {
  if (!day) return null
  return {
    ...day,
    workWindow: {
      start: new Date(day.workWindow.start),
      end: new Date(day.workWindow.end),
    },
    events: day.events.map((e) => ({
      ...e,
      start: new Date(e.start),
      end: new Date(e.end),
    })),
    gaps: day.gaps.map((g) => ({ start: new Date(g.start), end: new Date(g.end) })),
  }
}

export function useDayCalendar(date?: string) {
  return useQuery({
    queryKey: ['day-calendar', date ?? 'today'],
    queryFn: async (): Promise<DayCalendarResponse> => {
      const query = date ? `?date=${date}` : ''
      const response = await fetch(`/api/calendar/day${query}`)
      if (!response.ok) throw new Error('Failed to load calendar')
      const payload = (await response.json()) as DayCalendarResponse
      return { ...payload, day: reviveDay(payload.day) }
    },
    // Calendars change under you; refetch when the tab regains focus.
    staleTime: 60_000,
  })
}
