// src/app/api/google/callback/route.ts
// Handles Google OAuth callback — exchanges code for tokens and stores them

import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens } from '@/lib/google/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // user_id
  const error = searchParams.get('error')

  if (error) {
    console.error('Google OAuth error:', error)
    return NextResponse.redirect(new URL('/settings?gcal=denied', origin))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/settings?gcal=error', origin))
  }

  try {
    const supabase = await createClient()

    // Verify the authenticated user matches the state parameter
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== state) {
      return NextResponse.redirect(new URL('/settings?gcal=error', origin))
    }

    // Exchange the code for tokens
    const tokens = await exchangeCodeForTokens(code)

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Upsert tokens (replace if already exists)
    const { error: dbError } = await supabase
      .from('google_calendar_tokens')
      .upsert(
        {
          user_id: user.id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
          calendar_id: 'primary',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (dbError) {
      console.error('Failed to store Google tokens:', dbError)
      return NextResponse.redirect(new URL('/settings?gcal=error', origin))
    }

    return NextResponse.redirect(new URL('/settings?gcal=connected', origin))
  } catch (err) {
    console.error('Google callback error:', err)
    return NextResponse.redirect(new URL('/settings?gcal=error', origin))
  }
}
