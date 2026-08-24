// src/app/api/calendar/callback/route.ts
// Completes the OAuth exchange, stores encrypted tokens, defaults the
// selected calendar to the user's primary.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeCode, listCalendars, saveConnection } from '@/lib/calendar/google'

function settings(origin: string, status: string) {
  return NextResponse.redirect(new URL(`/settings?calendar=${status}`, origin))
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const { origin } = url
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) {
    // The user declined, or Google refused. Not an exception.
    return settings(origin, error === 'access_denied' ? 'denied' : 'error')
  }
  if (!code) return settings(origin, 'error')

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.redirect(new URL('/login', origin))

    // `state` carries the id of the user who started the flow. If it does not
    // match the session, the callback was replayed against a different
    // account — refuse rather than attach someone else's calendar.
    if (state && state !== user.id) return settings(origin, 'error')

    const tokens = await exchangeCode(origin, code)
    const calendars = await listCalendars(tokens.accessToken, origin)
    const primary = calendars.find((c) => c.primary) ?? calendars[0]

    if (!primary) return settings(origin, 'error')

    await saveConnection({
      userId: user.id,
      tokens,
      calendarIds: [primary.id],
      timezone: primary.timezone || 'America/New_York',
    })

    return settings(origin, 'connected')
  } catch (err) {
    console.error('Calendar callback failed:', err)
    return settings(origin, 'error')
  }
}
