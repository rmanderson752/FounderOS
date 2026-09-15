// src/app/api/integrations/hubspot/connect/route.ts
// Start the HubSpot OAuth round-trip. Session only.

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { authorizeUrl, hubspotConfigured } from '@/lib/integrations/hubspot'

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url)
  if (!hubspotConfigured()) return NextResponse.redirect(new URL('/settings?hubspot=unconfigured', origin))

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', origin))

  // state = user id + nonce; the callback checks the user against the session.
  const state = `${user.id}.${randomBytes(8).toString('hex')}`
  const response = NextResponse.redirect(authorizeUrl(origin, state))
  response.cookies.set('hubspot_oauth_state', state, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 600 })
  return response
}
