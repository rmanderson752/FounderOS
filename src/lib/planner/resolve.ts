// src/lib/planner/resolve.ts
//
// Did the block happen? Pure.
//
// Evidence is signals on the same project inside the block's window (plus
// slack either side, because a commit lands after the work). Each kind of
// evidence adds to a confidence score:
//
//   a commit in the window                        +0.35
//   a session overlapping at least half the block +0.30
//   any signal path matching an expected path     +0.35
//   the commit subject sharing words with the
//   deliverable                                   +0.25
//
// >= 0.7 done, 0.4–0.7 partial, below that unobserved. The thresholds are the
// thing resolution_corrections exists to tune; they are exported so the eval
// harness can sweep them.

import type { BlockResolution, PlannerBlock, PlannerSignal } from './types'

export const DONE_THRESHOLD = 0.7
export const PARTIAL_THRESHOLD = 0.4
export const SLACK_MINUTES = 30

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with', 'from', 'by', 'at',
  'is', 'it', 'as', 'be', 'this', 'that', 'into', 'up', 'out', 'so', 'then', 'via', 'add',
  'fix', 'update', 'wip', 'feat', 'chore', 'refactor', 'ship', 'write', 'make', 'build',
])

export interface ResolveInput {
  block: PlannerBlock
  signals: PlannerSignal[]
  slackMinutes?: number
}

export interface ResolveResult {
  status: BlockResolution
  confidence: number
  evidenceIds: string[]
}

export function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9/._-]+/g, ' ')
      .split(' ')
      .map((w) => w.replace(/^[._/-]+|[._/-]+$/g, ''))
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
  )
}

function pathMatches(signalPaths: string[], expected: string[]): boolean {
  if (expected.length === 0 || signalPaths.length === 0) return false
  const norm = (p: string) => p.replace(/^\.?\//, '').toLowerCase()
  return signalPaths.some((sp) => {
    const s = norm(sp)
    return expected.some((ep) => {
      const e = norm(ep)
      return s === e || s.startsWith(e.replace(/\/$/, '') + '/') || s.includes(e) || e.includes(s)
    })
  })
}

export function resolveBlock(input: ResolveInput): ResolveResult {
  const slack = (input.slackMinutes ?? SLACK_MINUTES) * 60_000
  const start = input.block.startsAt.getTime()
  const end = input.block.endsAt.getTime()
  const blockMinutes = (end - start) / 60_000

  const inWindow = input.signals.filter((s) => {
    if (input.block.projectId && s.projectId !== input.block.projectId) return false
    const t = s.occurredAt.getTime()
    if (s.source === 'session' && s.durationMinutes) {
      // A session signal's occurredAt is its end; it overlaps if it started
      // before the block ended and ended after the block started.
      const sessionStart = t - s.durationMinutes * 60_000
      return sessionStart < end + slack && t > start - slack
    }
    return t >= start - slack && t <= end + slack
  })

  if (inWindow.length === 0) return { status: 'unobserved', confidence: 0, evidenceIds: [] }

  let confidence = 0
  const evidence = new Set<string>()
  const deliverableWords = significantWords(input.block.deliverable)

  const commits = inWindow.filter((s) => s.source === 'git')
  if (commits.length > 0) {
    confidence += 0.35
    commits.forEach((c) => evidence.add(c.id))
  }

  for (const s of inWindow) {
    if (s.source === 'session' && s.durationMinutes) {
      const sessionStart = s.occurredAt.getTime() - s.durationMinutes * 60_000
      const overlap = Math.min(end, s.occurredAt.getTime()) - Math.max(start, sessionStart)
      if (overlap / 60_000 >= blockMinutes / 2) {
        confidence += 0.3
        evidence.add(s.id)
        break
      }
    }
  }

  if (inWindow.some((s) => pathMatches(s.paths, input.block.expectedPaths))) {
    confidence += 0.35
    inWindow.filter((s) => pathMatches(s.paths, input.block.expectedPaths)).forEach((s) => evidence.add(s.id))
  }

  if (deliverableWords.size > 0) {
    const overlapping = inWindow.filter((s) => {
      const words = significantWords(s.summary)
      let shared = 0
      words.forEach((w) => { if (deliverableWords.has(w)) shared++ })
      return shared >= 2 || (shared >= 1 && deliverableWords.size <= 3)
    })
    if (overlapping.length > 0) {
      confidence += 0.25
      overlapping.forEach((s) => evidence.add(s.id))
    }
  }

  confidence = Math.min(1, Math.round(confidence * 100) / 100)
  const status: BlockResolution =
    confidence >= DONE_THRESHOLD ? 'done' : confidence >= PARTIAL_THRESHOLD ? 'partial' : 'unobserved'

  return { status, confidence, evidenceIds: Array.from(evidence) }
}
