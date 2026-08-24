// src/app/api/google/calendar/status/route.ts
// Check if the user has a connected Google Calendar

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ connected: false }, { status: 401 })
    }

    const { data: tokenRow } = await supabase
      .from('google_calendar_tokens')
      .select('calendar_id, updated_at')
      .eq('user_id', user.id)
      .single()

    if (!tokenRow) {
      return NextResponse.json({ connected: false })
    }

    return NextResponse.json({
      connected: true,
      calendarId: tokenRow.calendar_id,
      lastSynced: tokenRow.updated_at,
    })
  } catch (error) {
    console.error('Calendar status error:', error)
    return NextResponse.json({ connected: false, error: 'Failed to check status' })
  }
}
