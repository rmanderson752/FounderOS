// src/lib/planner/chain.ts
//
// Lay a day out as chains. Pure.
//
// A chain is ordered links with durations. Only its anchor is on the clock:
//   trigger         the user starts it (tap, hook); the clock time is the
//                   planning fallback
//   after_previous  starts when the previous chain ends
//   clock           starts at a time
//   before_bed      ends at bedtime; the start is derived backward
//
// Links are laid from the anchor by summing durations. A busy calendar event
// interrupts: the cursor jumps to the event's end and the chain resumes.
// A chain with a ceiling stops laying links when the next one would cross
// it. A plannable chain (Work) also receives what the planner adds — goal
// slots filled from the ladders, chores, flexible commitments — while a
// protected chain (Live) gets only its own links.
//
// Runs carry state: once a run has started, its remaining links are laid
// from `resumeAt` (now, after the last completed link), so a late start or
// an early finish shifts the rest instead of leaving holes.

import { fromZonedTime } from 'date-fns-tz'
import type { TimeInterval } from '@/lib/calendar/types'

export type ChainRole = 'rise' | 'work' | 'live' | 'winddown' | 'custom'
export type AnchorKind = 'trigger' | 'after_previous' | 'clock' | 'before_bed'
export type LinkKind = 'habit' | 'fixed' | 'flexible' | 'goal' | 'chore' | 'free'

export interface ChainTemplate {
  id: string
  name: string
  role: ChainRole
  position: number
  anchorKind: AnchorKind
  /** `HH:mm`; the fallback for trigger, the time for clock, bedtime for before_bed. */
  anchorTime: string | null
  /** Ceiling in minutes; null = the sum of the links. */
  targetMinutes: number | null
  daysOfWeek: number[]
  plannable: boolean
  protected: boolean
}

export interface LinkTemplate {
  id: string
  chainId: string
  position: number
  title: string
  kind: LinkKind
  durationMinutes: number
  commitmentId: string | null
  /** null = every day the chain runs */
  daysOfWeek: number[] | null
}

export interface RunState {
  chainId: string
  startedAt: Date | null
  /** Positions already materialised (done, or kept blocks). Skipped when laying. */
  donePositions: number[]
  /** Lay remaining links from here (now, after the last completed link). */
  resumeAt: Date | null
}

export interface GoalFill {
  outcomeId: string
  milestoneId: string | null
  projectId: string | null
  deliverable: string
  expectedPaths: string[]
  rationale: string | null
  minutes: number
}

export interface Extra {
  title: string
  kind: 'chore' | 'flexible'
  minutes: number
  commitmentId: string | null
  rationale?: string | null
}

export interface DayLayoutInput {
  date: string
  weekday: number
  timeZone: string
  now: Date
  /** Busy calendar events and kept blocks; links skip over these. */
  busy: TimeInterval[]
  chains: ChainTemplate[]
  links: LinkTemplate[]
  runs: RunState[]
  /** Fill a goal slot; return null when nothing fits. Called in link order. */
  fillGoal: (slot: { maxMinutes: number; index: number }) => GoalFill | null
  /** What the planner may add to plannable chains, in priority order. */
  extras: Extra[]
  wakeTime: string | null
  bedTime: string | null
  /** Fraction of a plannable chain's ceiling that extras may fill beyond template links. */
  fillRatio?: number
}

export interface LaidLink extends TimeInterval {
  chainId: string
  linkId: string | null
  position: number
  kind: LinkKind
  title: string
  commitmentId: string | null
  goal: GoalFill | null
  rationale: string | null
  /** True for links the planner appended (chores, flexible), not template links. */
  extra: boolean
}

export interface LaidChain {
  chainId: string
  name: string
  role: ChainRole
  anchorAt: Date
  end: Date
  links: LaidLink[]
  notes: string[]
}

export interface DayLayout {
  chains: LaidChain[]
  notes: string[]
}

const DEFAULT_FILL_RATIO = 0.7
const DEFAULTS = { wake: '07:00', bed: '22:30', work: '09:00' }

function zoned(date: string, time: string, timeZone: string): Date {
  const t = time.length === 5 ? `${time}:00` : time
  return fromZonedTime(`${date}T${t}`, timeZone)
}

function overlaps(a: TimeInterval, b: TimeInterval): boolean {
  return a.start < b.end && a.end > b.start
}

/** Advance `cursor` past any busy interval a link of `minutes` would hit. */
function clearCursor(cursor: Date, minutes: number, busy: TimeInterval[]): Date {
  let c = cursor
  for (let guard = 0; guard < 50; guard++) {
    const candidate = { start: c, end: new Date(c.getTime() + minutes * 60_000) }
    const hit = busy.filter((b) => overlaps(candidate, b)).sort((x, y) => x.end.getTime() - y.end.getTime()).pop()
    if (!hit) return c
    c = new Date(hit.end)
  }
  return c
}

export function layDay(input: DayLayoutInput): DayLayout {
  const notes: string[] = []
  const laid: LaidChain[] = []
  const fillRatio = input.fillRatio ?? DEFAULT_FILL_RATIO
  const busy = [...input.busy]
  let prevEnd: Date | null = null
  let goalIndex = 0
  const extras = [...input.extras]

  const chains = input.chains
    .filter((c) => c.daysOfWeek.includes(input.weekday))
    .sort((a, b) => a.position - b.position)

  for (const chain of chains) {
    const run = input.runs.find((r) => r.chainId === chain.id)
    const done = new Set(run?.donePositions ?? [])
    const templateLinks = input.links
      .filter((l) => l.chainId === chain.id && (l.daysOfWeek === null || l.daysOfWeek.includes(input.weekday)))
      .sort((a, b) => a.position - b.position)

    // ---- anchor --------------------------------------------------------
    let start: Date
    if (run?.startedAt) {
      start = run.startedAt
    } else {
      switch (chain.anchorKind) {
        case 'clock':
          start = zoned(input.date, chain.anchorTime ?? DEFAULTS.work, input.timeZone)
          break
        case 'trigger':
          start = zoned(input.date, chain.anchorTime ?? input.wakeTime ?? DEFAULTS.wake, input.timeZone)
          break
        case 'after_previous':
          start = prevEnd ?? zoned(input.date, chain.anchorTime ?? DEFAULTS.work, input.timeZone)
          break
        case 'before_bed': {
          const bed = zoned(input.date, chain.anchorTime ?? input.bedTime ?? DEFAULTS.bed, input.timeZone)
          const total = templateLinks.filter((l) => !done.has(l.position)).reduce((s, l) => s + l.durationMinutes, 0)
          start = new Date(bed.getTime() - total * 60_000)
          break
        }
      }
    }

    const remainingFrom = run?.resumeAt && run.resumeAt > start ? run.resumeAt : start
    let cursor = remainingFrom
    const ceilingEnd = chain.targetMinutes ? new Date(start.getTime() + chain.targetMinutes * 60_000) : null
    const links: LaidLink[] = []
    const chainNotes: string[] = []

    const place = (minutes: number): TimeInterval | null => {
      const from = clearCursor(cursor, minutes, busy)
      const end = new Date(from.getTime() + minutes * 60_000)
      if (ceilingEnd && end > ceilingEnd) return null
      cursor = end
      return { start: from, end }
    }

    // ---- template links ---------------------------------------------------
    for (const link of templateLinks) {
      if (done.has(link.position)) continue
      if (link.kind === 'goal') {
        if (!chain.plannable) continue
        const fill = input.fillGoal({ maxMinutes: link.durationMinutes, index: goalIndex })
        if (!fill) {
          chainNotes.push(`${chain.name}: nothing to fill "${link.title}" — no goal candidates`)
          continue
        }
        goalIndex++
        const interval = place(Math.min(fill.minutes, link.durationMinutes))
        if (!interval) {
          chainNotes.push(`${chain.name}: ceiling reached before "${fill.deliverable.slice(0, 40)}…"`)
          break
        }
        links.push({ ...interval, chainId: chain.id, linkId: link.id, position: link.position, kind: 'goal', title: fill.deliverable, commitmentId: null, goal: fill, rationale: fill.rationale, extra: false })
        busy.push(interval)
        continue
      }
      const interval = place(link.durationMinutes)
      if (!interval) {
        chainNotes.push(`${chain.name}: ceiling reached before "${link.title}"`)
        break
      }
      links.push({ ...interval, chainId: chain.id, linkId: link.id, position: link.position, kind: link.kind, title: link.title, commitmentId: link.commitmentId, goal: null, rationale: null, extra: false })
      busy.push(interval)
    }

    // ---- planner additions, plannable chains only ---------------------------
    if (chain.plannable && !chain.protected && extras.length > 0) {
      const templateMinutes = links.reduce((s, l) => s + (l.end.getTime() - l.start.getTime()) / 60_000, 0)
      const ceiling = chain.targetMinutes ?? templateMinutes
      const budget = Math.max(0, ceiling * fillRatio - templateMinutes)
      let used = 0
      let position = (templateLinks[templateLinks.length - 1]?.position ?? -1) + 1
      while (extras.length > 0) {
        const extra = extras[0]
        if (used + extra.minutes > budget) {
          chainNotes.push(`${chain.name}: left "${extra.title}" unplanned to keep whitespace`)
          break
        }
        const interval = place(extra.minutes)
        if (!interval) {
          chainNotes.push(`${chain.name}: ceiling reached before "${extra.title}"`)
          break
        }
        extras.shift()
        links.push({ ...interval, chainId: chain.id, linkId: null, position: position++, kind: extra.kind, title: extra.title, commitmentId: extra.commitmentId, goal: null, rationale: extra.rationale ?? null, extra: true })
        busy.push(interval)
        used += extra.minutes
      }
    }

    const end = links.length > 0 ? links[links.length - 1].end : cursor
    laid.push({ chainId: chain.id, name: chain.name, role: chain.role, anchorAt: start, end, links, notes: chainNotes })
    notes.push(...chainNotes)
    prevEnd = end
  }

  if (extras.length > 0) notes.push(`${extras.length} item${extras.length === 1 ? '' : 's'} did not fit today: ${extras.map((e) => e.title).slice(0, 3).join(', ')}`)
  return { chains: laid, notes }
}

/** The default day: Rise → Work → Live → Wind down. */
export function defaultChains(userId: string): Array<Omit<ChainTemplate, 'id'> & { user_id: string; links: Array<Omit<LinkTemplate, 'id' | 'chainId'>> }> {
  const all = [0, 1, 2, 3, 4, 5, 6]
  const weekdays = [1, 2, 3, 4, 5]
  return [
    {
      user_id: userId,
      name: 'Rise',
      role: 'rise',
      position: 0,
      anchorKind: 'trigger',
      anchorTime: null,
      targetMinutes: null,
      daysOfWeek: all,
      plannable: false,
      protected: false,
      links: [],
    },
    {
      user_id: userId,
      name: 'Work',
      role: 'work',
      position: 1,
      anchorKind: 'after_previous',
      anchorTime: '09:00',
      targetMinutes: 420,
      daysOfWeek: weekdays,
      plannable: true,
      protected: false,
      links: [
        { position: 0, title: 'Deep work', kind: 'goal', durationMinutes: 180, commitmentId: null, daysOfWeek: null },
        { position: 1, title: 'Second block', kind: 'goal', durationMinutes: 120, commitmentId: null, daysOfWeek: null },
      ],
    },
    {
      user_id: userId,
      name: 'Live',
      role: 'live',
      position: 2,
      anchorKind: 'after_previous',
      anchorTime: '17:00',
      targetMinutes: 270,
      daysOfWeek: all,
      plannable: false,
      protected: true,
      links: [{ position: 0, title: 'Enjoy it', kind: 'free', durationMinutes: 240, commitmentId: null, daysOfWeek: null }],
    },
    {
      user_id: userId,
      name: 'Wind down',
      role: 'winddown',
      position: 3,
      anchorKind: 'before_bed',
      anchorTime: null,
      targetMinutes: null,
      daysOfWeek: all,
      plannable: false,
      protected: true,
      links: [
        { position: 0, title: 'No screens, read', kind: 'habit', durationMinutes: 30, commitmentId: null, daysOfWeek: null },
        { position: 1, title: "Tomorrow's card", kind: 'habit', durationMinutes: 10, commitmentId: null, daysOfWeek: null },
      ],
    },
  ]
}
