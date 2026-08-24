// src/app/api/calendar/connect/route.ts
// Starts the v3 Google Calendar OAuth flow (read-only).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildAuthUrl } from '@/lib/calendar/google'

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url)

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/login', origin))
    }

    // The user id round-trips through `state` so the callback knows who came
    // back without trusting anything in the query string.
    return NextResponse.redirect(buildAuthUrl(origin, user.id))
  } catch (error) {
    console.error('Calendar connect failed:', error)
    return NextResponse.redirect(new URL('/settings?calendar=error', origin))
  }
}
