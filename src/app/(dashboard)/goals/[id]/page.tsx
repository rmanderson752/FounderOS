// src/app/(dashboard)/goals/[id]/page.tsx
//
// A goal is a conversation with a ladder beside it. On a fresh draft the
// agent opens with its first question; you answer in a sentence; after a few
// exchanges it proposes the ladder, which appears on the right and updates
// as you talk ("that's done", "split 4", "add outreach every Tuesday").
// Accept, and the week is planned around it.

'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, ChevronRight, Loader2, Pause, Play, Send } from 'lucide-react'
import { PageTransition, Skeleton } from '@/components/ui'
import { useLadder, useUpdateGoal, useUpdateMilestone } from '@/hooks/useGoals4'
import { useGoalThread, useSendGoalMessage } from '@/hooks/useGoalThread'
import { cn } from '@/lib/utils'

export default function GoalPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const { data: goal, isLoading } = useLadder(id)
  const { data: thread, isLoading: threadLoading } = useGoalThread(id)
  const send = useSendGoalMessage(id)
  const updateGoal = useUpdateGoal(id)
  const updateMilestone = useUpdateMilestone()

  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // The agent speaks first on a fresh draft.
  useEffect(() => {
    if (!goal || !thread || startedRef.current) return
    if (goal.outcome.status === 'draft' && thread.length === 0 && !send.isPending) {
      startedRef.current = true
      send.mutate({ start: true }, { onError: (e) => setError(e instanceof Error ? e.message : 'Could not start') })
    }
  }, [goal, thread, send])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [thread?.length, send.isPending])

  const submit = async () => {
    const text = draft.trim()
    if (!text || send.isPending) return
    setError(null)
    setDraft('')
    try {
      await send.mutateAsync({ message: text })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The agent could not reply')
      setDraft(text)
    }
  }

  if (isLoading || !goal) {
    return (
      <PageTransition>
        <div className="max-w-5xl space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-[480px] w-full rounded-3xl" />
        </div>
      </PageTransition>
    )
  }

  const { outcome, milestones } = goal
  const isDraft = outcome.status === 'draft'
  const isActive = outcome.status === 'active'
  const hours = (m: number) => Math.round((m / 60) * 10) / 10

  return (
    <PageTransition>
      <div className="max-w-5xl">
        <Link href="/goals" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-3 hover:text-ink mb-5">
          <ArrowLeft className="w-4 h-4" strokeWidth={2} /> Goals
        </Link>

        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-4 uppercase tracking-wider mb-1">
              {outcome.project?.name ?? 'No project'}
              {outcome.target_date && <span className="ml-2 normal-case tracking-normal">by {outcome.target_date}</span>}
            </p>
            <h1 className="text-3xl font-bold text-ink tracking-tight">{outcome.title}</h1>
          </div>
          <span className={cn('text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full flex-shrink-0 mt-2',
            isDraft ? 'bg-amber-50 text-amber-700' : isActive ? 'bg-brand-50 text-brand-600' : 'bg-surface-3 text-ink-3')}>
            {isDraft ? 'in conversation' : outcome.status}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-5">
          {/* ---- conversation ---- */}
          <div className="bg-white border border-line rounded-3xl shadow-sm flex flex-col min-h-[520px] max-h-[75vh]">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {threadLoading && <Skeleton className="h-16 w-3/4 rounded-2xl" />}
              {thread?.map((m) => (
                <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap',
                    m.role === 'user' ? 'bg-brand-500 text-white rounded-br-md' : 'bg-surface-3 text-ink rounded-bl-md'
                  )}>
                    {m.text.split('\n').filter((line) => !line.startsWith('⟶')).join('\n') || <span className="text-ink-4 italic">…</span>}
                    {m.role === 'assistant' && m.text.includes('⟶') && (
                      <p className="text-[11px] text-ink-4 mt-1.5">
                        {m.text.split('\n').filter((line) => line.startsWith('⟶')).map((line) => line.replace('⟶ ', '')).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {send.isPending && (
                <div className="flex justify-start">
                  <div className="bg-surface-3 rounded-2xl rounded-bl-md px-4 py-2.5 text-ink-4 text-sm inline-flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> thinking
                  </div>
                </div>
              )}
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <div ref={bottomRef} />
            </div>
            <div className="border-t border-line p-3 flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder={isDraft ? 'Answer in a sentence…' : 'Adjust the ladder: "that\'s done", "split 3", "outreach every Tuesday"…'}
                className="flex-1 bg-transparent outline-none text-[15px] text-ink placeholder:text-ink-4 px-2"
                disabled={send.isPending}
                autoFocus
              />
              <button type="button" onClick={submit} disabled={send.isPending || !draft.trim()} className={cn('w-9 h-9 rounded-full flex items-center justify-center', draft.trim() ? 'bg-brand-500 text-white' : 'bg-surface-3 text-ink-4')} aria-label="Send">
                <Send className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* ---- ladder ---- */}
          <div className="space-y-3">
            {milestones.length === 0 ? (
              <div className="bg-white border border-dashed border-line-strong rounded-3xl p-6 text-sm text-ink-3 leading-relaxed">
                The ladder appears here once the agent has what it needs — usually after two or three answers.
              </div>
            ) : (
              <>
                <div className="bg-white border border-line rounded-3xl shadow-sm p-4">
                  <p className="text-[14px] text-ink">{goal.pace_line}</p>
                  {outcome.definition_of_done && <p className="text-sm text-ink-3 mt-1.5"><span className="font-semibold text-ink-2">Done when:</span> {outcome.definition_of_done}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <div className="inline-flex items-center gap-1">
                      <span className="text-ink-4 text-xs">weight</span>
                      {[1, 2, 3].map((w) => (
                        <button key={w} type="button" onClick={() => updateGoal.mutate({ weight: w })} className={cn('w-6 h-6 rounded-full text-[11px] font-semibold', outcome.weight === w ? 'bg-brand-500 text-white' : 'bg-surface-3 text-ink-3')}>{w}</button>
                      ))}
                    </div>
                    <span className="flex-1" />
                    {isDraft ? (
                      <button type="button" onClick={() => send.mutate({ message: 'Looks good — accept the ladder.' })} disabled={send.isPending} className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 text-white px-3.5 py-1.5 text-sm font-semibold hover:bg-brand-600 disabled:opacity-60">
                        <Check className="w-4 h-4" strokeWidth={2.5} /> Accept ladder
                      </button>
                    ) : (
                      <button type="button" onClick={() => updateGoal.mutate({ status: isActive ? 'paused' : 'active' })} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm font-semibold text-ink-3 hover:border-line-strong">
                        {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        {isActive ? 'Pause' : 'Resume'}
                      </button>
                    )}
                  </div>
                </div>

                <ol className="space-y-2">
                  {milestones.map((m, i) => {
                    const done = m.status === 'done'
                    const active = m.status === 'active'
                    const skipped = m.status === 'skipped'
                    return (
                      <li key={m.id} className={cn('bg-white border rounded-2xl p-4', active ? 'border-brand-300' : 'border-line', (done || skipped) && 'opacity-70')}>
                        <div className="flex items-start gap-3">
                          <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0', done ? 'bg-emerald-100 text-emerald-700' : active ? 'bg-brand-500 text-white' : 'bg-surface-3 text-ink-3')}>
                            {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : i + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-3">
                              <h3 className={cn('text-[15px] font-semibold text-ink leading-snug', skipped && 'line-through')}>{m.title}</h3>
                              <span className="text-[11px] text-ink-4 tabular-nums flex-shrink-0">{done ? 'done' : `${hours(m.estimated_minutes)}h`}{!done && m.projected_by ? ` · ~${m.projected_by}` : ''}</span>
                            </div>
                            {m.definition_of_done && <p className="text-[13px] text-ink-3 mt-0.5 leading-relaxed">{m.definition_of_done}</p>}
                            {!done && m.candidates.length > 0 && (
                              <ul className="mt-2 space-y-1">
                                {m.candidates.map((c, j) => (
                                  <li key={j} className="flex items-start gap-1.5 text-[13px] text-ink-2">
                                    <ChevronRight className="w-3.5 h-3.5 text-ink-4 mt-0.5 flex-shrink-0" strokeWidth={2} />
                                    <span>{c.deliverable} <span className="text-ink-4 tabular-nums">· {c.estimated_minutes}m</span></span>
                                  </li>
                                ))}
                              </ul>
                            )}
                            {!done && !skipped && !isDraft && (
                              <div className="mt-2 flex gap-2">
                                <button type="button" onClick={() => updateMilestone.mutate({ id: m.id, status: 'done' })} className="rounded-full bg-surface-3 px-2.5 py-1 text-[11px] font-semibold text-ink-2 hover:bg-surface-4">Mark done</button>
                                <button type="button" onClick={() => updateMilestone.mutate({ id: m.id, status: 'skipped' })} className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-ink-4 hover:text-ink-2">Skip</button>
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ol>

                {outcome.assumptions.length > 0 && (
                  <div className="text-[13px] text-ink-3">
                    <p className="font-semibold text-ink-2 mb-1">Assumed:</p>
                    <ul className="list-disc pl-5 space-y-0.5">{outcome.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
