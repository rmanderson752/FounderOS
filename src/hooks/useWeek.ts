// src/hooks/useWeek.ts
// The week calendar, re-planning, drag moves, and the calendar thread.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { WeekView } from '@/lib/week/plan'
import type { DayCalendar } from '@/lib/calendar/types'

export type WeekDayView = DayCalendar & { weekday: number; available: boolean; isPast: boolean; isToday: boolean }
export type WeekData = Omit<WeekView, 'calendar'> & { calendar: WeekDayView[] | null }

function reviveDay<T extends DayCalendar>(day: T): T {
  return {
    ...day,
    workWindow: { start: new Date(day.workWindow.start), end: new Date(day.workWindow.end) },
    events: day.events.map((e) => ({ ...e, start: new Date(e.start), end: new Date(e.end) })),
    gaps: day.gaps.map((g) => ({ start: new Date(g.start), end: new Date(g.end) })),
  }
}

export function reviveWeek(week: WeekView): WeekData {
  return { ...week, calendar: week.calendar ? week.calendar.map((d) => reviveDay(d)) : null }
}

export function useWeek(start?: string | null) {
  return useQuery({
    queryKey: ['week', start ?? 'current'],
    queryFn: async (): Promise<WeekData> => {
      const params = start ? `?start=${start}` : ''
      const response = await fetch(`/api/week${params}`)
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to load the week')
      }
      return reviveWeek((await response.json()) as WeekView)
    },
    staleTime: 60_000,
    retry: false,
  })
}

export function usePlanWeek(start?: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<WeekData> => {
      const response = await fetch('/api/week/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ start: start ?? undefined }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Failed to plan the week')
      return reviveWeek(body as WeekView)
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['week', start ?? 'current'], data)
      queryClient.invalidateQueries({ queryKey: ['card'] })
    },
  })
}

export function useMoveBlock(start?: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; starts_at: string; ends_at: string }) => {
      const response = await fetch(`/api/blocks/${input.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ starts_at: input.starts_at, ends_at: input.ends_at }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to move block')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['week', start ?? 'current'] })
      queryClient.invalidateQueries({ queryKey: ['card'] })
    },
  })
}

export function useDeleteBlock(start?: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/blocks/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to remove block')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['week', start ?? 'current'] })
      queryClient.invalidateQueries({ queryKey: ['card'] })
    },
  })
}

export function useWeekChat(start?: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (message: string): Promise<{ reply: string; tools: string[]; week: WeekData }> => {
      const response = await fetch('/api/week/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message, start: start ?? undefined }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'The planner could not do that')
      return { reply: body.reply, tools: body.tools, week: reviveWeek(body.week as WeekView) }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['week', start ?? 'current'], data.week)
      queryClient.invalidateQueries({ queryKey: ['week'] })
      queryClient.invalidateQueries({ queryKey: ['card'] })
      queryClient.invalidateQueries({ queryKey: ['goals-v4'] })
    },
  })
}
