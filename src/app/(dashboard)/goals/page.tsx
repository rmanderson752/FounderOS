// src/app/(dashboard)/goals/page.tsx
// Every goal and where its ladder stands. Read mostly; the only controls are
// weight, pause, and a link to the ladder.

'use client'

import Link from 'next/link'
import { Flag, Plus } from 'lucide-react'
import { PageTransition, Skeleton } from '@/components/ui'
import { useLadders } from '@/hooks/useGoals4'
import { cn } from '@/lib/utils'
import type { LadderView } from '@/lib/goals/ladder'

function statusTone(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-brand-50 text-brand-600'
    case 'done':
      return 'bg-emerald-50 text-emerald-700'
    case 'paused':
      return 'bg-amber-50 text-amber-700'
    default:
      return 'bg-surface-3 text-ink-3'
  }
}

function GoalRow({ goal }: { goal: LadderView }) {
  const done = goal.milestones.filter((m) => m.status === 'done').length
  const active = goal.milestones.find((m) => m.status === 'active') ?? goal.milestones.find((m) => m.status === 'pending')
  return (
    <Link
      href={`/goals/${goal.outcome.id}`}
      className="block bg-white border border-line rounded-3xl shadow-sm p-5 hover:border-line-strong transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-4 mb-1">
            {goal.outcome.project?.name ?? 'No project'}
            {goal.outcome.target_date && <span className="ml-2 normal-case tracking-normal">by {goal.outcome.target_date}</span>}
          </p>
          <h2 className="text-[17px] font-semibold text-ink leading-snug">{goal.outcome.title}</h2>
          {active && (
            <p className="text-sm text-ink-3 mt-1.5">
              Next: <span className="text-ink-2">{active.title}</span>
            </p>
          )}
        </div>
        <span className={cn('text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full flex-shrink-0', statusTone(goal.outcome.status))}>
          {goal.outcome.status}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="flex gap-1 flex-1">
          {goal.milestones.map((m) => (
            <span
              key={m.id}
              className={cn(
                'h-1.5 flex-1 rounded-full',
                m.status === 'done' ? 'bg-emerald-400' : m.status === 'active' ? 'bg-brand-500' : 'bg-surface-4'
              )}
            />
          ))}
        </div>
        <span className="text-xs text-ink-4 tabular-nums flex-shrink-0">
          {done}/{goal.milestones.length}
        </span>
      </div>
      <p className="text-xs text-ink-4 mt-2">{goal.pace_line}</p>
    </Link>
  )
}

export default function GoalsPage() {
  const { data: goals, isLoading } = useLadders()
  const activeGoals = goals?.filter((g) => g.outcome.status === 'active') ?? []
  const otherGoals = goals?.filter((g) => g.outcome.status !== 'active') ?? []

  return (
    <PageTransition>
      <div className="max-w-2xl">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-sm font-semibold text-ink-4 uppercase tracking-wider mb-2">Goals</p>
            <h1 className="text-3xl font-bold text-ink tracking-tight">State it once. The ladder does the rest.</h1>
          </div>
          <Link
            href="/goals/new"
            className="inline-flex items-center gap-2 rounded-full bg-brand-500 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-600 transition-colors flex-shrink-0"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} /> New goal
          </Link>
        </div>

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full rounded-3xl" />
            <Skeleton className="h-32 w-full rounded-3xl" />
          </div>
        )}

        {!isLoading && goals?.length === 0 && (
          <div className="bg-white border border-line rounded-3xl shadow-sm p-6">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center flex-shrink-0">
                <Flag className="w-5 h-5" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-[17px] font-semibold text-ink mb-1.5">No goals yet</h2>
                <p className="text-sm text-ink-3 leading-relaxed">
                  One sentence with a date is enough: &ldquo;HNRY TestFlight beta to 5 testers by Oct 24.&rdquo; It is
                  reverse-engineered into milestones once, and every card carries the chain back to it.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {activeGoals.map((g) => (
            <GoalRow key={g.outcome.id} goal={g} />
          ))}
        </div>

        {otherGoals.length > 0 && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-4 mt-10 mb-3">Paused and finished</p>
            <div className="space-y-3 opacity-80">
              {otherGoals.map((g) => (
                <GoalRow key={g.outcome.id} goal={g} />
              ))}
            </div>
          </>
        )}
      </div>
    </PageTransition>
  )
}
