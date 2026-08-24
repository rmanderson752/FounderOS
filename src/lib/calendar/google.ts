// src/lib/calendar/google.ts
//
// Google Calendar access for the v3 daily path. Server only.
//
// Read-only by design: the scope is calendar.readonly and nothing here writes
// to a calendar. Write access is explicitly out of scope for v3.
//
// This is deliberately separate from src/lib/google/*, which serves the v2
// routes and stores tokens unencrypted in google_calendar_tokens. The two do
// not share state.

import { google } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'
import { createClient } from '@/lib/supabase/server'
import { decryptToken, encryptToken } from './crypto'
import type { CalendarEvent } from './types'

/** Read-only. Do not widen without revisiting the v3 brief, section 5. */
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'

/** Refresh this far ahead of expiry so a request never races the deadline. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000

export interface CalendarConnection {
  userId: string
  accessToken: string
  refreshToken: string
  expiresAt: Date
  calendarIds: string[]
  timezone: string
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

function redirectUri(origin: string): string {
  // Deliberately NOT GOOGLE_REDIRECT_URI: that variable belongs to the v2
  // flow and points at /api/google/callback. Sharing it would send the v3
  // consent screen back into the v2 handler.
  //
  // Derived from the request by default, so localhost and preview
  // deployments work without configuration. Set the override only to pin an
  // exact URI in production.
  return process.env.GOOGLE_CALENDAR_REDIRECT_URI || `${origin}/api/calendar/callback`
}

export function oauthClient(origin: string): OAuth2Client {
  return new google.auth.OAuth2(
    requireEnv('GOOGLE_CLIENT_ID'),
    requireEnv('GOOGLE_CLIENT_SECRET'),
    redirectUri(origin)
  )
}

/**
 * The consent URL.
 *
 * `access_type: 'offline'` plus `prompt: 'consent'` is what guarantees a
 * refresh token. Google omits the refresh token on repeat authorisations
 * unless consent is forced, which strands the connection the first time the
 * access token expires.
 */
export function buildAuthUrl(origin: string, state: string): string {
  return oauthClient(origin).generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [CALENDAR_SCOPE],
    include_granted_scopes: true,
    state,
  })
}

export interface ExchangedTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

export async function exchangeCode(origin: string, code: string): Promise<ExchangedTokens> {
  const { tokens } = await oauthClient(origin).getToken(code)

  if (!tokens.access_token) throw new Error('Google did not return an access token')
  if (!tokens.refresh_token) {
    throw new Error(
      'Google did not return a refresh token. Revoke the app at ' +
        'myaccount.google.com/permissions and connect again.'
    )
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600 * 1000),
  }
}

/** Persist a connection, encrypting both tokens. */
export async function saveConnection(input: {
  userId: string
  tokens: ExchangedTokens
  calendarIds: string[]
  timezone: string
}): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase.from('calendar_connections').upsert(
    {
      user_id: input.userId,
      provider: 'google',
      access_token: encryptToken(input.tokens.accessToken),
      refresh_token: encryptToken(input.tokens.refreshToken),
      expires_at: input.tokens.expiresAt.toISOString(),
      calendar_ids: input.calendarIds,
      timezone: input.timezone,
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,provider' }
  )

  if (error) throw new Error(`Failed to save calendar connection: ${error.message}`)
}

/** The stored connection with tokens decrypted, or null if not connected. */
export async function getConnection(userId: string): Promise<CalendarConnection | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .maybeSingle()

  if (error || !data) return null

  return {
    userId,
    accessToken: decryptToken(data.access_token),
    refreshToken: decryptToken(data.refresh_token),
    expiresAt: new Date(data.expires_at),
    calendarIds: data.calendar_ids ?? [],
    timezone: data.timezone,
  }
}

/**
 * A usable access token, refreshing and persisting when close to expiry.
 *
 * Google may hand back a rotated refresh token; when it does, store it or the
 * connection dies at the next rotation.
 */
export async function freshAccessToken(
  connection: CalendarConnection,
  origin: string
): Promise<string> {
  if (connection.expiresAt.getTime() - REFRESH_MARGIN_MS > Date.now()) {
    return connection.accessToken
  }

  const client = oauthClient(origin)
  client.setCredentials({ refresh_token: connection.refreshToken })

  const { credentials } = await client.refreshAccessToken()
  if (!credentials.access_token) throw new Error('Google refresh returned no access token')

  const expiresAt = new Date(credentials.expiry_date ?? Date.now() + 3600 * 1000)
  const supabase = await createClient()

  const update: Record<string, string> = {
    access_token: encryptToken(credentials.access_token),
    expires_at: expiresAt.toISOString(),
  }
  if (credentials.refresh_token) {
    update.refresh_token = encryptToken(credentials.refresh_token)
  }

  await supabase
    .from('calendar_connections')
    .update(update)
    .eq('user_id', connection.userId)
    .eq('provider', 'google')

  return credentials.access_token
}

function authorisedClient(accessToken: string, origin: string): OAuth2Client {
  const client = oauthClient(origin)
  client.setCredentials({ access_token: accessToken })
  return client
}

export interface CalendarSummary {
  id: string
  title: string
  primary: boolean
  timezone: string | null
}

export async function listCalendars(
  accessToken: string,
  origin: string
): Promise<CalendarSummary[]> {
  const calendar = google.calendar({ version: 'v3', auth: authorisedClient(accessToken, origin) })
  const { data } = await calendar.calendarList.list({ maxResults: 250 })

  return (data.items ?? []).map((item) => ({
    id: item.id ?? '',
    title: item.summary ?? 'Untitled',
    primary: item.primary === true,
    timezone: item.timeZone ?? null,
  }))
}

/**
 * Map Google's event shape onto ours.
 *
 * `transparency` is passed through rather than defaulted, because the busy
 * rules for timed and all-day events differ — see `isBusy` in ./gaps.
 */
function toCalendarEvent(item: {
  id?: string | null
  summary?: string | null
  status?: string | null
  transparency?: string | null
  start?: { date?: string | null; dateTime?: string | null } | null
  end?: { date?: string | null; dateTime?: string | null } | null
}): CalendarEvent | null {
  const start = item.start?.dateTime ?? item.start?.date
  const end = item.end?.dateTime ?? item.end?.date
  if (!start || !end) return null

  const transparency =
    item.transparency === 'transparent' || item.transparency === 'opaque'
      ? item.transparency
      : undefined

  const status =
    item.status === 'confirmed' || item.status === 'tentative' || item.status === 'cancelled'
      ? item.status
      : undefined

  return {
    id: item.id ?? `${start}-${end}`,
    title: item.summary ?? 'Busy',
    start,
    end,
    allDay: !item.start?.dateTime,
    transparency,
    status,
  }
}

/**
 * Events overlapping [timeMin, timeMax) across every selected calendar.
 *
 * `singleEvents` expands recurring series into instances — without it a weekly
 * standup arrives as one master event and never blocks any actual day.
 */
export async function fetchEvents(input: {
  accessToken: string
  origin: string
  calendarIds: string[]
  timeMin: Date
  timeMax: Date
}): Promise<CalendarEvent[]> {
  const calendar = google.calendar({
    version: 'v3',
    auth: authorisedClient(input.accessToken, input.origin),
  })

  const perCalendar = await Promise.all(
    input.calendarIds.map(async (calendarId) => {
      try {
        const { data } = await calendar.events.list({
          calendarId,
          timeMin: input.timeMin.toISOString(),
          timeMax: input.timeMax.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 250,
        })
        return (data.items ?? [])
          .map(toCalendarEvent)
          .filter((event): event is CalendarEvent => event !== null)
      } catch (error) {
        // One unreadable calendar (revoked share, deleted) must not blank out
        // the whole day. Log and continue with the rest.
        console.error(`Failed to read calendar ${calendarId}:`, error)
        return []
      }
    })
  )

  return perCalendar.flat()
}
