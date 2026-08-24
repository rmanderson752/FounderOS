// src/lib/calendar/gaps.ts
//
// Free-gap computation. Pure — no I/O, no clock reads, no timezone guessing
// from the host. Every input is passed in, so the whole thing is testable.
//
// This is where the product silently breaks and the user loses trust on day
// four, so the rules are written out explicitly rather than inferred.

import { fromZonedTime } from 'date-fns-tz'
import type { CalendarEvent, ResolvedEvent, TimeInterval } from './types'

/** Used when schedule_constraints has no work window for the weekday. */
export const DEFAULT_WORK_START = '09:00'
export const DEFAULT_WORK_END = '19:00'

/** A gap shorter than this is not worth planning into. */
export const MIN_GAP_MINUTES = 30

export interface GapInput {
  /** `yyyy-MM-dd`, interpreted in `timeZone`. */
  date: string
  /** IANA zone, e.g. `America/New_York`. */
  timeZone: string
  events: CalendarEvent[]
  /** `HH:mm` or `HH:mm:ss`. Null falls back to DEFAULT_WORK_START. */
  workStart?: string | null
  workEnd?: string | null
  minGapMinutes?: number
  /**
   * Trims gaps that start before this instant. The morning view passes "now"
   * so the agent never proposes a block in the past. Left out, the result is
   * the whole day's shape.
   */
  notBefore?: Date
}

/**
 * Resolve a wall-clock time on `date` in `timeZone` to a UTC instant.
 *
 * Uses date-fns-tz rather than manual offset math so DST is handled: 09:00 in
 * New York is 14:00Z in January and 13:00Z in July.
 */
function zonedTimeToInstant(date: string, time: string, timeZone: string): Date {
  const normalised = time.length === 5 ? `${time}:00` : time
  return fromZonedTime(`${date}T${normalised}`, timeZone)
}

/**
 * Should this event consume time?
 *
 * Timed events are busy unless explicitly marked transparent — that matches
 * Google, where omitting `transparency` means opaque.
 *
 * All-day events invert the default: they are ignored unless explicitly
 * marked opaque. Without this, a birthday, a holiday, or a "working location"
 * marker would swallow the entire day and produce zero gaps.
 */
function isBusy(event: CalendarEvent): boolean {
  if (event.status === 'cancelled') return false
  if (event.transparency === 'transparent') return false
  if (event.allDay) return event.transparency === 'opaque'
  return true
}

/** Resolve an event's start/end to UTC instants. */
function resolveEvent(event: CalendarEvent, timeZone: string): TimeInterval {
  if (event.allDay) {
    // Google encodes all-day bounds as dates, with an exclusive end.
    return {
      start: zonedTimeToInstant(event.start, '00:00:00', timeZone),
      end: zonedTimeToInstant(event.end, '00:00:00', timeZone),
    }
  }
  return { start: new Date(event.start), end: new Date(event.end) }
}

/** Clamp an interval to `bounds`, or null if it falls entirely outside. */
function clamp(interval: TimeInterval, bounds: TimeInterval): TimeInterval | null {
  const start = Math.max(interval.start.getTime(), bounds.start.getTime())
  const end = Math.min(interval.end.getTime(), bounds.end.getTime())
  if (end <= start) return null
  return { start: new Date(start), end: new Date(end) }
}

/**
 * Merge overlapping and touching intervals.
 *
 * Touching matters as much as overlapping: back-to-back 10-11 and 11-12
 * meetings must not leave a zero-length gap between them.
 */
export function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (intervals.length === 0) return []

  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime())
  const merged: TimeInterval[] = [{ ...sorted[0] }]

  for (const current of sorted.slice(1)) {
    const last = merged[merged.length - 1]
    if (current.start.getTime() <= last.end.getTime()) {
      if (current.end.getTime() > last.end.getTime()) last.end = new Date(current.end)
    } else {
      merged.push({ ...current })
    }
  }

  return merged
}

/** The work window for `date`, as UTC instants. */
export function computeWorkWindow(input: {
  date: string
  timeZone: string
  workStart?: string | null
  workEnd?: string | null
}): TimeInterval {
  return {
    start: zonedTimeToInstant(input.date, input.workStart || DEFAULT_WORK_START, input.timeZone),
    end: zonedTimeToInstant(input.date, input.workEnd || DEFAULT_WORK_END, input.timeZone),
  }
}

/** Busy intervals, clamped to the work window and merged. */
export function computeBusyIntervals(input: GapInput): TimeInterval[] {
  const window = computeWorkWindow(input)

  const busy = input.events
    .filter(isBusy)
    .map((event) => resolveEvent(event, input.timeZone))
    .map((interval) => clamp(interval, window))
    .filter((interval): interval is TimeInterval => interval !== null)

  return mergeIntervals(busy)
}

/**
 * Free intervals inside the work window, in chronological order.
 *
 * Gaps shorter than `minGapMinutes` are dropped — a 12 minute hole between
 * meetings is not a planning slot.
 */
export function computeFreeGaps(input: GapInput): TimeInterval[] {
  const minGapMs = (input.minGapMinutes ?? MIN_GAP_MINUTES) * 60_000
  const window = computeWorkWindow(input)

  // An inverted or zero-length window (work_end <= work_start) has no gaps.
  if (window.end.getTime() <= window.start.getTime()) return []

  const busy = computeBusyIntervals(input)

  const gaps: TimeInterval[] = []
  let cursor = window.start.getTime()

  for (const interval of busy) {
    if (interval.start.getTime() > cursor) {
      gaps.push({ start: new Date(cursor), end: new Date(interval.start) })
    }
    cursor = Math.max(cursor, interval.end.getTime())
  }

  if (cursor < window.end.getTime()) {
    gaps.push({ start: new Date(cursor), end: new Date(window.end) })
  }

  const floor = input.notBefore?.getTime()

  return gaps
    .map((gap) => {
      if (floor === undefined || gap.start.getTime() >= floor) return gap
      if (gap.end.getTime() <= floor) return null
      return { start: new Date(floor), end: gap.end }
    })
    .filter((gap): gap is TimeInterval => gap !== null)
    .filter((gap) => gap.end.getTime() - gap.start.getTime() >= minGapMs)
}

/** Events resolved to UTC instants for the timeline, busy ones flagged. */
export function resolveEvents(events: CalendarEvent[], timeZone: string): ResolvedEvent[] {
  return events
    .filter((event) => event.status !== 'cancelled')
    .map((event) => {
      const { start, end } = resolveEvent(event, timeZone)
      return {
        id: event.id,
        title: event.title,
        allDay: event.allDay,
        busy: isBusy(event),
        start,
        end,
      }
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime())
}

/** Total minutes across a set of intervals. */
export function totalMinutes(intervals: TimeInterval[]): number {
  return Math.round(
    intervals.reduce((sum, i) => sum + (i.end.getTime() - i.start.getTime()), 0) / 60_000
  )
}
