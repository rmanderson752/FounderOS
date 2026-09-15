// src/hooks/useCard.ts
// The Start Card for the current window, and the controls that correct it.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DayCalendar } from '@/lib/calendar/types'

export interface CardBlock {
  id: string
  deliverable: string
  rationale: string | null
  startsAt: string
  endsAt: string
  status: string
  startCommand: string | null
  expectedPaths: string[]
}

export interface CardResponse {
  status: 'ok' | 'no_calendar' | 'unavailable' | 'no_window' | 'no_outcomes' | 'capped'
  calendarConnected?: boolean
  text: string
  reason?: string
  day?: DayCalendar
  window?: { start: string; end: string; kind: 'now' | 'next'; minutes: number }
  block?: CardBlock
  outcome?: { id: string; title: string; projectName: string | null }
  milestone?: { id: string; title: string; index: number; count: number } | null
  source?: 'model' | 'fallback' | 'existing'
  disagreement?: string | null
}

function reviveDay(day: DayCalendar | undefined): DayCalendar | undefined {
  if (!day) return undefined
  return {
    ...day,
    workWindow: { start: new Date(day.workWindow.start), end: new Date(day.workWindow.end) },
    events: day.events.map((e) => ({ ...e, start: new Date(e.start), end: new Date(e.end) })),
    gaps: day.gaps.map((g) => ({ start: new Date(g.start), end: new Date(g.end) })),
  }
}

export function useCard(note?: string | null) {
  return useQuery({
    queryKey: ['card', note ?? null],
    queryFn: async (): Promise<CardResponse> => {
      const params = new URLSearchParams({ source: 'web' })
      if (note) params.set('note', note)
      const response = await fetch(`/api/card?${params}`)
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to load the card')
      }
      const payload = (await response.json()) as CardResponse
      return { ...payload, day: reviveDay(payload.day) }
    },
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function useResolveBlock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; status: 'done' | 'partial' | 'skipped' | 'planned'; note?: string }) => {
      const response = await fetch(`/api/blocks/${input.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: input.status, note: input.note }),
      })
      if (!response.ok) throw new Error('Failed to update block')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card'] })
    },
  })
}
