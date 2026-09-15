// src/lib/card/render.ts
//
// The card as plain text. Identical in the terminal, on /, and in the email —
// one renderer, three surfaces. Pure.
//
//   HNRY → TestFlight beta to 5 testers by Oct 24 → Milestone 2/5: auth + onboarding
//   NOW (2h10m until 3:30 showing):
//     Wire Supabase sign-in on app/(auth)/SignInScreen.tsx and verify the happy path.
//   Observed: 6 commits on ~/hnry Tue–Wed. Session Wed 4:10pm left sign-up unstarted.
//   Pace: needs ~22h; at ~5h/wk that lands Oct 30, target Oct 24.
//   Start: cd ~/hnry && claude "continue: wire Supabase sign-in"
//   Signals as of 9:04.  fos no "…" to redirect · fos done · nothing needed otherwise

import { formatInTimeZone } from 'date-fns-tz'
import type { CardWindow, PlannerSignal } from '@/lib/planner/types'

export interface CardData {
  timeZone: string
  now: Date
  window: CardWindow
  /** What ends the window: the next event's title, or null for the work-window end / cap. */
  windowEndsWith: string | null
  project: string | null
  outcome: string
  targetDate: string | null
  milestone: { title: string; index: number; count: number } | null
  deliverable: string
  rationale: string | null
  observed: string
  paceLine: string | null
  startCommand: string | null
  /** e.g. "Outpost scores higher today (rock this week). fos start outpost to switch." */
  disagreement: string | null
  /** e.g. "9:04 block: done (2 commits on app/(auth))" */
  previous: string | null
  source: 'model' | 'fallback' | 'existing'
  signalsAsOf: Date
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}m`
}

function shortDate(date: string): string {
  return formatInTimeZone(new Date(`${date}T12:00:00Z`), 'UTC', 'MMM d')
}

export function renderCard(card: CardData): string {
  const clock = (d: Date) => formatInTimeZone(d, card.timeZone, 'h:mm a')
  const lines: string[] = []

  const chain = [
    card.project,
    card.targetDate ? `${card.outcome} by ${shortDate(card.targetDate)}` : card.outcome,
    card.milestone ? `Milestone ${card.milestone.index + 1}/${card.milestone.count}: ${card.milestone.title}` : null,
  ]
    .filter(Boolean)
    .join(' → ')
  lines.push(chain)

  if (card.previous) lines.push(card.previous)

  const label = card.window.kind === 'now' ? 'NOW' : `NEXT at ${clock(card.window.start)}`
  const until = card.windowEndsWith
    ? `${formatMinutes(card.window.minutes)} until ${clock(card.window.end)} ${card.windowEndsWith}`
    : `${formatMinutes(card.window.minutes)} until ${clock(card.window.end)}`
  lines.push(`${label} (${until}):`)
  lines.push(`  ${card.deliverable}`)
  if (card.rationale) lines.push(`  ${card.rationale}`)

  lines.push(`Observed: ${card.observed}`)
  if (card.paceLine) lines.push(`Pace: ${card.paceLine}`)
  if (card.startCommand) lines.push(`Start: ${card.startCommand}`)
  if (card.disagreement) lines.push(card.disagreement)

  const tail = [`Signals as of ${clock(card.signalsAsOf)}.`, 'fos no "…" to redirect · fos done · nothing needed otherwise']
  if (card.source === 'fallback') tail.push('(fallback card: the model did not produce a valid proposal)')
  lines.push(tail.join('  '))

  return lines.join('\n')
}

/** The "Observed:" line from recent signals on the chosen project. */
export function observedLine(signals: PlannerSignal[], timeZone: string, repoLabel: string | null): string {
  if (signals.length === 0) return 'nothing yet on this project.'

  const commits = signals.filter((s) => s.source === 'git')
  const sessions = signals.filter((s) => s.source === 'session')
  const parts: string[] = []

  if (commits.length > 0) {
    const days = Array.from(new Set(commits.map((c) => formatInTimeZone(c.occurredAt, timeZone, 'EEE'))))
    const span = days.length === 1 ? days[0] : `${days[days.length - 1]}–${days[0]}`
    const subjects = commits
      .slice(0, 2)
      .map((c) => c.summary.replace(/^\w+(\([^)]*\))?:\s*/, '').slice(0, 48))
      .join(', ')
    parts.push(`${commits.length} commit${commits.length === 1 ? '' : 's'}${repoLabel ? ` on ${repoLabel}` : ''} ${span} (${subjects}).`)
  }

  if (sessions.length > 0) {
    const last = sessions[0]
    const when = formatInTimeZone(last.occurredAt, timeZone, 'EEE h:mmaaa')
    const brief = last.summary ? `: ${last.summary.slice(0, 60)}` : ''
    parts.push(`Session ${when}${brief}.`)
  }

  return parts.join(' ')
}
