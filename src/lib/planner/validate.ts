// src/lib/planner/validate.ts
//
// The server owns the invariants; the model is not trusted with them. Pure.
//
// A proposed block must:
//   - sit entirely inside the card window (which itself sits inside a free gap)
//   - run between MIN and MAX minutes
//   - carry a deliverable that is a finished artifact, not a label: non-empty,
//     not equal to any project, outcome or milestone title, and not a bare
//     "work on X" phrase
//   - not overlap another block already on the calendar
//
// The same module is imported by the timeline, so a block the validator
// accepts is by construction a block the UI can draw.

import type { TimeInterval } from '@/lib/calendar/types'
import { MAX_WINDOW_MINUTES, MIN_WINDOW_MINUTES } from './window'

export interface ValidateInput {
  startsAt: Date
  endsAt: Date
  deliverable: string
  window: TimeInterval
  /** Project, outcome and milestone titles the deliverable must not equal. */
  forbiddenTitles: string[]
  existingBlocks?: TimeInterval[]
  minMinutes?: number
  maxMinutes?: number
}

export type ValidationResult = { ok: true } | { ok: false; reason: string }

const LABEL_PATTERNS = [
  /^(work|working) on\b/i,
  /^(continue|keep) (working|going)\b/i,
  /^(dev|development|coding|research|outreach|admin|planning)$/i,
  /^(more|some) (work|progress)\b/i,
]

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function validateDeliverable(deliverable: string, forbiddenTitles: string[]): ValidationResult {
  const d = norm(deliverable)
  if (!d) return { ok: false, reason: 'deliverable is empty' }
  if (d.length < 12) {
    return { ok: false, reason: 'deliverable is too short to name a finished artifact' }
  }
  for (const title of forbiddenTitles) {
    if (norm(title) === d) {
      return { ok: false, reason: `deliverable equals the name "${title}"; name the finished artifact instead` }
    }
  }
  for (const pattern of LABEL_PATTERNS) {
    if (pattern.test(deliverable.trim())) {
      return { ok: false, reason: 'deliverable is a label ("work on …"), not a finished artifact' }
    }
  }
  return { ok: true }
}

export function validateBlock(input: ValidateInput): ValidationResult {
  const min = (input.minMinutes ?? MIN_WINDOW_MINUTES) * 60_000
  const max = (input.maxMinutes ?? MAX_WINDOW_MINUTES) * 60_000
  const start = input.startsAt.getTime()
  const end = input.endsAt.getTime()

  if (Number.isNaN(start) || Number.isNaN(end)) return { ok: false, reason: 'invalid timestamps' }
  if (end <= start) return { ok: false, reason: 'ends_at must be after starts_at' }

  const duration = end - start
  if (duration < min) return { ok: false, reason: `block is ${Math.round(duration / 60_000)} min; minimum is ${min / 60_000}` }
  if (duration > max) return { ok: false, reason: `block is ${Math.round(duration / 60_000)} min; maximum is ${max / 60_000}` }

  if (start < input.window.start.getTime() || end > input.window.end.getTime()) {
    return {
      ok: false,
      reason: `block must sit inside the window ${input.window.start.toISOString()} – ${input.window.end.toISOString()}`,
    }
  }

  for (const other of input.existingBlocks ?? []) {
    if (start < other.end.getTime() && end > other.start.getTime()) {
      return { ok: false, reason: 'block overlaps an existing block' }
    }
  }

  return validateDeliverable(input.deliverable, input.forbiddenTitles)
}
