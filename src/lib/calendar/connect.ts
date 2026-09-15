// src/lib/calendar/connect.ts
//
// The v3 calendar OAuth round-trip, shared by two routes:
//   /api/calendar/callback   the proper v3 redirect URI
//   /api/google/callback     the v2 URI that is already registered on the
//                            Google OAuth client — when its `state` carries
//                            the v3 prefix, it completes the v3 connection so
//                            a fresh install works without touching the
//                            Google Cloud console
//
// `state` is `v3:<user id>`: it must match the session, so a replayed
// callback cannot attach a calendar to a different account.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeCode, listCalendars, saveConnection } from './google'

export const V3_STATE_PREFIX = 'v3:'

export function v3State(userId: string): string {
  return `${V3_STATE_PREFIX}${userId}`
}

export function isV3State(state: string | null): boolean {
  return !!state && state.startsWith(V3_STATE_PREFIX)
}

function settings(origin: string, status: string) {
  return NextResponse.redirect(new URL(`/settings?calendar=${status}`, origin))
}

export async function completeCalendarConnection(request: Request): Promise<NextResponse> {
  const url = new URL(request.url)
  const { origin } = url
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) return settings(origin, error === 'access_denied' ? 'denied' : 'error')
  if (!code) return settings(origin, 'error')

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(new URL('/login', origin))
    if (state !== v3State(user.id) && state !== user.id) return settings(origin, 'error')

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
