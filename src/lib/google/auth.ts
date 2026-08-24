// src/lib/google/auth.ts
// Google OAuth token management — server-side only

import { createClient } from '@/lib/supabase/server'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke'

/**
 * Get a valid access token for the user.
 * Refreshes automatically if expired.
 */
export async function getValidToken(userId: string): Promise<string | null> {
  const supabase = await createClient()

  const { data: tokenRow, error } = await supabase
    .from('google_calendar_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !tokenRow) return null

  // Check if token is expired (with 5-minute buffer)
  const expiresAt = new Date(tokenRow.expires_at)
  const now = new Date()
  const bufferMs = 5 * 60 * 1000

  if (expiresAt.getTime() - bufferMs > now.getTime()) {
    // Token still valid
    return tokenRow.access_token
  }

  // Token expired — refresh it
  try {
    const refreshed = await refreshAccessToken(tokenRow.refresh_token)

    const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

    await supabase
      .from('google_calendar_tokens')
      .update({
        access_token: refreshed.access_token,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    return refreshed.access_token
  } catch (err) {
    console.error('Failed to refresh Google token:', err)
    return null
  }
}

/**
 * Refresh an access token using a refresh token.
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token refresh failed: ${err}`)
  }

  return res.json()
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Code exchange failed: ${err}`)
  }

  return res.json()
}

/**
 * Revoke tokens and remove from database.
 */
export async function revokeToken(userId: string): Promise<void> {
  const supabase = await createClient()

  const { data: tokenRow } = await supabase
    .from('google_calendar_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .single()

  if (tokenRow) {
    // Best-effort revoke with Google
    try {
      await fetch(`${GOOGLE_REVOKE_URL}?token=${tokenRow.access_token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    } catch {
      // Revoke may fail if token is already expired — that's fine
    }
  }

  // Delete from our database regardless
  await supabase
    .from('google_calendar_tokens')
    .delete()
    .eq('user_id', userId)
}

/**
 * Check if user has a connected Google Calendar.
 */
export async function isCalendarConnected(userId: string): Promise<boolean> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('google_calendar_tokens')
    .select('id')
    .eq('user_id', userId)
    .single()

  return !!data
}

/**
 * Build Google OAuth URL for the consent screen.
 */
export function buildGoogleAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar',
    access_type: 'offline',
    prompt: 'consent',
    state: userId,
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}
