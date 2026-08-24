// src/app/api/google/calendar/disconnect/route.ts
// Disconnect Google Calendar — revoke tokens and remove from DB

import { createClient } from '@/lib/supabase/server'
import { revokeToken } from '@/lib/google/auth'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Also clear gcal_event_id from all template blocks
    await supabase
      .from('template_blocks')
      .update({ gcal_event_id: null })
      .eq('user_id', user.id)

    await revokeToken(user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Disconnect error:', error)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
}
