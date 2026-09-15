// src/lib/planner/chain.test.ts

import { describe, expect, it } from 'vitest'
import { layDay, type ChainTemplate, type LinkTemplate, type DayLayoutInput } from './chain'

const T = (iso: string) => new Date(iso)
const TZ = 'America/New_York'
// Tuesday 2026-09-15; New York is UTC-4 in September.
const DATE = '2026-09-15'
const local = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ })

const chains: ChainTemplate[] = [
  { id: 'rise', name: 'Rise', role: 'rise', position: 0, anchorKind: 'trigger', anchorTime: null, targetMinutes: null, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], plannable: false, protected: false },
  { id: 'work', name: 'Work', role: 'work', position: 1, anchorKind: 'after_previous', anchorTime: '09:00', targetMinutes: 420, daysOfWeek: [1, 2, 3, 4, 5], plannable: true, protected: false },
  { id: 'live', name: 'Live', role: 'live', position: 2, anchorKind: 'after_previous', anchorTime: '17:00', targetMinutes: 270, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], plannable: false, protected: true },
  { id: 'wind', name: 'Wind down', role: 'winddown', position: 3, anchorKind: 'before_bed', anchorTime: null, targetMinutes: null, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], plannable: false, protected: true },
]
const links: LinkTemplate[] = [
  { id: 'l-gym', chainId: 'rise', position: 0, title: 'Gym', kind: 'fixed', durationMinutes: 60, commitmentId: 'c-gym', daysOfWeek: [1, 2, 3, 5] },
  { id: 'l-coffee', chainId: 'rise', position: 1, title: 'Coffee + LeetCode', kind: 'habit', durationMinutes: 30, commitmentId: null, daysOfWeek: null },
  { id: 'l-deep', chainId: 'work', position: 0, title: 'Deep work', kind: 'goal', durationMinutes: 180, commitmentId: null, daysOfWeek: null },
  { id: 'l-second', chainId: 'work', position: 1, title: 'Second block', kind: 'goal', durationMinutes: 120, commitmentId: null, daysOfWeek: null },
  { id: 'l-free', chainId: 'live', position: 0, title: 'Enjoy it', kind: 'free', durationMinutes: 240, commitmentId: null, daysOfWeek: null },
  { id: 'l-read', chainId: 'wind', position: 0, title: 'Read', kind: 'habit', durationMinutes: 30, commitmentId: null, daysOfWeek: null },
  { id: 'l-card', chainId: 'wind', position: 1, title: "Tomorrow's card", kind: 'habit', durationMinutes: 10, commitmentId: null, daysOfWeek: null },
]

const fills = [
  { outcomeId: 'o1', milestoneId: 'm1', projectId: 'p1', deliverable: 'Wire Supabase sign-in on SignInScreen.tsx', expectedPaths: ['app/(auth)'], rationale: 'HNRY → Auth', minutes: 120 },
  { outcomeId: 'o2', milestoneId: 'm2', projectId: 'p2', deliverable: 'Write target-role.md', expectedPaths: [], rationale: 'Job → Decide', minutes: 60 },
]

function base(over: Partial<DayLayoutInput> = {}): DayLayoutInput {
  let i = 0
  return {
    date: DATE,
    weekday: 2,
    timeZone: TZ,
    now: T('2026-09-15T10:00:00Z'), // 6:00 AM, before the day
    busy: [],
    chains,
    links,
    runs: [],
    fillGoal: () => fills[i++] ?? null,
    extras: [],
    wakeTime: '07:00',
    bedTime: '22:30',
    ...over,
  }
}

describe('layDay', () => {
  it('lays Rise from the wake time and Work right after it', () => {
    const out = layDay(base())
    const rise = out.chains.find((c) => c.chainId === 'rise')!
    const work = out.chains.find((c) => c.chainId === 'work')!
    expect(local(rise.anchorAt)).toBe('7:00 AM')
    expect(rise.links.map((l) => l.title)).toEqual(['Gym', 'Coffee + LeetCode'])
    expect(local(rise.end)).toBe('8:30 AM')
    expect(work.anchorAt.getTime()).toBe(rise.end.getTime())
  })

  it('fills goal slots from the ladders, in order, sized to the fill', () => {
    const out = layDay(base())
    const work = out.chains.find((c) => c.chainId === 'work')!
    expect(work.links.map((l) => l.kind)).toEqual(['goal', 'goal'])
    expect(work.links[0].title).toBe('Wire Supabase sign-in on SignInScreen.tsx')
    expect((work.links[0].end.getTime() - work.links[0].start.getTime()) / 60_000).toBe(120)
    expect(work.links[1].goal?.outcomeId).toBe('o2')
  })

  it('skips a busy calendar event and resumes after it', () => {
    const meeting = { start: T('2026-09-15T13:00:00Z'), end: T('2026-09-15T14:00:00Z') } // 9:00–10:00 AM
    const out = layDay(base({ busy: [meeting] }))
    const work = out.chains.find((c) => c.chainId === 'work')!
    // Work anchors at 8:30; the 120-min deep block would cross the 9:00 meeting, so it starts at 10:00.
    expect(local(work.links[0].start)).toBe('10:00 AM')
    expect(local(work.links[0].end)).toBe('12:00 PM')
  })

  it('a late-started Rise shifts everything after it', () => {
    const out = layDay(base({ runs: [{ chainId: 'rise', startedAt: T('2026-09-15T12:30:00Z'), donePositions: [], resumeAt: null }] })) // 8:30 AM
    const rise = out.chains.find((c) => c.chainId === 'rise')!
    const work = out.chains.find((c) => c.chainId === 'work')!
    expect(local(rise.anchorAt)).toBe('8:30 AM')
    expect(local(work.anchorAt)).toBe('10:00 AM')
  })

  it('lays remaining links from resumeAt once links are done', () => {
    const out = layDay(base({ runs: [{ chainId: 'rise', startedAt: T('2026-09-15T11:00:00Z'), donePositions: [0], resumeAt: T('2026-09-15T12:15:00Z') }] }))
    const rise = out.chains.find((c) => c.chainId === 'rise')!
    expect(rise.links.map((l) => l.title)).toEqual(['Coffee + LeetCode'])
    expect(local(rise.links[0].start)).toBe('8:15 AM')
  })

  it('Wind down is laid backward from bedtime', () => {
    const out = layDay(base())
    const wind = out.chains.find((c) => c.chainId === 'wind')!
    expect(local(wind.end)).toBe('10:30 PM')
    expect(local(wind.anchorAt)).toBe('9:50 PM')
    expect(wind.links.map((l) => l.title)).toEqual(['Read', "Tomorrow's card"])
  })

  it('Live is protected: extras never land there, but Work takes them under the ceiling', () => {
    const extras = [
      { title: 'Outreach block', kind: 'flexible' as const, minutes: 90, commitmentId: 'c-out' },
      { title: 'Send invoice', kind: 'chore' as const, minutes: 30, commitmentId: 'c-inv' },
    ]
    const out = layDay(base({ extras }))
    const work = out.chains.find((c) => c.chainId === 'work')!
    const live = out.chains.find((c) => c.chainId === 'live')!
    // whitespace: ceiling 420 × 0.7 = 294 min overall; template links use 180,
    // outreach (90) fits, the invoice (30) would cross the budget and is reported.
    expect(work.links.filter((l) => l.extra).map((l) => l.title)).toEqual(['Outreach block'])
    expect(work.notes.join(' ')).toMatch(/whitespace/)
    expect(live.links.map((l) => l.kind)).toEqual(['free'])
    const workMinutes = work.links.reduce((s, l) => s + (l.end.getTime() - l.start.getTime()) / 60_000, 0)
    expect(workMinutes).toBeLessThanOrEqual(420 * 0.7 + 1)
  })

  it('stops at the ceiling and says so', () => {
    const big = [
      { outcomeId: 'o1', milestoneId: 'm1', projectId: 'p1', deliverable: 'A long thing', expectedPaths: [], rationale: null, minutes: 180 },
      { outcomeId: 'o2', milestoneId: 'm2', projectId: 'p2', deliverable: 'Another long thing', expectedPaths: [], rationale: null, minutes: 120 },
    ]
    let i = 0
    const out = layDay(base({ fillGoal: () => big[i++] ?? null, chains: chains.map((c) => (c.id === 'work' ? { ...c, targetMinutes: 240 } : c)) }))
    const work = out.chains.find((c) => c.chainId === 'work')!
    expect(work.links).toHaveLength(1)
    expect(work.notes.join(' ')).toMatch(/ceiling/)
  })

  it('reports a goal slot it could not fill instead of inventing work', () => {
    const out = layDay(base({ fillGoal: () => null }))
    const work = out.chains.find((c) => c.chainId === 'work')!
    expect(work.links).toHaveLength(0)
    expect(work.notes.join(' ')).toMatch(/no goal candidates/)
  })

  it('omits a chain and links not scheduled for this weekday', () => {
    const out = layDay(base({ weekday: 6 })) // Saturday: no Work; gym not on Saturday
    expect(out.chains.map((c) => c.chainId)).toEqual(['rise', 'live', 'wind'])
    expect(out.chains[0].links.map((l) => l.title)).toEqual(['Coffee + LeetCode'])
  })
})
