// src/app/api/integrations/webhook/[token]/route.ts
//
// The inbound endpoint a CRM posts to. The token in the URL identifies the
// integration (looked up by hash) and therefore the user; the request then
// runs through the service-role client scoped to that user. No session.

import { NextRequest, NextResponse } from 'next/server'
import { hashToken } from '@/lib/auth/request'
import { createAdminClient } from '@/lib/supabase/admin'
import { processWebhook } from '@/lib/integrations/webhook'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const token = params.token
  if (!token || token.length < 20) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const admin = createAdminClient()
  const { data: integration } = await admin
    .from('integrations')
    .select('id, user_id, name, project_id, active')
    .eq('token_hash', hashToken(token))
    .maybeSingle()
  if (!integration) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!integration.active) return NextResponse.json({ error: 'Integration is paused' }, { status: 410 })

  const body = await request.json().catch(() => null)
  if (body === null) return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 })

  try {
    const report = await processWebhook(admin, integration.user_id, integration, body)
    return NextResponse.json(report, { status: report.accepted > 0 || report.rejected.length === 0 ? 200 : 422 })
  } catch (error) {
    console.error('Webhook failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Webhook failed' }, { status: 500 })
  }
}

/** A GET on the URL is a cheap "is this wired?" check for the CRM's test button. */
export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  const admin = createAdminClient()
  const { data } = await admin.from('integrations').select('name, active').eq('token_hash', hashToken(params.token)).maybeSingle()
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true, name: data.name, active: data.active, accepts: ['activity', 'task', 'deal'] })
}
