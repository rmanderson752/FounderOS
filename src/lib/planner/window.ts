// src/lib/planner/window.ts
//
// The window a card is sized to. Pure.
//
// [start, end) where start is now (if now sits inside a free gap) or the
// start of the next free gap, and end is the earliest of: the gap's end, the
// work window's end, and start + maxMinutes. The 180-minute cap is decision
// D5: a sparse calendar cannot make the card wrong, only the upper bound loose.

import type { TimeInterval } from '@/lib/calendar/types'
import type { CardWindow } from './types'

export const MAX_WINDOW_MINUTES = 180
export const MIN_WINDOW_MINUTES = 30

export interface WindowInput {
  now: Date
  /** Free gaps in chronological order, as computed by lib/calendar/gaps. */
  gaps: TimeInterval[]
  maxMinutes?: number
  minMinutes?: number
}

export function currentWindow(input: WindowInput): CardWindow | null {
  const max = (input.maxMinutes ?? MAX_WINDOW_MINUTES) * 60_000
  const min = (input.minMinutes ?? MIN_WINDOW_MINUTES) * 60_000
  const now = input.now.getTime()

  for (const gap of input.gaps) {
    if (gap.end.getTime() <= now) continue

    const start = Math.max(gap.start.getTime(), now)
    const end = Math.min(gap.end.getTime(), start + max)

    if (end - start < min) continue

    return {
      start: new Date(start),
      end: new Date(end),
      kind: gap.start.getTime() <= now ? 'now' : 'next',
      minutes: Math.round((end - start) / 60_000),
    }
  }

  return null
}
