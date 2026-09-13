// src/app/api/calendar/status/route.ts
// Is the v3 (read-only, encrypted) calendar connected?

import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/request'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data } = await caller.supabase
    .from('calendar_connections')
    .select('timezone, calendar_ids, last_synced_at, expires_at')
    .eq('user_id', caller.userId)
    .eq('provider', 'google')
    .maybeSingle()

  if (!data) return NextResponse.json({ connected: false })
  return NextResponse.json({
    connected: true,
    timezone: data.timezone,
    calendarIds: data.calendar_ids ?? [],
    lastSyncedAt: data.last_synced_at,
  })
}
