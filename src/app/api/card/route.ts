// src/app/api/card/route.ts
//
// The Start Card. GET returns the card for the current window, generating a
// block if none covers it. Accepts a browser session or a CLI bearer token.
//
//   ?cwd=/Users/ryan/hnry   directory the terminal opened in (cwd bonus)
//   ?source=hook|web|email  where the card is being shown (instrumentation)
//   ?note=...               a one-line redirect; forces a fresh block
//   ?format=text            plain text body instead of JSON

import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/request'
import { buildCard } from '@/lib/card/build'
import { todayIn } from '@/lib/calendar/day'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function plain(result: Awaited<ReturnType<typeof buildCard>>): string {
  switch (result.status) {
    case 'ok':
      return result.text
    case 'no_calendar':
      return 'No calendar connected.'
    case 'unavailable':
      return 'Today is marked unavailable in your work schedule. Nothing to plan.'
    case 'no_window':
      return 'No free window left in today\'s work hours. Nothing to plan.'
    case 'no_outcomes':
      return 'No active goals yet. State one: fos goal "…by <date>"'
    case 'capped':
      return `Card generation paused for today: ${result.reason}.`
  }
}

export async function GET(request: NextRequest) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const url = new URL(request.url)
  const cwd = url.searchParams.get('cwd')
  const note = url.searchParams.get('note')
  const source = url.searchParams.get('source') ?? (caller.via === 'bearer' ? 'hook' : 'web')
  const format = url.searchParams.get('format')

  try {
    const result = await buildCard({
      supabase: caller.supabase,
      userId: caller.userId,
      origin: url.origin,
      cwd,
      userNote: note,
    })

    const timeZone = result.status === 'no_calendar' ? 'America/New_York' : result.day.timeZone
    await caller.supabase.from('session_events').insert({
      user_id: caller.userId,
      event: 'card_viewed',
      event_date: todayIn(timeZone),
      metadata: {
        source,
        status: result.status,
        block_id: result.status === 'ok' ? result.block.id : null,
        card_source: result.status === 'ok' ? result.source : null,
        cwd,
      },
    })

    if (format === 'text') {
      return new NextResponse(plain(result) + '\n', {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    }
    return NextResponse.json({ ...result, text: plain(result) })
  } catch (error) {
    console.error('Card build failed:', error)
    const message = error instanceof Error ? error.message : 'Card build failed'
    if (format === 'text') {
      return new NextResponse(`Card unavailable: ${message}\n`, { status: 500, headers: { 'content-type': 'text/plain' } })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
