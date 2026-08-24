// src/lib/google/calendar.ts
// Google Calendar API wrapper — server-side only
// Uses REST API directly (no SDK needed)

import type { CalendarEvent, CalendarEventListResponse } from './types'

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

/**
 * Create a calendar event.
 * Returns the created event ID.
 */
export async function createEvent(
  token: string,
  calendarId: string,
  event: CalendarEvent
): Promise<string> {
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to create event: ${err}`)
  }

  const data = await res.json()
  return data.id
}

/**
 * Update an existing calendar event.
 */
export async function updateEvent(
  token: string,
  calendarId: string,
  eventId: string,
  event: CalendarEvent
): Promise<void> {
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    // If event not found (deleted externally), treat as non-fatal
    if (res.status === 404) {
      console.warn(`Event ${eventId} not found in Google Calendar, skipping update`)
      return
    }
    throw new Error(`Failed to update event: ${err}`)
  }
}

/**
 * Delete a calendar event.
 */
export async function deleteEvent(
  token: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const err = await res.text()
    throw new Error(`Failed to delete event: ${err}`)
  }
}

/**
 * List events in a date range.
 * Returns all events (including non-Founder-OS events).
 */
export async function listEvents(
  token: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  })

  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to list events: ${err}`)
  }

  const data: CalendarEventListResponse = await res.json()
  return data.items || []
}
