// src/app/api/integrations/hubspot/sync/route.ts
// Pull now. Session or CLI token.

import { NextRequest, NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/request'
import { getConnection } from '@/lib/calendar/google'
import { loadHubspotIntegrations, syncHubspot } from '@/lib/integrations/hubspot'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const caller = await resolveCaller(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const integrations = await loadHubspotIntegrations(caller.supabase, caller.userId)
  if (integrations.length === 0) return NextResponse.json({ error: 'HubSpot is not connected' }, { status: 404 })
  const connection = await getConnection(caller.userId, caller.supabase)
  const timeZone = connection?.timezone ?? 'America/New_York'
  const reports = []
  for (const integration of integrations) {
    try {
      reports.push({ id: integration.id, ...(await syncHubspot(caller.supabase, integration, timeZone)) })
    } catch (e) {
      reports.push({ id: integration.id, error: e instanceof Error ? e.message : 'sync failed' })
    }
  }
  return NextResponse.json({ reports })
}
