// src/components/daily/CalendarEvents.tsx
// Shows external Google Calendar events on the daily view
'use client'

import { Calendar, Clock } from 'lucide-react'
import { useCalendarEvents, useCalendarStatus } from '@/hooks/useGoogleCalendar'
import { format, parseISO } from 'date-fns'

function formatEventTime(isoString: string): string {
  if (!isoString) return ''
  try {
    return format(parseISO(isoString), 'h:mm a')
  } catch {
    return ''
  }
}

function formatDuration(start: string, end: string): string {
  if (!start || !end) return ''
  try {
    const startDate = parseISO(start)
    const endDate = parseISO(end)
    const mins = Math.round((endDate.getTime() - startDate.getTime()) / 60000)
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    const remainMins = mins % 60
    return remainMins > 0 ? `${hours}h ${remainMins}m` : `${hours}h`
  } catch {
    return ''
  }
}

interface CalendarEventsProps {
  date: string // yyyy-MM-dd format
}

export function CalendarEvents({ date }: CalendarEventsProps) {
  const { data: status } = useCalendarStatus()
  const { data: events = [], isLoading } = useCalendarEvents(date)

  // Don't render anything if calendar not connected
  if (!status?.connected) return null

  // Don't render if no events (keep the UI clean)
  if (!isLoading && events.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-ink-4" />
        <h3 className="text-sm font-medium text-ink-3">Calendar</h3>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-10 bg-white border border-line rounded-2xl shadow-sm animate-pulse" />
          <div className="h-10 bg-white border border-line rounded-2xl shadow-sm animate-pulse" />
        </div>
      ) : (
        <div className="space-y-1.5">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between px-3 py-2.5 bg-white border border-line rounded-2xl shadow-sm"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Clock className="w-3.5 h-3.5 text-ink-4 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-ink truncate">{event.title}</p>
                  <p className="text-xs text-ink-4">
                    {formatEventTime(event.start)}
                    {event.end ? ` – ${formatEventTime(event.end)}` : ''}
                  </p>
                </div>
              </div>
              <span className="text-xs text-ink-4 flex-shrink-0 ml-3">
                {formatDuration(event.start, event.end)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
