// src/app/api/google/auth/route.ts
// Initiates Google OAuth flow for Calendar access

import { createClient } from '@/lib/supabase/server'
import { buildGoogleAuthUrl } from '@/lib/google/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url)

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/settings?gcal=error', origin))
    }

    const authUrl = buildGoogleAuthUrl(user.id)
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('Google auth error:', error)
    return NextResponse.redirect(new URL('/settings?gcal=error', origin))
  }
}
