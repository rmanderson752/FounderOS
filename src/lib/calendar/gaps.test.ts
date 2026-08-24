// src/lib/calendar/gaps.test.ts
//
// The brief names four cases that must be covered: overlapping events,
// all-day events, events outside the work window, and days with no events.
// The rest are the boundary conditions that break this quietly in practice.

import { describe, expect, it } from 'vitest'
import { formatInTimeZone } from 'date-fns-tz'
import {
  computeBusyIntervals,
  computeFreeGaps,
  computeWorkWindow,
  mergeIntervals,
  resolveEvents,
  totalMinutes,
} from './gaps'
import type { CalendarEvent } from './types'

const TZ = 'America/New_York'
const DATE = '2026-08-19' // a Wednesday, EDT (UTC-4)

/** Build a timed event from wall-clock hours in TZ. */
function timed(
  id: string,
  startHHmm: string,
  endHHmm: string,
  extra: Partial<CalendarEvent> = {}
): CalendarEvent {
  const offset = '-04:00' // EDT, correct for 2026-08-19
  return {
    id,
    title: id,
    start: `${DATE}T${startHHmm}:00${offset}`,
    end: `${DATE}T${endHHmm}:00${offset}`,
    allDay: false,
    ...extra,
  }
}

function allDay(id: string, extra: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id,
    title: id,
    start: DATE,
    end: '2026-08-20', // Google's all-day end is exclusive
    allDay: true,
    ...extra,
  }
}

/** Render a gap as `HH:mm-HH:mm` in TZ, so assertions read as wall clock. */
function asClock(intervals: { start: Date; end: Date }[]): string[] {
  return intervals.map(
    (i) =>
      `${formatInTimeZone(i.start, TZ, 'HH:mm')}-${formatInTimeZone(i.end, TZ, 'HH:mm')}`
  )
}

const base = { date: DATE, timeZone: TZ }

describe('computeWorkWindow', () => {
  it('defaults to 09:00-19:00 when the weekday has no window configured', () => {
    const window = computeWorkWindow(base)
    expect(asClock([window])).toEqual(['09:00-19:00'])
  })

  it('honours a configured window, with or without seconds', () => {
    expect(asClock([computeWorkWindow({ ...base, workStart: '08:30', workEnd: '16:00' })]))
      .toEqual(['08:30-16:00'])
    expect(asClock([computeWorkWindow({ ...base, workStart: '08:30:00', workEnd: '16:00:00' })]))
      .toEqual(['08:30-16:00'])
  })

  it('resolves the same wall clock to different UTC instants across DST', () => {
    // The single most likely source of silent breakage. 09:00 in New York is
    // 14:00Z under EST and 13:00Z under EDT.
    const winter = computeWorkWindow({ date: '2026-01-14', timeZone: TZ })
    const summer = computeWorkWindow({ date: '2026-07-15', timeZone: TZ })
    expect(winter.start.toISOString()).toBe('2026-01-14T14:00:00.000Z')
    expect(summer.start.toISOString()).toBe('2026-07-15T13:00:00.000Z')
  })

  it('handles the spring-forward day, when 02:00-03:00 local does not exist', () => {
    // 2026-03-08 is the US DST transition. A 09:00-19:00 window sits after the
    // jump, so it must still be a full 10 hours.
    const window = computeWorkWindow({ date: '2026-03-08', timeZone: TZ })
    expect(totalMinutes([window])).toBe(600)
  })
})

describe('mergeIntervals', () => {
  it('merges touching intervals so no zero-length gap survives', () => {
    const merged = mergeIntervals([
      { start: new Date('2026-08-19T14:00:00Z'), end: new Date('2026-08-19T15:00:00Z') },
      { start: new Date('2026-08-19T15:00:00Z'), end: new Date('2026-08-19T16:00:00Z') },
    ])
    expect(merged).toHaveLength(1)
    expect(asClock(merged)).toEqual(['10:00-12:00'])
  })

  it('keeps a fully contained interval from extending the outer one', () => {
    const merged = mergeIntervals([
      { start: new Date('2026-08-19T14:00:00Z'), end: new Date('2026-08-19T18:00:00Z') },
      { start: new Date('2026-08-19T15:00:00Z'), end: new Date('2026-08-19T16:00:00Z') },
    ])
    expect(asClock(merged)).toEqual(['10:00-14:00'])
  })

  it('returns an empty array unchanged', () => {
    expect(mergeIntervals([])).toEqual([])
  })
})

describe('computeFreeGaps — the brief’s four required cases', () => {
  it('a day with no events is one gap spanning the whole window', () => {
    const gaps = computeFreeGaps({ ...base, events: [] })
    expect(asClock(gaps)).toEqual(['09:00-19:00'])
    expect(totalMinutes(gaps)).toBe(600)
  })

  it('merges overlapping events before subtracting them', () => {
    const gaps = computeFreeGaps({
      ...base,
      events: [timed('a', '10:00', '12:00'), timed('b', '11:00', '13:00')],
    })
    // Naively subtracting each event in turn would invent a gap at 11:00-12:00.
    expect(asClock(gaps)).toEqual(['09:00-10:00', '13:00-19:00'])
  })

  it('ignores events entirely outside the work window', () => {
    const gaps = computeFreeGaps({
      ...base,
      events: [timed('early', '06:00', '07:30'), timed('late', '20:00', '21:00')],
    })
    expect(asClock(gaps)).toEqual(['09:00-19:00'])
  })

  it('ignores an all-day event unless it is explicitly marked busy', () => {
    const ignored = computeFreeGaps({ ...base, events: [allDay('birthday')] })
    expect(asClock(ignored)).toEqual(['09:00-19:00'])

    const transparent = computeFreeGaps({
      ...base,
      events: [allDay('holiday', { transparency: 'transparent' })],
    })
    expect(asClock(transparent)).toEqual(['09:00-19:00'])

    const busy = computeFreeGaps({
      ...base,
      events: [allDay('offsite', { transparency: 'opaque' })],
    })
    expect(busy).toEqual([])
  })
})

describe('computeFreeGaps — boundaries', () => {
  it('clamps an event that straddles the start of the window', () => {
    const gaps = computeFreeGaps({ ...base, events: [timed('standup', '08:00', '10:00')] })
    expect(asClock(gaps)).toEqual(['10:00-19:00'])
  })

  it('clamps an event that straddles the end of the window', () => {
    const gaps = computeFreeGaps({ ...base, events: [timed('dinner', '18:00', '22:00')] })
    expect(asClock(gaps)).toEqual(['09:00-18:00'])
  })

  it('returns no gaps when an event covers the entire window', () => {
    expect(computeFreeGaps({ ...base, events: [timed('allhands', '08:00', '20:00')] })).toEqual([])
  })

  it('drops gaps shorter than the 30 minute floor', () => {
    const gaps = computeFreeGaps({
      ...base,
      events: [timed('a', '09:00', '11:00'), timed('b', '11:20', '19:00')],
    })
    // The 20 minute hole at 11:00-11:20 is not a planning slot.
    expect(gaps).toEqual([])
  })

  it('keeps a gap exactly at the floor', () => {
    const gaps = computeFreeGaps({
      ...base,
      events: [timed('a', '09:00', '11:00'), timed('b', '11:30', '19:00')],
    })
    expect(asClock(gaps)).toEqual(['11:00-11:30'])
  })

  it('respects a custom minimum', () => {
    const gaps = computeFreeGaps({
      ...base,
      events: [timed('a', '09:00', '11:00'), timed('b', '11:20', '19:00')],
      minGapMinutes: 15,
    })
    expect(asClock(gaps)).toEqual(['11:00-11:20'])
  })

  it('ignores transparent and cancelled timed events', () => {
    const gaps = computeFreeGaps({
      ...base,
      events: [
        timed('free', '10:00', '12:00', { transparency: 'transparent' }),
        timed('gone', '13:00', '14:00', { status: 'cancelled' }),
      ],
    })
    expect(asClock(gaps)).toEqual(['09:00-19:00'])
  })

  it('treats a timed event with no transparency as busy', () => {
    const gaps = computeFreeGaps({ ...base, events: [timed('meeting', '12:00', '13:00')] })
    expect(asClock(gaps)).toEqual(['09:00-12:00', '13:00-19:00'])
  })

  it('returns no gaps for an inverted work window', () => {
    expect(
      computeFreeGaps({ ...base, events: [], workStart: '19:00', workEnd: '09:00' })
    ).toEqual([])
  })

  it('handles a multi-day event covering this day', () => {
    const gaps = computeFreeGaps({
      ...base,
      events: [
        {
          id: 'conference',
          title: 'conference',
          start: '2026-08-18T13:00:00-04:00',
          end: '2026-08-21T21:00:00-04:00',
          allDay: false,
        },
      ],
    })
    expect(gaps).toEqual([])
  })
})

describe('computeFreeGaps — notBefore', () => {
  it('trims a gap already in progress', () => {
    const gaps = computeFreeGaps({
      ...base,
      events: [],
      notBefore: new Date('2026-08-19T18:30:00Z'), // 14:30 in New York
    })
    expect(asClock(gaps)).toEqual(['14:30-19:00'])
  })

  it('drops gaps entirely in the past', () => {
    const gaps = computeFreeGaps({
      ...base,
      events: [timed('a', '11:00', '19:00')],
      notBefore: new Date('2026-08-19T15:00:00Z'), // 11:00 local
    })
    expect(gaps).toEqual([])
  })

  it('re-applies the minimum after trimming', () => {
    const gaps = computeFreeGaps({
      ...base,
      events: [],
      notBefore: new Date('2026-08-19T22:45:00Z'), // 18:45 local, 15 minutes left
    })
    expect(gaps).toEqual([])
  })
})

describe('computeBusyIntervals', () => {
  it('reports merged busy time clamped to the window', () => {
    const busy = computeBusyIntervals({
      ...base,
      events: [timed('a', '08:00', '10:00'), timed('b', '09:30', '11:00')],
    })
    expect(asClock(busy)).toEqual(['09:00-11:00'])
    expect(totalMinutes(busy)).toBe(120)
  })
})

describe('resolveEvents', () => {
  it('sorts chronologically, flags busy, and drops cancelled events', () => {
    const resolved = resolveEvents(
      [
        timed('late', '15:00', '16:00'),
        timed('early', '09:00', '10:00', { transparency: 'transparent' }),
        timed('gone', '11:00', '12:00', { status: 'cancelled' }),
        allDay('birthday'),
      ],
      TZ
    )
    expect(resolved.map((e) => e.id)).toEqual(['birthday', 'early', 'late'])
    expect(resolved.map((e) => e.busy)).toEqual([false, false, true])
  })
})
