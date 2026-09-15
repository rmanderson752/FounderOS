// src/app/(dashboard)/page.tsx
// The week, front and center, with today's Start Card above it.
//
// The card is what to do now. The calendar underneath is the week as
// planned: events, goal blocks, recurring commitments, habits, chores, due
// dates. Drag to move, drag the bottom edge to resize, click to edit, click
// empty space or the Add button to add, or tell the planner in one line.

'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { CalendarClock, CalendarX2, ChevronLeft, ChevronRight, Flag, Loader2, PauseCircle, Plus, Send, Sparkles, Wand2 } from 'lucide-react'
import { PageTransition, Skeleton } from '@/components/ui'
import { StartCard } from '@/components/card/StartCard'
import { WeekCalendar } from '@/components/week/WeekCalendar'
import { BlockEditor, type BlockPatch } from '@/components/week/BlockEditor'
import { AddBlockDialog } from '@/components/week/AddBlockDialog'
import { useCard } from '@/hooks/useCard'
import { useUser } from '@/hooks/useUser'
import { useCreateBlock, useDeleteBlock, usePatchBlock, usePlanWeek, useWeek, useWeekChat } from '@/hooks/useWeek'
import { cn } from '@/lib/utils'
import type { WeekBlock } from '@/lib/week/plan'

function shiftWeek(weekStart: string, weeks: number): string {
  const d = new Date(`${weekStart}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + weeks * 7)
  return d.toISOString().slice(0, 10)
}

export default function MorningPage() {
  const { data: user } = useUser()
  const [note, setNote] = useState<string | null>(null)
  const { data: card, isLoading: cardLoading, isError: cardError, error: cardErr, isFetching } = useCard(note)

  const [weekStart, setWeekStart] = useState<string | null>(null)
  const { data: week, isLoading: weekLoading, isError: weekError, error: weekErr } = useWeek(weekStart)
  const plan = usePlanWeek(weekStart)
  const patch = usePatchBlock(weekStart)
  const create = useCreateBlock(weekStart)
  const remove = useDeleteBlock(weekStart)
  const chat = useWeekChat(weekStart)

  const [command, setCommand] = useState('')
  const [reply, setReply] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adding, setAdding] = useState<{ open: boolean; at: Date | null }>({ open: false, at: null })
  const [actionError, setActionError] = useState<string | null>(null)

  const firstName = user?.name?.split(' ')[0]
  const selected = week?.blocks.find((b) => b.id === selectedId) ?? null

  const send = async () => {
    const text = command.trim()
    if (!text) return
    setReply(null)
    try {
      const result = await chat.mutateAsync(text)
      setReply(result.reply || 'Done.')
      setCommand('')
    } catch (e) {
      setReply(e instanceof Error ? e.message : 'The planner could not do that.')
    }
  }

  const applyPatch = useCallback(
    async (block: WeekBlock, body: BlockPatch) => {
      setActionError(null)
      try {
        await patch.mutateAsync({ id: block.id, ...body })
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'Could not update that block.')
      }
    },
    [patch]
  )

  const onMove = useCallback((block: WeekBlock, startsAt: Date, endsAt: Date) => applyPatch(block, { starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() }), [applyPatch])
  const onResize = useCallback((block: WeekBlock, endsAt: Date) => applyPatch(block, { ends_at: endsAt.toISOString() }), [applyPatch])
  const onSelect = useCallback((block: WeekBlock) => setSelectedId((cur) => (cur === block.id ? null : block.id)), [])
  const onAddAt = useCallback((at: Date) => setAdding({ open: true, at }), [])

  return (
    <PageTransition>
      <div className="max-w-5xl">
        <p className="text-sm font-semibold text-ink-4 uppercase tracking-wider mb-2">{format(new Date(), 'EEEE, d MMMM')}</p>
        <h1 className="text-4xl font-bold text-ink tracking-tight mb-6">{firstName ? `Morning, ${firstName}.` : 'Good morning.'}</h1>

        {/* ---- the card ---- */}
        {cardLoading && <Skeleton className="h-[160px] w-full rounded-3xl mb-8" />}
        {cardError && (
          <Notice icon={CalendarX2} title="Could not build your card" body={cardErr instanceof Error ? cardErr.message : 'Something went wrong.'} href="/settings" cta="Check settings" />
        )}
        {card?.status === 'no_outcomes' && (
          <Notice icon={Flag} title="State one goal" body="Say it in a sentence. The agent asks what it needs, proposes the ladder, and plans the week around it." href="/goals/new" cta="Start a goal" />
        )}
        {card?.status === 'capped' && (
          <Notice icon={PauseCircle} title="Card generation is paused for today" body={card.reason ?? 'The daily cost ceiling was reached.'} href="/settings" cta="Settings" />
        )}
        {card?.status === 'no_window' && (
          <p className="text-[15px] text-ink-3 leading-relaxed mb-6">No free window left in today&apos;s work hours. The week below is what comes next.</p>
        )}
        {card?.status === 'ok' && (
          <div className="mb-8">
            <StartCard card={card} onRedirect={setNote} isRefreshing={isFetching} />
          </div>
        )}

        {/* ---- the week ---- */}
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setWeekStart(shiftWeek(week?.weekStart ?? new Date().toISOString().slice(0, 10), -1))} className="w-8 h-8 rounded-full hover:bg-surface-3 flex items-center justify-center text-ink-3" aria-label="Previous week">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-[17px] font-semibold text-ink px-1">{week ? `Week of ${format(new Date(`${week.weekStart}T12:00:00Z`), 'MMM d')}` : 'This week'}</h2>
            <button type="button" onClick={() => setWeekStart(shiftWeek(week?.weekStart ?? new Date().toISOString().slice(0, 10), 1))} className="w-8 h-8 rounded-full hover:bg-surface-3 flex items-center justify-center text-ink-3" aria-label="Next week">
              <ChevronRight className="w-4 h-4" />
            </button>
            {weekStart && <button type="button" onClick={() => setWeekStart(null)} className="text-xs font-semibold text-brand-600 ml-1">today</button>}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setAdding({ open: true, at: null })} disabled={!week} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-2 text-sm font-semibold text-ink-2 hover:border-line-strong disabled:opacity-50">
              <Plus className="w-4 h-4" strokeWidth={2.5} /> Add
            </button>
            <button type="button" onClick={() => plan.mutate()} disabled={plan.isPending || !week} className="inline-flex items-center gap-2 rounded-full bg-brand-500 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-600 disabled:opacity-50 transition-colors">
              {plan.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" strokeWidth={2} />}
              {week?.blocks.length ? 'Re-plan week' : 'Plan my week'}
            </button>
          </div>
        </div>

        {weekLoading && <Skeleton className="h-[520px] w-full rounded-2xl" />}
        {weekError && <p className="text-sm text-rose-600 mb-4">{weekErr instanceof Error ? weekErr.message : 'Could not load the week.'}</p>}
        {week && !week.connected && (
          <p className="text-xs text-ink-4 mb-3 flex items-center gap-1.5">
            <CalendarClock className="w-3.5 h-3.5" /> No calendar connected — your work window counts as free.{' '}
            <a href="/api/calendar/connect" className="text-brand-600 font-semibold">Connect Google Calendar</a> to plan around real events.
          </p>
        )}
        {week?.calendar && (
          <div className="bg-white border border-line rounded-3xl shadow-sm p-4">
            <WeekCalendar week={week} onMove={onMove} onResize={onResize} onSelect={onSelect} onAddAt={onAddAt} selectedId={selectedId} />
            {actionError && <p className="text-xs text-rose-600 mt-2">{actionError}</p>}
            {week.notes.length > 0 && (
              <ul className="mt-3 text-xs text-ink-4 space-y-0.5">
                {week.notes.slice(0, 5).map((n, i) => <li key={i}>· {n}</li>)}
              </ul>
            )}
          </div>
        )}

        {selected && week && (
          <div className="mt-3">
            <BlockEditor
              block={selected}
              timeZone={week.timeZone}
              busy={patch.isPending || remove.isPending}
              onSave={(body) => applyPatch(selected, body)}
              onDelete={async () => {
                setSelectedId(null)
                await remove.mutateAsync(selected.id)
              }}
              onClose={() => setSelectedId(null)}
            />
          </div>
        )}

        {/* ---- tell the planner ---- */}
        <div className="mt-4 bg-white border border-line rounded-3xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-brand-500 flex-shrink-0" strokeWidth={2} />
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder='Tell the planner: "push outreach to Thursday", "gym Mon/Wed/Fri at 7", "plan my week"'
              className="flex-1 bg-transparent outline-none text-[15px] text-ink placeholder:text-ink-4"
              disabled={chat.isPending}
            />
            <button type="button" onClick={send} disabled={chat.isPending || !command.trim()} className={cn('w-9 h-9 rounded-full flex items-center justify-center', command.trim() ? 'bg-brand-500 text-white' : 'bg-surface-3 text-ink-4')} aria-label="Send">
              {chat.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" strokeWidth={2} />}
            </button>
          </div>
          {reply && <p className="text-sm text-ink-2 mt-3 pl-7">{reply}</p>}
        </div>

        <p className="text-xs text-ink-4 mt-4">
          Goals and their ladders live on <Link href="/goals" className="text-brand-600 font-semibold">Goals</Link>. The week is re-planned every Sunday from your goals and commitments; locked and finished blocks stay put.
        </p>

        <AddBlockDialog
          open={adding.open}
          timeZone={week?.timeZone ?? 'America/New_York'}
          initialStart={adding.at}
          onCreate={async (input) => {
            await create.mutateAsync(input)
          }}
          onClose={() => setAdding({ open: false, at: null })}
        />
      </div>
    </PageTransition>
  )
}

function Notice({ icon: Icon, title, body, href, cta }: { icon: typeof CalendarClock; title: string; body: string; href: string; cta: string }) {
  return (
    <div className="bg-white border border-line rounded-3xl shadow-sm p-6 mb-8">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-ink mb-1.5">{title}</h2>
          <p className="text-sm text-ink-3 leading-relaxed mb-4">{body}</p>
          <Link href={href} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-500 hover:text-brand-600 transition-colors">{cta}</Link>
        </div>
      </div>
    </div>
  )
}
