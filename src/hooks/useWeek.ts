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

/**
 * Patch a block (move, resize, rename, kind, status, lock). Optimistic: the
 * week in the cache is updated immediately so a drag lands where it was
 * dropped; on failure the cache is refetched and the error surfaces.
 */
export function usePatchBlock(start?: string | null) {
  const queryClient = useQueryClient()
  const key = ['week', start ?? 'current']
  return useMutation({
    mutationFn: async (input: { id: string } & Record<string, unknown>) => {
      const { id, ...patch } = input
      const response = await fetch(`/api/blocks/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to update block')
      }
      return response.json()
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<WeekData>(key)
      if (previous) {
        queryClient.setQueryData<WeekData>(key, {
          ...previous,
          blocks: previous.blocks.map((b) => {
            if (b.id !== input.id) return b
            const next = { ...b } as WeekData['blocks'][number] & Record<string, unknown>
            if (typeof input.deliverable === 'string') next.title = input.deliverable
            if (typeof input.kind === 'string') next.kind = input.kind as typeof b.kind
            if (typeof input.starts_at === 'string') {
              next.starts_at = input.starts_at
              next.date = new Date(input.starts_at).toLocaleDateString('en-CA', { timeZone: previous.timeZone })
            }
            if (typeof input.ends_at === 'string') next.ends_at = input.ends_at
            if (typeof input.status === 'string') next.status = input.status
            if (typeof input.locked === 'boolean') next.locked = input.locked
            else if (typeof input.starts_at === 'string' || typeof input.ends_at === 'string') next.locked = true
            return next
          }),
        })
      }
      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
      queryClient.invalidateQueries({ queryKey: ['card'] })
    },
  })
}

export function useCreateBlock(start?: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { title: string; kind: string; starts_at: string; ends_at: string }) => {
      const response = await fetch('/api/blocks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error ?? 'Failed to add block')
      return body as { id: string }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['week', start ?? 'current'] })
      queryClient.invalidateQueries({ queryKey: ['card'] })
    },
  })
}

export function useDeleteBlock(start?: string | null) {
  const queryClient = useQueryClient()
  const key = ['week', start ?? 'current']
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/blocks/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to remove block')
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<WeekData>(key)
      if (previous) queryClient.setQueryData<WeekData>(key, { ...previous, blocks: previous.blocks.filter((b) => b.id !== id) })
      return { previous }
    },
    onError: (_e, _id, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
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
