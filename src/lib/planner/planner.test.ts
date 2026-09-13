// src/lib/planner/planner.test.ts
//
// The planner is the code/model boundary: everything here runs with no model
// and no database, so plan quality is testable without an LLM in the loop.

import { describe, expect, it } from 'vitest'
import { currentWindow } from './window'
import { activeMilestoneFor, disagreementLine, scoreOutcomes } from './select'
import { observedPace, paceLine, projectedCompletion } from './capacity'
import { pickRocks, rechainDates } from './rechain'
import { validateBlock, validateDeliverable } from './validate'
import { resolveBlock, significantWords } from './resolve'
import type { PlannerMilestone, PlannerOutcome, PlannerSignal } from './types'

const T = (iso: string) => new Date(iso)
const NOW = T('2026-09-14T13:04:00Z') // Monday 9:04 New York
const TODAY = '2026-09-14'

// ---------------------------------------------------------------------------
// window
// ---------------------------------------------------------------------------
describe('currentWindow', () => {
  const gaps = [
    { start: T('2026-09-14T13:00:00Z'), end: T('2026-09-14T15:30:00Z') }, // 9:00–11:30
    { start: T('2026-09-14T16:30:00Z'), end: T('2026-09-14T23:00:00Z') }, // 12:30–19:00
  ]

  it('starts at now when now is inside a gap and ends at the gap end', () => {
    const w = currentWindow({ now: NOW, gaps })!
    expect(w.kind).toBe('now')
    expect(w.start.toISOString()).toBe('2026-09-14T13:04:00.000Z')
    expect(w.end.toISOString()).toBe('2026-09-14T15:30:00.000Z')
    expect(w.minutes).toBe(146)
  })

  it('caps a long gap at 180 minutes', () => {
    const w = currentWindow({ now: T('2026-09-14T16:40:00Z'), gaps })!
    expect(w.minutes).toBe(180)
    expect(w.end.toISOString()).toBe('2026-09-14T19:40:00.000Z')
  })

  it('returns the next gap when now sits inside an event', () => {
    const w = currentWindow({ now: T('2026-09-14T16:00:00Z'), gaps })!
    expect(w.kind).toBe('next')
    expect(w.start.toISOString()).toBe('2026-09-14T16:30:00.000Z')
  })

  it('skips a remainder shorter than the minimum and moves on', () => {
    const w = currentWindow({ now: T('2026-09-14T15:10:00Z'), gaps })!
    expect(w.kind).toBe('next')
    expect(w.start.toISOString()).toBe('2026-09-14T16:30:00.000Z')
  })

  it('returns null when nothing is left today', () => {
    expect(currentWindow({ now: T('2026-09-14T23:30:00Z'), gaps })).toBeNull()
    expect(currentWindow({ now: NOW, gaps: [] })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// select
// ---------------------------------------------------------------------------
const outcomes: PlannerOutcome[] = [
  { id: 'o-hnry', title: 'HNRY TestFlight beta', projectId: 'p-hnry', projectName: 'HNRY', weight: 3, targetDate: '2026-10-24', status: 'active' },
  { id: 'o-outpost', title: 'Outpost creator onboarding', projectId: 'p-outpost', projectName: 'Outpost', weight: 2, targetDate: null, status: 'active' },
  { id: 'o-dead', title: 'Paddock', projectId: 'p-paddock', projectName: 'Paddock', weight: 2, targetDate: null, status: 'paused' },
]

const milestones: PlannerMilestone[] = [
  { id: 'm1', outcomeId: 'o-hnry', title: 'Repo + design system', estimatedMinutes: 240, position: 0, status: 'done', focusWeek: null, candidates: [] },
  { id: 'm2', outcomeId: 'o-hnry', title: 'Auth + onboarding', estimatedMinutes: 480, position: 1, status: 'active', focusWeek: null, candidates: [
    { deliverable: 'Wire Supabase sign-in on SignInScreen.tsx', estimated_minutes: 90, expected_paths: ['app/(auth)'] },
  ] },
  { id: 'm3', outcomeId: 'o-hnry', title: 'Commitments feed', estimatedMinutes: 600, position: 2, status: 'pending', focusWeek: null, candidates: [] },
  { id: 'm4', outcomeId: 'o-outpost', title: 'Creator intake form', estimatedMinutes: 180, position: 0, status: 'pending', focusWeek: '2026-09-14', candidates: [] },
]

const signals: PlannerSignal[] = [
  { id: 's1', projectId: 'p-hnry', source: 'git', occurredAt: T('2026-09-12T20:00:00Z'), paths: ['src/commitments.ts'], summary: 'fix(commitments): sanitize punctuation', durationMinutes: null },
  { id: 's2', projectId: 'p-hnry', source: 'git', occurredAt: T('2026-09-13T02:00:00Z'), paths: ['app/(auth)/AuthStack.tsx'], summary: 'AuthStack scaffold', durationMinutes: null },
  { id: 's3', projectId: 'p-hnry', source: 'session', occurredAt: T('2026-09-13T03:00:00Z'), paths: [], summary: 'continue auth stack', durationMinutes: 95 },
  { id: 's4', projectId: 'p-outpost', source: 'git', occurredAt: T('2026-09-01T15:00:00Z'), paths: ['docs/plan.md'], summary: 'plan', durationMinutes: null },
]

describe('scoreOutcomes', () => {
  it('drops non-active outcomes and ranks by the product of the terms', () => {
    const ranked = scoreOutcomes({ outcomes, milestones, signals, now: NOW, today: TODAY })
    expect(ranked.map((r) => r.outcome.id)).not.toContain('o-dead')
    expect(ranked[0].outcome.id).toBe('o-hnry')
    const hnry = ranked[0].terms
    expect(hnry.weight).toBe(3)
    expect(hnry.remainingMinutes).toBe(1080)
    expect(hnry.daysLeft).toBe(40)
    expect(hnry.signalsLast3Days).toBe(3)
    expect(hnry.momentum).toBe(1.2)
    expect(hnry.staleness).toBe(1)
    expect(hnry.urgency).toBe(1.225) // 1080 min / 40 days = 27/day; 1 + 27/120
  })

  it('never lets a target date lower priority below an undated peer', () => {
    const farOff = { ...outcomes[0], targetDate: '2027-09-14' }
    const ranked = scoreOutcomes({ outcomes: [farOff, outcomes[1]], milestones, signals, now: NOW, today: TODAY })
    expect(ranked[0].terms.urgency).toBeGreaterThanOrEqual(1)
  })

  it('raises urgency as the target approaches, capped at 3', () => {
    const soon = { ...outcomes[0], targetDate: '2026-09-16' }
    const ranked = scoreOutcomes({ outcomes: [soon], milestones, signals, now: NOW, today: TODAY })
    expect(ranked[0].terms.urgency).toBe(3)
  })

  it('boosts a stale outcome and a rock, and lets cwd tip the balance', () => {
    const ranked = scoreOutcomes({ outcomes, milestones, signals, now: NOW, today: TODAY, weekStart: '2026-09-14' })
    const outpost = ranked.find((r) => r.outcome.id === 'o-outpost')!
    expect(outpost.terms.rock).toBe(1.5)
    expect(outpost.terms.staleness).toBe(1.15)
    expect(outpost.terms.momentum).toBe(0.8)

    const withCwd = scoreOutcomes({ outcomes, milestones, signals, now: NOW, today: TODAY, weekStart: '2026-09-14', cwdProjectId: 'p-outpost' })
    expect(withCwd.find((r) => r.outcome.id === 'o-outpost')!.terms.cwd).toBe(1.3)
  })

  it('is deterministic', () => {
    const a = scoreOutcomes({ outcomes, milestones, signals, now: NOW, today: TODAY })
    const b = scoreOutcomes({ outcomes, milestones, signals, now: NOW, today: TODAY })
    expect(a).toEqual(b)
  })

  it('finds the first open milestone in position order', () => {
    expect(activeMilestoneFor('o-hnry', milestones)!.id).toBe('m2')
    expect(activeMilestoneFor('o-nothing', milestones)).toBeNull()
  })

  it('explains a disagreement with the opened directory in one line', () => {
    const ranked = scoreOutcomes({ outcomes, milestones, signals, now: NOW, today: TODAY })
    expect(disagreementLine(ranked, 'p-hnry')).toBeNull()
    const line = disagreementLine(ranked, 'p-outpost')!
    expect(line.startsWith('HNRY scores higher today')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// capacity + rechain
// ---------------------------------------------------------------------------
describe('observedPace', () => {
  it('uses session minutes when present and commit fallback otherwise', () => {
    const pace = observedPace({ signals, now: NOW, weeks: 4 })
    expect(pace['p-hnry']).toBe(Math.round(95 / 4))
    expect(pace['p-outpost']).toBe(Math.round(30 / 4))
  })

  it('ignores signals older than the lookback', () => {
    const pace = observedPace({ signals, now: T('2026-12-01T00:00:00Z'), weeks: 4 })
    expect(pace).toEqual({})
  })
})

describe('projectedCompletion / paceLine', () => {
  it('projects from pace and never from nothing', () => {
    expect(projectedCompletion(600, 300, NOW)!.toISOString().slice(0, 10)).toBe('2026-09-28')
    expect(projectedCompletion(600, 0, NOW)).toBeNull()
  })

  it('renders the pace line with target', () => {
    const fmt = (d: Date) => d.toISOString().slice(5, 10)
    expect(paceLine({ remaining: 1320, paceMinutesPerWeek: 300, targetDate: '2026-10-24', now: NOW, formatDate: fmt })).toBe(
      'needs ~22h; at ~5h/wk that lands 10-15, target 10-24.'
    )
    expect(paceLine({ remaining: 1320, paceMinutesPerWeek: 0, targetDate: null, now: NOW, formatDate: fmt })).toBe(
      'needs ~22h; no pace observed yet.'
    )
  })
})

describe('rechainDates / pickRocks', () => {
  it('chains forward from pace and leaves done milestones undated', () => {
    const out = rechainDates({ milestones: milestones.filter((m) => m.outcomeId === 'o-hnry'), paceMinutesPerWeek: 300, now: NOW })
    expect(out[0]).toEqual({ id: 'm1', expectedBy: null })
    expect(out[1].expectedBy).toBe('2026-09-26') // 480/300 weeks = 1.6w -> 12 days
    expect(out[2].expectedBy).toBe('2026-10-10') // (480+600)/300 = 3.6w -> 26 days
  })

  it('returns null dates with no pace', () => {
    const out = rechainDates({ milestones, paceMinutesPerWeek: 0, now: NOW })
    expect(out.every((m) => m.expectedBy === null)).toBe(true)
  })

  it('picks at most N rocks, the first open milestone of each ranked outcome', () => {
    expect(pickRocks(['o-hnry', 'o-outpost', 'o-dead'], milestones, 3)).toEqual(['m2', 'm4'])
    expect(pickRocks(['o-hnry', 'o-outpost'], milestones, 1)).toEqual(['m2'])
  })
})

// ---------------------------------------------------------------------------
// validate
// ---------------------------------------------------------------------------
describe('validateBlock', () => {
  const window = { start: T('2026-09-14T13:04:00Z'), end: T('2026-09-14T15:30:00Z') }
  const forbidden = ['HNRY', 'HNRY TestFlight beta', 'Auth + onboarding']
  const good = {
    startsAt: T('2026-09-14T13:04:00Z'),
    endsAt: T('2026-09-14T14:34:00Z'),
    deliverable: 'Wire Supabase sign-in on SignInScreen.tsx and verify the happy path',
    window,
    forbiddenTitles: forbidden,
  }

  it('accepts a block inside the window with a real deliverable', () => {
    expect(validateBlock(good)).toEqual({ ok: true })
  })

  it('rejects blocks outside the window', () => {
    const r = validateBlock({ ...good, endsAt: T('2026-09-14T15:31:00Z') })
    expect(r.ok).toBe(false)
  })

  it('rejects blocks under 30 and over 180 minutes', () => {
    expect(validateBlock({ ...good, endsAt: T('2026-09-14T13:20:00Z') }).ok).toBe(false)
    const long = { ...good, window: { start: window.start, end: T('2026-09-14T18:00:00Z') }, endsAt: T('2026-09-14T16:30:00Z') }
    expect(validateBlock(long).ok).toBe(false)
  })

  it('rejects a deliverable that is a name or a label', () => {
    expect(validateDeliverable('HNRY', forbidden).ok).toBe(false)
    expect(validateDeliverable('auth + onboarding', forbidden).ok).toBe(false)
    expect(validateDeliverable('Work on onboarding', forbidden).ok).toBe(false)
    expect(validateDeliverable('', forbidden).ok).toBe(false)
    expect(validateDeliverable('Draft three cold outreach messages to podcast hosts', forbidden).ok).toBe(true)
  })

  it('rejects overlap with an existing block', () => {
    const r = validateBlock({ ...good, existingBlocks: [{ start: T('2026-09-14T14:00:00Z'), end: T('2026-09-14T15:00:00Z') }] })
    expect(r.ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// resolve
// ---------------------------------------------------------------------------
describe('resolveBlock', () => {
  const block = {
    id: 'b1',
    projectId: 'p-hnry',
    startsAt: T('2026-09-14T13:04:00Z'),
    endsAt: T('2026-09-14T15:00:00Z'),
    deliverable: 'Wire Supabase sign-in on SignInScreen.tsx',
    expectedPaths: ['app/(auth)'],
  }

  it('is unobserved with no signals in the window', () => {
    const r = resolveBlock({ block, signals })
    expect(r.status).toBe('unobserved')
    expect(r.confidence).toBe(0)
  })

  it('is done when a commit in the window touches an expected path and matches the deliverable', () => {
    const r = resolveBlock({
      block,
      signals: [
        { id: 'c1', projectId: 'p-hnry', source: 'git', occurredAt: T('2026-09-14T14:20:00Z'), paths: ['app/(auth)/SignInScreen.tsx'], summary: 'feat(auth): wire supabase sign-in on SignInScreen', durationMinutes: null },
      ],
    })
    expect(r.status).toBe('done')
    expect(r.confidence).toBeGreaterThanOrEqual(0.7)
    expect(r.evidenceIds).toEqual(['c1'])
  })

  it('counts a commit landing within the slack after the block', () => {
    const r = resolveBlock({
      block,
      signals: [
        { id: 'c2', projectId: 'p-hnry', source: 'git', occurredAt: T('2026-09-14T15:20:00Z'), paths: ['app/(auth)/SignInScreen.tsx'], summary: 'sign-in', durationMinutes: null },
      ],
    })
    expect(r.status).not.toBe('unobserved')
    expect(r.confidence).toBe(0.7)
  })

  it('is partial when a session overlapped but nothing shipped on the expected paths', () => {
    const r = resolveBlock({
      block,
      signals: [
        { id: 's9', projectId: 'p-hnry', source: 'session', occurredAt: T('2026-09-14T14:30:00Z'), paths: [], summary: 'poke at voice', durationMinutes: 80 },
        { id: 'c3', projectId: 'p-hnry', source: 'git', occurredAt: T('2026-09-14T14:40:00Z'), paths: ['src/voice.ts'], summary: 'voice tweaks', durationMinutes: null },
      ],
    })
    expect(r.status).toBe('partial')
    expect(r.confidence).toBe(0.65)
  })

  it('ignores signals from other projects', () => {
    const r = resolveBlock({
      block,
      signals: [
        { id: 'x', projectId: 'p-outpost', source: 'git', occurredAt: T('2026-09-14T14:20:00Z'), paths: ['app/(auth)/SignInScreen.tsx'], summary: 'sign-in', durationMinutes: null },
      ],
    })
    expect(r.status).toBe('unobserved')
  })

  it('extracts significant words', () => {
    expect(Array.from(significantWords('feat(auth): wire supabase sign-in on SignInScreen'))).toEqual(
      expect.arrayContaining(['auth', 'wire', 'supabase', 'sign-in', 'signinscreen'])
    )
  })
})
