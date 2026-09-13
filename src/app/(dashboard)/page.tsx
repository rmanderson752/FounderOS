// src/app/(dashboard)/page.tsx
// The morning view: the Start Card above today's timeline.
//
// The card is the product. The timeline underneath shows the gap it was
// sized to and the block drawn inside it. Nothing here asks the user for
// anything; the only inputs are corrections.

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { CalendarClock, CalendarX2, Coffee, Flag, PauseCircle } from 'lucide-react'
import { PageTransition, Skeleton } from '@/components/ui'
import { DayTimeline, formatDuration } from '@/components/day'
import { StartCard } from '@/components/card/StartCard'
import { useCard } from '@/hooks/useCard'
import { useUser } from '@/hooks/useUser'

export default function MorningPage() {
  const { data: user } = useUser()
  const [note, setNote] = useState<string | null>(null)
  const { data: card, isLoading, isError, error, isFetching } = useCard(note)

  const firstName = user?.name?.split(' ')[0]
  const day = card?.day

  return (
    <PageTransition>
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-ink-4 uppercase tracking-wider mb-2">
          {format(new Date(), 'EEEE, d MMMM')}
        </p>
        <h1 className="text-4xl font-bold text-ink tracking-tight mb-6">
          {firstName ? `Morning, ${firstName}.` : 'Good morning.'}
        </h1>

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-[180px] w-full rounded-3xl" />
            <Skeleton className="h-5 w-56 mt-6" />
            <Skeleton className="h-[420px] w-full rounded-2xl" />
          </div>
        )}

        {isError && (
          <Notice
            icon={CalendarX2}
            title="Could not build your card"
            body={error instanceof Error ? error.message : 'Something went wrong reading your calendar or goals.'}
            href="/settings"
            cta="Check settings"
          />
        )}

        {card?.status === 'no_calendar' && (
          <Notice
            icon={CalendarClock}
            title="Connect your calendar"
            body="Founder OS reads your day to find the gap that is genuinely free, then sizes one deliverable to it. Read-only; it never writes to your calendar."
            href="/api/calendar/connect"
            cta="Connect Google Calendar"
          />
        )}

        {card?.status === 'unavailable' && (
          <Notice
            icon={Coffee}
            title="Today is marked unavailable"
            body="This weekday is switched off in your work schedule, so there is nothing to plan."
            href="/settings"
            cta="Work schedule"
          />
        )}

        {card?.status === 'no_outcomes' && (
          <Notice
            icon={Flag}
            title="State one goal"
            body="A goal with a date is enough. It gets reverse-engineered into milestones once, and every card after that carries the chain back to it."
            href="/goals/new"
            cta="Add a goal"
          />
        )}

        {card?.status === 'capped' && (
          <Notice
            icon={PauseCircle}
            title="Card generation is paused for today"
            body={card.reason ?? 'The daily cost ceiling was reached.'}
            href="/settings"
            cta="Settings"
          />
        )}

        {card?.status === 'no_window' && day && (
          <p className="text-[17px] text-ink-3 leading-relaxed mb-8">
            No free window left in today&apos;s work hours. Nothing to plan.
          </p>
        )}

        {card?.status === 'ok' && (
          <div className="mb-8">
            <StartCard card={card} onRedirect={setNote} isRefreshing={isFetching} />
          </div>
        )}

        {day && card?.status !== 'unavailable' && (
          <>
            <p className="text-[15px] text-ink-3 leading-relaxed mb-4">
              {day.gaps.length === 0 ? (
                <>Your calendar is full for the rest of today.</>
              ) : (
                <>
                  <span className="font-semibold text-ink">{formatDuration(day.freeMinutes)} free</span> across{' '}
                  {day.gaps.length} {day.gaps.length === 1 ? 'gap' : 'gaps'}.
                </>
              )}
            </p>
            <DayTimeline
              day={day}
              blocks={
                card?.status === 'ok' && card.block
                  ? [
                      {
                        id: card.block.id,
                        deliverable: card.block.deliverable,
                        status: card.block.status,
                        start: new Date(card.block.startsAt),
                        end: new Date(card.block.endsAt),
                      },
                    ]
                  : []
              }
            />
          </>
        )}
      </div>
    </PageTransition>
  )
}

function Notice({
  icon: Icon,
  title,
  body,
  href,
  cta,
}: {
  icon: typeof CalendarClock
  title: string
  body: string
  href: string
  cta: string
}) {
  return (
    <div className="bg-white border border-line rounded-3xl shadow-sm p-6 mb-8">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-ink mb-1.5">{title}</h2>
          <p className="text-sm text-ink-3 leading-relaxed mb-4">{body}</p>
          <Link
            href={href}
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-500 hover:text-brand-600 transition-colors"
          >
            {cta}
          </Link>
        </div>
      </div>
    </div>
  )
}
