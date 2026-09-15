// src/app/api/integrations/hubspot/callback/route.ts
// Finish the HubSpot OAuth round-trip: exchange the code, store encrypted
// tokens on a 'hubspot' integration row, run a first sync.

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { hashToken } from '@/lib/auth/request'
import { getConnection } from '@/lib/calendar/google'
import { exchangeCode, syncHubspot, type HubspotConfig } from '@/lib/integrations/hubspot'
import type { Db } from '@/lib/supabase/types'

function settings(origin: string, status: string) {
  return NextResponse.redirect(new URL(`/settings?hubspot=${status}`, origin))
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const { origin } = url
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  if (error) return settings(origin, error === 'access_denied' ? 'denied' : 'error')
  if (!code || !state) return settings(origin, 'error')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', origin))

  const expected = request.cookies.get('hubspot_oauth_state')?.value
  if (!expected || expected !== state || !state.startsWith(`${user.id}.`)) return settings(origin, 'error')

  try {
    const config = await exchangeCode(origin, code)
    const db = supabase as unknown as Db

    // One HubSpot integration per user: reconnecting replaces its tokens.
    const { data: existing } = await db.from('integrations').select('id, config').eq('user_id', user.id).eq('kind', 'hubspot').maybeSingle()
    let id: string
    if (existing) {
      const merged: HubspotConfig = { ...(existing.config as HubspotConfig), ...config }
      await db.from('integrations').update({ config: merged, active: true, name: config.hub_domain ? `HubSpot — ${config.hub_domain}` : 'HubSpot' }).eq('id', existing.id)
      id = existing.id
    } else {
      const { data: created, error: insertError } = await db
        .from('integrations')
        .insert({
          user_id: user.id,
          kind: 'hubspot',
          name: config.hub_domain ? `HubSpot — ${config.hub_domain}` : 'HubSpot',
          token_hash: hashToken(`hubspot_${randomBytes(18).toString('hex')}`),
          config,
        })
        .select('id')
        .single()
      if (insertError || !created) throw new Error(insertError?.message ?? 'Failed to save integration')
      id = created.id
    }

    // First sync, best effort; the settings card shows the report.
    try {
      const { data: row } = await db.from('integrations').select('id, user_id, name, project_id, config').eq('id', id).single()
      const connection = await getConnection(user.id, db)
      if (row) await syncHubspot(db, row, connection?.timezone ?? 'America/New_York')
    } catch (e) {
      console.error('First HubSpot sync failed:', e)
    }

    const response = settings(origin, 'connected')
    response.cookies.set('hubspot_oauth_state', '', { path: '/', maxAge: 0 })
    return response
  } catch (e) {
    console.error('HubSpot callback failed:', e)
    return settings(origin, 'error')
  }
}
