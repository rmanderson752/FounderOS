// src/app/(dashboard)/page.tsx
// v3 morning view.
//
// Phase 1: today's calendar and the real free gaps, computed on the server.
// Phase 2 puts the planning conversation underneath this timeline.

'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { CalendarClock, CalendarX2, Coffee } from 'lucide-react'
import { PageTransition, Skeleton } from '@/components/ui'
import { DayTimeline, formatDuration } from '@/components/day'
import { useDayCalendar } from '@/hooks/useDayCalendar'
import { useUser } from '@/hooks/useUser'

export default function MorningPage() {
  const { data: user } = useUser()
  const { data, isLoading, isError } = useDayCalendar()

  const firstName = user?.name?.split(' ')[0]
  const day = data?.day

  return (
    <PageTransition>
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-ink-4 uppercase tracking-wider mb-2">
          {format(new Date(), 'EEEE, d MMMM')}
        </p>
        <h1 className="text-4xl font-bold text-ink tracking-tight mb-3">
          {firstName ? `Morning, ${firstName}.` : 'Good morning.'}
        </h1>

        {isLoading && (
          <div className="mt-8 space-y-3">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-[420px] w-full rounded-2xl" />
          </div>
        )}

        {isError && (
          <Notice
            icon={CalendarX2}
            title="Could not read your calendar"
            body="The connection may have expired or been revoked. Reconnecting usually fixes it."
            href="/api/calendar/connect"
            cta="Reconnect Google Calendar"
          />
        )}

        {!isLoading && !isError && data && !data.connected && (
          <Notice
            icon={CalendarClock}
            title="Connect your calendar"
            body="Founder OS reads your day to find the gaps that are genuinely free, then plans into them. Read-only — it never writes to your calendar."
            href="/api/calendar/connect"
            cta="Connect Google Calendar"
          />
        )}

        {!isLoading && data?.connected && data.available === false && (
          <Notice
            icon={Coffee}
            title="Today is marked unavailable"
            body="This weekday is switched off in your schedule, so there is nothing to plan. Change it in settings if that is wrong."
            href="/settings"
            cta="Work schedule"
          />
        )}

        {day && data?.available !== false && (
          <>
            <p className="text-[17px] text-ink-3 leading-relaxed mb-8">
              {day.gaps.length === 0 ? (
                <>Your calendar is full today. Nothing to plan into.</>
              ) : (
                <>
                  <span className="font-semibold text-ink">
                    {formatDuration(day.freeMinutes)} free
                  </span>{' '}
                  across {day.gaps.length}{' '}
                  {day.gaps.length === 1 ? 'gap' : 'gaps'}.
                </>
              )}
            </p>
            <DayTimeline day={day} />
            <p className="text-[13px] text-ink-4 mt-6 leading-relaxed">
              Gaps are what is left after your events, inside your work window,
              ignoring anything marked free. The planning conversation lands in
              Phase 2.
            </p>
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
    <div className="bg-white border border-line rounded-3xl shadow-sm p-6 mt-8">
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
