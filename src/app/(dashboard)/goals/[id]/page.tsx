// src/app/(dashboard)/goals/[id]/page.tsx
// The ladder. Milestones in order, each with its candidates and a projected
// date from observed pace; the pace line and three levers underneath. Nothing
// here is red — a slipping goal shows a grey projected date beside the target.

'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, ChevronRight, Pause, Play } from 'lucide-react'
import { PageTransition, Skeleton } from '@/components/ui'
import { useLadder, useUpdateGoal, useUpdateMilestone } from '@/hooks/useGoals4'
import { cn } from '@/lib/utils'

export default function GoalLadderPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const { data: goal, isLoading } = useLadder(id)
  const updateGoal = useUpdateGoal(id)
  const updateMilestone = useUpdateMilestone()

  if (isLoading || !goal) {
    return (
      <PageTransition>
        <div className="max-w-2xl space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full rounded-3xl" />
          <Skeleton className="h-40 w-full rounded-3xl" />
        </div>
      </PageTransition>
    )
  }

  const { outcome, milestones } = goal
  const hours = (m: number) => Math.round((m / 60) * 10) / 10
  const isActive = outcome.status === 'active'

  return (
    <PageTransition>
      <div className="max-w-2xl">
        <Link href="/goals" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-3 hover:text-ink mb-6">
          <ArrowLeft className="w-4 h-4" strokeWidth={2} /> Goals
        </Link>

        <p className="text-sm font-semibold text-ink-4 uppercase tracking-wider mb-2">
          {outcome.project?.name ?? 'No project'}
          {outcome.target_date && <span className="ml-2 normal-case tracking-normal">by {outcome.target_date}</span>}
        </p>
        <h1 className="text-3xl font-bold text-ink tracking-tight mb-3">{outcome.title}</h1>
        {outcome.definition_of_done && (
          <p className="text-[15px] text-ink-2 leading-relaxed mb-6 max-w-xl">
            <span className="font-semibold text-ink">Done when:</span> {outcome.definition_of_done}
          </p>
        )}

        {/* Pace and levers */}
        <div className="bg-white border border-line rounded-3xl shadow-sm p-5 mb-6">
          <p className="text-[15px] text-ink">{goal.pace_line}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-4">Levers:</span>
            <button
              type="button"
              onClick={() => {
                const next = window.prompt('New target date (yyyy-MM-dd)', outcome.target_date ?? '')
                if (next !== null) updateGoal.mutate({ target_date: next || null })
              }}
              className="rounded-full bg-surface-3 px-3 py-1.5 font-semibold text-ink-2 hover:bg-surface-4"
            >
              move the date
            </button>
            <span className="text-ink-4">·</span>
            <span className="text-ink-3">skip a milestone below</span>
            <span className="text-ink-4">·</span>
            <div className="inline-flex items-center gap-1">
              <span className="text-ink-3">weight</span>
              {[1, 2, 3].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => updateGoal.mutate({ weight: w })}
                  className={cn(
                    'w-7 h-7 rounded-full text-xs font-semibold',
                    outcome.weight === w ? 'bg-brand-500 text-white' : 'bg-surface-3 text-ink-3 hover:bg-surface-4'
                  )}
                >
                  {w}
                </button>
              ))}
            </div>
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => updateGoal.mutate({ status: isActive ? 'paused' : 'active' })}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 font-semibold text-ink-3 hover:border-line-strong"
            >
              {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isActive ? 'Pause' : 'Resume'}
            </button>
          </div>
        </div>

        {/* The ladder */}
        <ol className="space-y-3">
          {milestones.map((m, i) => {
            const done = m.status === 'done'
            const active = m.status === 'active'
            const skipped = m.status === 'skipped'
            return (
              <li
                key={m.id}
                className={cn(
                  'bg-white border rounded-3xl shadow-sm p-5',
                  active ? 'border-brand-300' : 'border-line',
                  (done || skipped) && 'opacity-70'
                )}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
                      done ? 'bg-emerald-100 text-emerald-700' : active ? 'bg-brand-500 text-white' : 'bg-surface-3 text-ink-3'
                    )}
                  >
                    {done ? <Check className="w-4 h-4" strokeWidth={3} /> : i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className={cn('text-[16px] font-semibold text-ink leading-snug', skipped && 'line-through')}>{m.title}</h2>
                      <span className="text-xs text-ink-4 tabular-nums flex-shrink-0">
                        {done ? 'done' : `${hours(m.estimated_minutes)}h`}
                        {!done && m.projected_by && <span className="ml-2">~{m.projected_by}</span>}
                      </span>
                    </div>
                    {m.definition_of_done && <p className="text-sm text-ink-3 mt-1 leading-relaxed">{m.definition_of_done}</p>}

                    {!done && m.candidates.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {m.candidates.map((c, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm text-ink-2">
                            <ChevronRight className="w-4 h-4 text-ink-4 mt-0.5 flex-shrink-0" strokeWidth={2} />
                            <span>
                              {c.deliverable} <span className="text-ink-4 tabular-nums">· {c.estimated_minutes}m</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {done && m.already_done_evidence.length > 0 && (
                      <p className="text-xs text-ink-4 mt-2 font-mono truncate">
                        evidence: {m.already_done_evidence.map(String).join(', ')}
                      </p>
                    )}

                    {!done && !skipped && (
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => updateMilestone.mutate({ id: m.id, status: 'done' })}
                          className="rounded-full bg-surface-3 px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-surface-4"
                        >
                          Mark done
                        </button>
                        <button
                          type="button"
                          onClick={() => updateMilestone.mutate({ id: m.id, status: 'skipped' })}
                          className="rounded-full px-3 py-1.5 text-xs font-semibold text-ink-4 hover:text-ink-2"
                        >
                          Skip
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>

        {outcome.assumptions.length > 0 && (
          <div className="mt-6 text-sm text-ink-3">
            <p className="font-semibold text-ink-2 mb-1">Assumed, because the docs did not say:</p>
            <ul className="list-disc pl-5 space-y-1">
              {outcome.assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </PageTransition>
  )
}
