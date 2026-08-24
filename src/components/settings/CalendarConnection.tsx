// src/components/settings/CalendarConnection.tsx
'use client'

import { useState } from 'react'
import { Calendar, Check, Unlink, RefreshCw, ExternalLink } from 'lucide-react'
import { Card, CardHeader, CardTitle, Button } from '@/components/ui'
import {
  useCalendarStatus,
  useCalendarSync,
  useCalendarDisconnect,
} from '@/hooks/useGoogleCalendar'
import { useToast } from '@/components/ui/Toast'
import { formatDistanceToNow } from 'date-fns'

export function CalendarConnection() {
  const { data: status, isLoading } = useCalendarStatus()
  const sync = useCalendarSync()
  const disconnect = useCalendarDisconnect()
  const { addToast } = useToast()
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)

  const handleConnect = () => {
    // Navigate to Google OAuth flow
    window.location.href = '/api/google/auth'
  }

  const handleSync = async () => {
    try {
      const result = await sync.mutateAsync()
      addToast(
        `Synced ${result.created + result.updated} events to Google Calendar`,
        'success'
      )
    } catch (err) {
      addToast('Failed to sync calendar', 'error')
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnect.mutateAsync()
      setShowDisconnectConfirm(false)
      addToast('Google Calendar disconnected', 'success')
    } catch {
      addToast('Failed to disconnect', 'error')
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-ink-3" />
            <CardTitle>Google Calendar</CardTitle>
          </div>
        </CardHeader>
        <div className="h-20 bg-ink/[0.04] rounded-lg animate-pulse" />
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-ink-3" />
          <CardTitle>Google Calendar</CardTitle>
        </div>
      </CardHeader>

      {status?.connected ? (
        <div className="space-y-4">
          {/* Connected state */}
          <div className="flex items-center gap-2 text-sm">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <Check className="w-4 h-4" />
              Connected
            </span>
            <span className="text-ink-4">·</span>
            <span className="text-ink-3">
              {status.calendarId === 'primary' ? 'Primary calendar' : status.calendarId}
            </span>
          </div>

          {status.lastSynced && (
            <p className="text-xs text-ink-4">
              Last synced {formatDistanceToNow(new Date(status.lastSynced), { addSuffix: true })}
            </p>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSync}
              disabled={sync.isPending}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${sync.isPending ? 'animate-spin' : ''}`} />
              {sync.isPending ? 'Syncing...' : 'Sync Now'}
            </Button>

            {!showDisconnectConfirm ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDisconnectConfirm(true)}
              >
                <Unlink className="w-4 h-4 mr-2" />
                Disconnect
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-3">Are you sure?</span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnect.isPending}
                >
                  {disconnect.isPending ? 'Disconnecting...' : 'Yes, disconnect'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDisconnectConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Not connected state */}
          <p className="text-sm text-ink-3">
            Connect your calendar to automatically sync your weekly blocks as events.
          </p>
          <Button onClick={handleConnect}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Connect Google Calendar
          </Button>
        </div>
      )}
    </Card>
  )
}
