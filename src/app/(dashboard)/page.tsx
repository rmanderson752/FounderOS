// src/app/(dashboard)/page.tsx
// v3 morning view.
//
// Phase 0 placeholder: the shell, the date, and an honest account of what is
// not wired up yet. Phase 1 replaces the body with today's timeline and the
// computed free gaps; Phase 2 puts the agent conversation underneath it.

'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { CalendarClock, Plug } from 'lucide-react'
import { PageTransition } from '@/components/ui'
import { useUser } from '@/hooks/useUser'

export default function MorningPage() {
  const { data: user } = useUser()
  const now = new Date()
  const firstName = user?.name?.split(' ')[0]

  return (
    <PageTransition>
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-ink-4 uppercase tracking-wider mb-2">
          {format(now, 'EEEE, d MMMM')}
        </p>
        <h1 className="text-4xl font-bold text-ink tracking-tight mb-3">
          {firstName ? `Morning, ${firstName}.` : 'Good morning.'}
        </h1>
        <p className="text-[17px] text-ink-3 leading-relaxed mb-8">
          One question, one sentence, and your day gets written into the gaps
          your calendar actually leaves open.
        </p>

        <div className="bg-white border border-line rounded-3xl shadow-sm p-6">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center flex-shrink-0">
              <CalendarClock className="w-5 h-5" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h2 className="text-[17px] font-semibold text-ink mb-1.5">
                Not wired up yet
              </h2>
              <p className="text-sm text-ink-3 leading-relaxed mb-4">
                Calendar reading and gap computation land in Phase 1, and the
                planning conversation in Phase 2. Until then this page is
                scaffolding — it deliberately shows nothing rather than
                inventing a plan.
              </p>
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand-500 hover:text-brand-600 transition-colors"
              >
                <Plug className="w-4 h-4" strokeWidth={2.25} />
                Calendar settings
              </Link>
            </div>
          </div>
        </div>

        <p className="text-[13px] text-ink-4 mt-6 leading-relaxed">
          The v2 dashboard is still here at{' '}
          <Link
            href="/legacy"
            className="font-semibold text-ink-3 hover:text-ink underline underline-offset-2 transition-colors"
          >
            /legacy
          </Link>
          , along with /week, /projects, /review and /metrics. Nothing was
          deleted — they are just off the daily path.
        </p>
      </div>
    </PageTransition>
  )
}
