// src/lib/calendar/types.ts
// Shared calendar shapes for the v3 daily path.

/**
 * A calendar event normalised away from the Google API shape.
 *
 * `transparency` is deliberately optional rather than defaulted: the busy
 * rules differ for timed and all-day events, and "unset" is meaningful for
 * all-day events. See `isBusy` in ./gaps.
 */
export interface CalendarEvent {
  id: string
  title: string
  /** ISO 8601 instant for timed events; `yyyy-MM-dd` for all-day events. */
  start: string
  /** Same encoding as `start`. For all-day events Google's end date is exclusive. */
  end: string
  allDay: boolean
  /** Google's `transparency`. Absent means the event did not specify one. */
  transparency?: 'opaque' | 'transparent'
  status?: 'confirmed' | 'tentative' | 'cancelled'
}

/** A half-open interval [start, end) of UTC instants. */
export interface TimeInterval {
  start: Date
  end: Date
}

/** An event resolved to UTC instants, for rendering a timeline. */
export interface ResolvedEvent extends TimeInterval {
  id: string
  title: string
  allDay: boolean
  busy: boolean
}

/** What the morning view needs to draw a day. */
export interface DayCalendar {
  /** `yyyy-MM-dd` in the user's timezone. */
  date: string
  timeZone: string
  workWindow: TimeInterval
  events: ResolvedEvent[]
  gaps: TimeInterval[]
  /** Total free minutes across all gaps. */
  freeMinutes: number
}
