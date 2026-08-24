// src/hooks/useGoogleCalendar.ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface CalendarStatus {
  connected: boolean
  calendarId?: string
  lastSynced?: string
}

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
}

interface SyncResult {
  success: boolean
  created: number
  updated: number
  deleted: number
  total: number
}

export function useCalendarStatus() {
  return useQuery<CalendarStatus>({
    queryKey: ['gcal-status'],
    queryFn: async () => {
      const res = await fetch('/api/google/calendar/status')
      if (!res.ok) return { connected: false }
      return res.json()
    },
    staleTime: 30 * 1000, // 30 seconds
  })
}

export function useCalendarEvents(date: string) {
  const { data: status } = useCalendarStatus()

  return useQuery<CalendarEvent[]>({
    queryKey: ['gcal-events', date],
    queryFn: async () => {
      const res = await fetch(`/api/google/calendar/events?date=${date}`)
      if (!res.ok) return []
      const data = await res.json()
      return data.events || []
    },
    enabled: !!status?.connected && !!date,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useCalendarSync() {
  const queryClient = useQueryClient()

  return useMutation<SyncResult>({
    mutationFn: async () => {
      const res = await fetch('/api/google/calendar/sync', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Sync failed')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gcal-status'] })
      queryClient.invalidateQueries({ queryKey: ['gcal-events'] })
    },
  })
}

export function useCalendarDisconnect() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/google/calendar/disconnect', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to disconnect')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gcal-status'] })
      queryClient.invalidateQueries({ queryKey: ['gcal-events'] })
    },
  })
}
