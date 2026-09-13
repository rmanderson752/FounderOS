// src/components/settings/CalendarConnection.tsx
//
// The v3/v4 calendar connection: read-only scope, encrypted tokens,
// calendar_connections table. This replaced the v2 component that connected
// the write-scope google_calendar_tokens stack — two "Connect" buttons
// writing to two tables was the first trust failure the critic predicted.

'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, Check, Unlink } from 'lucide-react'
import { Card, CardHeader, CardTitle, Button } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { formatDistanceToNow } from 'date-fns'

interface CalendarStatus {
  connected: boolean
  timezone?: string
  calendarIds?: string[]
  lastSyncedAt?: string | null
}

export function useCalendarStatusV3() {
  return useQuery<CalendarStatus>({
    queryKey: ['calendar-status-v3'],
    queryFn: async () => {
      const res = await fetch('/api/calendar/status')
      if (!res.ok) return { connected: false }
      return res.json()
    },
    staleTime: 30_000,
  })
}

export function CalendarConnection() {
  const queryClient = useQueryClient()
  const { data: status, isLoading } = useCalendarStatusV3()
  const { addToast } = useToast()
  const [confirm, setConfirm] = useState(false)

  const disconnect = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/calendar/disconnect', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to disconnect')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-status-v3'] })
      queryClient.invalidateQueries({ queryKey: ['card'] })
      setConfirm(false)
      addToast('Google Calendar disconnected', 'success')
    },
    onError: () => addToast('Failed to disconnect', 'error'),
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-ink-3" />
          <CardTitle>Google Calendar</CardTitle>
        </div>
      </CardHeader>

      {isLoading ? (
        <div className="h-20 bg-ink/[0.04] rounded-lg animate-pulse" />
      ) : status?.connected ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
              <Check className="w-4 h-4" /> Connected
            </span>
            <span className="text-ink-4">·</span>
            <span className="text-ink-3">{status.timezone}</span>
            {status.lastSyncedAt && (
              <>
                <span className="text-ink-4">·</span>
                <span className="text-ink-4">linked {formatDistanceToNow(new Date(status.lastSyncedAt), { addSuffix: true })}</span>
              </>
            )}
          </div>
          <p className="text-sm text-ink-3 leading-relaxed">
            Read-only. Founder OS reads your events to find the free window a card is sized to. It never writes
            to your calendar, and the tokens are encrypted at rest.
          </p>
          {confirm ? (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
                Yes, disconnect
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
              <Unlink className="w-4 h-4 mr-2" /> Disconnect
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-3 leading-relaxed">
            Connect Google Calendar so the card can be sized to the gap that is genuinely free. Read-only scope;
            nothing is ever written to your calendar.
          </p>
          <Button onClick={() => (window.location.href = '/api/calendar/connect')}>
            <Calendar className="w-4 h-4 mr-2" /> Connect Google Calendar
          </Button>
        </div>
      )}
    </Card>
  )
}
