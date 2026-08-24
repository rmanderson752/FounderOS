// src/app/api/google/calendar/events/route.ts
// Fetch existing calendar events for a date (for daily view conflict display)

import { createClient } from '@/lib/supabase/server'
import { getValidToken } from '@/lib/google/auth'
import { listEvents } from '@/lib/google/calendar'
import { NextRequest, NextResponse } from 'next/server'

const FOUNDER_OS_TAG = 'founder-os-block'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')

    if (!date) {
      return NextResponse.json({ error: 'Missing date parameter' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const token = await getValidToken(user.id)
    if (!token) {
      return NextResponse.json({ events: [], connected: false })
    }

    const { data: tokenRow } = await supabase
      .from('google_calendar_tokens')
      .select('calendar_id')
      .eq('user_id', user.id)
      .single()

    const calendarId = tokenRow?.calendar_id || 'primary'

    // Fetch events for the entire day
    const timeMin = `${date}T00:00:00Z`
    const timeMax = `${date}T23:59:59Z`

    const allEvents = await listEvents(token, calendarId, timeMin, timeMax)

    // Filter out Founder OS events (show only external events — meetings, calls, etc.)
    const externalEvents = allEvents.filter(event => {
      const isFounderOS = event.extendedProperties?.private?.[FOUNDER_OS_TAG] === 'true'
      return !isFounderOS
    })

    // Return simplified event data
    const events = externalEvents.map(event => ({
      id: event.id,
      title: event.summary || '(No title)',
      start: event.start?.dateTime || '',
      end: event.end?.dateTime || '',
    }))

    return NextResponse.json({ events, connected: true })
  } catch (error) {
    console.error('Fetch events error:', error)
    return NextResponse.json(
      { events: [], error: 'Failed to fetch events' },
      { status: 500 }
    )
  }
}
