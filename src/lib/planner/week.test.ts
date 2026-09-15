// src/lib/planner/week.test.ts

import { describe, expect, it } from 'vitest'
import { planWeek, subtractIntervals, type PlannerCommitment, type WeekDay } from './week'
import type { PlannerMilestone, PlannerOutcome } from './types'

const T = (iso: string) => new Date(iso)
const TZ = 'America/New_York'
const NOW = T('2026-09-14T11:00:00Z') // Monday 07:00 New York, before the work window

// Mon–Fri, 09:00–19:00 New York = 13:00–23:00Z. Each day: an 11:00–12:00 local meeting.
function day(date: string, weekday: number): WeekDay {
  return {
    date,
    weekday,
    workWindow: { start: T(`${date}T13:00:00Z`), end: T(`${date}T23:00:00Z`) },
    gaps: [
      { start: T(`${date}T13:00:00Z`), end: T(`${date}T15:00:00Z`) }, // 09:00–11:00
      { start: T(`${date}T16:00:00Z`), end: T(`${date}T23:00:00Z`) }, // 12:00–19:00
    ],
  }
}
const days = [
  day('2026-09-14', 1),
  day('2026-09-15', 2),
  day('2026-09-16', 3),
  day('2026-09-17', 4),
  day('2026-09-18', 5),
]

const outcomes: PlannerOutcome[] = [
  { id: 'o-job', title: 'Get software job', projectId: 'p-job', projectName: 'Job search', weight: 2, targetDate: '2026-12-01', status: 'active' },
  { id: 'o-hnry', title: 'HNRY TestFlight beta', projectId: 'p-hnry', projectName: 'HNRY', weight: 3, targetDate: '2026-10-24', status: 'active' },
]
const milestones: PlannerMilestone[] = [
  { id: 'm-job-1', outcomeId: 'o-job', title: 'Decide the target role', estimatedMinutes: 240, position: 0, status: 'active', focusWeek: null, candidates: [
    { deliverable: 'Write target-role.md with 2–3 role titles and constraints', estimated_minutes: 60, expected_paths: ['target-role.md'] },
    { deliverable: 'Build target-companies.md with 25 named companies', estimated_minutes: 90, expected_paths: ['target-companies.md'] },
  ] },
  { id: 'm-hnry-1', outcomeId: 'o-hnry', title: 'Auth + onboarding', estimatedMinutes: 480, position: 0, status: 'active', focusWeek: null, candidates: [
    { deliverable: 'Wire Supabase sign-in on app/(auth)/SignInScreen.tsx', estimated_minutes: 150, expected_paths: ['app/(auth)'] },
    { deliverable: 'Build the three-step onboarding flow in app/(onboarding)', estimated_minutes: 150, expected_paths: ['app/(onboarding)'] },
    { deliverable: 'Add sign-out to the Profile screen', estimated_minutes: 60, expected_paths: ['app/Profile.tsx'] },
  ] },
]

const commitments: PlannerCommitment[] = [
  { id: 'c-gym', title: 'Gym', kind: 'fixed', daysOfWeek: [1, 3, 5], durationMinutes: 60, fixedStart: '17:00', fixedEnd: '18:00', dueDate: null, projectId: null, outcomeId: null },
  { id: 'c-leet', title: '30 min LeetCode', kind: 'habit', daysOfWeek: [1, 2, 3, 4, 5], durationMinutes: 30, fixedStart: null, fixedEnd: null, dueDate: null, projectId: 'p-job', outcomeId: 'o-job' },
  { id: 'c-outreach', title: 'Outreach block', kind: 'flexible', daysOfWeek: [2, 4], durationMinutes: 90, fixedStart: null, fixedEnd: null, dueDate: null, projectId: 'p-job', outcomeId: 'o-job' },
  { id: 'c-invoice', title: 'Send September invoice', kind: 'chore', daysOfWeek: [], durationMinutes: 30, fixedStart: null, fixedEnd: null, dueDate: '2026-09-17', projectId: null, outcomeId: null },
]

const base = { days, timeZone: TZ, today: '2026-09-14', now: NOW, commitments, outcomes, milestones, signals: [], kept: [] }

describe('subtractIntervals', () => {
  it('splits a gap around a busy interval and drops slivers', () => {
    const out = subtractIntervals(
      [{ start: T('2026-09-14T13:00:00Z'), end: T('2026-09-14T15:00:00Z') }],
      [{ start: T('2026-09-14T13:30:00Z'), end: T('2026-09-14T14:00:00Z') }]
    )
    expect(out.map((g) => [g.start.toISOString().slice(11, 16), g.end.toISOString().slice(11, 16)])).toEqual([
      ['13:00', '13:30'],
      ['14:00', '15:00'],
    ])
  })
})

describe('planWeek', () => {
  const plan = planWeek(base)
  const on = (date: string) => plan.blocks.filter((b) => b.date === date)
  const local = (d: Date) => d.toISOString().slice(11, 16)

  it('places fixed commitments at their exact time on their days', () => {
    const gym = plan.blocks.filter((b) => b.kind === 'fixed')
    expect(gym.map((g) => g.date)).toEqual(['2026-09-14', '2026-09-16', '2026-09-18'])
    expect(local(gym[0].start)).toBe('21:00') // 17:00 New York
    expect(local(gym[0].end)).toBe('22:00')
  })

  it('places the habit at the start of the first gap every weekday', () => {
    const habits = plan.blocks.filter((b) => b.kind === 'habit')
    expect(habits).toHaveLength(5)
    expect(habits.every((h) => local(h.start) === '13:00' && local(h.end) === '13:30')).toBe(true)
  })

  it('places a chore once, before its due date', () => {
    const chores = plan.blocks.filter((b) => b.kind === 'chore')
    expect(chores).toHaveLength(1)
    expect(chores[0].date <= '2026-09-17').toBe(true)
    expect(chores[0].title).toBe('Send September invoice')
  })

  it('gives every day exactly one goal block, in the largest gap, capped at 180 minutes', () => {
    const goals = plan.blocks.filter((b) => b.kind === 'goal')
    expect(goals).toHaveLength(5)
    for (const g of goals) {
      expect((g.end.getTime() - g.start.getTime()) / 60_000).toBeLessThanOrEqual(180)
      expect(local(g.start) >= '16:00').toBe(true) // the 12:00–19:00 gap is the largest
    }
  })

  it('rotates goal blocks across outcomes and never repeats a candidate in the week', () => {
    const goals = plan.blocks.filter((b) => b.kind === 'goal')
    const byOutcome = goals.reduce<Record<string, number>>((acc, g) => ({ ...acc, [g.outcomeId!]: (acc[g.outcomeId!] ?? 0) + 1 }), {})
    expect(byOutcome['o-hnry']).toBeGreaterThanOrEqual(2)
    expect(byOutcome['o-job']).toBeGreaterThanOrEqual(1)
    const titles = goals.map((g) => g.title)
    expect(new Set(titles).size).toBe(Math.min(titles.length, 5))
  })

  it('places flexible blocks only on their days and only while whitespace allows', () => {
    const flex = plan.blocks.filter((b) => b.kind === 'flexible')
    expect(flex.every((f) => ['2026-09-15', '2026-09-17'].includes(f.date))).toBe(true)
    expect(flex.length).toBeGreaterThanOrEqual(1)
  })

  it('never overlaps blocks within a day', () => {
    for (const d of days) {
      const list = on(d.date).sort((a, b) => a.start.getTime() - b.start.getTime())
      for (let i = 1; i < list.length; i++) {
        expect(list[i].start.getTime()).toBeGreaterThanOrEqual(list[i - 1].end.getTime())
      }
    }
  })

  it('leaves kept blocks alone and plans around them', () => {
    const kept = [{ id: 'k1', date: '2026-09-15', kind: 'goal' as const, commitmentId: null, title: 'Wire Supabase sign-in on app/(auth)/SignInScreen.tsx', start: T('2026-09-15T16:00:00Z'), end: T('2026-09-15T19:00:00Z') }]
    const p = planWeek({ ...base, kept })
    const tue = p.blocks.filter((b) => b.date === '2026-09-15')
    expect(tue.some((b) => b.kind === 'goal')).toBe(false)
    expect(tue.every((b) => b.end <= kept[0].start || b.start >= kept[0].end)).toBe(true)
    expect(p.blocks.filter((b) => b.kind === 'goal').some((b) => b.title === kept[0].title)).toBe(false)
  })

  it('counts kept goal blocks toward rotation', () => {
    // HNRY (weight 3) already owns Monday and Tuesday; by Wednesday the decay
    // (0.7²) puts the job search ahead.
    const kept = [
      { id: 'k4', date: '2026-09-14', kind: 'goal' as const, commitmentId: null, outcomeId: 'o-hnry', title: 'Wire Supabase sign-in on app/(auth)/SignInScreen.tsx', start: T('2026-09-14T16:00:00Z'), end: T('2026-09-14T19:00:00Z') },
      { id: 'k5', date: '2026-09-15', kind: 'goal' as const, commitmentId: null, outcomeId: 'o-hnry', title: 'Build the three-step onboarding flow in app/(onboarding)', start: T('2026-09-15T16:00:00Z'), end: T('2026-09-15T18:30:00Z') },
    ]
    const p = planWeek({ ...base, kept })
    const wed = p.blocks.find((b) => b.kind === 'goal' && b.date === '2026-09-16')!
    expect(wed.outcomeId).toBe('o-job')
    const without = planWeek({ ...base, kept: [] })
    expect(without.blocks.find((b) => b.kind === 'goal' && b.date === '2026-09-14')!.outcomeId).toBe('o-hnry')
  })

  it('does not re-place a weekly commitment the user moved to another day', () => {
    // Tuesday's outreach was dragged to Thursday and locked.
    const kept = [{ id: 'k2', date: '2026-09-17', kind: 'flexible' as const, commitmentId: 'c-outreach', title: 'Outreach block', start: T('2026-09-17T18:00:00Z'), end: T('2026-09-17T19:30:00Z') }]
    const p = planWeek({ ...base, kept })
    const outreach = p.blocks.filter((b) => b.commitmentId === 'c-outreach')
    // Quota is 2 (Tue, Thu); one is kept, so exactly one more may be placed, and not on Thursday.
    expect(outreach).toHaveLength(1)
    expect(outreach[0].date).not.toBe('2026-09-17')
  })

  it('keeps multi-day fixed commitments on their other days when one is kept', () => {
    const kept = [{ id: 'k3', date: '2026-09-14', kind: 'fixed' as const, commitmentId: 'c-gym', title: 'Gym', start: T('2026-09-14T21:00:00Z'), end: T('2026-09-14T22:00:00Z') }]
    const p = planWeek({ ...base, kept })
    expect(p.blocks.filter((b) => b.commitmentId === 'c-gym').map((b) => b.date)).toEqual(['2026-09-16', '2026-09-18'])
  })

  it('places fixed commitments on non-work days but nothing else', () => {
    const saturday: WeekDay = { date: '2026-09-19', weekday: 6, workWindow: { start: T('2026-09-19T13:00:00Z'), end: T('2026-09-19T23:00:00Z') }, gaps: [], available: false }
    const run = { id: 'c-run', title: 'Run', kind: 'fixed' as const, daysOfWeek: [6], durationMinutes: 60, fixedStart: '07:00', fixedEnd: '08:00', dueDate: null, projectId: null, outcomeId: null }
    const p = planWeek({ ...base, days: [...days, saturday], commitments: [...commitments, run] })
    const sat = p.blocks.filter((b) => b.date === '2026-09-19')
    expect(sat.map((b) => b.kind)).toEqual(['fixed'])
    expect(sat[0].title).toBe('Run')
  })

  it('explains what it could not place', () => {
    const tiny = planWeek({ ...base, days: [{ ...days[0], gaps: [{ start: T('2026-09-14T13:00:00Z'), end: T('2026-09-14T13:20:00Z') }] }] })
    expect(tiny.blocks.filter((b) => b.kind === 'goal')).toHaveLength(0)
    expect(tiny.notes.join('\n')).toMatch(/no gap/)
  })

  it('reports a goal with no candidates instead of inventing work', () => {
    const p = planWeek({ ...base, milestones: milestones.map((m) => ({ ...m, candidates: [] })) })
    expect(p.blocks.filter((b) => b.kind === 'goal')).toHaveLength(0)
    expect(p.notes.some((n) => n.includes('no candidates'))).toBe(true)
  })
})
