// src/lib/card/context.ts
//
// The state block: everything the card turn needs, regenerated fresh each
// call, rendered with sorted keys so identical state produces identical
// bytes. Memory lives in tables, not in a growing transcript — the card turn
// never sees previous conversations.

import { formatInTimeZone } from 'date-fns-tz'
import type { Candidate, CardWindow, PlannerMilestone, PlannerOutcome, PlannerSignal } from '@/lib/planner/types'

export interface LastBlockSummary {
  deliverable: string
  status: string
  confidence: number | null
  endedAt: Date
}

export interface CardContextInput {
  timeZone: string
  window: CardWindow
  outcome: PlannerOutcome & { definitionOfDone: string | null }
  milestone: PlannerMilestone | null
  milestoneIndex: number
  milestoneCount: number
  recentSignals: PlannerSignal[]
  lastBlock: LastBlockSummary | null
  paceLine: string
  repoPath: string | null
  /** A one-line redirect from the user (`fos no "..."`), if any. */
  userNote: string | null
}

function stable(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.keys(v)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (v as Record<string, unknown>)[k]
          return acc
        }, {})
    }
    return v
  }, 2)
}

export function buildStateBlock(input: CardContextInput): string {
  const fmt = (d: Date) => formatInTimeZone(d, input.timeZone, 'EEE HH:mm')

  const state = {
    window: {
      starts: fmt(input.window.start),
      ends: fmt(input.window.end),
      minutes: input.window.minutes,
      kind: input.window.kind,
    },
    outcome: {
      title: input.outcome.title,
      project: input.outcome.projectName,
      definition_of_done: input.outcome.definitionOfDone,
      target_date: input.outcome.targetDate,
      repo_path: input.repoPath,
    },
    milestone: input.milestone
      ? {
          title: input.milestone.title,
          position: `${input.milestoneIndex + 1}/${input.milestoneCount}`,
          candidates: input.milestone.candidates.map((c: Candidate) => ({
            deliverable: c.deliverable,
            estimated_minutes: c.estimated_minutes,
            expected_paths: c.expected_paths,
          })),
        }
      : null,
    observed: input.recentSignals.map((s) => ({
      when: fmt(s.occurredAt),
      source: s.source,
      summary: s.summary,
      paths: s.paths.slice(0, 6),
      duration_minutes: s.durationMinutes,
    })),
    last_block: input.lastBlock
      ? {
          deliverable: input.lastBlock.deliverable,
          resolved: input.lastBlock.status,
          confidence: input.lastBlock.confidence,
          ended: fmt(input.lastBlock.endedAt),
        }
      : null,
    pace: input.paceLine,
    user_note: input.userNote,
  }

  return `<state>\n${stable(state)}\n</state>`
}
